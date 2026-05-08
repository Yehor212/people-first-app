import { memo, useMemo } from "react";
import { type LucideIcon } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
import { V2_NAV_ICONS } from "@/lib/v2IconSystem";
import type { NavV2Page } from "@/hooks/useNavigationV2";

interface MobileNavV2Props {
  activePage: NavV2Page;
  onPageChange: (page: NavV2Page) => void;
  /** Hide when on-screen keyboard is open (caller decides). Defaults to visible. */
  hidden?: boolean;
}

/**
 * MobileNavV2 — bottom floating-pill tab bar for <md viewports.
 *
 * Four tabs: Orb / Habits / Diary / Settings.
 * 44×44 minimum touch targets, safe-area padding, haptic tap on change.
 * Theme-semantic active state + accent color.
 */
export const MobileNavV2 = memo(function MobileNavV2({
  activePage,
  onPageChange,
  hidden = false,
}: MobileNavV2Props) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  const tabs = useMemo(
    (): Array<{ id: NavV2Page; icon: LucideIcon; label: string }> => [
      { id: "orb", icon: V2_NAV_ICONS.orb, label: tx.navV2Orb || "Mood" },
      { id: "habits", icon: V2_NAV_ICONS.habits, label: tx.navV2Habits || t.habits || "Habits" },
      { id: "diary", icon: V2_NAV_ICONS.diary, label: tx.navV2Diary || t.diary || "Diary" },
      {
        id: "settings",
        icon: V2_NAV_ICONS.settings,
        label: tx.navV2Settings,
      },
    ],
    [tx, t.habits, t.diary],
  );

  if (hidden) return null;

  return (
    <nav
      role="navigation"
      aria-label={tx.navV2PrimaryNav || tx.mainNavigation || "Primary navigation"}
      data-testid="mobile-nav-v2"
      className={cn(
        "md:hidden fixed inset-x-3 z-50",
        "bottom-[calc(env(safe-area-inset-bottom)+0.5rem)]",
        "rounded-2xl border border-border/60 bg-card/80",
        "backdrop-blur-xl [-webkit-backdrop-filter:blur(16px)]",
        "shadow-lg gpu-layer",
      )}
    >
      <div className="flex items-stretch justify-between px-1 py-1" role="tablist">
        {tabs.map((tab) => {
          const isActive = activePage === tab.id;
          return (
            <button
              key={tab.id}
              type="button"
              role="tab"
              aria-selected={isActive}
              aria-current={isActive ? "page" : undefined}
              aria-label={tab.label}
              onClick={() => {
                void haptics.tabChanged();
                onPageChange(tab.id);
              }}
              className={cn(
                "flex flex-1 flex-col items-center justify-center gap-0.5 min-w-0",
                "rounded-xl px-2 py-2 min-h-[48px]",
                "motion-safe:transition-all motion-safe:duration-200",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1",
                isActive
                  ? "bg-[hsl(var(--nav-v2-item-surface))] text-[hsl(var(--primary))]"
                  : "text-muted-foreground active:text-foreground",
              )}
              data-testid={`mobile-nav-v2-tab-${tab.id}`}
            >
              <tab.icon className="h-5 w-5" aria-hidden="true" />
              <span
                className={cn(
                  "font-display text-[10px] leading-none truncate max-w-full",
                  isActive ? "font-semibold" : "font-normal",
                )}
              >
                {tab.label}
              </span>
            </button>
          );
        })}
      </div>
    </nav>
  );
});
