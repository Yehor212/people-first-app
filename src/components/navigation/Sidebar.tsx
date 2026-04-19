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
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";

type TabType = "home" | "garden" | "stats" | "achievements" | "settings" | "mindmap";

interface SidebarProps {
  activeTab: TabType;
  onTabChange: (tab: TabType) => void;
  canvasEnabled?: boolean;
  habitHubEnabled?: boolean;
}

export const Sidebar = memo(function Sidebar({
  activeTab,
  onTabChange,
  canvasEnabled,
  habitHubEnabled,
}: SidebarProps) {
  const { t } = useLanguage();
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

  const renderTab = (tab: typeof settingsTab) => {
    const isActive = activeTab === tab.id;

    const buttonContent = (
      <button
        onClick={() => {
          void haptics.tabChanged();
          onTabChange(tab.id);
        }}
        role="tab"
        aria-selected={isActive}
        aria-label={tab.label}
        className={cn(
          "flex items-center w-full rounded-xl motion-safe:transition-all motion-safe:duration-200 min-h-[44px]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          collapsed ? "justify-center px-2 py-3" : "gap-3 px-4 py-3",
          isActive
            ? "bg-primary/10 text-primary"
            : "text-muted-foreground hover:bg-muted hover:text-foreground"
        )}
      >
        <tab.icon
          className={cn(
            "w-5 h-5 shrink-0 motion-safe:transition-colors motion-safe:duration-200",
            isActive ? "text-primary" : "text-muted-foreground"
          )}
          aria-hidden="true"
        />
        {!collapsed && (
          <span
            className={cn(
              "text-sm truncate motion-safe:transition-colors motion-safe:duration-200",
              isActive ? "text-primary font-medium" : "text-muted-foreground"
            )}
          >
            {tab.label}
          </span>
        )}
      </button>
    );

    return (
      <div key={tab.id} className="relative">
        {/* Active tab left accent bar */}
        {isActive && (
          <div className="absolute start-0 top-1/4 h-1/2 w-0.5 rounded-full bg-primary" />
        )}

        {collapsed ? (
          <Tooltip>
            <TooltipTrigger asChild>{buttonContent}</TooltipTrigger>
            <TooltipContent side="right" sideOffset={8}>
              {tab.label}
            </TooltipContent>
          </Tooltip>
        ) : (
          buttonContent
        )}
      </div>
    );
  };

  return (
    <TooltipProvider delayDuration={200}>
      <aside
        className={cn(
          "hidden lg:flex lg:flex-col lg:fixed lg:inset-y-0 lg:start-0 lg:border-e lg:border-border lg:bg-card/95 lg:backdrop-blur-lg lg:z-50",
          "motion-safe:transition-[width] motion-safe:duration-300 ease-in-out",
          collapsed ? "lg:w-16" : "lg:w-64"
        )}
        role="navigation"
        aria-label={t.mainNavigation || "Main navigation"}
      >
        {/* Header - brand + toggle */}
        <div
          className={cn(
            "flex items-center border-b border-border/50 motion-safe:transition-all motion-safe:duration-300 min-h-[60px]",
            collapsed ? "justify-center px-2" : "justify-between px-5"
          )}
        >
          {!collapsed && <span className="text-lg font-bold text-foreground">ZenFlow</span>}
          <button
            onClick={toggleCollapse}
            aria-label={collapsed ? "Expand sidebar" : "Collapse sidebar"}
            className="p-2 rounded-lg text-muted-foreground hover:bg-muted hover:text-foreground motion-safe:transition-colors motion-safe:duration-200 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
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
    </TooltipProvider>
  );
});
