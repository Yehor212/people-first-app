/**
 * RingDetailSheet - Ultra-Premium Detail Sheet for RadialDashboard
 *
 * Features:
 * - Glassmorphism with animated gradient backdrop
 * - Animated SVG chart with glow effects
 * - Sparkle particle animations
 * - Personalized recommendations
 * - Smooth spring animations
 */

import { useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { zenTap } from "@/lib/animationUtils";
import { TrendingUp, TrendingDown, Minus, Sparkles, Zap, ChevronRight, X } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { cn, getToday } from "@/lib/utils";
import type { RingDetailSheetProps } from "./types";
import { ringThemes } from "./types";
import { PremiumChart } from "./PremiumChart";
import { SparkleParticles } from "./SparkleParticles";

export function RingDetailSheet({
  open,
  onOpenChange,
  ringType,
  currentValue,
  weeklyData,
  previousAverage,
  onAction,
}: RingDetailSheetProps) {
  const { t } = useLanguage();

  const { modalRef, handleKeyDown } = useModalA11y(open, () => onOpenChange(false));
  const shouldReduceMotion = useReducedMotion();
  useScrollLock(open);

  const theme = ringType ? ringThemes[ringType] : null;

  // Calculate stats with week-over-week trend
  const stats = useMemo(() => {
    if (weeklyData.length === 0) return { trend: 0, weekHigh: 0, weekLow: 0, avg: 0 };

    const values = weeklyData.map((d) => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    // Week-over-week trend: current week avg vs previous week avg
    const trend = previousAverage != null ? Math.round(avg - previousAverage) : 0;

    return {
      trend,
      weekHigh: Math.max(...values),
      weekLow: Math.min(...values),
      avg: Math.round(avg),
    };
  }, [weeklyData, previousAverage]);

  // Personalized recommendation
  const getRecommendation = () => {
    if (!ringType) return "";
    if (ringType === "mood") {
      if (currentValue >= 80)
        return (
          t.ringRecommendationMoodHigh ||
          "You're in a great headspace! Share your positivity with someone today."
        );
      if (currentValue >= 50)
        return (
          t.ringRecommendationMoodMid || "Try a 3-minute gratitude practice to boost your mood."
        );
      return (
        t.ringRecommendationMoodLow ||
        "Be gentle with yourself. A short walk or breathing exercise can help."
      );
    }
    if (ringType === "habits") {
      if (currentValue >= 80)
        return (
          t.ringRecommendationHabitsHigh ||
          "Outstanding consistency! Your routines are building real momentum."
        );
      if (currentValue >= 50)
        return (
          t.ringRecommendationHabitsMid ||
          "You're making progress. Try starting with your favorite habit."
        );
      return (
        t.ringRecommendationHabitsLow ||
        "Small steps count. Just one habit today builds tomorrow's streak."
      );
    }
    if (currentValue >= 80)
      return (
        t.ringRecommendationFocusHigh ||
        "Deep work mastery! Your focused sessions are paying dividends."
      );
    if (currentValue >= 50)
      return t.ringRecommendationFocusMid || "Try a 25-minute Pomodoro session for your next task.";
    return t.ringRecommendationFocusLow || "Start with just 10 focused minutes. You've got this.";
  };

  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  if (!theme || !ringType) return null;

  const Icon = theme.icon;

  if (!open) return null;

  return (
    <>
      <div
        className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in"
        onClick={() => onOpenChange(false)}
        role="button"
        tabIndex={0}
        aria-label={t.close || "Close"}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onOpenChange(false);
          }
        }}
      />
      <div
        ref={modalRef}
        onKeyDown={handleKeyDown}
        role="dialog"
        aria-modal="true"
        className="fixed bottom-0 inset-x-0 z-[60] rounded-t-[2rem] bg-background max-h-[90dvh] overflow-hidden animate-slide-up pb-safe lg:max-w-4xl lg:mx-auto"
      >
        <h2 className="sr-only">{t[ringType] || theme.label}</h2>

        {/* Premium Header with Gradient */}
        <div
          className={cn("relative h-36 overflow-hidden", `bg-gradient-to-br ${theme.bgGradient}`)}
        >
          {/* Sparkle particles */}
          <SparkleParticles color={theme.particleColor} />

          {/* Animated gradient orb */}
          <motion.div
            className={cn(
              "absolute -top-24 -end-24 w-72 h-72 rounded-full blur-3xl",
              `bg-gradient-to-br ${theme.gradient}`
            )}
            animate={
              shouldReduceMotion
                ? {}
                : {
                    scale: [1, 1.15, 1],
                    opacity: [0.25, 0.4, 0.25],
                  }
            }
            transition={shouldReduceMotion ? {} : { duration: 5, repeat: Infinity }}
          />

          {/* Handle bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-foreground/30" />

          {/* Close button */}
          <button
            onClick={() => onOpenChange(false)}
            className="absolute top-3 end-3 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-foreground/20 hover:bg-foreground/30 transition-colors z-10"
            aria-label={t.close || "Close"}
          >
            <X className="w-5 h-5 text-white" aria-hidden="true" />
          </button>

          {/* Header content */}
          <div className="absolute bottom-5 inset-x-6 flex items-end justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3.5 rounded-2xl bg-foreground/20 backdrop-blur-sm"
                style={{ boxShadow: `0 0 40px ${theme.glowColor}` }}
                animate={
                  shouldReduceMotion
                    ? {}
                    : {
                        boxShadow: [
                          `0 0 25px ${theme.glowColor}`,
                          `0 0 50px ${theme.glowColor}`,
                          `0 0 25px ${theme.glowColor}`,
                        ],
                      }
                }
                transition={shouldReduceMotion ? {} : { duration: 2.5, repeat: Infinity }}
              >
                <Icon className="w-7 h-7 text-white" aria-hidden="true" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t[ringType] || theme.label}
                </h2>
                <p className="text-sm text-white/70">{t.last7Days || "Last 7 days"}</p>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: "spring" }}
            >
              <span
                className="text-4xl font-black text-white tabular-nums"
                style={{ textShadow: `0 0 30px ${theme.glowColor}` }}
              >
                {Math.round(currentValue)}%
              </span>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 max-h-[55dvh] overflow-y-auto bg-card pb-[calc(1.25rem+env(safe-area-inset-bottom,0px))]">
          {/* Premium Chart Card */}
          <motion.div
            className="bg-muted/40 rounded-2xl p-5 backdrop-blur-sm"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                {t.weeklyTrend || "Weekly Trend"}
              </h3>
              <div
                className={cn(
                  "flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold",
                  stats.trend > 0
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : stats.trend < 0
                      ? "bg-red-500/15 text-red-600 dark:text-red-400"
                      : "bg-muted text-muted-foreground"
                )}
              >
                {stats.trend > 0 ? (
                  <TrendingUp className="w-3.5 h-3.5" aria-hidden="true" />
                ) : stats.trend < 0 ? (
                  <TrendingDown className="w-3.5 h-3.5" aria-hidden="true" />
                ) : (
                  <Minus className="w-3.5 h-3.5" aria-hidden="true" />
                )}
                <span>
                  {stats.trend > 0 ? "+" : ""}
                  {Math.round(stats.trend)}%
                </span>
              </div>
            </div>
            <div className="flex justify-center">
              <PremiumChart
                data={weeklyData.slice(-7)}
                color={theme.chartColor}
                glowColor={theme.glowColor}
                dayNames={dayNames}
              />
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            className="grid grid-cols-3 gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {[
              {
                label: t.average || "Average",
                value: `${stats.avg}%`,
                emoji: "📊",
              },
              {
                label: t.weekHigh || "Best",
                value: `${Math.round(stats.weekHigh)}%`,
                emoji: "🏆",
              },
              {
                label: t.weekLow || "Low",
                value: `${Math.round(stats.weekLow)}%`,
                emoji: "📉",
              },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="bg-muted/30 rounded-xl p-3.5 text-center backdrop-blur-sm"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.08 }}
              >
                <span className="text-xl">{stat.emoji}</span>
                <p className="text-lg font-bold text-foreground mt-1">{stat.value}</p>
                <p className="text-xs text-muted-foreground font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Day-by-day mini crystals */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm font-semibold text-foreground mb-3">
              {t.dailyBreakdown || "Daily Breakdown"}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {weeklyData.slice(-7).map((day, idx) => {
                const dayOfWeek = new Date(day.date).getDay();
                const isToday = day.date === getToday();
                const intensity = day.value / 100;

                return (
                  <motion.div
                    key={day.date}
                    className={cn(
                      "flex flex-col items-center py-2 rounded-xl transition-all",
                      isToday && "ring-2 ring-primary ring-offset-2 ring-offset-background"
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${theme.chartColor}${Math.round(
                        intensity * 40
                      )
                        .toString(16)
                        .padStart(2, "0")}, transparent)`,
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.35 + idx * 0.05 }}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium mb-1">
                      {dayNames[dayOfWeek]?.slice(0, 2)}
                    </span>
                    <div
                      className="w-6 h-8 rounded-md flex items-center justify-center"
                      style={{
                        background: `linear-gradient(180deg, ${theme.chartColor}, ${theme.chartColor}aa)`,
                        opacity: 0.3 + intensity * 0.7,
                        boxShadow: intensity > 0.6 ? `0 0 8px ${theme.glowColor}` : "none",
                      }}
                    >
                      <span className="text-[10px] font-bold text-white">
                        {Math.round(day.value)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Recommendation Card */}
          <motion.div
            className={cn(
              "relative overflow-hidden rounded-2xl p-4",
              `bg-gradient-to-br ${theme.bgGradient}`,
              "border border-border/40"
            )}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-start gap-3">
              <div className={cn("p-2 rounded-xl", `bg-gradient-to-br ${theme.gradient}`)}>
                <Zap className="w-4 h-4 text-white" aria-hidden="true" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {t.recommendation || "For You"}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getRecommendation()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.button
            className={cn(
              "w-full py-4 px-5 rounded-2xl font-semibold",
              "flex items-center justify-center gap-2",
              `bg-gradient-to-r ${theme.gradient}`,
              "text-white shadow-xl transition-all active:scale-[0.98]"
            )}
            style={{ boxShadow: `0 8px 32px ${theme.glowColor}` }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{
              scale: 1.02,
              boxShadow: `0 12px 40px ${theme.glowColor}`,
            }}
            whileTap={zenTap.card}
            onClick={() => (onAction ? onAction() : onOpenChange(false))}
          >
            <Sparkles className="w-5 h-5" aria-hidden="true" />
            <span>
              {ringType === "mood"
                ? t.logMood || "Log Mood"
                : ringType === "habits"
                  ? t.viewHabits || "View Habits"
                  : t.startFocus || "Start Focus"}
            </span>
            <ChevronRight className="w-5 h-5 rtl:scale-x-[-1]" aria-hidden="true" />
          </motion.button>
        </div>
      </div>
    </>
  );
}

export default RingDetailSheet;
