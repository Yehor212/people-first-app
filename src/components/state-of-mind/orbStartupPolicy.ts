const NAV_V2_PAGES = new Set(["orb", "habits", "diary", "planning", "settings"]);

interface OrbStartupPolicyInput {
  isNativeRuntime: boolean;
  pathname: string;
  storedPage: string;
}

function isDirectOrbPath(pathname: string): boolean {
  return /(?:^|\/)orb\/?$/.test(pathname);
}

function isNativeBareRoot(pathname: string): boolean {
  return pathname === "" || pathname === "/" || pathname === "/index.html";
}

/**
 * Avoids racing the real canonical Orb renderer with its idle prewarm worker.
 *
 * Native V2 restores its last primary page from storage when Capacitor opens at
 * `/`; an absent or invalid value resolves to Orb. Web/PWA bare-root behavior is
 * deliberately unchanged because this policy addresses the measured Android
 * WebView GPU-worker collision.
 */
export function shouldSkipCanonicalOrbPrewarm({
  isNativeRuntime,
  pathname,
  storedPage,
}: OrbStartupPolicyInput): boolean {
  if (isDirectOrbPath(pathname)) return true;
  if (!isNativeRuntime || !isNativeBareRoot(pathname)) return false;

  const restoredPage = NAV_V2_PAGES.has(storedPage) ? storedPage : "orb";
  return restoredPage === "orb";
}
