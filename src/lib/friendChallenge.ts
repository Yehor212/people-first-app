/**
 * Friend Challenges - Challenge friends to habits without backend
 * Part of v1.4.0 Social & Sharing
 *
 * Uses generated challenge codes that encode habit info for sharing
 */

import { Habit } from '@/types';
import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from './safeJson';
import { generateSecureRandom, generateSecureId } from './validation';

// ============================================
// TYPES
// ============================================

export interface Challenge {
  id: string;
  code: string;
  habitName: string;
  habitIcon: string;
  duration: number; // days
  startDate: string; // ISO date
  endDate: string; // ISO date
  creatorName?: string;
  myProgress: number; // days completed
  isCreator: boolean;
  status: 'active' | 'completed' | 'expired';
}

export interface ChallengeInvite {
  code: string;
  habitName: string;
  habitIcon: string;
  duration: number;
  creatorName?: string;
  startDate?: string; // Optional: synced start date from creator
}

// ============================================
// CONSTANTS
// ============================================

const STORAGE_KEY = 'zenflow_challenges';
const CODE_PREFIX = 'ZEN';
const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789'; // No confusing chars (0, O, I, 1)

// Duration options in days
export const CHALLENGE_DURATIONS = [
  { value: 7, label: '7 days' },
  { value: 14, label: '14 days' },
  { value: 21, label: '21 days' },
  { value: 30, label: '30 days' },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique challenge code
 */
function generateCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(values, v => CODE_CHARS[v % CODE_CHARS.length]).join('');
  return `${CODE_PREFIX}-${code}`;
}

/**
 * Generate unique ID for challenge
 */
function generateId(): string {
  return generateSecureId('challenge');
}

/**
 * Calculate end date from start date and duration
 */
function calculateEndDate(startDate: string, duration: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + duration);
  return start.toISOString().split('T')[0];
}

/**
 * Get today's date as ISO string
 */
function getToday(): string {
  return new Date().toISOString().split('T')[0];
}

/**
 * Load challenges from localStorage
 */
function loadChallenges(): Challenge[] {
  return safeLocalStorageGet<Challenge[]>(STORAGE_KEY, []);
}

/**
 * Save challenges to localStorage
 */
function saveChallenges(challenges: Challenge[]): void {
  safeLocalStorageSet(STORAGE_KEY, challenges);
}

// ============================================
// MAIN API
// ============================================

/**
 * Create a new challenge from a habit
 */
export function createChallenge(
  habit: Habit,
  duration: number,
  creatorName?: string
): Challenge {
  const today = getToday();

  const challenge: Challenge = {
    id: generateId(),
    code: generateCode(),
    habitName: habit.name,
    habitIcon: habit.icon,
    duration,
    startDate: today,
    endDate: calculateEndDate(today, duration),
    creatorName,
    myProgress: 0,
    isCreator: true,
    status: 'active',
  };

  // Save to local storage
  const challenges = loadChallenges();
  challenges.push(challenge);
  saveChallenges(challenges);

  return challenge;
}

/**
 * Encode challenge data for sharing
 * Includes: habitName, habitIcon, duration, creatorName, code, startDate
 */
