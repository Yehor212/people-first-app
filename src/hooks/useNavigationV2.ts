import { useCallback, useEffect, useRef, useState } from "react";
import { morph } from "@/lib/motion/morph";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

/**
 * Navigation V2 — 4-page IA (Orb / Habits / Diary / Settings).
 *
 * Coexists with V1 `useTabNavigation`. V2 lives under a design flag
 * (`design.nav.v2`) and a `?nav=v2` override; V1 remains the default.
 *
 * Responsibilities:
 *  - Active page state machine (Orb / Habits / Diary / Settings)
 *  - URL <-> page sync via history.pushState + popstate (no router dep)
 *  - Page transitions wrapped in `morph()` (View Transitions API, with
 *    the wrapper's own reduced-motion + browser fallback)
 *  - Collapsible sidebar rail (desktop) + drawer (mobile) state
 *  - Android back precedence: drawer close > page back
 */

export type NavV2Page = "orb" | "habits" | "diary" | "settings";

export const NAV_V2_PAGES: readonly NavV2Page[] = ["orb", "habits", "diary", "settings"] as const;

const STORAGE_KEY = SK.NAV_V2_LAST_PAGE;
const PATH_TO_PAGE: Record<string, NavV2Page> = {
  "/orb": "orb",
  "/habits": "habits",
  "/diary": "diary",
  "/settings": "settings",
};
const PAGE_TO_PATH: Record<NavV2Page, string> = {
  orb: "/orb",
  habits: "/habits",
  diary: "/diary",
  settings: "/settings",
};

interface RouteSnapshot {
  page: NavV2Page;
  unknownPath: string | null;
}

function isValidPage(value: unknown): value is NavV2Page {
  return typeof value === "string" && (NAV_V2_PAGES as readonly string[]).includes(value);
}

/** Strip Vite base (e.g. "/people-first-app/") from pathname for GH Pages deploys. */
function normalizePath(pathname: string): string {
  // import.meta.env.BASE_URL is set by Vite at build time (e.g. "/people-first-app/")
  const base = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
  const stripped = base && pathname.startsWith(base)
    ? pathname.slice(base.length)
    : pathname;
  const normalized = stripped || "/";
  return normalized.length > 1 && normalized.endsWith("/")
    ? normalized.slice(0, -1)
    : normalized;
}

function getRouteSnapshot(): RouteSnapshot {
  if (typeof window === "undefined") {
    return { page: "orb", unknownPath: null };
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
  /** Currently active page (one of Orb/Habits/Diary/Settings). */
  activePage: NavV2Page;
  /** Unknown app path that should render the user-facing Not Found state. */
  unknownPath: string | null;
  /** Wrapped page change: writes URL, persists to localStorage, runs via morph(). */
  setActivePage: (page: NavV2Page) => void;
  /** Desktop sidebar rail mode (collapsed = 64-80px, expanded = 240-280px). */
  sidebarCollapsed: boolean;
  toggleSidebar: () => void;
  /** Mobile drawer (sidebar-as-drawer) visibility. */
  drawerOpen: boolean;
  openDrawer: () => void;
  closeDrawer: () => void;
  /** Android/hardware back. Returns true if handled (drawer close). */
  handleBackButton: () => boolean;
  /** Command palette visibility (shared with Ctrl+K shortcut). */
  commandPaletteOpen: boolean;
  setCommandPaletteOpen: (open: boolean) => void;
}

/**
 * 4-page V2 navigation state machine.
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

  // Ref avoids stale closures inside the popstate listener
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  // Persist last page (for next cold boot when URL is bare "/")
  useEffect(() => {
    if (typeof window === "undefined") return;
    storageSetRaw(STORAGE_KEY, activePage);
  }, [activePage]);

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

  const setActivePage = useCallback((page: NavV2Page) => {
    // Close drawer on navigate so mobile users don't see stale overlay
    setDrawerOpen(false);

    const run = () => {
      setActivePageState(page);
      setUnknownPath(null);
      if (typeof window !== "undefined") {
        const base = (import.meta.env?.BASE_URL || "/").replace(/\/$/, "");
        const path = PAGE_TO_PATH[page];
        // Preserve ?nav=v2 (and other) query params across navigation.
        // Prepend Vite base so GH Pages deploys keep /people-first-app/ prefix.
        const newUrl = base + path + window.location.search + window.location.hash;
        try {
          window.history.pushState({ navV2Page: page }, "", newUrl);
        } catch {
          // Some environments block history (sandbox iframes) — state still moves.
        }
      }
    };

    // morph() handles reduced-motion + VT-API-missing fallback internally.
    void morph(`page-${page}`, run);
  }, []);

  const toggleSidebar = useCallback(() => setSidebarCollapsed((s) => !s), []);
  const openDrawer = useCallback(() => setDrawerOpen(true), []);
  const closeDrawer = useCallback(() => setDrawerOpen(false), []);

  // Android hardware back: drawer close > command palette close > (let caller handle page back)
  const handleBackButton = useCallback((): boolean => {
    if (drawerOpen) {
      setDrawerOpen(false);
      return true;
    }
    if (commandPaletteOpen) {
      setCommandPaletteOpen(false);
      return true;
    }
    return false;
  }, [drawerOpen, commandPaletteOpen]);

  return {
    activePage,
    unknownPath,
    setActivePage,
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
