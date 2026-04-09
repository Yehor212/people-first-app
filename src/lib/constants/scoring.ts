/**
 * Score threshold constants for habit scores, zen scores, and weekly crystals.
 * Replace magic numbers like `scorePercent >= 60` with `scorePercent >= SCORE_THRESHOLDS.MEDIUM`.
 */
export const SCORE_THRESHOLDS = {
  LOW: 30,
  MEDIUM: 60,
  HIGH: 80,
} as const;
