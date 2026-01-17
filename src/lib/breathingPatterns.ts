/**
 * Breathing patterns for mindfulness exercises
 * Each pattern has timing in seconds for each phase
 */

export interface BreathingPattern {
  id: string;
  name: string;
  nameKey: string; // translation key
  description: string;
  descriptionKey: string;
  inhale: number;      // seconds
  holdAfterInhale: number;
  exhale: number;
  holdAfterExhale: number;
  cycles: number;      // recommended cycles
  effect: 'calming' | 'energizing' | 'focusing' | 'sleeping';
  emoji: string;
}

export const BREATHING_PATTERNS: BreathingPattern[] = [
  {
    id: 'box',
    name: 'Box Breathing',
    nameKey: 'breathingBox',
    description: 'Equal phases for focus and balance',
    descriptionKey: 'breathingBoxDesc',
    inhale: 4,
    holdAfterInhale: 4,
    exhale: 4,
    holdAfterExhale: 4,
    cycles: 4,
    effect: 'focusing',
    emoji: '🎯',
  },
  {
    id: '478',
    name: '4-7-8 Relaxing',
    nameKey: 'breathing478',
    description: 'Deep calming for anxiety relief',
    descriptionKey: 'breathing478Desc',
    inhale: 4,
    holdAfterInhale: 7,
    exhale: 8,
    holdAfterExhale: 0,
    cycles: 4,
    effect: 'calming',
    emoji: '😌',
  },
  {
    id: 'energize',
    name: 'Energizing Breath',
    nameKey: 'breathingEnergize',
    description: 'Quick inhales for energy boost',
    descriptionKey: 'breathingEnergizeDesc',
    inhale: 2,
    holdAfterInhale: 1,
    exhale: 4,
    holdAfterExhale: 1,
    cycles: 6,
    effect: 'energizing',
    emoji: '⚡',
  },
  {
    id: 'sleep',
    name: 'Sleep Preparation',
    nameKey: 'breathingSleep',
    description: 'Slow exhales for better sleep',
    descriptionKey: 'breathingSleepDesc',
    inhale: 4,
    holdAfterInhale: 0,
    exhale: 8,
    holdAfterExhale: 2,
    cycles: 5,
    effect: 'sleeping',
    emoji: '🌙',
  },
];

export type BreathingPhase = 'inhale' | 'holdIn' | 'exhale' | 'holdOut' | 'complete';

export function getPhaseInstruction(phase: BreathingPhase, t: Record<string, string>): string {
  switch (phase) {
    case 'inhale':
      return t.breatheIn || 'Breathe in';
    case 'holdIn':
    case 'holdOut':
      return t.hold || 'Hold';
    case 'exhale':
      return t.breatheOut || 'Breathe out';
    case 'complete':
      return t.complete || 'Complete';
    default:
      return '';
  }
}

export function getTotalDuration(pattern: BreathingPattern): number {
  const cycleTime = pattern.inhale + pattern.holdAfterInhale + pattern.exhale + pattern.holdAfterExhale;
  return cycleTime * pattern.cycles;
}

export function formatDuration(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  if (mins === 0) return `${secs}s`;
  return secs === 0 ? `${mins}m` : `${mins}m ${secs}s`;
}
