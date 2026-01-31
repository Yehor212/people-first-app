import { useState, useEffect, useRef } from 'react';
import { ChevronRight, Sparkles, Target, Bell, Check, Star, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodType, PrimaryEmotion, EmotionIntensity } from '@/types';
import { habitTemplates } from '@/lib/habitTemplates';
import { cn } from '@/lib/utils';
import { AnimatedEmotionEmoji } from './AnimatedEmotionEmoji';
import {
  EMOTION_ORDER,
  EMOTION_GRADIENTS,
  getEmotionTranslations,
  emotionToMoodType
} from '@/lib/emotionConstants';

interface OnboardingResult {
  skipped?: boolean;
  mood: MoodType | null;
  emotion?: {
    primary: PrimaryEmotion;
    intensity: EmotionIntensity;
  };
  habits: Array<{ id: string; name: string; icon: string; color: string }>;
  enableReminders: boolean;
  reminderTime: 'morning' | 'evening';
}

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
}

// Floating particles component
// P1 Fix: Added reduced-motion support for accessibility
function FloatingParticles() {
  // Check if user prefers reduced motion
  const prefersReducedMotion = typeof window !== 'undefined'
    && window.matchMedia?.('(prefers-reduced-motion: reduce)').matches;

  // Don't render particles if user prefers reduced motion
  if (prefersReducedMotion) {
    return null;
  }

  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {Array.from({ length: 20 }).map((_, i) => (
        <div
          key={i}
          className="absolute w-2 h-2 rounded-full animate-float-particle opacity-30"
          style={{
            left: `${Math.random() * 100}%`,
            top: `${Math.random() * 100}%`,
            backgroundColor: ['#4a9d7c', '#e8a849', '#6366f1', '#ec4899', '#22c55e'][i % 5],
            animationDelay: `${Math.random() * 5}s`,
            animationDuration: `${8 + Math.random() * 4}s`,
          }}
        />
      ))}
    </div>
  );
}

