import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Sparkles } from 'lucide-react';
import type { Trophy } from 'lucide-react';

// Sparkle particle component
export function SparkleParticle({ delay, color }: { delay: number; color: string }) {
  const rng = useMemo(() => ({
    left: 10 + Math.random() * 80,
    top: 10 + Math.random() * 80,
    repeatDelay: Math.random() * 3,
  }), []);

  return (
    <motion.div
      className="absolute"
      style={{
        left: `${rng.left}%`,
        top: `${rng.top}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
        rotate: [0, 180],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: rng.repeatDelay,
      }}
    >
      <Sparkles className="w-3 h-3" style={{ color }} />
    </motion.div>
  );
}

// Mini progress ring
export function MiniRing({
  value,
  color,
  size = 48,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="4"
        className="stroke-muted/20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

// Achievement badge component
export function AchievementBadge({
  icon: Icon,
  title,
  value,
  color,
  delay,
}: {
  icon: typeof Trophy;
  title: string;
  value: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className="relative flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/5 backdrop-blur-sm border border-foreground/10"
      style={{ boxShadow: `0 0 20px ${color}30` }}
    >
      <motion.div
        className="p-2.5 rounded-xl mb-2"
        style={{ background: `linear-gradient(135deg, ${color}40, ${color}20)` }}
        animate={{
          boxShadow: [
            `0 0 10px ${color}40`,
            `0 0 20px ${color}60`,
            `0 0 10px ${color}40`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </motion.div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center">{title}</span>
    </motion.div>
  );
}
