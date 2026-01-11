import { useState } from 'react';
import { ChevronRight, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { MoodType } from '@/types';
import { habitTemplates } from '@/lib/habitTemplates';
import { cn } from '@/lib/utils';

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

export function OnboardingFlow({ onComplete }: OnboardingFlowProps) {
  const { t, language } = useLanguage();
  const [step, setStep] = useState(0);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedHabits, setSelectedHabits] = useState<string[]>([]);
  const [enableReminders, setEnableReminders] = useState(false);
  const [reminderTime, setReminderTime] = useState<'morning' | 'evening'>('morning');

  const moods: { type: MoodType; emoji: string; label: string }[] = [
    { type: 'great', emoji: '😄', label: t.great },
    { type: 'good', emoji: '🙂', label: t.good },
    { type: 'okay', emoji: '😐', label: t.okay },
    { type: 'bad', emoji: '😔', label: t.bad },
    { type: 'terrible', emoji: '😢', label: t.terrible },
  ];

  const toggleHabit = (habitId: string) => {
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
      setStep(step + 1);
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

  return (
    <div className="min-h-screen zen-gradient-hero flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md">
        {/* Progress */}
        <div className="flex gap-2 mb-8">
          {[0, 1, 2].map(i => (
            <div
              key={i}
              className={cn(
                "h-1 flex-1 rounded-full transition-colors",
                i <= step ? "zen-gradient" : "bg-secondary"
              )}
            />
          ))}
        </div>

        {/* Step 0: Mood */}
        {step === 0 && (
          <div className="bg-card rounded-3xl p-6 zen-shadow-card animate-fade-in">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.onboardingMoodTitle || 'How are you feeling?'}</h2>
            <p className="text-muted-foreground mb-6">{t.onboardingMoodDescription || 'Start by checking in with yourself'}</p>
            
            <div className="grid grid-cols-5 gap-2 mb-6">
              {moods.map(mood => (
                <button
                  key={mood.type}
                  onClick={() => setSelectedMood(mood.type)}
                  className={cn(
                    "p-3 rounded-xl flex flex-col items-center gap-1 transition-all",
                    selectedMood === mood.type
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary hover:bg-muted"
                  )}
                >
                  <span className="text-2xl">{mood.emoji}</span>
                  <span className="text-xs text-muted-foreground">{mood.label}</span>
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 1: Habits */}
        {step === 1 && (
          <div className="bg-card rounded-3xl p-6 zen-shadow-card animate-fade-in">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.onboardingHabitsTitle || 'Choose habits to track'}</h2>
            <p className="text-muted-foreground mb-6">{t.onboardingHabitsDescription || 'Select the habits you want to build'}</p>
            
            <div className="grid grid-cols-2 gap-3 mb-6">
              {habitTemplates.map(habit => (
                <button
                  key={habit.id}
                  onClick={() => toggleHabit(habit.id)}
                  className={cn(
                    "p-4 rounded-xl flex items-center gap-3 transition-all text-left",
                    selectedHabits.includes(habit.id)
                      ? "bg-primary/10 ring-2 ring-primary"
                      : "bg-secondary hover:bg-muted"
                  )}
                >
                  <span className="text-2xl">{habit.icon}</span>
                  <span className="text-sm font-medium text-foreground">{habit.names[language]}</span>
                  {selectedHabits.includes(habit.id) && (
                    <Check className="w-4 h-4 text-primary ml-auto" />
                  )}
                </button>
              ))}
            </div>
          </div>
        )}

        {/* Step 2: Reminders */}
        {step === 2 && (
          <div className="bg-card rounded-3xl p-6 zen-shadow-card animate-fade-in">
            <h2 className="text-2xl font-bold text-foreground mb-2">{t.onboardingRemindersTitle || 'Set up reminders'}</h2>
            <p className="text-muted-foreground mb-6">{t.onboardingRemindersDescription || 'Get gentle nudges to stay on track'}</p>
            
            <div className="space-y-4 mb-6">
              <button
                onClick={() => setEnableReminders(!enableReminders)}
                className={cn(
                  "w-full p-4 rounded-xl flex items-center justify-between transition-all",
                  enableReminders ? "bg-primary/10 ring-2 ring-primary" : "bg-secondary"
                )}
              >
                <span className="font-medium text-foreground">{t.enableReminders || 'Enable reminders'}</span>
                <div className={cn(
                  "w-12 h-6 rounded-full transition-colors relative",
                  enableReminders ? "bg-primary" : "bg-muted"
                )}>
                  <div className={cn(
                    "absolute top-1 w-4 h-4 rounded-full bg-white transition-transform",
                    enableReminders ? "right-1" : "left-1"
                  )} />
                </div>
              </button>

              {enableReminders && (
                <div className="grid grid-cols-2 gap-3">
                  <button
                    onClick={() => setReminderTime('morning')}
                    className={cn(
                      "p-4 rounded-xl text-center transition-all",
                      reminderTime === 'morning'
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "bg-secondary hover:bg-muted"
                    )}
                  >
                    <span className="text-2xl">🌅</span>
                    <p className="text-sm font-medium text-foreground mt-1">{t.morning || 'Morning'}</p>
                    <p className="text-xs text-muted-foreground">9:00</p>
                  </button>
                  <button
                    onClick={() => setReminderTime('evening')}
                    className={cn(
                      "p-4 rounded-xl text-center transition-all",
                      reminderTime === 'evening'
                        ? "bg-primary/10 ring-2 ring-primary"
                        : "bg-secondary hover:bg-muted"
                    )}
                  >
                    <span className="text-2xl">🌙</span>
                    <p className="text-sm font-medium text-foreground mt-1">{t.evening || 'Evening'}</p>
                    <p className="text-xs text-muted-foreground">19:00</p>
                  </button>
                </div>
              )}
            </div>
          </div>
        )}

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSkip}
            className="flex-1 py-4 bg-secondary text-secondary-foreground rounded-xl font-semibold hover:bg-muted transition-colors"
          >
            {t.skip || 'Skip'}
          </button>
          <button
            onClick={handleNext}
            className="flex-1 py-4 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
          >
            {step === 2 ? (t.getStarted || 'Get Started') : (t.next || 'Next')}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>
      </div>
    </div>
  );
}
