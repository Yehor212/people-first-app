import { useMoodTheme, supportMessages } from '@/contexts/MoodThemeContext';
import { useLanguage } from '@/contexts/LanguageContext';
import { Heart, Sparkles } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useEffect, useState } from 'react';

// Floating particles for positive moods
function MoodParticles() {
  const { currentTheme, currentMood } = useMoodTheme();

  // Don't show particles for bad/terrible moods
  if (currentMood === 'bad' || currentMood === 'terrible' || currentMood === 'neutral') {
    return null;
  }

  const particleCount = currentMood === 'great' ? 8 : currentMood === 'good' ? 5 : 3;

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
            width: currentMood === 'great' ? '10px' : '6px',
            height: currentMood === 'great' ? '10px' : '6px',
          }}
        />
      ))}
    </>
  );
}

// Support banner for bad moods
function SupportBanner() {
  const { currentMood, getSupportMessage } = useMoodTheme();
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const [dismissed, setDismissed] = useState(false);

  useEffect(() => {
    // Show banner after a delay for bad/terrible moods
    if ((currentMood === 'bad' || currentMood === 'terrible') && !dismissed) {
      const timer = setTimeout(() => setIsVisible(true), 1000);
      return () => clearTimeout(timer);
    } else {
      setIsVisible(false);
    }
  }, [currentMood, dismissed]);

  // Reset dismissed when mood changes to good
  useEffect(() => {
    if (currentMood === 'good' || currentMood === 'great' || currentMood === 'okay') {
      setDismissed(false);
    }
  }, [currentMood]);

  const message = getSupportMessage(language);

  if (!isVisible || !message) return null;

  return (
    <div
      className="fixed left-4 right-4 z-50 animate-fade-in"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      <div className="mood-support-banner rounded-2xl p-4 flex items-start gap-3 max-w-md mx-auto">
        <div className={cn(
          "p-2 rounded-full",
          currentMood === 'terrible' ? "bg-violet-100 dark:bg-violet-900/30" : "bg-sky-100 dark:bg-sky-900/30"
        )}>
          <Heart className={cn(
            "w-5 h-5",
            currentMood === 'terrible' ? "text-violet-500" : "text-sky-500"
          )} />
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

// Breathing exercise suggestion for terrible mood
function BreathingSuggestion() {
  const { currentMood } = useMoodTheme();
  const { t } = useLanguage();
  const [showSuggestion, setShowSuggestion] = useState(false);

  useEffect(() => {
    if (currentMood === 'terrible') {
      const timer = setTimeout(() => setShowSuggestion(true), 3000);
      return () => clearTimeout(timer);
    } else {
      setShowSuggestion(false);
    }
  }, [currentMood]);

  if (!showSuggestion) return null;

  return (
    <div className="fixed top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 pointer-events-none z-0">
      <div className="breathing-suggestion w-32 h-32 rounded-full bg-violet-200/20 dark:bg-violet-800/10" />
    </div>
  );
}

// Celebration sparkles for great mood
function CelebrationSparkles() {
  const { currentMood } = useMoodTheme();

  if (currentMood !== 'great') return null;

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

// Main overlay component
export function MoodBackgroundOverlay() {
  const { isTransitioning } = useMoodTheme();

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

      {/* Mood-specific elements */}
      <MoodParticles />
      <CelebrationSparkles />
      <BreathingSuggestion />
      <SupportBanner />
    </>
  );
}
