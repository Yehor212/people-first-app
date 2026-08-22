/**
 * Sentry Error Monitoring Integration
 *
 * Sends crash reports and performance data to Sentry for monitoring.
 * Respects user privacy by stripping PII before sending.
 *
 * Free tier: 5,000 errors/month, 10,000 transactions/month
 */

import * as Sentry from "@sentry/browser";
import type {
  Breadcrumb,
  BreadcrumbHint,
  ErrorEvent,
  Integration,
  SeverityLevel,
} from "@sentry/core";
import {
  SENTRY_ALLOW_URLS,
  SENTRY_IGNORE_ERRORS,
  shouldDropSentryEvent,
} from "@/lib/sentryEventFilters";
import {
  createDiagnosticError,
  DIAGNOSTIC_CODES,
  sanitizeDiagnosticMetadata,
  setExternalDiagnosticSinkState,
} from "@/lib/diagnosticPrivacy";

// Declare global app version
declare const __APP_VERSION__: string;

const IS_DEV = import.meta.env.DEV;
const MODE = import.meta.env.MODE;
const SENTRY_DSN = import.meta.env.VITE_SENTRY_DSN as string | undefined;

function isUsableSentryDsn(dsn: string | undefined): dsn is string {
  const value = dsn?.trim();
  if (!value) return false;

  try {
    const url = new URL(value);
    return url.protocol === "https:" && /(^|\.)sentry\.io$/i.test(url.hostname);
  } catch {
    return false;
  }
}

function getSentryPlatform(): "android" | "ios" | "web" {
  const capacitor = (globalThis as {
    Capacitor?: {
      getPlatform?: () => string;
      isNativePlatform?: () => boolean;
    };
  }).Capacitor;

  if (!capacitor?.isNativePlatform?.()) {
    return "web";
  }

  const value = capacitor.getPlatform?.();
  return value === "android" || value === "ios" ? value : "web";
}

/**
 * Initialize Sentry error monitoring
 * Call this as early as possible in the app lifecycle
 */
export interface SentryInitializationOptions {
  externalDiagnosticsEnabled: boolean;
}

