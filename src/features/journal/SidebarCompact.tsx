import { memo } from "react";
import { BarChart3, PanelLeftClose, PanelLeftOpen, PenLine, Settings, Star } from "lucide-react";
import { motion, useReducedMotion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";

export type DiarySidebarSection = "entry" | "stats" | "favorites" | "settings";

interface SidebarCompactProps {
  activeSection: DiarySidebarSection;
  onOpenStats: () => void;
  onOpenFavorites: () => void;
  onOpenSettings: () => void;
  onShowList: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
  useSharedDiaryWallpaper?: boolean;
}

export const SidebarCompact = memo(function SidebarCompact({
  activeSection,
  onOpenStats,
  onOpenFavorites,
  onOpenSettings,
  onShowList,
  onToggleSidebar,
  collapsed,
  useSharedDiaryWallpaper = false,
}: SidebarCompactProps) {
  const { t, isRTL } = useLanguage();
  const reducedMotion = useReducedMotion();
  const ts = t as unknown as Record<string, string>;
  const toggleLabel = collapsed
    ? ts.diarySidebarShow || "Show diary panel"
    : ts.diarySidebarHide || "Hide diary panel";

  const actionClass = (active: boolean) => cn(
    "flex h-[44px] w-[44px] items-center justify-center rounded-xl border p-0 motion-safe:transition-[background-color,border-color,color,box-shadow,transform] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45 active:scale-[0.98]",
    active
      ? "border-primary/25 bg-primary/[0.14] text-primary shadow-[0_10px_26px_hsl(var(--primary)/0.13)]"
      : "border-transparent text-muted-foreground hover:border-border/35 hover:bg-muted/50 hover:text-foreground"
  );

  return (
    <motion.aside
      initial={reducedMotion ? false : { x: isRTL ? 24 : -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={reducedMotion ? undefined : { type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "z-30 flex h-full w-[72px] flex-shrink-0 flex-col border-border/30 backdrop-blur-xl [-webkit-backdrop-filter:blur(18px)]",
        useSharedDiaryWallpaper ? "journal-light-sidebar-rail" : "bg-card/88",
        isRTL ? "border-s" : "border-e"
      )}
      aria-label={ts.journalTitle || "Diary"}
      data-testid="journal-sidebar-rail"
    >
      <div className="flex flex-col items-center gap-1 border-b border-border/20 px-2 pb-2 pt-3">
        <button
          type="button"
          onClick={onShowList}
          className={actionClass(activeSection === "entry")}
          title={ts.journalTitle || "Diary"}
          aria-label={ts.journalEntry || ts.journalTitle || "Entry"}
          aria-current={activeSection === "entry" ? "page" : undefined}
          data-testid="journal-sidebar-nav-entry"
        >
          <PenLine className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenStats}
          className={actionClass(activeSection === "stats")}
          title={ts.journalStatsTitle || "Statistics"}
          aria-label={ts.statistics || ts.journalStatsTitle || "Statistics"}
          aria-current={activeSection === "stats" ? "page" : undefined}
          data-testid="journal-sidebar-nav-stats"
        >
          <BarChart3 className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenFavorites}
          className={actionClass(activeSection === "favorites")}
          title={ts.journalFavorites || "Favorites"}
          aria-label={ts.journalFavorites || "Favorites"}
          aria-current={activeSection === "favorites" ? "page" : undefined}
          data-testid="journal-sidebar-nav-favorites"
        >
          <Star className="w-4 h-4" aria-hidden="true" />
        </button>
        <button
          type="button"
          onClick={onOpenSettings}
          className={actionClass(activeSection === "settings")}
          title={ts.journalSettings || "Settings"}
          aria-label={ts.settings || "Settings"}
          aria-current={activeSection === "settings" ? "page" : undefined}
          data-testid="journal-sidebar-nav-settings"
        >
          <Settings className="w-4 h-4" aria-hidden="true" />
        </button>
      </div>

      <div className="mt-auto border-t border-border/20 px-2 py-3">
        <div className="flex flex-col items-center gap-1">
          <button
            type="button"
            onClick={onToggleSidebar}
            className={actionClass(false)}
            title={toggleLabel}
            aria-label={toggleLabel}
            aria-expanded={!collapsed}
            aria-controls="journal-sidebar-panel"
            data-testid="journal-sidebar-disclosure"
          >
            {collapsed ? (
              <PanelLeftOpen className="w-4 h-4" aria-hidden="true" />
            ) : (
              <PanelLeftClose className="w-4 h-4" aria-hidden="true" />
            )}
          </button>
        </div>
      </div>
    </motion.aside>
  );
});
