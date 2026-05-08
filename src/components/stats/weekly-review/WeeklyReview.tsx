/**
 * WeeklyReview - Ultra-Premium Weekly Summary Component
 *
 * Features:
 * - Glassmorphism with animated cosmic gradients
 * - Week-over-week comparison with trend indicators
 * - Top 3 achievements highlight
 * - Personalized recommendations
 * - Animated progress rings and sparkles
 */

import { useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Target,
  Brain,
  Heart,
  ChevronDown,
  ChevronUp,
  Zap,
  Star,
  Crown,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatDecimal } from "@/lib/timeUtils";
import type { WeeklyReviewProps } from "./types";
import { useWeeklyStats } from "./useWeeklyStats";
import { SparkleParticle, MiniRing, AchievementBadge } from "./WeeklyReviewParts";

export function WeeklyReview({
  habits,
  moods,
  focusSessions,
  currentStreak,
  className,
}: WeeklyReviewProps) {
  const { t, language } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  const { weekScore, thisWeekStats, changes, achievements, getRecommendation, bestDayName } =
    useWeeklyStats({
      habits,
      moods,
      focusSessions,
      currentStreak,
      t: t as unknown as Record<string, string>,
    });

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        "relative overflow-hidden rounded-3xl",
        "bg-gradient-to-br from-card via-card to-card/90",
        "border border-border/50",
        "shadow-xl",
        className
      )}
    >
      {/* Animated cosmic background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -end-1/2 w-full h-full rounded-full bg-[radial-gradient(circle,rgba(139,92,246,0.15)_0%,transparent_70%)]"
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1/2 -start-1/2 w-full h-full rounded-full bg-[radial-gradient(circle,rgba(16,185,129,0.1)_0%,transparent_60%)]"
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />

        {/* Sparkle particles */}
        {[0, 0.5, 1, 1.5, 2].map((delay, i) => (
          <SparkleParticle key={i} delay={delay} color={i % 2 === 0 ? "#8b5cf6" : "#10b981"} />
        ))}
      </div>

      {/* Header */}
      <div className="relative p-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 rounded-xl bg-gradient-to-br from-primary/30 to-primary/20 backdrop-blur-sm shadow-zen-md"
              animate={{
                opacity: [0.8, 1, 0.8],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Crown className="w-5 h-5 text-violet-400" />
            </motion.div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t.weeklyReview || "Weekly Review"}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t.thisWeekSummary || "Your week at a glance"}
              </p>
            </div>
          </div>

          {/* Week score */}
          <motion.div
            className="relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: "spring" }}
          >
            <MiniRing value={weekScore} color="#8b5cf6" size={56} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">{weekScore}</span>
            </div>
          </motion.div>
        </div>

        {/* Achievement badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {achievements.map((achievement, i) => (
            <AchievementBadge key={achievement.title} {...achievement} delay={0.3 + i * 0.1} />
          ))}
        </div>

        {/* Week comparison stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: t.habits || "Habits",
              value: `${thisWeekStats.habitRate}%`,
              change: changes.habitRate,
              icon: Target,
              color: "#10b981",
            },
            {
              label: t.focus || "Focus",
              value: `${thisWeekStats.focusMinutes}m`,
              change: changes.focusMinutes,
              icon: Brain,
              color: "#8b5cf6",
            },
            {
              label: t.mood || "Mood",
              value: formatDecimal(thisWeekStats.moodAvg, language),
              change: changes.moodAvg,
              icon: Heart,
              color: "#f43f5e",
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-3 rounded-xl bg-muted/30 backdrop-blur-sm"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{stat.value}</span>
                <div
                  className={cn(
                    "flex items-center gap-0.5 text-[10px] font-medium",
                    stat.change > 0
                      ? "text-emerald-500"
                      : stat.change < 0
                        ? "text-red-500"
                        : "text-muted-foreground"
                  )}
                >
                  {stat.change > 0 ? (
                    <TrendingUp className="w-3 h-3" />
                  ) : stat.change < 0 ? (
                    <TrendingDown className="w-3 h-3" />
                  ) : (
                    <Minus className="w-3 h-3" />
                  )}
                  {stat.change > 0 ? "+" : ""}
                  {typeof stat.change === "number" && stat.label === t.mood
                    ? formatDecimal(stat.change, language)
                    : Math.round(stat.change)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 mt-4 py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? t.showLess || "Show less" : t.viewDetails || "View details"}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" aria-hidden="true" /> : <ChevronDown className="w-4 h-4" aria-hidden="true" />}
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: "auto", opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
              {/* Best day highlight */}
              {bestDayName && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20"
                >
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t.bestDayWas || "Best day was"}{" "}
                      <span className="text-amber-500">{bestDayName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.bestDayDesc || "You achieved the most on this day"}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Perfect days */}
              {thisWeekStats.perfectDays > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-emerald-500">{thisWeekStats.perfectDays}</span>{" "}
                      {t.perfectDays || "perfect days"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.perfectDaysDesc || "All habits + 30min focus"}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Recommendation */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20">
                    <Zap className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t.forNextWeek || "For next week"}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getRecommendation()}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default WeeklyReview;
