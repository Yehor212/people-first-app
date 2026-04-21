import { useState, useCallback, useMemo, memo, useRef, useEffect } from "react";
import { motion } from "framer-motion";
import { Habit } from "@/types";
import { getToday, cn } from "@/lib/utils";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { Plus, Users, Leaf, CheckCircle } from "lucide-react";
import { Button } from "@/components/ui/button";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { AllHabitsComplete } from "@/components/Celebrations";
import { EmptyState } from "@/components/EmptyState";
import {
  HabitCompletionCelebration,
  DailyProgressBar,
} from "@/components/HabitCompletionCelebration";
import { CompactHabitCard } from "@/components/CompactHabitCard";
import { ContextMenu } from "@/components/desktop/ContextMenu";
import { HoverPreview } from "@/components/desktop/HoverPreview";
import { DragDropZone } from "@/components/desktop/DragDropZone";
import { useInputMethod } from "@/hooks/useInputMethod";
import { HabitCreationForm } from "@/components/HabitCreationForm";
import { hapticTap } from "@/lib/haptics";
import { zenTap } from "@/lib/animationUtils";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { getActiveChallenges } from "@/lib/friendChallenge";
import { useHabitForm, habitCategories } from "@/hooks/useHabitForm";
import { announceSuccess } from "@/lib/a11y";
import { playSuccess, playStreakMilestone, playLevelUp } from "@/lib/audioManager";
import { getHabitStreak } from "./habitStreakUtils";
import { PremiumProgressBar } from "./PremiumProgressBar";

interface HabitTrackerProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
  onUpdateHabit?: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  isPrimaryCTA?: boolean;
  onOpenChallenge?: (habit?: Habit) => void;
}

