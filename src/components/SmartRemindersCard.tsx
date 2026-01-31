/**
 * SmartRemindersCard - Display smart reminder suggestions based on patterns
 * Part of v1.5.0 Intelligence & Speed
 */

import { useMemo, useState } from 'react';
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
    <div className="p-3 bg-card rounded-xl border border-border hover:border-primary/30 transition-colors">
      <div className="flex items-start gap-3">
        <div className="text-2xl flex-shrink-0">{suggestion.icon}</div>
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <span className="text-sm font-medium text-foreground capitalize">
              {suggestion.type === 'mood' ? t.mood || 'Mood' :
               suggestion.type === 'habit' ? t.habits || 'Habits' :
               t.focus || 'Focus'}
            </span>
            <span className={cn(
              'text-xs px-2 py-0.5 rounded-full border',
              confidenceColors[suggestion.confidence]
            )}>
              {suggestion.confidence === 'high' ? t.highConfidence || 'High confidence' :
               suggestion.confidence === 'medium' ? t.mediumConfidence || 'Medium' :
               t.lowConfidence || 'Suggestion'}
            </span>
          </div>

          <p className="text-xs text-muted-foreground mb-2">
            {suggestion.reason}
          </p>

          <div className="flex items-center gap-3 text-sm">
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
            <p className="text-xs text-muted-foreground mt-2 flex items-center gap-1">
              <Lightbulb className="w-3 h-3" />
              {suggestion.improvement}
            </p>
          )}
        </div>
      </div>

      <div className="flex gap-2 mt-3 pt-3 border-t border-border">
        <button
          onClick={() => {
            hapticSuccess();
            onApply();
          }}
          className="flex-1 flex items-center justify-center gap-1 px-3 py-2 bg-primary/10 text-primary text-xs font-medium rounded-lg hover:bg-primary/20 transition-colors"
        >
          <Check className="w-3 h-3" />
          {t.apply || 'Apply'}
        </button>
        <button
          onClick={() => {
            hapticTap();
            onDismiss();
          }}
          className="flex items-center justify-center px-3 py-2 bg-muted text-muted-foreground text-xs rounded-lg hover:bg-muted/80 transition-colors"
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
  onApply,
  t,
}: {
  suggestion: HabitReminderSuggestion;
  onApply: () => void;
  t: Record<string, string>;
}) {
  const confidenceColors = {
    high: 'text-emerald-600',
    medium: 'text-amber-600',
    low: 'text-muted-foreground',
  };

  return (
    <div className="flex items-center justify-between p-2 bg-muted/50 rounded-lg hover:bg-muted transition-colors">
      <div className="flex items-center gap-2 min-w-0">
        <span className="text-lg flex-shrink-0">{suggestion.habitIcon}</span>
        <div className="min-w-0">
          <p className="text-sm font-medium text-foreground truncate">
            {suggestion.habitName}
          </p>
          <p className="text-xs text-muted-foreground truncate">
            {suggestion.reason}
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2 flex-shrink-0">
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

export function SmartRemindersCard({
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
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-1">
              {t.smartReminders || 'Smart Reminders'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.smartRemindersNotEnoughData || 'Keep using the app to unlock personalized reminder suggestions based on your patterns.'}
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
          <div>
            <h3 className="font-semibold text-foreground text-sm mb-1">
              {t.smartReminders || 'Smart Reminders'}
            </h3>
            <p className="text-xs text-muted-foreground">
              {t.smartRemindersOptimized || 'Your reminder times are well optimized! Keep up the great work.'}
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
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-violet-500" />
          <h3 className="font-semibold text-foreground">
            {t.smartReminders || 'Smart Reminders'}
          </h3>
          {activeSuggestions.length > 0 && (
            <span className="text-xs bg-violet-500/20 text-violet-600 dark:text-violet-400 px-2 py-0.5 rounded-full font-medium">
              {activeSuggestions.length} {t.suggestions || 'suggestions'}
            </span>
          )}
        </div>
        <p className="text-xs text-muted-foreground mt-1">
          {t.smartRemindersDescription || 'Personalized suggestions based on your usage patterns'}
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
              t={t}
            />
          ))}
        </div>
      )}

      {/* Habit Suggestions */}
      {habitSuggestions.length > 0 && (
        <div className="border-t border-border">
          <button
            onClick={() => {
              hapticTap();
              setShowHabitSuggestions(!showHabitSuggestions);
            }}
            className="w-full flex items-center justify-between p-4 hover:bg-muted/50 transition-colors"
          >
            <div className="flex items-center gap-2">
              <Clock className="w-4 h-4 text-muted-foreground" />
              <span className="text-sm font-medium text-foreground">
                {t.habitRemindersOptimal || 'Optimal habit times'}
              </span>
              <span className="text-xs text-muted-foreground">
                ({habitSuggestions.length})
              </span>
            </div>
            {showHabitSuggestions ? (
              <ChevronUp className="w-4 h-4 text-muted-foreground" />
            ) : (
              <ChevronDown className="w-4 h-4 text-muted-foreground" />
            )}
          </button>

          {showHabitSuggestions && (
            <div className="px-4 pb-4 space-y-2 animate-fade-in">
              {habitSuggestions.map(suggestion => (
                <HabitSuggestionItem
                  key={suggestion.habitId}
                  suggestion={suggestion}
                  onApply={() => {
                    if (onApplyHabitSuggestion) {
                      onApplyHabitSuggestion(suggestion.habitId, suggestion.suggestedTime);
                    }
                  }}
                  t={t}
                />
              ))}
            </div>
          )}
        </div>
      )}
    </div>
  );
}

export default SmartRemindersCard;
