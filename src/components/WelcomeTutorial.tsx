/**
 * Welcome Tutorial - Animated introduction explaining app purpose
 * Designed for both ADHD-aware and general users
 */

import { useState, useEffect, useRef } from 'react';
import { ChevronRight, ChevronLeft, Sparkles, Brain, Target, Heart, Timer, Zap, CheckCircle2, Clock, Palette } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface WelcomeTutorialProps {
  onComplete: () => void;
  onSkip: () => void;
}

// Tutorial slides content - using function to avoid TDZ issues with icon imports
function getSlides() {
  return [
    {
      id: 'welcome',
      icon: Sparkles,
      gradient: 'from-primary/20 to-accent/20',
      iconColor: 'text-primary',
      animation: 'float',
    },
    {
      id: 'brain',
      icon: Brain,
      gradient: 'from-purple-500/20 to-pink-500/20',
      iconColor: 'text-purple-500',
      animation: 'pulse',
    },
    {
      id: 'features',
      icon: Target,
      gradient: 'from-blue-500/20 to-cyan-500/20',
      iconColor: 'text-blue-500',
      animation: 'bounce',
    },
    {
      id: 'dayclock',
      icon: Clock,
      gradient: 'from-amber-500/20 to-orange-500/20',
      iconColor: 'text-amber-500',
      animation: 'spin-slow',
    },
    {
      id: 'moodtheme',
      icon: Palette,
      gradient: 'from-violet-500/20 to-fuchsia-500/20',
      iconColor: 'text-violet-500',
      animation: 'color-shift',
    },
    {
      id: 'mood',
      icon: Heart,
      gradient: 'from-red-500/20 to-orange-500/20',
      iconColor: 'text-red-500',
      animation: 'heartbeat',
    },
    {
      id: 'focus',
      icon: Timer,
      gradient: 'from-green-500/20 to-emerald-500/20',
      iconColor: 'text-green-500',
      animation: 'spin-slow',
    },
    {
      id: 'ready',
      icon: Zap,
      gradient: 'from-yellow-500/20 to-orange-500/20',
      iconColor: 'text-yellow-500',
      animation: 'zap',
    },
  ];
}

