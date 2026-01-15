import { useEffect, useState } from 'react';
import { X, Flame } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getStreakMessage } from '@/lib/motivationalMessages';
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
        "fixed inset-0 z-[200] flex items-center justify-center p-4 transition-all duration-300",
        isVisible ? "bg-black/70 backdrop-blur-md" : "bg-black/0"
      )}
      onClick={handleClose}
    >
      {/* Floating particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {Array.from({ length: 30 }).map((_, i) => (
          <div
            key={i}
            className="absolute w-2 h-2 rounded-full animate-sparkle"
            style={{
              left: `${Math.random() * 100}%`,
              top: `${Math.random() * 100}%`,
              backgroundColor: i % 3 === 0 ? '#FF6B35' : i % 3 === 1 ? '#FFD700' : '#FF4500',
              animationDelay: `${Math.random() * 2}s`,
              animationDuration: `${1.5 + Math.random()}s`,
            }}
          />
        ))}
      </div>

      <div
        className={cn(
          "relative max-w-sm w-full rounded-3xl p-8 shadow-2xl transition-all duration-500 overflow-hidden",
          "bg-gradient-to-b from-orange-950/90 via-orange-900/80 to-red-950/90",
          "border-2 border-orange-500/40",
          isVisible ? "scale-100 opacity-100 translate-y-0" : "scale-75 opacity-0 translate-y-8"
        )}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Glow effect behind fire */}
        <div className="absolute top-0 left-1/2 -translate-x-1/2 w-64 h-64 bg-orange-500/30 rounded-full blur-3xl -z-10"></div>

        {/* Close button */}
        <button
          onClick={handleClose}
          className="absolute top-4 right-4 p-2 rounded-full bg-white/10 hover:bg-white/20 transition-colors z-10"
        >
          <X className="w-5 h-5 text-white/70" />
        </button>

        {/* Duolingo-style fire animation */}
        <div className="relative flex justify-center mb-4">
          <div className="relative">
            {/* Main fire */}
            <div className="text-8xl animate-bounce-fire drop-shadow-[0_0_30px_rgba(255,100,0,0.8)]">
              🔥
            </div>
            {/* Side fires */}
            <div className="absolute -top-4 -left-6 text-5xl animate-bounce-fire-delayed opacity-80">
              🔥
            </div>
            <div className="absolute -top-4 -right-6 text-5xl animate-bounce-fire-delayed-2 opacity-80">
              🔥
            </div>
            {/* Small flames */}
            <div className="absolute bottom-0 left-8 text-3xl animate-bounce-fire opacity-60">
              🔥
            </div>
            <div className="absolute bottom-0 right-8 text-3xl animate-bounce-fire-delayed opacity-60">
              🔥
            </div>
          </div>
        </div>

        {/* Streak count - Duolingo style */}
        <div className="flex flex-col items-center mb-4">
          <div className="text-7xl font-black text-white drop-shadow-lg animate-scale-in">
            {streak}
          </div>
          <div className="flex items-center gap-2 mt-1">
            <Flame className="w-5 h-5 text-orange-400" />
            <span className="text-xl font-bold text-orange-300 uppercase tracking-wider">
              {language === 'en' ? (streak === 1 ? 'day streak' : 'day streak') :
               language === 'ru' ? 'дней подряд' :
               language === 'uk' ? 'днів поспіль' :
               language === 'es' ? 'días seguidos' :
               language === 'de' ? 'Tage Serie' :
               'jours de suite'}
            </span>
            <Flame className="w-5 h-5 text-orange-400" />
          </div>
        </div>

        {/* Title */}
        <h2 className="text-2xl font-bold text-center mb-2 text-white">
          {message.title[language]}
        </h2>

        {/* Habit name if provided */}
        {habitName && (
          <p className="text-center text-lg text-orange-200/70 mb-3 font-medium">
            {habitName}
          </p>
        )}

        {/* Message */}
        <p className="text-center text-base text-white/80 mb-6 leading-relaxed">
          {message.message[language]}
        </p>

        {/* Continue button - Duolingo style */}
        <button
          onClick={handleClose}
          className={cn(
            "w-full py-4 font-bold text-lg rounded-2xl transition-all duration-300",
            "bg-gradient-to-r from-orange-500 to-orange-600",
            "hover:from-orange-400 hover:to-orange-500",
            "text-white shadow-lg shadow-orange-500/30",
            "hover:shadow-xl hover:shadow-orange-500/40 hover:scale-[1.02]",
            "active:scale-[0.98]"
          )}
        >
          {language === 'en' ? 'Keep it up!' :
           language === 'ru' ? 'Так держать!' :
           language === 'uk' ? 'Так тримати!' :
           language === 'es' ? '¡Sigue así!' :
           language === 'de' ? 'Weiter so!' :
           'Continue comme ça!'}
        </button>
      </div>
    </div>
  );
}
