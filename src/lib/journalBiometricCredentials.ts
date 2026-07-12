import { isNative } from "@/lib/platform";

export type JournalBiometricCredentialCleanupResult = "removed" | "not-native";

/**
 * Removes the app-level native journal vault credential at an account boundary.
 *
 * Android and iOS currently store one credential per app installation rather
 * than one credential per account, so this must complete before local ownership
 * can move to another user. The native bridges make unenrollment idempotent.
 */
export async function clearNativeJournalBiometricCredential(): Promise<JournalBiometricCredentialCleanupResult> {
  if (!isNative) return "not-native";

  const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
  const result = await BiometricAuth.unenroll();
  if (!result?.success) {
    throw new Error(result?.error || "Biometric credential cleanup failed.");
  }

  return "removed";
}
