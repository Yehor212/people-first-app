import { logger } from "@/lib/logger";
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

export type VerifiedSettingsOwnerRealm =
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

export class SettingsOwnerBoundaryError extends Error {
  readonly code = "SETTINGS_OWNER_BOUNDARY_UNVERIFIED";

  constructor(operation: string, cause?: unknown) {
    super(`${operation} stopped at an account boundary`);
    this.name = "SettingsOwnerBoundaryError";
    if (cause !== undefined) {
      (this as Error & { cause?: unknown }).cause = cause;
    }
  }
}

function failSettingsOwnerBoundary(operation: string, cause?: unknown): never {
  logger.warn(`[Settings] ${operation} stopped at an account boundary`);
  throw new SettingsOwnerBoundaryError(operation, cause);
}

function assertNoPendingAccountCleanup(operation: string): void {
  const marker = storageReadRaw(SK.PENDING_ACCOUNT_SIGN_OUT_CLEANUP);
  if (!marker.ok || marker.value !== null) {
    failSettingsOwnerBoundary(operation);
  }
}

async function readDurableDataOwnerId(operation: string): Promise<string | null> {
  const ownerRecord = await db.settings.get(SK.DATA_OWNER_ID);
  if (ownerRecord === undefined) return null;
  if (typeof ownerRecord.value !== "string" || ownerRecord.value.trim().length === 0) {
    failSettingsOwnerBoundary(operation);
  }
  return ownerRecord.value;
}

async function readCurrentSettingsOwnerRealm(
  generation: OriginAccountBoundaryGeneration,
  operation: string
): Promise<VerifiedSettingsOwnerRealm> {
  try {
    assertOriginAccountBoundaryGeneration(generation);
    assertNoPendingAccountCleanup(operation);
    const sessionOwnerUserId = await getVerifiedCurrentSessionUserId();
    const dataOwnerUserId = await readDurableDataOwnerId(operation);
    assertNoPendingAccountCleanup(operation);
    assertOriginAccountBoundaryGeneration(generation);

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
    failSettingsOwnerBoundary(operation);
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}

function assertSameSettingsOwnerRealm(
  expected: VerifiedSettingsOwnerRealm,
  current: VerifiedSettingsOwnerRealm,
  operation: string
): void {
  if (
    current.generation !== expected.generation ||
    current.kind !== expected.kind ||
    current.ownerUserId !== expected.ownerUserId
  ) {
    failSettingsOwnerBoundary(operation);
  }
}

/**
 * Captures a fail-closed session + IndexedDB owner pair only after already
 * accepted DATA work has settled.
 */
export async function readVerifiedSettingsOwnerRealm(
  operation: string
): Promise<VerifiedSettingsOwnerRealm> {
  const generation = captureOriginAccountBoundaryGeneration();
  try {
    return await runWithSettledDataRead(() => readCurrentSettingsOwnerRealm(generation, operation));
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}

/** Revalidates a captured realm before an external Settings side effect. */
export async function assertSettingsOwnerCurrent(
  expected: VerifiedSettingsOwnerRealm,
  operation: string
): Promise<void> {
  try {
    assertOriginAccountBoundaryGeneration(expected.generation);
    const current = await runWithSettledDataRead(() =>
      readCurrentSettingsOwnerRealm(expected.generation, operation)
    );
    assertSameSettingsOwnerRealm(expected, current, operation);
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}

/**
 * Revalidates while the caller already owns `runWithDataWriteBarrier`.
 * Never call `runWithSettledDataRead` here: the nested DATA lock would deadlock.
 */
export async function assertSettingsOwnerCurrentWithinDataWriteBarrier(
  expected: VerifiedSettingsOwnerRealm,
  operation: string
): Promise<void> {
  try {
    assertOriginAccountBoundaryGeneration(expected.generation);
    const current = await readCurrentSettingsOwnerRealm(expected.generation, operation);
    assertSameSettingsOwnerRealm(expected, current, operation);
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}

/**
 * Session/generation half of the Settings owner check. This callback performs
 * no IndexedDB work, so it is safe to await through `Dexie.waitFor()` while an
 * import transaction is being kept alive.
 */
export async function assertSettingsExternalOwnerCurrentWithinDataWriteBarrier(
  expected: VerifiedSettingsOwnerRealm,
  operation: string
): Promise<void> {
  try {
    assertOriginAccountBoundaryGeneration(expected.generation);
    assertNoPendingAccountCleanup(operation);
    const sessionOwnerUserId = await getVerifiedCurrentSessionUserId();
    assertNoPendingAccountCleanup(operation);
    assertOriginAccountBoundaryGeneration(expected.generation);
    if (sessionOwnerUserId !== expected.ownerUserId) {
      failSettingsOwnerBoundary(operation);
    }
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}

/**
 * IndexedDB half of the Settings owner check. Call this directly from the
 * active Dexie transaction, never from inside the promise passed to
 * `Dexie.waitFor()`.
 */
export async function assertSettingsDataOwnerCurrentWithinTransaction(
  expected: VerifiedSettingsOwnerRealm,
  operation: string
): Promise<void> {
  try {
    assertOriginAccountBoundaryGeneration(expected.generation);
    assertNoPendingAccountCleanup(operation);
    const dataOwnerUserId = await readDurableDataOwnerId(operation);
    assertNoPendingAccountCleanup(operation);
    assertOriginAccountBoundaryGeneration(expected.generation);
    if (dataOwnerUserId !== expected.ownerUserId) {
      failSettingsOwnerBoundary(operation);
    }
  } catch (error) {
    if (error instanceof SettingsOwnerBoundaryError) throw error;
    failSettingsOwnerBoundary(operation, error);
  }
}
