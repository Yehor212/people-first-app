import { Suspense, lazy, memo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";
import { NAV_V2_PAGES, useNavigationV2 } from "@/hooks/useNavigationV2";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { subscribeToDeepLinks } from "@/lib/deepLinks";
import { requestDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { NotFoundPage } from "@/components/NotFoundPage";
import { SidebarV2 } from "./SidebarV2";
import { DrawerV2 } from "./DrawerV2";
import { V2FocusMiniPlayer } from "./V2FocusMiniPlayer";
import { V2MindfulMomentLayer } from "./V2MindfulMomentLayer";
import {
  getNavV2RouteLabel,
  NavV2RouteFallback,
  NavV2RoutePending,
} from "./NavV2RouteStatus";
import type { FocusSession, GratitudeEntry, MoodEntry } from "@/types";
import type { V2SettingsControls } from "@/pages/nav-v2/SettingsPage";
import type { NavV2Page } from "@/hooks/useNavigationV2";

const loadCommandPalette = () => import("@/components/desktop/CommandPalette");
const loadOrbPage = () => import("@/pages/nav-v2/OrbPage").then((m) => ({ default: m.OrbPage }));
const loadHabitsPage = () =>
  import("@/pages/nav-v2/HabitsPage").then((m) => ({ default: m.HabitsPage }));
const loadDiaryPage = () =>
  import("@/pages/nav-v2/DiaryPage").then((m) => ({ default: m.DiaryPage }));
const loadPlanningPage = () =>
  import("@/pages/nav-v2/planning/PlanningPage").then((m) => ({ default: m.PlanningPage }));
const loadSettingsPage = () =>
  import("@/pages/nav-v2/SettingsPage").then((m) => ({ default: m.SettingsPage }));

const CommandPalette = lazy(loadCommandPalette);
const OrbPage = lazy(loadOrbPage);
const HabitsPage = lazy(loadHabitsPage);
const DiaryPage = lazy(loadDiaryPage);
const PlanningPage = lazy(loadPlanningPage);
const SettingsPage = lazy(loadSettingsPage);

type RouteLoader = () => Promise<unknown>;
const NAV_V2_ROUTE_LOADERS: Record<NavV2Page, RouteLoader> = {
  orb: loadOrbPage,
  habits: loadHabitsPage,
  diary: loadDiaryPage,
  planning: loadPlanningPage,
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
  let idleId: number | null = null;
  let timerId: number | null = null;
  const pendingPages = Array.from(new Set<NavV2Page>(["settings", ...NAV_V2_PAGES])).filter(
    (page) => page !== activePage,
  );

  const requestIdle = window.requestIdleCallback;
  const cancelIdle = window.cancelIdleCallback;
  const scheduleTimeout = window.setTimeout.bind(window);
  const cancelTimeout = window.clearTimeout.bind(window);

  const scheduleNext = () => {
    if (cancelled) {
      return;
    }

    const page = pendingPages.shift();
    if (!page) {
      return;
    }

    preloadNavV2Route(page);
    if (pendingPages.length > 0) {
      schedule();
    }
  };

  const schedule = () => {
    if (typeof requestIdle === "function" && typeof cancelIdle === "function") {
      idleId = requestIdle(scheduleNext, { timeout: 750 });
      return;
    }

    timerId = scheduleTimeout(scheduleNext, 120);
  };

  schedule();

  return () => {
    cancelled = true;
    if (idleId !== null) cancelIdle?.(idleId);
    if (timerId !== null) cancelTimeout(timerId);
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
 * Owns the app navigation surface. Root Index mounts this shell directly,
 * while `?nav=v2` remains accepted for existing deep links.
 *
 * Phase 3-A.1 correction: bottom tabs were removed from render; mobile uses
 * the drawer as primary navigation.
 */
interface NavV2OrchestratorProps {
  onAddMood?: (entry: MoodEntry) => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  onCompleteFocusSession?: (session: FocusSession) => void;
  onMindfulMomentComplete?: () => void;
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

export const NavV2Orchestrator = memo(function NavV2Orchestrator({
  onAddMood,
  onAddGratitude,
  onCompleteFocusSession,
  onMindfulMomentComplete,
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
    routePendingPage,
  } = useNavigationV2();
  const effectiveSidebarCollapsed = sidebarCollapsed || forceCompactWebRail;
  const shouldShowDrawerTrigger = !isWebNavigation && !unknownPath && activePage !== "diary";
  const MenuIcon = V2_SHELL_ICONS.menu;
  const pendingRouteLabel = routePendingPage ? getNavV2RouteLabel(routePendingPage, tx) : null;

  useEffect(() => scheduleNavV2RoutePreload(activePage), [activePage]);

  useEffect(() => {
    const cleanup = subscribeToDeepLinks((data) => {
      if (data.type === "diary") {
        setActivePage("diary", { skipTransition: true });
        if (data.route === "editor") {
          requestDiaryEditorOpen();
        }
      }
    });
    return cleanup;
  }, [setActivePage]);

  const handleOpenDrawer = useCallback(() => {
    void haptics.tabChanged();
    openDrawer();
    preloadNavV2Route("settings");
    scheduleNavV2RoutePreload(activePage);
  }, [activePage, openDrawer]);

  const handlePrimaryPageChange = useCallback(
    (page: NavV2Page) => {
      setActivePage(page, { skipTransition: tier === "phone" || !isWebNavigation });
    },
    [isWebNavigation, setActivePage, tier]
  );

  // Register Android back handler — drawer close > palette close > let native back
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => handleBackButton());
    return unregister;
  }, [handleBackButton]);

  useEffect(() => {
    if (isWebNavigation && drawerOpen) {
      closeDrawer();
    }
  }, [closeDrawer, drawerOpen, isWebNavigation]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      effectiveSidebarCollapsed ? "72px" : "256px"
    );
    return () => {
      document.documentElement.style.removeProperty("--sidebar-width");
    };
  }, [effectiveSidebarCollapsed]);

  // Keyboard shortcuts (desktop/tablet only)
  const togglePalette = useCallback(
    () => setCommandPaletteOpen(!commandPaletteOpen),
    [commandPaletteOpen, setCommandPaletteOpen]
  );
  useKeyboardShortcuts(
    {
      "ctrl+1": () => handlePrimaryPageChange("orb"),
      "ctrl+2": () => handlePrimaryPageChange("habits"),
      "ctrl+3": () => handlePrimaryPageChange("diary"),
      "ctrl+4": () => handlePrimaryPageChange("planning"),
      "ctrl+5": () => handlePrimaryPageChange("settings"),
      "ctrl+k": togglePalette,
      escape: () => {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (drawerOpen) closeDrawer();
      },
    },
    isWebNavigation
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
      showAppNavMenu={!isWebNavigation}
      onAddGratitude={onAddGratitude}
    />
  ) : activePage === "planning" ? (
    <PlanningPage onCompleteFocusSession={onCompleteFocusSession} />
  ) : (
    <SettingsPage controls={settingsControls} />
  );

  return (
    <div
      className={cn(
        "v2-edge-to-edge-surface min-h-[var(--app-viewport-height)] bg-background motion-safe:transition-[padding] motion-safe:duration-300",
        effectiveSidebarCollapsed
          ? forceWebNavigation
            ? "ps-[72px]"
            : "md:ps-[72px]"
          : forceWebNavigation
            ? "ps-64"
            : "md:ps-64"
      )}
      data-testid="nav-v2-orchestrator"
      data-fullscreen-surface="v2"
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
          "fixed start-3 top-[calc(var(--safe-top)+0.75rem)] z-[58]",
          "h-11 w-11 items-center justify-center rounded-full",
          "bg-card/62 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "border border-border/42 shadow-[0_12px_28px_hsl(var(--foreground)/0.12)]",
          "text-foreground/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:bg-card/85 motion-safe:active:translate-y-[1px] active:bg-muted/60"
        )}
      >
        <MenuIcon className="pointer-events-none h-5 w-5" aria-hidden="true" />
      </button>

      {pendingRouteLabel && <NavV2RoutePending label={pendingRouteLabel} />}

      <DrawerV2
        open={!isWebNavigation && drawerOpen}
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
            onNavigate={handlePrimaryPageChange}
          />
        </Suspense>
      )}

      <Suspense fallback={<NavV2RouteFallback label={tx.loading || "Loading..."} />}>
        {pageNode}
      </Suspense>

      <V2FocusMiniPlayer
        activePage={activePage}
        onNavigateToPlanning={() => handlePrimaryPageChange("planning")}
      />
      <V2MindfulMomentLayer onComplete={onMindfulMomentComplete} />
    </div>
  );
});
