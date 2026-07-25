export type AccountCleanupRetry = () => void | Promise<void>;

export type AccountCleanupRecovery = {
  version: number;
  retry: AccountCleanupRetry;
};

const listeners = new Set<() => void>();
let version = 0;
let currentRecovery: AccountCleanupRecovery | null = null;

function notifyRecoveryListeners(): void {
  for (const listener of listeners) listener();
}

export function retainAccountCleanupRecovery(
  retry: AccountCleanupRetry,
): AccountCleanupRecovery {
  const recovery = { version: ++version, retry };
  currentRecovery = recovery;
  notifyRecoveryListeners();
  return recovery;
}

export function publishAccountCleanupRecovery(
  retry: AccountCleanupRetry,
): AccountCleanupRecovery {
  const recovery = retainAccountCleanupRecovery(retry);
  if (typeof window !== "undefined") {
    window.dispatchEvent(
      new CustomEvent("zenflow:account-cleanup-blocked", {
        detail: { retry },
      }),
    );
  }
  return recovery;
}

export function clearAccountCleanupRecovery(expectedVersion?: number): boolean {
  if (!currentRecovery) return true;
  if (
    expectedVersion !== undefined &&
    currentRecovery.version !== expectedVersion
  ) {
    return false;
  }
  currentRecovery = null;
  notifyRecoveryListeners();
  return true;
}

export function getAccountCleanupRecovery(): AccountCleanupRecovery | null {
  return currentRecovery;
}

export function subscribeAccountCleanupRecovery(listener: () => void): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
