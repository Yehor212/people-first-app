/**
 * RootNode — "The Orb" — Central node on the Mind Map Canvas.
 *
 * 80×80 core with conic-gradient SVG progress ring showing goal
 * completion %. Uses CSS motion-safe:animate-orb-breathe for glow pulse.
 * OrbLottie ambient animation renders behind the core.
 *
 * Tap → triggers onTap callback (split mode). Pulses faster in split mode.
 */

import { memo, useCallback } from 'react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { haptics } from '@/lib/haptics';
import { ROOT_SIZE } from './mindMapLayout';
import { OrbLottie } from './OrbLottie';
import type { MoodType } from '@/types';
import type { CanvasMode } from '@/stores/uiStore';

const MOOD_BORDER: Record<MoodType, string> = {
  great: 'border-emerald-400',
  good: 'border-sky-400',
  okay: 'border-amber-400',
  bad: 'border-orange-400',
  terrible: 'border-red-400',
};

const MOOD_RING_COLOR: Record<MoodType, string> = {
  great: '#34d399',
  good: '#38bdf8',
  okay: '#fbbf24',
  bad: '#fb923c',
  terrible: '#f87171',
};

// SVG circle circumference for r=40: 2 * PI * 40 = 251.327
const RING_CIRCUMFERENCE = 251.327;

interface RootNodeProps {
  latestMood: MoodType | null;
  canvasCenter: { x: number; y: number };
  completionPercent: number; // 0–1
  canvasMode: CanvasMode;
  onTap: () => void;
}

export const RootNode = memo(function RootNode({ latestMood, canvasCenter, completionPercent, canvasMode, onTap }: RootNodeProps) {
  const { t } = useLanguage();
  const borderColor = latestMood ? MOOD_BORDER[latestMood] : 'border-white/20';
  const ringColor = latestMood ? MOOD_RING_COLOR[latestMood] : 'rgba(255,255,255,0.3)';
  const filled = completionPercent * RING_CIRCUMFERENCE;
  const isSplit = canvasMode === 'split';

  const handleTap = useCallback(() => {
    void haptics.light();
    onTap();
  }, [onTap]);

  return (
    <div
      className="absolute z-10"
      style={{
        left: canvasCenter.x - ROOT_SIZE.width / 2,
        top: canvasCenter.y - ROOT_SIZE.height / 2,
        width: ROOT_SIZE.width,
        height: ROOT_SIZE.height,
      }}
    >
      {/* Lottie ambient glow (behind everything) */}
      <OrbLottie />

      {/* SVG progress ring */}
      <svg
        viewBox="0 0 100 100"
        className="absolute inset-[-12px] pointer-events-none w-[calc(100%+24px)] h-[calc(100%+24px)]"
      >
        {/* Track ring */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke="rgba(255,255,255,0.08)"
          strokeWidth="2.5"
        />
        {/* Progress arc */}
        <circle
          cx="50" cy="50" r="40"
          fill="none"
          stroke={ringColor}
          strokeWidth="2.5"
          strokeLinecap="round"
          strokeDasharray={`${filled} ${RING_CIRCUMFERENCE}`}
          transform="rotate(-90 50 50)"
          className="motion-safe:transition-all motion-safe:duration-700 ease-out"
          style={{ opacity: completionPercent > 0 ? 0.7 : 0 }}
        />
      </svg>

      {/* Core orb — tappable */}
      <button
        type="button"
        onPointerUp={handleTap}
        className={cn(
          'w-full h-full rounded-full',
          isSplit ? 'motion-safe:animate-pulse' : 'motion-safe:animate-orb-breathe',
          'border-2', borderColor,
          'flex items-center justify-center',
          'text-white text-xl font-bold',
          'cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-white/30 focus-visible:ring-offset-0',
          'bg-[radial-gradient(circle,rgba(255,255,255,0.12)_0%,rgba(255,255,255,0.04)_50%,rgba(15,20,30,0.8)_100%)]'
        )}
        style={{
          boxShadow: `0 0 40px ${ringColor}30, 0 0 80px ${ringColor}15, 0 10px 40px rgba(0,0,0,0.5)`,
        }}
        aria-label={t.you || 'Me'}
      >
        {t.you || 'Me'}
      </button>
    </div>
  );
});
