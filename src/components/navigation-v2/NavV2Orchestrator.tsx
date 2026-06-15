import { Suspense, lazy, memo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";
import { NAV_V2_PAGES, useNavigationV2 } from "@/hooks/useNavigationV2";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { NotFoundPage } from "@/components/NotFoundPage";
import { SidebarV2 } from "./SidebarV2";
import { DrawerV2 } from "./DrawerV2";
import type { GratitudeEntry, MoodEntry } from "@/types";
import type { V2SettingsControls } from "@/pages/nav-v2/SettingsPage";
import type { NavV2Page } from "@/hooks/useNavigationV2";

const loadCommandPalette = () => import("@/components/desktop/CommandPalette");
const loadOrbPage = () =>
  import("@/pages/nav-v2/OrbPage").then((m) => ({ default: m.OrbPage }));
const loadHabitsPage = () =>
  import("@/pages/nav-v2/HabitsPage").then((m) => ({ default: m.HabitsPage }));
const loadDiaryPage = () =>
  import("@/pages/nav-v2/DiaryPage").then((m) => ({ default: m.DiaryPage }));
const loadSettingsPage = () =>
  import("@/pages/nav-v2/SettingsPage").then((m) => ({ default: m.SettingsPage }));

const CommandPalette = lazy(loadCommandPalette);
const OrbPage = lazy(loadOrbPage);
const HabitsPage = lazy(loadHabitsPage);
const DiaryPage = lazy(loadDiaryPage);
const SettingsPage = lazy(loadSettingsPage);

type RouteLoader = () => Promise<unknown>;
const NAV_V2_ROUTE_LOADERS: Record<NavV2Page, RouteLoader> = {
  orb: loadOrbPage,
  habits: loadHabitsPage,
  diary: loadDiaryPage,
  settings: loadSettingsPage,
};
const preloadedNavV2Routes = new Map<NavV2Page, Promise<unknown>>();

function preloadNavV2Route(page: NavV2Page) {
  if (preloadedNavV2Routes.has(page)) {
    return;
  }

  const promise = NAV_V2_ROUTE_LOADERS[page]().catch((error) => {
    preloadedNavV2Routes.delete(page);
    logger.warn(`[NavV2] Route preload failed for ${page}`, error);
  });
  preloadedNavV2Routes.set(page, promise);
}

function scheduleNavV2RoutePreload(activePage: NavV2Page) {
  if (typeof window === "undefined") {
    return () => undefined;
  }

  let cancelled = false;
  const run = () => {
    if (cancelled) {
      return;
    }
    NAV_V2_PAGES.forEach((page) => {
      if (page !== activePage) {
        preloadNavV2Route(page);
      }
    });
  };

  const requestIdle = window.requestIdleCallback;
  const cancelIdle = window.cancelIdleCallback;
  const scheduleTimeout = window.setTimeout.bind(window);
  const cancelTimeout = window.clearTimeout.bind(window);

  if (typeof requestIdle === "function" && typeof cancelIdle === "function") {
    const idleId = requestIdle(run, { timeout: 750 });
    return () => {
      cancelled = true;
      cancelIdle(idleId);
    };
  }

  const timerId = scheduleTimeout(run, 120);
  return () => {
    cancelled = true;
    cancelTimeout(timerId);
  };
}

/**
 * NavV2Orchestrator — wraps the V2 navigation shell around flag-gated page shells.
 *
 * Renders:
 *   - Desktop (>=md): permanent <SidebarV2> (collapsible rail) + page content
 *   - Mobile (<md):   top-left menu trigger + <DrawerV2> only.
 *                     No bottom tab bar — drawer carries primary + secondary nav.
 *   - Both:           Ctrl+K <CommandPalette> (lazy)
 *
 * Stays orthogonal to V1 (`<Navigation />`) — Index.tsx picks one or the other
 * based on `design.nav.v2` flag + `?nav=v2` override.
 *
 * Phase 3-A.1 correction: MobileNavV2 bottom tabs removed from render (Option A —
 * drawer-only on mobile per user post-facto override). File retained as dead code
 * pending Phase 3-F V1 cutover cleanup.
 */
interface NavV2OrchestratorProps {
  onAddMood?: (entry: MoodEntry) => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  settingsControls?: V2SettingsControls;
}

function shouldForceWebNavigation(): boolean {
  if (!import.meta.env.DEV || typeof window === "undefined") {
    return false;
  }

  const params = new URLSearchParams(window.location.search);
  const requestedLayout = params.get("navLayout");
  if (requestedLayout === "phone") return false;
  if (requestedLayout === "web") return true;

  return params.get("nav") === "v2" && params.get("dev") === "true";
}

function NavV2RouteFallback({ label }: { label: string }) {
  return (
    <main
      id="main-content-v2"
      data-testid="nav-v2-route-fallback"
      role="status"
      aria-live="polite"
      aria-label={label}
      className="flex min-h-screen items-center justify-center px-4 py-10"
    >
      <div className="inline-flex min-h-[44px] items-center gap-3 rounded-2xl border border-border/50 bg-card/70 px-4 py-3 text-sm font-medium text-muted-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]">
        <span
          aria-hidden="true"
          className="h-2.5 w-2.5 rounded-full bg-primary motion-safe:animate-pulse"
        />
        <span>{label}</span>
      </div>
    </main>
  );
}

export const NavV2Orchestrator = memo(function NavV2Orchestrator({
  onAddMood,
  onAddGratitude,
  settingsControls,
}: NavV2OrchestratorProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { tier } = useDeviceTier();
  const forceWebNavigation = shouldForceWebNavigation();
  const isWebNavigation = forceWebNavigation || tier !== "phone";
  const forceCompactWebRail = forceWebNavigation && tier === "phone";

  const {
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
    unknownPath,
  } = useNavigationV2();
  const effectiveSidebarCollapsed = sidebarCollapsed || forceCompactWebRail;
  const shouldShowDrawerTrigger = !forceWebNavigation && !unknownPath && activePage !== "diary";
  const MenuIcon = V2_SHELL_ICONS.menu;

  useEffect(() => scheduleNavV2RoutePreload(activePage), [activePage]);

  const handleOpenDrawer = useCallback(() => {
    NAV_V2_PAGES.forEach((page) => {
      if (page !== activePage) {
        preloadNavV2Route(page);
      }
    });
    void haptics.tabChanged();
    openDrawer();
  }, [activePage, openDrawer]);

  const handlePrimaryPageChange = useCallback(
    (page: NavV2Page) => {
      setActivePage(page, { skipTransition: tier === "phone" || !isWebNavigation });
    },
    [isWebNavigation, setActivePage, tier],
  );

  // Register Android back handler — drawer close > palette close > let native back
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => handleBackButton());
    return unregister;
  }, [handleBackButton]);

  useEffect(() => {
    if (forceWebNavigation && drawerOpen) {
      closeDrawer();
    }
  }, [closeDrawer, drawerOpen, forceWebNavigation]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      effectiveSidebarCollapsed ? "72px" : "256px",
    );
    return () => {
      document.documentElement.style.removeProperty("--sidebar-width");
    };
  }, [effectiveSidebarCollapsed]);

  // Keyboard shortcuts (desktop/tablet only)
  const togglePalette = useCallback(() => setCommandPaletteOpen(!commandPaletteOpen), [
    commandPaletteOpen,
    setCommandPaletteOpen,
  ]);
  useKeyboardShortcuts(
    {
      "ctrl+1": () => handlePrimaryPageChange("orb"),
      "ctrl+2": () => handlePrimaryPageChange("habits"),
      "ctrl+3": () => handlePrimaryPageChange("diary"),
      "ctrl+4": () => handlePrimaryPageChange("settings"),
      "ctrl+k": togglePalette,
      escape: () => {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (drawerOpen) closeDrawer();
      },
    },
    isWebNavigation,
  );

  const pageNode = unknownPath ? (
    <NotFoundPage
      requestedPath={unknownPath}
      canGoBack={typeof window !== "undefined" && window.history.length > 1}
      onGoBack={() => window.history.back()}
      onGoHome={() => handlePrimaryPageChange("orb")}
    />
  ) : activePage === "orb" ? (
      <OrbPage navigateToPage={handlePrimaryPageChange} onAddMood={onAddMood} />
    ) : activePage === "habits" ? (
      <HabitsPage />
    ) : activePage === "diary" ? (
      <DiaryPage
        onOpenNavMenu={handleOpenDrawer}
        navMenuOpen={drawerOpen}
        onAddGratitude={onAddGratitude}
      />
    ) : (
      <SettingsPage controls={settingsControls} />
    );

  return (
    <div
      className={cn(
        "min-h-screen bg-background motion-safe:transition-[padding] motion-safe:duration-300",
        effectiveSidebarCollapsed
          ? forceWebNavigation
            ? "ps-[72px]"
            : "md:ps-[72px]"
          : forceWebNavigation
            ? "ps-64"
            : "md:ps-64",
      )}
      data-testid="nav-v2-orchestrator"
      data-active-page={activePage}
      data-nav-layout={isWebNavigation ? "web" : "phone"}
      data-nav-rail={effectiveSidebarCollapsed ? "compact" : "expanded"}
    >
      {isWebNavigation && (
        <SidebarV2
          activePage={activePage}
          onPageChange={handlePrimaryPageChange}
          collapsed={effectiveSidebarCollapsed}
          onToggleCollapsed={toggleSidebar}
          forceVisible={forceWebNavigation}
          collapseLocked={forceCompactWebRail}
        />
      )}

      {/*
        Mobile menu trigger — top-left floating control keeps the Orb surface calm on phones.
        The full drawer opens on demand and fully disappears when closed.
      */}
      <button
        type="button"
        onClick={handleOpenDrawer}
        aria-label={tx.navV2OpenMenu || "Open menu"}
        aria-expanded={drawerOpen}
        aria-controls="nav-v2-drawer"
        data-testid="nav-v2-open-drawer"
        className={cn(
          shouldShowDrawerTrigger ? "md:hidden flex" : "hidden",
          "fixed start-4 top-[calc(env(safe-area-inset-top)+0.75rem)] z-[58]",
          "h-12 w-12 items-center justify-center rounded-full",
          "bg-card/70 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "border border-border/50 shadow-[0_14px_34px_hsl(var(--foreground)/0.16)]",
          "text-foreground/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:bg-card/85 active:scale-95 active:bg-muted/60",
        )}
      >
        <MenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
      </button>

      <DrawerV2
        open={!forceWebNavigation && drawerOpen}
        activePage={activePage}
        onClose={closeDrawer}
        onPageChange={handlePrimaryPageChange}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
      />

      {commandPaletteOpen && (
        <Suspense fallback={null}>
          <CommandPalette
            open={commandPaletteOpen}
            onClose={() => setCommandPaletteOpen(false)}
          />
        </Suspense>
      )}

      <Suspense fallback={<NavV2RouteFallback label={tx.loading || "Loading..."} />}>
        {pageNode}
      </Suspense>
    </div>
  );
});
