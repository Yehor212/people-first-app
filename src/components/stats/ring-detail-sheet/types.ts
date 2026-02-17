/**
 * Types and configuration for RingDetailSheet
 */

import { Heart, Target, Brain } from 'lucide-react';

export type RingType = 'mood' | 'habits' | 'focus';

export interface DayData {
  date: string;
  value: number;
  label?: string;
}

export interface RingDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ringType: RingType | null;
  currentValue: number;
  weeklyData: DayData[];
  previousAverage?: number;
  onAction?: () => void;
}

// Ring theme configurations with premium styling
export const ringThemes: Record<RingType, {
  icon: typeof Heart;
  label: string;
  gradient: string;
  glowColor: string;
  chartColor: string;
  bgGradient: string;
  particleColor: string;
}> = {
  mood: {
    icon: Heart,
    label: 'Mood',
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    chartColor: '#f43f5e',
    bgGradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
    particleColor: '#fda4af',
  },
  habits: {
    icon: Target,
    label: 'Habits',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    glowColor: 'rgba(20, 184, 166, 0.5)',
    chartColor: '#14b8a6',
    bgGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    particleColor: '#5eead4',
  },
  focus: {
    icon: Brain,
    label: 'Focus',
    gradient: 'from-violet-500 via-purple-500 to-indigo-500',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    chartColor: '#8b5cf6',
    bgGradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    particleColor: '#c4b5fd',
  },
};
