/**
 * Streak milestone constants used across gamification, badges, and UI.
 * Replace magic numbers like `streak >= 7` with `streak >= STREAK_MILESTONES.WEEKLY`.
 */
export const STREAK_MILESTONES = {
  WEEKLY: 7,
  BIWEEKLY: 14,
  MONTHLY: 30,
  CENTURY: 100,
} as const;
