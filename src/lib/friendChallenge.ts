/**
 * Friend Challenges - Challenge friends to habits without backend
 * Part of v1.4.0 Social & Sharing
 *
 * Uses generated challenge codes that encode habit info for sharing
 */

import { z } from "zod";
import { Habit } from "@/types";
import { safeJsonParse, safeLocalStorageGet, safeLocalStorageSet } from "./safeJson";
import { SK } from "@/lib/storageKeys";
import { generateSecureId } from "./validation";
import { sanitizeString, sanitizeUserName } from "./sanitize";
import { parseLocalDate, getToday } from "@/lib/utils";
import { logger } from "./logger";
import { buildSocialInviteUrl } from "./socialInvite";
import {
  isChallengeMember,
  isCloudChallengesAvailable,
  joinCloudChallenge,
  resolveChallengeInvite,
  syncLocalChallengeToCloud,
  updateMyProgress as updateCloudProgress,
} from "./challengeService";

// Zod schema for decoded invite data — validates fields from untrusted deep links (CWE-20)
const invitePayloadSchema = z.object({
  cd: z.string().min(1).max(100),
  n: z.string().min(1).max(100),
  i: z.string().min(1).max(100),
  d: z.number().int().min(1).max(365),
  c: z.string().max(100).optional(),
  sd: z
    .string()
    .regex(/^\d{4}-\d{2}-\d{2}$/)
    .optional(),
});

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
  status: "active" | "completed" | "expired";
}

export interface ChallengeInvite {
  code: string;
}

export type ChallengeJoinFailureReason =
  | "invalid"
  | "offline"
  | "signed_out"
  | "not_found"
  | "expired"
  | "self"
  | "duplicate"
  | "unavailable";

export type ChallengeJoinResult =
  | { success: true; challenge: Challenge }
  | { success: false; reason: ChallengeJoinFailureReason };

// ============================================
// CONSTANTS
// ============================================

const CODE_PREFIX = "ZEN";
const CODE_CHARS = "ABCDEFGHJKLMNPQRSTUVWXYZ23456789"; // No confusing chars (0, O, I, 1)

// Duration options in days
export const CHALLENGE_DURATIONS = [
  { value: 7, label: "7 days" },
  { value: 14, label: "14 days" },
  { value: 21, label: "21 days" },
  { value: 30, label: "30 days" },
] as const;

// ============================================
// HELPER FUNCTIONS
// ============================================

/**
 * Generate a unique challenge code
 */
function generateCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(6));
  const code = Array.from(values, (v) => CODE_CHARS[v % CODE_CHARS.length]).join("");
  return `${CODE_PREFIX}-${code}`;
}

/**
 * Generate unique ID for challenge
 */
function generateId(): string {
  return generateSecureId("challenge");
}

/**
 * Calculate end date from start date and duration
 */
function calculateEndDate(startDate: string, duration: number): string {
  const start = new Date(startDate);
  start.setDate(start.getDate() + duration);
  return start.toISOString().split("T")[0];
}

// getToday imported from @/lib/utils (uses local time, not UTC)

/**
 * Load challenges from localStorage
 */
function loadChallenges(): Challenge[] {
  return safeLocalStorageGet<Challenge[]>(SK.CHALLENGES, []);
}

/**
 * Save challenges to localStorage
 */
function saveChallenges(challenges: Challenge[]): void {
  safeLocalStorageSet(SK.CHALLENGES, challenges);
}

// ============================================
// MAIN API
// ============================================

/**
 * Create a new challenge from a habit
 */
export function createChallenge(habit: Habit, duration: number, creatorName?: string): Challenge {
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
    status: "active",
  };

  // Save to local storage
  const challenges = loadChallenges();
  challenges.push(challenge);
  saveChallenges(challenges);

  // Sync to cloud (non-blocking)
  if (isCloudChallengesAvailable()) {
    syncLocalChallengeToCloud(
      challenge.code,
      challenge.habitName,
      challenge.habitIcon,
      challenge.duration,
      challenge.startDate,
      creatorName || "Zen User"
    ).catch((err) => logger.warn("[FriendChallenge] Cloud sync failed:", err));
  }

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
    c: challenge.creatorName || "",
    cd: challenge.code,
    sd: challenge.startDate, // Include start date for synced timing
  };
  // Use encodeURIComponent to handle Unicode characters (emoji, non-ASCII)
  return btoa(encodeURIComponent(JSON.stringify(data)));
}

/**
 * Decode a legacy invite payload into a code-only locator.
 *
 * All embedded challenge facts are untrusted and intentionally discarded.
 * New links use buildSocialInviteUrl() and never include these fields.
 */
