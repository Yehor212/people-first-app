import { memo } from "react";
import { PenLine, BarChart3, Settings, Plus } from "lucide-react";
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
  onExpandSidebar: () => void;
}

export const SidebarCompact = memo(function SidebarCompact({
  entries,
  activeEntryId,
  onOpenEntry,
  onNewEntry,
  onOpenStats,
  onOpenSettings,
  onExpandSidebar,
}: SidebarCompactProps) {
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  return (
    <motion.div
      initial={{ x: isRTL ? 48 : -48, opacity: 0 }}
      animate={{ x: 0, opacity: 1 }}
      exit={{ x: isRTL ? 48 : -48, opacity: 0 }}
      transition={{ type: "spring", stiffness: 400, damping: 30 }}
      className={cn(
        "w-12 flex-shrink-0 flex flex-col h-full bg-card border-border/30 z-30",
        isRTL ? "border-s" : "border-e"
      )}
    >
      {/* Header icons */}
      <div className="flex flex-col items-center gap-1 pt-3 pb-2 border-b border-border/20">
        <button
          onClick={onExpandSidebar}
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

      {/* Mood dot strip */}
      <MoodDotStrip
        entries={entries}
        activeEntryId={activeEntryId}
        onOpenEntry={onOpenEntry}
      />

      {/* Separator + New entry */}
      <div className="border-t border-border/20 flex flex-col items-center py-2">
        <button
          onClick={onNewEntry}
          className="p-2 rounded-lg hover:bg-primary/10 text-primary min-w-[44px] min-h-[44px] flex items-center justify-center"
          title={ts.journalNewEntry || "New entry"}
          aria-label={ts.journalNewEntry || "New entry"}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>
    </motion.div>
  );
});
