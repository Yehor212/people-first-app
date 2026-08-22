import { useCallback, useEffect, useRef, useState, useTransition } from "react";
import { flushSync } from "react-dom";
import { morph } from "@/lib/motion/morph";
import { consumePendingNativeDiaryDeepLink } from "@/lib/nativeDiaryDeepLinkSignal";
import {
  OPEN_REMINDER_SETTINGS_EVENT,
  type OpenReminderSettingsEventDetail,
} from "@/lib/notificationLifecycle";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/**
 * Navigation V2 — 5-page IA (Orb / Habits / Diary / Planning / Settings).
 *
 * V2 is the default app shell. This hook owns direct routes, browser history,
 * and native diary deep-link handoff for the primary five-page app.
 *
 * Responsibilities:
 *  - Active page state machine (Orb / Habits / Diary / Planning / Settings)
 *  - URL <-> page sync via history.pushState + popstate (no router dep)
 *  - Page transitions wrapped in `morph()` (View Transitions API, with
 *    the wrapper's own reduced-motion + browser fallback)
 *  - Collapsible sidebar rail (desktop) + drawer (mobile) state
 *  - Android back precedence: drawer close > page back
 */

export type NavV2Page = "orb" | "habits" | "diary" | "planning" | "settings";

// prettier-ignore
export const NAV_V2_PAGES: readonly NavV2Page[] = ["orb", "habits", "diary", "planning", "settings"] as const;

const STORAGE_KEY = SK.NAV_V2_LAST_PAGE;
const PATH_TO_PAGE: Record<string, NavV2Page> = {
  "/orb": "orb",
  "/habits": "habits",
  "/diary": "diary",
  "/planning": "planning",
  "/settings": "settings",
};
const PAGE_TO_PATH: Record<NavV2Page, string> = {
  orb: "/orb",
  habits: "/habits",
  diary: "/diary",
  planning: "/planning",
  settings: "/settings",
};

interface RouteSnapshot {
  page: NavV2Page;
  unknownPath: string | null;
}

const ROUTE_PENDING_MIN_VISIBLE_MS = 320;
const DEFERRED_DRAWER_ROUTE_DELAY_MS = 120;

function nowMs(): number {
  if (typeof window !== "undefined" && window.performance?.now) {
    return window.performance.now();
  }
  return Date.now();
}

function scheduleAfterNextPaint(callback: () => void): () => void {
  if (typeof window === "undefined" || typeof window.requestAnimationFrame !== "function") {
    const timerId = globalThis.setTimeout(callback, 0);
    return () => globalThis.clearTimeout(timerId);
  }

  let cancelled = false;
  let firstFrameId: number | null = null;
  let secondFrameId: number | null = null;
  let timerId: number | null = null;

  firstFrameId = window.requestAnimationFrame(() => {
    if (cancelled) return;
    secondFrameId = window.requestAnimationFrame(() => {
      if (cancelled) return;
      timerId = window.setTimeout(() => {
        if (!cancelled) callback();
      }, DEFERRED_DRAWER_ROUTE_DELAY_MS);
    });
  });

  return () => {
    cancelled = true;
    if (firstFrameId !== null) window.cancelAnimationFrame(firstFrameId);
    if (secondFrameId !== null) window.cancelAnimationFrame(secondFrameId);
    if (timerId !== null) window.clearTimeout(timerId);
  };
}

function isValidPage(value: unknown): value is NavV2Page {
  return typeof value === "string" && (NAV_V2_PAGES as readonly string[]).includes(value);
}

const DEPLOY_BASE_PATH = "/people-first-app";

