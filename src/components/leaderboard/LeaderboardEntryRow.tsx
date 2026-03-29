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

export function LeaderboardEntryRow({
  entry,
  index,
  activeTab,
  t,
}: LeaderboardEntryRowProps) {
  const { language } = useLanguage();
  const rankConfig = RANK_CONFIGS[entry.rank as 1 | 2 | 3] as
    | (typeof RANK_CONFIGS)[1]
    | undefined;

  return (
    <motion.div
      initial={{ opacity: 0, x: -20 }}
      animate={{ opacity: 1, x: 0 }}
      exit={{ opacity: 0, x: 20 }}
      transition={{ delay: index * 0.05 }}
      className={cn(
        "flex items-center gap-3 p-3.5 rounded-xl transition-all",
        entry.isCurrentUser && "ring-1 ring-violet-500/40",
      )}
      style={
        rankConfig
          ? {
              background: rankConfig.bg,
              border: `1px solid ${rankConfig.border}`,
              boxShadow: rankConfig.glow,
            }
          : {
              background: entry.isCurrentUser
                ? "rgba(139, 92, 246, 0.1)"
                : "hsl(var(--foreground) / 0.05)",
              border: "1px solid hsl(var(--foreground) / 0.1)",
            }
      }
    >
      {/* Rank */}
      <div
        className="w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm"
        style={
          rankConfig
            ? {
                background: rankConfig.rankBg,
                boxShadow: "0 2px 8px rgba(0, 0, 0, 0.2)",
              }
            : {
                background: "hsl(var(--foreground) / 0.1)",
              }
        }
      >
        <span className={rankConfig ? "text-white" : "text-foreground/60"}>
          {getRankMedal(entry.rank ?? 0) || entry.rank}
        </span>
      </div>

      {/* User info */}
      <div className="flex-1 min-w-0">
        <div className="flex items-center gap-1.5">
          <span
            className={cn(
              "font-medium truncate",
              entry.isCurrentUser
                ? "text-violet-700 dark:text-violet-300"
                : "text-gray-900 dark:text-white",
            )}
          >
            {entry.displayName}
          </span>
          {entry.isCurrentUser && (
            <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300">
              ({t.you || "you"})
            </span>
          )}
          {entry.rank === 1 && <Crown className="w-4 h-4 text-amber-400" />}
        </div>
        {activeTab === "streak" &&
          entry.longestStreak > entry.currentStreak && (
            <span className="text-xs text-foreground/40">
              {t.best || "Best"}: {entry.longestStreak} {t.days || "days"}
            </span>
          )}
      </div>

      {/* Score */}
      <div className="text-end">
        <span
          className={cn(
            "font-bold text-lg",
            rankConfig?.textColor ||
              (entry.isCurrentUser
                ? "text-violet-700 dark:text-violet-300"
                : "text-gray-900 dark:text-white"),
          )}
        >
          {getValue(entry, activeTab).toLocaleString(language)}
        </span>
        <span className="text-xs text-foreground/40 ms-1">
          {getUnit(activeTab, t)}
        </span>
      </div>
    </motion.div>
  );
}