export const HabitTracker = memo(function HabitTracker({
  habits,
  onToggleHabit,
  onAdjustHabit,
  onAddHabit,
  onUpdateHabit,
  onDeleteHabit,
  isPrimaryCTA = false,
  onOpenChallenge,
}: HabitTrackerProps) {
  const { t } = useLanguage();
  const { isMouse, canHover } = useInputMethod();
  const form = useHabitForm({ onAddHabit, onUpdateHabit });

  // Back handler for inline panels
  useBackHandler(form.showCustomForm, () => form.setShowCustomForm(false));
  useBackHandler(form.isAdding && !form.showCustomForm, () => form.setIsAdding(false));

  // Swipe hint for first-time users
  const [swipeHintSeen] = useState(() => !!storageGetRaw(SK.HABIT_SWIPE_HINT_SEEN));
  const swipeHintTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // List display state
  const [categoryFilter, setCategoryFilter] = useState<Habit["category"] | "all">("all");

  // Celebration states
  const [showAllComplete, setShowAllComplete] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    habitName: string;
    habitIcon: string;
    habitColor: number;
    streakDays?: number;
  } | null>(null);

  // Refs for celebration/debounce timeouts
  const celebrationTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const celebrationHideTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const toggleDebounceRef = useRef<Set<string>>(new Set());
  const debounceTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timeouts on unmount
  useEffect(() => {
    return () => {
      if (swipeHintTimerRef.current) clearTimeout(swipeHintTimerRef.current);
      if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
      if (celebrationHideTimerRef.current) clearTimeout(celebrationHideTimerRef.current);
      if (debounceTimeoutRef.current) clearTimeout(debounceTimeoutRef.current);
    };
  }, []);

  const today = getToday();
  const activeChallengesCount = useMemo(() => getActiveChallenges().length, []);

  // Stable callback for celebration completion (avoids re-creating on every render)
  const handleCelebrationComplete = useCallback(() => setCelebrationData(null), []);

  // Memoized completion status map (entry-based model)
  const completionStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    habits.forEach((habit) => {
      map.set(habit.id, isHabitCompletedOnDate(habit, today));
    });
    return map;
  }, [habits, today]);

  const filteredHabits = useMemo(() => {
    if (categoryFilter === "all") return habits;
    return habits.filter((h) => (h.category || "health") === categoryFilter);
  }, [habits, categoryFilter]);

  // Drag-to-reorder: persist order to localStorage
  const [habitOrder, setHabitOrder] = useState<string[]>(() => {
    const stored = storageGetRaw("habit-order");
    return stored ? (JSON.parse(stored) as string[]) : [];
  });

  const orderedHabits = useMemo(() => {
    if (habitOrder.length === 0) return filteredHabits;
    const orderMap = new Map(habitOrder.map((id, i) => [id, i]));
    return [...filteredHabits].sort((a, b) => {
      const ai = orderMap.get(a.id) ?? Infinity;
      const bi = orderMap.get(b.id) ?? Infinity;
      return ai - bi;
    });
  }, [filteredHabits, habitOrder]);

  const handleReorder = useCallback((newOrder: string[]) => {
    setHabitOrder(newOrder);
    storageSetRaw("habit-order", JSON.stringify(newOrder));
  }, []);

  const isCompletedToday = useCallback(
    (habit: Habit) => {
      return completionStatusMap.get(habit.id) ?? false;
    },
    [completionStatusMap]
  );

  // In Loop model, all non-archived habits are shown — frequency affects scoring, not visibility
  const habitsDueToday = useMemo(() => {
    return habits.filter((h) => !h.isArchived);
  }, [habits]);

  const dueIds = useMemo(() => new Set(habitsDueToday.map((h) => h.id)), [habitsDueToday]);

  const completedTodayCount = useMemo(() => {
    let count = 0;
    completionStatusMap.forEach((isCompleted, id) => {
      if (isCompleted && dueIds.has(id)) count++;
    });
    return count;
  }, [completionStatusMap, dueIds]);

  const habitStreaks = useMemo(() => {
    const streaks = new Map<string, number>();
    habits.forEach((habit) => {
      streaks.set(habit.id, getHabitStreak(habit));
    });
    return streaks;
  }, [habits]);

  // Handle habit toggle with celebrations + debounce
  const handleHabitToggle = useCallback(
    (habit: Habit) => {
      if (toggleDebounceRef.current.has(habit.id)) return;
      toggleDebounceRef.current.add(habit.id);
      debounceTimeoutRef.current = setTimeout(
        () => toggleDebounceRef.current.delete(habit.id),
        500
      );

      const wasCompleted = isCompletedToday(habit);
      onToggleHabit(habit.id, today);

      if (!wasCompleted) {
        const streak = getHabitStreak(habit);

        if ([7, 14, 21, 30, 60, 90, 100, 365].includes(streak)) {
          playStreakMilestone();
        } else {
          playSuccess();
        }

        announceSuccess(`${habit.icon} ${habit.name} ${t.habitCompleted || "completed"}`);

        setCelebrationData({
          habitName: habit.name,
          habitIcon: habit.icon,
          habitColor: habit.color,
          streakDays: streak > 1 ? streak : undefined,
        });

        const otherHabitsCompleted = habits
          .filter((h) => h.id !== habit.id)
          .every((h) => isCompletedToday(h));
        if (otherHabitsCompleted && habits.length > 1) {
          if (celebrationTimerRef.current) clearTimeout(celebrationTimerRef.current);
          celebrationTimerRef.current = setTimeout(() => {
            setShowAllComplete(true);
            playLevelUp();
            if (celebrationHideTimerRef.current) clearTimeout(celebrationHideTimerRef.current);
            celebrationHideTimerRef.current = setTimeout(() => setShowAllComplete(false), 4000);
          }, 1800);
        }
      }
    },
    [habits, onToggleHabit, today, t, isCompletedToday]
  );

  return (
    <div
      className={cn(
        "rounded-2xl p-6 motion-safe:animate-fade-in motion-safe:transition-all relative overflow-hidden",
        isPrimaryCTA
          ? "ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20"
          : "bg-card zen-shadow-card"
      )}
    >
      {/* Nature Energy Background */}
      {isPrimaryCTA && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top,
                hsl(var(--chart-habit) / 0.12) 0%,
                hsl(var(--chart-habit) / 0.08) 30%,
                hsl(var(--card)) 60%)`,
            }}
          />
          <div className="absolute inset-0 pointer-events-none bg-[radial-gradient(circle_at_70%_20%,hsl(var(--chart-habit)/0.1)_0%,transparent_40%)] [animation:nature-energy-glow_4s_ease-in-out_infinite]" />
        </>
      )}

      {/* Daily Progress */}
      {habitsDueToday.length > 0 && isPrimaryCTA ? (
        <PremiumProgressBar
          habitsDueToday={habitsDueToday}
          completionStatusMap={completionStatusMap}
          completedTodayCount={completedTodayCount}
          allDoneLabel={t.allDone || "All done!"}
        />
      ) : (
        habitsDueToday.length > 0 && (
          <DailyProgressBar
            completedCount={completedTodayCount}
            totalCount={habitsDueToday.length}
            className="mb-5 relative"
          />
        )
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <motion.div
          className="relative flex items-center justify-center gap-2 mb-4"
          initial={{ opacity: 0, y: -10 }}
          animate={{ opacity: 1, y: 0 }}
        >
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/25 backdrop-blur-sm rounded-full border border-emerald-500/30">
            <Leaf className="w-4 h-4 text-emerald-700 dark:text-emerald-300" />
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-200">
              {t.startHere}
            </span>
          </div>
        </motion.div>
      )}

      {/* Header Row */}
      <div className="flex items-center justify-between mb-4 relative">
        <h3
          className={cn(
            "font-semibold",
            isPrimaryCTA ? "text-xl text-slate-800 dark:text-white" : "text-lg text-foreground"
          )}
        >
          {t.habits}
        </h3>
        <div className="flex items-center gap-2">
          {onOpenChallenge &&
            (isPrimaryCTA ? (
              <motion.button
                onClick={() => {
                  void hapticTap();
                  onOpenChallenge();
                }}
                aria-label={t.friendChallenges}
                className="relative w-11 h-11 rounded-xl flex items-center justify-center bg-slate-100/60 dark:bg-foreground/10 backdrop-blur-sm border border-slate-200/60 dark:border-foreground/20 text-slate-600 dark:text-foreground/70 hover:text-slate-800 dark:hover:text-foreground hover:bg-slate-200/60 dark:hover:bg-foreground/20 motion-safe:transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={zenTap.button}
              >
                <Users className="w-5 h-5" />
                {activeChallengesCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {activeChallengesCount}
                  </span>
                )}
              </motion.button>
            ) : (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  void hapticTap();
                  onOpenChallenge();
                }}
                aria-label={t.friendChallenges}
                className="relative"
              >
                <Users className="w-5 h-5" />
                {activeChallengesCount > 0 && (
                  <span className="absolute -top-1 -end-1 w-4 h-4 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {activeChallengesCount}
                  </span>
                )}
              </Button>
            ))}
          {isPrimaryCTA ? (
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                form.setIsAdding(!form.isAdding);
              }}
              aria-label={form.isAdding ? t.cancel || "Cancel" : t.addHabit || "Add habit"}
              className={cn(
                "w-11 h-11 rounded-xl flex items-center justify-center motion-safe:transition-all",
                form.isAdding
                  ? "bg-red-500/30 border border-red-500/50 text-red-300"
                  : "bg-gradient-to-br from-emerald-500/60 to-teal-600/60 border border-emerald-500/30 text-white"
              )}
              style={!form.isAdding ? { boxShadow: "0 0 12px hsl(var(--chart-habit) / 0.3)" } : {}}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className={cn("w-5 h-5 motion-safe:transition-transform", form.isAdding && "rotate-45")} />
            </motion.button>
          ) : (
            <Button
              variant={form.isAdding ? "destructive" : "gradient"}
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                form.setIsAdding(!form.isAdding);
              }}
              className={cn(form.isAdding && "rotate-45")}
              aria-label={form.isAdding ? t.cancel || "Cancel" : t.addHabit || "Add habit"}
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {/* Form */}
      <HabitCreationForm form={form} habits={habits} isPrimaryCTA={isPrimaryCTA} />

      {/* Habit List */}
      {habits.length === 0 ? (
        <EmptyState
          icon={<CheckCircle className="w-6 h-6 text-primary" />}
          title={t.habits || "No habits yet"}
          message={t.addFirstHabit}
          highlight
          action={{
            label: t.addHabit || "Add your first habit",
            onClick: () => form.setIsAdding(true),
            icon: <Plus className="w-5 h-5" />,
          }}
        />
      ) : (
        <>
          {habits.length >= 3 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide snap-x snap-mandatory">
              <motion.button
                onClick={() => setCategoryFilter("all")}
                className={cn(
                  "snap-start px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-all min-h-[44px]",
                  categoryFilter === "all"
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {t.all || "All"} ({habits.length})
              </motion.button>
              {habitCategories.map(({ id, icon }) => {
                const count = habits.filter((h) => (h.category || "health") === id).length;
                if (count === 0) return null;
                return (
                  <motion.button
                    key={id}
                    onClick={() => setCategoryFilter(id)}
                    className={cn(
                      "snap-start px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap motion-safe:transition-all flex items-center gap-1 min-h-[44px]",
                      categoryFilter === id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={zenTap.card}
                  >
                    {icon} {count}
                  </motion.button>
                );
              })}
            </div>
          )}

          <div className="@container" role="list" aria-label={t.habits || "Habits"}>
            <DragDropZone
              items={orderedHabits.map((h) => h.id)}
              onReorder={handleReorder}
              enabled={isMouse}
              className="grid gap-2 grid-cols-1 @sm:grid-cols-2 @lg:grid-cols-3 @xl:grid-cols-4 @[80rem]:grid-cols-5"
              renderItem={(id, dragHandleProps) => {
                const habit = orderedHabits.find((h) => h.id === id);
                if (!habit) return null;
                return (
                  // A11Y-OK: HoverPreview+ContextMenu use Radix with built-in aria; CompactHabitCard has its own aria-labels
                  <div {...dragHandleProps}>
                    <HoverPreview
                      enabled={canHover}
                      content={
                        <div className="text-xs space-y-1 min-w-[120px]">
                          <p className="font-medium text-foreground">{habit.name}</p>
                          {(habitStreaks.get(habit.id) || 0) > 0 && (
                            <p className="text-muted-foreground">
                              {t.streak || "Streak"}: {habitStreaks.get(habit.id)}{" "}
                              {t.days || "days"}
                            </p>
                          )}
                          {habit.category && (
                            <p className="text-muted-foreground/70">{habit.category}</p>
                          )}
                        </div>
                      }
                      trigger={
                        <ContextMenu
                          enabled={isMouse}
                          trigger={
                            <CompactHabitCard
                              habit={habit}
                              onToggle={() => handleHabitToggle(habit)}
                              onAdjust={onAdjustHabit}
                              onDelete={(id: string) => {
                                onDeleteHabit(id);
                                void hapticTap();
                              }}
                              onEdit={onUpdateHabit ? form.handleEditHabit : undefined}
                              onChallenge={onOpenChallenge ? (h) => onOpenChallenge(h) : undefined}
                              streak={habitStreaks.get(habit.id) || 0}
                              isDueToday={dueIds.has(habit.id)}
                            />
                          }
                          items={[
                            {
                              label: t.complete || "Complete",
                              action: () => handleHabitToggle(habit),
                            },
                            ...(onUpdateHabit
                              ? [
                                  {
                                    label: t.edit || "Edit",
                                    action: () => form.handleEditHabit(habit),
                                  },
                                ]
                              : []),
                            {
                              label: t.delete || "Delete",
                              action: () => {
                                onDeleteHabit(habit.id);
                                void hapticTap();
                              },
                              destructive: true,
                            },
                          ]}
                        />
                      }
                    />
                  </div>
                );
              }}
            />
          </div>

          {habits.length > 0 && !swipeHintSeen && (
            <motion.p
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 1 }}
              className="text-center text-[10px] text-muted-foreground/60 py-2"
              ref={(el) => {
                if (el && !swipeHintTimerRef.current) {
                  swipeHintTimerRef.current = setTimeout(() => {
                    storageSetRaw(SK.HABIT_SWIPE_HINT_SEEN, "1");
                  }, 8000);
                }
              }}
            >
              <span className="inline-block rtl:rotate-180">←</span>{" "}
              {(t as unknown as Record<string, string>).habitSwipeHint ||
                "Swipe left for more options"}
            </motion.p>
          )}
        </>
      )}

      {/* Celebrations */}
      {celebrationData && (
        <HabitCompletionCelebration
          habitName={celebrationData.habitName}
          habitIcon={celebrationData.habitIcon}
          habitColor={celebrationData.habitColor}
          xpGained={10}
          streakDays={celebrationData.streakDays}
          onComplete={handleCelebrationComplete}
        />
      )}
      {showAllComplete && <AllHabitsComplete onClose={() => setShowAllComplete(false)} />}
    </div>
  );
});
