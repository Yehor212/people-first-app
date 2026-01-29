/**
 * MindfulMoment - Micro-mindfulness popup
 * ADHD-friendly: Quick 10-30 second check-ins that don't break flow
 * Shows after focus sessions or on demand
 */

import { useState, useEffect, useCallback } from 'react';
import { X, Heart, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  MindfulPrompt,
  MINDFUL_TYPE_LABELS,
  getMindfulPromptText,
  getRandomMindfulPrompt,
  getRandomPostFocusPrompt,
} from '@/lib/mindfulPrompts';

interface MindfulMomentProps {
  isOpen: boolean;
  onClose: () => void;
  onComplete?: () => void;
  trigger?: 'focus' | 'manual' | 'random';
  prompt?: MindfulPrompt; // Optional specific prompt
}

// Quick response options - use translation keys
const QUICK_RESPONSES = [
  { emoji: '😊', labelKey: 'moodGood' as const },
  { emoji: '😐', labelKey: 'moodOkay' as const },
  { emoji: '😔', labelKey: 'moodNotGreat' as const },
] as const;

export function MindfulMoment({
  isOpen,
  onClose,
  onComplete,
  trigger = 'manual',
  prompt: providedPrompt,
}: MindfulMomentProps) {
  const { language, t } = useLanguage();
  const [currentPrompt, setCurrentPrompt] = useState<MindfulPrompt | null>(null);
  const [countdown, setCountdown] = useState(0);
  const [showResponse, setShowResponse] = useState(false);

  // Initialize prompt when opened
  useEffect(() => {
    if (isOpen) {
      const prompt = providedPrompt
        || (trigger === 'focus' ? getRandomPostFocusPrompt() : getRandomMindfulPrompt());
      setCurrentPrompt(prompt);
      setCountdown(prompt.duration);
      setShowResponse(false);
    }
  }, [isOpen, providedPrompt, trigger]);

  // Countdown timer
  useEffect(() => {
    if (!isOpen || countdown <= 0) return;

    const timer = setInterval(() => {
      setCountdown(prev => {
        if (prev <= 1) {
          setShowResponse(true);
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(timer);
  }, [isOpen, countdown]);

  // Handle response selection
  const handleResponse = useCallback(() => {
    onComplete?.();
    onClose();
  }, [onComplete, onClose]);

  // Handle skip
  const handleSkip = useCallback(() => {
    onClose();
  }, [onClose]);

  if (!isOpen || !currentPrompt) return null;

  const promptText = getMindfulPromptText(currentPrompt, language);
  const typeLabel = MINDFUL_TYPE_LABELS[currentPrompt.type][language] || MINDFUL_TYPE_LABELS[currentPrompt.type].en;

  return (
    <div className="fixed inset-0 bg-black/60 backdrop-blur-sm flex items-center justify-center z-[70] p-4 animate-fade-in">
      <div className="bg-card rounded-3xl p-6 w-full max-w-sm animate-scale-in shadow-2xl">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-2">
            <div className="w-8 h-8 rounded-full bg-accent/20 flex items-center justify-center">
              <Sparkles className="w-4 h-4 text-accent" />
            </div>
            <div>
              <h3 className="font-semibold text-foreground text-lg">
                {t.mindfulMoment || 'Mindful Moment'}
              </h3>
              <span className="text-xs text-muted-foreground">{typeLabel}</span>
            </div>
          </div>
          <button
            onClick={handleSkip}
            className="p-2 hover:bg-secondary rounded-full transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Prompt */}
        <div className="text-center mb-6">
          {currentPrompt.emoji && (
            <div className="text-5xl mb-4 animate-pulse">{currentPrompt.emoji}</div>
          )}
          <p className="text-xl font-medium text-foreground leading-relaxed">
            {promptText}
          </p>
        </div>

        {/* Timer or Response */}
        {!showResponse ? (
          <div className="text-center mb-6">
            <div className="relative w-20 h-20 mx-auto">
              {/* Progress ring */}
              <svg className="w-20 h-20 -rotate-90">
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="hsl(var(--secondary))"
                  strokeWidth="4"
                  fill="none"
                />
                <circle
                  cx="40"
                  cy="40"
                  r="36"
                  stroke="hsl(var(--accent))"
                  strokeWidth="4"
                  fill="none"
                  strokeLinecap="round"
                  strokeDasharray={`${2 * Math.PI * 36}`}
                  strokeDashoffset={`${2 * Math.PI * 36 * (1 - countdown / currentPrompt.duration)}`}
                  className="transition-all duration-1000"
                />
              </svg>
              <span className="absolute inset-0 flex items-center justify-center text-2xl font-bold text-foreground">
                {countdown}
              </span>
            </div>
            <p className="text-sm text-muted-foreground mt-2">
              {t.takeAMoment || 'Take a moment...'}
            </p>
          </div>
        ) : (
          <div className="space-y-4">
            {/* Quick response buttons */}
            {currentPrompt.type === 'checkin' && (
              <div className="flex justify-center gap-3">
                {QUICK_RESPONSES.map((response) => (
                  <button
                    key={response.labelKey}
                    onClick={handleResponse}
                    className="flex flex-col items-center gap-1 p-3 bg-secondary hover:bg-secondary/80 rounded-xl transition-colors min-w-[70px]"
                  >
                    <span className="text-2xl">{response.emoji}</span>
                    <span className="text-xs text-muted-foreground">
                      {t[response.labelKey] || response.labelKey}
                    </span>
                  </button>
                ))}
              </div>
            )}

            {/* Done button for non-checkin prompts */}
            {currentPrompt.type !== 'checkin' && (
              <button
                onClick={handleResponse}
                className="w-full py-3 zen-gradient text-primary-foreground rounded-xl font-semibold flex items-center justify-center gap-2"
              >
                <Heart className="w-5 h-5" />
                {t.done || 'Done'}
              </button>
            )}
          </div>
        )}

        {/* Skip link */}
        {!showResponse && (
          <button
            onClick={handleSkip}
            className="w-full py-2 text-sm text-muted-foreground hover:text-foreground transition-colors"
          >
            {t.skip || 'Skip'}
          </button>
        )}

        {/* XP hint */}
        <p className="text-xs text-center text-muted-foreground mt-4">
          +3 XP • +1 {t.treat || 'treat'}
        </p>
      </div>
    </div>
  );
}
