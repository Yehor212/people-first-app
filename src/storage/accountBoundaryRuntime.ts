import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import {
  safeJsonParse,
  safeLocalStorageGet,
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

type AccountBoundaryReset = () => void;
type OriginAccountBoundaryGenerationListener = (
  generation: OriginAccountBoundaryGeneration
) => void;
type AccountSessionTransitionListener = () => void;

const accountBoundaryResets = new Set<AccountBoundaryReset>();
const originAccountBoundaryGenerationListeners = new Set<OriginAccountBoundaryGenerationListener>();
const originAccountBoundaryObservationListeners =
  new Set<OriginAccountBoundaryGenerationListener>();
const accountSessionTransitionListeners = new Set<AccountSessionTransitionListener>();

export type OriginAccountBoundaryGeneration = string;

export type PendingLocalBackupAccountClaimState =
  | { status: "none" }
  | { status: "pending"; generation: OriginAccountBoundaryGeneration }
  | { status: "invalid" }
  | { status: "unavailable" };

const INITIAL_ACCOUNT_BOUNDARY_GENERATION = "initial";
const JOURNAL_SECURITY_WRITE_LOCK = "zenflow:journal-security-write";
const IMPORTED_BACKUP_ACCOUNT_CLAIM_LOCK = "zenflow:imported-backup-account-claim";
export const ACCOUNT_BOUNDARY_DATA_WRITE_LOCK = "zenflow:data-write-barrier";

let fallbackGenerationSequence = 0;

function readPersistedAccountBoundaryGeneration(): OriginAccountBoundaryGeneration | null {
  const stored = safeLocalStorageGet<unknown>(SK.ACCOUNT_BOUNDARY_GENERATION, null);
  return typeof stored === "string" && stored.length > 0 ? stored : null;
}

let observedAccountBoundaryGeneration =
  readPersistedAccountBoundaryGeneration() ?? INITIAL_ACCOUNT_BOUNDARY_GENERATION;
let lastNotifiedAccountBoundaryGeneration = observedAccountBoundaryGeneration;
let lastObservedAccountBoundaryGeneration = observedAccountBoundaryGeneration;

function notifyOriginAccountBoundaryObservation(generation: OriginAccountBoundaryGeneration): void {
  if (generation === lastObservedAccountBoundaryGeneration) return;
  lastObservedAccountBoundaryGeneration = generation;
  for (const listener of originAccountBoundaryObservationListeners) {
    listener(generation);
  }
}

function createAccountBoundaryGeneration(): OriginAccountBoundaryGeneration {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackGenerationSequence += 1;
  return `${Date.now().toString(36)}-${fallbackGenerationSequence.toString(36)}`;
}

function createImportedBackupDecisionRevision(): string | null {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") return null;
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  return Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0")).join("");
}

if (typeof window !== "undefined") {
  // localStorage changes notify every other same-origin tab. The durable read
  // remains authoritative; this event also updates a live tab immediately.
  window.addEventListener("storage", (event: StorageEvent) => {
    if (event.key !== SK.ACCOUNT_BOUNDARY_GENERATION || event.newValue === null) return;
    const eventGeneration = safeJsonParse<unknown>(event.newValue, null);
    const currentGeneration = readPersistedAccountBoundaryGeneration() ?? eventGeneration;
    if (typeof currentGeneration === "string" && currentGeneration.length > 0) {
      observedAccountBoundaryGeneration = currentGeneration;
      notifyOriginAccountBoundaryObservation(currentGeneration);
      // A foreground operation may read durable storage before this queued
      // event arrives. Deduplicate notifications separately from observation so
      // that read cannot consume the passive-reset signal for other hooks.
      if (currentGeneration === lastNotifiedAccountBoundaryGeneration) return;
      lastNotifiedAccountBoundaryGeneration = currentGeneration;
      for (const listener of originAccountBoundaryGenerationListeners) {
        listener(currentGeneration);
      }
    }
  });
}

export class AccountBoundaryChangedError extends Error {
  readonly code = "ACCOUNT_BOUNDARY_CHANGED";

  constructor() {
    super("Account boundary changed during the data operation");
    this.name = "AccountBoundaryChangedError";
  }
}

export function isAccountBoundaryChangedError(error: unknown): boolean {
  return (
    error instanceof AccountBoundaryChangedError ||
    (error instanceof Error &&
      (error.name === "AccountBoundaryChangedError" ||
        (error as Error & { code?: unknown }).code === "ACCOUNT_BOUNDARY_CHANGED"))
  );
}

/**
 * Returns the latest origin-visible account generation. localStorage provides
 * durability for suspended tabs; the storage event updates other live tabs.
 */
export function captureOriginAccountBoundaryGeneration(): OriginAccountBoundaryGeneration {
  const persisted = readPersistedAccountBoundaryGeneration();
  if (persisted) observedAccountBoundaryGeneration = persisted;
  return observedAccountBoundaryGeneration;
}

/**
 * Notifies a live realm when another same-origin context advances the account
 * generation. The originating context does not receive its own storage event.
 */
export function subscribeOriginAccountBoundaryGeneration(
  listener: OriginAccountBoundaryGenerationListener
): () => void {
  originAccountBoundaryGenerationListeners.add(listener);
  return () => originAccountBoundaryGenerationListeners.delete(listener);
}

/**
 * Observes both same-realm advances and cross-tab storage events. UI state may
 * use this to discard drafts and transient success that belong to an expired
 * account without participating in the DATA barrier's internal generation.
 */
export function subscribeOriginAccountBoundaryObservation(
  listener: OriginAccountBoundaryGenerationListener
): () => void {
  originAccountBoundaryObservationListeners.add(listener);
  return () => originAccountBoundaryObservationListeners.delete(listener);
}

/**
 * Invalidates owner-sensitive work synchronously when Supabase publishes a
 * different session owner. DATA serialization alone cannot cover the short
 * IndexedDB commit window because auth publication is not an IndexedDB write.
 */
export function notifyAccountSessionTransition(): void {
  for (const listener of accountSessionTransitionListeners) {
    listener();
  }
}

export function subscribeAccountSessionTransition(
  listener: AccountSessionTransitionListener
): () => void {
  accountSessionTransitionListeners.add(listener);
  return () => accountSessionTransitionListeners.delete(listener);
}

/**
 * Persist a privacy fence before owner-null backup rows are written. The
 * marker intentionally contains no imported content or account identifier.
 */
export function markPendingLocalBackupAccountClaim(): boolean {
  if (!storageRemove(SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS)) return false;
  return safeLocalStorageSet(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM, {
    version: 1,
    generation: captureOriginAccountBoundaryGeneration(),
  });
}

/**
 * Preserve an explicit local-only decision across reloads without weakening the
 * pending claim fence. A later authenticated session must still present the
 * account choice before any cloud path can use the imported rows.
 */
export function markImportedBackupLocalOnlyAccess(): boolean {
  const pendingClaim = readPendingLocalBackupAccountClaim();
  if (pendingClaim.status !== "pending") return false;
  const decisionRevision = createImportedBackupDecisionRevision();
  if (!decisionRevision) return false;
  return safeLocalStorageSet(SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS, {
    version: 2,
    generation: pendingClaim.generation,
    decisionRevision,
  });
}

export function readImportedBackupLocalOnlyDecisionRevision(): string | null {
  const pendingClaim = readPendingLocalBackupAccountClaim();
  if (pendingClaim.status !== "pending") return null;
  const stored = storageReadRaw(SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS);
  if (!stored.ok || stored.value === null) return null;
  const parsed = safeJsonParse<unknown>(stored.value, null);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    ((parsed as { version?: unknown }).version !== 1 &&
      (parsed as { version?: unknown }).version !== 2) ||
    (parsed as { generation?: unknown }).generation !== pendingClaim.generation
  ) {
    return null;
  }
  if ((parsed as { version?: unknown }).version === 1) {
    return `legacy:${pendingClaim.generation}`;
  }
  const decisionRevision = (parsed as { decisionRevision?: unknown }).decisionRevision;
  return typeof decisionRevision === "string" && decisionRevision.length > 0
    ? decisionRevision
    : null;
}

