/**
 * SmartRemindersCard - Display smart reminder suggestions based on patterns
 * Part of v1.5.0 Intelligence & Speed
 */

import { memo, useMemo, useState } from 'react';
import {
  Sparkles,
  Clock,
  Check,
  X,
  ChevronDown,
  ChevronUp,
  Lightbulb,
  TrendingUp,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodEntry, Habit, FocusSession, ReminderSettings } from '@/types';
import {
  generateSmartSuggestions,
  generateHabitReminderSuggestions,
  hasEnoughDataForSmartReminders,
  SmartReminderSuggestion,
  HabitReminderSuggestion,
} from '@/lib/smartReminders';
import { hapticTap, hapticSuccess } from '@/lib/haptics';

// ============================================
// TYPES
// ============================================

interface SmartRemindersCardProps {
  currentSettings: ReminderSettings;
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  onApplySuggestion?: (type: 'mood' | 'habit' | 'focus', time: string) => void;
  onApplyHabitSuggestion?: (habitId: string, time: string) => void;
  className?: string;
}

// ============================================
// SUGGESTION ITEM
// ============================================

function SuggestionItem({
  suggestion,
  onApply,
  onDismiss,
  t,
}: {
  suggestion: SmartReminderSuggestion;
  onApply: () => void;
  onDismiss: () => void;
  t: Record<string, string>;
}) {
  const confidenceColors = {
    high: 'bg-emerald-500/10 text-emerald-600 border-emerald-500/30',
    medium: 'bg-amber-500/10 text-amber-600 border-amber-500/30',
    low: 'bg-muted text-muted-foreground border-border',
  };

  return (
    <div className="p-3 bg-card rounded-xl border border-border hover:border-primary/30 motion-safe:transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{suggestion.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="mb-1 flex flex-wrap items-start gap-2">
            <span className="min-w-0 break-words text-sm font-medium capitalize text-foreground">
              {suggestion.type === 'mood' ? t.mood || 'Mood' :
               suggestion.type === 'habit' ? t.habits || 'Habits' :
               t.focus || 'Focus'}
            </span>
            <span className={cn(
              'max-w-full break-words rounded-full border px-2 py-0.5 text-xs',
              confidenceColors[suggestion.confidence]
            )}>
              {suggestion.confidence === 'high' ? t.highConfidence || 'Stronger signal' :
               suggestion.confidence === 'medium' ? t.mediumConfidence || 'Medium' :
               t.lowConfidence || 'Suggestion'}
            </span>
          </div>

          <p className="mb-2 break-words text-xs text-muted-foreground">
            {suggestion.reason}
          </p>

          <div className="flex flex-wrap items-center gap-3 text-sm">
            <div className="flex items-center gap-1 text-muted-foreground">
              <Clock className="w-3 h-3" />
              <span className="line-through">{suggestion.currentTime}</span>
            </div>
            <TrendingUp className="w-3 h-3 text-primary" />
            <div className="flex items-center gap-1 font-medium text-primary">
              <Clock className="w-3 h-3" />
              <span>{suggestion.suggestedTime}</span>
            </div>
          </div>

          {suggestion.improvement && (
            <p className="mt-2 flex items-start gap-1 text-xs text-muted-foreground">
              <Lightbulb className="h-3 w-3 shrink-0" />
              <span className="min-w-0 break-words">{suggestion.improvement}</span>
            </p>
          )}
        </div>
      </div>

      <div className="mt-3 flex flex-col items-stretch gap-2 border-t border-border pt-3 min-[420px]:flex-row">
        <button
          onClick={() => {
            void hapticSuccess();
            onApply();
          }}
          className="flex h-auto min-h-11 flex-1 items-center justify-center gap-1 whitespace-normal break-words rounded-lg bg-primary/10 px-3 py-2 text-center text-xs font-medium text-primary motion-safe:transition-colors hover:bg-primary/20"
        >
          <Check className="w-3 h-3" aria-hidden="true" />
          {t.apply || 'Apply'}
        </button>
        <button
          onClick={() => {
            void hapticTap();
            onDismiss();
          }}
          className="flex min-h-11 min-w-11 items-center justify-center rounded-lg bg-muted px-3 py-2 text-xs text-muted-foreground motion-safe:transition-colors hover:bg-muted/80"
          aria-label={t.dismiss || 'Dismiss'}
        >
          <X className="w-3 h-3" />
        </button>
      </div>
    </div>
  );
}

// ============================================
// HABIT SUGGESTION ITEM
// ============================================

