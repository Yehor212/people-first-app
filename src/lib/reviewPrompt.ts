/**
 * Smart Review Prompt System
 * Determines when to show the in-app review prompt based on user engagement.
 */

import Review from '@/plugins/ReviewPlugin';
import { logger } from './logger';
import { safeJsonParse } from './safeJson';

const STORAGE_KEY = 'zenflow_review_prompt';

interface ReviewState {
  /** When the app was first installed */
  installDate: string;
  /** When we last showed the review prompt */
  lastPromptDate: string | null;
  /** Number of times we've prompted */
  promptCount: number;
  /** User explicitly declined */
  declined: boolean;
  /** User completed the review */
  completed: boolean;
}

const getState = (): ReviewState => {
  const saved = localStorage.getItem(STORAGE_KEY);
  if (saved) {
    const parsed = safeJsonParse<ReviewState | null>(saved, null);
    if (parsed) {
      return parsed;
    }
  }

  // Default state for new installs
  return {
    installDate: new Date().toISOString(),
    lastPromptDate: null,
    promptCount: 0,
    declined: false,
    completed: false
  };
};

const saveState = (state: ReviewState) => {
  try {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(state));
  } catch {
    // Ignore storage errors
  }
};

/**
 * Check if we should show the review prompt based on user engagement.
 *
 * Conditions:
 * 1. App installed for at least 7 days
 * 2. Haven't prompted in the last 30 days
 * 3. User hasn't declined or completed
 * 4. User has reached a positive milestone (streak >= 7 or habits >= 10)
 */
export const shouldShowReviewPrompt = (stats: {
  streak: number;
  totalHabitsCompleted: number;
}): boolean => {
  const state = getState();

  // Already completed or explicitly declined
  if (state.completed || state.declined) {
    return false;
  }

  // Don't prompt too many times (max 3)
  if (state.promptCount >= 3) {
    return false;
  }

  // Check install date (at least 7 days)
  const installDate = new Date(state.installDate);
  const now = new Date();
  const daysSinceInstall = Math.floor((now.getTime() - installDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceInstall < 7) {
    return false;
  }

  // Check last prompt date (at least 30 days between prompts)
  if (state.lastPromptDate) {
    const lastPrompt = new Date(state.lastPromptDate);
    const daysSincePrompt = Math.floor((now.getTime() - lastPrompt.getTime()) / (1000 * 60 * 60 * 24));

    if (daysSincePrompt < 30) {
      return false;
    }
  }

  // Check positive milestones
  const hasPositiveMilestone = stats.streak >= 7 || stats.totalHabitsCompleted >= 10;

  return hasPositiveMilestone;
};

/**
 * Request the in-app review.
 * Call this after checking shouldShowReviewPrompt.
 */
export const requestReview = async (): Promise<boolean> => {
  try {
    const { supported } = await Review.isSupported();

    if (!supported) {
      logger.log('[Review] Not supported on this platform');
      return false;
    }

    // Update state before showing (in case the flow crashes)
    const state = getState();
    state.lastPromptDate = new Date().toISOString();
    state.promptCount += 1;
    saveState(state);

    // Request the review
    await Review.requestReview();

    logger.log('[Review] Review flow completed');
    return true;
  } catch (error) {
    logger.error('[Review] Failed to request review:', error);
    return false;
  }
};

/**
 * Mark the review as completed (user rated the app).
 * Note: Google Play API doesn't tell us if the user actually rated,
 * so we call this optimistically after the flow completes.
 */
export const markReviewCompleted = () => {
  const state = getState();
  state.completed = true;
  saveState(state);
};

/**
 * Mark that the user declined to rate.
 */
export const markReviewDeclined = () => {
  const state = getState();
  state.declined = true;
  saveState(state);
};

/**
 * Reset review state (for testing).
 */
export const resetReviewState = () => {
  localStorage.removeItem(STORAGE_KEY);
};
