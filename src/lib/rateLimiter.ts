/**
 * Rate Limiter Utility
 * P0 Security Fix: Prevent abuse of external APIs (Spotify, Google Calendar)
 *
 * Uses token bucket algorithm with configurable rates per service.
 */

import { logger } from './logger';

interface RateLimitConfig {
  maxRequests: number;      // Max requests in the window
  windowMs: number;         // Time window in milliseconds
  blockDurationMs?: number; // How long to block after hitting limit (default: windowMs)
}

interface RateLimitState {
  requests: number[];       // Timestamps of recent requests
  blockedUntil: number;     // Timestamp when block expires (0 = not blocked)
}

// Default configs for external APIs
const DEFAULT_CONFIGS: Record<string, RateLimitConfig> = {
  spotify: {
    maxRequests: 30,         // Spotify allows ~30 req/minute for most endpoints
    windowMs: 60 * 1000,     // 1 minute
    blockDurationMs: 30000,  // Block for 30s if limit hit
  },
  googleCalendar: {
    maxRequests: 100,        // Google Calendar has 100 req/100sec default quota
    windowMs: 100 * 1000,    // 100 seconds
    blockDurationMs: 60000,  // Block for 1 minute if limit hit
  },
  supabase: {
    maxRequests: 100,        // Conservative limit for Supabase
    windowMs: 60 * 1000,
    blockDurationMs: 10000,
  },
};

class RateLimiter {
  private states: Map<string, RateLimitState> = new Map();
  private configs: Map<string, RateLimitConfig> = new Map();

  constructor() {
    // Initialize with defaults
    Object.entries(DEFAULT_CONFIGS).forEach(([service, config]) => {
      this.configs.set(service, config);
      this.states.set(service, { requests: [], blockedUntil: 0 });
    });
  }

  /**
   * Register a custom rate limit for a service
   */
  configure(service: string, config: RateLimitConfig): void {
    this.configs.set(service, config);
    if (!this.states.has(service)) {
      this.states.set(service, { requests: [], blockedUntil: 0 });
    }
  }

  /**
   * Check if a request is allowed and record it
   * @returns true if request is allowed, false if rate limited
   */
  checkAndRecord(service: string): boolean {
    const config = this.configs.get(service);
    if (!config) {
      // Unknown service - allow by default
      return true;
    }

    const state = this.states.get(service)!;
    const now = Date.now();

    // Check if currently blocked
    if (state.blockedUntil > now) {
      const remainingMs = state.blockedUntil - now;
      logger.warn(`[RateLimiter] ${service} is blocked for ${Math.ceil(remainingMs / 1000)}s`);
      return false;
    }

    // Clean up old requests outside the window
    state.requests = state.requests.filter(ts => now - ts < config.windowMs);

    // Check if we're at the limit
    if (state.requests.length >= config.maxRequests) {
      // Block for the configured duration
      state.blockedUntil = now + (config.blockDurationMs || config.windowMs);
      logger.warn(`[RateLimiter] ${service} rate limit hit, blocking for ${(config.blockDurationMs || config.windowMs) / 1000}s`);
      return false;
    }

    // Record this request
    state.requests.push(now);
    return true;
  }

  /**
   * Check if allowed without recording (for pre-check)
   */
  isAllowed(service: string): boolean {
    const config = this.configs.get(service);
    if (!config) return true;

    const state = this.states.get(service)!;
    const now = Date.now();

    if (state.blockedUntil > now) return false;

    const recentRequests = state.requests.filter(ts => now - ts < config.windowMs);
    return recentRequests.length < config.maxRequests;
  }

  /**
   * Get remaining requests in current window
   */
  getRemainingRequests(service: string): number {
    const config = this.configs.get(service);
    if (!config) return Infinity;

    const state = this.states.get(service)!;
    const now = Date.now();

    if (state.blockedUntil > now) return 0;

    const recentRequests = state.requests.filter(ts => now - ts < config.windowMs);
    return Math.max(0, config.maxRequests - recentRequests.length);
  }

  /**
   * Get time until rate limit resets (in ms)
   */
  getTimeUntilReset(service: string): number {
    const config = this.configs.get(service);
    if (!config) return 0;

    const state = this.states.get(service)!;
    const now = Date.now();

    if (state.blockedUntil > now) {
      return state.blockedUntil - now;
    }

    if (state.requests.length === 0) return 0;

    const oldestRequest = Math.min(...state.requests);
    const resetTime = oldestRequest + config.windowMs;
    return Math.max(0, resetTime - now);
  }

  /**
   * Reset rate limit state for a service
   */
  reset(service: string): void {
    const state = this.states.get(service);
    if (state) {
      state.requests = [];
      state.blockedUntil = 0;
    }
  }

  /**
   * Reset all rate limits
   */
  resetAll(): void {
    this.states.forEach((_, service) => this.reset(service));
  }
}

// Singleton instance
export const rateLimiter = new RateLimiter();

/**
 * Wrapper for fetch that respects rate limits
 * Throws RateLimitError if rate limited
 */
export class RateLimitError extends Error {
  constructor(
    public service: string,
    public retryAfterMs: number
  ) {
    super(`Rate limit exceeded for ${service}. Retry after ${Math.ceil(retryAfterMs / 1000)}s`);
    this.name = 'RateLimitError';
  }
}

/**
 * Create a rate-limited fetch wrapper for a service
 */
export function createRateLimitedFetch(service: string): typeof fetch {
  return async (input: RequestInfo | URL, init?: RequestInit): Promise<Response> => {
    if (!rateLimiter.checkAndRecord(service)) {
      const retryAfter = rateLimiter.getTimeUntilReset(service);
      throw new RateLimitError(service, retryAfter);
    }
    return fetch(input, init);
  };
}

export default rateLimiter;
