/**
 * Auth State Manager
 *
 * Centralized auth completion state to prevent race conditions.
 *
 * Problem: Multiple auth completion pathways (AuthScreen + Index.tsx)
 * could fire simultaneously, causing duplicate auth completion events
 * and state inconsistencies.
 *
 * Solution: Single point of auth completion with mutex-style locking.
 */

import { logger } from "./logger";

type AuthCompletionCallback = () => void | Promise<void>;

interface AuthCompletionResult {
  completed: boolean;
  source: string;
  timestamp: number;
}

class AuthStateManager {
  private isCompleted = false;
  private completionPromise: Promise<AuthCompletionResult> | null = null;
  private completionSource: string | null = null;
  private completionTimestamp: number | null = null;

  /**
   * Try to complete auth flow from a specific source.
   * Only the first caller will succeed; subsequent calls return false.
   *
   * @param callback - Function to execute on successful completion
   * @param source - Identifier for where this call originated (for debugging)
   * @returns true if this call completed auth, false if already completed
   */
  async tryComplete(callback: AuthCompletionCallback, source: string): Promise<boolean> {
    // Fast path: already completed
    if (this.isCompleted) {
      logger.log(
        `[AuthStateManager] Auth already completed by ${this.completionSource}, ignoring call from ${source}`
      );
      return false;
    }

    // If completion is in progress, wait for it
    if (this.completionPromise) {
      logger.log(`[AuthStateManager] Completion in progress, waiting (source: ${source})`);
      await this.completionPromise;
      return false;
    }

    // This is the winner - execute the callback
    logger.log(`[AuthStateManager] Completing auth from ${source}`);
    const completionTimestamp = Date.now();
    this.isCompleted = true;
    this.completionSource = source;
    this.completionTimestamp = completionTimestamp;

    this.completionPromise = (async (): Promise<AuthCompletionResult> => {
      try {
        await callback();
        logger.log(`[AuthStateManager] Auth completion successful from ${source}`);
        return {
          completed: true,
          source,
          timestamp: completionTimestamp,
        };
      } catch (error) {
        logger.error(`[AuthStateManager] Auth completion failed from ${source}:`, error);
        // Reset state on failure so another attempt can be made
        this.isCompleted = false;
        this.completionSource = null;
        this.completionTimestamp = null;
        throw error;
      } finally {
        this.completionPromise = null;
      }
    })();

    await this.completionPromise;
    return true;
  }

  /**
   * Check if auth has been completed.
   */
  isAuthCompleted(): boolean {
    return this.isCompleted;
  }

  /**
   * Get info about the completion.
   */
  getCompletionInfo(): { source: string | null; timestamp: number | null } {
    return {
      source: this.completionSource,
      timestamp: this.completionTimestamp,
    };
  }

  /**
   * Reset the auth state. Use with caution - only for sign-out or error recovery.
   */
  reset(): void {
    logger.log("[AuthStateManager] Resetting auth state");
    this.isCompleted = false;
    this.completionPromise = null;
    this.completionSource = null;
    this.completionTimestamp = null;
  }

  /**
   * Mark auth as completed without running a callback.
   * Use when auth was completed through another mechanism.
   */
  markCompleted(source: string): void {
    if (this.isCompleted) {
      logger.log(
        `[AuthStateManager] Already completed by ${this.completionSource}, ignoring mark from ${source}`
      );
      return;
    }
    logger.log(`[AuthStateManager] Marking auth as completed from ${source}`);
    this.isCompleted = true;
    this.completionSource = source;
    this.completionTimestamp = Date.now();
  }
}

// Singleton instance
export const authStateManager = new AuthStateManager();

export default authStateManager;
