import { useState, useRef, useCallback } from 'react';
import { Habit, HabitType, HabitReminder, HabitFrequency } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Minus, Bell, Clock, ChevronRight, Trash2, MoreHorizontal, Settings2, Flame, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitTemplates } from '@/lib/habitTemplates';
import { HabitCompletion, AllHabitsComplete } from './Celebrations';
import { HabitCompletionCelebration, DailyProgressBar, AnimatedHabitButton } from './HabitCompletionCelebration';
import { SwipeableHabit } from './SwipeableHabit';

const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎵', '🌿', '🚭', '🍷', '🇬🇧', '💪', '🧠'];
const habitColors = [
  'bg-primary',
  'bg-accent',
  'bg-mood-good',
  'bg-mood-okay',
  'bg-mood-great',
];

interface HabitTrackerProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
  isPrimaryCTA?: boolean;
}

export function HabitTracker({ habits, onToggleHabit, onAdjustHabit, onAddHabit, onDeleteHabit, isPrimaryCTA = false }: HabitTrackerProps) {
  const { t, language } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [showCustomForm, setShowCustomForm] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  const [selectedType, setSelectedType] = useState<HabitType>('daily');
  const [dailyTarget, setDailyTarget] = useState(1);
  const [reminders, setReminders] = useState<HabitReminder[]>([]);

  // New state for frequency and duration
  const [frequency, setFrequency] = useState<HabitFrequency>('daily');
  const [customDays, setCustomDays] = useState<number[]>([1, 2, 3, 4, 5]); // Mon-Fri default
  const [requiresDuration, setRequiresDuration] = useState(false);
  const [targetDuration, setTargetDuration] = useState(15);

  // Habit item interaction state
  const [expandedHabitId, setExpandedHabitId] = useState<string | null>(null);
  const [swipedHabitId, setSwipedHabitId] = useState<string | null>(null);
  const touchStartX = useRef<number>(0);

  // Celebration states
  const [completedHabitName, setCompletedHabitName] = useState<string | null>(null);
  const [showAllComplete, setShowAllComplete] = useState(false);
  const [animatingHabitId, setAnimatingHabitId] = useState<string | null>(null);
  const [celebrationData, setCelebrationData] = useState<{
    habitName: string;
    habitIcon: string;
    habitColor: string;
    streakDays?: number;
  } | null>(null);

  const today = getToday();

  // Calculate habit streak (consecutive days)
  const getHabitStreak = (habit: Habit): number => {
    if (!habit.completedDates || habit.completedDates.length === 0) return 1; // Starting new streak

    const sortedDates = [...habit.completedDates].sort().reverse();
    let streak = 0;
    const todayDate = new Date(today);

    for (let i = 0; i < sortedDates.length; i++) {
      const checkDate = new Date(todayDate);
      checkDate.setDate(checkDate.getDate() - i);
      const checkDateStr = checkDate.toISOString().split('T')[0];

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

  // Check if habit is completed today (must be defined before use)
  const isCompletedToday = (habit: Habit) => {
    const habitType = habit.type || 'daily';

    if (habitType === 'reduce') {
      const progress = habit.progressByDate?.[today];
      return progress === 0;
    }

    if (habitType === 'multiple') {
      const completions = habit.completionsByDate?.[today] ?? 0;
      const target = habit.dailyTarget ?? 1;
      return completions >= target;
    }

    if (habitType === 'continuous') {
      return !(habit.failedDates?.includes(today));
    }

    return habit.completedDates.includes(today);
  };

  // Get count of completed habits today
  const completedTodayCount = habits.filter(h => isCompletedToday(h)).length;

  // Quick add from template
  const handleQuickAdd = (templateId: string) => {
    const template = habitTemplates.find(t => t.id === templateId);
    if (!template) return;

    const habit: Habit = {
      id: generateId(),
      name: template.names[language] || template.names.en,
      icon: template.icon,
      color: template.color,
      completedDates: [],
      createdAt: Date.now(),
      type: template.type,
      frequency: 'daily',
      ...(template.type === 'multiple' && { dailyTarget: template.dailyTarget || 1, completionsByDate: {} }),
      ...(template.type === 'continuous' && { startDate: today, failedDates: [] }),
    };

    onAddHabit(habit);
    setIsAdding(false);
  };

  // Touch handlers for swipe-to-delete
  const handleTouchStart = (e: React.TouchEvent, habitId: string) => {
    touchStartX.current = e.touches[0].clientX;
    if (swipedHabitId && swipedHabitId !== habitId) {
      setSwipedHabitId(null);
    }
  };

  const handleTouchEnd = (e: React.TouchEvent, habitId: string) => {
    const touchEndX = e.changedTouches[0].clientX;
    const diff = touchStartX.current - touchEndX;

    if (diff > 80) {
      // Swiped left - show delete
      setSwipedHabitId(habitId);
    } else if (diff < -80) {
      // Swiped right - hide delete
      setSwipedHabitId(null);
    }
  };

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

  const handleReminderChange = (index: number, field: keyof HabitReminder, value: any) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], [field]: value };
    setReminders(updated);
  };

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;

    const habit: Habit = {
      id: generateId(),
      name: newHabitName.trim(),
      icon: selectedIcon,
      color: selectedColor,
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
    setNewHabitName('');
    setSelectedType('daily');
    setDailyTarget(1);
    setReminders([]);
    setFrequency('daily');
    setCustomDays([1, 2, 3, 4, 5]);
    setRequiresDuration(false);
    setTargetDuration(15);
    setIsAdding(false);
    setShowCustomForm(false);
  };

  const getProgress = (habit: Habit) => {
    const habitType = habit.type || 'daily';

    if (habitType === 'reduce') {
      return habit.progressByDate?.[today] ?? 0;
    }

    if (habitType === 'multiple') {
      return habit.completionsByDate?.[today] ?? 0;
    }

    if (habitType === 'continuous') {
      // Calculate days since start without failure
      if (!habit.startDate) return 0;
      const start = new Date(habit.startDate);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const failureCount = habit.failedDates?.length ?? 0;
      return Math.max(0, daysSinceStart - failureCount);
    }

    return 0;
  };

  // Handle habit toggle with animations
  const handleHabitToggle = useCallback((habit: Habit) => {
    const wasCompleted = isCompletedToday(habit);

    // Trigger the toggle
    onToggleHabit(habit.id, today);

    // If the habit is being completed (not uncompleted)
    if (!wasCompleted) {
      // Trigger pulse animation on the button
      setAnimatingHabitId(habit.id);
      setTimeout(() => setAnimatingHabitId(null), 600);

      // Calculate streak for this habit
      const streak = getHabitStreak(habit);

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
  }, [habits, onToggleHabit, today]);

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-emerald-500/15 via-card to-green-500/15 ring-2 ring-emerald-500/40 shadow-lg shadow-emerald-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-green-500/5 animate-pulse" />
      )}

      {/* Daily Progress Bar */}
      {habits.length > 0 && (
        <DailyProgressBar
          completedCount={completedTodayCount}
          totalCount={habits.length}
          className="mb-5 relative"
        />
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-emerald-500/25 rounded-full border border-emerald-500/30">
            <Zap className="w-4 h-4 text-emerald-500" />
            <span className="text-sm font-bold text-emerald-600 dark:text-emerald-400">{t.startHere}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 relative">
        <h3 className={cn(
          "font-semibold text-foreground",
          isPrimaryCTA ? "text-xl" : "text-lg"
        )}>{t.habits}</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={cn(
            "btn-press p-2 rounded-full transition-all",
            isAdding ? "bg-destructive text-destructive-foreground rotate-45" : "bg-primary text-primary-foreground"
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {isAdding && !showCustomForm && (
        <div className="mb-4 p-4 bg-secondary rounded-xl animate-scale-in">
          {/* Quick-add templates */}
          <p className="text-sm font-medium text-foreground mb-3">{t.quickAdd || 'Quick Add'}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {habitTemplates
              .filter(template => !habits.some(h => h.name === (template.names[language] || template.names.en)))
              .slice(0, 6)
              .map((template) => (
                <button
                  key={template.id}
                  onClick={() => handleQuickAdd(template.id)}
                  className="btn-press flex items-center gap-2 p-3 bg-background rounded-xl hover:bg-muted transition-all text-left"
                >
                  <span className="text-xl">{template.icon}</span>
                  <span className="text-sm font-medium text-foreground truncate">
                    {template.names[language] || template.names.en}
                  </span>
                </button>
              ))}
          </div>

          {/* Custom habit option */}
          <button
            onClick={() => setShowCustomForm(true)}
            className="btn-press w-full flex items-center justify-between p-3 bg-background rounded-xl hover:bg-muted transition-all"
          >
            <div className="flex items-center gap-2">
              <Settings2 className="w-5 h-5 text-primary" />
              <span className="text-sm font-medium text-foreground">{t.createCustomHabit || 'Create custom habit'}</span>
            </div>
            <ChevronRight className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>
      )}

      {isAdding && showCustomForm && (
        <div className="mb-4 p-4 bg-secondary rounded-xl animate-scale-in">
          {/* Back button */}
          <button
            onClick={() => setShowCustomForm(false)}
            className="text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
          >
            ← {t.back || 'Back'}
          </button>

          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder={t.habitName}
            className="w-full p-3 bg-background rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
            autoFocus
          />

          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-2">{t.icon}:</p>
            <div className="flex gap-2 flex-wrap">
              {habitIcons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={cn(
                    "btn-press w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all",
                    selectedIcon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">{t.color}:</p>
            <div className="flex gap-2">
              {habitColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "btn-press w-8 h-8 rounded-full transition-all",
                    color,
                    selectedColor === color ? "ring-2 ring-offset-2 ring-foreground" : ""
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">{t.habitType}:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedType('daily')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'daily' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeDaily}
              </button>
              <button
                onClick={() => setSelectedType('multiple')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'multiple' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeMultiple}
              </button>
              <button
                onClick={() => setSelectedType('continuous')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'continuous' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeContinuous}
              </button>
              <button
                onClick={() => setSelectedType('reduce')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'reduce' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeReduce || 'Reduce'}
              </button>
            </div>
          </div>

          {(selectedType === 'multiple' || selectedType === 'reduce') && (
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-2 block">{t.habitDailyTarget}:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(parseInt(e.target.value) || 1)}
                className="w-full p-2 bg-background rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <button
            onClick={handleAddHabit}
            disabled={!newHabitName.trim()}
            className="btn-press w-full py-3 zen-gradient text-primary-foreground font-medium rounded-xl disabled:opacity-50 transition-opacity"
          >
            {t.addHabit}
          </button>
        </div>
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
          <button
            onClick={() => setIsAdding(true)}
            className="btn-press px-6 py-3 zen-gradient text-white font-bold rounded-xl hover:opacity-90 transition-all zen-shadow-soft"
          >
            <Plus className="w-5 h-5 inline-block mr-2" />
            {t.addHabit}
          </button>
        </div>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => {
            const completed = isCompletedToday(habit);
            const habitType = habit.type || 'daily';
            const progress = getProgress(habit);
            const isSwiped = swipedHabitId === habit.id;

            return (
              <div
                key={habit.id}
                className="relative overflow-hidden rounded-xl"
                onTouchStart={(e) => handleTouchStart(e, habit.id)}
                onTouchEnd={(e) => handleTouchEnd(e, habit.id)}
              >
                {/* Delete action (revealed on swipe) */}
                <div
                  className={cn(
                    "absolute right-0 top-0 bottom-0 flex items-center justify-center bg-destructive text-white transition-all",
                    isSwiped ? "w-20" : "w-0"
                  )}
                >
                  <button
                    onClick={() => {
                      onDeleteHabit(habit.id);
                      setSwipedHabitId(null);
                    }}
                    className="p-3"
                  >
                    <Trash2 className="w-5 h-5" />
                  </button>
                </div>

                {/* Main habit card */}
                <div
                  className={cn(
                    "flex items-center gap-3 p-3 bg-secondary transition-transform",
                    isSwiped && "-translate-x-20"
                  )}
                >
                  {habitType === 'reduce' ? (
                    <div className="flex items-center gap-1">
                      <button
                        onClick={() => onAdjustHabit?.(habit.id, today, -1)}
                        className="btn-press w-9 h-9 rounded-xl bg-mood-good/20 flex items-center justify-center text-mood-good hover:bg-mood-good/30 transition-colors"
                      >
                        <Minus className="w-4 h-4" />
                      </button>
                      <div className={cn(
                        "w-10 h-10 rounded-xl flex items-center justify-center font-bold text-lg",
                        progress === 0 ? "bg-mood-good/20 text-mood-good" : "bg-background text-foreground"
                      )}>
                        {progress}
                      </div>
                      <button
                        onClick={() => onAdjustHabit?.(habit.id, today, 1)}
                        className="btn-press w-9 h-9 rounded-xl bg-background flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                      >
                        <Plus className="w-4 h-4" />
                      </button>
                    </div>
                  ) : habitType === 'multiple' ? (
                    <div className="flex items-center gap-2">
                      <button
                        onClick={() => onToggleHabit(habit.id, today)}
                        className={cn(
                          "btn-press w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all relative",
                          completed
                            ? `${habit.color} text-primary-foreground zen-shadow-soft`
                            : "bg-background hover:scale-105"
                        )}
                      >
                        {completed ? <Check className="w-6 h-6" /> : habit.icon}
                      </button>
                      <div className="flex flex-col">
                        <div className="flex items-center gap-1">
                          {Array.from({ length: habit.dailyTarget ?? 1 }).map((_, i) => (
                            <div
                              key={i}
                              className={cn(
                                "w-2 h-2 rounded-full transition-all",
                                i < progress ? habit.color : "bg-muted"
                              )}
                            />
                          ))}
                        </div>
                        <span className="text-xs text-muted-foreground mt-1">
                          {progress}/{habit.dailyTarget ?? 1}
                        </span>
                      </div>
                    </div>
                  ) : habitType === 'continuous' ? (
                    <div className="flex items-center gap-2">
                      <div className={cn(
                        "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                        `${habit.color} text-primary-foreground zen-shadow-soft`
                      )}>
                        {habit.icon}
                      </div>
                      <div className="flex flex-col">
                        <span className="text-lg font-bold text-mood-good">{progress}</span>
                        <span className="text-xs text-muted-foreground">{t.days}</span>
                      </div>
                    </div>
                  ) : (
                    // Daily/Scheduled habits: Swipe to complete
                    <SwipeableHabit
                      onComplete={() => handleHabitToggle(habit)}
                      disabled={false}
                      completed={completed}
                      habitColor={habit.color}
                      habitIcon={habit.icon}
                      className="w-14 h-14"
                    >
                      <div
                        className={cn(
                          "w-14 h-14 rounded-xl flex items-center justify-center text-2xl transition-all",
                          completed
                            ? `${habit.color} text-primary-foreground zen-shadow-soft`
                            : "bg-background",
                          animatingHabitId === habit.id && "animate-success-pulse"
                        )}
                      >
                        {completed ? (
                          <Check className={cn("w-6 h-6", animatingHabitId === habit.id && "animate-bounce-check")} />
                        ) : (
                          <span className="select-none">{habit.icon}</span>
                        )}
                      </div>
                    </SwipeableHabit>
                  )}
                  <div className="flex-1 min-w-0">
                    <p className={cn(
                      "font-medium transition-all truncate",
                      completed && habitType !== 'continuous' ? "text-muted-foreground line-through" : "text-foreground"
                    )}>
                      {habit.name}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {habitType === 'continuous'
                        ? `🔥 ${t.streak || 'streak'}`
                        : `${t.completedTimes} ${habit.completedDates.length} ${t.completedTimes2}`
                      }
                    </p>
                  </div>

                  {/* Desktop delete button */}
                  <button
                    onClick={() => onDeleteHabit(habit.id)}
                    className="hidden sm:flex p-2 text-muted-foreground hover:text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                  >
                    <X className="w-4 h-4" />
                  </button>

                  {/* Mobile hint for swipe */}
                  <div className="sm:hidden flex items-center">
                    <MoreHorizontal className="w-4 h-4 text-muted-foreground/50" />
                  </div>
                </div>
              </div>
            );
          })}
        </div>
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
}
