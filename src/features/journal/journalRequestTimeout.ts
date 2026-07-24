export const JOURNAL_NETWORK_REQUEST_TIMEOUT_MS = 20_000;

export class JournalRequestTimeoutError extends Error {
  constructor() {
    super("Journal network request timed out");
    this.name = "JournalRequestTimeoutError";
  }
}

export function isJournalRequestTimeoutError(error: unknown): boolean {
  return error instanceof JournalRequestTimeoutError;
}

export function withJournalRequestTimeout<T>(
  request: Promise<T>,
  timeoutMs = JOURNAL_NETWORK_REQUEST_TIMEOUT_MS,
): Promise<T> {
  return new Promise<T>((resolve, reject) => {
    let settled = false;
    const timeoutId = globalThis.setTimeout(() => {
      if (settled) return;
      settled = true;
      reject(new JournalRequestTimeoutError());
    }, timeoutMs);

    void request.then(
      (value) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeoutId);
        resolve(value);
      },
      (error) => {
        if (settled) return;
        settled = true;
        globalThis.clearTimeout(timeoutId);
        reject(error instanceof Error ? error : new Error("Journal request failed"));
      },
    );
  });
}
