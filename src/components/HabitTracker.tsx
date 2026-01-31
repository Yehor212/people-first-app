import { useState, useCallback, useMemo, memo, useRef } from 'react';
import { Habit, HabitType, HabitReminder, HabitFrequency } from '@/types';
import { getToday, generateId, formatDate, cn } from '@/lib/utils';
import { safeParseInt } from '@/lib/validation';
import { Plus, X, ChevronRight, Settings2, Zap, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitTemplates } from '@/lib/habitTemplates';
import { AllHabitsComplete } from './Celebrations';
import { HabitCompletionCelebration, DailyProgressBar } from './HabitCompletionCelebration';
import { CompactHabitCard } from './CompactHabitCard';
import { ChallengeModal } from './ChallengeModal';
import { hapticTap } from '@/lib/haptics';
import { getActiveChallenges } from '@/lib/friendChallenge';

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

export const HabitTracker = memo(function HabitTracker({ habits, onToggleHabit, onAdjustHabit, onAddHabit, onDeleteHabit, isPrimaryCTA = false }: HabitTrackerProps) {
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

  // Celebration states
  const [showAllComplete, setShowAllComplete] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    habitName: string;
    habitIcon: string;
    habitColor: string;
    streakDays?: number;
  } | null>(null);

  // Challenge states
  const [showChallengeModal, setShowChallengeModal] = useState(false);
  const [challengeHabit, setChallengeHabit] = useState<Habit | undefined>(undefined);

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
          const start = new Date(habit.startDate);
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

  // Get progress using memoized map for performance
  const getProgress = useCallback((habit: Habit) => {
    return progressMap.get(habit.id) ?? 0;
  }, [progressMap]);

  // Handle habit toggle with celebrations
  // P1 Fix: Added debounce to prevent rapid toggles causing multiple celebrations
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

    // If the habit is being completed (not uncompleted)
    if (!wasCompleted) {
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
        <div className="absolute inset-0 bg-gradient-to-r from-emerald-500/5 via-transparent to-green-500/5 animate-pulse pointer-events-none" />
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
        <div className="flex items-center gap-2">
          {/* Challenges button */}
          <Button
            variant="secondary"
            size="icon"
            onClick={() => {
              hapticTap();
              setChallengeHabit(undefined);
              setShowChallengeModal(true);
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
          {/* Add button */}
          <Button
            variant={isAdding ? "destructive" : "gradient"}
            size="icon"
            onClick={(e) => {
              e.preventDefault();
              setIsAdding(!isAdding);
            }}
            className={cn(isAdding && "rotate-45")}
          >
            <Plus className="w-5 h-5" />
          </Button>
        </div>
      </div>

      {isAdding && !showCustomForm && (
        <div className="mb-4 p-4 bg-secondary rounded-2xl animate-scale-in">
          {/* Quick-add templates */}
          <p className="text-sm font-medium text-foreground mb-3">{t.quickAdd || 'Quick Add'}</p>
          <div className="grid grid-cols-2 gap-2 mb-4">
            {habitTemplates
              .filter(template => !habits.some(h => h.name === (template.names[language] || template.names.en)))
              .slice(0, 6)
              .map((template) => (
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
        </div>
      )}

      {isAdding && showCustomForm && (
        <div className="mb-4 p-4 bg-secondary rounded-2xl animate-scale-in">
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
            <p className="text-sm text-muted-foreground mb-2" id="icon-selector-label">{t.icon}:</p>
            <div className="flex gap-2 flex-wrap" role="radiogroup" aria-labelledby="icon-selector-label">
              {habitIcons.map((icon) => (
                <button
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
                    "btn-press w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
                    selectedIcon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2" id="color-selector-label">{t.color}:</p>
            <div className="flex gap-2" role="radiogroup" aria-labelledby="color-selector-label">
              {habitColors.map((color) => (
                <button
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
                    "btn-press w-10 h-10 min-w-[40px] min-h-[40px] rounded-full transition-all cursor-pointer",
                    "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedType('daily');
                }}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all cursor-pointer",
                  selectedType === 'daily' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeDaily}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedType('multiple');
                }}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all cursor-pointer",
                  selectedType === 'multiple' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeMultiple}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedType('continuous');
                }}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all cursor-pointer",
                  selectedType === 'continuous' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeContinuous}
              </button>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  setSelectedType('reduce');
                }}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all cursor-pointer",
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
                onChange={(e) => setDailyTarget(safeParseInt(e.target.value, 1, 1, 50))}
                className="w-full p-2 bg-background rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          {/* Reminders Section */}
          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <label className="text-sm text-muted-foreground">{t.reminders || 'Reminders'}</label>
              <button
                type="button"
                onClick={(e) => {
                  e.preventDefault();
                  handleAddReminder();
                }}
                className="text-xs px-2 py-1 bg-primary/10 text-primary rounded-lg hover:bg-primary/20 transition-colors"
              >
                + {t.addReminder || 'Add'}
              </button>
            </div>

            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">{t.noReminders || 'No reminders set'}</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((reminder, index) => (
                  <div key={index} className="flex items-center gap-2 p-2 bg-background rounded-lg">
                    <input
                      type="time"
                      value={reminder.time}
                      onChange={(e) => handleReminderChange(index, 'time', e.target.value)}
                      className="flex-1 p-1 bg-secondary rounded text-sm text-foreground focus:outline-none focus:ring-1 focus:ring-primary/30"
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
                        <button
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
                            "w-8 h-8 min-w-[32px] min-h-[32px] text-xs rounded-lg transition-colors font-medium",
                            "focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-1 focus-visible:outline-none",
                            reminder.days.includes(day)
                              ? "bg-primary text-primary-foreground"
                              : "bg-secondary text-muted-foreground hover:bg-muted"
                          )}
                        >
                          {label}
                        </button>
                      ))}
                    </div>
                    <button
                      type="button"
                      onClick={(e) => {
                        e.preventDefault();
                        handleRemoveReminder(index);
                      }}
                      className="p-2 min-w-[40px] min-h-[40px] flex items-center justify-center text-destructive hover:bg-destructive/10 rounded-lg"
                    >
                      <X className="w-5 h-5" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <Button
            variant="gradient"
            size="lg"
            onClick={(e) => {
              e.preventDefault();
              handleAddHabit();
            }}
            disabled={!newHabitName.trim()}
            className="w-full"
          >
            {t.addHabit}
          </Button>
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
        <div
          role="list"
          aria-label={t.habits || 'Habits'}
          className="space-y-2"
        >
          {habits.map((habit) => (
            <CompactHabitCard
              key={habit.id}
              habit={habit}
              onToggle={() => handleHabitToggle(habit)}
              onAdjust={onAdjustHabit}
              onDelete={onDeleteHabit}
              onChallenge={(h) => {
                setChallengeHabit(h);
                setShowChallengeModal(true);
              }}
              streak={habitStreaks.get(habit.id) || 0}
            />
          ))}
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

      {/* Challenge Modal */}
      <ChallengeModal
        open={showChallengeModal}
        onOpenChange={setShowChallengeModal}
        habit={challengeHabit}
      />
    </div>
  );
});
