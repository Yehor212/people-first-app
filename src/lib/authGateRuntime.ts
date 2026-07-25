import { safeLocalStorageGet } from "@/lib/safeJson";

const LOCAL_DEV_BYPASS_HOSTS = new Set(["localhost", "127.0.0.1", "::1"]);

export function isLocalDevBypassHost(hostname: string): boolean {
  return LOCAL_DEV_BYPASS_HOSTS.has(hostname);
}

export function shouldBypassDesktopInteractiveGates(
  isDesktopRuntime: boolean,
  requiresMandatoryAccountDecision = false
): boolean {
  return isDesktopRuntime && !requiresMandatoryAccountDecision;
}

export function isInstalledWebShell(): boolean {
  return (
    typeof window !== "undefined" &&
    typeof window.matchMedia === "function" &&
    window.matchMedia("(display-mode: standalone)").matches
  );
}

export function hasStoredCompletedInteractiveGates(): boolean {
  return (
    safeLocalStorageGet<boolean>("zenflow-language-selected", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-google-auth-checked", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-onboarding-complete", false) === true &&
    safeLocalStorageGet<boolean>("zenflow-notification-permission-checked", false) === true
  );
}
