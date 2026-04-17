import { Suspense, lazy, memo, useCallback, useEffect, useState } from "react";
import { Menu } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { useNavigationV2 } from "@/hooks/useNavigationV2";
import { useKeyboardShortcuts } from "@/hooks/useKeyboardShortcuts";
import { useDeviceTier } from "@/hooks/useDeviceTier";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { SidebarV2 } from "./SidebarV2";
import { MobileNavV2 } from "./MobileNavV2";
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
 *   - Desktop: permanent <SidebarV2> (collapsible rail) + page content
 *   - Mobile: top-left menu button + <DrawerV2> + <MobileNavV2> + page content
 *   - Both: Ctrl+K <CommandPalette> (lazy)
 *
 * Stays orthogonal to V1 (`<Navigation />`) — Index.tsx picks one or the other
 * based on `design.nav.v2` flag + `?nav=v2` override.
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

  // Track mobile keyboard so we can hide the floating pill while typing
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  // Register Android back handler — drawer close > palette close > let native back
  useEffect(() => {
    const unregister = registerModalCloseCallback(() => handleBackButton());
    return unregister;
  }, [handleBackButton]);

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
        "min-h-screen bg-background transition-[padding] duration-300",
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

      {/* Mobile menu button (top-left) — stylised single-bar per POV */}
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
          "bg-card/80 backdrop-blur-lg [-webkit-backdrop-filter:blur(12px)]",
          "border border-border/60 shadow-sm",
          "text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
        )}
      >
        <Menu className="h-5 w-5" aria-hidden="true" />
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

      <MobileNavV2
        activePage={activePage}
        onPageChange={setActivePage}
        hidden={keyboardOpen}
      />
    </div>
  );
});
