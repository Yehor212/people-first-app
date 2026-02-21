/**
 * CentralOrb — Glassmorphic mood-colored sphere at the canvas center.
 */

import { Orbit } from 'lucide-react';
import { cn } from '@/lib/utils';
import type { MoodType } from '@/types';
import { ORB_RADIUS } from './canvasLayout';

const MOOD_GRADIENTS: Record<MoodType, string> = {
  great: 'from-emerald-400 to-green-500',
  good: 'from-sky-400 to-blue-500',
  okay: 'from-amber-400 to-yellow-500',
  bad: 'from-orange-400 to-red-400',
  terrible: 'from-red-500 to-rose-600',
};

interface CentralOrbProps {
  latestMood: MoodType | null;
}

export function CentralOrb({ latestMood }: CentralOrbProps) {
  const gradient = latestMood ? MOOD_GRADIENTS[latestMood] : 'from-violet-400 to-purple-500';
  const size = ORB_RADIUS * 2;

  return (
    <div
      className="absolute animate-garden-breathe"
      style={{
        left: '50%',
        top: '50%',
        width: size,
        height: size,
        transform: `translate(-50%, -50%)`,
      }}
    >
      {/* Mood ring */}
      <div
        className={cn(
          'absolute inset-0 rounded-full bg-gradient-to-br opacity-40',
          gradient,
        )}
      />
      {/* Glass body */}
      <div className="absolute inset-1 rounded-full bg-surface-glass backdrop-blur-[var(--surface-glass-blur)] border border-[var(--surface-glass-border)] flex items-center justify-center">
        <Orbit className="w-6 h-6 text-foreground/60" />
      </div>
    </div>
  );
}
