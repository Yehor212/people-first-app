/**
 * Sentry Error Monitoring Integration
 *
 * Sends crash reports and performance data to Sentry for monitoring.
 * Respects user privacy by stripping PII before sending.
 *
 * Free tier: 5,000 errors/month, 10,000 transactions/month
 */

import * as Sentry from "@sentry/react";
import type { Integration } from "@sentry/core";
import { isNative, platform } from "@/lib/platform";
import { logger } from "@/lib/logger";
import { SENTRY_DSN, MODE, IS_DEV } from "@/lib/env";

// Declare global app version
declare const __APP_VERSION__: string;

/**
 * Initialize Sentry error monitoring
 * Call this as early as possible in the app lifecycle
 */
export function initSentry(): void {
  const dsn = SENTRY_DSN;

  // Skip if no DSN configured (development without Sentry)
  if (!dsn) {
    logger.log("[Sentry] No DSN configured, skipping initialization");
    return;
  }

  // isNative imported from @/lib/platform

  // Build integrations list — replay only on web (rrweb crashes Android WebView)
  const integrations: Integration[] = [
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => {
        if (url.includes("/health")) return false;
        if (url.includes("sentry.io")) return false;
        if (url.includes("google-analytics")) return false;
        if (url.includes("googletagmanager")) return false;
        return true;
      },
    }),
  ];

  // Session replay only on web — rrweb uses Shadow DOM / MutationObserver
  // features that can crash in Android WebView
  if (!isNative) {
    integrations.push(
      Sentry.replayIntegration({
        maskAllText: true,
        maskAllInputs: true,
        blockAllMedia: true,
      })
    );
  }

  Sentry.init({
    dsn,
    environment: MODE,
    release: `zenflow@${__APP_VERSION__}`,

    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: isNative ? 0.05 : 0.1,

    // Distributed tracing targets - MUST be at root level for SDK v8+
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/],

    // Session replay rates — only effective on web (integration not added on native)
    replaysSessionSampleRate: 0.1,
    replaysOnErrorSampleRate: 1.0,

    integrations,

    // Privacy: Strip PII and tokens before sending
    // Also filter out expected/handled errors
    beforeSend(event, hint) {
      const error = hint?.originalException;

      // Filter out AbortErrors - these are expected and handled
      // AbortError occurs during normal operation (user navigation, request cancellation)
      if (error instanceof Error) {
        const isAbortError =
          error.name === "AbortError" ||
          (error as { code?: number }).code === 20 || // iOS DOMException code
          error.message?.includes("aborted") ||
          error.message?.includes("AbortError");

        if (isAbortError) {
          // Don't send to Sentry - these are handled gracefully in the app
          return null;
        }

        // Filter out handled chunk load errors
        // These are shown to user via UpdateRequiredDialog
        const isChunkError =
          error.message?.includes("Failed to fetch dynamically imported module") ||
          error.message?.includes("Loading chunk") ||
          error.message?.includes("Loading CSS chunk");

        if (isChunkError) {
          // Handled gracefully by UpdateRequiredDialog — don't report to Sentry.
          // These are expected after every deploy (stale cached HTML references
          // old chunk hashes). Reporting them creates false regression alerts.
          return null;
        }
      }

      // Remove user email and IP
      if (event.user) {
        delete event.user.email;
        delete event.user.ip_address;
        delete event.user.username;
      }

      // Scrub tokens from breadcrumbs and request data
      const sensitivePatterns = [
        /Bearer\s+[A-Za-z0-9\-_.]+/gi,
        /access_token[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi,
        /refresh_token[=:]\s*["']?[A-Za-z0-9\-_.]+["']?/gi,
        /token[=:]\s*["']?[A-Za-z0-9\-_.]{20,}["']?/gi,
        /[#&](access_token|refresh_token|id_token|token)=[^&\s]+/gi,
      ];

      const scrubString = (str: string): string => {
        let result = str;
        sensitivePatterns.forEach((pattern) => {
          result = result.replace(pattern, "[REDACTED]");
        });
        return result;
      };

      // Scrub breadcrumb messages
      if (event.breadcrumbs) {
        event.breadcrumbs = event.breadcrumbs.map((bc) => ({
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
          headers[key] =
            key.toLowerCase() === "authorization" ? "[REDACTED]" : scrubString(String(value));
        }
        event.request.headers = headers;
      }

      // Don't send events in development
      if (IS_DEV) {
        logger.log("[Sentry] Would send event:", event);
        return null;
      }

      return event;
    },

    // Add platform context
    initialScope: {
      tags: {
        platform,
        isNative: isNative ? "yes" : "no",
      },
    },
  });

  // Only log in development
  if (IS_DEV) {
    logger.log("[Sentry] Initialized successfully");
  }
}

/**
 * Error categories for filtering and analysis in Sentry dashboard
 */
export type ErrorCategory =
  | "audio"
  | "cache"
  | "version-mismatch"
  | "storage"
  | "network"
  | "sync"
  | "general";

/**
 * Capture a custom error with context
 */
export function captureError(error: Error, context?: Record<string, unknown>): void {
  Sentry.captureException(error, {
    extra: context,
  });
}

/**
 * Capture error with category tag for filtering
 * Use this for categorized errors (audio, cache, version issues)
 */
export function captureErrorWithCategory(
  error: Error,
  category: ErrorCategory,
  context?: Record<string, unknown>
): void {
  Sentry.withScope((scope) => {
    scope.setTag("category", category);

    // Add extra context based on error type
    if (error.name === "AbortError") {
      scope.setTag("error_type", "abort");
      scope.setExtra("abort_reason", error.message);
    } else if (error.message.includes("Database deleted")) {
      scope.setTag("error_type", "database_deleted");
      scope.setExtra("likely_cause", "User cleared site data or Safari ITP");
    } else if (error.message.includes("chunk") || error.message.includes("module")) {
      scope.setTag("error_type", "chunk_load");
      scope.setExtra("likely_cause", "Version mismatch after deployment");
    }

    if (context) {
      scope.setExtras(context);
    }

    Sentry.captureException(error);
  });
}

/**
 * Add breadcrumb with category
 */
export function addCategorizedBreadcrumb(
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level: Sentry.SeverityLevel = "info"
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
export function captureMessage(message: string, level: Sentry.SeverityLevel = "info"): void {
  Sentry.captureMessage(message, level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  // Hash userId to avoid sending raw PII to Sentry (GDPR pseudonymization)
  let hash = 5381;
  for (let i = 0; i < userId.length; i++) {
    hash = ((hash << 5) + hash + userId.charCodeAt(i)) >>> 0;
  }
  Sentry.setUser({
    id: `u-${hash.toString(36)}`,
  });
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

// Re-export Sentry's ErrorBoundary for use in App.tsx
export { ErrorBoundary } from "@sentry/react";

/**
 * Re-export addBreadcrumb so all consumers import from @/lib/sentry
 * instead of @sentry/react directly (enables tree-shaking).
 */
export { addBreadcrumb } from "@sentry/react";