export function encodeInviteData(challenge: Challenge): string {
  const data = {
    n: challenge.habitName,
    i: challenge.habitIcon,
    d: challenge.duration,
    c: challenge.creatorName || '',
    cd: challenge.code,
    sd: challenge.startDate, // Include start date for synced timing
  };
  // Use encodeURIComponent to handle Unicode characters (emoji, non-ASCII)
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

/**
 * Decode invite data from encoded string
 * Handles both old format (btoa only) and new format (encodeURIComponent + btoa)
 */
export function decodeInviteData(encoded: string): ChallengeInvite | null {
  try {
    // Input length validation to prevent DoS (reasonable max: 10KB)
    if (!encoded || typeof encoded !== 'string' || encoded.length > 10000) {
      return null;
    }

    let jsonStr: string;
    try {
      // Try new format first (encodeURIComponent + btoa)
      jsonStr = decodeURIComponent(atob(encoded));
    } catch {
      // Fall back to old format (btoa only)
      jsonStr = atob(encoded);
    }
    const data = safeJsonParse<{ cd: string; n: string; i: string; d: number; c?: string; sd?: string } | null>(jsonStr, null);
    if (!data) return null;
    return {
      code: data.cd,
      habitName: data.n,
      habitIcon: data.i,
      duration: data.d,
      creatorName: data.c || undefined,
      startDate: data.sd, // Optional: start date from creator
    };
  } catch {
    return null;
  }
}

/**
 * Join an existing challenge from invite data
 */
export function joinChallenge(invite: ChallengeInvite): Challenge {
  // Use synced start date if provided, otherwise use today
  const startDate = invite.startDate || getToday();

  const challenge: Challenge = {
    id: generateId(),
    code: invite.code,
    habitName: invite.habitName,
    habitIcon: invite.habitIcon,
    duration: invite.duration,
    startDate,
    endDate: calculateEndDate(startDate, invite.duration),
    creatorName: invite.creatorName,
    myProgress: 0,
    isCreator: false,
    status: 'active',
  };

  // Save to local storage
  const challenges = loadChallenges();

  // Check if already joined this challenge
  const existing = challenges.find(c => c.code === invite.code);
  if (existing) {
    return existing;
  }

  challenges.push(challenge);
  saveChallenges(challenges);

  return challenge;
}

/**
 * Join a challenge by code only (when no invite data available)
 * Used when user manually enters a code
 */
export function joinChallengeByCode(code: string): Challenge | null {
  const normalizedCode = code.trim().toUpperCase();

  // Validate code format: ZEN-XXXXXX
  if (!/^ZEN-[A-Z0-9]{6}$/.test(normalizedCode)) {
    return null;
  }

  const challenges = loadChallenges();

  // Check if already joined
  const existing = challenges.find(c => c.code === normalizedCode);
  if (existing) {
    return existing;
  }

  const today = getToday();

  // Create challenge with default values (without server we don't know habit details)
  const challenge: Challenge = {
    id: generateId(),
    code: normalizedCode,
    habitName: 'Friend Challenge',
    habitIcon: '🤝',
    duration: 7, // Default 7 days
    startDate: today,
    endDate: calculateEndDate(today, 7),
    creatorName: undefined,
    myProgress: 0,
    isCreator: false,
    status: 'active',
  };

  challenges.push(challenge);
  saveChallenges(challenges);

  return challenge;
}

/**
 * Get all active challenges
 */
export function getActiveChallenges(): Challenge[] {
  const challenges = loadChallenges();
  const today = getToday();

  return challenges.filter(c => {
    // Update status based on dates
    if (c.endDate < today) {
      c.status = c.myProgress >= c.duration ? 'completed' : 'expired';
    }
    return c.status === 'active';
  });
}

/**
 * Get all challenges (including completed/expired)
 */
export function getAllChallenges(): Challenge[] {
  const challenges = loadChallenges();
  const today = getToday();

  // Update statuses
  return challenges.map(c => {
    if (c.status === 'active' && c.endDate < today) {
      return {
        ...c,
        status: c.myProgress >= c.duration ? 'completed' : 'expired' as const,
      };
    }
    return c;
  });
}

/**
 * Update challenge progress (called when habit is completed)
 */
export function updateChallengeProgress(
  challengeId: string,
  increment: number = 1
): Challenge | null {
  const challenges = loadChallenges();
  const index = challenges.findIndex(c => c.id === challengeId);

  if (index === -1) return null;

  const challenge = challenges[index];
  challenge.myProgress = Math.min(
    challenge.myProgress + increment,
    challenge.duration
  );

  // Check if completed
  if (challenge.myProgress >= challenge.duration) {
    challenge.status = 'completed';
  }

  saveChallenges(challenges);
  return challenge;
}

/**
 * Delete a challenge
 */
export function deleteChallenge(challengeId: string): boolean {
  const challenges = loadChallenges();
  const filtered = challenges.filter(c => c.id !== challengeId);

  if (filtered.length === challenges.length) return false;

  saveChallenges(filtered);
  return true;
}

/**
 * Generate a shareable link for a challenge
 */
export function generateShareLink(challenge: Challenge): string {
  const encoded = encodeInviteData(challenge);
  // Use custom scheme for direct app opening (no domain verification needed)
  return `zenflow://challenge?data=${encoded}`;
}

/**
 * Generate share text for challenge
 */
export function generateShareText(
  challenge: Challenge,
  translations: Record<string, string> = {}
): string {
  const t = translations;

  return [
    `${challenge.habitIcon} ${t.challengeInvite || 'Join my challenge!'}`,
    '',
    `${t.habit || 'Habit'}: ${challenge.habitName}`,
    `${t.duration || 'Duration'}: ${challenge.duration} ${t.days || 'days'}`,
    `${t.code || 'Code'}: ${challenge.code}`,
    '',
    t.challengeJoinPrompt || 'Join me on ZenFlow!',
  ].join('\n');
}

/**
 * Share challenge using Web Share API
 */
export async function shareChallenge(
  challenge: Challenge,
  translations: Record<string, string> = {}
): Promise<boolean> {
  const text = generateShareText(challenge, translations);
  const url = generateShareLink(challenge);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${challenge.habitIcon} ${challenge.habitName} Challenge`,
        text,
        url,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        console.error('Share failed:', error);
      }
      return false;
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(`${text}\n\n${url}`);
    return true;
  } catch {
    return false;
  }
}

/**
 * Check if a habit matches any active challenge
 */
export function findChallengeForHabit(habitName: string): Challenge | null {
  const challenges = getActiveChallenges();
  return challenges.find(c =>
    c.habitName.toLowerCase() === habitName.toLowerCase()
  ) || null;
}

/**
 * Get challenge progress percentage
 */
export function getChallengeProgress(challenge: Challenge): number {
  if (!challenge.duration || challenge.duration <= 0) return 0;
  return Math.round((challenge.myProgress / challenge.duration) * 100);
}

/**
 * Get days remaining in challenge
 */
export function getDaysRemaining(challenge: Challenge): number {
  const today = new Date();
  const end = new Date(challenge.endDate);
  const diff = end.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
