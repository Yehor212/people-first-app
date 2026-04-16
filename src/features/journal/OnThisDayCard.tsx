import { memo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { springs } from "@/config/animations";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { hapticTap } from "@/lib/haptics";
import type { JournalEntry } from "./types";

/* ── Mood → emoji map ── */
const MOOD_STICKER: Record<string, string> = {
  great: "😄",
  good: "🙂",
  okay: "😐",
  bad: "😔",
  terrible: "😢",
};

const DISMISS_KEY = "journal-otd-dismissed";

/* ── Helpers ── */

function todayStr(): string {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}-${String(d.getDate()).padStart(2, "0")}`;
}

function matchingEntries(entries: JournalEntry[]): JournalEntry[] {
  const now = new Date();
  const mm = String(now.getMonth() + 1).padStart(2, "0");
  const dd = String(now.getDate()).padStart(2, "0");
  const suffix = `-${mm}-${dd}`;
  const thisYear = now.getFullYear();

  return entries
    .filter((e) => e.date.endsWith(suffix) && !e.date.startsWith(String(thisYear)))
    .sort((a, b) => b.date.localeCompare(a.date));
}

function yearsAgo(dateStr: string): number {
  return new Date().getFullYear() - parseInt(dateStr.slice(0, 4), 10);
}

function truncate(text: string, max: number): string {
  if (text.length <= max) return text;
  return text.slice(0, max).trimEnd() + "…";
}

/* ── Props ── */
interface OnThisDayCardProps {
  entries: JournalEntry[];
  onOpenEntry: (id: string) => void;
  onDismiss: () => void;
}

/* ── Component ── */
export const OnThisDayCard = memo(function OnThisDayCard({
  entries,
  onOpenEntry,
  onDismiss,
}: OnThisDayCardProps) {
  const { t: rawT, isRTL } = useLanguage();
  const t = rawT as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();

  const [dismissed, setDismissed] = useState(
    () => storageGetRaw(DISMISS_KEY) === todayStr(),
  );

  const matches = matchingEntries(entries);
  const entry = matches[0];

  if (!entry || dismissed) return null;

  const years = yearsAgo(entry.date);
  const titleLabel = t.diaryOnThisDay ?? "On This Day";
  const agoLabel = years === 1
    ? (t.diaryYearAgo ?? "year ago")
    : (t.diaryYearsAgo ?? "years ago");
  const moreCount = matches.length - 1;
  const moodEmoji = entry.mood ? MOOD_STICKER[entry.mood] : undefined;
  const snippet = truncate(entry.content.replace(/<[^>]*>/g, " ").trim(), 60);

  const handleDismiss = () => {
    void hapticTap();
    storageSetRaw(DISMISS_KEY, todayStr());
    setDismissed(true);
    onDismiss();
  };

  return (
    <AnimatePresence>
      {!dismissed && (
        <motion.div
          key="otd-card"
          initial={reducedMotion ? false : { opacity: 0, y: -12, scale: 0.97 }}
          animate={{ opacity: 1, y: 0, scale: 1 }}
          exit={{ opacity: 0, y: -8, transition: { duration: 0.15 } }}
          transition={springs.quick}
          whileTap={reducedMotion ? undefined : { scale: 0.98 }}
          role="button"
          tabIndex={0}
          aria-label={`${titleLabel} — ${years} ${agoLabel}`}
          className={cn(
            "relative bg-card/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]",
            "border border-border/20 rounded-2xl p-4 mb-3 cursor-pointer",
            "min-h-[44px]",
          )}
          onClick={() => { void hapticTap(); onOpenEntry(entry.id); }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") { void hapticTap(); onOpenEntry(entry.id); }
          }}
        >
          {/* Header row */}
          <div className="flex items-center justify-between gap-2">
            <div className={cn("flex items-center gap-2", isRTL && "flex-row-reverse")}>
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="text-xs font-medium text-muted-foreground">
                {titleLabel} &middot; {years} {agoLabel}
              </span>
            </div>

            <button
              type="button"
              aria-label={t.close ?? "Close"}
              onClick={(e) => {
                e.stopPropagation();
                handleDismiss();
              }}
              className={cn(
                "flex items-center justify-center rounded-full",
                "h-[44px] w-[44px] -m-2 text-muted-foreground",
                "hover:text-foreground transition-colors",
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Entry preview */}
          <div className={cn("flex items-start gap-2 mt-2", isRTL && "flex-row-reverse")}>
            {moodEmoji && (
              <span className="text-lg leading-none shrink-0" aria-hidden="true">
                {moodEmoji}
              </span>
            )}
            <div className="min-w-0">
              {entry.title && (
                <p className={cn("text-sm font-medium text-foreground truncate", isRTL && "text-right")}>
                  {truncate(entry.title, 60)}
                </p>
              )}
              {snippet && (
                <p className={cn("text-xs text-muted-foreground mt-0.5 line-clamp-2", isRTL && "text-right")}>
                  {snippet}
                </p>
              )}
            </div>
          </div>
          {moreCount > 0 && (
            <p className="text-[10px] text-muted-foreground/50 mt-2">
              +{moreCount} {t.diaryMoreMemories ?? "more from this day"}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
