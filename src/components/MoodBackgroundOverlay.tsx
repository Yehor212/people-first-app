import { useEmotionTheme, emotionSupportMessages } from '@/contexts/EmotionThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';
import { PrimaryEmotion } from '@/types';

// Positive emotions that get particles
const POSITIVE_EMOTIONS: PrimaryEmotion[] = ['joy', 'trust', 'anticipation', 'surprise'];
// Negative emotions that get support
const NEGATIVE_EMOTIONS: PrimaryEmotion[] = ['sadness', 'anger', 'fear', 'disgust'];

// Floating particles for positive emotions
function EmotionParticles() {
  const { currentEmotion } = useEmotionTheme();

  // Don't show particles for negative/neutral emotions
  if (currentEmotion === 'neutral' || NEGATIVE_EMOTIONS.includes(currentEmotion as PrimaryEmotion)) {
    return null;
  }

  const particleCount = currentEmotion === 'joy' ? 8 : currentEmotion === 'trust' ? 6 : 4;

  return (
    <>
      {Array.from({ length: particleCount }).map((_, i) => (
        <div
          key={i}
          className="mood-particle"
          style={{
            left: `${10 + (i * 12)}%`,
            top: `${20 + (i * 8) % 60}%`,
            animationDelay: `${i * 0.8}s`,
            animationDuration: `${5 + i * 0.5}s`,
            width: currentEmotion === 'joy' ? '10px' : '6px',
            height: currentEmotion === 'joy' ? '10px' : '6px',
          }}
        />
      ))}
    </>
  );
}

// Support banner for difficult emotions
function SupportBanner() {
  const { currentEmotion, getSupportMessage } = useEmotionTheme();
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show banner after a delay for negative emotions
    if (NEGATIVE_EMOTIONS.includes(currentEmotion as PrimaryEmotion) && !dismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [currentEmotion, dismissed]);

  // Reset dismissed when emotion changes to positive
  useEffect(() => {
    if (POSITIVE_EMOTIONS.includes(currentEmotion as PrimaryEmotion) || currentEmotion === 'neutral') {
      setDismissed(false);
    }
  }, [currentEmotion]);

  const message = getSupportMessage(language);

  if (!isVisible || !message) return null;

  // Color based on emotion
  const emotionColors: Record<string, { bg: string; icon: string }> = {
    sadness: { bg: 'bg-indigo-100 dark:bg-indigo-900/30', icon: 'text-indigo-500' },
    anger: { bg: 'bg-blue-100 dark:bg-blue-900/30', icon: 'text-blue-500' }, // Calming blue for anger
    fear: { bg: 'bg-teal-100 dark:bg-teal-900/30', icon: 'text-teal-500' },
    disgust: { bg: 'bg-purple-100 dark:bg-purple-900/30', icon: 'text-purple-500' },
  };

  const colors = emotionColors[currentEmotion] || emotionColors.sadness;

  return (
    <div
      className="fixed left-4 right-4 z-50 animate-fade-in"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mood-support-banner rounded-2xl p-4 flex items-start gap-3 max-w-md mx-auto">
        <div className={cn("p-2 rounded-full", colors.bg)}>
          <Heart className={cn("w-5 h-5", colors.icon)} />
        </div>
        <div className="flex-1">
          <p className="text-sm text-foreground/90 leading-relaxed">
            {message}
          </p>
        </div>
        <button
          onClick={() => setDismissed(true)}
          className="text-muted-foreground hover:text-foreground transition-colors p-1"
          aria-label="Dismiss"
        >
          <span className="text-lg">&times;</span>
        </button>
      </div>
    </div>
  );
}

// Breathing exercise suggestion for intense negative emotions
function BreathingSuggestion() {
  const { currentEmotion } = useEmotionTheme();
  const [showSuggestion, setShowSuggestion] = useState(false);

  // Show for sadness (grief) or anger (rage)
  const shouldShow = currentEmotion === 'sadness' || currentEmotion === 'anger';

  useEffect(() => {
    if (shouldShow) {
      const timer = setTimeout(() => setShowSuggestion(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSuggestion(false);
    }
  }, [shouldShow]);

  if (!showSuggestion) return null;

  const bgColor = currentEmotion === 'anger'
    ? 'bg-blue-200/20 dark:bg-blue-800/10'  // Calming blue for anger
    : 'bg-indigo-200/20 dark:bg-indigo-800/10';

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
      <div className={cn("breathing-suggestion w-32 h-32 rounded-full", bgColor)} />
    </div>
  );
}

// Celebration sparkles for joy emotion
function CelebrationSparkles() {
  const { currentEmotion } = useEmotionTheme();

  if (currentEmotion !== 'joy') return null;

  return (
    <div className="fixed inset-0 pointer-events-none overflow-hidden z-0">
      {Array.from({ length: 5 }).map((_, i) => (
        <Sparkles
          key={i}
          className="absolute text-amber-400/30 animate-pulse"
          style={{
            left: `${15 + i * 18}%`,
            top: `${10 + (i * 15) % 40}%`,
            width: '24px',
            height: '24px',
            animationDelay: `${i * 0.3}s`,
            animationDuration: '2s',
          }}
        />
      ))}
    </div>
  );
}

// Main overlay component (renamed from MoodBackgroundOverlay but keeping export name for compatibility)
export function MoodBackgroundOverlay() {
  const { isTransitioning } = useEmotionTheme();

  return (
    <>
      {/* Background gradient overlay */}
      <div className={cn(
        "mood-background-overlay",
        isTransitioning && "mood-transitioning"
      )} />

      {/* Transition flash effect */}
      <div className={cn(
        "mood-transition-overlay",
        isTransitioning && "active"
      )} />

      {/* Emotion-specific elements */}
      <EmotionParticles />
      <CelebrationSparkles />
      <BreathingSuggestion />
      <SupportBanner />
    </>
  );
}