export function hasImportedBackupLocalOnlyAccess(): boolean {
  return readImportedBackupLocalOnlyDecisionRevision() !== null;
}

export function readPendingLocalBackupAccountClaim(): PendingLocalBackupAccountClaimState {
  const stored = storageReadRaw(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM);
  if (!stored.ok) return { status: "unavailable" };
  if (stored.value === null) return { status: "none" };

  const parsed = safeJsonParse<unknown>(stored.value, null);
  if (
    !parsed ||
    typeof parsed !== "object" ||
    (parsed as { version?: unknown }).version !== 1 ||
    typeof (parsed as { generation?: unknown }).generation !== "string" ||
    (parsed as { generation: string }).generation.length === 0
  ) {
    return { status: "invalid" };
  }

  return {
    status: "pending",
    generation: (parsed as { generation: OriginAccountBoundaryGeneration }).generation,
  };
}

export function clearPendingLocalBackupAccountClaim(): boolean {
  // Remove the authoritative fence first. If that removal fails, preserve the
  // matching local-only marker so a signed-out user keeps an actionable path
  // instead of being stranded on reconstruction. If the second removal fails,
  // the stale access marker is inert because it is valid only with a pending
  // claim carrying the same generation.
  if (!storageRemove(SK.PENDING_LOCAL_BACKUP_ACCOUNT_CLAIM)) return false;
  return storageRemove(SK.IMPORTED_BACKUP_LOCAL_ONLY_ACCESS);
}

