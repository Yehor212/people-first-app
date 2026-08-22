import { isNative } from "@/lib/platform";

export type JournalBiometricCredentialCleanupResult = "removed" | "not-native";
export type JournalBiometricCredentialEnrollmentResult = "enrolled" | "not-native";

export const JOURNAL_BIOMETRIC_CLEANUP_TIMEOUT_MS = 10_000;

export class JournalBiometricCredentialCleanupTimeoutError extends Error {
  constructor(timeoutMs: number) {
    super(`Native diary credential cleanup timed out after ${timeoutMs}ms`);
    this.name = "JournalBiometricCredentialCleanupTimeoutError";
  }
}

export class JournalBiometricCredentialLaneBlockedError extends Error {
  constructor() {
    super("Native diary credential lane is waiting for another bridge operation");
    this.name = "JournalBiometricCredentialLaneBlockedError";
  }
}

let journalBiometricCredentialOperationTail: Promise<void> = Promise.resolve();
let timedOutJournalBiometricCredentialOperation: Promise<unknown> | null = null;
let pendingJournalBiometricCredentialOperationCount = 0;

function runSerializedJournalBiometricCredentialOperation<T>(
  operation: () => Promise<T>
): Promise<T> {
  pendingJournalBiometricCredentialOperationCount += 1;
  const scheduled = journalBiometricCredentialOperationTail.then(operation, operation);
  // Keep the mutex attached to the actual native promise even when a bounded
  // caller stops waiting. A late bridge response must settle before another
  // account or protection epoch can mutate the installation-wide credential.
  journalBiometricCredentialOperationTail = scheduled.then(
    () => {
      pendingJournalBiometricCredentialOperationCount -= 1;
    },
    () => {
      pendingJournalBiometricCredentialOperationCount -= 1;
    }
  );
  return scheduled;
}

async function waitWithCleanupDeadline<T>(operation: Promise<T>, timeoutMs: number): Promise<T> {
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      operation,
      new Promise<never>((_resolve, reject) => {
        timeoutId = setTimeout(
          () => reject(new JournalBiometricCredentialCleanupTimeoutError(timeoutMs)),
          timeoutMs
        );
      }),
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

export async function enrollNativeJournalBiometricCredential(
  input: { reason: string; secret: string },
  assertEnrollmentCurrent: () => Promise<void>,
  commitEnrollment?: () => Promise<void>
): Promise<JournalBiometricCredentialEnrollmentResult> {
  if (!isNative) return "not-native";
  // Do not retain a vault secret in a queued closure behind a native bridge
  // call that already exceeded its caller deadline. A later enrollment may be
  // attempted only after that real bridge promise settles.
  if (
    timedOutJournalBiometricCredentialOperation ||
    pendingJournalBiometricCredentialOperationCount > 0
  ) {
    throw new JournalBiometricCredentialLaneBlockedError();
  }
  if (!input.reason || !input.secret) {
    throw new Error("Native diary credential enrollment requires a reason and vault secret");
  }

  return runSerializedJournalBiometricCredentialOperation<JournalBiometricCredentialEnrollmentResult>(async () => {
    await assertEnrollmentCurrent();
    const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
    const result = await BiometricAuth.enroll(input);
    if (!result?.success) {
      throw new Error(result?.error || "Biometric credential enrollment failed.");
    }

    try {
      await assertEnrollmentCurrent();
      await commitEnrollment?.();
    } catch (error) {
      // Enrollment crossed a local-removal/account boundary or its durable
      // acknowledgement could not commit. Compensate while still holding the
      // installation-wide mutex, then preserve the original failure.
      const cleanup = await BiometricAuth.unenroll();
      if (!cleanup?.success) {
        throw new Error("Biometric credential compensation failed after a boundary change");
      }
      throw error;
    }
    return "enrolled";
  });
}

/**
 * Removes the app-level native journal vault credential at an account boundary.
 *
 * Android and iOS currently store one credential per app installation rather
 * than one credential per account, so this must complete before local ownership
 * can move to another user. The native bridges make unenrollment idempotent.
 */
export async function clearNativeJournalBiometricCredential(
  timeoutMs = JOURNAL_BIOMETRIC_CLEANUP_TIMEOUT_MS
): Promise<JournalBiometricCredentialCleanupResult> {
  if (!isNative) return "not-native";
  if (!Number.isSafeInteger(timeoutMs) || timeoutMs <= 0) {
    throw new Error("Native diary credential cleanup requires a positive timeout");
  }

  const cleanup = runSerializedJournalBiometricCredentialOperation(
    async (): Promise<JournalBiometricCredentialCleanupResult> => {
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.unenroll();
      if (!result?.success) {
        throw new Error(result?.error || "Biometric credential cleanup failed.");
      }

      return "removed";
    }
  );

  try {
    return await waitWithCleanupDeadline(cleanup, timeoutMs);
  } catch (error) {
    if (error instanceof JournalBiometricCredentialCleanupTimeoutError) {
      timedOutJournalBiometricCredentialOperation = cleanup;
      void cleanup.then(
        () => {
          if (timedOutJournalBiometricCredentialOperation === cleanup) {
            timedOutJournalBiometricCredentialOperation = null;
          }
        },
        () => {
          if (timedOutJournalBiometricCredentialOperation === cleanup) {
            timedOutJournalBiometricCredentialOperation = null;
          }
        }
      );
    }
    throw error;
  }
}