export function initSentry(
  options: SentryInitializationOptions = { externalDiagnosticsEnabled: false }
): void {
  if (!options.externalDiagnosticsEnabled) {
    setExternalDiagnosticSinkState("disabled-by-default");
    return;
  }

  const dsn = SENTRY_DSN?.trim();
  const detectedPlatform = getSentryPlatform();
  const isNativeRuntime = detectedPlatform !== "web";

  // Skip if no valid DSN is configured (development without Sentry or copied placeholders)
  if (!isUsableSentryDsn(dsn)) {
    setExternalDiagnosticSinkState("unconfigured");
    return;
  }

  // Build integrations list — replay only on web (rrweb crashes Android WebView)
  const integrations: Integration[] = [
    Sentry.browserTracingIntegration({
      shouldCreateSpanForRequest: (url) => {
        if (url.includes("/health")) return false;
        if (url.includes("sentry.io")) return false;
        if (url.includes("google-analytics")) return false;
        if (url.includes("googletagmanager")) return false;
        // Firebase telemetry (Analytics, Crashlytics, Remote Config) — not our
        // request path, and tracing them wastes transaction quota. Added per
        // 2026-04-19 deep audit §6 (research-confirmed canonical skip list).
        if (url.includes("firebase.googleapis.com")) return false;
        if (url.includes("firebaseinstallations.googleapis.com")) return false;
        if (url.includes("firebase-crashlytics.googleapis.com")) return false;
        if (url.includes("firebaseremoteconfig.googleapis.com")) return false;
        if (url.includes("firebaseio.com")) return false;
        if (url.includes("firebaseapp.com")) return false;
        return true;
      },
    }),
  ];

  // Session Replay stays disabled by default: ZenFlow contains diary, mood,
  // auth and coach surfaces, so error telemetry is enough without recording UI.
  // Keeping Replay out also prevents pulling rrweb into the production bundle.

  Sentry.init({
    dsn,
    environment: MODE,
    release: `zenflow@${__APP_VERSION__}`,

    // Performance monitoring - sample 10% of transactions
    tracesSampleRate: isNativeRuntime ? 0.05 : 0.1,

    // Distributed tracing targets - MUST be at root level for SDK v8+
    tracePropagationTargets: ["localhost", /^https:\/\/.*\.supabase\.co/],

    // Explicit opt-out of server-side PII inference (GDPR). v10.4.0 made this
    // the default, but setting it explicitly future-proofs against SDK default
    // flips. Source: docs.sentry.io v10 migration notes.
    sendDefaultPii: false,

    // Quota-saving denylist — browser-extension errors (Grammarly, password
    // managers, ad-blockers) and Capacitor's own webkit-masked URLs inject
    // noise that burns the 5k errors/month free-tier quota. Canonical list
    // per docs.sentry.io/.../filtering/ (2025).
    denyUrls: [
      /^chrome-extension:\/\//,
      /^moz-extension:\/\//,
      /^safari-web-extension:\/\//,
      /^webkit-masked-url:\/\//,
      /\/extensions\//i,
    ],

    // Early-exit noise filter. `ignoreErrors` stops processing BEFORE beforeSend,
    // so it's cheaper than a beforeSend return null. ResizeObserver loops are
    // Chrome/WebKit quirks with no user impact. Non-Error promise rejection
    // means a caller threw a non-Error value — cannot get meaningful stack.
    ignoreErrors: [...SENTRY_IGNORE_ERRORS],
    allowUrls: [...SENTRY_ALLOW_URLS],

    integrations,

    // Privacy: Strip PII and tokens before sending
    // Also filter out expected/handled errors
    beforeSend(event, hint) {
      // Drop expected browser cancellations, stale-deploy chunk failures, and
      // known Supabase auth lock contention before scrubbing/sending.
      if (shouldDropSentryEvent(event, hint)) {
        return null;
      }

      // Redaction heuristics are insufficient for personal writing. Build a
      // fixed-code event from a tiny allowlist and discard every caller-owned
      // string, stack, request, breadcrumb, identity, context and fingerprint.
      const safeEvent: ErrorEvent = {
        type: undefined,
        timestamp: event.timestamp,
        level: event.level,
        platform: event.platform,
        release: event.release,
        environment: event.environment,
        message: DIAGNOSTIC_CODES.error,
        exception: {
          values: [
            {
              type: "ZenFlowDiagnosticError",
              value: DIAGNOSTIC_CODES.error,
            },
          ],
        },
      };
      const mutableEvent = event as unknown as Record<string, unknown>;
      for (const key of Object.keys(mutableEvent)) {
        delete mutableEvent[key];
      }
      Object.assign(mutableEvent, safeEvent);

      // Don't send events in development
      if (IS_DEV) {
        return null;
      }

      return event;
    },

    // Add platform context
    initialScope: {
      tags: {
        platform: detectedPlatform,
        isNative: isNativeRuntime ? "yes" : "no",
      },
    },
  });
  setExternalDiagnosticSinkState("enabled-with-explicit-choice");
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
  void error;
  void context;
  Sentry.captureException(createDiagnosticError(DIAGNOSTIC_CODES.error));
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
  void error;
  void context;
  Sentry.withScope((scope) => {
    scope.setTag("category", category);
    Sentry.captureException(createDiagnosticError(DIAGNOSTIC_CODES.error));
  });
}

/**
 * Add breadcrumb with category
 */
export function addCategorizedBreadcrumb(
  category: ErrorCategory,
  message: string,
  data?: Record<string, unknown>,
  level: SeverityLevel = "info"
): void {
  const safeData = sanitizeDiagnosticMetadata({ ...data, category });
  Sentry.addBreadcrumb({
    category,
    message: DIAGNOSTIC_CODES.breadcrumb,
    level,
    ...(safeData ? { data: safeData } : {}),
  });
  void message;
}

/**
 * Capture a custom message
 */
export function captureMessage(message: string, level: SeverityLevel = "info"): void {
  void message;
  Sentry.captureMessage(DIAGNOSTIC_CODES.message, level);
}

/**
 * Set user context (anonymized)
 */
export function setUserContext(userId: string): void {
  void userId;
  Sentry.setUser(null);
}

/**
 * Clear user context on logout
 */
export function clearUserContext(): void {
  Sentry.setUser(null);
}

/**
 * Re-export addBreadcrumb so all consumers import from @/lib/sentry
 * instead of Sentry packages directly.
 */
export function addBreadcrumb(breadcrumb: Breadcrumb, hint?: BreadcrumbHint): void {
  const safeCategory = breadcrumb.category;
  const safeCategoryValue: ErrorCategory =
    safeCategory === "audio" ||
    safeCategory === "cache" ||
    safeCategory === "version-mismatch" ||
    safeCategory === "storage" ||
    safeCategory === "network" ||
    safeCategory === "sync"
      ? safeCategory
      : "general";
  addCategorizedBreadcrumb(
    safeCategoryValue,
    DIAGNOSTIC_CODES.breadcrumb,
    undefined,
    breadcrumb.level ?? "info"
  );
  void hint;
}
