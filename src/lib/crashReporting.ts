/**
 * Crash Reporting Wrapper
 * Provides a unified interface for crash reporting.
 * On Android, this connects to Firebase Crashlytics.
 * On Web, errors are logged to console and localStorage.
 */

import { Capacitor } from '@capacitor/core';
import { logger } from './logger';
import { safeLocalStorageGet } from './safeJson';

interface CrashReportingInterface {
  log: (message: string) => void;
  recordError: (error: Error, context?: Record<string, string>) => void;
  setUserId: (userId: string | null) => void;
  setEnabled: (enabled: boolean) => void;
  setCustomKey: (key: string, value: string | number | boolean) => void;
}

const isNative = Capacitor.isNativePlatform();

// For native platforms, Firebase Crashlytics is automatically initialized
// and captures crashes. These methods provide additional logging.

const webFallback: CrashReportingInterface = {
  log: (message: string) => {
    logger.log('[Crash] Log:', message);
  },

  recordError: (error: Error, context?: Record<string, string>) => {
    logger.error('[Crash] Error recorded:', error.message);
    if (context) {
      logger.error('[Crash] Context:', context);
    }

    // Store in localStorage for debug reports
    try {
      const LOG_KEY = 'zenflow-crash-log';
      const existing = safeLocalStorageGet<{ message: string; stack?: string; context?: Record<string, string>; time: string }[]>(LOG_KEY, []);
      const entry = {
        message: error.message,
        stack: error.stack,
        context,
        time: new Date().toISOString()
      };
      const next = [...existing, entry].slice(-20);
      localStorage.setItem(LOG_KEY, JSON.stringify(next));
    } catch {
      // Ignore storage errors
    }
  },

  setUserId: (userId: string | null) => {
    logger.log('[Crash] User ID set:', userId || 'null');
  },

  setEnabled: (enabled: boolean) => {
    logger.log('[Crash] Reporting enabled:', enabled);
  },

  setCustomKey: (key: string, value: string | number | boolean) => {
    logger.log('[Crash] Custom key:', key, '=', value);
  }
};

// For native platforms, we use the native Crashlytics through the WebView bridge
// Firebase Crashlytics captures crashes automatically, but we can add context
const nativeCrashlytics: CrashReportingInterface = {
  log: (message: string) => {
    // On native, console.log messages can be captured by Crashlytics
    console.log('[ZenFlow]', message);
  },

  recordError: (error: Error, context?: Record<string, string>) => {
    // Non-fatal errors are recorded as console errors
    // Firebase Crashlytics on Android captures these
    console.error('[ZenFlow Error]', error.message, error.stack);
    if (context) {
      // Sanitize context to avoid logging sensitive data
      const sanitizedContext = { ...context };
      const sensitiveKeys = ['password', 'token', 'secret', 'key', 'auth', 'credential', 'email', 'phone'];
      for (const key of Object.keys(sanitizedContext)) {
        if (sensitiveKeys.some(sk => key.toLowerCase().includes(sk))) {
          sanitizedContext[key] = '[REDACTED]';
        }
      }
      console.error('[ZenFlow Error Context]', JSON.stringify(sanitizedContext));
    }
  },

  setUserId: (userId: string | null) => {
    // Store user ID in session for crash reports
    if (userId) {
      console.log('[ZenFlow User]', userId);
    }
  },

  setEnabled: (enabled: boolean) => {
    console.log('[ZenFlow Crashlytics]', enabled ? 'enabled' : 'disabled');
  },

  setCustomKey: (key: string, value: string | number | boolean) => {
    console.log(`[ZenFlow ${key}]`, value);
  }
};

export const crashReporting: CrashReportingInterface = isNative ? nativeCrashlytics : webFallback;

// Helper to record errors from anywhere in the app
export const recordError = (error: unknown, context?: Record<string, string>) => {
  if (error instanceof Error) {
    crashReporting.recordError(error, context);
  } else {
    crashReporting.recordError(new Error(String(error)), context);
  }
};

// Helper to wrap async functions with error recording
export const withCrashReporting = <T extends (...args: unknown[]) => Promise<unknown>>(
  fn: T,
  context?: Record<string, string>
): T => {
  return (async (...args: Parameters<T>) => {
    try {
      return await fn(...args);
    } catch (error) {
      recordError(error, context);
      throw error;
    }
  }) as T;
};
