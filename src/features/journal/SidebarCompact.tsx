import { memo } from "react";
import { PenLine, BarChart3, Settings, Plus, PanelLeftClose, PanelLeftOpen } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { MoodDotStrip } from "./MoodDotStrip";
import type { JournalEntry } from "./types";

interface SidebarCompactProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onOpenEntry: (id: string) => void;
  onNewEntry: () => void;
  onOpenStats: () => void;
  onOpenSettings: () => void;
  onShowList: () => void;
  onToggleSidebar: () => void;
  collapsed: boolean;
}

export const SidebarCompact = memo(function SidebarCompact({
  entries,
  activeEntryId,
  onOpenEntry,
  onNewEntry,
  onOpenStats,
  onOpenSettings,
  onShowList,
  onToggleSidebar,
  collapsed,
}: SidebarCompactProps) {
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const toggleLabel = collapsed
    ? ts.diarySidebarShow || "Show diary panel"
    : ts.diarySidebarHide || "Hide diary panel";

  return (
    <motion.aside
      initial={{ x: isRTL ? 24 : -24, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "w-[72px] flex-shrink-0 flex flex-col h-full bg-card border-border/30 z-30",
        isRTL ? "border-s" : "border-e"
      )}
      data-testid="journal-sidebar-rail"
    >
      <div className="flex flex-col items-center gap-1 border-b border-border/20 px-2 pb-2 pt-3">
        <button
          onClick={onShowList}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={ts.journalTitle || "Diary"}
          aria-label={ts.journalTitle || "Diary"}
        >
          <PenLine className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenStats}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={ts.journalStatsTitle || "Statistics"}
          aria-label={ts.journalStatsTitle || "Statistics"}
        >
          <BarChart3 className="w-4 h-4" />
        </button>
        <button
          onClick={onOpenSettings}
          className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={ts.journalSettings || "Settings"}
          aria-label={ts.settings || "Settings"}
        >
          <Settings className="w-4 h-4" />
        </button>
      </div>

      <MoodDotStrip
        entries={entries}
        activeEntryId={activeEntryId}
        onOpenEntry={onOpenEntry}
      />

      <div className="mt-auto border-t border-border/20 px-2 py-3">
        <div className="flex flex-col items-center gap-1">
          <button
            onClick={onToggleSidebar}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
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

        <div className="mt-2 flex flex-col items-center">
        <button
          onClick={onNewEntry}
          className="p-2 rounded-lg hover:bg-primary/10 text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={ts.journalNewEntry || "New entry"}
          aria-label={ts.journalNewEntry || "New entry"}
        >
          <Plus className="w-5 h-5" />
        </button>
        </div>
      </div>
    </motion.aside>
  );
});
