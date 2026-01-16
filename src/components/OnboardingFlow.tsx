import { useState } from 'react';
import { ChevronRight, Sparkles, Target, Bell, Check, Star, Heart } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodType } from '@/types';
import { habitTemplates } from '@/lib/habitTemplates';
import { cn } from '@/lib/utils';
import { AnimatedMoodEmoji } from './AnimatedMoodEmoji';

interface OnboardingResult {
  skipped?: boolean;
  mood: MoodType | null;
  habits: Array<{ id: string; name: string; icon: string; color: string }>;
  enableReminders: boolean;
  reminderTime: 'morning' | 'evening';
}

interface OnboardingFlowProps {
  onComplete: (result: OnboardingResult) => void;
}

// Floating particles component
function FloatingParticles() {
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
  const [step, setStep] = useState(0);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [enableReminders, setEnableReminders] = useState(true);
  const [reminderTime, setReminderTime] = useState<'morning' | 'evening'>('morning');
  const [showBurst, setShowBurst] = useState(false);
  const [animatingHabit, setAnimatingHabit] = useState<string | null>(null);
  const [isTransitioning, setIsTransitioning] = useState(false);

  const moods: { type: MoodType; emoji: string; label: string; color: string }[] = [
    { type: 'great', emoji: '😄', label: t.great, color: 'from-emerald-400 to-green-500' },
    { type: 'good', emoji: '🙂', label: t.good, color: 'from-green-400 to-emerald-500' },
    { type: 'okay', emoji: '😐', label: t.okay, color: 'from-amber-400 to-yellow-500' },
    { type: 'bad', emoji: '😔', label: t.bad, color: 'from-orange-400 to-amber-500' },
    { type: 'terrible', emoji: '😢', label: t.terrible, color: 'from-red-400 to-rose-500' },
  ];

  const handleMoodSelect = (mood: MoodType) => {
    setSelectedMood(mood);
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

  const handleNext = () => {
    if (step < 2) {
      setIsTransitioning(true);
      setTimeout(() => {
        setStep(step + 1);
        setIsTransitioning(false);
      }, 300);
    } else {
      const habits = selectedHabits.map(id => {
        const template = habitTemplates.find(h => h.id === id)!;
        return {
          id: template.id,
          name: template.names[language],
          icon: template.icon,
          color: template.color
        };
      });

      onComplete({
        mood: selectedMood,
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

  return (
    <div className="min-h-screen bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center px-4 py-8 relative overflow-hidden">
      <FloatingParticles />

      <div className="w-full max-w-md relative z-10">
        {/* Animated Progress Bar */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className="h-2 flex-1 rounded-full bg-secondary/50 overflow-hidden"
            >
              <div
                className={cn(
                  "h-full rounded-full transition-all duration-500 ease-out",
                  i < step ? "w-full bg-gradient-to-r from-primary to-accent" :
                  i === step ? "w-full bg-gradient-to-r from-primary to-accent animate-pulse" :
                  "w-0"
                )}
              />
            </div>
          ))}
        </div>

        {/* Step Icons */}
        <div className="flex justify-center gap-8 mb-6">
          {stepIcons.map((item, i) => {
            const Icon = item.icon;
            const isActive = i === step;
            const isCompleted = i < step;

            return (
              <div
                key={i}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all duration-300",
                  isActive ? "scale-110" : "scale-90 opacity-50"
                )}
              >
                <div className={cn(
                  "w-12 h-12 rounded-full flex items-center justify-center transition-all duration-300",
                  isActive ? "bg-gradient-to-br from-primary to-accent shadow-lg shadow-primary/30" :
                  isCompleted ? "bg-primary" : "bg-secondary"
                )}>
                  {isCompleted ? (
                    <Check className="w-6 h-6 text-white" />
                  ) : (
                    <Icon className={cn(
                      "w-6 h-6",
                      isActive ? "text-white" : "text-muted-foreground"
                    )} />
                  )}
                </div>
              </div>
            );
          })}
        </div>

        {/* Content Card */}
        <div className={cn(
          "bg-card/95 backdrop-blur-sm rounded-3xl p-6 shadow-2xl shadow-primary/10 border border-primary/10 transition-all duration-300",
          isTransitioning ? "opacity-0 translate-x-8" : "opacity-100 translate-x-0"
        )}>
          {/* Step 0: Mood */}
          {step === 0 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Sparkles className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {t.onboardingMoodTitle || 'How are you feeling?'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-6 text-sm">
                {t.onboardingMoodDescription || 'Track your mood daily'}
              </p>

              <div className="flex justify-between gap-2 mb-4 relative">
                {moods.map((mood, index) => (
                  <button
                    key={mood.type}
                    onClick={() => handleMoodSelect(mood.type)}
                    className={cn(
                      "relative flex-1 p-3 rounded-2xl flex flex-col items-center gap-2 transition-all duration-200",
                      selectedMood === mood.type
                        ? `bg-gradient-to-br ${mood.color} shadow-lg scale-105`
                        : "bg-secondary/50 hover:bg-secondary hover:scale-102"
                    )}
                    style={{ animationDelay: `${index * 100}ms` }}
                  >
                    <AnimatedMoodEmoji
                      mood={mood.type}
                      size="lg"
                      isSelected={selectedMood === mood.type}
                    />
                    <span className={cn(
                      "text-[10px] font-medium transition-colors",
                      selectedMood === mood.type ? "text-white" : "text-muted-foreground"
                    )}>
                      {mood.label}
                    </span>
                    {selectedMood === mood.type && <SelectionBurst show={showBurst} />}
                  </button>
                ))}
              </div>

              {selectedMood && (
                <div className="flex items-center justify-center gap-2 py-2 bg-primary/10 rounded-xl animate-fade-in">
                  <Star className="w-4 h-4 text-primary" />
                  <span className="text-sm font-medium text-primary">
                    {t.greatChoice || 'Great choice!'}
                  </span>
                </div>
              )}
            </div>
          )}

          {/* Step 1: Habits */}
          {step === 1 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Target className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {t.onboardingHabitsTitle || 'Create your first habits'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-4 text-sm">
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

          {/* Step 2: Reminders */}
          {step === 2 && (
            <div className="animate-slide-up">
              <div className="flex items-center gap-2 mb-2">
                <Bell className="w-5 h-5 text-primary" />
                <h2 className="text-xl font-bold text-foreground">
                  {t.onboardingRemindersTitle || 'Reminders'}
                </h2>
              </div>
              <p className="text-muted-foreground mb-6 text-sm">
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

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSkip}
            className="flex-1 py-4 bg-secondary/50 backdrop-blur-sm text-secondary-foreground rounded-2xl font-semibold hover:bg-secondary transition-colors"
          >
            {t.skip || 'Skip'}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-4 bg-gradient-to-r from-primary to-accent text-primary-foreground rounded-2xl font-semibold hover:opacity-90 transition-all flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            {step === 2 ? (t.getStarted || 'Start') : (t.next || 'Next')}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
