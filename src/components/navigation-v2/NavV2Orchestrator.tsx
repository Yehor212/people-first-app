import { Suspense, lazy, memo, useCallback, useEffect, useRef } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { logger } from "@/lib/logger";
import { scheduleIdle, type IdleHandle } from "@/lib/scheduleIdle";
import { useLanguage } from "@/contexts/LanguageContext";
import { NAV_V2_PAGES, useNavigationV2 } from "@/hooks/useNavigationV2";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import {
  publishAndroidBackNavigationState,
  registerModalCloseCallback,
} from "@/lib/androidBackHandler";
import { subscribeToDeepLinks } from "@/lib/deepLinks";
import { requestDiaryEditorOpen } from "@/lib/diaryDeepLinkIntent";
import { V2_SHELL_ICONS } from "@/lib/v2IconSystem";
import { NotFoundPage } from "@/components/NotFoundPage";
import { useV2ConnectedHistoryLayer } from "@/features/automation";
import { SidebarV2 } from "./SidebarV2";
import { DrawerV2 } from "./DrawerV2";
import { V2FocusMiniPlayer } from "./V2FocusMiniPlayer";
import { V2MindfulMomentLayer } from "./V2MindfulMomentLayer";
import { V2ProgressionModalLayer } from "./V2ProgressionModalLayer";
import { getNavV2RouteLabel, NavV2RouteFallback, NavV2RoutePending } from "./NavV2RouteStatus";
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
const NAV_V2_PRELOAD_IDLE_TIMEOUT_MS = 2_500;
const NAV_V2_PRELOAD_STARTUP_DELAY_MS = 4_000;
const NAV_V2_PRELOAD_BETWEEN_ROUTES_MS = 750;

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
  let idleHandle: IdleHandle | null = null;
  const pendingPages = Array.from(new Set<NavV2Page>(["settings", ...NAV_V2_PAGES])).filter(
    (page) => page !== activePage
  );

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
      schedule(NAV_V2_PRELOAD_BETWEEN_ROUTES_MS);
    }
  };

  const schedule = (minimumDelayMs: number) => {
    idleHandle = scheduleIdle(
      scheduleNext,
      NAV_V2_PRELOAD_IDLE_TIMEOUT_MS,
      minimumDelayMs,
    );
  };

  schedule(NAV_V2_PRELOAD_STARTUP_DELAY_MS);

  return () => {
    cancelled = true;
    idleHandle?.cancel();
  };
}

/** Owns the V2 shell: desktop rail, mobile drawer, lazy pages and command palette. */
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
  const { isCompactHeight, tier } = useDeviceTier();
  const forceWebNavigation = shouldForceWebNavigation();
  const compactAndroidLandscapeDrawer =
    !forceWebNavigation && tier === "tablet" && isCompactHeight;
  const isWebNavigation =
    forceWebNavigation || (tier !== "phone" && !compactAndroidLandscapeDrawer);
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
  const drawerTriggerRef = useRef<HTMLButtonElement>(null);
  const { historyLayer, openConnectedHistory } = useV2ConnectedHistoryLayer(drawerTriggerRef);
  const drawerWasOpenRef = useRef(drawerOpen);
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
  }, [openDrawer]);

  const handlePrimaryPageChange = useCallback(
    (page: NavV2Page) => {
      setActivePage(page, { skipTransition: tier === "phone" || !isWebNavigation });
    },
    [isWebNavigation, setActivePage, tier]
  );

  const ownsAndroidBack =
    drawerOpen || commandPaletteOpen || activePage !== "orb" || unknownPath !== null;

  useEffect(() => {
    void publishAndroidBackNavigationState({
      isRoot: activePage === "orb" && unknownPath === null,
    });
  }, [activePage, unknownPath]);

  // Register only while this shell owns a Back destination. At an unobstructed
  // Orb root the native callback is disabled and Android owns back-to-home.
  useEffect(() => {
    if (!ownsAndroidBack) return undefined;
    const unregister = registerModalCloseCallback(
      (event) => handleBackButton(event),
      { layer: "navigation" },
    );
    return unregister;
  }, [handleBackButton, ownsAndroidBack]);

  useEffect(() => {
    if (isWebNavigation && drawerOpen) {
      closeDrawer();
    }
  }, [closeDrawer, drawerOpen, isWebNavigation]);

  useEffect(() => {
    const wasOpen = drawerWasOpenRef.current;
    drawerWasOpenRef.current = drawerOpen;
    if (!wasOpen || drawerOpen || !shouldShowDrawerTrigger) return;

    const frame = window.requestAnimationFrame(() => {
      const trigger = drawerTriggerRef.current;
      if (!trigger || trigger.disabled) return;
      const style = window.getComputedStyle(trigger);
      if (style.display === "none" || style.visibility === "hidden") return;
      trigger.focus({ preventScroll: true });
    });
    return () => window.cancelAnimationFrame(frame);
  }, [drawerOpen, shouldShowDrawerTrigger]);

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
      ...(commandPaletteOpen || drawerOpen
        ? {
            escape: () => {
              if (commandPaletteOpen) setCommandPaletteOpen(false);
              else closeDrawer();
            },
          }
        : {}),
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
        isWebNavigation &&
          (effectiveSidebarCollapsed
            ? forceWebNavigation
              ? "ps-[72px]"
              : "md:ps-[72px]"
            : forceWebNavigation
              ? "ps-64"
              : "md:ps-64")
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
          onOpenConnectedHistory={openConnectedHistory}
        />
      )}

      {/*
        Mobile menu trigger — top-left floating control keeps the Orb surface calm on phones.
        The full drawer opens on demand and fully disappears when closed.
      */}
      <button
        ref={drawerTriggerRef}
        type="button"
        onClick={handleOpenDrawer}
        aria-label={tx.navV2OpenMenu || "Open menu"}
        aria-expanded={drawerOpen}
        aria-controls={drawerOpen ? "nav-v2-drawer" : undefined}
        data-testid="nav-v2-open-drawer"
        className={cn(
          shouldShowDrawerTrigger
            ? compactAndroidLandscapeDrawer
              ? "flex"
              : "md:hidden flex"
            : "hidden",
          activePage === "planning" && "dark",
          "fixed start-[calc(var(--safe-inline-start)_+_var(--v2-phone-drawer-inset))] top-[calc(var(--safe-top)+var(--v2-phone-drawer-inset))] z-[58]",
          "h-[var(--v2-phone-drawer-size)] w-[var(--v2-phone-drawer-size)] items-center justify-center rounded-full",
          "bg-card/62 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
          "border border-border/42 shadow-[0_12px_28px_hsl(var(--foreground)/0.12)]",
          "text-foreground/90",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color,border-color,color,box-shadow] motion-safe:duration-200 motion-safe:ease-out hover:bg-card/85 motion-safe:active:translate-y-[1px] active:bg-muted/60"
        )}
      >
        <MenuIcon
          className="pointer-events-none h-[var(--v2-phone-drawer-icon-size)] w-[var(--v2-phone-drawer-icon-size)]"
          aria-hidden="true"
        />
      </button>

      {pendingRouteLabel && <NavV2RoutePending label={pendingRouteLabel} />}

      <DrawerV2
        open={!isWebNavigation && drawerOpen}
        activePage={activePage}
        onClose={closeDrawer}
        onPageChange={handlePrimaryPageChange}
        onOpenCommandPalette={() => setCommandPaletteOpen(true)}
        onOpenConnectedHistory={openConnectedHistory}
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
      <V2ProgressionModalLayer />
      {historyLayer}
    </div>
  );
});
