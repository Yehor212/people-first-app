import { ChevronRight } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface AuthGateProps {
  onComplete: () => void;
}

export function AuthGate({ onComplete }: AuthGateProps) {
  const { t } = useLanguage();

  return (
    <div className="min-h-screen zen-gradient-hero flex items-center justify-center px-4 py-8">
      <div className="w-full max-w-md text-center">
        <div className="mb-8">
          <div className="w-24 h-24 mx-auto mb-6 rounded-3xl zen-gradient flex items-center justify-center zen-shadow-soft">
            <span className="text-5xl">🧘</span>
          </div>
          <h1 className="text-3xl font-bold text-foreground mb-3">ZenFlow</h1>
          <p className="text-muted-foreground">
            {t.welcomeMessage || 'Your personal wellness companion'}
          </p>
        </div>

        <div className="bg-card rounded-3xl p-6 zen-shadow-card mb-6">
          <div className="space-y-4 text-left">
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center">
                <span className="text-2xl">😊</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t.featureMood || 'Track Mood'}</h3>
                <p className="text-sm text-muted-foreground">{t.featureMoodDescription || 'Monitor your emotional wellbeing'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-accent/10 flex items-center justify-center">
                <span className="text-2xl">✅</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t.featureHabits || 'Build Habits'}</h3>
                <p className="text-sm text-muted-foreground">{t.featureHabitsDescription || 'Create positive daily routines'}</p>
              </div>
            </div>
            <div className="flex items-center gap-4">
              <div className="w-12 h-12 rounded-xl bg-mood-good/10 flex items-center justify-center">
                <span className="text-2xl">⏱️</span>
              </div>
              <div>
                <h3 className="font-semibold text-foreground">{t.featureFocus || 'Focus Timer'}</h3>
                <p className="text-sm text-muted-foreground">{t.featureFocusDescription || 'Boost your productivity'}</p>
              </div>
            </div>
          </div>
        </div>

        <button
          onClick={onComplete}
          className="w-full py-4 zen-gradient text-primary-foreground rounded-xl font-semibold hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
        >
          {t.continue || 'Continue'}
          <ChevronRight className="w-5 h-5" />
        </button>

        <p className="text-xs text-muted-foreground mt-4">
          {t.privacyNote || 'Your data stays on your device'}
        </p>
      </div>
    </div>
  );
}
