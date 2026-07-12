import { runWithOriginExclusiveLock } from "@/lib/originExclusiveLock";
import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

type AccountBoundaryReset = () => void;
type OriginAccountBoundaryGenerationListener = (
  generation: OriginAccountBoundaryGeneration
) => void;

const accountBoundaryResets = new Set<AccountBoundaryReset>();
const originAccountBoundaryGenerationListeners =
  new Set<OriginAccountBoundaryGenerationListener>();

export type OriginAccountBoundaryGeneration = string;

const INITIAL_ACCOUNT_BOUNDARY_GENERATION = "initial";
const JOURNAL_SECURITY_WRITE_LOCK = "zenflow:journal-security-write";

let fallbackGenerationSequence = 0;

function readPersistedAccountBoundaryGeneration(): OriginAccountBoundaryGeneration | null {
  const stored = safeLocalStorageGet<unknown>(SK.ACCOUNT_BOUNDARY_GENERATION, null);
  return typeof stored === "string" && stored.length > 0 ? stored : null;
}

let observedAccountBoundaryGeneration =
  readPersistedAccountBoundaryGeneration() ?? INITIAL_ACCOUNT_BOUNDARY_GENERATION;
let lastNotifiedAccountBoundaryGeneration = observedAccountBoundaryGeneration;

function createAccountBoundaryGeneration(): OriginAccountBoundaryGeneration {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  fallbackGenerationSequence += 1;
  return `${Date.now().toString(36)}-${fallbackGenerationSequence.toString(36)}`;
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
