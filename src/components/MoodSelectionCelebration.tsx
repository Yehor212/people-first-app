import { useState, useEffect } from 'react';
import { MoodType } from '@/types';
import { AnimatedMoodEmoji } from './AnimatedMoodEmoji';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { Sun, Cloud, Moon, MessageCircle } from 'lucide-react';

interface MoodSelectionCelebrationProps {
  mood: MoodType;
  note?: string;
  timeOfDay: 'morning' | 'afternoon' | 'evening';
  xpGained?: number;
  onComplete: () => void;
}

const timeIcons = {
  morning: Sun,
  afternoon: Cloud,
  evening: Moon,
};

const moodColors = {
  great: '#4ade80',
  good: '#22c55e',
  okay: '#fbbf24',
  bad: '#f97316',
  terrible: '#ef4444',
};

export function MoodSelectionCelebration({
  mood,
  note,
  timeOfDay,
  xpGained = 5,
  onComplete
}: MoodSelectionCelebrationProps) {
  const { t, language } = useLanguage();
  const [phase, setPhase] = useState<'jump' | 'calendar' | 'done'>('jump');
  const [showXP, setShowXP] = useState(false);

  const TimeIcon = timeIcons[timeOfDay];
  const today = new Date();
  const dayNames = language === 'ru'
    ? ['Вс', 'Пн', 'Вт', 'Ср', 'Чт', 'Пт', 'Сб']
    : ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];

  useEffect(() => {
    // Phase 1: Emoji jumps up
    const jumpTimer = setTimeout(() => {
      setPhase('calendar');
      setShowXP(true);
    }, 600);

    // Phase 2: Calendar receives emoji
    const calendarTimer = setTimeout(() => {
      setPhase('done');
    }, 1800);

    // Complete animation
    const completeTimer = setTimeout(() => {
      onComplete();
    }, 2500);

    return () => {
      clearTimeout(jumpTimer);
      clearTimeout(calendarTimer);
      clearTimeout(completeTimer);
    };
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[300] flex items-center justify-center bg-black/60 backdrop-blur-sm">
      {/* XP Popup */}
      {showXP && (
        <div
          className="xp-popup text-2xl"
          style={{ top: '30%', left: '50%', transform: 'translateX(-50%)' }}
        >
          +{xpGained} XP
        </div>
      )}

      {/* Jumping Emoji */}
      {phase === 'jump' && (
        <div className="mood-jump-animation">
          <AnimatedMoodEmoji mood={mood} size="xl" isSelected />
        </div>
      )}

      {/* Calendar View */}
      {(phase === 'calendar' || phase === 'done') && (
        <div className={cn(
          "bg-card rounded-3xl p-6 shadow-2xl border-2 max-w-sm w-full mx-4 transition-all duration-500",
          phase === 'calendar' ? "scale-100 opacity-100" : "scale-95 opacity-90"
        )}
        style={{ borderColor: moodColors[mood] }}
        >
          {/* Header */}
          <div className="text-center mb-4">
            <p className="text-sm text-muted-foreground">
              {today.toLocaleDateString(language, { month: 'long', year: 'numeric' })}
            </p>
            <h3 className="text-xl font-bold text-foreground">
              {t.moodRecorded || 'Mood Recorded!'}
            </h3>
          </div>

          {/* Mini Calendar */}
          <div className="bg-secondary/50 rounded-2xl p-4 mb-4">
            {/* Day names */}
            <div className="grid grid-cols-7 gap-1 mb-2">
              {dayNames.map(day => (
                <div key={day} className="text-[10px] text-center text-muted-foreground font-medium">
                  {day}
                </div>
              ))}
            </div>

            {/* Calendar days */}
            <div className="grid grid-cols-7 gap-1">
              {Array.from({ length: 35 }, (_, i) => {
                const firstDay = new Date(today.getFullYear(), today.getMonth(), 1).getDay();
                const daysInMonth = new Date(today.getFullYear(), today.getMonth() + 1, 0).getDate();
                const dayNum = i - firstDay + 1;
                const isToday = dayNum === today.getDate();
                const isValid = dayNum > 0 && dayNum <= daysInMonth;

                return (
                  <div
                    key={i}
                    className={cn(
                      "aspect-square rounded-lg flex items-center justify-center text-xs transition-all",
                      !isValid && "invisible",
                      isToday && "calendar-day-highlight"
                    )}
                    style={isToday ? {
                      backgroundColor: `${moodColors[mood]}30`,
                      color: moodColors[mood],
                      boxShadow: `0 0 15px ${moodColors[mood]}50`
                    } : {}}
                  >
                    {isValid && (
                      isToday ? (
                        <div className="relative w-full h-full flex items-center justify-center">
                          <AnimatedMoodEmoji mood={mood} size="sm" />
                        </div>
                      ) : (
                        <span className="text-muted-foreground">{dayNum}</span>
                      )
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Time of Day Section */}
          <div className="flex justify-center gap-4 mb-4">
            {(['morning', 'afternoon', 'evening'] as const).map(time => {
              const Icon = timeIcons[time];
              const isActive = time === timeOfDay;
              return (
                <div
                  key={time}
                  className={cn(
                    "flex flex-col items-center gap-1 p-2 rounded-xl transition-all",
                    isActive ? "bg-primary/20 ring-2 ring-primary/50" : "opacity-40"
                  )}
                >
                  <div className={cn(
                    "w-8 h-8 rounded-full flex items-center justify-center",
                    isActive ? "bg-primary/30" : "bg-secondary"
                  )}>
                    {isActive ? (
                      <AnimatedMoodEmoji mood={mood} size="sm" />
                    ) : (
                      <Icon className="w-4 h-4 text-muted-foreground" />
                    )}
                  </div>
                  <span className={cn(
                    "text-[10px]",
                    isActive ? "text-primary font-medium" : "text-muted-foreground"
                  )}>
                    {time === 'morning' ? (t.morning || 'Morning') :
                     time === 'afternoon' ? (t.afternoon || 'Afternoon') :
                     (t.evening || 'Evening')}
                  </span>
                </div>
              );
            })}
          </div>

          {/* Note bubble if exists */}
          {note && (
            <div className="flex items-start gap-2 p-3 bg-secondary/30 rounded-xl animate-fade-in">
              <MessageCircle className="w-4 h-4 text-muted-foreground mt-0.5 flex-shrink-0" />
              <p className="text-sm text-foreground line-clamp-2">{note}</p>
            </div>
          )}

          {/* Sparkles decoration */}
          <div className="absolute top-2 right-2">
            <div className="text-2xl animate-bounce-gentle">✨</div>
          </div>
          <div className="absolute top-4 left-4">
            <div className="text-xl animate-sparkle" style={{ animationDelay: '0.3s' }}>⭐</div>
          </div>
        </div>
      )}
    </div>
  );
}

// XP Popup component for reuse
export function XPPopup({ amount, x, y }: { amount: number; x: number; y: number }) {
  return (
    <div
      className="xp-popup text-xl"
      style={{ left: x, top: y }}
    >
      +{amount} XP
    </div>
  );
}

// Action Success component
export function ActionSuccess({
  type,
  onComplete
}: {
  type: 'mood' | 'habit' | 'focus' | 'gratitude';
  onComplete: () => void;
}) {
  const messages = {
    mood: { emoji: '😊', text: 'Mood saved!' },
    habit: { emoji: '✅', text: 'Habit completed!' },
    focus: { emoji: '🧠', text: 'Focus session done!' },
    gratitude: { emoji: '💖', text: 'Gratitude added!' },
  };

  const { emoji, text } = messages[type];

  useEffect(() => {
    const timer = setTimeout(onComplete, 1500);
    return () => clearTimeout(timer);
  }, [onComplete]);

  return (
    <div className="fixed inset-0 z-[200] flex items-center justify-center pointer-events-none">
      <div className="flex flex-col items-center animate-scale-in">
        <div className="text-6xl mb-2 animate-bounce-gentle">{emoji}</div>
        <div className="text-lg font-bold text-primary animate-fade-in">{text}</div>
      </div>
    </div>
  );
}
