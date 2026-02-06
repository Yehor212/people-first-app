import { useState, useCallback, useMemo, memo, useRef } from 'react';
import { motion } from 'framer-motion';
import { Habit, HabitType, HabitReminder, HabitFrequency, HabitCategory } from '@/types';
import { getToday, generateId, formatDate, cn, parseLocalDate } from '@/lib/utils';
import { safeParseInt } from '@/lib/validation';
import { Plus, X, ChevronRight, Settings2, Zap, Users, Sparkles, Leaf, Undo2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitTemplates } from '@/lib/habitTemplates';
import { AllHabitsComplete } from './Celebrations';
import { HabitCompletionCelebration, DailyProgressBar } from './HabitCompletionCelebration';
import { CompactHabitCard } from './CompactHabitCard';
import { hapticTap } from '@/lib/haptics';
import { getActiveChallenges } from '@/lib/friendChallenge';
import { toast } from '@/hooks/use-toast';
import { ToastAction } from '@/components/ui/toast';
import { announceSuccess } from '@/lib/a11y';

const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎵', '🌿', '🚭', '🍷', '🇬🇧', '💪', '🧠'];
const habitColors = [
  'bg-primary',
  'bg-accent',
  'bg-mood-good',
  'bg-mood-okay',
  'bg-mood-great',
];

// Category definitions with icons
const habitCategories: { id: HabitCategory; icon: string; color: string }[] = [
  { id: 'health', icon: '💪', color: 'from-emerald-500 to-teal-500' },
  { id: 'mindfulness', icon: '🧘', color: 'from-violet-500 to-purple-500' },
  { id: 'productivity', icon: '🚀', color: 'from-blue-500 to-cyan-500' },
  { id: 'social', icon: '👥', color: 'from-pink-500 to-rose-500' },
  { id: 'creativity', icon: '🎨', color: 'from-amber-500 to-orange-500' },
  { id: 'finance', icon: '💰', color: 'from-green-500 to-emerald-500' },
  { id: 'self-care', icon: '🌸', color: 'from-fuchsia-500 to-pink-500' },
  { id: 'other', icon: '✨', color: 'from-slate-500 to-gray-500' },
];

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

