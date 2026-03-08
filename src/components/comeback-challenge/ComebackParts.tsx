import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { Sparkles, Trophy } from 'lucide-react';

// Sparkle particle for ambient effects
export function SparkleParticle({ delay, color }: { delay: number; color: string }) {
  const position = useMemo(() => ({
    left: `${5 + Math.random() * 90}%`,
    top: `${5 + Math.random() * 90}%`,
    repeatDelay: Math.random() * 4,
  }), []);

  return (
    <motion.div
      className="absolute"
      style={{
        left: position.left,
        top: position.top,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
        rotate: [0, 180],
      }}
      transition={{
        duration: 2.5,
        delay,
        repeat: Infinity,
        repeatDelay: position.repeatDelay,
      }}
    >
      <Sparkles className="w-3 h-3" style={{ color }} />
    </motion.div>
  );
}

// Mini progress ring
export function ProgressRing({
  progress,
  size = 64,
  strokeWidth = 4,
  color,
}: {
  progress: number;
  size?: number;
  strokeWidth?: number;
  color: string;
}) {
  const radius = (size - strokeWidth) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (progress / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        className="stroke-muted/20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth={strokeWidth}
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 8px ${color})` }}
      />
    </svg>
  );
}

// Crown icon for gold tier
export function Crown({ className }: { className?: string }) {
  return (
    <svg
      viewBox="0 0 24 24"
      fill="currentColor"
      className={className}
    >
      <path d="M5 16L3 5l5.5 5L12 4l3.5 6L21 5l-2 11H5zm14 3c0 .6-.4 1-1 1H6c-.6 0-1-.4-1-1v-1h14v1z" />
    </svg>
  );
}

// Completion celebration overlay
export function CompletionCelebration({
  isComplete,
  colors,
  xpReward,
  onDismiss,
  t,
}: {
  isComplete: boolean;
  colors: { primary: string; secondary: string; glow: string };
  xpReward: number;
  onDismiss: () => void;
  t: Record<string, string | undefined>;
}) {
  return (
    <AnimatePresence>
      {isComplete && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          exit={{ opacity: 0, scale: 0.8 }}
          className="absolute inset-0 flex items-center justify-center bg-background/80 backdrop-blur-sm rounded-3xl"
        >
          <motion.div
            className="text-center p-6"
            initial={{ y: 20 }}
            animate={{ y: 0 }}
          >
            <motion.div
              className="w-16 h-16 mx-auto mb-4 rounded-full flex items-center justify-center"
              style={{
                background: `linear-gradient(135deg, ${colors.primary}, ${colors.secondary})`,
                boxShadow: `0 0 40px ${colors.glow}`,
              }}
              animate={{
                scale: [1, 1.1, 1],
                boxShadow: [
                  `0 0 30px ${colors.glow}`,
                  `0 0 50px ${colors.glow}`,
                  `0 0 30px ${colors.glow}`,
                ],
              }}
              transition={{ duration: 1.5, repeat: Infinity }}
            >
              <Trophy className="w-8 h-8 text-white" />
            </motion.div>
            <h4 className="text-xl font-bold text-foreground mb-2">
              {t.challengeCompleted || 'Challenge Completed!'}
            </h4>
            <p className="text-sm text-muted-foreground mb-4">
              {t.youEarned || 'You earned'}{' '}
              <span className="font-bold" style={{ color: colors.primary }}>
                +{xpReward} XP
              </span>
            </p>
            <motion.button
              onClick={onDismiss}
              className="px-6 py-2 rounded-xl bg-muted hover:bg-muted/80 text-foreground font-medium text-sm"
              whileHover={{ scale: 1.05 }}
              whileTap={zenTap.button}
            >
              {t.awesome || 'Awesome!'}
            </motion.button>
          </motion.div>
        </motion.div>
      )}
    </AnimatePresence>
  );
}
