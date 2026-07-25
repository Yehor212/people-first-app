const UUID_V4_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-4[0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;
const RECOVERY_SECRET_PATTERN = /^[A-Za-z0-9_-]{42}[AEIMQUYcgkosw048]$/;
const SHA256_HEX_PATTERN = /^[a-f0-9]{64}$/;

export interface AccountDeletionCapability {
  operationId: string;
  recoverySecret: string;
}

export type AccountDeletionPhase =
  | "push-drain"
  | "media-before-rows"
  | "rows"
  | "media-after-rows"
  | "auth";

export type AccountDeletionClaim =
  | {
    state: "claimed";
    userId: string;
    leaseToken: string;
    leaseEpoch: number;
    phase: AccountDeletionPhase;
  }
  | { state: "deleted" }
  | { state: "pending" }
  | { state: "invalid" };

export interface ClaimedAccountDeletionSteps {
  phase: AccountDeletionPhase;
  renewLease: () => Promise<boolean>;
  drainPushDeliveries: () => Promise<boolean>;
  purgeMediaBatch: () => Promise<{ complete: boolean }>;
  purgeRows: () => Promise<unknown>;
  deleteAuthUser: () => Promise<unknown>;
  advancePhase: (phase: AccountDeletionPhase) => Promise<boolean>;
  completeOperation: () => Promise<boolean>;
  releaseOperation: () => Promise<boolean>;
}

function isAccountDeletionPhase(value: unknown): value is AccountDeletionPhase {
  return (
    value === "push-drain" ||
    value === "media-before-rows" ||
    value === "rows" ||
    value === "media-after-rows" ||
    value === "auth"
  );
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

export function isAccountDeletionOperationId(value: unknown): value is string {
  return typeof value === "string" && UUID_V4_PATTERN.test(value);
}

export function isAccountDeletionRecoverySecret(value: unknown): value is string {
  return typeof value === "string" && RECOVERY_SECRET_PATTERN.test(value);
}

export function parseAccountDeletionCapability(
  value: unknown,
  allowedExtraKeys: readonly string[] = [],
): AccountDeletionCapability | null {
  if (!isRecord(value)) return null;
  const allowedKeys = new Set([
    "operationId",
    "recoverySecret",
    ...allowedExtraKeys,
  ]);
  if (Object.keys(value).some((key) => !allowedKeys.has(key))) return null;
  if (
    !isAccountDeletionOperationId(value.operationId) ||
    !isAccountDeletionRecoverySecret(value.recoverySecret)
  ) {
    return null;
  }
  return {
    operationId: value.operationId,
    recoverySecret: value.recoverySecret,
  };
}

export async function hashAccountDeletionRecoverySecret(
  recoverySecret: string,
): Promise<string> {
  if (!isAccountDeletionRecoverySecret(recoverySecret)) {
    throw new Error("Invalid account deletion recovery secret");
  }
  const digest = await globalThis.crypto.subtle.digest(
    "SHA-256",
    new TextEncoder().encode(recoverySecret),
  );
  return Array.from(new Uint8Array(digest), (byte) => byte.toString(16).padStart(2, "0")).join("");
}

export function parseAccountDeletionClaim(value: unknown): AccountDeletionClaim {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return { state: "invalid" };
  }
  const row = value[0];
  if (row.state === "deleted") return { state: "deleted" };
  if (row.state === "pending") return { state: "pending" };
  if (
    row.state === "claimed" &&
    typeof row.user_id === "string" &&
    UUID_V4_PATTERN.test(row.user_id) &&
    isAccountDeletionOperationId(row.lease_token) &&
    typeof row.lease_epoch === "number" &&
    Number.isSafeInteger(row.lease_epoch) &&
    row.lease_epoch > 0 &&
    isAccountDeletionPhase(row.phase)
  ) {
    return {
      state: "claimed",
      userId: row.user_id,
      leaseToken: row.lease_token,
      leaseEpoch: row.lease_epoch,
      phase: row.phase,
    };
  }
  return { state: "invalid" };
}

export function isAccountDeletionRecoveryHash(value: unknown): value is string {
  return typeof value === "string" && SHA256_HEX_PATTERN.test(value);
}

export function isAuthUserNotFound(value: unknown): boolean {
  return isRecord(value) && value.code === "user_not_found";
}

/**
 * Runs only after the database has atomically bound the owner, capability and
 * deletion barrier. Every destructive step is repeatable. The final receipt is
 * committed only by the current fencing token; a superseded worker may finish
 * cleanup but can never report success.
 */
export async function runClaimedAccountDeletion(
  steps: ClaimedAccountDeletionSteps,
): Promise<"deleted" | "pending"> {
  try {
    let phase = steps.phase;
    while (true) {
      if (!(await steps.renewLease())) return "pending";

      if (phase === "push-drain") {
        if (!(await steps.drainPushDeliveries())) {
          await steps.releaseOperation();
          return "pending";
        }
        if (!(await steps.advancePhase("media-before-rows"))) return "pending";
        phase = "media-before-rows";
        continue;
      }

      if (phase === "media-before-rows" || phase === "media-after-rows") {
        const media = await steps.purgeMediaBatch();
        if (!media.complete) {
          await steps.releaseOperation();
          return "pending";
        }
        const nextPhase: AccountDeletionPhase = phase === "media-before-rows" ? "rows" : "auth";
        if (!(await steps.advancePhase(nextPhase))) return "pending";
        phase = nextPhase;
        continue;
      }

      if (phase === "rows") {
        await steps.purgeRows();
        if (!(await steps.advancePhase("media-after-rows"))) return "pending";
        phase = "media-after-rows";
        continue;
      }

      await steps.deleteAuthUser();
      return (await steps.completeOperation()) ? "deleted" : "pending";
    }
  } catch (error) {
    try {
      await steps.releaseOperation();
    } catch {
      // The lease expires and can be reclaimed. Preserve the destructive-step
      // error instead of replacing it with a secondary release failure.
    }
    throw error;
  }
}
