export type PushDeliveryEligibility =
  | { state: "allowed" }
  | { state: "blocked" }
  | { state: "unavailable" };

interface DeletionBlockLookupResult {
  data: { user_id: string } | null;
  error: unknown | null;
}

interface PushDeliveryPermitRpcResult {
  data: unknown;
  error: unknown | null;
}

export interface PushDeliveryPermitDependencies {
  rpc: (
    functionName: string,
    args: Record<string, unknown>,
  ) => PromiseLike<PushDeliveryPermitRpcResult>;
  randomUUID: () => string;
}

export type PushDeliveryPermitExecution<T> =
  | { state: "blocked" }
  | { state: "unavailable" }
  | {
    state: "completed";
    value: T;
    releaseConfirmed: boolean;
  };

const UUID_PATTERN = /^[0-9a-f]{8}-[0-9a-f]{4}-[1-8][0-9a-f]{3}-[89ab][0-9a-f]{3}-[0-9a-f]{12}$/i;

interface AdmittedPermit {
  ownerId: string;
  permitToken: string;
  leaseEpoch: number;
}

function isRecord(value: unknown): value is Record<string, unknown> {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function parsePermitAdmission(
  value: unknown,
  ownerId: string,
  permitToken: string,
): { state: "blocked" } | { state: "unavailable" } | {
  state: "admitted";
  permit: AdmittedPermit;
} {
  if (!Array.isArray(value) || value.length !== 1 || !isRecord(value[0])) {
    return { state: "unavailable" };
  }

  const row = value[0];
  if (row.state === "blocked") return { state: "blocked" };
  if (row.state !== "admitted") return { state: "unavailable" };
  if (
    row.owner_id !== ownerId ||
    row.permit_token !== permitToken ||
    typeof row.lease_epoch !== "number" ||
    !Number.isSafeInteger(row.lease_epoch) ||
    row.lease_epoch <= 0 ||
    typeof row.lease_expires_at !== "string" ||
    !Number.isFinite(Date.parse(row.lease_expires_at))
  ) {
    return { state: "unavailable" };
  }

  return {
    state: "admitted",
    permit: {
      ownerId,
      permitToken,
      leaseEpoch: row.lease_epoch,
    },
  };
}

async function releasePushDeliveryPermit(
  dependencies: PushDeliveryPermitDependencies,
  permit: AdmittedPermit,
): Promise<boolean> {
  try {
    const released = await dependencies.rpc("release_push_delivery_permit", {
      p_owner_id: permit.ownerId,
      p_permit_token: permit.permitToken,
      p_lease_epoch: permit.leaseEpoch,
    });
    return released.error === null && released.data === true;
  } catch {
    return false;
  }
}

/**
 * A service-role client bypasses the authenticated RLS barrier, so every push
 * delivery must explicitly consult the permanent deletion block. Database
 * failures are intentionally collapsed to a fixed fail-closed state.
 */
export async function checkPushDeliveryEligibility(
  ownerId: string,
  lookup: (ownerId: string) => PromiseLike<DeletionBlockLookupResult>,
): Promise<PushDeliveryEligibility> {
  if (!UUID_PATTERN.test(ownerId)) return { state: "unavailable" };

  try {
    const result = await lookup(ownerId);
    if (result.error) return { state: "unavailable" };
    if (!result.data) return { state: "allowed" };
    if (result.data.user_id !== ownerId) return { state: "unavailable" };
    return { state: "blocked" };
  } catch {
    return { state: "unavailable" };
  }
}

/**
 * Acquires a durable, owner-bound delivery permit before provider I/O. Account
 * deletion uses the same owner advisory lock for its permanent tombstone, then
 * waits in a non-destructive drain phase until every live permit is released
 * or expires. A provider acceptance is still not proof of device delivery.
 */
export async function withPushDeliveryPermit<T>(
  ownerId: string,
  dependencies: PushDeliveryPermitDependencies,
  delivery: () => Promise<T>,
): Promise<PushDeliveryPermitExecution<T>> {
  if (!UUID_PATTERN.test(ownerId)) return { state: "unavailable" };

  let permitToken: string;
  try {
    permitToken = dependencies.randomUUID();
  } catch {
    return { state: "unavailable" };
  }
  if (!UUID_PATTERN.test(permitToken)) return { state: "unavailable" };

  let admissionResult: PushDeliveryPermitRpcResult;
  try {
    admissionResult = await dependencies.rpc("acquire_push_delivery_permit", {
      p_owner_id: ownerId,
      p_permit_token: permitToken,
    });
  } catch {
    return { state: "unavailable" };
  }
  if (admissionResult.error) return { state: "unavailable" };

  const admission = parsePermitAdmission(
    admissionResult.data,
    ownerId,
    permitToken,
  );
  if (admission.state !== "admitted") return admission;

  let value: T;
  try {
    value = await delivery();
  } catch (error) {
    await releasePushDeliveryPermit(dependencies, admission.permit);
    throw error;
  }

  return {
    state: "completed",
    value,
    releaseConfirmed: await releasePushDeliveryPermit(
      dependencies,
      admission.permit,
    ),
  };
}
