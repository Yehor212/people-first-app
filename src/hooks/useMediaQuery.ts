import { useState, useEffect } from "react";

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
  const [matches, setMatches] = useState<boolean>(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return false;
    }
    return window.matchMedia(query).matches;
  });

  useEffect(() => {
    if (typeof window === "undefined" || typeof window.matchMedia !== "function") {
      return;
    }
    const mql = window.matchMedia(query);
    const handler = (e: MediaQueryListEvent) => setMatches(e.matches);
    // Re-sync on mount in case the SSR default mismatches current state.
    setMatches(mql.matches);
    mql.addEventListener("change", handler);
    return () => mql.removeEventListener("change", handler);
  }, [query]);

  return matches;
}
