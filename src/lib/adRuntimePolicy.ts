/**
 * Owner-authorized Android Habits banner packaging.
 * Native availability is not ad eligibility: the controller still requires
 * current server entitlement, adult consent, UMP and all placement gates.
 */
export const ADS_RUNTIME_MODE = "ANDROID_BANNER" as const;

export function areAdsRuntimeEnabled(targetPlatform: string): boolean {
  return targetPlatform === "android";
}
