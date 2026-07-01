import { useState, useEffect } from "react";

function readViewportWidthQuery(query: string): boolean | null {
  if (typeof window === "undefined") return null;
  const normalized = query.trim();
  const minWidth = /^\(\s*min-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/i.exec(normalized);
  if (minWidth) return window.innerWidth >= Number(minWidth[1]);

  const maxWidth = /^\(\s*max-width\s*:\s*(\d+(?:\.\d+)?)px\s*\)$/i.exec(normalized);
  if (maxWidth) return window.innerWidth <= Number(maxWidth[1]);

  return null;
}

function readMediaQuery(query: string): boolean {
  const viewportMatch = readViewportWidthQuery(query);
  if (viewportMatch !== null) return viewportMatch;
  if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
    return false;
  }
  return window.matchMedia(query).matches;
}

/**
 * Reactive media query hook. Returns true when the query matches.
 * Updates when the media query becomes/stops matching.
 *
 * SSR-safe: returns `false` during server-side render (typeof window === "undefined"),
 * then syncs to the real value on mount. Safe inside any provider tree.
 *
 * Cleanup: removes the change listener on unmount (Law 25 Race Law).
 */
export function useMediaQuery(query: string): boolean {
  const [matches, setMatches] = useState<boolean>(() => readMediaQuery(query));

  useEffect(() => {
    if (typeof window === "undefined") {
      return;
    }

    const mql = typeof window.matchMedia === "function" ? window.matchMedia(query) : null;
    const syncMatch = () => setMatches(readMediaQuery(query));
    const handler = () => syncMatch();

    // Re-sync on mount and viewport changes; some embedded browsers and test runners
    // can resize without reliably delivering MediaQueryList change events.
    syncMatch();
    mql?.addEventListener("change", handler);
    window.addEventListener("resize", syncMatch);
    window.addEventListener("orientationchange", syncMatch);
    window.visualViewport?.addEventListener("resize", syncMatch);
    return () => {
      mql?.removeEventListener("change", handler);
      window.removeEventListener("resize", syncMatch);
      window.removeEventListener("orientationchange", syncMatch);
      window.visualViewport?.removeEventListener("resize", syncMatch);
    };
  }, [query]);

  return matches;
}