function normalizeBasePathCandidate(value: unknown): string {
  if (typeof value !== "string") return "";

  const trimmed = value.trim().split(/[?#]/, 1)[0];
  if (!trimmed || trimmed === "/" || trimmed === "." || trimmed === "./") {
    return "";
  }

  const pathOnly = (() => {
    try {
      return trimmed.startsWith("http://") || trimmed.startsWith("https://")
        ? new URL(trimmed).pathname
        : trimmed;
    } catch {
      return trimmed;
    }
  })();
  const withLeadingSlash = pathOnly.startsWith("/") ? pathOnly : `/${pathOnly}`;
  const withoutTrailingSlash = withLeadingSlash.replace(/\/+$/, "");
  return withoutTrailingSlash === "/" ? "" : withoutTrailingSlash;
}

function getNavV2BasePath(pathname: string): string {
  const candidates = [
    normalizeBasePathCandidate(import.meta.env?.BASE_URL),
    normalizeBasePathCandidate(import.meta.env?.VITE_APP_BASE),
  ].filter(Boolean);

  if (pathname === DEPLOY_BASE_PATH || pathname.startsWith(`${DEPLOY_BASE_PATH}/`)) {
    candidates.push(DEPLOY_BASE_PATH);
  }

  return [...new Set(candidates)].sort((a, b) => b.length - a.length)[0] ?? "";
}

/** Strip Vite base (e.g. "/people-first-app/") from pathname for GH Pages deploys. */
function normalizePath(pathname: string): string {
  const base = getNavV2BasePath(pathname);
  const stripped =
    base && (pathname === base || pathname.startsWith(`${base}/`))
      ? pathname.slice(base.length)
      : pathname;
  const normalized = stripped || "/";
  if (normalized === "/index.html" || normalized.endsWith("/index.html")) {
    return "/";
  }
  return normalized.length > 1 && normalized.endsWith("/") ? normalized.slice(0, -1) : normalized;
}

function getRouteSnapshot(): RouteSnapshot {
  if (typeof window === "undefined") {
    return { page: "orb", unknownPath: null };
  }

  if (consumePendingNativeDiaryDeepLink()) {
    return { page: "diary", unknownPath: null };
  }

  const normalizedPath = normalizePath(window.location.pathname);
  // URL takes priority over localStorage (deep-link friendly)
  const pathPage = PATH_TO_PAGE[normalizedPath];
  if (pathPage) {
    return { page: pathPage, unknownPath: null };
  }

  const stored = storageGetRaw(STORAGE_KEY, "");
  const fallbackPage = isValidPage(stored) ? stored : "orb";
  const isBareAppRoot = normalizedPath === "/" || normalizedPath === "";
  return {
    page: fallbackPage,
    unknownPath: isBareAppRoot ? null : normalizedPath,
  };
}

export interface UseNavigationV2Return {
  /** Currently active page (one of Orb/Habits/Diary/Planning/Settings). */
  activePage: NavV2Page;
  /** Unknown app path that should render the user-facing Not Found state. */
  unknownPath: string | null;
  /** Wrapped page change: writes URL, persists to localStorage, runs via morph(). */
  setActivePage: (page: NavV2Page, options?: { skipTransition?: boolean }) => void;
  /** Destination being prepared after a user navigation tap; null once the new page paints. */
  routePendingPage: NavV2Page | null;
  /** Desktop sidebar rail mode (collapsed = 64-80px, expanded = 240-280px). */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Mobile drawer (sidebar-as-drawer) visibility. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Android/hardware Back. Returns true if an in-app destination consumed it. */
  handleBackButton: (event?: { canGoBack: boolean }) => boolean;
  /** Command palette visibility (shared with Ctrl+K shortcut). */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

/**
 * 5-page V2 navigation state machine.
 *
 * Example:
 *   const { activePage, setActivePage, sidebarCollapsed, toggleSidebar } = useNavigationV2();
 *   // setActivePage('habits') -> URL becomes /habits, localStorage persists, morph transition runs.
 */
export function useNavigationV2(): UseNavigationV2Return {
  const [initialRoute] = useState<RouteSnapshot>(getRouteSnapshot);
  const [activePage, setActivePageState] = useState<NavV2Page>(initialRoute.page);
  const [unknownPath, setUnknownPath] = useState<string | null>(initialRoute.unknownPath);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);
  const [routePendingPage, setRoutePendingPage] = useState<NavV2Page | null>(null);
  const routePendingStartedAtRef = useRef(0);
  const [, startRouteTransition] = useTransition();

  // Ref avoids stale closures inside the popstate listener
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;
  const deferredRouteCancelRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    return () => {
      deferredRouteCancelRef.current?.();
      deferredRouteCancelRef.current = null;
    };
  }, []);

  // Persist last page (for next cold boot when URL is bare "/")
  useEffect(() => {
    if (typeof window === "undefined") return;
    storageSetRaw(STORAGE_KEY, activePage);
  }, [activePage]);

  useEffect(() => {
    if (routePendingPage !== activePage) return undefined;

    let cancelAfterPaint: (() => void) | null = null;
    const elapsed = nowMs() - routePendingStartedAtRef.current;
    const remaining = Math.max(0, ROUTE_PENDING_MIN_VISIBLE_MS - elapsed);
    const timerId = globalThis.setTimeout(() => {
      cancelAfterPaint = scheduleAfterNextPaint(() => {
        setRoutePendingPage((pending) => (pending === activePage ? null : pending));
      });
    }, remaining);

    return () => {
      globalThis.clearTimeout(timerId);
      cancelAfterPaint?.();
    };
  }, [activePage, routePendingPage]);

  // Browser back/forward -> derive page from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      const next = getRouteSnapshot();
      setUnknownPath(next.unknownPath);
      if (next.unknownPath) {
        return;
      }
      if (next.page !== activePageRef.current) {
        setActivePageState(next.page);
      }
    };
    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  const setActivePage = useCallback(
    (page: NavV2Page, options: { skipTransition?: boolean } = {}) => {
      deferredRouteCancelRef.current?.();
      deferredRouteCancelRef.current = null;

      // Close drawer on navigate so mobile users don't see stale overlay.
      const wasDrawerOpen = drawerOpen;
      const isCurrentPage = page === activePageRef.current && !unknownPath;
      const shouldDeferDrawerClose = options.skipTransition && wasDrawerOpen && !isCurrentPage;
      const publishImmediateNavigationFeedback = () => {
        if (isCurrentPage) {
          routePendingStartedAtRef.current = 0;
          setRoutePendingPage(null);
          return;
        }
        routePendingStartedAtRef.current = nowMs();
        setRoutePendingPage(page);
      };

      if (options.skipTransition) {
        flushSync(() => {
          if (!shouldDeferDrawerClose) {
            setDrawerOpen(false);
          }
          publishImmediateNavigationFeedback();
        });
      } else {
        setDrawerOpen(false);
        publishImmediateNavigationFeedback();
      }

      if (isCurrentPage) {
        return;
      }

      const run = (deferRouteWork: boolean) => {
        const updateRoute = () => {
          setActivePageState(page);
          setUnknownPath(null);
          if (typeof window !== "undefined") {
            const base = getNavV2BasePath(window.location.pathname);
            const path = PAGE_TO_PATH[page];
            const params = new URLSearchParams(window.location.search);
            if (page !== "settings") {
              params.delete("settingsSection");
            }
            const search = params.toString();
            // Prepend Vite base so GH Pages deploys keep /people-first-app/ prefix.
            const newUrl = `${base}${path}${search ? `?${search}` : ""}${window.location.hash}`;
            try {
              window.history.pushState({ navV2Page: page }, "", newUrl);
            } catch {
              // Some environments block history (sandbox iframes) — state still moves.
            }
          }
        };

        if (deferRouteWork) {
          startRouteTransition(updateRoute);
          return;
        }
        updateRoute();
      };

      // Phone drawer navigation should acknowledge the tap first, then schedule
      // the route render as non-urgent work so low-end mobile web does not feel frozen.
      if (options.skipTransition) {
        if (wasDrawerOpen) {
          deferredRouteCancelRef.current = scheduleAfterNextPaint(() => {
            deferredRouteCancelRef.current = null;
            setDrawerOpen(false);
            run(true);
          });
          return;
        }
        run(false);
        return;
      }

      // morph() handles reduced-motion + VT-API-missing fallback internally.
      void morph(`page-${page}`, () => run(false));
    },
    [drawerOpen, startRouteTransition, unknownPath]
  );

  useEffect(() => {
    const openReminderSettings = (event: Event) => {
      const url = new URL(window.location.href);
      url.searchParams.set("settingsSection", "notifications");
      const reason = (event as CustomEvent<OpenReminderSettingsEventDetail>).detail?.reason;
      if (reason === "permission-required" || reason === "schedule-uncertain") {
        url.searchParams.set("reminderIncident", reason);
      } else {
        url.searchParams.delete("reminderIncident");
      }
      window.history.replaceState(window.history.state, "", url);

      if (activePageRef.current === "settings") {
        window.dispatchEvent(new PopStateEvent("popstate", { state: window.history.state }));
        return;
      }
      setActivePage("settings");
    };

    window.addEventListener(OPEN_REMINDER_SETTINGS_EVENT, openReminderSettings);
    return () => window.removeEventListener(OPEN_REMINDER_SETTINGS_EVENT, openReminderSettings);
  }, [setActivePage]);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((s) => !s), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Android hardware Back follows the visible stack, then destination history.
  const handleBackButton = useCallback((event?: { canGoBack: boolean }): boolean => {
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false);
      return true;
    }
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (!event?.canGoBack && (activePage !== "orb" || unknownPath !== null)) {
      setActivePage("orb", { skipTransition: true });
      return true;
    }
    return false;
  }, [activePage, commandPaletteOpen, drawerOpen, setActivePage, unknownPath]);

  return {
    activePage,
    unknownPath,
    setActivePage,
    routePendingPage,
    sidebarCollapsed,
    toggleSidebar,
    drawerOpen,
    openDrawer,
    closeDrawer,
    handleBackButton,
    commandPaletteOpen,
    setCommandPaletteOpen,
  };
}
