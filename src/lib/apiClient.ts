/**
 * API Client - Centralized 401 handling and token refresh
 *
 * Wraps Supabase operations to:
 * 1. Detect 401 errors
 * 2. Attempt token refresh once
 * 3. Retry the operation
 * 4. Notify UI if session expired
 *
 * BroadcastChannel coordination for multi-tab token refresh
 * Prevents cascading 401s when one tab refreshes the token.
 */

import { supabase } from './supabaseClient';
import { logger } from './logger';
import { Capacitor } from '@capacitor/core';

// Event name for session expiration
export const AUTH_SESSION_EXPIRED_EVENT = 'auth:session-expired';

// Track if refresh is in progress to prevent concurrent refreshes
let refreshInProgress = false;
let refreshPromise: Promise<boolean> | null = null;

// BroadcastChannel for multi-tab coordination
// Only used on web platform (not native)
const REFRESH_CHANNEL_NAME = 'zenflow-auth-refresh';
let refreshChannel: BroadcastChannel | null = null;
let waitingForRefresh = false;
let refreshResolvers: Array<(success: boolean) => void> = [];

// Limit resolver queue size to prevent unbounded memory growth
const MAX_REFRESH_RESOLVERS = 100;

// Initialize BroadcastChannel for web only
const initRefreshChannel = (): void => {
  if (Capacitor.isNativePlatform()) return;
  if (refreshChannel) return;

  try {
    refreshChannel = new BroadcastChannel(REFRESH_CHANNEL_NAME);
    refreshChannel.onmessage = (event) => {
      const { type, success } = event.data;

      if (type === 'REFRESH_START') {
        // Another tab started refresh - we should wait
        logger.log('[API] Another tab started token refresh');
        waitingForRefresh = true;
      } else if (type === 'REFRESH_COMPLETE') {
        // Another tab completed refresh
        logger.log(`[API] Another tab completed refresh: ${success ? 'success' : 'failed'}`);
        waitingForRefresh = false;
        // Resolve all waiting promises
        refreshResolvers.forEach(resolve => resolve(success));
        refreshResolvers = [];
      }
    };
    logger.log('[API] BroadcastChannel initialized for multi-tab coordination');
  } catch (error) {
    // BroadcastChannel not supported (older browsers)
    logger.warn('[API] BroadcastChannel not available:', error);
  }
};

// Initialize on module load
initRefreshChannel();

/**
 * Broadcast refresh status to other tabs
 */
const broadcastRefreshStatus = (type: 'REFRESH_START' | 'REFRESH_COMPLETE', success?: boolean): void => {
  if (!refreshChannel) return;
  try {
    refreshChannel.postMessage({ type, success });
  } catch (error) {
    // Channel might be closed
  }
};

/**
 * Wait for another tab's refresh to complete
 * Added queue size limit to prevent unbounded memory growth
 */
const waitForOtherTabRefresh = (): Promise<boolean> => {
  return new Promise((resolve) => {
    // Reject oldest resolver if queue is at max size
    if (refreshResolvers.length >= MAX_REFRESH_RESOLVERS) {
      const oldest = refreshResolvers.shift();
      oldest?.(false); // Resolve oldest with failure
      logger.warn('[API] Resolver queue overflow, rejected oldest resolver');
    }

    // Timeout after 10 seconds
    const timeout = setTimeout(() => {
      waitingForRefresh = false;
      resolve(false);
    }, 10000);

    refreshResolvers.push((success) => {
      clearTimeout(timeout);
      resolve(success);
    });
  });
};

/**
 * Type guard to check if error has status property
 */
const hasStatus = (error: unknown): error is { status: number } =>
  typeof error === 'object' && error !== null && 'status' in error;

/**
 * Type guard to check if error has code property
 */
const hasCode = (error: unknown): error is { code: string } =>
  typeof error === 'object' && error !== null && 'code' in error;

/**
 * Type guard to check if error has message property
 */
const hasMessage = (error: unknown): error is { message: string } =>
  typeof error === 'object' && error !== null && 'message' in error;

/**
 * Check if an error is a 401/authentication error
 */
export const is401Error = (error: unknown): boolean => {
  if (!error) return false;

  // HTTP status code
  if (hasStatus(error) && error.status === 401) return true;

  // Supabase/PostgREST error codes
  if (hasCode(error)) {
    if (error.code === 'PGRST301') return true; // JWT expired
    if (error.code === 'PGRST302') return true; // JWT invalid
  }

  // Error message patterns
  const message = hasMessage(error) ? error.message.toLowerCase() : '';
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
 *
 * Coordinates with other browser tabs via BroadcastChannel
 * to prevent cascading 401 errors when one tab refreshes.
 */
const tryRefreshSession = async (): Promise<boolean> => {
  if (!supabase) {
    logger.error('[API] Cannot refresh - Supabase not initialized');
    return false;
  }

  // If another tab is refreshing, wait for it instead of doing our own refresh
  if (waitingForRefresh) {
    logger.log('[API] Another tab is refreshing, waiting...');
    return waitForOtherTabRefresh();
  }

  // If refresh already in progress in this tab, wait for it
  if (refreshInProgress && refreshPromise) {
    logger.log('[API] Refresh already in progress, waiting...');
    return refreshPromise;
  }

  refreshInProgress = true;
  // Notify other tabs that we're starting refresh
  broadcastRefreshStatus('REFRESH_START');

  refreshPromise = (async () => {
    try {
      logger.log('[API] Attempting token refresh...');
      const { data, error } = await supabase.auth.refreshSession();

      if (error) {
        logger.error('[API] Token refresh failed:', error.message);
        // Notify other tabs of failure
        broadcastRefreshStatus('REFRESH_COMPLETE', false);
        return false;
      }

      if (data.session) {
        logger.log('[API] Token refresh successful');
        // Notify other tabs of success
        broadcastRefreshStatus('REFRESH_COMPLETE', true);
        return true;
      }

      logger.warn('[API] Refresh returned no session');
      broadcastRefreshStatus('REFRESH_COMPLETE', false);
      return false;
    } catch (err) {
      logger.error('[API] Token refresh error:', err);
      broadcastRefreshStatus('REFRESH_COMPLETE', false);
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
 * Verify session is truly expired before notifying
 */
const notifySessionExpired = async (): Promise<void> => {
  logger.warn('[API] Checking session before notifying expired...');

  // Double-check session state before triggering logout
  try {
    const { data } = await supabase.auth.getSession();
    if (data.session) {
      logger.log('[API] Session still valid despite errors, not notifying expired');
      return; // Don't dispatch - session is still valid
    }
  } catch (error) {
    logger.error('[API] Error verifying session:', error);
    // Fall through to notify expired
  }

  logger.warn('[API] Session confirmed expired - notifying UI');
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
  } catch (error: unknown) {
    // Check if it's a 401 error
    if (is401Error(error)) {
      logger.log(`[API] 401 on ${operationName}, attempting refresh...`);

      // Try to refresh the token
      const refreshed = await tryRefreshSession();

      if (!refreshed) {
        logger.error(`[API] Refresh failed for ${operationName}`);
        await notifySessionExpired();
        throw new Error('Session expired. Please sign in again.');
      }

      // Retry the operation once
      logger.log(`[API] Retrying ${operationName} after refresh`);
      try {
        return await operation();
      } catch (retryError: unknown) {
        // If retry also fails with 401, session is truly expired
        if (is401Error(retryError)) {
          logger.error(`[API] Retry failed with 401 for ${operationName}`);
          await notifySessionExpired();
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