function HabitSuggestionItem({
  suggestion,
  _onApply,
  t,
}: {
  suggestion: HabitReminderSuggestion;
  _onApply: () => void;
  t: Record<string, string>;
}) {
  const confidenceColors = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    low: 'text-muted-foreground',
  };

  return (
    <div className="flex flex-col items-stretch gap-2 min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted motion-safe:transition-colors">
      <div className="flex min-w-0 items-start gap-2">
        <span className="text-lg flex-shrink-0">{suggestion.habitIcon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground [overflow-wrap:anywhere]">
            {suggestion.habitName}
          </p>
          <p className="break-words text-xs text-muted-foreground">
            {suggestion.reason}
          </p>
        </div>
      </div>
      <div className="flex flex-wrap items-center gap-2 min-[420px]:justify-end">
        <span className={cn('text-xs font-medium', confidenceColors[suggestion.confidence])}>
          {suggestion.suggestedTime}
        </span>
        {suggestion.patternBased && (
          <span className="text-xs px-1.5 py-0.5 bg-violet-500/10 text-violet-600 rounded">
            {t.patternBased || 'Pattern'}
          </span>
        )}
      </div>
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export const SmartRemindersCard = memo(function SmartRemindersCard({
  currentSettings,
  moods,
  habits,
  focusSessions,
  onApplySuggestion,
  onApplyHabitSuggestion,
  className,
}: SmartRemindersCardProps) {
  const { t } = useLanguage();
  const [dismissedIds, setDismissedIds] = useState<Set<string>>(new Set());
  const [showHabitSuggestions, setShowHabitSuggestions] = useState(false);

  // Check if enough data
  const hasEnoughData = useMemo(
    () => hasEnoughDataForSmartReminders(moods, habits, focusSessions),
    [moods, habits, focusSessions]
  );

  // Generate suggestions
  const suggestions = useMemo<SmartReminderSuggestion[]>(() => {
    if (!hasEnoughData) return [];
    return generateSmartSuggestions(currentSettings, moods, habits, focusSessions);
  }, [currentSettings, moods, habits, focusSessions, hasEnoughData]);

  const habitSuggestions = useMemo<HabitReminderSuggestion[]>(() => {
    if (habits.length === 0) return [];
    return generateHabitReminderSuggestions(habits, moods);
  }, [habits, moods]);

  // Filter out dismissed suggestions
  const activeSuggestions = suggestions.filter(s => !dismissedIds.has(s.id));

  const handleDismiss = (id: string) => {
    setDismissedIds(prev => new Set([...prev, id]));
  };

  const handleApply = (suggestion: SmartReminderSuggestion) => {
    if (onApplySuggestion) {
      onApplySuggestion(suggestion.type, suggestion.suggestedTime);
    }
    handleDismiss(suggestion.id);
  };

  // Not enough data state
  if (!hasEnoughData) {
    return (
      <div className={cn('bg-card rounded-2xl p-4 border border-border', className)}>
        <div className="flex items-start gap-3">
          <Sparkles className="w-5 h-5 text-violet-500 flex-shrink-0 mt-0.5" />
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm mb-1">
              {t.smartReminders || 'Smart Reminders'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.smartRemindersNotEnoughData || 'Keep using the app to see reminder suggestions based on recent activity.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  // No suggestions state
  if (activeSuggestions.length === 0 && habitSuggestions.length === 0) {
    return (
      <div className={cn('bg-card rounded-2xl p-4 border border-border', className)}>
        <div className="flex items-start gap-3">
          <div className="p-2 bg-emerald-500/10 rounded-xl">
            <Check className="w-4 h-4 text-emerald-500" />
          </div>
          <div className="min-w-0">
            <h3 className="font-semibold text-foreground text-sm mb-1">
              {t.smartReminders || 'Smart Reminders'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.smartRemindersOptimized || 'Your current reminder times match your recent patterns.'}
            </p>
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn('bg-card rounded-2xl border border-border overflow-hidden', className)}>
      {/* Header */}
      <div className="p-4 bg-gradient-to-r from-violet-500/10 to-fuchsia-500/10 border-b border-border">
        <div className="flex flex-wrap items-center gap-2">
          <Sparkles className="h-5 w-5 shrink-0 text-violet-500" />
          <h3 className="min-w-0 break-words font-semibold text-foreground">
            {t.smartReminders || 'Smart Reminders'}
          </h3>
          {activeSuggestions.length > 0 && (
            <span className="max-w-full break-words rounded-full bg-violet-500/20 px-2 py-0.5 text-xs font-medium text-violet-600 dark:text-violet-400">
              {activeSuggestions.length} {t.suggestions || 'suggestions'}
            </span>
          )}
        </div>
        <p className="mt-1 break-words text-xs text-muted-foreground">
          {t.smartRemindersDescription || 'Suggestions based on recent app activity'}
        </p>
      </div>

      {/* Main Suggestions */}
      {activeSuggestions.length > 0 && (
        <div className="p-4 space-y-3">
          {activeSuggestions.map(suggestion => (
            <SuggestionItem
              key={suggestion.id}
              suggestion={suggestion}
              onApply={() => handleApply(suggestion)}
              onDismiss={() => handleDismiss(suggestion.id)}
              t={t as unknown as Record<string, string>}
            />
          ))}
        </div>
      )}

      {/* Habit Suggestions */}
      {habitSuggestions.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => {
              void hapticTap();
              setShowHabitSuggestions(!showHabitSuggestions);
            }}
            className="flex min-h-11 w-full items-start justify-between gap-3 p-4 text-start motion-safe:transition-colors hover:bg-muted/50"
          >
            <div className="flex min-w-0 flex-1 flex-wrap items-center gap-2">
              <Clock className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 break-words text-sm font-medium text-foreground">
                {t.habitRemindersOptimal || 'Suggested habit times'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({habitSuggestions.length})
              </span>
            </div>
            {showHabitSuggestions ? (
              <ChevronUp className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            ) : (
              <ChevronDown className="h-4 w-4 shrink-0 text-muted-foreground" aria-hidden="true" />
            )}
          </button>

          {showHabitSuggestions && (
            <div className="px-4 pb-4 space-y-2 motion-safe:animate-fade-in">
              {habitSuggestions.map(suggestion => (
                <HabitSuggestionItem
                  key={suggestion.habitId}
                  suggestion={suggestion}
                  _onApply={() => {
                    if (onApplyHabitSuggestion) {
                      onApplyHabitSuggestion(suggestion.habitId, suggestion.suggestedTime);
                    }
                  }}
                  t={t as unknown as Record<string, string>}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
});

export default SmartRemindersCard;
