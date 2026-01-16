import { useEffect, useState, useRef } from 'react';
import { cn } from '@/lib/utils';
import { Flame, Clock, CheckCircle2, Trophy, TrendingUp } from 'lucide-react';

interface AnimatedAchievementCardProps {
  type: 'streak' | 'focus' | 'habits';
  value: number;
  label: string;
  sublabel: string;
  suffix?: string;
  delay?: number;
}

export function AnimatedAchievementCard({
  type,
  value,
  label,
  sublabel,
  suffix = '',
  delay = 0,
}: AnimatedAchievementCardProps) {
  const [displayValue, setDisplayValue] = useState(0);
  const [isAnimating, setIsAnimating] = useState(false);
  const [hasEntered, setHasEntered] = useState(false);
  const cardRef = useRef<HTMLDivElement>(null);

  // Animate value counting
  useEffect(() => {
    const timer = setTimeout(() => {
      setHasEntered(true);
      if (value > 0) {
        setIsAnimating(true);
        const duration = 1500;
        const steps = Math.min(value, 60);
        const stepDuration = duration / steps;
        let currentStep = 0;

        const interval = setInterval(() => {
          currentStep++;
          const progress = currentStep / steps;
          // Ease out cubic
          const eased = 1 - Math.pow(1 - progress, 3);
          setDisplayValue(Math.round(eased * value));

          if (currentStep >= steps) {
            clearInterval(interval);
            setDisplayValue(value);
            setTimeout(() => setIsAnimating(false), 500);
          }
        }, stepDuration);

        return () => clearInterval(interval);
      }
    }, delay);

    return () => clearTimeout(timer);
  }, [value, delay]);

  const configs = {
    streak: {
      icon: Flame,
      gradient: 'from-orange-500 via-red-500 to-yellow-500',
      bgGlow: 'shadow-orange-500/30',
      iconAnimation: 'animate-flame-flicker',
      progressColor: 'bg-gradient-to-r from-orange-500 to-red-500',
    },
    focus: {
      icon: Clock,
      gradient: 'from-violet-500 via-purple-500 to-indigo-500',
      bgGlow: 'shadow-violet-500/30',
      iconAnimation: 'animate-pulse',
      progressColor: 'bg-gradient-to-r from-violet-500 to-purple-500',
    },
    habits: {
      icon: CheckCircle2,
      gradient: 'from-emerald-500 via-green-500 to-teal-500',
      bgGlow: 'shadow-emerald-500/30',
      iconAnimation: 'animate-bounce-check',
      progressColor: 'bg-gradient-to-r from-emerald-500 to-green-500',
    },
  };

  const config = configs[type];
  const Icon = config.icon;

  return (
    <div
      ref={cardRef}
      className={cn(
        "relative overflow-hidden rounded-2xl p-5 transition-all duration-500",
        "bg-gradient-to-br from-secondary/80 to-secondary",
        hasEntered ? "opacity-100 translate-y-0" : "opacity-0 translate-y-8",
        isAnimating && "scale-[1.02]"
      )}
      style={{ transitionDelay: `${delay}ms` }}
    >
      {/* Animated background glow */}
      <div
        className={cn(
          "absolute inset-0 opacity-0 transition-opacity duration-500 blur-xl",
          `bg-gradient-to-br ${config.gradient}`,
          isAnimating && "opacity-20"
        )}
      />

      {/* Content */}
      <div className="relative z-10 flex items-center gap-4">
        {/* Animated icon container */}
        <div className="relative">
          <div
            className={cn(
              "w-14 h-14 rounded-xl flex items-center justify-center transition-all duration-300",
              `bg-gradient-to-br ${config.gradient}`,
              isAnimating && `shadow-lg ${config.bgGlow}`
            )}
          >
            <Icon
              className={cn(
                "w-7 h-7 text-white transition-transform",
                isAnimating && config.iconAnimation
              )}
            />
          </div>

          {/* Ring pulse effect */}
          {isAnimating && (
            <div className="absolute inset-0 rounded-xl animate-ping-slow">
              <div className={cn(
                "w-full h-full rounded-xl opacity-30",
                `bg-gradient-to-br ${config.gradient}`
              )} />
            </div>
          )}
        </div>

        {/* Text content */}
        <div className="flex-1">
          <p className="text-sm font-medium text-muted-foreground">{label}</p>
          <p className="text-xs text-muted-foreground/70">{sublabel}</p>
        </div>

        {/* Animated value */}
        <div className="text-right">
          <div className={cn(
            "text-3xl font-black transition-all duration-300",
            "bg-clip-text text-transparent",
            `bg-gradient-to-r ${config.gradient}`,
            isAnimating && "scale-110"
          )}>
            {displayValue}
            {suffix && <span className="text-lg ml-1">{suffix}</span>}
          </div>
        </div>
      </div>

      {/* Bottom progress bar */}
      <div className="relative mt-4 h-1.5 bg-secondary/50 rounded-full overflow-hidden">
        <div
          className={cn(
            "absolute inset-y-0 left-0 rounded-full transition-all duration-1000 ease-out",
            config.progressColor
          )}
          style={{
            width: hasEntered ? `${Math.min(100, (displayValue / Math.max(value, 1)) * 100)}%` : '0%',
            transitionDelay: `${delay + 200}ms`,
          }}
        />
        {/* Shimmer effect */}
        {isAnimating && (
          <div className="absolute inset-0 animate-shimmer-slide overflow-hidden">
            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/40 to-transparent" />
          </div>
        )}
      </div>
    </div>
  );
}

