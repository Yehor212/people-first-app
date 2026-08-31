import { memo, useEffect, useMemo, useState } from "react";
import { ChevronsLeft, ChevronsRight, type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getNavVisualRole, getRoleTone } from "@/lib/nonOrbVisualRoles";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import { useLanguage } from "@/contexts/LanguageContext";
import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import { ThemeToggleV2 } from "./ThemeToggleV2";
import { BackgroundMusicToggle } from "./BackgroundMusicToggle";

interface SidebarV2Props {
  activePage: NavV2Page;
  onPageChange: (page: NavV2Page) => void;
  collapsed: boolean;
  onToggleCollapsed: () => void;
  forceVisible?: boolean;
  collapseLocked?: boolean;
}

/**
 * SidebarV2 — Desktop permanent navigation (hidden below md breakpoint).
 *
 * Two modes:
 *   - Expanded (default): 240-256px, full Fraunces label.
 *   - Rail (collapsed): 72px, icon-only, label visible in tooltip on hover.
 *
 * Paper texture accent, ink rule under active item, serif labels. Skip-to-content
 * link anchors at the top. Keyboard: Ctrl+1..5 is wired globally via Index.tsx.
 */
export const SidebarV2 = memo(function SidebarV2({
  activePage,
  onPageChange,
  collapsed,
  onToggleCollapsed,
  forceVisible = false,
  collapseLocked = false,
}: SidebarV2Props) {
  const { t, isRTL } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const [optimisticPage, setOptimisticPage] = useState<NavV2Page | null>(null);
  const selectedPage = optimisticPage ?? activePage;

  useEffect(() => {
    setOptimisticPage(null);
  }, [activePage]);

  const items = useMemo(
    (): Array<{ id: NavV2Page; icon: LucideIcon; label: string }> => [
      { id: "orb", icon: V2_NAV_ICONS.orb, label: tx.navV2Orb || "Mood" },
      { id: "habits", icon: V2_NAV_ICONS.habits, label: tx.navV2Habits || t.habits || "Habits" },
      { id: "diary", icon: V2_NAV_ICONS.diary, label: tx.navV2Diary || t.diary || "Diary" },
      { id: "planning", icon: V2_NAV_ICONS.planning, label: tx.navV2Planning },
    ],
    [tx, t.habits, t.diary]
  );

  const settingsItem = {
    id: "settings" as NavV2Page,
    icon: V2_NAV_ICONS.settings,
    label: tx.navV2Settings,
  };

  const renderItem = (
    item: { id: NavV2Page; icon: LucideIcon; label: string },
    isFooter = false
  ) => {
    const isActive = selectedPage === item.id;
    const visualRole = getNavVisualRole(item.id);
    const tone = getRoleTone(visualRole);
    return (
      <button
        key={item.id}
        type="button"
        onClick={() => {
          setOptimisticPage(item.id);
          void haptics.tabChanged();
          onPageChange(item.id);
        }}
        aria-current={isActive ? "page" : undefined}
        aria-label={item.label}
        title={collapsed ? item.label : undefined}
        data-nav-button="sidebar"
        data-visual-role={visualRole}
        className={cn(
          "group relative flex items-center gap-3 rounded-[8px] px-3 py-2.5 min-h-[44px]",
          "font-display text-sm shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.36)] motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out",
          "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
          isActive
            ? tone.activeSurfaceClass +
                " text-foreground shadow-[0_12px_28px_-20px_hsl(var(--nav-v2-shadow)/0.48)]"
            : "text-muted-foreground hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)] hover:text-foreground " +
                tone.borderClass,
          collapsed && "justify-center px-2",
          isFooter && "mt-auto"
        )}
      >
        {isActive && !collapsed && (
          <span
            aria-hidden="true"
            className={"absolute inset-y-2 start-0 w-0.5 rounded-e-full " + tone.railClass}
          />
        )}
        <span
          className={cn(
            "flex h-9 w-9 shrink-0 items-center justify-center rounded-[8px] ring-1",
            isActive ? tone.iconClass + " " + tone.ringClass : "bg-muted/45 ring-border/40"
          )}
          aria-hidden="true"
        >
          <item.icon className="h-5 w-5" />
        </span>
        {!collapsed && (
          <span className="min-w-0 flex-1 whitespace-normal break-words text-start leading-snug [hyphens:auto] [overflow-wrap:break-word]">
            {item.label}
          </span>
        )}
      </button>
    );
  };

  return (
    <nav
      role="navigation"
      className={cn(
        forceVisible ? "flex" : "hidden md:flex",
        "zf-sidebar-adaptive-surface fixed inset-y-0 start-0 z-40 flex-col overflow-y-hidden overflow-x-hidden overscroll-y-contain",
        "border-e border-border/60 bg-card/80 backdrop-blur-lg",
        "[-webkit-backdrop-filter:blur(12px)]",
        "motion-safe:transition-[width] motion-safe:duration-300 ease-out",
        collapsed ? "w-[72px]" : "w-64"
      )}
      aria-label={tx.navV2PrimaryNav || tx.mainNavigation || "Primary navigation"}
      data-testid="sidebar-v2"
    >
      {/* Skip link (sighted keyboard users) */}
      <a
        href="#main-content-v2"
        data-testid="sidebar-v2-skip-link"
        className="sr-only focus:not-sr-only focus:absolute focus:top-3 focus:start-3 focus:z-[100] focus:flex focus:min-h-[44px] focus:items-center focus:rounded-lg focus:bg-primary focus:px-4 focus:py-2 focus:text-primary-foreground focus:shadow-lg"
      >
        {tx.skipToContent || "Skip to main content"}
      </a>

      {/* Brand mark — minimal orb glyph */}
      <div
        className={cn(
          "flex shrink-0 items-center gap-2 px-4 py-5 border-b border-border/40",
          collapsed && "justify-center px-2"
        )}
      >
        <span
          aria-hidden="true"
          data-testid="sidebar-v2-brand-orb"
          className="inline-flex h-10 w-10 shrink-0 items-center justify-center"
        >
          <MiniValenceOrb
            valence={0}
            hasEntry={false}
            size="sm"
            chrome="badge"
            containerClassName="shadow-[0_0_24px_hsl(var(--primary)/0.14)]"
          />
        </span>
        {!collapsed && (
          <span className="font-display text-base font-semibold tracking-tight">ZenFlow</span>
        )}
      </div>

      {/* Main items */}
      <div
        className="min-h-0 flex flex-1 flex-col gap-1 overflow-y-auto overscroll-y-contain p-3"
        data-testid="sidebar-v2-destinations"
      >
        {items.map((it) => renderItem(it))}
      </div>

      {/* Footer: theme toggle + settings + collapse toggle */}
      <div
        className="mt-auto flex shrink-0 flex-col gap-1 p-3 border-t border-border/40"
        data-testid="sidebar-v2-footer"
      >
        <ThemeToggleV2 collapsed={collapsed} />
        <BackgroundMusicToggle
          presentation={collapsed ? "sidebar-collapsed" : "sidebar-expanded"}
        />
        {renderItem(settingsItem, true)}
        {!collapseLocked && (
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
              "text-muted-foreground hover:text-foreground hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              "motion-safe:transition-[transform,background-color,color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px]",
              collapsed && "justify-center px-2"
            )}
            data-testid="sidebar-v2-collapse-toggle"
          >
            {collapsed ? (
              isRTL ? (
                <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
              ) : (
                <ChevronsRight className="h-5 w-5" aria-hidden="true" />
              )
            ) : isRTL ? (
              <ChevronsRight className="h-5 w-5" aria-hidden="true" />
            ) : (
              <ChevronsLeft className="h-5 w-5" aria-hidden="true" />
            )}
            {!collapsed && <span className="text-xs">{tx.navV2CollapseSidebar || "Collapse"}</span>}
          </button>
        )}
      </div>
    </nav>
  );
});
