import { safeJsonParse, storageGetRaw } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { generateId, getToday } from '@/lib/utils';
import type { FocusSession } from '@/types';

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

// ============================================
// INTERFACES
// ============================================

export interface TimerState {
  endTime: number | null;
  focusMinutes: number;
  breakMinutes: number;
  isRunning: boolean;
  isBreak: boolean;
  label: string;
  focusStartTime: number | null;
  focusAccumulated: number;
  preset: '25' | '50' | 'custom';
}

export interface UseFocusTimerOptions {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
  onMinuteUpdate?: (minutes: number) => void;
}

// ============================================
// HELPERS
// ============================================

/** Load timer state from localStorage - outside hook to avoid recreation on every render */
export function loadTimerState(): TimerState | null {
  const stored = storageGetRaw(SK.TIMER_STATE);
  if (stored) {
    return safeJsonParse<TimerState | null>(stored, null);
  }
  return null;
}

export const presetColors = {
  '25': { glow: 'hsl(var(--focus-emerald) / 0.5)', ring: 'ring-emerald-500/40', bg: 'from-emerald-500/20 to-emerald-600/10' },
  '50': { glow: 'hsl(var(--focus-violet) / 0.5)', ring: 'ring-violet-500/40', bg: 'from-violet-500/20 to-violet-600/10' },
  'custom': { glow: 'hsl(var(--focus-amber) / 0.5)', ring: 'ring-amber-500/40', bg: 'from-amber-500/20 to-amber-600/10' },
} as const;

/** Create a FocusSession object with standard fields populated. */
export function createFocusSession(
  duration: number,
  label: string,
  status: 'completed' | 'aborted',
): FocusSession {
  return {
    id: generateId(),
    duration,
    completedAt: Date.now(),
    date: getToday(),
    label: label.trim() || undefined,
    status,
  };
}