export function runWithImportedBackupAccountClaimLock<T>(
  operation: () => Promise<T>
): Promise<T> {
  return runWithOriginExclusiveLock(IMPORTED_BACKUP_ACCOUNT_CLAIM_LOCK, operation);
}

export function isOriginAccountBoundaryGenerationCurrent(
  expectedGeneration: OriginAccountBoundaryGeneration
): boolean {
  return captureOriginAccountBoundaryGeneration() === expectedGeneration;
}

export function assertOriginAccountBoundaryGeneration(
  expectedGeneration: OriginAccountBoundaryGeneration
): void {
  if (!isOriginAccountBoundaryGenerationCurrent(expectedGeneration)) {
    throw new AccountBoundaryChangedError();
  }
}

/**
 * Advances the durable same-origin generation while the caller owns the DATA
 * lock. Failure to persist is fail-closed: cleanup must not proceed if stale
 * tabs cannot later prove that their account generation expired.
 */
export function advanceOriginAccountBoundaryGeneration(): OriginAccountBoundaryGeneration {
  const nextGeneration = createAccountBoundaryGeneration();
  if (!safeLocalStorageSet(SK.ACCOUNT_BOUNDARY_GENERATION, nextGeneration)) {
    throw new Error("Unable to persist the account boundary generation");
  }
  observedAccountBoundaryGeneration = nextGeneration;
  notifyOriginAccountBoundaryObservation(nextGeneration);
  return nextGeneration;
}

let journalSecurityWriteTail: Promise<void> = Promise.resolve();
let acceptedJournalAccountBoundaryGeneration = captureOriginAccountBoundaryGeneration();

async function runInJournalSecurityWriteQueue<T>(operation: () => Promise<T>): Promise<T> {
  let release!: () => void;
  const completed = new Promise<void>((resolve) => {
    release = resolve;
  });
  const previous = journalSecurityWriteTail;
  journalSecurityWriteTail = previous.catch(() => undefined).then(() => completed);
  await previous.catch(() => undefined);
  try {
    return await runWithOriginExclusiveLock(JOURNAL_SECURITY_WRITE_LOCK, operation);
  } finally {
    release();
  }
}

/** Serializes a normal diary write and rejects a stale account realm. */
export function runWithAccountBoundaryValidatedJournalWrite<T>(
  operation: () => Promise<T>
): Promise<T> {
  const expectedGeneration = acceptedJournalAccountBoundaryGeneration;
  return runInJournalSecurityWriteQueue(async () => {
    assertOriginAccountBoundaryGeneration(expectedGeneration);
    return operation();
  });
}

/**
 * Raw JOURNAL barrier reserved for account cleanup that already owns DATA.
 * Lock order is therefore always DATA outer -> JOURNAL inner.
 */
export async function runWithAccountBoundaryJournalWriteBarrier<T>(
  operation: () => Promise<T>
): Promise<T> {
  const boundaryGeneration = captureOriginAccountBoundaryGeneration();
  try {
    return await runInJournalSecurityWriteQueue(operation);
  } finally {
    acceptedJournalAccountBoundaryGeneration = boundaryGeneration;
  }
}

/**
 * Registers transient in-memory state that must not survive an account switch.
 * Persistent storage cleanup alone is insufficient while the current tab stays mounted.
 */
export function registerAccountBoundaryRuntimeReset(reset: AccountBoundaryReset): () => void {
  accountBoundaryResets.add(reset);
  return () => accountBoundaryResets.delete(reset);
}

export function resetAccountBoundaryRuntimeState(): void {
  const failures: unknown[] = [];

  for (const reset of accountBoundaryResets) {
    try {
      reset();
    } catch (error) {
      failures.push(error);
    }
  }

  if (failures.length > 0) {
    const error = new Error("Unable to reset in-memory account data");
    (error as Error & { cause?: unknown }).cause = failures[0];
    throw error;
  }
}

/** Waits until the origin-wide account purge and its final refresh release DATA. */
export function waitForAccountBoundaryDataSettlement(): Promise<void> {
  return runWithOriginExclusiveLock(ACCOUNT_BOUNDARY_DATA_WRITE_LOCK, async () => undefined);
}