/**
 * Achievements Section with animated cards
 */
interface AnimatedAchievementsSectionProps {
  currentStreak: number;
  totalFocusMinutes: number;
  habitsCompleted: number;
  streakLabel: string;
  streakSublabel: string;
  focusLabel: string;
  focusSublabel: string;
  habitsLabel: string;
  habitsSublabel: string;
  focusSuffix: string;
  title: string;
  onShare?: () => void;
}

export function AnimatedAchievementsSection({
  currentStreak,
  totalFocusMinutes,
  habitsCompleted,
  streakLabel,
  streakSublabel,
  focusLabel,
  focusSublabel,
  habitsLabel,
  habitsSublabel,
  focusSuffix,
  title,
  onShare,
}: AnimatedAchievementsSectionProps) {
  return (
    <div className="bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-amber-500 to-orange-500 rounded-xl shadow-lg shadow-amber-500/20">
            <Trophy className="w-5 h-5 text-white" />
          </div>
          {/* Sparkle decorations */}
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-yellow-400 rounded-full animate-pulse" />
          <div className="absolute -bottom-1 -left-1 w-1.5 h-1.5 bg-amber-400 rounded-full animate-pulse delay-300" />
        </div>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {onShare && (
          <button
            onClick={onShare}
            className="p-2.5 bg-gradient-to-br from-primary to-accent rounded-xl text-white shadow-lg shadow-primary/20 hover:scale-105 transition-transform"
          >
            <TrendingUp className="w-5 h-5" />
          </button>
        )}
      </div>

      {/* Achievement Cards */}
      <div className="space-y-4">
        <AnimatedAchievementCard
          type="streak"
          value={currentStreak}
          label={streakLabel}
          sublabel={streakSublabel}
          delay={0}
        />
        <AnimatedAchievementCard
          type="focus"
          value={totalFocusMinutes}
          label={focusLabel}
          sublabel={focusSublabel}
          suffix={focusSuffix}
          delay={150}
        />
        <AnimatedAchievementCard
          type="habits"
          value={habitsCompleted}
          label={habitsLabel}
          sublabel={habitsSublabel}
          delay={300}
        />
      </div>
    </div>
  );
}
