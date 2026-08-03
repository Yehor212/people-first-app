import { runWithSettledDataRead } from "@/hooks/useIndexedDB";
import { storageReadRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import { getVerifiedCurrentSessionUserId } from "@/lib/supabaseClient";
import {
  assertOriginAccountBoundaryGeneration,
  captureOriginAccountBoundaryGeneration,
  type OriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import { db } from "@/storage/db";

export type VerifiedNotificationRealm =
  | {
      kind: "local";
      ownerUserId: null;
      generation: OriginAccountBoundaryGeneration;
    }
  | {
      kind: "account";
      ownerUserId: string;
      generation: OriginAccountBoundaryGeneration;
    };

export type NotificationRealmFailureReason =
  | "cleanup-marker-unavailable"
  | "cleanup-pending"
  | "invalid-data-owner"
  | "owner-mismatch";

export class NotificationRealmVerificationError extends Error {
  readonly code = "NOTIFICATION_REALM_UNVERIFIED";

  constructor(readonly reason: NotificationRealmFailureReason) {
    super("The notification account realm could not be verified");
    this.name = "NotificationRealmVerificationError";
  }
}

function assertNoPendingAccountCleanup(): void {
  const marker = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  if (!marker.ok) {
    throw new NotificationRealmVerificationError("cleanup-marker-unavailable");
  }
  // Any present marker blocks native notification work. A corrupt marker is
  // still unresolved cleanup state and must not be interpreted as absence.
  if (marker.value !== null) {
    throw new NotificationRealmVerificationError("cleanup-pending");
  }
}

async function readDurableDataOwnerId(): Promise<string | null> {
  const ownerRecord = await db.settings.get(SK.DATA_OWNER_ID);
  if (ownerRecord === undefined) return null;
  if (
    typeof ownerRecord.value !== "string" ||
    ownerRecord.value.trim().length === 0
  ) {
    throw new NotificationRealmVerificationError("invalid-data-owner");
  }
  return ownerRecord.value;
}

function classifyRealm(
  sessionOwnerUserId: string | null,
  dataOwnerUserId: string | null,
  generation: OriginAccountBoundaryGeneration,
): VerifiedNotificationRealm {
  if (sessionOwnerUserId === null && dataOwnerUserId === null) {
    return { kind: "local", ownerUserId: null, generation };
  }
  if (
    sessionOwnerUserId !== null &&
    dataOwnerUserId !== null &&
    sessionOwnerUserId === dataOwnerUserId
  ) {
    return { kind: "account", ownerUserId: sessionOwnerUserId, generation };
  }
  throw new NotificationRealmVerificationError("owner-mismatch");
}

async function readCurrentRealm(
  generation: OriginAccountBoundaryGeneration,
): Promise<VerifiedNotificationRealm> {
  assertOriginAccountBoundaryGeneration(generation);
  assertNoPendingAccountCleanup();

  const sessionOwnerUserId = await getVerifiedCurrentSessionUserId();
  const dataOwnerUserId = await readDurableDataOwnerId();

  // Auth/storage reads are asynchronous. Recheck the durable cleanup and
  // account-generation guards before allowing the result to escape DATA.
  assertNoPendingAccountCleanup();
  assertOriginAccountBoundaryGeneration(generation);
  return classifyRealm(sessionOwnerUserId, dataOwnerUserId, generation);
}

/**
 * Reads a fail-closed session + IndexedDB owner pair only after local DATA has
 * settled. The DATA lock is released before callers perform any native work.
 */
export async function readVerifiedNotificationRealm(): Promise<VerifiedNotificationRealm> {
  const generation = captureOriginAccountBoundaryGeneration();
  return runWithSettledDataRead(() => readCurrentRealm(generation));
}

/**
 * Revalidates an earlier realm immediately before a native notification read
 * or mutation. This function itself performs no native call and never keeps
 * the DATA lock after resolving.
 */
export async function assertVerifiedNotificationRealmCurrent(
  realm: VerifiedNotificationRealm,
): Promise<void> {
  assertOriginAccountBoundaryGeneration(realm.generation);
  await runWithSettledDataRead(async () => {
    const currentRealm = await readCurrentRealm(realm.generation);
    if (
      currentRealm.kind !== realm.kind ||
      currentRealm.ownerUserId !== realm.ownerUserId
    ) {
      throw new NotificationRealmVerificationError("owner-mismatch");
    }
  });
}
