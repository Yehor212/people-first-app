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

    // Session replay - capture 10% of sessions, 100% on error
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    // Integrations
    integrations: [
      // Browser tracing for performance with optimizations
      Sentry.browserTracingIntegration({
        // Enable distributed tracing for Supabase API calls
        tracePropagationTargets: [
          'localhost',
          /^https:\/\/.*\.supabase\.co/,
        ],
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

    // Privacy: Strip PII before sending
    beforeSend(event) {
      // Remove user email and IP
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
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

  console.log('[Sentry] Initialized successfully');
}

/**
 * Capture a custom error with context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.captureException(error, {
    extra: context,
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
