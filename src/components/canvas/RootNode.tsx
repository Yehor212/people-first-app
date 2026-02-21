/**
 * RootNode — Central "Я" circle on the Mind Map Canvas.
 *
 * 80×80 circle with radial gradient, mood-colored border, and deep glow.
 * Uses CSS animate-garden-breathe for subtle idle pulse.
 */

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { ROOT_SIZE } from './mindMapLayout';
import type { MoodType } from '@/types';

const MOOD_BORDER: Record<MoodType, string> = {
  great: 'border-emerald-400',
  good: 'border-sky-400',
  okay: 'border-amber-400',
  bad: 'border-orange-400',
  terrible: 'border-red-400',
};

interface RootNodeProps {
  latestMood: MoodType | null;
  canvasCenter: { x: number; y: number };
}

export function RootNode({ latestMood, canvasCenter }: RootNodeProps) {
  const { t } = useLanguage();
  const borderColor = latestMood ? MOOD_BORDER[latestMood] : 'border-white/20';

  return (
    <div
      className="absolute animate-garden-breathe"
      style={{
        left: canvasCenter.x - ROOT_SIZE.width / 2,
        top: canvasCenter.y - ROOT_SIZE.height / 2,
        width: ROOT_SIZE.width,
        height: ROOT_SIZE.height,
      }}
    >
      <div
        className={cn(
          'w-full h-full rounded-full',
          'border-2', borderColor,
          'flex items-center justify-center',
          'text-white text-xl font-bold',
        )}
        style={{
          background: 'radial-gradient(circle, rgba(255,255,255,0.08) 0%, rgba(255,255,255,0.02) 60%, transparent 100%)',
          boxShadow: '0 0 40px rgba(255,255,255,0.1), 0 0 80px rgba(255,255,255,0.05)',
        }}
      >
        {t.you || 'Me'}
      </div>
    </div>
  );
}
