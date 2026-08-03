import { useMemo } from "react";
import type { CSSProperties } from "react";
import { motion } from "framer-motion";
import { easings } from "@/lib/motion";
import { springs } from "@/config/animations";
import { Sparkles } from "lucide-react";
import type { Trophy } from "lucide-react";

// Sparkle particle component
export function SparkleParticle({ delay, color }: { delay: number; color: string }) {
  const rng = useMemo(
    () => ({
      left: 10 + Math.random() * 80,
      top: 10 + Math.random() * 80,
      repeatDelay: Math.random() * 3,
    }),
    []
  );

  return (
    <div
      className="absolute animate-zen-loop-sparkle"
      style={{
        left: `${rng.left}%`,
        top: `${rng.top}%`,
        opacity: 0,
        "--zen-loop-scale": 1,
        "--zen-loop-rotate": "180deg",
        "--zen-loop-duration": `${2 + rng.repeatDelay}s`,
        "--zen-loop-delay": `${delay}s`,
      } as CSSProperties}
    >
      <Sparkles className="w-3 h-3" style={{ color }} />
    </div>
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
        transition={{ duration: 0.6, ease: easings.emphasizedDecelerate }}
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
      transition={{ delay, ...springs.smooth }}
      className="relative flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/5 backdrop-blur-sm border border-foreground/10"
      style={{ boxShadow: `0 0 20px ${color}30` }}
    >
      <div
        className="relative p-2.5 rounded-xl mb-2 animate-zen-loop-glow"
        style={{
          background: `linear-gradient(135deg, ${color}40, ${color}20)`,
          boxShadow: `0 0 10px ${color}40`,
          "--zen-glow-a": `0 0 10px ${color}40`,
          "--zen-glow-b": `0 0 20px ${color}60`,
          "--zen-loop-duration": "2s",
        } as CSSProperties}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="min-w-0 break-words text-center text-xs text-muted-foreground">{title}</span>
    </motion.div>
  );
}
