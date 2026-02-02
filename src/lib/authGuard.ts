/**
 * Auth Guard - Protection against OAuth redirect loops
 *
 * Prevents infinite 302 redirects by:
 * 1. Tracking if auth flow is in progress
 * 2. Limiting redirects per minute
 * 3. Timeout for stuck auth flows
 */

import { logger } from './logger';

// State
let authFlowInProgress = false;
let authFlowStartTime = 0;
let redirectCount = 0;
let lastRedirectResetTime = Date.now();

// Constants
const MAX_REDIRECTS_PER_MINUTE = 3;
const AUTH_FLOW_TIMEOUT = 60000; // 60 seconds
const REDIRECT_RESET_INTERVAL = 60000; // 1 minute

/**
 * Check if a new auth flow can be started
 * Returns false if:
 * - Too many redirects in the last minute
 * - An auth flow is already in progress
 */
export const canStartAuthFlow = (): boolean => {
  const now = Date.now();

  // Reset counter after 1 minute
  if (now - lastRedirectResetTime > REDIRECT_RESET_INTERVAL) {
    redirectCount = 0;
    lastRedirectResetTime = now;
    logger.log('[AuthGuard] Redirect counter reset');
  }

  // Check for redirect loop
  if (redirectCount >= MAX_REDIRECTS_PER_MINUTE) {
    logger.error('[AuthGuard] Too many auth redirects detected - possible loop');
    return false;
  }

  // Check if already in progress (with timeout escape hatch)
  if (authFlowInProgress) {
    if (now - authFlowStartTime < AUTH_FLOW_TIMEOUT) {
      logger.warn('[AuthGuard] Auth flow already in progress');
      return false;
    } else {
      // Timeout - allow retry
      logger.warn('[AuthGuard] Auth flow timed out, allowing new attempt');
      endAuthFlow();
    }
  }

  return true;
};

/**
 * Mark that an auth flow has started
 */
export const startAuthFlow = (): void => {
  authFlowInProgress = true;
  authFlowStartTime = Date.now();
  redirectCount++;
  logger.log(`[AuthGuard] Auth flow started (attempt ${redirectCount}/${MAX_REDIRECTS_PER_MINUTE})`);
};

/**
 * Mark that an auth flow has completed (success or failure)
 */
export const endAuthFlow = (): void => {
  authFlowInProgress = false;
  logger.log('[AuthGuard] Auth flow ended');
};

/**
 * Check if auth flow is currently in progress
 */
export const isAuthFlowInProgress = (): boolean => authFlowInProgress;

/**
 * Get current redirect count (for debugging)
 */
export const getRedirectCount = (): number => redirectCount;

/**
 * Reset all auth guard state (for testing or forced reset)
 */
export const resetAuthGuard = (): void => {
  authFlowInProgress = false;
  authFlowStartTime = 0;
  redirectCount = 0;
  lastRedirectResetTime = Date.now();
  logger.log('[AuthGuard] State reset');
};