export function decodeInviteData(encoded: string): ChallengeInvite | null {
  try {
    // Input length validation to prevent DoS (reasonable max: 10KB)
    if (!encoded || typeof encoded !== "string" || encoded.length > 10000) {
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
    const raw = safeJsonParse<Record<string, unknown> | null>(jsonStr, null);
    if (!raw) return null;

    // Validate structure and types with Zod (CWE-20: deep link field sanitization)
    const parsed = invitePayloadSchema.safeParse(raw);
    if (!parsed.success) return null;
    const data = parsed.data;

    return { code: sanitizeString(data.cd) };
  } catch {
    return null;
  }
}

/**
 * Resolve and join a challenge by code.
 *
 * A code, deep link, or QR payload is only a locator. Challenge facts and
 * membership must both be confirmed by the authenticated cloud boundary
 * before anything is persisted locally.
 */
export async function joinChallengeByCode(
  code: string,
  displayName: string = "",
): Promise<ChallengeJoinResult> {
  const normalizedCode = code.trim().toUpperCase();

  // Validate code format: ZEN-XXXXXX
  if (!/^ZEN-[A-Z0-9]{6}$/.test(normalizedCode)) {
    return { success: false, reason: "invalid" };
  }

  const challenges = loadChallenges();

  // Check if already joined
  const existing = challenges.find((c) => c.code === normalizedCode);
  if (existing) {
    return { success: false, reason: "duplicate" };
  }

  if (!isCloudChallengesAvailable()) {
    return {
      success: false,
      reason:
        typeof navigator !== "undefined" && navigator.onLine === false
          ? "offline"
          : "unavailable",
    };
  }

  const lookup = await resolveChallengeInvite(normalizedCode);
  if (lookup.status !== "found") {
    return { success: false, reason: lookup.status };
  }

  const resolved = lookup.challenge;
  if (resolved.code.toUpperCase() !== normalizedCode) {
    return { success: false, reason: "unavailable" };
  }
  if (resolved.status !== "active") {
    return { success: false, reason: "expired" };
  }
  if (resolved.creatorId === lookup.actorUserId) {
    return { success: false, reason: "self" };
  }
  if (await isChallengeMember(resolved.id)) {
    return { success: false, reason: "duplicate" };
  }

  const membership = await joinCloudChallenge(
    resolved.id,
    sanitizeUserName(displayName),
  );
  if (!membership || membership.challengeId !== resolved.id) {
    return { success: false, reason: "unavailable" };
  }

  const challenge: Challenge = {
    id: resolved.id,
    code: resolved.code.toUpperCase(),
    habitName: sanitizeString(resolved.habitName),
    habitIcon: sanitizeString(resolved.habitIcon),
    duration: resolved.duration,
    startDate: resolved.startDate,
    endDate: resolved.endDate,
    creatorName: undefined,
    myProgress: membership.daysCompleted,
    isCreator: membership.userId === resolved.creatorId,
    status: resolved.status,
  };

  challenges.push(challenge);
  saveChallenges(challenges);

  return { success: true, challenge };
}

/**
 * Get all active challenges
 */
export function getActiveChallenges(): Challenge[] {
  const challenges = loadChallenges();
  const today = getToday();

  return challenges.filter((c) => {
    // Update status based on dates
    if (c.endDate < today) {
      c.status = c.myProgress >= c.duration ? "completed" : "expired";
    }
    return c.status === "active";
  });
}

/**
 * Get all challenges (including completed/expired)
 */
export function getAllChallenges(): Challenge[] {
  const challenges = loadChallenges();
  const today = getToday();

  // Update statuses
  return challenges.map((c) => {
    if (c.status === "active" && c.endDate < today) {
      return {
        ...c,
        status: c.myProgress >= c.duration ? "completed" : ("expired" as const),
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
  const index = challenges.findIndex((c) => c.id === challengeId);

  if (index === -1) return null;

  const challenge = challenges[index];
  challenge.myProgress = Math.min(challenge.myProgress + increment, challenge.duration);

  // Check if completed
  if (challenge.myProgress >= challenge.duration) {
    challenge.status = "completed";
  }

  saveChallenges(challenges);

  // Sync progress to cloud (non-blocking)
  if (isCloudChallengesAvailable()) {
    syncProgressToCloud(challenge).catch((err) =>
      // graceful: local progress saved; cloud sync is secondary
      logger.warn("[FriendChallenge] Cloud progress sync failed:", err)
    );
  }

  return challenge;
}

/**
 * Sync challenge progress to cloud
 */
async function syncProgressToCloud(challenge: Challenge): Promise<void> {
  // First ensure the challenge exists in cloud
  const cloudChallenge = await syncLocalChallengeToCloud(
    challenge.code,
    challenge.habitName,
    challenge.habitIcon,
    challenge.duration,
    challenge.startDate,
    "Zen User"
  );

  if (!cloudChallenge) return;

  // Calculate streak (simplified - assume consecutive days)
  // A more accurate calculation would check actual completion dates
  const streak = challenge.myProgress;

  // Update progress in cloud
  await updateCloudProgress(cloudChallenge.id, challenge.myProgress, streak);
}

/**
 * Delete a challenge
 */
export function deleteChallenge(challengeId: string): boolean {
  const challenges = loadChallenges();
  const filtered = challenges.filter((c) => c.id !== challengeId);

  if (filtered.length === challenges.length) return false;

  saveChallenges(filtered);
  return true;
}

/**
 * Generate a shareable link for a challenge
 */
export function generateShareLink(challenge: Challenge): string {
  return buildSocialInviteUrl("challenge", challenge.code);
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
    `${challenge.habitIcon} ${t.challengeInvite || "Join my challenge!"}`,
    "",
    `${t.habit || "Habit"}: ${challenge.habitName}`,
    `${t.duration || "Duration"}: ${challenge.duration} ${t.days || "days"}`,
    `${t.code || "Code"}: ${challenge.code}`,
    "",
    t.challengeJoinPrompt || "Join me on ZenFlow!",
  ].join("\n");
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
      if ((error as Error).name !== "AbortError") {
        logger.error("Share failed:", error);
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
  return challenges.find((c) => c.habitName.toLowerCase() === habitName.toLowerCase()) || null;
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
  // Use parseLocalDate to avoid UTC parsing bug
  const end = parseLocalDate(challenge.endDate);
  const diff = end.getTime() - today.getTime();
  return Math.max(0, Math.ceil(diff / (1000 * 60 * 60 * 24)));
}
