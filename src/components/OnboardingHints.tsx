/**
 * Onboarding Hints - Contextual tips shown after tutorial completion
 * Helps ADHD users discover features gradually without overwhelming them
 */

import { useState, useEffect } from 'react';
import { X, Lightbulb, ChevronRight, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface OnboardingHintsProps {
  hasCompletedTutorial: boolean;
  hasMoodToday: boolean;
  hasHabits: boolean;
  hasFocusSession: boolean;
  hasGratitude: boolean;
  onDismiss: (hintId: string) => void;
  dismissedHints: string[];
  onNavigate?: (section: 'mood' | 'habits' | 'focus' | 'gratitude') => void;
}

// Map hint IDs to navigation targets
const HINT_NAVIGATION: Record<string, 'mood' | 'habits' | 'focus' | 'gratitude'> = {
  first_mood: 'mood',
  first_habit: 'habits',
  first_focus: 'focus',
  first_gratitude: 'gratitude',
};

interface Hint {
  id: string;
  condition: (props: OnboardingHintsProps) => boolean;
  priority: number;
}

const hints: Hint[] = [
  {
    id: 'first_mood',
    condition: (p) => p.hasCompletedTutorial && !p.hasMoodToday,
    priority: 1,
  },
  {
    id: 'first_habit',
    condition: (p) => p.hasCompletedTutorial && p.hasMoodToday && !p.hasHabits,
    priority: 2,
  },
  {
    id: 'first_focus',
    condition: (p) => p.hasCompletedTutorial && p.hasMoodToday && p.hasHabits && !p.hasFocusSession,
    priority: 3,
  },
  {
    id: 'first_gratitude',
    condition: (p) => p.hasCompletedTutorial && p.hasMoodToday && !p.hasGratitude,
    priority: 4,
  },
  {
    id: 'schedule_tip',
    condition: (p) => p.hasCompletedTutorial && p.hasMoodToday && p.hasHabits,
    priority: 5,
  },
];

export function OnboardingHints(props: OnboardingHintsProps) {
  const { t } = useLanguage();
  const [currentHint, setCurrentHint] = useState<Hint | null>(null);
  const [isVisible, setIsVisible] = useState(false);
  const [isAnimating, setIsAnimating] = useState(false);

  // Hint content with translations
  const getHintContent = (id: string) => {
    const content: Record<string, { title: string; description: string; action?: string }> = {
      first_mood: {
        title: t.hintFirstMoodTitle || "How are you feeling?",
        description: t.hintFirstMoodDesc || "Start your day by logging your mood. It takes just 5 seconds and helps you understand yourself better!",
        action: t.hintFirstMoodAction || "Log mood",
      },
      first_habit: {
        title: t.hintFirstHabitTitle || "Build your first habit",
        description: t.hintFirstHabitDesc || "Small habits lead to big changes. Try adding something simple like 'Drink water' or 'Take a break'.",
        action: t.hintFirstHabitAction || "Add habit",
      },
      first_focus: {
        title: t.hintFirstFocusTitle || "Ready to focus?",
        description: t.hintFirstFocusDesc || "Use the focus timer with calming sounds. Start with just 25 minutes - your brain will thank you!",
        action: t.hintFirstFocusAction || "Start focus",
      },
      first_gratitude: {
        title: t.hintFirstGratitudeTitle || "Practice gratitude",
        description: t.hintFirstGratitudeDesc || "Write down one thing you're grateful for. It's a powerful mood booster!",
        action: t.hintFirstGratitudeAction || "Add gratitude",
      },
      schedule_tip: {
        title: t.hintScheduleTipTitle || "Plan your day",
        description: t.hintScheduleTipDesc || "Use the timeline to see your day at a glance. Add events to stay on track!",
        action: t.hintScheduleTipAction || "View timeline",
      },
    };
    return content[id] || { title: '', description: '' };
  };

  // Find the most relevant hint to show
  useEffect(() => {
    if (!props.hasCompletedTutorial) {
      setCurrentHint(null);
      return;
    }

    const availableHints = hints
      .filter(h => h.condition(props) && !props.dismissedHints.includes(h.id))
      .sort((a, b) => a.priority - b.priority);

    if (availableHints.length > 0 && availableHints[0] !== currentHint) {
      setIsAnimating(true);
      setTimeout(() => {
        setCurrentHint(availableHints[0]);
        setIsVisible(true);
        setIsAnimating(false);
      }, 300);
    } else if (availableHints.length === 0) {
      setCurrentHint(null);
      setIsVisible(false);
    }
  }, [props, currentHint]);

  const handleDismiss = () => {
    if (currentHint) {
      setIsAnimating(true);
      setTimeout(() => {
        props.onDismiss(currentHint.id);
        setIsVisible(false);
        setIsAnimating(false);
      }, 200);
    }
  };

  if (!currentHint || !isVisible) return null;

  const content = getHintContent(currentHint.id);

  return (
    <div
      className={cn(
        "bg-gradient-to-r from-primary/10 via-accent/10 to-primary/10 rounded-2xl p-4 border border-primary/20 transition-all duration-300",
        isAnimating ? "opacity-0 translate-y-2" : "opacity-100 translate-y-0"
      )}
    >
      <div className="flex items-start gap-3">
        {/* Icon */}
        <div className="w-10 h-10 rounded-xl bg-primary/20 flex items-center justify-center flex-shrink-0">
          <Lightbulb className="w-5 h-5 text-primary animate-pulse" />
        </div>

        {/* Content */}
        <div className="flex-1 min-w-0">
          <div className="flex items-center gap-2 mb-1">
            <h3 className="font-semibold text-foreground text-sm">
              {content.title}
            </h3>
            <Sparkles className="w-4 h-4 text-yellow-500" />
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            {content.description}
          </p>

          {content.action && (
            <button
              onClick={() => {
                const target = HINT_NAVIGATION[currentHint.id];
                if (target && props.onNavigate) {
                  props.onNavigate(target);
                  handleDismiss();
                }
              }}
              className="mt-2 text-xs font-medium text-primary flex items-center gap-1 hover:underline"
            >
              {content.action}
              <ChevronRight className="w-3 h-3" />
            </button>
          )}
        </div>

        {/* Dismiss */}
        <button
          onClick={handleDismiss}
          className="p-1 hover:bg-muted rounded-lg transition-colors flex-shrink-0"
        >
          <X className="w-4 h-4 text-muted-foreground" />
        </button>
      </div>
    </div>
  );
}
