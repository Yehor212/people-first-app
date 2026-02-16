import type { BreathingPhase, BreathingPattern } from '@/lib/breathingPatterns';

export interface BreathingExerciseProps {
  onComplete?: (pattern: BreathingPattern) => void;
  compact?: boolean;
}

export const phaseColors: Record<BreathingPhase | 'complete', string> = {
  inhale: '#06b6d4',
  holdIn: '#8b5cf6',
  exhale: '#14b8a6',
  holdOut: '#64748b',
  complete: '#10b981',
};

export const phaseGradients: Record<BreathingPhase | 'complete', string> = {
  inhale: 'linear-gradient(135deg, #06b6d4 0%, #0891b2 50%, #0e7490 100%)',
  holdIn: 'linear-gradient(135deg, #8b5cf6 0%, #7c3aed 50%, #6d28d9 100%)',
  exhale: 'linear-gradient(135deg, #14b8a6 0%, #0d9488 50%, #0f766e 100%)',
  holdOut: 'linear-gradient(135deg, #64748b 0%, #475569 50%, #334155 100%)',
  complete: 'linear-gradient(135deg, #10b981 0%, #059669 50%, #047857 100%)',
};

export const generateStars = (count: number) =>
  Array.from({ length: count }, (_, i) => ({
    id: i,
    left: Math.random() * 100,
    top: Math.random() * 100,
    delay: Math.random() * 2,
    duration: 2 + Math.random() * 2,
  }));
