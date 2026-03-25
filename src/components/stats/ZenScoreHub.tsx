/**
 * ZenScoreHub - Central wellness score with animated ring
 * Part of Phase 10 Premium Stats Redesign
 *
 * Displays a 0-100 ZenScore combining mood, habits, focus, and streak data
 */

import { useMemo, useState } from "react";
import { motion, AnimatePresence } from "framer-motion";
import {
  Sparkles,
  TrendingUp,
  TrendingDown,
  ChevronDown,
  ChevronUp,
} from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { ParticleBackground } from "./ParticleBackground";
import { EmojiOrIcon } from "@/components/icons";
import { useCountUp } from "@/hooks/useCountUp";
import { getScoreColor, getScoreLabel, MiniSparkline } from "./ZenScoreUtils";

interface WeeklyDataPoint {
  date: string;
  value: number;
}

interface ZenScoreHubProps {
  /** Average mood score (1-5) */
  moodScore: number;
  /** Habit completion rate (0-100) */
  habitRate: number;
  /** Focus score (0-100) */
  focusScore: number;
  /** Current streak days */
  streakDays: number;
  /** Comparison to last week (-100 to +100) */
  weeklyChange?: number;
  /** Weekly data for sparklines (optional) */
  weeklyData?: {
    mood: WeeklyDataPoint[];
    habits: WeeklyDataPoint[];
    focus: WeeklyDataPoint[];
    streak: WeeklyDataPoint[];
  };
  /** Callback when a ring breakdown item is tapped */
  onRingClick?: (ringId: "mood" | "habits" | "focus") => void;
  /** Optional class name */
  className?: string;
}

