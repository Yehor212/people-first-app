import { memo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { Crown } from "lucide-react";
import {
  getRankMedal,
  type LeaderboardEntry,
  type LeaderboardType,
} from "@/lib/leaderboard";
import { useLanguage } from "@/contexts/LanguageContext";
import { RANK_CONFIGS, getValue, getUnit } from "./types";

interface LeaderboardEntryRowProps {
  entry: LeaderboardEntry;
  index: number;
  activeTab: LeaderboardType;
  t: Record<string, string>;
}

export const LeaderboardEntryRow = memo(function LeaderboardEntryRow({
  entry,
  index,
  activeTab,
  t,
}: LeaderboardEntryRowProps) {
  const { language } = useLanguage();
  const rankConfig = RANK_CONFIGS[entry.rank as 1 | 2 | 3] as
    | (typeof RANK_CONFIGS)[1]
    | undefined;
  const hasBestStreak = activeTab === "streak" && entry.longestStreak > entry.currentStreak;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "grid grid-cols-[2.25rem_minmax(0,1fr)] items-start gap-x-3 gap-y-2 p-3.5 rounded-xl motion-safe:transition-all min-[420px]:grid-cols-[2.25rem_minmax(0,1fr)_auto]",
        entry.isCurrentUser && "ring-1 ring-violet-500/40",
        !rankConfig &&
          (entry.isCurrentUser
            ? "bg-violet-500/10 border border-violet-500/10"
            : "bg-foreground/5 border border-foreground/10"),
      )}
      style={
        rankConfig
          ? {
              background: rankConfig.bg,
              border: `1px solid ${rankConfig.border}`,
              boxShadow: rankConfig.glow,
            }
          : undefined
      }
    >
      {/* Rank badge */}
      <div
        className={cn(
          "w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm",
          !rankConfig && "bg-foreground/10",
        )}
        style={
          rankConfig
            ? {
                background: rankConfig.rankBg,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              }
            : undefined
        }
      >
        <span className={rankConfig ? "text-white" : "text-foreground/60"}>
          {getRankMedal(entry.rank ?? 0) || entry.rank}
        </span>
      </div>

      {/* User info */}
      <div className="min-w-0">
        <div className="flex min-w-0 flex-wrap items-start gap-1.5">
          <span
            className={cn(
              "min-w-0 whitespace-normal [overflow-wrap:anywhere] font-medium leading-snug",
              entry.isCurrentUser
                ? "text-violet-700 dark:text-violet-300"
                : "text-foreground",
            )}
          >
            {entry.displayName}
          </span>
          {entry.rank === 1 && <Crown className="h-4 w-4 shrink-0 text-amber-400" />}
        </div>
      </div>

      {entry.isCurrentUser && (
        <span className="col-span-2 col-start-1 row-start-2 min-w-0 max-w-full justify-self-start whitespace-normal break-words rounded bg-violet-500/20 px-1.5 py-0.5 text-center text-xs leading-tight text-violet-700 min-[420px]:col-span-1 min-[420px]:col-start-2 dark:text-violet-300">
          ({t.you || "you"})
        </span>
      )}

      {hasBestStreak && (
        <span
          className={cn(
            "col-span-2 col-start-1 min-w-0 whitespace-normal break-words text-xs text-foreground/60 min-[420px]:col-span-1 min-[420px]:col-start-2",
            entry.isCurrentUser ? "row-start-3" : "row-start-2",
          )}
        >
          {t.best || "Best"}: <bdi>{entry.longestStreak}</bdi>{" "}
          <span dir="auto" className="[unicode-bidi:isolate]">
            {t.days || "days"}
          </span>
        </span>
      )}

      {/* Score */}
      <div
        className={cn(
          "col-span-2 col-start-1 flex max-w-full min-w-0 flex-wrap items-baseline gap-x-1 gap-y-0 justify-self-start text-start min-[420px]:col-span-1 min-[420px]:col-start-3 min-[420px]:row-start-1 min-[420px]:justify-self-end min-[420px]:text-end",
          entry.isCurrentUser && hasBestStreak
            ? "row-start-4"
            : entry.isCurrentUser || hasBestStreak
              ? "row-start-3"
              : "row-start-2",
        )}
      >
        <span
          dir="auto"
          className={cn(
            "shrink-0 font-bold text-lg [unicode-bidi:isolate]",
            rankConfig?.textColor ||
              (entry.isCurrentUser
                ? "text-violet-700 dark:text-violet-300"
                : "text-foreground"),
          )}
        >
          {getValue(entry, activeTab).toLocaleString(language)}
        </span>
        <span
          dir="auto"
          className="min-w-0 whitespace-normal break-words text-xs text-foreground/60 [unicode-bidi:isolate]"
        >
          {getUnit(activeTab, t)}
        </span>
      </div>
    </motion.div>
  );
});
