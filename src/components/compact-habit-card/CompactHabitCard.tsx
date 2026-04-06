/**
 * CompactHabitCard - Premium compact habit card with glassmorphism
 * Part of v1.3.0 UI redesign -> Phase 8 Premium Upgrade
 * Enhanced with Nature Energy theme glow effects and animated fire streaks
 */

import { memo } from "react";
import { Habit } from "@/types";
import { cn, getToday } from "@/lib/utils";
import { isHabitCompletedOnDate, getNumericalValue } from "@/lib/habits";
import { Check, Trash2, Users, Pencil } from "lucide-react";
import { useState, useRef, useMemo, useEffect } from "react";
import { motion, AnimatePresence } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";
import { hapticTap } from "@/lib/haptics";
import { zenTap } from "@/lib/animationUtils";
import { AnimatedFire } from "./AnimatedFire";
import { StreakMilestoneBadge } from "./StreakMilestoneBadge";
import { HabitProgressIndicator } from "./HabitProgressIndicator";

interface CompactHabitCardProps {
  habit: Habit;
  onToggle: (habitId: string, date: string) => void;
  onAdjust?: (habitId: string, date: string, delta: number) => void;
  onDelete: (habitId: string) => void;
  onEdit?: (habit: Habit) => void;
  onChallenge?: (habit: Habit) => void;
  streak?: number;
  isDueToday?: boolean;
  className?: string;
}