export const HabitTracker = memo(function HabitTracker({ habits, onToggleHabit, onAdjustHabit, onAddHabit, onUpdateHabit, onDeleteHabit, isPrimaryCTA = false, onOpenChallenge }: HabitTrackerProps) {
  const { t, language } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [editingHabit, setEditingHabit] = useState<Habit | null>(null);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  const [selectedType, setSelectedType] = useState<HabitType>('daily');
  const [selectedCategory, setSelectedCategory] = useState<HabitCategory>('health');
  const [dailyTarget, setDailyTarget] = useState(1);
  const [reminders, setReminders] = useState<HabitReminder[]>([]);
  const [categoryFilter, setCategoryFilter] = useState<HabitCategory | 'all'>('all');

  // New state for frequency and duration
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [requiresDuration, setRequiresDuration] = useState(false);
  const [targetDuration, setTargetDuration] = useState(15);

  // Celebration states
  const [showAllComplete, setShowAllComplete] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    habitName: string;
    habitIcon: string;
    habitColor: string;
    streakDays?: number;
  } | null>(null);


  // Get active challenges count
  const activeChallengesCount = useMemo(() => getActiveChallenges().length, []);

  // P1 Fix: Debounce ref to prevent rapid toggle causing multiple celebrations
  const toggleDebounceRef = useRef<Set<string>>(new Set());

  const today = getToday();

  // Memoized progress map for better performance
  const progressMap = useMemo(() => {
    const map = new Map<string, number>();
    habits.forEach(habit => {
      const habitType = habit.type || 'daily';
      let progress = 0;

      if (habitType === 'reduce') {
        progress = habit.progressByDate?.[today] ?? 0;
      } else if (habitType === 'multiple') {
        progress = habit.completionsByDate?.[today] ?? 0;
      } else if (habitType === 'continuous') {
        if (habit.startDate) {
          const start = parseLocalDate(habit.startDate);
          const now = new Date();
          const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
          const failureCount = habit.failedDates?.length ?? 0;
          progress = Math.max(0, daysSinceStart - failureCount);
        }
      }

      map.set(habit.id, progress);
    });
    return map;
  }, [habits, today]);

  // Memoized completion status map
  const completionStatusMap = useMemo(() => {
    const map = new Map<string, boolean>();
    habits.forEach(habit => {
      const habitType = habit.type || 'daily';
      let isCompleted = false;

      if (habitType === 'reduce') {
        const progress = habit.progressByDate?.[today];
        isCompleted = progress === 0;
      } else if (habitType === 'multiple') {
        const count = habit.completionsByDate?.[today] ?? 0;
        const target = habit.dailyTarget ?? 1;
        isCompleted = count >= target;
      } else if (habitType === 'continuous') {
        const failedToday = habit.failedDates?.includes(today);
        isCompleted = !failedToday;
      } else {
        // daily type
        isCompleted = habit.completedDates?.includes(today) ?? false;
      }

      map.set(habit.id, isCompleted);
    });
    return map;
  }, [habits, today]);

  // Filtered habits by category
  const filteredHabits = useMemo(() => {
    if (categoryFilter === 'all') return habits;
    return habits.filter(h => (h.category || 'health') === categoryFilter);
  }, [habits, categoryFilter]);

  // Calculate habit streak (consecutive days)
  const getHabitStreak = (habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 1; // Starting new streak

    const sortedDates = [...habit.completedDates].sort().reverse();
    let streak = 0;
    const todayDate = new Date(today);

    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = formatDate(checkDate);

      if (sortedDates.includes(checkDateStr) || (i === 0 && !sortedDates.includes(today))) {
        // Count if we're completing today (i=0) or already have the date
        if (i === 0 || sortedDates.includes(checkDateStr)) {
          streak++;
        }
      } else {
        break;
      }
    }

    return Math.max(1, streak); // At least 1 for today's completion
  };

  // Check if habit is completed today (uses memoized map for performance)
  const isCompletedToday = useCallback((habit: Habit) => {
    return completionStatusMap.get(habit.id) ?? false;
  }, [completionStatusMap]);

  // Get count of completed habits today (derived from memoized map)
  const completedTodayCount = useMemo(() => {
    let count = 0;
    completionStatusMap.forEach(isCompleted => {
      if (isCompleted) count++;
    });
    return count;
  }, [completionStatusMap]);

  // Quick add from template - now shows customization form first
  const handleQuickAdd = (templateId: string) => {
    const template = habitTemplates.find(t => t.id === templateId);
    if (!template) return;

    // Pre-fill form with template data
    setNewHabitName(template.names[language] || template.names.en);
    setSelectedIcon(template.icon);
    setSelectedColor(template.color);
    setSelectedType(template.type);
    if (template.type === 'multiple' && template.dailyTarget) {
      setDailyTarget(template.dailyTarget);
    } else {
      setDailyTarget(1);
    }
    setReminders([]);
    setFrequency('daily');

    // Show customization form
    setShowCustomForm(true);
  };

  // Calculate streaks for all habits (memoized for performance)
  const habitStreaks = useMemo(() => {
    const streaks = new Map<string, number>();
    habits.forEach(habit => {
      streaks.set(habit.id, getHabitStreak(habit));
    });
    return streaks;
  }, [habits, today]);

  const handleAddReminder = () => {
    setReminders([...reminders, {
      enabled: true,
      time: '09:00',
      days: [1, 2, 3, 4, 5] // Mon-Fri by default
    }]);
  };

  const handleRemoveReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const handleReminderChange = <K extends keyof HabitReminder>(
    index: number,
    field: K,
    value: HabitReminder[K]
  ) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], [field]: value };
    setReminders(updated);
  };

  // Reset form to default values
  const resetForm = useCallback(() => {
    setNewHabitName('');
    setSelectedIcon(habitIcons[0]);
    setSelectedColor(habitColors[0]);
    setSelectedType('daily');
    setSelectedCategory('health');
    setDailyTarget(1);
    setReminders([]);
    setFrequency('daily');
    setCustomDays([1, 2, 3, 4, 5]);
    setRequiresDuration(false);
    setTargetDuration(15);
    setEditingHabit(null);
    setIsAdding(false);
    setShowCustomForm(false);
  }, []);

  // Start editing a habit
  const handleEditHabit = useCallback((habit: Habit) => {
    setEditingHabit(habit);
    setNewHabitName(habit.name);
    setSelectedIcon(habit.icon);
    setSelectedColor(habit.color);
    setSelectedType(habit.type || 'daily');
    setSelectedCategory(habit.category || 'health');
    setDailyTarget(habit.dailyTarget ?? habit.targetCount ?? 1);
    setReminders(habit.reminders || []);
    setFrequency(habit.frequency || 'daily');
    setCustomDays(habit.customDays || [1, 2, 3, 4, 5]);
    setRequiresDuration(habit.requiresDuration || false);
    setTargetDuration(habit.targetDuration || 15);
    setIsAdding(true);
    setShowCustomForm(true);
  }, []);

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;

    if (editingHabit && onUpdateHabit) {
      // Update existing habit
      const updatedHabit: Habit = {
        ...editingHabit,
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColor,
        type: selectedType,
        category: selectedCategory,
        reminders: reminders,
        frequency: frequency,
        ...(frequency === 'custom' && { customDays }),
        ...(requiresDuration && {
          requiresDuration: true,
          targetDuration,
        }),
        ...(selectedType === 'multiple' && { dailyTarget }),
        ...(selectedType === 'reduce' && { targetCount: dailyTarget }),
      };
      onUpdateHabit(updatedHabit);
      toast({
        description: `${selectedIcon} ${t.habitUpdated || 'Habit updated'}`,
        duration: 3000,
      });
    } else {
      // Create new habit
      const habit: Habit = {
        id: generateId(),
        name: newHabitName.trim(),
        icon: selectedIcon,
        color: selectedColor,
        category: selectedCategory,
        completedDates: [],
        createdAt: Date.now(),
        type: selectedType,
        reminders: reminders,
        frequency: frequency,
        ...(frequency === 'custom' && { customDays }),
        ...(requiresDuration && {
          requiresDuration: true,
          targetDuration,
          durationByDate: {}
        }),
        ...(selectedType === 'multiple' && { dailyTarget, completionsByDate: {} }),
        ...(selectedType === 'continuous' && { startDate: today, failedDates: [] }),
        ...(selectedType === 'reduce' && { progressByDate: {}, targetCount: dailyTarget }),
      };
      onAddHabit(habit);
    }

    resetForm();
  };

  // Get progress using memoized map for performance
  const getProgress = useCallback((habit: Habit) => {
    return progressMap.get(habit.id) ?? 0;
  }, [progressMap]);

  // Handle habit toggle with celebrations
  // P1 Fix: Added debounce to prevent rapid toggles causing multiple celebrations
  // P1 Fix #7: Added undo toast for accidental toggles
  const handleHabitToggle = useCallback((habit: Habit) => {
    // P1 Fix: Prevent rapid double-toggle
    if (toggleDebounceRef.current.has(habit.id)) {
      return;
    }
    toggleDebounceRef.current.add(habit.id);
    setTimeout(() => toggleDebounceRef.current.delete(habit.id), 500);

    const wasCompleted = isCompletedToday(habit);

    // Trigger the toggle
    onToggleHabit(habit.id, today);

    // P1 Fix #7: Show undo toast for accidental toggles (for accessibility)
    // This helps users with motor impairments who might accidentally tap
    const undoLabel = t.undo || 'Undo';
    const actionLabel = wasCompleted
      ? (t.habitUnchecked || 'Habit unchecked')
      : (t.habitCompleted || 'Habit completed');

    toast({
      description: `${habit.icon} ${actionLabel}`,
      duration: 4000,
      action: (
        <ToastAction
          altText={undoLabel}
          onClick={() => {
            // Undo by toggling again
            onToggleHabit(habit.id, today);
            hapticTap();
          }}
        >
          <Undo2 className="w-3.5 h-3.5 mr-1" />
          {undoLabel}
        </ToastAction>
      ),
    });

    // If the habit is being completed (not uncompleted)
    if (!wasCompleted) {
      // Calculate streak for this habit
      const streak = getHabitStreak(habit);

      // Announce to screen readers
      announceSuccess(`${habit.icon} ${habit.name} ${t.habitCompleted || 'completed'}`);

      // Show Duolingo-style celebration
      setCelebrationData({
        habitName: habit.name,
        habitIcon: habit.icon,
        habitColor: habit.color,
        streakDays: streak > 1 ? streak : undefined,
      });

      // Check if all habits are now completed (after this toggle)
      const otherHabitsCompleted = habits
        .filter(h => h.id !== habit.id)
        .every(h => isCompletedToday(h));

      if (otherHabitsCompleted && habits.length > 1) {
        // All habits will be complete after this one
        setTimeout(() => {
          setShowAllComplete(true);
          setTimeout(() => setShowAllComplete(false), 4000);
        }, 1800); // Delay after celebration ends
      }
    }
  }, [habits, onToggleHabit, today, t]);

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Nature Energy Background */}
      {isPrimaryCTA && (
        <>
          <div
            className="absolute inset-0"
            style={{
              background: `radial-gradient(ellipse at top,
                rgba(34, 197, 94, 0.12) 0%,
                rgba(16, 185, 129, 0.08) 30%,
                hsl(var(--card)) 60%)`
            }}
          />
          {/* Animated nature glow */}
          <motion.div
            className="absolute inset-0 pointer-events-none"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 4, repeat: Infinity }}
            style={{
              background: `radial-gradient(circle at 70% 20%, rgba(34, 197, 94, 0.1) 0%, transparent 40%)`
            }}
          />
        </>
      )}

      {/* Premium Daily Progress - Crystal Segments */}
      {habits.length > 0 && isPrimaryCTA ? (
        <div className="relative mb-5">
          <div className="flex gap-1.5">
            {habits.map((habit, index) => {
              const isComplete = completionStatusMap.get(habit.id) ?? false;
              return (
                <motion.div
                  key={habit.id}
                  className={cn(
                    "flex-1 h-3 rounded-full transition-all",
                    isComplete
                      ? "bg-gradient-to-r from-emerald-400 to-teal-500"
                      : "bg-white/10"
                  )}
                  style={isComplete ? {
                    boxShadow: '0 0 8px rgba(16, 185, 129, 0.5)'
                  } : {}}
                  initial={{ scaleX: 0 }}
                  animate={{ scaleX: 1 }}
                  transition={{ delay: index * 0.05, duration: 0.3 }}
                />
              );
            })}
          </div>
          <div className="flex justify-between mt-2">
            <span className="text-xs text-emerald-700/70 dark:text-emerald-300/70">{completedTodayCount} / {habits.length}</span>
            {completedTodayCount === habits.length && habits.length > 0 && (
              <motion.span
                className="text-xs text-emerald-700 dark:text-emerald-300 flex items-center gap-1"
                initial={{ opacity: 0, x: -10 }}
                animate={{ opacity: 1, x: 0 }}
              >
                <Sparkles className="w-3 h-3" />
                {t.allDone || 'All done!'}
              </motion.span>
            )}
          </div>
        </div>
      ) : habits.length > 0 && (
        <DailyProgressBar
          completedCount={completedTodayCount}
          totalCount={habits.length}
          className="mb-5 relative"
        />
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
            <span className="text-sm font-bold text-emerald-700 dark:text-emerald-200">{t.startHere}</span>
          </div>
        </motion.div>
      )}

      <div className="flex items-center justify-between mb-4 relative">
        <h3 className={cn(
          "font-semibold",
          isPrimaryCTA ? "text-xl text-slate-800 dark:text-white" : "text-lg text-foreground"
        )}>{t.habits}</h3>
        <div className="flex items-center gap-2">
          {/* Challenges button - only show when challenges feature is enabled */}
          {onOpenChallenge && (
            isPrimaryCTA ? (
              <motion.button
                onClick={() => {
                  hapticTap();
                  onOpenChallenge();
                }}
                aria-label={t.friendChallenges}
                className="relative w-10 h-10 rounded-xl flex items-center justify-center bg-slate-100/60 dark:bg-white/10 backdrop-blur-sm border border-slate-200/60 dark:border-white/20 text-slate-600 dark:text-white/70 hover:text-slate-800 dark:hover:text-white hover:bg-slate-200/60 dark:hover:bg-white/20 transition-colors"
                whileHover={{ scale: 1.05 }}
                whileTap={{ scale: 0.95 }}
              >
                <Users className="w-5 h-5" />
                {activeChallengesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-emerald-500 text-white text-xs font-bold rounded-full flex items-center justify-center">
                    {activeChallengesCount}
                  </span>
                )}
              </motion.button>
            ) : (
              <Button
                variant="secondary"
                size="icon"
                onClick={() => {
                  hapticTap();
                  onOpenChallenge();
                }}
                aria-label={t.friendChallenges}
                className="relative"
              >
                <Users className="w-5 h-5" />
                {activeChallengesCount > 0 && (
                  <span className="absolute -top-1 -right-1 w-4 h-4 bg-primary text-primary-foreground text-xs font-bold rounded-full flex items-center justify-center">
                    {activeChallengesCount}
                  </span>
                )}
              </Button>
            )
          )}
          {/* Add button */}
          {isPrimaryCTA ? (
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                setIsAdding(!isAdding);
              }}
              aria-label={isAdding ? (t.cancel || 'Cancel') : (t.addHabit || 'Add habit')}
              className={cn(
                "w-10 h-10 rounded-xl flex items-center justify-center transition-all",
                isAdding
                  ? "bg-red-500/30 border border-red-500/50 text-red-300"
                  : "bg-gradient-to-br from-emerald-500/60 to-teal-600/60 border border-emerald-500/30 text-white"
              )}
              style={!isAdding ? { boxShadow: '0 0 12px rgba(16, 185, 129, 0.3)' } : {}}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              <Plus className={cn("w-5 h-5 transition-transform", isAdding && "rotate-45")} />
            </motion.button>
          ) : (
            <Button
              variant={isAdding ? "destructive" : "gradient"}
              size="icon"
              onClick={(e) => {
                e.preventDefault();
                setIsAdding(!isAdding);
              }}
              className={cn(isAdding && "rotate-45")}
              aria-label={isAdding ? (t.cancel || 'Cancel') : (t.addHabit || 'Add habit')}
            >
              <Plus className="w-5 h-5" />
            </Button>
          )}
        </div>
      </div>

      {isAdding && !showCustomForm && (
        <motion.div
          className={cn(
            "mb-4 p-4 rounded-2xl",
            isPrimaryCTA
              ? "bg-white/5 backdrop-blur-sm border border-white/10"
              : "bg-secondary"
          )}
          initial={{ opacity: 0, scale: 0.95 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ duration: 0.2 }}
        >
          {/* Quick-add templates */}
          <p className={cn(
            "text-sm font-medium mb-3",
            isPrimaryCTA ? "text-slate-700 dark:text-white/80" : "text-foreground"
          )}>{t.quickAdd || 'Quick Add'}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {habitTemplates
              .filter(template => !habits.some(h => h.name === (template.names[language] || template.names.en)))
              .slice(0, 6)
              .map((template, index) => (
                isPrimaryCTA ? (
                  <motion.button
                    key={template.id}
                    onClick={() => handleQuickAdd(template.id)}
                    className="flex items-center gap-2 px-3 py-3 min-h-[52px] rounded-xl bg-white/5 border border-white/10 text-white/80 hover:bg-white/10 hover:text-white transition-all text-left"
                    initial={{ opacity: 0, y: 10 }}
                    animate={{ opacity: 1, y: 0 }}
                    transition={{ delay: index * 0.05 }}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="truncate text-sm font-medium">
                      {template.names[language] || template.names.en}
                    </span>
                  </motion.button>
                ) : (
                  <Button
                    key={template.id}
                    variant="outline"
                    size="default"
                    onClick={() => handleQuickAdd(template.id)}
                    className="justify-start gap-2 min-h-[48px]"
                  >
                    <span className="text-xl">{template.icon}</span>
                    <span className="truncate">
                      {template.names[language] || template.names.en}
                    </span>
                  </Button>
                )
              ))}
          </div>

          {/* Custom habit option */}
          <Button
            variant="outline"
            onClick={() => {
              setShowCustomForm(true);
            }}
            className="w-full justify-between min-h-[48px]"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <span>{t.createCustomHabit || 'Create custom habit'}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </Button>
        </motion.div>
      )}

      {isAdding && showCustomForm && (
        <motion.div
          className={cn(
            "mb-4 p-4 rounded-2xl relative overflow-hidden",
            isPrimaryCTA
              ? "bg-white/5 backdrop-blur-sm border border-white/10"
              : "bg-secondary"
          )}
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.3 }}
        >
          {/* Premium cosmic background */}
          {isPrimaryCTA && (
            <div
              className="absolute inset-0 pointer-events-none"
              style={{
                background: `radial-gradient(ellipse at top,
                  rgba(139, 92, 246, 0.1) 0%, transparent 50%)`
              }}
            />
          )}

          {/* Back/Cancel button */}
          <motion.button
            onClick={() => {
              if (editingHabit) {
                resetForm();
              } else {
                setShowCustomForm(false);
              }
            }}
            className={cn(
              "relative text-sm mb-3 flex items-center gap-1 transition-colors",
              isPrimaryCTA
                ? "text-slate-500 dark:text-white/60 hover:text-slate-800 dark:hover:text-white"
                : "text-muted-foreground hover:text-foreground"
            )}
            whileHover={{ x: -2 }}
          >
            ← {editingHabit ? (t.cancel || 'Cancel') : (t.back || 'Back')}
          </motion.button>

          {/* Edit mode header */}
          {editingHabit && (
            <div className={cn(
              "mb-3 pb-2 border-b",
              isPrimaryCTA ? "border-white/20" : "border-border"
            )}>
              <p className={cn(
                "text-sm font-medium",
                isPrimaryCTA ? "text-slate-700 dark:text-white/80" : "text-foreground"
              )}>
                {t.editHabit || 'Edit Habit'}
              </p>
            </div>
          )}

          {/* Live Preview Card - Premium */}
          <motion.div
            className={cn(
              "relative mb-4 p-4 rounded-2xl overflow-hidden",
              isPrimaryCTA
                ? "bg-gradient-to-br from-white/10 to-white/5 backdrop-blur-sm border border-white/20"
                : "bg-gradient-to-br from-card/90 to-card/70 backdrop-blur-sm border border-border/50"
            )}
            style={isPrimaryCTA ? {
              boxShadow: '0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
            } : {
              boxShadow: '0 4px 12px -2px hsl(var(--foreground)/0.05)'
            }}
          >
            {/* Shimmer effect for premium */}
            {isPrimaryCTA && (
              <motion.div
                className="absolute inset-0 pointer-events-none"
                style={{
                  background: 'linear-gradient(90deg, transparent 0%, rgba(255, 255, 255, 0.03) 50%, transparent 100%)',
                }}
                animate={{ x: ['-100%', '100%'] }}
                transition={{ duration: 3, repeat: Infinity, repeatDelay: 2, ease: 'linear' }}
              />
            )}
            <p className={cn(
              "text-xs mb-2",
              isPrimaryCTA ? "text-slate-500 dark:text-white/60" : "text-muted-foreground"
            )}>{t.preview || 'Preview'}</p>
            <div className="flex items-center gap-3">
              <div className={cn(
                "w-12 h-12 rounded-xl flex items-center justify-center text-xl transition-all duration-300",
                selectedColor.replace('bg-', 'bg-') + '/20'
              )}>
                {selectedIcon}
              </div>
              <div className="flex-1 min-w-0">
                <p className={cn(
                  "font-semibold text-base truncate",
                  isPrimaryCTA ? "text-slate-800 dark:text-white" : "text-foreground"
                )}>
                  {newHabitName || (t.habitNamePlaceholder || 'Enter habit name...')}
                </p>
                <p className={cn(
                  "text-xs",
                  isPrimaryCTA ? "text-slate-500 dark:text-white/60" : "text-muted-foreground"
                )}>
                  {selectedType === 'daily' && (t.habitTypeDaily || 'Daily')}
                  {selectedType === 'multiple' && `${dailyTarget}× ${t.perDay || 'per day'}`}
                  {selectedType === 'continuous' && (t.habitTypeContinuous || 'Continuous')}
                  {selectedType === 'reduce' && (t.habitTypeReduce || 'Reduce')}
                </p>
              </div>
            </div>
          </motion.div>

          {/* Premium Name Input */}
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder={t.habitName}
            className={cn(
              "relative w-full p-3 rounded-xl mb-3 transition-all",
              "focus:outline-none focus:ring-2",
              isPrimaryCTA
                ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white placeholder:text-white/40 focus:ring-violet-500/50 focus:border-violet-500/30"
                : "bg-background text-foreground placeholder:text-muted-foreground focus:ring-primary/30"
            )}
            style={isPrimaryCTA ? {
              boxShadow: 'inset 0 1px 0 rgba(255,255,255,0.05)'
            } : undefined}
            autoFocus
          />

          <div className="relative mb-4">
            <p className={cn(
              "text-sm font-medium mb-2",
              isPrimaryCTA ? "text-slate-700 dark:text-white/80" : "text-foreground"
            )} id="icon-selector-label">{t.icon}:</p>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="icon-selector-label">
              {habitIcons.map((icon) => (
                <motion.button
                  key={icon}
                  type="button"
                  role="radio"
                  aria-checked={selectedIcon === icon}
                  aria-label={`${t.selectIcon || 'Select icon'} ${icon}`}
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedIcon(icon);
                  }}
                  className={cn(
                    "w-11 h-11 min-w-[44px] min-h-[44px] rounded-xl flex items-center justify-center text-xl transition-all duration-200 cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isPrimaryCTA
                      ? selectedIcon === icon
                        ? "bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40"
                        : "bg-white/5 border border-white/10 hover:bg-white/10"
                      : selectedIcon === icon
                        ? "bg-primary/20 ring-2 ring-primary scale-105 shadow-sm"
                        : "bg-background hover:bg-muted hover:scale-105"
                  )}
                  style={isPrimaryCTA && selectedIcon === icon ? {
                    boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
                  } : undefined}
                  whileHover={{ scale: 1.05 }}
                  whileTap={{ scale: 0.95 }}
                >
                  {icon}
                </motion.button>
              ))}
            </div>
          </div>

          <div className="relative mb-4">
            <p className={cn(
              "text-sm font-medium mb-2",
              isPrimaryCTA ? "text-slate-700 dark:text-white/80" : "text-foreground"
            )} id="color-selector-label">{t.color}:</p>
            <div className="flex gap-3" role="radiogroup" aria-labelledby="color-selector-label">
              {habitColors.map((color) => {
                // Map color classes to hex for glow effect
                const glowColors: Record<string, string> = {
                  'bg-primary': 'rgba(52, 152, 117, 0.5)',
                  'bg-accent': 'rgba(224, 157, 107, 0.5)',
                  'bg-mood-good': 'rgba(16, 185, 129, 0.5)',
                  'bg-mood-okay': 'rgba(234, 179, 8, 0.5)',
                  'bg-mood-great': 'rgba(139, 92, 246, 0.5)',
                };
                const glowColor = glowColors[color] || 'rgba(139, 92, 246, 0.5)';

                return (
                  <motion.button
                    key={color}
                    type="button"
                    role="radio"
                    aria-checked={selectedColor === color}
                    aria-label={`${t.selectColor || 'Select color'} ${color.replace('bg-', '')}`}
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedColor(color);
                    }}
                    className={cn(
                      "w-11 h-11 min-w-[44px] min-h-[44px] rounded-full transition-all duration-200 cursor-pointer",
                      "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                      color,
                      selectedColor === color
                        ? isPrimaryCTA
                          ? "ring-2 ring-offset-2 ring-white/50 scale-110"
                          : "ring-2 ring-offset-2 ring-foreground scale-110"
                        : "hover:scale-105"
                    )}
                    style={{
                      boxShadow: selectedColor === color
                        ? `0 0 20px ${glowColor}`
                        : `0 2px 8px ${glowColor.replace('0.5', '0.2')}`
                    }}
                    whileHover={{ scale: 1.1 }}
                    whileTap={{ scale: 0.95 }}
                  />
                );
              })}
            </div>
          </div>

          <div className="relative mb-4">
            <p className={cn(
              "text-sm font-medium mb-2",
              isPrimaryCTA ? "text-slate-700 dark:text-white/80" : "text-foreground"
            )}>{t.habitType}:</p>
            <div className="grid grid-cols-2 gap-2">
              {[
                { type: 'daily' as HabitType, icon: '✓', label: t.habitTypeDaily },
                { type: 'multiple' as HabitType, icon: '🔄', label: t.habitTypeMultiple },
                { type: 'continuous' as HabitType, icon: '📈', label: t.habitTypeContinuous },
                { type: 'reduce' as HabitType, icon: '📉', label: t.habitTypeReduce || 'Reduce' },
              ].map(({ type, icon, label }) => (
                <motion.button
                  key={type}
                  type="button"
                  onClick={(e) => {
                    e.preventDefault();
                    setSelectedType(type);
                  }}
                  className={cn(
                    "p-3 rounded-xl text-sm font-medium transition-all duration-200 cursor-pointer min-h-[44px]",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    isPrimaryCTA
                      ? selectedType === type
                        ? "bg-gradient-to-br from-emerald-500/30 to-teal-600/20 border border-emerald-500/40 text-white"
                        : "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10 hover:text-white"
                      : selectedType === type
                        ? "bg-primary text-primary-foreground shadow-md"
                        : "bg-background hover:bg-muted border border-border/50"
                  )}
                  style={isPrimaryCTA && selectedType === type ? {
                    boxShadow: '0 0 12px rgba(16, 185, 129, 0.4)'
                  } : undefined}
                  whileHover={{ scale: 1.02 }}
                  whileTap={{ scale: 0.98 }}
                >
                  {icon} {label}
                </motion.button>
              ))}
            </div>
          </div>

          {/* Category selector */}
          <div className="relative mb-4">
            <label className={cn(
              "text-sm mb-2 block",
              isPrimaryCTA ? "text-slate-500 dark:text-white/60" : "text-muted-foreground"
            )}>{t.habitCategory || 'Category'}:</label>
            <div className="grid grid-cols-4 gap-2">
              {habitCategories.map(({ id, icon, color }) => {
                const categoryLabels: Record<HabitCategory, string> = {
                  health: t.categoryHealth || 'Health',
                  mindfulness: t.categoryMindfulness || 'Mindfulness',
                  productivity: t.categoryProductivity || 'Productivity',
                  social: t.categorySocial || 'Social',
                  creativity: t.categoryCreativity || 'Creativity',
                  finance: t.categoryFinance || 'Finance',
                  'self-care': t.categorySelfCare || 'Self-care',
                  other: t.categoryOther || 'Other',
                };
                return (
                  <motion.button
                    key={id}
                    type="button"
                    onClick={(e) => {
                      e.preventDefault();
                      setSelectedCategory(id);
                    }}
                    className={cn(
                      "p-2 rounded-xl text-xs font-medium transition-all flex flex-col items-center gap-1",
                      selectedCategory === id
                        ? isPrimaryCTA
                          ? `bg-gradient-to-br ${color} text-white shadow-lg`
                          : "bg-primary text-primary-foreground shadow-md"
                        : isPrimaryCTA
                          ? "bg-white/5 border border-white/10 text-white/70 hover:bg-white/10"
                          : "bg-background hover:bg-muted border border-border/50"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    <span className="text-lg">{icon}</span>
                    <span className="truncate w-full text-center">{categoryLabels[id]}</span>
                  </motion.button>
                );
              })}
            </div>
          </div>

          {(selectedType === 'multiple' || selectedType === 'reduce') && (
            <div className="relative mb-4">
              <label className={cn(
                "text-sm mb-2 block",
                isPrimaryCTA ? "text-slate-500 dark:text-white/60" : "text-muted-foreground"
              )}>{t.habitDailyTarget}:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(safeParseInt(e.target.value, 1, 1, 50))}
                className={cn(
                  "w-full p-2 rounded-lg transition-all",
                  "focus:outline-none focus:ring-2",
                  isPrimaryCTA
                    ? "bg-white/10 backdrop-blur-sm border border-white/20 text-white focus:ring-violet-500/50"
                    : "bg-background text-foreground focus:ring-primary/30"
                )}
              />
            </div>
          )}

          {/* Reminders Section - Premium */}
          <div className={cn(
            "relative mb-4 p-4 rounded-xl",
            isPrimaryCTA
              ? "bg-white/5 backdrop-blur-sm border border-white/10"
              : "bg-secondary/50"
          )}>
            <div className="flex items-center justify-between mb-2">
              <label className={cn(
                "text-sm",
                isPrimaryCTA ? "text-slate-600 dark:text-white/70" : "text-muted-foreground"
              )}>{t.reminders || 'Reminders'}</label>
              <motion.button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAddReminder();
                }}
                className={cn(
                  "text-xs px-3 py-1.5 rounded-lg transition-colors",
                  isPrimaryCTA
                    ? "bg-violet-500/20 text-violet-300 border border-violet-500/30 hover:bg-violet-500/30"
                    : "bg-primary/10 text-primary hover:bg-primary/20"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                + {t.addReminder || 'Add'}
              </motion.button>
            </div>

            {reminders.length === 0 ? (
              <p className={cn(
                "text-xs italic",
                isPrimaryCTA ? "text-slate-400 dark:text-white/40" : "text-muted-foreground"
              )}>{t.noReminders || 'No reminders set'}</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((reminder, index) => (
                  <div
                    key={index}
                    className={cn(
                      "flex items-center gap-2 p-2 rounded-lg",
                      isPrimaryCTA
                        ? "bg-white/5 border border-white/10"
                        : "bg-background"
                    )}
                  >
                    <input
                      type="time"
                      value={reminder.time}
                      onChange={(e) => handleReminderChange(index, 'time', e.target.value)}
                      className={cn(
                        "flex-1 p-1 rounded text-sm focus:outline-none focus:ring-1",
                        isPrimaryCTA
                          ? "bg-white/10 border border-white/20 text-white focus:ring-violet-500/50"
                          : "bg-secondary text-foreground focus:ring-primary/30"
                      )}
                    />
                    <div className="flex gap-1">
                      {[
                        { day: 1, label: t.mon?.slice(0, 2) || 'Mo' },
                        { day: 2, label: t.tue?.slice(0, 2) || 'Tu' },
                        { day: 3, label: t.wed?.slice(0, 2) || 'We' },
                        { day: 4, label: t.thu?.slice(0, 2) || 'Th' },
                        { day: 5, label: t.fri?.slice(0, 2) || 'Fr' },
                        { day: 6, label: t.sat?.slice(0, 2) || 'Sa' },
                        { day: 0, label: t.sun?.slice(0, 2) || 'Su' },
                      ].map(({ day, label }) => (
                        <motion.button
                          key={day}
                          type="button"
                          onClick={(e) => {
                            e.preventDefault();
                            const newDays = reminder.days.includes(day)
                              ? reminder.days.filter(d => d !== day)
                              : [...reminder.days, day];
                            handleReminderChange(index, 'days', newDays);
                          }}
                          className={cn(
                            "w-8 h-8 min-w-[32px] min-h-[32px] text-[10px] rounded-lg transition-colors font-medium",
                            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                            isPrimaryCTA
                              ? reminder.days.includes(day)
                                ? "bg-gradient-to-br from-violet-500/60 to-purple-600/60 text-white"
                                : "bg-white/5 text-white/50 hover:bg-white/10"
                              : reminder.days.includes(day)
                                ? "bg-primary text-primary-foreground"
                                : "bg-secondary text-muted-foreground hover:bg-muted"
                          )}
                          style={isPrimaryCTA && reminder.days.includes(day) ? {
                            boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)'
                          } : undefined}
                          whileTap={{ scale: 0.95 }}
                        >
                          {label}
                        </motion.button>
                      ))}
                    </div>
                    <motion.button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveReminder(index);
                      }}
                      className={cn(
                        "p-2 min-w-[36px] min-h-[36px] flex items-center justify-center rounded-lg transition-colors",
                        isPrimaryCTA
                          ? "text-red-400 hover:bg-red-500/20"
                          : "text-destructive hover:bg-destructive/10"
                      )}
                      whileTap={{ scale: 0.95 }}
                    >
                      <X className="w-4 h-4" />
                    </motion.button>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Premium Submit Button */}
          {isPrimaryCTA ? (
            <motion.button
              onClick={(e) => {
                e.preventDefault();
                handleAddHabit();
              }}
              disabled={!newHabitName.trim()}
              className={cn(
                "relative w-full py-3.5 rounded-xl font-semibold text-white transition-all overflow-hidden",
                newHabitName.trim()
                  ? editingHabit
                    ? "bg-gradient-to-r from-blue-500 to-indigo-500"
                    : "bg-gradient-to-r from-emerald-500 to-teal-500"
                  : "bg-white/10 text-white/40 cursor-not-allowed"
              )}
              style={newHabitName.trim() ? {
                boxShadow: editingHabit
                  ? '0 0 20px rgba(99, 102, 241, 0.4)'
                  : '0 0 20px rgba(16, 185, 129, 0.4)'
              } : undefined}
              whileHover={newHabitName.trim() ? { scale: 1.02 } : {}}
              whileTap={newHabitName.trim() ? { scale: 0.98 } : {}}
            >
              {/* Pulse ring when enabled */}
              {newHabitName.trim() && (
                <motion.div
                  className={cn(
                    "absolute inset-0 rounded-xl border-2",
                    editingHabit ? "border-indigo-400/30" : "border-emerald-400/30"
                  )}
                  animate={{ scale: [1, 1.05], opacity: [0.5, 0] }}
                  transition={{ duration: 1.5, repeat: Infinity }}
                />
              )}
              <span className="relative z-10">
                {editingHabit ? (t.saveChanges || 'Save Changes') : t.addHabit}
              </span>
            </motion.button>
          ) : (
            <Button
              variant={editingHabit ? "default" : "gradient"}
              size="lg"
              onClick={(e) => {
                e.preventDefault();
                handleAddHabit();
              }}
              disabled={!newHabitName.trim()}
              className="w-full"
            >
              {editingHabit ? (t.saveChanges || 'Save Changes') : t.addHabit}
            </Button>
          )}
        </motion.div>
      )}

      {habits.length === 0 ? (
        <div className="text-center py-8">
          <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 rounded-full border border-primary/30 animate-glow-pulse mb-4">
            <span className="text-2xl">🎯</span>
            <span className="text-sm font-bold text-primary">{t.startHere || 'Start here'}</span>
          </div>
          <p className="text-muted-foreground mb-4">
            {t.addFirstHabit}
          </p>
          <Button
            variant="gradient"
            size="lg"
            onClick={(e) => {
              e.preventDefault();
              setIsAdding(true);
            }}
          >
            <Plus className="w-5 h-5" />
            {t.addHabit}
          </Button>
        </div>
      ) : (
        <>
          {/* Category filter tabs */}
          {habits.length >= 3 && (
            <div className="flex gap-1.5 mb-4 overflow-x-auto pb-1 scrollbar-hide">
              <motion.button
                onClick={() => setCategoryFilter('all')}
                className={cn(
                  "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all",
                  categoryFilter === 'all'
                    ? "bg-primary text-primary-foreground shadow-sm"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
                whileHover={{ scale: 1.02 }}
                whileTap={{ scale: 0.98 }}
              >
                {t.all || 'All'} ({habits.length})
              </motion.button>
              {habitCategories.map(({ id, icon }) => {
                const count = habits.filter(h => (h.category || 'health') === id).length;
                if (count === 0) return null;
                return (
                  <motion.button
                    key={id}
                    onClick={() => setCategoryFilter(id)}
                    className={cn(
                      "px-3 py-1.5 rounded-full text-xs font-medium whitespace-nowrap transition-all flex items-center gap-1",
                      categoryFilter === id
                        ? "bg-primary text-primary-foreground shadow-sm"
                        : "bg-secondary text-muted-foreground hover:bg-muted"
                    )}
                    whileHover={{ scale: 1.02 }}
                    whileTap={{ scale: 0.98 }}
                  >
                    {icon} {count}
                  </motion.button>
                );
              })}
            </div>
          )}

          <div
            role="list"
            aria-label={t.habits || 'Habits'}
            className="space-y-2"
          >
            {filteredHabits.map((habit) => (
            <CompactHabitCard
              key={habit.id}
              habit={habit}
              onToggle={() => handleHabitToggle(habit)}
              onAdjust={onAdjustHabit}
              onDelete={onDeleteHabit}
              onEdit={onUpdateHabit ? handleEditHabit : undefined}
              onChallenge={onOpenChallenge ? (h) => onOpenChallenge(h) : undefined}
              streak={habitStreaks.get(habit.id) || 0}
            />
          ))}
          </div>
        </>
      )}

      {/* Duolingo-style Completion Celebration */}
      {celebrationData && (
        <HabitCompletionCelebration
          habitName={celebrationData.habitName}
          habitIcon={celebrationData.habitIcon}
          habitColor={celebrationData.habitColor}
          xpGained={10}
          streakDays={celebrationData.streakDays}
          onComplete={() => setCelebrationData(null)}
        />
      )}

      {/* All Habits Complete Celebration */}
      {showAllComplete && (
        <AllHabitsComplete onClose={() => setShowAllComplete(false)} />
      )}

    </div>
  );
});
