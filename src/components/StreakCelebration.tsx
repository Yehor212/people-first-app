import { useEffect, useState } from 'react';
import { X, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStreakMessage, shouldShowStreakMessage } from '@/lib/motivationalMessages';
import { cn } from '@/lib/utils';

interface StreakCelebrationProps {
  streak: number;
  habitName?: string;
  onClose: () => void;
}

export function StreakCelebration({ streak, habitName, onClose }: StreakCelebrationProps) {
  const { language } = useLanguage();
  const [isVisible, setIsVisible] = useState(false);
  const message = getStreakMessage(streak, language);

  useEffect(() => {
    // Animate in
    setTimeout(() => setIsVisible(true), 100);
  }, []);

  const handleClose = () => {
    setIsVisible(false);
    setTimeout(onClose, 300);
  };

  if (!message) return null;

  return (
    <div
      className={cn(
        "fixed inset-0 z-50 flex items-center justify-center p-4 transition-all duration-300",
        isVisible ? "bg-black/60 backdrop-blur-sm" : "bg-black/0"
      )}
      onClick={handleClose}
    >
      <div
        className={cn(
          "relative max-w-md w-full bg-gradient-to-br from-primary/20 via-card to-accent/20 rounded-3xl p-8 shadow-2xl border-2 border-primary/30 transition-all duration-500",
          isVisible ? "scale-100 opacity-100 translate-y-0" : "scale-75 opacity-0 translate-y-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-background/50 hover:bg-background transition-colors"
        >
          <X className="w-5 h-5" />
        </button>

        {/* Emoji with sparkles animation */}
        <div className="relative flex justify-center mb-6">
          <div className="relative">
            <div className="text-8xl animate-bounce">{message.emoji}</div>
            <Sparkles className="absolute -top-2 -right-2 w-8 h-8 text-primary animate-pulse" />
            <Sparkles className="absolute -bottom-2 -left-2 w-6 h-6 text-accent animate-pulse delay-150" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-3xl font-bold text-center mb-3 bg-gradient-to-r from-primary to-accent bg-clip-text text-transparent">
          {message.title[language]}
        </h2>

        {/* Habit name if provided */}
        {habitName && (
          <p className="text-center text-lg text-muted-foreground mb-4 font-medium">
            {habitName}
          </p>
        )}

        {/* Streak count */}
        <div className="flex items-center justify-center gap-2 mb-4">
          <div className="text-6xl font-black text-primary">{streak}</div>
          <div className="text-xl text-muted-foreground">
            {language === 'en' ? (streak === 1 ? 'day' : 'days') :
             language === 'ru' ? 'дней' :
             language === 'uk' ? 'днів' :
             language === 'es' ? 'días' :
             language === 'de' ? 'Tage' :
             'jours'}
          </div>
        </div>

        {/* Message */}
        <p className="text-center text-lg text-foreground mb-6 leading-relaxed">
          {message.message[language]}
        </p>

        {/* Continue button */}
        <button
          onClick={handleClose}
          className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white font-bold rounded-xl hover:shadow-lg transition-all duration-300 hover:scale-105"
        >
          {language === 'en' ? 'Continue' :
           language === 'ru' ? 'Продолжить' :
           language === 'uk' ? 'Продовжити' :
           language === 'es' ? 'Continuar' :
           language === 'de' ? 'Weiter' :
           'Continuer'}
        </button>

        {/* Decorative elements */}
        <div className="absolute top-0 right-0 w-32 h-32 bg-primary/10 rounded-full blur-3xl -z-10"></div>
        <div className="absolute bottom-0 left-0 w-32 h-32 bg-accent/10 rounded-full blur-3xl -z-10"></div>
      </div>
    </div>
  );
}