export const CompactHabitCard = memo(function CompactHabitCard({
  habit,
  onToggle,
  onAdjust,
  onDelete,
  onEdit,
  onChallenge,
  streak = 0,
  isDueToday = true,
  className,
}: CompactHabitCardProps) {
  const { t } = useLanguage();
  const today = getToday();
  const [isSwiped, setIsSwiped] = useState(false);
  const [showDeleteConfirm, setShowDeleteConfirm] = useState(false);
  const deleteTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartX = useRef(0);

  // Cleanup delete confirmation timer on unmount
  useEffect(() => {
    return () => {
      if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
    };
  }, []);

  const habitType = habit.habitType || "boolean";

  // Calculate completion status and progress (entry-based model)
  const { completed, progress, target } = useMemo(() => {
    const isCompleted = isHabitCompletedOnDate(habit, today);
    if (habitType === "numerical") {
      const current = getNumericalValue(habit, today);
      const tgt = habit.targetValue ?? 1;
      return { completed: isCompleted, progress: current, target: tgt };
    }
    // Boolean
    return { completed: isCompleted, progress: isCompleted ? 1 : 0, target: 1 };
  }, [habit, today, habitType]);

  const progressPercent =
    target > 0 ? Math.min((progress / target) * 100, 100) : completed ? 100 : 0;

  // Calculate fire intensity based on streak
  const fireIntensity = useMemo(() => {
    if (streak >= 100) return 3;
    if (streak >= 30) return 2.5;
    if (streak >= 7) return 2;
    if (streak >= 3) return 1.5;
    return 1;
  }, [streak]);

  // Swipe handling
  const handleTouchStart = (e: React.TouchEvent) => {
    touchStartX.current = e.touches[0].clientX;
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    const diff = touchStartX.current - e.changedTouches[0].clientX;
    if (diff > 50) {
      setIsSwiped(true);
    } else if (diff < -50) {
      setIsSwiped(false);
    }
  };

  const handleToggle = () => {
    void hapticTap();
    onToggle(habit.id, today);
  };

  return (
    <motion.div
      layout
      initial={{ opacity: 0, y: 10 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: -10 }}
      role="listitem"
      aria-label={`${habit.icon} ${habit.name}${completed ? `, ${t.completed || "completed"}` : ""}`}
      className={cn(
        "relative overflow-hidden rounded-2xl group",
        "zen-shadow-card",
        completed && "ring-2 ring-emerald-500/40",
        !isDueToday && "opacity-50",
        className
      )}
      style={
        completed
          ? {
              boxShadow: "0 0 20px rgba(16, 185, 129, 0.15), 0 4px 12px -2px rgba(0, 0, 0, 0.05)",
            }
          : undefined
      }
      onTouchStart={handleTouchStart}
      onTouchEnd={handleTouchEnd}
    >
      {/* Actions (revealed on swipe) */}
      <div
        className={cn(
          "absolute end-0 top-0 bottom-0 flex items-center transition-all duration-200",
          isSwiped ? (onChallenge ? "w-[10.5rem]" : "w-28") : "w-0"
        )}
      >
        {/* Edit button */}
        {onEdit && (
          <button
            onClick={() => {
              void hapticTap();
              if (deleteTimerRef.current) {
                clearTimeout(deleteTimerRef.current);
                deleteTimerRef.current = null;
              }
              setShowDeleteConfirm(false);
              onEdit(habit);
              setIsSwiped(false);
            }}
            className="flex-1 h-full flex items-center justify-center bg-blue-500 text-white active:opacity-80 transition-opacity"
            aria-label={t.edit || "Edit"}
          >
            <Pencil className="w-5 h-5" />
          </button>
        )}
        {/* Challenge button */}
        {onChallenge && (
          <button
            onClick={() => {
              void hapticTap();
              if (deleteTimerRef.current) {
                clearTimeout(deleteTimerRef.current);
                deleteTimerRef.current = null;
              }
              setShowDeleteConfirm(false);
              onChallenge(habit);
              setIsSwiped(false);
            }}
            className="flex-1 h-full flex items-center justify-center bg-primary text-white active:opacity-80 transition-opacity"
            aria-label={t.createChallenge}
          >
            <Users className="w-5 h-5" />
          </button>
        )}
        {/* Delete button -- two-tap confirmation */}
        <button
          onClick={() => {
            if (showDeleteConfirm) {
              onDelete(habit.id);
              setIsSwiped(false);
              setShowDeleteConfirm(false);
              if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
            } else {
              void hapticTap();
              setShowDeleteConfirm(true);
              deleteTimerRef.current = setTimeout(() => setShowDeleteConfirm(false), 3000);
            }
          }}
          className={cn(
            "flex-1 h-full flex items-center justify-center text-white active:opacity-80 transition-all",
            showDeleteConfirm ? "bg-red-600 animate-pulse" : "bg-destructive"
          )}
          aria-label={t.delete}
        >
          {showDeleteConfirm ? (
            <span className="text-xs font-bold">
              {(t as unknown as Record<string, string>).confirmDelete || "Delete?"}
            </span>
          ) : (
            <Trash2 className="w-5 h-5" />
          )}
        </button>
      </div>

      {/* Premium completion glow effect */}
      <AnimatePresence>
        {completed && (
          <motion.div
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            className="absolute inset-0 pointer-events-none z-0"
          >
            {/* Main gradient glow */}
            <div className="absolute inset-0 bg-[linear-gradient(135deg,rgba(16,185,129,0.12)_0%,rgba(20,184,166,0.08)_50%,transparent_100%)]" />
            {/* Shimmer effect — CSS keyframe (QA_PROTOCOLS #5, motion-safe) */}
            <div className="absolute inset-0 motion-safe:animate-[habit-shimmer_2s_linear_3s_infinite] bg-[linear-gradient(90deg,transparent_0%,rgba(255,255,255,0.05)_50%,transparent_100%)]" />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Main card */}
      <div
        className={cn(
          "relative flex items-center justify-between p-4",
          "bg-card/80 backdrop-blur-sm rounded-2xl",
          "border border-border/50 transition-all duration-300",
          isSwiped &&
            (onChallenge
              ? "ltr:-translate-x-[10.5rem] rtl:translate-x-[10.5rem]"
              : "ltr:-translate-x-28 rtl:translate-x-28"),
          completed && "bg-[hsl(var(--mood-good))]/5 border-[hsl(var(--mood-good))]/20"
        )}
      >
        {/* Left: Icon + Info */}
        <div className="flex items-center gap-3 flex-1 min-w-0">
          {/* Habit Icon Button - Premium styling */}
          <motion.button
            onClick={handleToggle}
            aria-label={`${habit.name}: ${completed ? t.completed || "Completed" : t.markComplete || "Mark complete"}`}
            aria-pressed={completed}
            className={cn(
              "relative w-14 h-14 rounded-xl flex items-center justify-center text-2xl shrink-0",
              "transition-all duration-300",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              completed
                ? "bg-gradient-to-br from-emerald-500 to-teal-500 text-white"
                : "bg-muted/50 hover:bg-muted/80"
            )}
            style={
              completed
                ? {
                    boxShadow: "0 0 20px rgba(16, 185, 129, 0.4), 0 4px 8px rgba(0, 0, 0, 0.1)",
                  }
                : undefined
            }
            whileHover={{ scale: completed ? 1.05 : 1.02 }}
            whileTap={zenTap.button}
          >
            {/* Inner glow for completed — CSS keyframe (QA_PROTOCOLS #5, motion-safe) */}
            {completed && (
              <div className="absolute inset-0 rounded-xl motion-safe:animate-[habit-glow-pulse_2s_ease-in-out_infinite] bg-[radial-gradient(circle_at_center,rgba(255,255,255,0.2)_0%,transparent_70%)]" />
            )}
            {completed ? (
              <motion.div
                initial={{ scale: 0, rotate: -180 }}
                animate={{ scale: 1, rotate: 0 }}
                transition={{ type: "spring", stiffness: 300, damping: 20 }}
                className="relative z-10"
              >
                <Check className="w-7 h-7" strokeWidth={3} />
              </motion.div>
            ) : (
              <span>{habit.icon}</span>
            )}
          </motion.button>

          {/* Name + Streak - Premium styling */}
          <div className="flex flex-col min-w-0">
            <p
              className={cn(
                "font-semibold text-base truncate transition-colors duration-300",
                completed ? "text-emerald-600 dark:text-emerald-400" : "text-foreground"
              )}
              title={habit.name}
            >
              {habit.name}
            </p>
            {!isDueToday && (
              <span className="text-[10px] text-muted-foreground/60 italic">
                {(t as unknown as Record<string, string>).habitRestDay || "Rest day"}
              </span>
            )}
            {streak >= 1 && (
              <motion.div
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
                className="flex items-center gap-2 mt-0.5"
              >
                <div className="flex items-center gap-1">
                  <AnimatedFire intensity={fireIntensity} size="sm" />
                  <span
                    className={cn(
                      "text-xs font-bold",
                      streak >= 100
                        ? "text-amber-500"
                        : streak >= 30
                          ? "text-violet-500"
                          : streak >= 7
                            ? "text-emerald-500"
                            : "text-orange-500"
                    )}
                  >
                    {streak}
                  </span>
                  <span className="text-xs text-muted-foreground">{t.dayStreak || t.days}</span>
                </div>
                <StreakMilestoneBadge streak={streak} />
              </motion.div>
            )}
          </div>
        </div>

        {/* Right: Progress indicator */}
        <HabitProgressIndicator
          habitType={habitType}
          progress={progress}
          target={target}
          progressPercent={progressPercent}
          completed={completed}
          habitId={habit.id}
          today={today}
          onAdjust={onAdjust}
          t={t as unknown as Record<string, string>}
        />

        {/* Desktop hover actions (hidden on touch) */}
        <div className="hidden md:flex items-center gap-1 opacity-0 group-hover:opacity-100 transition-opacity absolute end-16 top-1/2 -translate-y-1/2 z-[2]">
          {onEdit && (
            <button
              onClick={() => onEdit(habit)}
              className="p-2 rounded-lg hover:bg-muted/80 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={t.edit || "Edit"}
            >
              <Pencil className="w-3.5 h-3.5" />
            </button>
          )}
          <button
            onClick={() => {
              if (showDeleteConfirm) {
                onDelete(habit.id);
                setShowDeleteConfirm(false);
                if (deleteTimerRef.current) clearTimeout(deleteTimerRef.current);
              } else {
                void hapticTap();
                setShowDeleteConfirm(true);
                deleteTimerRef.current = setTimeout(() => setShowDeleteConfirm(false), 3000);
              }
            }}
            className={cn(
              "p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center transition-colors",
              showDeleteConfirm
                ? "bg-destructive/15 text-destructive"
                : "hover:bg-destructive/10 text-muted-foreground hover:text-destructive"
            )}
            aria-label={t.delete || "Delete"}
          >
            <Trash2 className="w-3.5 h-3.5" />
          </button>
        </div>
      </div>
    </motion.div>
  );
});
