import { memo, useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
import { Calendar, X } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { springs } from "@/config/animations";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { hapticTap } from "@/lib/haptics";
import { SK } from "@/lib/storageKeys";
import type { JournalEntry } from "./types";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { formatLocalizedCount } from "./journalWordCount";

const DISMISS_KEY = SK.JOURNAL_OTD_DISMISSED;

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
  privateMode?: boolean;
}

/* ── Component ── */
export const OnThisDayCard = memo(function OnThisDayCard({
  entries,
  onOpenEntry,
  onDismiss,
  privateMode = false,
}: OnThisDayCardProps) {
  const { t: rawT, isRTL, language } = useLanguage();
  const t = rawT as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();

  const [dismissed, setDismissed] = useState(() => storageGetRaw(DISMISS_KEY) === todayStr());

  const matches = matchingEntries(entries);
  const entry = matches[0];

  if (!entry || dismissed) return null;

  const years = yearsAgo(entry.date);
  const titleLabel = t.diaryOnThisDay ?? "On This Day";
  const agoLabel = years === 1 ? (t.diaryYearAgo ?? "year ago") : (t.diaryYearsAgo ?? "years ago");
  const moreCount = matches.length - 1;
  const privateEntryLabel = t.journalHubSpacePrivate ?? "Private";
  const anniversaryLabel = privateMode ? privateEntryLabel : `${years} ${agoLabel}`;
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
          aria-disabled={privateMode || undefined}
          aria-label={`${titleLabel} — ${anniversaryLabel}`}
          className={cn(
            "relative bg-card/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]",
            "border border-border/20 rounded-2xl p-4 mb-3",
            privateMode ? "cursor-default" : "cursor-pointer",
            "min-h-[44px]"
          )}
          onClick={() => {
            if (privateMode) return;
            void hapticTap();
            onOpenEntry(entry.id);
          }}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              if (privateMode) return;
              void hapticTap();
              onOpenEntry(entry.id);
            }
          }}
        >
          {/* Header row */}
          <div className="grid grid-cols-[minmax(0,1fr)_44px] items-start gap-2">
            <div className={cn("flex min-w-0 items-start gap-2", isRTL && "flex-row-reverse")}>
              <Calendar className="h-4 w-4 text-muted-foreground shrink-0" />
              <span className="min-w-0 whitespace-normal break-words text-xs font-medium text-muted-foreground">
                {titleLabel} &middot; {anniversaryLabel}
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
                "hover:text-foreground motion-safe:transition-colors"
              )}
            >
              <X className="h-4 w-4" />
            </button>
          </div>

          {/* Entry preview */}
          <div className={cn("flex items-start gap-2 mt-2", isRTL && "flex-row-reverse")}>
            {!privateMode && entry.mood && (
              <DiaryMiniOrb mood={entry.mood} size="micro" className="mt-0.5 scale-[0.58]" />
            )}
            <div className="min-w-0">
              {privateMode ? (
                <p
                  className={cn(
                    "whitespace-normal break-words text-sm font-medium text-foreground",
                    isRTL && "text-right"
                  )}
                >
                  {privateEntryLabel}
                </p>
              ) : null}
              {!privateMode && entry.title && (
                <p
                  className={cn(
                    "whitespace-normal break-words [overflow-wrap:anywhere] text-sm font-medium text-foreground",
                    isRTL && "text-right"
                  )}
                >
                  {entry.title}
                </p>
              )}
              {!privateMode && snippet && (
                <p
                  className={cn(
                    "text-xs text-muted-foreground mt-0.5 line-clamp-2",
                    isRTL && "text-right"
                  )}
                >
                  {snippet}
                </p>
              )}
            </div>
          </div>
          {!privateMode && moreCount > 0 && (
            <p className="mt-2 whitespace-normal break-words text-xs text-muted-foreground/50">
              {formatLocalizedCount(
                moreCount,
                language,
                t,
                "diaryMoreMemoryCount",
                t.diaryMoreMemories ?? "more from this day"
              )}
            </p>
          )}
        </motion.div>
      )}
    </AnimatePresence>
  );
});
