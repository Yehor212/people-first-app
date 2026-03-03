/**
 * AI Coach Onboarding - Personalization questions
 * Shows after WelcomeTutorial, before OnboardingFlow
 */

import { useState } from 'react';
import { Sparkles, ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useAICoach } from '@/contexts/AICoachContext';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { useBackHandler } from '@/hooks/useBackHandler';
import { type Step, type GoalId, GOALS, getText } from './texts';

interface AICoachOnboardingProps {
  onComplete: () => void;
  onSkip: () => void;
}

export function AICoachOnboarding({ onComplete, onSkip }: AICoachOnboardingProps) {
  const { t: _t, language } = useLanguage();
  const { saveOnboardingAnswer } = useAICoach();
  useBackHandler(true, onSkip);

  const [step, setStep] = useState<Step>('intro');
  const [selectedGoal, setSelectedGoal] = useState<string | null>(null);
  const [concern, setConcern] = useState('');
  const [stressMethod, setStressMethod] = useState('');

  const handleGoalSelect = (goalId: GoalId) => {
    void haptics.buttonTap();
    setSelectedGoal(goalId);
    saveOnboardingAnswer('mainGoal', goalId);
  };

  const handleNext = () => {
    void haptics.buttonTap();
    if (step === 'intro') {
      setStep('goal');
    } else if (step === 'goal' && selectedGoal) {
      setStep('concern');
    } else if (step === 'concern') {
      if (concern.trim()) {
        saveOnboardingAnswer('currentConcern', concern);
      }
      setStep('stress');
    } else if (step === 'stress') {
      if (stressMethod.trim()) {
        saveOnboardingAnswer('stressManagement', stressMethod);
      }
      onComplete();
    }
  };

  const handleSkip = () => {
    void haptics.buttonTap();
    onSkip();
  };

  const steps: Step[] = ['intro', 'goal', 'concern', 'stress'];
  const currentStepIndex = steps.indexOf(step);

  return (
    <div className="fixed inset-0 z-50 bg-gradient-to-br from-background via-primary/5 to-accent/5 flex items-center justify-center p-4 motion-safe:animate-fade-in">
      <div className="w-full max-w-md">
        {/* Header */}
        <div className="text-center mb-8">
          <div className="w-16 h-16 mx-auto mb-4 rounded-2xl bg-gradient-to-br from-primary to-accent flex items-center justify-center motion-safe:animate-scale-in">
            <Sparkles className="w-8 h-8 text-white" />
          </div>
          <h1 className="text-2xl font-bold text-foreground mb-2">
            {step === 'intro' ? getText('intro', 'title', language) :
             step === 'goal' ? getText('goal', 'title', language) :
             step === 'concern' ? getText('concern', 'title', language) :
             getText('stress', 'title', language)}
          </h1>
          <p className="text-muted-foreground">
            {step === 'intro' ? getText('intro', 'subtitle', language) :
             step === 'goal' ? getText('goal', 'subtitle', language) :
             step === 'concern' ? getText('concern', 'subtitle', language) :
             getText('stress', 'subtitle', language)}
          </p>
        </div>

        {/* Content */}
        <div className="bg-card rounded-2xl p-6 shadow-xl">
          {step === 'intro' && (
            <div className="text-center py-4">
              <div className="flex justify-center gap-4 mb-6">
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">{'\u{1F3AF}'}</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-accent/10 flex items-center justify-center">
                  <span className="text-2xl">{'\u{1F4AA}'}</span>
                </div>
                <div className="w-12 h-12 rounded-full bg-primary/10 flex items-center justify-center">
                  <span className="text-2xl">{'\u{1F9E0}'}</span>
                </div>
              </div>
              <p className="text-sm text-muted-foreground">
                {getText('introDescription', '', language)}
              </p>
            </div>
          )}

          {step === 'goal' && (
            <div className="grid grid-cols-2 gap-3">
              {GOALS.map((goal) => (
                <button
                  key={goal.id}
                  onClick={() => handleGoalSelect(goal.id)}
                  className={cn(
                    "p-4 rounded-xl flex flex-col items-center gap-2 transition-all active:scale-95",
                    selectedGoal === goal.id
                      ? "bg-primary text-primary-foreground ring-2 ring-primary"
                      : "bg-secondary hover:bg-secondary/80"
                  )}
                >
                  <span className="text-3xl">{goal.emoji}</span>
                  <span className="text-sm font-medium text-center">
                    {getText('goals', goal.id, language)}
                  </span>
                </button>
              ))}
            </div>
          )}

          {step === 'concern' && (
            <textarea
              value={concern}
              onChange={(e) => setConcern(e.target.value)}
              placeholder={getText('concern', 'placeholder', language)}
              className="w-full h-32 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          )}

          {step === 'stress' && (
            <textarea
              value={stressMethod}
              onChange={(e) => setStressMethod(e.target.value)}
              placeholder={getText('stress', 'placeholder', language)}
              className="w-full h-32 px-4 py-3 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/50"
              autoFocus
            />
          )}
        </div>

        {/* Actions */}
        <div className="flex gap-3 mt-6">
          <button
            onClick={handleSkip}
            className="flex-1 py-4 bg-secondary/50 text-secondary-foreground rounded-xl font-semibold hover:bg-secondary transition-colors active:scale-[0.98]"
          >
            {getText('buttons', 'skip', language)}
          </button>
          <button
            onClick={handleNext}
            disabled={step === 'goal' && !selectedGoal}
            className={cn(
              "flex-1 py-4 rounded-xl font-semibold flex items-center justify-center gap-2 transition-all active:scale-[0.98]",
              (step !== 'goal' || selectedGoal)
                ? "bg-gradient-to-r from-primary to-accent text-primary-foreground hover:opacity-90"
                : "bg-secondary text-muted-foreground"
            )}
          >
            {step === 'intro' ? getText('buttons', 'letsGo', language) :
             step === 'stress' ? getText('buttons', 'start', language) :
             getText('buttons', 'next', language)}
            <ChevronRight className="w-5 h-5" />
          </button>
        </div>

        {/* Progress dots */}
        <div className="flex justify-center gap-2 mt-6">
          {steps.map((s, i) => (
            <div
              key={s}
              className={cn(
                "h-2 rounded-full transition-all",
                i === currentStepIndex ? "w-6 bg-primary" :
                i < currentStepIndex ? "w-2 bg-primary/50" : "w-2 bg-muted"
              )}
            />
          ))}
        </div>
      </div>
    </div>
  );
}