export function ZenScoreHub({
  moodScore,
  habitRate,
  focusScore,
  streakDays,
  weeklyChange = 0,
  weeklyData,
  onRingClick,
  className,
}: ZenScoreHubProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);

  // Calculate ZenScore
  const zenScore = useMemo(() => {
    // Normalize mood to 0-100
    const normalizedMood = moodScore > 0 ? ((moodScore - 1) / 4) * 100 : 0;

    // Calculate streak bonus (max 15 points for 7+ day streak)
    const streakBonus = Math.min(streakDays / 7, 1) * 15;

    // Weighted average
    const score =
      normalizedMood * 0.3 + // 30% mood
      habitRate * 0.35 + // 35% habits
      focusScore * 0.2 + // 20% focus
      streakBonus; // 15% streak bonus

    return Math.round(Math.max(0, Math.min(100, score)));
  }, [moodScore, habitRate, focusScore, streakDays]);

  // Animate score count-up (from 0 on mount, between values on change)
  const animatedScore = useCountUp(zenScore, 1500, 0);

  const scoreColor = getScoreColor(zenScore);
  const circumference = 2 * Math.PI * 45; // radius = 45
  const strokeDashoffset = circumference - (zenScore / 100) * circumference;

  // Breakdown items with premium SVG icons and sparklines
  const breakdownItems = [
    {
      label: t.mood || "Mood",
      value: Math.round(((moodScore - 1) / 4) * 100),
      emoji: "😊",
      iconName: "heart",
      color: "text-[hsl(var(--chart-mood))]",
      sparkColor: "hsl(var(--chart-mood))",
      sparkData: weeklyData?.mood.map((d) => d.value) || [],
      ringId: "mood" as const,
    },
    {
      label: t.habits || "Habits",
      value: Math.round(habitRate),
      emoji: "🎯",
      iconName: "target",
      color: "text-[hsl(var(--chart-habit))]",
      sparkColor: "hsl(var(--chart-habit))",
      sparkData: weeklyData?.habits.map((d) => d.value) || [],
      ringId: "habits" as const,
    },
    {
      label: t.focus || "Focus",
      value: Math.round(focusScore),
      emoji: "🧠",
      iconName: "brain",
      color: "text-[hsl(var(--chart-focus))]",
      sparkColor: "hsl(var(--chart-focus))",
      sparkData: weeklyData?.focus.map((d) => d.value) || [],
      ringId: "focus" as const,
    },
    {
      label: t.streak || "Streak",
      value: streakDays,
      emoji: "🔥",
      iconName: "fire",
      color: "text-orange-500",
      sparkColor: "#f97316",
      sparkData: weeklyData?.streak.map((d) => d.value) || [],
      suffix: "d",
      ringId: undefined as undefined,
    },
  ];

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className={cn(
        "relative overflow-hidden rounded-2xl",
        "bg-gradient-to-br from-card via-card to-card/80",
        "border border-border/50",
        "zen-shadow-lg",
        className,
      )}
    >
      {/* Particle background */}
      <ParticleBackground
        count={10}
        color={zenScore >= 61 ? "primary" : zenScore >= 41 ? "gold" : "accent"}
      />

      {/* Gradient overlay */}
      <div
        className="absolute inset-0 opacity-20"
        style={{
          background: `radial-gradient(circle at 50% 30%, ${scoreColor.glow}, transparent 70%)`,
        }}
      />

      {/* Main content — entire card is tappable */}
      <div
        className="relative p-6 cursor-pointer"
        role="button"
        tabIndex={0}
        aria-expanded={isExpanded}
        onClick={() => setIsExpanded(!isExpanded)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setIsExpanded(!isExpanded);
          }
        }}
      >
        {/* Header */}
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Sparkles className={cn("w-5 h-5", scoreColor.class)} />
            <h2 className="text-lg font-bold text-foreground">
              {t.zenScore || "Zen Score"}
            </h2>
          </div>

          {/* Weekly change badge */}
          {weeklyChange !== 0 && (
            <div
              className={cn(
                "flex items-center gap-1 px-2 py-1 rounded-full text-xs font-medium",
                weeklyChange > 0
                  ? "bg-[hsl(var(--mood-good))]/15 text-[hsl(var(--mood-good))]"
                  : "bg-destructive/15 text-destructive",
              )}
            >
              {weeklyChange > 0 ? (
                <TrendingUp className="w-3 h-3 animate-trend-up" />
              ) : (
                <TrendingDown className="w-3 h-3 animate-trend-down" />
              )}
              <span>
                {weeklyChange > 0 ? "+" : ""}
                {weeklyChange}%
              </span>
            </div>
          )}
        </div>

        {/* Score ring */}
        <div className="flex flex-col items-center py-4">
          <div className="relative w-40 h-40 rounded-full overflow-hidden">
            {/* Background ring */}
            <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
              {/* Track */}
              <circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                className="stroke-muted/30"
              />

              {/* Progress arc */}
              <motion.circle
                cx="50"
                cy="50"
                r="45"
                fill="none"
                strokeWidth="8"
                strokeLinecap="round"
                stroke={scoreColor.glow}
                strokeDasharray={circumference}
                initial={{ strokeDashoffset: circumference }}
                animate={{ strokeDashoffset }}
                transition={{ duration: 1.5, ease: "easeOut" }}
                style={{
                  filter: `drop-shadow(0 0 8px ${scoreColor.glow})`,
                }}
              />
            </svg>

            {/* Center content */}
            <div className="absolute inset-0 flex flex-col items-center justify-center">
              <motion.span
                className={cn(
                  "text-5xl font-bold tabular-nums",
                  scoreColor.class,
                )}
                initial={{ scale: 0.5, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.3, duration: 0.5, type: "spring" }}
              >
                {animatedScore}
              </motion.span>
              <span className="text-xs text-muted-foreground mt-1">
                {getScoreLabel(
                  zenScore,
                  t as unknown as Record<string, string>,
                )}
              </span>
            </div>
          </div>
        </div>

        {/* Expand indicator */}
        <div className="flex items-center justify-center py-2 text-muted-foreground">
          {isExpanded ? (
            <ChevronUp className="w-4 h-4" />
          ) : (
            <ChevronDown className="w-4 h-4" />
          )}
        </div>

        {/* Breakdown section */}
        <AnimatePresence>
          {isExpanded && (
            <motion.div
              initial={{ height: 0, opacity: 0 }}
              animate={{ height: "auto", opacity: 1 }}
              exit={{ height: 0, opacity: 0 }}
              transition={{ duration: 0.3 }}
              className="overflow-hidden"
            >
              <div className="grid grid-cols-4 gap-2 pt-4 border-t border-border/50">
                {breakdownItems.map((item, index) => (
                  <motion.div
                    key={item.label}
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.1 }}
                    className={cn(
                      "text-center",
                      item.ringId &&
                        "cursor-pointer active:scale-95 transition-transform",
                    )}
                    onClick={(e) => {
                      if (item.ringId) {
                        e.stopPropagation();
                        onRingClick?.(item.ringId);
                      }
                    }}
                  >
                    <div className="flex justify-center mb-1">
                      <EmojiOrIcon
                        emoji={item.emoji}
                        iconName={item.iconName}
                        size="sm"
                        animated={false}
                      />
                    </div>
                    <p
                      className={cn(
                        "text-lg font-bold tabular-nums",
                        item.color,
                      )}
                    >
                      {item.value}
                      {item.suffix || "%"}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {item.label}
                    </p>
                    {/* Mini sparkline showing weekly trend */}
                    {item.sparkData.length >= 2 && (
                      <div className="flex justify-center mt-1">
                        <MiniSparkline
                          data={item.sparkData}
                          color={item.sparkColor}
                        />
                      </div>
                    )}
                  </motion.div>
                ))}
              </div>
            </motion.div>
          )}
        </AnimatePresence>
      </div>
    </motion.div>
  );
}

export default ZenScoreHub;
