import { memo, useState, useEffect, useCallback } from "react";
import { cn } from "@/lib/utils";
import {
  Home,
  Settings,
  BookOpen,
  BarChart3,
  Compass,
  Repeat,
  PanelLeftClose,
  PanelLeftOpen,
} from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { haptics } from "@/lib/haptics";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

interface NavigationProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
  habitHubEnabled?: boolean;
}

export const Navigation = memo(function Navigation({
  activeTab,
  onTabChange,
  canvasEnabled,
  habitHubEnabled,
}: NavigationProps) {
  const { t } = useLanguage();
  const [keyboardOpen, setKeyboardOpen] = useState(false);
  const [collapsed, setCollapsed] = useState(() => storageGetRaw(SK.SIDEBAR_COLLAPSED) === "true");

  // Persist collapse state
  const toggleCollapse = useCallback(() => {
    setCollapsed((prev) => {
      const next = !prev;
      storageSetRaw(SK.SIDEBAR_COLLAPSED, String(next));
      return next;
    });
    void haptics.tabChanged();
  }, []);

  // Keyboard shortcut: Ctrl+B to toggle sidebar
  useEffect(() => {
    const onKeyDown = (e: KeyboardEvent) => {
      if ((e.ctrlKey || e.metaKey) && e.key === "b") {
        e.preventDefault();
        toggleCollapse();
      }
    };
    window.addEventListener("keydown", onKeyDown);
    return () => window.removeEventListener("keydown", onKeyDown);
  }, [toggleCollapse]);

  // Set CSS variable for content offset
  useEffect(() => {
    document.documentElement.style.setProperty("--sidebar-width", collapsed ? "64px" : "256px");
    return () => {
      document.documentElement.style.removeProperty("--sidebar-width");
    };
  }, [collapsed]);

  // Hide mobile nav when software keyboard is open
  useEffect(() => {
    const threshold = window.screen.height * 0.75;
    const onResize = () => setKeyboardOpen(window.innerHeight < threshold);
    window.addEventListener("resize", onResize);
    return () => window.removeEventListener("resize", onResize);
  }, []);

  const mainTabs = [
    { id: "home" as TabType, icon: Home, label: t.home },
    ...(habitHubEnabled
      ? [
          {
            id: "mindmap" as TabType,
            icon: Repeat,
            label: (t as unknown as Record<string, string>).habitHub || "Habits",
          },
        ]
      : canvasEnabled
        ? [{ id: "mindmap" as TabType, icon: Compass, label: t.map || "Map" }]
        : []),
    { id: "garden" as TabType, icon: BookOpen, label: t.diary },
    { id: "stats" as TabType, icon: BarChart3, label: t.stats },
  ];

  const settingsTab = { id: "settings" as TabType, icon: Settings, label: t.settings };

  const allTabs = [...mainTabs, settingsTab];

  const renderTab = (tab: typeof settingsTab) => (
    <div key={tab.id} className="relative group">
      <button
        onClick={() => {
          void haptics.tabChanged();
          onTabChange(tab.id);
        }}
        role="tab"
        aria-selected={activeTab === tab.id}
        aria-label={tab.label}
        className={cn(
          "flex items-center w-full rounded-xl transition-all duration-200 min-h-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
          activeTab === tab.id
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <tab.icon
          className={cn(
            "w-5 h-5 shrink-0 transition-colors duration-200",
            activeTab === tab.id ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        {!collapsed && (
          <span
            className={cn(
              "text-sm truncate transition-colors duration-200",
              activeTab === tab.id ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            {tab.label}
          </span>
        )}
      </button>
      {/* Tooltip in collapsed mode */}
      {collapsed && (
        <div className="absolute start-full top-1/2 -translate-y-1/2 ms-2 px-2.5 py-1.5 rounded-lg bg-popover text-popover-foreground text-xs font-medium shadow-lg border border-border opacity-0 group-hover:opacity-100 pointer-events-none transition-opacity duration-150 whitespace-nowrap z-[45]">
          {tab.label}
        </div>
      )}
    </div>
  );

  return (
    <>
      {/* Desktop sidebar — collapsible */}
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 lg:border-e lg:border-border lg:bg-card/95 lg:backdrop-blur-lg lg:z-50",
          "transition-[width] duration-300 ease-in-out",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
        role="navigation"
        aria-label={t.mainNavigation || "Main navigation"}
      >
        {/* Header — brand + toggle */}
        <div
          className={cn(
            "flex items-center border-b border-border/50 transition-all duration-300 min-h-[60px]",
            collapsed ? "justify-center px-2" : "justify-between px-5"
          )}
        >
          {!collapsed && <span className="text-lg font-bold text-foreground">ZenFlow</span>}
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground transition-colors duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-5 h-5" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="w-5 h-5" aria-hidden="true" />
            )}
          </button>
        </div>

        {/* Main navigation tabs */}
        <div
          className="flex-1 py-3 px-2 space-y-1 overflow-y-auto"
          role="tablist"
          aria-orientation="vertical"
        >
          {mainTabs.map(renderTab)}
        </div>

        {/* Bottom section: Settings only */}
        <div className="border-t border-border/50 py-3 px-2 space-y-1">
          {renderTab(settingsTab)}
        </div>
      </aside>

      {/* Mobile bottom nav — hidden at lg and when keyboard is open */}
      {!keyboardOpen && (
        <nav
          className="fixed bottom-0 inset-x-0 bg-card/80 backdrop-blur-lg border-t border-border z-50 gpu-layer pb-[env(safe-area-inset-bottom,0px)] lg:hidden"
          role="navigation"
          aria-label={t.mainNavigation || "Main navigation"}
        >
          <div className="mx-auto px-4 max-w-[var(--container-max-width)]">
            <div className="flex justify-between py-2" role="tablist">
              {allTabs.map((tab) => (
                <button
                  key={tab.id}
                  onClick={() => {
                    void haptics.tabChanged();
                    onTabChange(tab.id);
                  }}
                  role="tab"
                  aria-selected={activeTab === tab.id}
                  aria-label={tab.label}
                  className={cn(
                    "flex flex-col items-center gap-1 py-2 px-3 flex-1 rounded-xl transition-all duration-200 min-w-0 min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    activeTab === tab.id
                      ? "text-primary"
                      : "text-muted-foreground hover:text-foreground"
                  )}
                >
                  <tab.icon
                    className={cn(
                      "w-6 h-6 transition-colors duration-200",
                      activeTab === tab.id ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <span
                    className={cn(
                      "text-xs truncate max-w-full transition-colors duration-200",
                      activeTab === tab.id ? "text-primary font-medium" : "text-muted-foreground"
                    )}
                  >
                    {tab.label}
                  </span>
                </button>
              ))}
            </div>
          </div>
        </nav>
      )}
    </>
  );
});
