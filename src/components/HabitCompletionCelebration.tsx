import { useState, useEffect, useMemo } from 'react';
import { cn } from '@/lib/utils';
import { Check, Flame, Star, Zap, Heart, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { motion, AnimatePresence } from 'framer-motion';

// Particle shape types for variety
type ParticleShape = 'circle' | 'star' | 'heart' | 'sparkle';

interface Particle {
  id: number;
  shape: ParticleShape;
  color: string;
  angle: number;
  distance: number;
  size: number;
  delay: number;
}

// Generate varied particles for celebration
function generateParticles(baseColor: string): Particle[] {
  const shapes: ParticleShape[] = ['circle', 'star', 'heart', 'sparkle'];
  const colors = [
    '#FFD700', // Gold
    '#FFA500', // Orange
    '#FF6347', // Tomato
    '#00CED1', // Cyan
    '#9370DB', // Purple
    '#32CD32', // Green
    baseColor, // Habit color
  ];

  return Array.from({ length: 20 }, (_, i) => ({
    id: i,
    shape: shapes[i % shapes.length],
    color: colors[i % colors.length],
    angle: i * 18 + Math.random() * 10, // Spread evenly with some randomness
    distance: 50 + Math.random() * 40,
    size: 6 + Math.random() * 8,
    delay: i * 25,
  }));
}

// Render different particle shapes
function ParticleIcon({ shape, size, color }: { shape: ParticleShape; size: number; color: string }) {
  switch (shape) {
    case 'star':
      return <Star className="fill-current" style={{ width: size, height: size, color }} />;
    case 'heart':
      return <Heart className="fill-current" style={{ width: size, height: size, color }} />;
    case 'sparkle':
      return <Sparkles style={{ width: size, height: size, color }} />;
    default:
      return (
        <div
          className="rounded-full"
          style={{ width: size, height: size, backgroundColor: color }}
        />
      );
  }
}

interface HabitCompletionCelebrationProps {
  habitName: string;
  habitIcon: string;
  habitColor: string;
  xpGained?: number;
  streakDays?: number;
  isAllComplete?: boolean;
  onComplete: () => void;
}

export function HabitCompletionCelebration({
  habitName,
  habitIcon,
  habitColor,
  xpGained = 10,
  streakDays,
  isAllComplete,
  onComplete,
}: HabitCompletionCelebrationProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<'check' | 'xp' | 'streak' | 'done'>('check');

  // Generate particles with habit color
  const particles = useMemo(() => generateParticles(habitColor), [habitColor]);

  useEffect(() => {
    // Phase 1: Checkmark animation
    const timer1 = setTimeout(() => setPhase('xp'), 400);

    // Phase 2: XP popup
    const timer2 = setTimeout(() => {
      if (streakDays && streakDays > 1) {
        setPhase('streak');
      } else {
        setPhase('done');
      }
    }, 1200);

    // Phase 3: Done
    const timer3 = setTimeout(() => {
      setPhase('done');
      onComplete();
    }, streakDays && streakDays > 1 ? 2200 : 1500);

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [streakDays, onComplete]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[150] pointer-events-none"
      style={{ bottom: 'calc(6rem + env(safe-area-inset-bottom, 0px))' }}
    >
      {/* Main completion toast */}
      <div
        className={cn(
          "relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300",
          habitColor,
          phase === 'check' && "animate-habit-complete-bounce scale-110",
          phase !== 'done' ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
        )}
      >
        {/* Animated checkmark */}
        <div className="relative">
          <div className={cn(
            "w-10 h-10 rounded-xl bg-foreground/20 flex items-center justify-center",
            phase === 'check' && "animate-check-circle-fill"
          )}>
            <Check className={cn(
              "w-6 h-6 text-white",
              phase === 'check' && "animate-check-draw"
            )} strokeWidth={3} />
          </div>

          {/* Sparkle effects */}
          <div className="absolute -top-1 -end-1 animate-sparkle-burst">
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
          </div>
          <div className="absolute -bottom-1 -start-1 animate-sparkle-burst delay-100">
            <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          </div>
        </div>

        {/* Habit name */}
        <div className="flex flex-col">
          <span className="text-white font-bold text-base">{habitName}</span>
          <span className="text-foreground/70 text-xs">{t.completed || 'Completed!'}</span>
        </div>

        {/* XP Popup - Premium with glow */}
        <AnimatePresence>
          {(phase === 'xp' || phase === 'streak') && (
            <motion.div
              className="absolute -top-10 end-4 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm"
              style={{
                background: 'linear-gradient(135deg, #fbbf24 0%, #f59e0b 50%, #d97706 100%)',
                color: '#78350f',
                boxShadow: '0 0 20px rgba(251, 191, 36, 0.6), 0 0 40px rgba(251, 191, 36, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
              }}
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              <motion.div
                animate={{ rotate: [0, 15, -15, 0] }}
                transition={{ duration: 0.5, repeat: Infinity, repeatDelay: 0.5 }}
              >
                <Zap className="w-5 h-5" />
              </motion.div>
              <span className="text-base">+{xpGained} XP</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak indicator - Premium with animated fire */}
        <AnimatePresence>
          {streakDays && streakDays > 1 && phase === 'streak' && (
            <motion.div
              className="absolute -top-14 left-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-white"
              style={{
                background: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #dc2626 100%)',
                boxShadow: '0 0 25px rgba(249, 115, 22, 0.5), 0 0 50px rgba(239, 68, 68, 0.3), 0 4px 12px rgba(0, 0, 0, 0.2)',
                x: '-50%',
              }}
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.5 }}
              transition={{ type: 'spring', stiffness: 300, damping: 20 }}
            >
              {/* Animated fire */}
              <motion.div
                animate={{
                  scale: [1, 1.2, 1],
                  rotate: [0, 5, -5, 0],
                }}
                transition={{
                  duration: 0.4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              >
                <Flame className="w-6 h-6" />
              </motion.div>
              <span className="text-lg">{streakDays} {t.dayStreak || 'day streak'}!</span>
              {/* Inner glow */}
              <motion.div
                className="absolute inset-0 rounded-full"
                style={{
                  background: 'radial-gradient(circle at center, rgba(255,255,255,0.2) 0%, transparent 70%)',
                }}
                animate={{ opacity: [0.3, 0.6, 0.3] }}
                transition={{ duration: 1, repeat: Infinity }}
              />
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Enhanced particle effects with varied shapes */}
      <AnimatePresence>
        {phase === 'check' && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {particles.map((particle) => {
              const angleRad = (particle.angle * Math.PI) / 180;
              const endX = Math.cos(angleRad) * particle.distance;
              const endY = Math.sin(angleRad) * particle.distance;

              return (
                <motion.div
                  key={particle.id}
                  className="absolute left-1/2 top-1/2"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: endX,
                    y: endY,
                    scale: [0, 1.2, 0.8],
                    opacity: [1, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 0.8,
                    delay: particle.delay / 1000,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <ParticleIcon
                    shape={particle.shape}
                    size={particle.size}
                    color={particle.color}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>

      {/* Trail effects on completion */}
      <AnimatePresence>
        {phase === 'check' && (
          <>
            {[...Array(6)].map((_, i) => (
              <motion.div
                key={`trail-${i}`}
                className="absolute left-1/2 top-1/2 w-1 rounded-full"
                style={{
                  background: `linear-gradient(180deg, ${habitColor} 0%, transparent 100%)`,
                  height: 20 + i * 5,
                }}
                initial={{
                  x: 0,
                  y: 0,
                  opacity: 0,
                  rotate: i * 60,
                }}
                animate={{
                  x: [0, Math.cos((i * 60 * Math.PI) / 180) * 30],
                  y: [0, Math.sin((i * 60 * Math.PI) / 180) * 30],
                  opacity: [0, 0.8, 0],
                  scaleY: [0.5, 1, 0.5],
                }}
                transition={{
                  duration: 0.5,
                  delay: i * 0.05,
                  ease: 'easeOut',
                }}
              />
            ))}
          </>
        )}
      </AnimatePresence>
    </div>
  );
}

/**
 * Daily Habits Progress Bar - Shows overall completion for the day
 */
interface DailyProgressBarProps {
  completedCount: number;
  totalCount: number;
  className?: string;
}

export function DailyProgressBar({ completedCount, totalCount, className }: DailyProgressBarProps) {
  const { t } = useLanguage();
  const progress = totalCount > 0 ? (completedCount / totalCount) * 100 : 0;
  const isComplete = completedCount === totalCount && totalCount > 0;

  return (
    <div className={cn("w-full", className)}>
      <div className="flex items-center justify-between mb-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t.todayProgress || "Today's Progress"}
        </span>
        <span className={cn(
          "text-sm font-bold transition-colors",
          isComplete ? "text-mood-good" : "text-foreground"
        )}>
          {completedCount}/{totalCount}
        </span>
      </div>

      <div className="relative h-3 bg-secondary rounded-full overflow-hidden">
        {/* Progress fill */}
        <div
          className={cn(
            "absolute inset-y-0 start-0 rounded-full transition-all duration-500 ease-out",
            isComplete
              ? "bg-gradient-to-r from-mood-good to-emerald-400"
              : "bg-gradient-to-r from-primary to-accent"
          )}
          style={{ width: `${progress}%` }}
        />

        {/* Shimmer effect when complete */}
        {isComplete && (
          <div className="absolute inset-0 animate-shimmer-slide">
            <div className="h-full w-1/4 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
          </div>
        )}

        {/* Progress dots */}
        <div className="absolute inset-0 flex items-center justify-around px-1">
          {Array.from({ length: totalCount }).map((_, i) => (
            <div
              key={i}
              className={cn(
                "w-1.5 h-1.5 rounded-full transition-all duration-300",
                i < completedCount
                  ? "bg-foreground/50 scale-100"
                  : "bg-foreground/20 scale-75"
              )}
              style={{ transitionDelay: `${i * 50}ms` }}
            />
          ))}
        </div>
      </div>

      {/* Completion message */}
      {isComplete && (
        <div className="mt-2 flex items-center justify-center gap-2 animate-fade-in">
          <span className="text-mood-good text-sm font-medium">
            🎉 {t.allHabitsComplete || 'All habits complete!'}
          </span>
        </div>
      )}
    </div>
  );
}

/**
 * Animated Habit Button with satisfying press effect
 */
interface AnimatedHabitButtonProps {
  icon: string;
  color: string;
  isCompleted: boolean;
  isAnimating: boolean;
  onClick: () => void;
}

export function AnimatedHabitButton({
  icon,
  color,
  isCompleted,
  isAnimating,
  onClick,
}: AnimatedHabitButtonProps) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "relative w-14 h-14 rounded-2xl flex items-center justify-center text-2xl transition-all duration-200",
        "btn-press overflow-hidden",
        isCompleted
          ? `${color} text-primary-foreground zen-shadow-soft`
          : "bg-background hover:scale-105 active:scale-95 border-2 border-transparent hover:border-primary/20"
      )}
    >
      {/* Background pulse on complete */}
      {isAnimating && (
        <div className="absolute inset-0 animate-ripple-out">
          <div className={cn("w-full h-full rounded-2xl", color, "opacity-50")} />
        </div>
      )}

      {/* Icon or checkmark */}
      <div className={cn(
        "relative z-10 transition-transform duration-300",
        isAnimating && "animate-habit-icon-complete"
      )}>
        {isCompleted ? (
          <Check
            className={cn(
              "w-7 h-7",
              isAnimating && "animate-check-pop"
            )}
            strokeWidth={3}
          />
        ) : (
          <span className={cn(
            "transition-transform",
            !isCompleted && "hover:scale-110"
          )}>
            {icon}
          </span>
        )}
      </div>

      {/* Completion ring */}
      {isCompleted && (
        <div className="absolute inset-0 rounded-2xl animate-completion-ring">
          <svg className="w-full h-full" viewBox="0 0 56 56">
            <rect
              x="2"
              y="2"
              width="52"
              height="52"
              rx="14"
              fill="none"
              stroke="currentColor"
              strokeWidth="3"
              className="text-white/50 animate-draw-rect"
              strokeDasharray="200"
              strokeDashoffset="200"
            />
          </svg>
        </div>
      )}
    </button>
  );
}
