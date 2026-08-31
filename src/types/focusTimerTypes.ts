import {
  safeJsonParse,
  safeLocalStorageSet,
  storageReadRaw,
  storageRemove,
} from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { generateUuid, getToday } from '@/lib/utils';
import type { FocusSession } from '@/types';

// ============================================
// CONSTANTS
// ============================================

export const DEFAULT_FOCUS_MINUTES = 25;
export const DEFAULT_BREAK_MINUTES = 5;

// ============================================
// INTERFACES
// ============================================

export interface PendingFocusCommit {
  schemaVersion: 1;
  ownerUserId: string | null;
  accountBoundaryGeneration: string;
  session: FocusSession;
  requiresReflection: boolean;
}

export interface FocusCommitBoundary {
  ownerUserId: string | null;
  accountBoundaryGeneration: string;
  expectedPending?: PendingFocusCommit;
}

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
  onCompleteSession: (
    session: FocusSession,
    boundary?: FocusCommitBoundary
  ) => void | Promise<void>;
  onMinuteUpdate?: (minutes: number) => void;
}

// ============================================
// HELPERS
// ============================================

export type TimerStateRead =
  | { status: 'absent' }
  | { status: 'unavailable' }
  | { status: 'invalid' }
  | { status: 'present'; value: TimerState };

/** Load timer state while preserving unavailable/corrupt storage as fail-closed states. */
export function readTimerState(): TimerStateRead {
  const stored = storageReadRaw(SK.TIMER_STATE);
  if (!stored.ok) return { status: 'unavailable' };
  if (stored.value === null) return { status: 'absent' };
  const value = safeJsonParse<unknown>(stored.value, null);
  if (!value || typeof value !== 'object' || Array.isArray(value)) {
    return { status: 'invalid' };
  }
  const candidate = value as Partial<TimerState>;
  if (
    !(candidate.endTime === null || isNonNegativeInteger(candidate.endTime)) ||
    !isPositiveInteger(candidate.focusMinutes) ||
    !isPositiveInteger(candidate.breakMinutes) ||
    typeof candidate.isRunning !== 'boolean' ||
    typeof candidate.isBreak !== 'boolean' ||
    typeof candidate.label !== 'string' ||
    !(candidate.focusStartTime === null || isNonNegativeInteger(candidate.focusStartTime)) ||
    !isNonNegativeInteger(candidate.focusAccumulated) ||
    !['25', '50', 'custom'].includes(candidate.preset ?? '')
  ) {
    return { status: 'invalid' };
  }
  return {
    status: 'present',
    value: {
      endTime: candidate.endTime,
      focusMinutes: candidate.focusMinutes,
      breakMinutes: candidate.breakMinutes,
      isRunning: candidate.isRunning,
      isBreak: candidate.isBreak,
      label: candidate.label,
      focusStartTime: candidate.focusStartTime,
      focusAccumulated: candidate.focusAccumulated,
      preset: candidate.preset as TimerState['preset'],
    },
  };
}

/** Compatibility accessor for callers that deliberately do not distinguish read failures. */
export function loadTimerState(): TimerState | null {
  const read = readTimerState();
  return read.status === 'present' ? read.value : null;
}

export function loadPendingFocusCommit(): PendingFocusCommit | null {
  const read = readPendingFocusCommit();
  return read.status === 'present' ? read.value : null;
}

export type PendingFocusCommitRead =
  | { status: 'absent' }
  | { status: 'unavailable' }
  | { status: 'invalid' }
  | { status: 'present'; value: PendingFocusCommit };

export function readPendingFocusCommit(): PendingFocusCommitRead {
  const stored = storageReadRaw(SK.FOCUS_PENDING_COMMIT);
  if (!stored.ok) return { status: 'unavailable' };
  if (stored.value === null) return { status: 'absent' };
  const parsed = parsePendingFocusCommit(safeJsonParse<unknown>(stored.value, null));
  return parsed ? { status: 'present', value: parsed } : { status: 'invalid' };
}

export function pendingFocusCommitMatches(
  left: PendingFocusCommit,
  right: PendingFocusCommit,
): boolean {
  return (
    left.schemaVersion === right.schemaVersion &&
    left.ownerUserId === right.ownerUserId &&
    left.accountBoundaryGeneration === right.accountBoundaryGeneration &&
    left.requiresReflection === right.requiresReflection &&
    left.session.id === right.session.id &&
    left.session.duration === right.session.duration &&
    left.session.completedAt === right.session.completedAt &&
    left.session.date === right.session.date &&
    left.session.status === right.session.status &&
    left.session.label === right.session.label &&
    left.session.reflection === right.session.reflection &&
    left.session.updatedAt === right.session.updatedAt
  );
}

export function persistPendingFocusCommit(value: PendingFocusCommit): boolean {
  const parsed = parsePendingFocusCommit(value);
  return parsed !== null && safeLocalStorageSet(SK.FOCUS_PENDING_COMMIT, parsed);
}

export function clearPendingFocusCommit(): boolean {
  return storageRemove(SK.FOCUS_PENDING_COMMIT);
}

function isNonNegativeInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) >= 0;
}

function isPositiveInteger(value: unknown): value is number {
  return Number.isSafeInteger(value) && (value as number) > 0;
}

function parsePendingFocusCommit(value: unknown): PendingFocusCommit | null {
  if (!value || typeof value !== 'object' || Array.isArray(value)) return null;
  const candidate = value as Partial<PendingFocusCommit>;
  const session = candidate.session as Partial<FocusSession> | undefined;
  if (
    candidate.schemaVersion !== 1 ||
    !(
      candidate.ownerUserId === null ||
      (typeof candidate.ownerUserId === 'string' && candidate.ownerUserId.length > 0)
    ) ||
    typeof candidate.accountBoundaryGeneration !== 'string' ||
    candidate.accountBoundaryGeneration.length < 1 ||
    typeof candidate.requiresReflection !== 'boolean' ||
    !session ||
    typeof session.id !== 'string' ||
    session.id.length < 1 ||
    session.id.length > 512 ||
    !isPositiveInteger(session.duration) ||
    !isPositiveInteger(session.completedAt) ||
    typeof session.date !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(session.date) ||
    (session.status !== 'completed' && session.status !== 'aborted') ||
    (candidate.requiresReflection && session.status !== 'completed') ||
    (session.label !== undefined && typeof session.label !== 'string') ||
    (session.reflection !== undefined &&
      (typeof session.reflection !== 'number' ||
        !Number.isFinite(session.reflection) ||
        session.reflection < 0 ||
        session.reflection > 5)) ||
    (session.updatedAt !== undefined && !isNonNegativeInteger(session.updatedAt))
  ) {
    return null;
  }
  return {
    schemaVersion: 1,
    ownerUserId: candidate.ownerUserId,
    accountBoundaryGeneration: candidate.accountBoundaryGeneration,
    requiresReflection: candidate.requiresReflection,
    session: {
      id: session.id,
      duration: session.duration,
      completedAt: session.completedAt,
      date: session.date,
      status: session.status,
      ...(session.label !== undefined ? { label: session.label } : {}),
      ...(session.reflection !== undefined ? { reflection: session.reflection } : {}),
      updatedAt: session.updatedAt ?? session.completedAt,
    },
  };
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
  const completedAt = Date.now();
  return {
    id: generateUuid(),
    duration,
    completedAt,
    date: getToday(),
    label: label.trim() || undefined,
    status,
    updatedAt: completedAt,
  };
}
