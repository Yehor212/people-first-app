/**
 * Treat Constants - Unified reward system for the companion
 * All activities earn treats, treats feed the companion
 */

// Base rewards for activities (before streak multiplier)
export const TREAT_REWARDS = {
  mood: 5,           // Log mood = 5 treats
  habit: 10,         // Complete habit = 10 treats
  focus_per_minute: 0.5,  // Focus = 0.5 treats/min (25 min = 12.5 → 13 treats)
  gratitude: 8,      // Gratitude entry = 8 treats
} as const;

// Streak multiplier: +10% per streak day, max 2x at 10 days
export const STREAK_MULTIPLIER = {
  perDay: 0.1,       // +10% per day
  maxMultiplier: 2.0, // Cap at 2x
  daysToMax: 10,     // Reach max at 10 days
} as const;

// Companion interaction costs and effects
export const COMPANION_COSTS = {
  feed: {
    treatCost: 10,        // Costs 10 treats to feed
    fullnessGain: 30,     // +30% fullness
    xpGain: 50,           // +50 XP to companion
  },
  pet: {
    treatCost: 0,         // Free!
    xpGain: 10,           // +10 XP to companion
    cooldownMs: 60000,    // 1 minute cooldown for full effect
  },
} as const;

// Companion leveling
export const COMPANION_LEVELING = {
  xpPerLevel: (level: number) => level * 50, // Level 1: 50 XP, Level 2: 100 XP, etc.
  maxLevel: 100,
} as const;

// Companion fullness decay
export const FULLNESS_DECAY = {
  perHour: 2,          // Lose 2% fullness per hour
  hungerThreshold: 30, // Show hungry state below 30%
  starvingThreshold: 10, // Show starving state below 10%
} as const;

// Helper function to calculate streak multiplier
export function getStreakMultiplier(streakDays: number): number {
  const multiplier = 1 + Math.min(streakDays, STREAK_MULTIPLIER.daysToMax) * STREAK_MULTIPLIER.perDay;
  return Math.min(multiplier, STREAK_MULTIPLIER.maxMultiplier);
}

// Helper function to calculate treats earned
export function calculateTreatsEarned(
  baseAmount: number,
  streakDays: number
): { base: number; bonus: number; total: number; multiplier: number } {
  const multiplier = getStreakMultiplier(streakDays);
  const total = Math.round(baseAmount * multiplier);
  const bonus = total - baseAmount;
  return { base: baseAmount, bonus, total, multiplier };
}

// Helper function to calculate XP needed for next level
export function getXpForNextLevel(currentLevel: number): number {
  return COMPANION_LEVELING.xpPerLevel(currentLevel);
}