// Celebration burst when selecting
function SelectionBurst({ show }: { show: boolean }) {
  if (!show) return null;

  return (
    <div className="absolute inset-0 pointer-events-none">
      {Array.from({ length: 8 }).map((_, i) => (
        <div
          key={i}
          className="absolute left-1/2 top-1/2 w-1.5 h-1.5 rounded-full animate-selection-burst"
          style={{
            backgroundColor: ['#FFD700', '#FF6B6B', '#4ECDC4', '#9B59B6'][i % 4],
            '--burst-angle': `${i * 45}deg`,
          } as React.CSSProperties}
        />
      ))}
    </div>
  );
}

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t, language } = useLanguage();
  // Steps: 1=mood, 2=habits, 3=reminders
  const [step, setStep] = useState(1);
  const [selectedEmotion, setSelectedEmotion] = useState<PrimaryEmotion | null>(null);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderTime, setReminderTime] = useState<'morning' | 'evening'>('morning');
  const [showBurst, setShowBurst] = useState(false);
  const [animatingHabit, setAnimatingHabit] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  // P1 Fix: Responsive emotion wheel radius
  const [emotionWheelRadius, setEmotionWheelRadius] = useState(100);
  const emotionWheelRef = useRef<HTMLDivElement>(null);

  // P1 Fix: Calculate radius based on container size
  useEffect(() => {
    const updateRadius = () => {
      if (emotionWheelRef.current) {
        const containerWidth = emotionWheelRef.current.offsetWidth;
        // Button size is ~50px (p-2 + emoji + text), so we need margin
        // Calculate radius as ~35% of container width, with min/max bounds
        const calculatedRadius = Math.max(70, Math.min(110, containerWidth * 0.35));
        setEmotionWheelRadius(calculatedRadius);
      }
    };

    updateRadius();
    window.addEventListener('resize', updateRadius);
    return () => window.removeEventListener('resize', updateRadius);
  }, [step]); // Recalculate when step changes to emotion step

  // Get emotion translations for current language
  const emotionT = getEmotionTranslations(language);

  // 8 Plutchik emotions with colors from emotionConstants
  const emotions: { type: PrimaryEmotion; label: string; gradient: string }[] = EMOTION_ORDER.map(emotion => ({
    type: emotion,
    label: emotionT[emotion],
    gradient: EMOTION_GRADIENTS[emotion].replace('/80', ''), // Remove opacity for onboarding
  }));

  const handleEmotionSelect = (emotion: PrimaryEmotion) => {
    setSelectedEmotion(emotion);
    setShowBurst(true);
    setTimeout(() => setShowBurst(false), 500);
  };

  const toggleHabit = (habitId: string) => {
    setAnimatingHabit(habitId);
    setTimeout(() => setAnimatingHabit(null), 400);

    setSelectedHabits(prev =>
      prev.includes(habitId)
        ? prev.filter(id => id !== habitId)
        : [...prev, habitId]
    );
  };

  const handleSkip = () => {
    onComplete({ skipped: true, mood: null, habits: [], enableReminders: false, reminderTime: 'morning' });
  };

  // P1 Fix: Ref to prevent double-clicks during transition
  const transitionLockRef = useRef(false);

  const handleNext = () => {
    // P1 Fix: Prevent rapid double-clicks during transition
    if (isTransitioning || transitionLockRef.current) return;

    // Steps: 1=mood, 2=habits, 3=reminders
    if (step < 3) {
      transitionLockRef.current = true;
      setIsTransitioning(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsTransitioning(false);
        transitionLockRef.current = false;
      }, 300);
    } else {
      // P0 Fix: Filter out any invalid habit IDs and handle missing templates gracefully
      const habits = selectedHabits
        .map(id => {
          const template = habitTemplates.find(h => h.id === id);
          if (!template) {
            console.warn(`[OnboardingFlow] Habit template not found for id: ${id}`);
            return null;
          }
          return {
            id: template.id,
            name: template.names[language],
            icon: template.icon,
            color: template.color
          };
        })
        .filter((habit): habit is NonNullable<typeof habit> => habit !== null);

      // Convert emotion to legacy mood for backward compatibility
      const legacyMood = selectedEmotion
        ? emotionToMoodType(selectedEmotion, 'moderate')
        : null;

      onComplete({
        mood: legacyMood,
        emotion: selectedEmotion ? {
          primary: selectedEmotion,
          intensity: 'moderate' as EmotionIntensity
        } : undefined,
        habits,
        enableReminders,
        reminderTime
      });
    }
  };

  const stepIcons = [
    { icon: Heart, label: t.onboardingMoodTitle || 'Mood' },
    { icon: Target, label: t.onboardingHabitsTitle || 'Habits' },
    { icon: Bell, label: t.onboardingRemindersTitle || 'Reminders' },
  ];

  // Calculate progress step (0-based for progress bar, excluding age verification)
  const progressStep = step - 1;

  return (
    <div className="screen-overlay bg-gradient-to-br from-background via-primary/5 to-accent/5 overflow-hidden">
      <FloatingParticles />

      <div className="screen-centered px-3 sm:px-4">
        <div className="w-full max-w-md relative z-10">

        {/* Progress bar and main onboarding (steps 1-3) */}
        <>
            {/* Animated Progress Bar - responsive */}
            <div className="flex gap-1.5 sm:gap-2 mb-4 sm:mb-8">
              {[0, 1, 2].map(i => (
                <div
                  key={i}
                  className="h-1.5 sm:h-2 flex-1 rounded-full bg-secondary/50 overflow-hidden"
                >
                  <div
                    className={cn(
                      "h-full rounded-full transition-all duration-500 ease-out",
                      i < progressStep ? "w-full bg-gradient-to-r from-primary to-accent" :
                      i === progressStep ? "w-full bg-gradient-to-r from-primary to-accent animate-pulse" :
                      "w-0"
                    )}
                  />
                </div>
              ))}
            </div>

            {/* Step Icons - responsive */}
            <div className="flex justify-center gap-6 sm:gap-8 mb-4 sm:mb-6">
              {stepIcons.map((item, i) => {
                const Icon = item.icon;
                const isActive = i === progressStep;
                const isCompleted = i < progressStep;

                return (
                  <div
                    key={i}
                    className={cn(
                      "flex flex-col items-center gap-1 transition-all duration-300",
                      isActive ? "scale-110" : "scale-90 opacity-50"
                    )}
                  >
                    <div className={cn(
                      "w-10 h-10 sm:w-12 sm:h-12 rounded-full flex items-center justify-center transition-all duration-300",
                      isActive ? "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30" :
                      isCompleted ? "bg-primary" : "bg-secondary"
                    )}>
                      {isCompleted ? (
                        <Check className="w-5 h-5 sm:w-6 sm:h-6 text-white" />
                      ) : (
                        <Icon className={cn(
                          "w-5 h-5 sm:w-6 sm:h-6",
                          isActive ? "text-white" : "text-muted-foreground"
                        )} />
                      )}
                    </div>
                  </div>
                );
              })}
            </div>

        {/* Content Card - responsive */}
        <div className={cn(
          "bg-card/95 backdrop-blur-sm rounded-2xl sm:rounded-3xl p-4 sm:p-6 shadow-2xl shadow-primary/10 border border-primary/10 transition-all duration-300",
          isTransitioning ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
        )}>
          {/* Step 1: Emotion (Plutchik Wheel) */}
          {step === 1 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {emotionT.whatDoYouFeel || t.onboardingMoodTitle || 'How are you feeling?'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-4 sm:mb-6 text-xs sm:text-sm">
                {emotionT.selectEmotion || t.onboardingMoodDescription || 'Track your emotions daily'}
              </p>

              {/* Circular emotion wheel layout */}
              <div
                ref={emotionWheelRef}
                className="relative w-full aspect-square max-w-[280px] sm:max-w-[320px] mx-auto mb-4"
              >
                {/* Center decoration */}
                <div className="absolute top-1/2 left-1/2 -translate-x-1/2 -translate-y-1/2 w-16 h-16 rounded-full bg-gradient-to-br from-primary/20 to-accent/20 flex items-center justify-center">
                  <Heart className="w-6 h-6 text-primary/50" />
                </div>

                {/* 8 emotions in a circle */}
                {emotions.map((emotion, index) => {
                  const angle = (index * 45 - 90) * (Math.PI / 180); // Start from top
                  // P1 Fix: Use dynamic radius instead of fixed 100px
                  const x = Math.cos(angle) * emotionWheelRadius;
                  const y = Math.sin(angle) * emotionWheelRadius;

                  return (
                    <button
                      key={emotion.type}
                      onClick={() => handleEmotionSelect(emotion.type)}
                      className={cn(
                        "absolute top-1/2 left-1/2 p-1.5 sm:p-2 rounded-2xl flex flex-col items-center gap-0.5 transition-all duration-300",
                        selectedEmotion === emotion.type
                          ? `bg-gradient-to-br ${emotion.gradient} shadow-lg scale-110 z-10`
                          : "bg-secondary/60 hover:bg-secondary hover:scale-105"
                      )}
                      style={{
                        transform: `translate(calc(-50% + ${x}px), calc(-50% + ${y}px))`,
                        animationDelay: `${index * 50}ms`
                      }}
                    >
                      <AnimatedEmotionEmoji
                        emotion={emotion.type}
                        size="md"
                        isSelected={selectedEmotion === emotion.type}
                      />
                      <span className={cn(
                        "text-[10px] sm:text-xs font-medium transition-colors whitespace-nowrap",
                        selectedEmotion === emotion.type ? "text-white" : "text-muted-foreground"
                      )}>
                        {emotion.label}
                      </span>
                      {selectedEmotion === emotion.type && <SelectionBurst show={showBurst} />}
                    </button>
                  );
                })}
              </div>

              {selectedEmotion && (
                <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 rounded-xl animate-fade-in">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {t.greatChoice || 'Great choice!'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 2: Habits */}
          {step === 2 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {t.onboardingHabitsTitle || 'Create your first habits'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-3 sm:mb-4 text-xs sm:text-sm">
                {t.onboardingHabitsDescription || 'Start with small steps'}
              </p>

              <div className="grid grid-cols-2 gap-2 max-h-[340px] overflow-y-auto pr-1">
                {habitTemplates.map((habit, index) => {
                  const isSelected = selectedHabits.includes(habit.id);
                  const isAnimating = animatingHabit === habit.id;

                  return (
                    <button
                      key={habit.id}
                      onClick={() => toggleHabit(habit.id)}
                      className={cn(
                        "relative p-3 rounded-xl flex items-center gap-2 transition-all duration-200 text-left overflow-hidden",
                        isSelected
                          ? "bg-primary/15 ring-2 ring-primary"
                          : "bg-secondary/50 hover:bg-secondary",
                        isAnimating && "animate-selection-pop"
                      )}
                      style={{ animationDelay: `${index * 50}ms` }}
                    >
                      <span className={cn(
                        "text-xl transition-transform",
                        isSelected && "scale-110"
                      )}>
                        {habit.icon}
                      </span>
                      <span className={cn(
                        "text-xs font-medium flex-1",
                        isSelected ? "text-primary" : "text-foreground"
                      )}>
                        {habit.names[language]}
                      </span>
                      {isSelected && (
                        <div className="w-5 h-5 rounded-full bg-primary flex items-center justify-center animate-check-pop">
                          <Check className="w-3 h-3 text-white" />
                        </div>
                      )}
                    </button>
                  );
                })}
              </div>

              {selectedHabits.length > 0 && (
                <div className="mt-3 flex items-center justify-center gap-2 py-2 bg-primary/10 rounded-xl animate-fade-in">
                  <span className="text-sm font-medium text-primary">
                    {selectedHabits.length} {t.habitsSelected || 'habits selected'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 3: Reminders */}
          {step === 3 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-4 h-4 sm:w-5 sm:h-5 text-primary" />
                <h2 className="text-lg sm:text-xl font-bold text-foreground">
                  {t.onboardingRemindersTitle || 'Reminders'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-4 sm:mb-6 text-xs sm:text-sm">
                {t.onboardingRemindersDescription || 'Get habit reminders'}
              </p>

              <div className="space-y-4">
                <button
                  onClick={() => setEnableReminders(!enableReminders)}
                  className={cn(
                    "w-full p-4 rounded-xl flex items-center justify-between transition-all",
                    enableReminders ? "bg-primary/10 ring-2 ring-primary" : "bg-secondary/50"
                  )}
                >
                  <span className="font-medium text-foreground">{t.enableReminders || 'Enable reminders'}</span>
                  <div className={cn(
                    "w-14 h-7 rounded-full transition-colors relative",
                    enableReminders ? "bg-primary" : "bg-muted"
                  )}>
                    <div className={cn(
                      "absolute top-1 w-5 h-5 rounded-full bg-white shadow-md transition-all",
                      enableReminders ? "right-1" : "left-1"
                    )} />
                  </div>
                </button>

                {enableReminders && (
                  <div className="grid grid-cols-2 gap-3 animate-slide-up">
                    <button
                      onClick={() => setReminderTime('morning')}
                      className={cn(
                        "p-4 rounded-xl text-center transition-all",
                        reminderTime === 'morning'
                          ? "bg-gradient-to-br from-amber-400 to-orange-400 shadow-lg"
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <span className="text-3xl">🌅</span>
                      <p className={cn(
                        "text-sm font-medium mt-2",
                        reminderTime === 'morning' ? "text-white" : "text-foreground"
                      )}>
                        {t.morning || 'Morning'}
                      </p>
                      <p className={cn(
                        "text-xs",
                        reminderTime === 'morning' ? "text-white/80" : "text-muted-foreground"
                      )}>
                        9:00
                      </p>
                    </button>
                    <button
                      onClick={() => setReminderTime('evening')}
                      className={cn(
                        "p-4 rounded-xl text-center transition-all",
                        reminderTime === 'evening'
                          ? "bg-gradient-to-br from-indigo-500 to-purple-500 shadow-lg"
                          : "bg-secondary/50 hover:bg-secondary"
                      )}
                    >
                      <span className="text-3xl">🌙</span>
                      <p className={cn(
                        "text-sm font-medium mt-2",
                        reminderTime === 'evening' ? "text-white" : "text-foreground"
                      )}>
                        {t.evening || 'Evening'}
                      </p>
                      <p className={cn(
                        "text-xs",
                        reminderTime === 'evening' ? "text-white/80" : "text-muted-foreground"
                      )}>
                        19:00
                      </p>
                    </button>
                  </div>
                )}
              </div>
            </div>
          )}
        </div>

        {/* Actions - responsive */}
        <div className="flex gap-2 sm:gap-3 mt-4 sm:mt-6">
          <button
            onClick={handleSkip}
            className="flex-1 py-3 sm:py-4 bg-secondary/50 backdrop-blur-sm text-secondary-foreground rounded-xl sm:rounded-2xl font-semibold hover:bg-secondary transition-colors text-sm sm:text-base"
          >
            {t.skip || 'Skip'}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-3 sm:py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-xl sm:rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30 text-sm sm:text-base"
          >
            {step === 3 ? (t.getStarted || 'Start') : (t.next || 'Next')}
            <ChevronRight className="w-4 h-4 sm:w-5 sm:h-5" />
          </button>
        </div>
        </>
        </div>
      </div>
    </div>
  );
}