export function WelcomeTutorial({ onComplete, onSkip }: WelcomeTutorialProps) {
  const { t } = useLanguage();
  const [currentSlide, setCurrentSlide] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [direction, setDirection] = useState<'next' | 'prev'>('next');

  // Refs for swipe gesture tracking
  const startXRef = useRef(0);
  const isSwipingRef = useRef(false);

  // Get slides array inside component to avoid TDZ issues
  const slides = getSlides();

  // Tutorial content with translations
  const getSlideContent = (id: string) => {
    const content: Record<string, { title: string; subtitle: string; description: string; features?: string[] }> = {
      welcome: {
        title: t.tutorialWelcomeTitle || 'Welcome to ZenFlow',
        subtitle: t.tutorialWelcomeSubtitle || 'Your personal wellness companion',
        description: t.tutorialWelcomeDesc || 'An app designed to help you stay focused, build healthy habits, and feel better every day.',
      },
      brain: {
        title: t.tutorialBrainTitle || 'Built for your brain',
        subtitle: t.tutorialBrainSubtitle || 'Whether you have ADHD or just struggle with focus',
        description: t.tutorialBrainDesc || 'ZenFlow uses science-backed techniques to help you manage attention, time, and energy. No diagnosis needed - if you struggle with focus, this app is for you.',
      },
      features: {
        title: t.tutorialFeaturesTitle || 'What you can do',
        subtitle: t.tutorialFeaturesSubtitle || 'Simple tools, big impact',
        description: t.tutorialFeaturesDesc || 'Track your progress and build momentum:',
        features: [
          t.tutorialFeature1 || 'Track daily mood and energy',
          t.tutorialFeature2 || 'Build habits step by step',
          t.tutorialFeature3 || 'Focus sessions with ambient sounds',
          t.tutorialFeature4 || 'Gratitude journaling',
        ],
      },
      dayclock: {
        title: t.tutorialDayClockTitle || 'Your Day at a Glance',
        subtitle: t.tutorialDayClockSubtitle || 'Visual energy meter for ADHD brains',
        description: t.tutorialDayClockDesc || 'See your day as a circle with morning, afternoon, and evening zones. Watch your energy grow as you complete activities!',
        features: [
          t.tutorialDayClockFeature1 || '⚡ Energy meter fills up with progress',
          t.tutorialDayClockFeature2 || '😊 Mascot reacts to your achievements',
          t.tutorialDayClockFeature3 || '🎯 Track all activities in one place',
          t.tutorialDayClockFeature4 || '🏆 Reach 100% for Perfect Day!',
        ],
      },
      moodtheme: {
        title: t.tutorialMoodThemeTitle || 'App Adapts to You',
        subtitle: t.tutorialMoodThemeSubtitle || 'Design changes with your mood',
        description: t.tutorialMoodThemeDesc || 'When you feel great, the app celebrates with vibrant colors. When you feel down, it becomes calm and supportive.',
        features: [
          t.tutorialMoodThemeFeature1 || '😄 Great mood: Vibrant purple & gold',
          t.tutorialMoodThemeFeature2 || '🙂 Good mood: Warm greens',
          t.tutorialMoodThemeFeature3 || '😔 Bad mood: Calming blues',
          t.tutorialMoodThemeFeature4 || '😢 Tough times: Gentle, minimal design',
        ],
      },
      mood: {
        title: t.tutorialMoodTitle || 'Understand yourself',
        subtitle: t.tutorialMoodSubtitle || 'Track moods to find patterns',
        description: t.tutorialMoodDesc || 'Quick daily check-ins help you notice what affects your energy and focus. Over time, you\'ll understand yourself better.',
      },
      focus: {
        title: t.tutorialFocusTitle || 'Deep focus mode',
        subtitle: t.tutorialFocusSubtitle || 'Block distractions, get things done',
        description: t.tutorialFocusDesc || 'Use the Pomodoro technique with calming ambient sounds. Perfect for work, study, or creative projects.',
      },
      ready: {
        title: t.tutorialReadyTitle || 'Ready to start?',
        subtitle: t.tutorialReadySubtitle || 'Your journey begins now',
        description: t.tutorialReadyDesc || 'Start small - just check in with how you\'re feeling today. Every step counts!',
      },
    };
    return content[id] || { title: '', subtitle: '', description: '' };
  };

  const handleNext = () => {
    if (isAnimating) return;
    if (currentSlide === slides.length - 1) {
      onComplete();
      return;
    }
    setDirection('next');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(prev => prev + 1);
      setIsAnimating(false);
    }, 300);
  };

  const handlePrev = () => {
    if (isAnimating || currentSlide === 0) return;
    setDirection('prev');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(prev => prev - 1);
      setIsAnimating(false);
    }, 300);
  };

  const handleDotClick = (index: number) => {
    if (isAnimating || index === currentSlide) return;
    setDirection(index > currentSlide ? 'next' : 'prev');
    setIsAnimating(true);
    setTimeout(() => {
      setCurrentSlide(index);
      setIsAnimating(false);
    }, 300);
  };

  // Swipe gesture handlers
  const handleTouchStart = (e: React.TouchEvent) => {
    startXRef.current = e.touches[0].clientX;
    isSwipingRef.current = false;
  };

  const handleTouchMove = (e: React.TouchEvent) => {
    if (!startXRef.current) return;

    const currentX = e.touches[0].clientX;
    const diff = Math.abs(currentX - startXRef.current);

    // Detect horizontal swipe (threshold: 10px)
    if (diff > 10) {
      isSwipingRef.current = true;
    }
  };

  const handleTouchEnd = (e: React.TouchEvent) => {
    if (!isSwipingRef.current || !startXRef.current || isAnimating) {
      startXRef.current = 0;
      isSwipingRef.current = false;
      return;
    }

    const endX = e.changedTouches[0].clientX;
    const diff = endX - startXRef.current;
    const threshold = window.innerWidth * 0.3; // 30% of screen width
    const MIN_DISTANCE = 50;

    if (Math.abs(diff) > MIN_DISTANCE && Math.abs(diff) > threshold) {
      if (diff > 0 && currentSlide > 0) {
        // Swipe right = previous slide
        handlePrev();
        navigator.vibrate?.(10); // Haptic feedback
      } else if (diff < 0 && currentSlide < slides.length - 1) {
        // Swipe left = next slide
        handleNext();
        navigator.vibrate?.(10);
      }
    }

    startXRef.current = 0;
    isSwipingRef.current = false;
  };

  const slide = slides[currentSlide];
  const content = getSlideContent(slide.id);
  const Icon = slide.icon;

  return (
    <div
      className="min-h-screen zen-gradient-hero flex flex-col"
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Skip button */}
      <div className="flex justify-end p-4">
        <button
          onClick={onSkip}
          className="text-sm text-muted-foreground hover:text-foreground transition-colors px-4 py-2"
        >
          {t.skip || 'Skip'}
        </button>
      </div>

      {/* Main content */}
      <div className="flex-1 flex flex-col items-center justify-center px-6 pb-8">
        {/* Animated icon */}
        <div className={cn(
          'relative w-32 h-32 rounded-3xl flex items-center justify-center mb-8 transition-all duration-500',
          `bg-gradient-to-br ${slide.gradient}`,
          isAnimating && (direction === 'next' ? 'translate-x-10 opacity-0' : '-translate-x-10 opacity-0')
        )}>
          <Icon className={cn(
            'w-16 h-16 transition-all',
            slide.iconColor,
            slide.animation === 'float' && 'animate-float',
            slide.animation === 'pulse' && 'animate-pulse',
            slide.animation === 'bounce' && 'animate-bounce',
            slide.animation === 'heartbeat' && 'animate-heartbeat',
            slide.animation === 'spin-slow' && 'animate-spin-slow',
            slide.animation === 'zap' && 'animate-zap',
            slide.animation === 'color-shift' && 'animate-color-shift'
          )} />

          {/* Decorative circles */}
          <div className="absolute -top-2 -right-2 w-6 h-6 rounded-full bg-primary/20 animate-ping" />
          <div className="absolute -bottom-3 -left-3 w-8 h-8 rounded-full bg-accent/20 animate-pulse" />
        </div>

        {/* Text content */}
        <div className={cn(
          'text-center max-w-sm transition-all duration-300',
          isAnimating && (direction === 'next' ? 'translate-x-10 opacity-0' : '-translate-x-10 opacity-0')
        )}>
          <h1 className="text-3xl font-bold text-foreground mb-2">
            {content.title}
          </h1>
          <p className="text-lg text-primary font-medium mb-4">
            {content.subtitle}
          </p>
          <p className="text-muted-foreground leading-relaxed">
            {content.description}
          </p>

          {/* Features list for features slide */}
          {content.features && (
            <div className="mt-6 space-y-3 text-left">
              {content.features.map((feature, index) => (
                <div
                  key={index}
                  className="flex items-center gap-3 p-3 bg-card rounded-xl animate-fade-in"
                  style={{ animationDelay: `${index * 100}ms` }}
                >
                  <CheckCircle2 className="w-5 h-5 text-primary flex-shrink-0" />
                  <span className="text-sm text-foreground">{feature}</span>
                </div>
              ))}
            </div>
          )}
        </div>
      </div>

      {/* Navigation */}
      <div
        className="px-6 pb-8"
        style={{ paddingBottom: 'calc(2rem + env(safe-area-inset-bottom, 0px))' }}
      >
        {/* Dots */}
        <div className="flex justify-center gap-2 mb-6">
          {slides.map((_, index) => (
            <button
              key={index}
              onClick={() => handleDotClick(index)}
              className={cn(
                'h-2 rounded-full transition-all duration-300',
                index === currentSlide
                  ? 'w-8 bg-primary'
                  : 'w-2 bg-muted hover:bg-muted-foreground/50'
              )}
            />
          ))}
        </div>

        {/* Buttons */}
        <div className="flex gap-3">
          {currentSlide > 0 && (
            <button
              onClick={handlePrev}
              className="p-4 bg-secondary rounded-xl hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-6 h-6" />
            </button>
          )}

          <button
            onClick={handleNext}
            className={cn(
              'flex-1 py-4 rounded-xl font-semibold transition-all flex items-center justify-center gap-2',
              currentSlide === slides.length - 1
                ? 'zen-gradient text-primary-foreground hover:opacity-90 animate-glow-pulse'
                : 'zen-gradient text-primary-foreground hover:opacity-90'
            )}
          >
            {currentSlide === slides.length - 1
              ? (t.tutorialStart || "Let's Go!")
              : (t.next || 'Next')
            }
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>

      {/* Animations CSS */}
      <style>{`
        @keyframes heartbeat {
          0%, 100% { transform: scale(1); }
          25% { transform: scale(1.1); }
          35% { transform: scale(0.95); }
          45% { transform: scale(1.05); }
        }
        @keyframes spin-slow {
          from { transform: rotate(0deg); }
          to { transform: rotate(360deg); }
        }
        @keyframes zap {
          0%, 100% { transform: scale(1) rotate(0deg); opacity: 1; }
          25% { transform: scale(1.2) rotate(-5deg); opacity: 0.8; }
          50% { transform: scale(0.9) rotate(5deg); opacity: 1; }
          75% { transform: scale(1.1) rotate(-3deg); opacity: 0.9; }
        }
        .animate-heartbeat {
          animation: heartbeat 1.5s ease-in-out infinite;
        }
        .animate-spin-slow {
          animation: spin-slow 8s linear infinite;
        }
        .animate-zap {
          animation: zap 2s ease-in-out infinite;
        }
        @keyframes color-shift {
          0%, 100% {
            filter: hue-rotate(0deg);
            transform: scale(1);
          }
          25% {
            filter: hue-rotate(60deg);
            transform: scale(1.05);
          }
          50% {
            filter: hue-rotate(120deg);
            transform: scale(1);
          }
          75% {
            filter: hue-rotate(180deg);
            transform: scale(1.05);
          }
        }
        .animate-color-shift {
          animation: color-shift 4s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
