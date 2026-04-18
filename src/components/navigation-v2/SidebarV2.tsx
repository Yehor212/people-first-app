import { memo, useMemo } from "react";
import { Sparkles, Repeat, BookOpen, Settings, ChevronsLeft, ChevronsRight } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import { ThemeToggleV2 } from "./ThemeToggleV2";

interface SidebarV2Props {
  activePage: NavV2Page;
  onPageChange: (page: NavV2Page) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
}

/**
 * SidebarV2 — Desktop permanent navigation (hidden below md breakpoint).
 *
 * Two modes:
 *   - Expanded (default): 240-256px, full Fraunces label.
 *   - Rail (collapsed): 72px, icon-only, label visible in tooltip on hover.
 *
 * Paper texture accent, ink rule under active item, serif labels. Skip-to-content
 * link anchors at the top. Keyboard: Ctrl+1..4 is wired globally via Index.tsx.
 */
export const SidebarV2 = memo(function SidebarV2({
  activePage,
  onPageChange,
  collapsed,
  onToggleCollapsed,
}: SidebarV2Props) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  const items = useMemo(
    () => [
      { id: "orb" as NavV2Page, icon: Sparkles, label: tx.navV2Orb || "Orb" },
      { id: "habits" as NavV2Page, icon: Repeat, label: tx.navV2Habits || t.habits || "Habits" },
      { id: "diary" as NavV2Page, icon: BookOpen, label: tx.navV2Diary || t.diary || "Diary" },
    ],
    [tx, t.habits, t.diary],
  );

  const settingsItem = {
    id: "settings" as NavV2Page,
    icon: Settings,
    label: tx.navV2Settings || t.settings || "Settings",
  };

  const renderItem = (
    item: { id: NavV2Page; icon: typeof Sparkles; label: string },
    isFooter = false,
  ) => {
    const isActive = activePage === item.id;
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          void haptics.tabChanged();
          onPageChange(item.id);
        }}
        aria-current={isActive ? "page" : undefined}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
        className={cn(
          "group relative flex items-center gap-3 rounded-xl px-3 py-2.5 min-h-[44px]",
          "font-display text-sm transition-all duration-200",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isActive
            ? "bg-paper-surface text-ink-primary shadow-sm"
            : "text-muted-foreground hover:bg-paper-surface/60 hover:text-foreground",
          collapsed && "justify-center px-2",
          isFooter && "mt-auto",
        )}
      >
        {isActive && !collapsed && (
          <span
            aria-hidden="true"
            className="absolute inset-y-2 left-0 w-0.5 rounded-full bg-primary"
          />
        )}
        <item.icon className="h-5 w-5 shrink-0" aria-hidden="true" />
        {!collapsed && <span className="truncate">{item.label}</span>}
      </button>
    );
  };

  return (
    <aside
      className={cn(
        "hidden md:flex fixed inset-y-0 start-0 z-40 flex-col",
        "border-e border-border/60 bg-card/80 backdrop-blur-lg",
        "[-webkit-backdrop-filter:blur(12px)]",
        "transition-[width] duration-300 ease-out",
        collapsed ? "w-[72px]" : "w-64",
      )}
      role="navigation"
      aria-label={tx.navV2PrimaryNav || tx.mainNavigation || "Primary navigation"}
      data-testid="sidebar-v2"
    >
      {/* Skip link (sighted keyboard users) */}
      <a
        href="#main-content-v2"
        className="sr-only focus:not-sr-only focus:absolute focus:top-2 focus:start-2 focus:z-[100] focus:rounded focus:bg-primary focus:px-3 focus:py-1 focus:text-primary-foreground"
      >
        {tx.skipToContent || "Skip to main content"}
      </a>

      {/* Brand mark — minimal orb glyph */}
      <div
        className={cn(
          "flex items-center gap-2 px-4 py-5 border-b border-border/40",
          collapsed && "justify-center px-2",
        )}
      >
        <span
          aria-hidden="true"
          className="inline-block h-7 w-7 rounded-full bg-gradient-to-br from-primary to-primary/50 shadow-inner"
        />
        {!collapsed && (
          <span className="font-display text-base font-semibold tracking-tight">ZenFlow</span>
        )}
      </div>

      {/* Main items */}
      <nav className="flex flex-col gap-1 p-3" aria-label="pages">
        {items.map((it) => renderItem(it))}
      </nav>

      {/* Footer: theme toggle + settings + collapse toggle */}
      <div className="mt-auto flex flex-col gap-1 p-3 border-t border-border/40">
        <ThemeToggleV2 collapsed={collapsed} />
        {renderItem(settingsItem, true)}
        <button
          type="button"
          onClick={() => {
            void haptics.tabChanged();
            onToggleCollapsed();
          }}
          aria-label={
            collapsed
              ? tx.navV2ExpandSidebar || "Expand sidebar"
              : tx.navV2CollapseSidebar || "Collapse sidebar"
          }
          className={cn(
            "flex items-center gap-2 rounded-lg px-3 py-2 min-h-[44px]",
            "text-muted-foreground hover:text-foreground hover:bg-paper-surface/40",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "transition-colors duration-200",
            collapsed && "justify-center px-2",
          )}
          data-testid="sidebar-v2-collapse-toggle"
        >
          {collapsed ? (
            <ChevronsRight className="h-5 w-5" aria-hidden="true" />
          ) : (
            <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
          )}
          {!collapsed && (
            <span className="text-xs">
              {tx.navV2CollapseSidebar || "Collapse"}
            </span>
          )}
        </button>
      </div>
    </aside>
  );
});
