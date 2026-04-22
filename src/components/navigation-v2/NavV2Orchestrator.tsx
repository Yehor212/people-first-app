import { Suspense, lazy, memo, useCallback, useEffect } from "react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigationV2 } from "@/hooks/useNavigationV2";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { SidebarV2 } from "./SidebarV2";
import { DrawerV2 } from "./DrawerV2";
import { OrbPage } from "@/pages/nav-v2/OrbPage";
import { HabitsPage } from "@/pages/nav-v2/HabitsPage";
import { DiaryPage } from "@/pages/nav-v2/DiaryPage";
import { SettingsPage } from "@/pages/nav-v2/SettingsPage";

const CommandPalette = lazy(() => import("@/components/desktop/CommandPalette"));

/**
 * NavV2Orchestrator — wraps the V2 navigation shell around flag-gated page shells.
 *
 * Renders:
 *   - Desktop (>=md): permanent <SidebarV2> (collapsible rail) + page content
 *   - Mobile (<md):   top-left stylised single-bar menu trigger + <DrawerV2> only.
 *                     No bottom tab bar — sidebar-as-drawer is the sole secondary nav.
 *   - Both:           Ctrl+K <CommandPalette> (lazy)
 *
 * Stays orthogonal to V1 (`<Navigation />`) — Index.tsx picks one or the other
 * based on `design.nav.v2` flag + `?nav=v2` override.
 *
 * Phase 3-A.1 correction: MobileNavV2 bottom tabs removed from render (Option A —
 * drawer-only on mobile per user post-facto override). File retained as dead code
 * pending Phase 3-F V1 cutover cleanup.
 */
export const NavV2Orchestrator = memo(function NavV2Orchestrator() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { tier } = useDeviceTier();

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
  } = useNavigationV2();

  // Register Android back handler — drawer close > palette close > let native back
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => handleBackButton());
    return unregister;
  }, [handleBackButton]);

  useEffect(() => {
    if (typeof document === "undefined") return;
    document.documentElement.style.setProperty(
      "--sidebar-width",
      sidebarCollapsed ? "72px" : "256px",
    );
    return () => {
      document.documentElement.style.removeProperty("--sidebar-width");
    };
  }, [sidebarCollapsed]);

  // Keyboard shortcuts (desktop/tablet only)
  const togglePalette = useCallback(() => setCommandPaletteOpen(!commandPaletteOpen), [
    commandPaletteOpen,
    setCommandPaletteOpen,
  ]);
  useKeyboardShortcuts(
    {
      "ctrl+1": () => setActivePage("orb"),
      "ctrl+2": () => setActivePage("habits"),
      "ctrl+3": () => setActivePage("diary"),
      "ctrl+4": () => setActivePage("settings"),
      "ctrl+k": togglePalette,
      escape: () => {
        if (commandPaletteOpen) setCommandPaletteOpen(false);
        else if (drawerOpen) closeDrawer();
      },
    },
    tier !== "phone",
  );

  const pageNode =
    activePage === "orb" ? (
      <OrbPage />
    ) : activePage === "habits" ? (
      <HabitsPage />
    ) : activePage === "diary" ? (
      <DiaryPage />
    ) : (
      <SettingsPage />
    );

  return (
    <div
      className={cn(
        "min-h-screen bg-background motion-safe:transition-[padding] motion-safe:duration-300",
        sidebarCollapsed ? "md:ps-[72px]" : "md:ps-64",
      )}
      data-testid="nav-v2-orchestrator"
      data-active-page={activePage}
    >
      <SidebarV2
        activePage={activePage}
        onPageChange={setActivePage}
        collapsed={sidebarCollapsed}
        onToggleCollapsed={toggleSidebar}
      />

      {/*
        Mobile menu trigger — always visible top-left (44×44, WCAG 2.5.5 + 2.5.7).
        Stylised single-bar per paper aesthetic — NOT a triple-bar hamburger.
        This is the sole mobile nav affordance now that bottom tabs are removed.
      */}
      <button
        type="button"
        onClick={() => {
          void haptics.tabChanged();
          openDrawer();
        }}
        aria-label={tx.navV2OpenMenu || "Open menu"}
        aria-expanded={drawerOpen}
        aria-controls="nav-v2-drawer"
        data-testid="nav-v2-open-drawer"
        className={cn(
          "md:hidden fixed start-3 z-40",
          "top-[calc(env(safe-area-inset-top)+0.5rem)]",
          "flex h-11 w-11 items-center justify-center rounded-full",
          "bg-card/85 backdrop-blur-lg [-webkit-backdrop-filter:blur(12px)]",
          "border border-border/60 shadow-md",
          "text-foreground",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          "motion-safe:transition-[transform,background-color] motion-safe:duration-200 active:scale-95",
        )}
      >
        {/*
          Single stylised bar — intentionally one line (paper ink mark), not three.
          Rendered as SVG so it participates in currentColor theming.
        */}
        <svg
          width="20"
          height="20"
          viewBox="0 0 20 20"
          fill="none"
          aria-hidden="true"
          focusable="false"
        >
          <line
            x1="4"
            y1="10"
            x2="16"
            y2="10"
            stroke="currentColor"
            strokeWidth="1.5"
            strokeLinecap="round"
          />
        </svg>
      </button>

      <DrawerV2
        open={drawerOpen}
        onClose={closeDrawer}
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

      {pageNode}
    </div>
  );
});
