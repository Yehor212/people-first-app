/**
 * Sentry Error Monitoring Integration
 *
 * Sends crash reports and performance data to Sentry for monitoring.
 * Respects user privacy by stripping PII before sending.
 *
 * Free tier: 5,000 errors/month, 10,000 transactions/month
 */

import * as Sentry from '@sentry/react';
import { Capacitor } from '@capacitor/core';

// Declare global app version
declare const __APP_VERSION__: string;

/**
 * Initialize Sentry error monitoring
 * Call this as early as possible in the app lifecycle
 */
export function initSentry(): void {
  const dsn = import.meta.env.VITE_SENTRY_DSN;

  // Skip if no DSN configured (development without Sentry)
  if (!dsn) {
    console.log('[Sentry] No DSN configured, skipping initialization');
    return;
  }

  Sentry.init({
    dsn,
    environment: import.meta.env.MODE,
    release: `zenflow@${__APP_VERSION__}`,

    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: 0.1,

    // Distributed tracing targets - MUST be at root level for SDK v8+
    tracePropagationTargets: [
      'localhost',
      /^https:\/\/.*\.supabase\.co/,
    ],

    // Session replay - capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      // Browser tracing for performance
      Sentry.browserTracingIntegration({
        // Filter out noisy requests from tracing
        shouldCreateSpanForRequest: (url) => {
          // Skip health checks, analytics, and internal Sentry calls
          if (url.includes('/health')) return false;
          if (url.includes('sentry.io')) return false;
          if (url.includes('google-analytics')) return false;
          if (url.includes('googletagmanager')) return false;
          return true;
        },
      }),
      // Session replay for debugging (masked for privacy)
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      }),
    ],

    // Privacy: Strip PII and tokens before sending
    // Also filter out expected/handled errors
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // P0 Fix: Filter out AbortErrors - these are expected and handled
      // AbortError occurs during normal operation (user navigation, request cancellation)
      if (error instanceof Error) {
        const isAbortError =
          error.name === 'AbortError' ||
          (error as { code?: number }).code === 20 || // iOS DOMException code
          error.message?.includes('aborted') ||
          error.message?.includes('AbortError');

        if (isAbortError) {
          // Don't send to Sentry - these are handled gracefully in the app
          return null;
        }

        // P0 Fix: Filter out handled chunk load errors
        // These are shown to user via UpdateRequiredDialog
        const isChunkError =
          error.message?.includes('Failed to fetch dynamically imported module') ||
          error.message?.includes('Loading chunk') ||
          error.message?.includes('Loading CSS chunk');

        if (isChunkError) {
          // Mark as handled so we can still track frequency, but lower priority
          event.tags = { ...event.tags, handled: 'true', error_type: 'chunk_load' };
        }
      }

      // Remove user email and IP
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }

      // P1 Security Fix: Scrub tokens from breadcrumbs and request data
      const sensitivePatterns = [
        /Bearer\s+[A-Za-z0-9\-_\.]+/gi,
        /access_token[=:]\s*["']?[A-Za-z0-9\-_\.]+["']?/gi,
        /refresh_token[=:]\s*["']?[A-Za-z0-9\-_\.]+["']?/gi,
        /token[=:]\s*["']?[A-Za-z0-9\-_\.]{20,}["']?/gi,
      ];

      const scrubString = (str: string): string => {
        let result = str;
        sensitivePatterns.forEach(pattern => {
          result = result.replace(pattern, '[REDACTED]');
        });
        return result;
      };

      // Scrub breadcrumb messages
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map(bc => ({
          ...bc,
          message: bc.message ? scrubString(bc.message) : bc.message,
          data: bc.data ? JSON.parse(scrubString(JSON.stringify(bc.data))) : bc.data,
        }));
      }

      // Scrub request URLs
      if (event.request?.url) {
        event.request.url = scrubString(event.request.url);
      }
      if (event.request?.headers) {
        const headers: Record<string, string> = {};
        for (const [key, value] of Object.entries(event.request.headers)) {
          headers[key] = key.toLowerCase() === 'authorization' ? '[REDACTED]' : scrubString(String(value));
        }
        event.request.headers = headers;
      }

      // Don't send events in development
      if (import.meta.env.DEV) {
        console.log('[Sentry] Would send event:', event);
        return null;
      }

      return event;
    },

    // Add platform context
    initialScope: {
      tags: {
        platform: Capacitor.getPlatform(),
        isNative: Capacitor.isNativePlatform() ? 'yes' : 'no',
      },
    },
  });

  // P2 Fix: Only log in development
  if (import.meta.env.DEV) {
    console.log('[Sentry] Initialized successfully');
  }
}

/**
 * Error categories for filtering and analysis in Sentry dashboard
 */
export type ErrorCategory = 'audio' | 'cache' | 'version-mismatch' | 'storage' | 'network' | 'sync' | 'general';

/**
 * Capture a custom error with context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * P0 Fix: Capture error with category tag for filtering
 * Use this for categorized errors (audio, cache, version issues)
 */
export function captureErrorWithCategory(
  error: Error,
  category: ErrorCategory,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag('category', category);

    // Add extra context based on error type
    if (error.name === 'AbortError') {
      scope.setTag('error_type', 'abort');
      scope.setExtra('abort_reason', error.message);
    } else if (error.message.includes('Database deleted')) {
      scope.setTag('error_type', 'database_deleted');
      scope.setExtra('likely_cause', 'User cleared site data or Safari ITP');
    } else if (error.message.includes('chunk') || error.message.includes('module')) {
      scope.setTag('error_type', 'chunk_load');
      scope.setExtra('likely_cause', 'Version mismatch after deployment');
    }

    if (context) {
      scope.setExtras(context);
    }

    Sentry.captureException(error);
  });
}

/**
 * P0 Fix: Add breadcrumb with category
 */
export function addCategorizedBreadcrumb(
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = 'info'
): void {
  Sentry.addBreadcrumb({
    category,
    message,
    level,
    data,
  });
}

/**
 * Capture a custom message
 */
export function captureMessage(message: string, level: Sentry.SeverityLevel = 'info'): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  Sentry.setUser({
    id: userId,
    // Don't send email or other PII
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

// Re-export Sentry's ErrorBoundary for use in App.tsx
export { ErrorBoundary } from '@sentry/react';
