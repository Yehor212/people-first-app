import { useMemo, useEffect, useRef } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ChevronRight } from 'lucide-react';
import { setCalendarPosition } from './FlyingMoodEmoji';
import { EmojiOrIcon } from '@/components/icons';

interface DailyProgressProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  onNavigate?: (section: 'mood' | 'habits' | 'focus' | 'gratitude') => void;
}

interface ProgressItem {
  key: string;
  label: string;
  emoji: string;
  iconName?: string;
  completedEmoji: string;
  completed: boolean;
  progress?: string;
  color: string;
  onClick?: () => void;
}

export function DailyProgress({ moods, habits, focusSessions, gratitudeEntries, onNavigate }: DailyProgressProps) {
  const { t } = useLanguage();
  const today = getToday();

  const progress = useMemo(() => {
    const hasMood = moods.some(m => m.date === today);
    const completedHabits = habits.filter(h => h.completedDates?.includes(today)).length;
    const totalHabits = habits.length;
    const todayFocus = focusSessions.filter(s => s.date === today).reduce((acc, s) => acc + s.duration, 0);
    const hasGratitude = gratitudeEntries.some(e => e.date === today);

    return {
      mood: hasMood,
      habits: { completed: completedHabits, total: totalHabits },
      focus: todayFocus,
      gratitude: hasGratitude,
    };
  }, [moods, habits, focusSessions, gratitudeEntries, today]);

  const items: ProgressItem[] = [
    {
      key: 'mood',
      label: t.moodToday || "Today's Mood",
      emoji: '😊',
      completedEmoji: '✅',
      completed: progress.mood,
      color: 'bg-mood-great',
      onClick: () => onNavigate?.('mood'),
    },
    {
      key: 'habits',
      label: t.habits || 'Habits',
      emoji: '🎯',
      iconName: 'target',
      completedEmoji: '✅',
      completed: progress.habits.total > 0 && progress.habits.completed >= progress.habits.total,
      progress: progress.habits.total > 0 ? `${progress.habits.completed}/${progress.habits.total}` : undefined,
      color: 'bg-primary',
      onClick: () => onNavigate?.('habits'),
    },
    {
      key: 'focus',
      label: t.focusSession || 'Focus',
      emoji: '🧠',
      completedEmoji: '✅',
      completed: progress.focus >= 25,
      progress: progress.focus > 0 ? `${progress.focus} ${t.min}` : undefined,
      color: 'bg-accent',
      onClick: () => onNavigate?.('focus'),
    },
    {
      key: 'gratitude',
      label: t.gratitude || 'Gratitude',
      emoji: '💜',
      completedEmoji: '✅',
      completed: progress.gratitude,
      color: 'bg-mood-good',
      onClick: () => onNavigate?.('gratitude'),
    },
  ];

  const completedCount = items.filter(i => i.completed).length;
  const allComplete = completedCount === items.length;

  // Ref for the mood item to use as flying emoji target
  const moodItemRef = useRef<HTMLButtonElement>(null);

  // Register mood item position for flying emoji
  useEffect(() => {
    const updatePosition = () => {
      if (moodItemRef.current) {
        const rect = moodItemRef.current.getBoundingClientRect();
        setCalendarPosition(
          rect.left + rect.width / 2,
          rect.top + rect.height / 2
        );
      }
    };

    updatePosition();
    window.addEventListener('scroll', updatePosition, { passive: true });
    window.addEventListener('resize', updatePosition);

    return () => {
      window.removeEventListener('scroll', updatePosition);
      window.removeEventListener('resize', updatePosition);
    };
  }, []);

  // Don't show if all complete - let celebrations handle that
  if (allComplete) {
    return null;
  }

  return (
    <div className="bg-card rounded-2xl p-4 zen-shadow-card animate-fade-in">
      {/* Progress header */}
      <div className="flex items-center justify-between mb-3">
        <h3 className="text-sm font-medium text-muted-foreground">
          {t.dailyProgress || 'Daily Progress'}
        </h3>
        <div className="flex items-center gap-1">
          <span className="text-lg font-bold text-primary">{completedCount}</span>
          <span className="text-sm text-muted-foreground">/ {items.length}</span>
        </div>
      </div>

      {/* Progress bar */}
      <div className="h-2 bg-secondary rounded-full mb-4 overflow-hidden">
        <div
          className="h-full bg-gradient-to-r from-primary to-accent transition-all duration-500 rounded-full"
          style={{ width: `${(completedCount / items.length) * 100}%` }}
        />
      </div>

      {/* Items */}
      <div className="flex justify-between gap-2">
        {items.map((item) => (
          <button
            key={item.key}
            ref={item.key === 'mood' ? moodItemRef : undefined}
            onClick={item.onClick}
            className={cn(
              "flex-1 flex flex-col items-center gap-1.5 p-2 rounded-xl transition-all",
              item.completed
                ? "bg-secondary/50"
                : "bg-primary/5 hover:bg-primary/10 ring-1 ring-primary/20"
            )}
          >
            <div className={cn(
              "w-10 h-10 rounded-full flex items-center justify-center transition-all",
              item.completed
                ? `${item.color} bg-opacity-20`
                : "bg-primary/10"
            )}>
              {item.completed ? (
                <span className="text-xl">{item.completedEmoji}</span>
              ) : (
                <EmojiOrIcon emoji={item.emoji} iconName={item.iconName} size="sm" />
              )}
            </div>
            <span className={cn(
              "text-xs font-medium truncate w-full text-center",
              item.completed ? "text-muted-foreground" : "text-foreground"
            )}>
              {item.progress || (item.completed ? '✓' : item.label)}
            </span>
          </button>
        ))}
      </div>

      {/* Next action hint */}
      {completedCount < items.length && (
        <div className="mt-3 pt-3 border-t border-border/50">
          <button
            onClick={() => {
              const nextIncomplete = items.find(i => !i.completed);
              nextIncomplete?.onClick?.();
            }}
            className="w-full flex items-center justify-between p-2 bg-primary/5 hover:bg-primary/10 rounded-lg transition-colors group"
          >
            <span className="text-xs text-primary font-medium">
              {t.continueProgress || 'Continue your progress'}
            </span>
            <ChevronRight className="w-4 h-4 text-primary group-hover:translate-x-1 transition-transform" />
          </button>
        </div>
      )}
    </div>
  );
}
