import { useCallback, useEffect, useRef, useState } from "react";
import { morph } from "@/lib/motion/morph";

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

const STORAGE_KEY = "zen-nav-v2-last-page";
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

function isValidPage(value: unknown): value is NavV2Page {
  return typeof value === "string" && (NAV_V2_PAGES as readonly string[]).includes(value);
}

function readInitialPage(): NavV2Page {
  if (typeof window === "undefined") return "orb";
  // URL takes priority over localStorage (deep-link friendly)
  const pathPage = PATH_TO_PAGE[window.location.pathname];
  if (pathPage) return pathPage;
  try {
    const stored = window.localStorage.getItem(STORAGE_KEY);
    if (isValidPage(stored)) return stored;
  } catch {
    // localStorage unavailable (private mode / SSR). Fall through to default.
  }
  return "orb";
}

export interface UseNavigationV2Return {
  /** Currently active page (one of Orb/Habits/Diary/Settings). */
  activePage: NavV2Page;
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
  const [activePage, setActivePageState] = useState<NavV2Page>(readInitialPage);
  const [sidebarCollapsed, setSidebarCollapsed] = useState<boolean>(false);
  const [drawerOpen, setDrawerOpen] = useState<boolean>(false);
  const [commandPaletteOpen, setCommandPaletteOpen] = useState<boolean>(false);

  // Ref avoids stale closures inside the popstate listener
  const activePageRef = useRef(activePage);
  activePageRef.current = activePage;

  // Persist last page (for next cold boot when URL is bare "/")
  useEffect(() => {
    if (typeof window === "undefined") return;
    try {
      window.localStorage.setItem(STORAGE_KEY, activePage);
    } catch {
      // Quota / disabled — non-fatal.
    }
  }, [activePage]);

  // Browser back/forward -> derive page from URL
  useEffect(() => {
    if (typeof window === "undefined") return;
    const onPopState = () => {
      const next = PATH_TO_PAGE[window.location.pathname];
      if (next && next !== activePageRef.current) {
        setActivePageState(next);
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
      if (typeof window !== "undefined") {
        const path = PAGE_TO_PATH[page];
        // Preserve ?nav=v2 (and other) query params across navigation
        const newUrl = path + window.location.search + window.location.hash;
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
