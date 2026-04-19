import { memo, useMemo } from "react";
import { Sparkles, Repeat, BookOpen, Settings } from "lucide-react";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { useLanguage } from "@/contexts/LanguageContext";
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
 * Paper-surface active state + ink accent.
 */
export const MobileNavV2 = memo(function MobileNavV2({
  activePage,
  onPageChange,
  hidden = false,
}: MobileNavV2Props) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;

  const tabs = useMemo(
    () => [
      { id: "orb" as NavV2Page, icon: Sparkles, label: tx.navV2Orb || "Orb" },
      { id: "habits" as NavV2Page, icon: Repeat, label: tx.navV2Habits || t.habits || "Habits" },
      { id: "diary" as NavV2Page, icon: BookOpen, label: tx.navV2Diary || t.diary || "Diary" },
      {
        id: "settings" as NavV2Page,
        icon: Settings,
        label: tx.navV2Settings || t.settings || "Settings",
      },
    ],
    [tx, t.habits, t.diary, t.settings],
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
                  ? "bg-paper-surface text-ink-primary"
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
