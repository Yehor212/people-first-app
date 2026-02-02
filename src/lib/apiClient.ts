/**
 * API Client - Centralized 401 handling and token refresh
 *
 * Wraps Supabase operations to:
 * 1. Detect 401 errors
 * 2. Attempt token refresh once
 * 3. Retry the operation
 * 4. Notify UI if session expired
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';

// Event name for session expiration
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

// Track if refresh is in progress to prevent concurrent refreshes
let refreshInProgress = false;
let refreshPromise: Promise<boolean> | null = null;

/**
 * Check if an error is a 401/authentication error
 */
export const is401Error = (error: any): boolean => {
  if (!error) return false;

  // HTTP status code
  if (error.status === 401) return true;

  // Supabase/PostgREST error codes
  if (error.code === 'PGRST301') return true; // JWT expired
  if (error.code === 'PGRST302') return true; // JWT invalid

  // Error message patterns
  const message = error.message?.toLowerCase() || '';
  if (message.includes('jwt expired')) return true;
  if (message.includes('jwt invalid')) return true;
  if (message.includes('not authenticated')) return true;
  if (message.includes('invalid token')) return true;
  if (message.includes('token expired')) return true;

  return false;
};

/**
 * Attempt to refresh the session
 * Returns true if successful, false otherwise
 */
const tryRefreshSession = async (): Promise<boolean> => {
  if (!supabase) {
    logger.error('[API] Cannot refresh - Supabase not initialized');
    return false;
  }

  // If refresh already in progress, wait for it
  if (refreshInProgress && refreshPromise) {
    logger.log('[API] Refresh already in progress, waiting...');
    return refreshPromise;
  }

  refreshInProgress = true;
  refreshPromise = (async () => {
    try {
      logger.log('[API] Attempting token refresh...');
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('[API] Token refresh failed:', error.message);
        return false;
      }

      if (data.session) {
        logger.log('[API] Token refresh successful');
        return true;
      }

      logger.warn('[API] Refresh returned no session');
      return false;
    } catch (err) {
      logger.error('[API] Token refresh error:', err);
      return false;
    } finally {
      refreshInProgress = false;
      refreshPromise = null;
    }
  })();

  return refreshPromise;
};

/**
 * Dispatch session expired event for UI to handle
 */
const notifySessionExpired = (): void => {
  logger.warn('[API] Session expired - notifying UI');
  window.dispatchEvent(new CustomEvent(AUTH_SESSION_EXPIRED_EVENT));
};

/**
 * Wrap an async operation with 401 handling
 *
 * @param operation - The async function to execute
 * @param operationName - Name for logging purposes
 * @returns The operation result
 * @throws If operation fails after retry or non-401 error
 */
export const withAuthRetry = async <T>(
  operation: () => Promise<T>,
  operationName: string = 'operation'
): Promise<T> => {
  try {
    return await operation();
  } catch (error: any) {
    // Check if it's a 401 error
    if (is401Error(error)) {
      logger.log(`[API] 401 on ${operationName}, attempting refresh...`);

      // Try to refresh the token
      const refreshed = await tryRefreshSession();

      if (!refreshed) {
        logger.error(`[API] Refresh failed for ${operationName}`);
        notifySessionExpired();
        throw new Error('Session expired. Please sign in again.');
      }

      // Retry the operation once
      logger.log(`[API] Retrying ${operationName} after refresh`);
      try {
        return await operation();
      } catch (retryError: any) {
        // If retry also fails with 401, session is truly expired
        if (is401Error(retryError)) {
          logger.error(`[API] Retry failed with 401 for ${operationName}`);
          notifySessionExpired();
          throw new Error('Session expired. Please sign in again.');
        }
        throw retryError;
      }
    }

    // Not a 401 error, rethrow
    throw error;
  }
};

/**
 * Check if user is authenticated before making a request
 * Returns the user ID if authenticated, null otherwise
 */
export const ensureAuthenticated = async (): Promise<string | null> => {
  if (!supabase) return null;

  try {
    const { data: { user }, error } = await supabase.auth.getUser();

    if (error) {
      if (is401Error(error)) {
        // Try refresh
        const refreshed = await tryRefreshSession();
        if (refreshed) {
          const { data: { user: refreshedUser } } = await supabase.auth.getUser();
          return refreshedUser?.id ?? null;
        }
      }
      return null;
    }

    return user?.id ?? null;
  } catch (err) {
    logger.error('[API] ensureAuthenticated error:', err);
    return null;
  }
};
