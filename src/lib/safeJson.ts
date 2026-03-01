/**
 * Safe JSON parsing utilities to prevent application crashes
 * from corrupted or malformed JSON data in localStorage/storage.
 */

import { logger } from './logger';

/**
 * Safely parse JSON with a fallback value.
 * Returns fallback if parsing fails or input is null/undefined.
 *
 * @param json - The JSON string to parse (can be null/undefined)
 * @param fallback - The fallback value to return on failure
 * @returns Parsed value or fallback
 *
 * @example
 * const data = safeJsonParse(localStorage.getItem('key'), { default: true });
 * const items = safeJsonParse<string[]>(stored, []);
 */
export const safeJsonParse = <T>(
  json: string | null | undefined,
  fallback: T
): T => {
  if (json === null || json === undefined || json === '') {
    return fallback;
  }

  try {
    const parsed = JSON.parse(json);
    return parsed as T;
  } catch (error) {
    logger.warn('[SafeJSON] Parse failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
      inputLength: json.length,
      inputPreview: json.slice(0, 50) + (json.length > 50 ? '...' : ''),
    });
    return fallback;
  }
};

/**
 * Safely stringify and store JSON.
 * Returns false if stringification fails.
 *
 * @param value - The value to stringify
 * @returns JSON string or null on failure
 */
export const safeJsonStringify = (value: unknown): string | null => {
  try {
    return JSON.stringify(value);
  } catch (error) {
    logger.warn('[SafeJSON] Stringify failed:', {
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return null;
  }
};

/**
 * Safely get and parse a value from localStorage.
 *
 * @param key - The localStorage key
 * @param fallback - The fallback value
 * @returns Parsed value or fallback
 */
export const safeLocalStorageGet = <T>(key: string, fallback: T): T => {
  try {
    const stored = localStorage.getItem(key);
    return safeJsonParse(stored, fallback);
  } catch (error) {
    // localStorage itself might throw (e.g., in private browsing mode)
    logger.warn('[SafeJSON] localStorage.getItem failed:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fallback;
  }
};

/**
 * Safely stringify and set a value in localStorage.
 *
 * @param key - The localStorage key
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export const safeLocalStorageSet = (key: string, value: unknown): boolean => {
  try {
    const json = safeJsonStringify(value);
    if (json === null) return false;
    localStorage.setItem(key, json);
    return true;
  } catch (error) {
    // localStorage might throw (quota exceeded, private mode, etc.)
    logger.warn('[SafeJSON] localStorage.setItem failed:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      notifyStorageFull(key);
    }
    return false;
  }
};

/**
 * Safely get and parse a value from sessionStorage.
 * sessionStorage is more secure for tokens as it's cleared when the tab closes.
 *
 * @param key - The sessionStorage key
 * @param fallback - The fallback value
 * @returns Parsed value or fallback
 */
export const safeSessionStorageGet = <T>(key: string, fallback: T): T => {
  try {
    const stored = sessionStorage.getItem(key);
    return safeJsonParse(stored, fallback);
  } catch (error) {
    // sessionStorage itself might throw (e.g., in private browsing mode)
    logger.warn('[SafeJSON] sessionStorage.getItem failed:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return fallback;
  }
};

/**
 * Safely stringify and set a value in sessionStorage.
 *
 * @param key - The sessionStorage key
 * @param value - The value to store
 * @returns true if successful, false otherwise
 */
export const safeSessionStorageSet = (key: string, value: unknown): boolean => {
  try {
    const json = safeJsonStringify(value);
    if (json === null) return false;
    sessionStorage.setItem(key, json);
    return true;
  } catch (error) {
    // sessionStorage might throw (quota exceeded, private mode, etc.)
    logger.warn('[SafeJSON] sessionStorage.setItem failed:', {
      key,
      error: error instanceof Error ? error.message : 'Unknown error',
    });
    return false;
  }
};

// ─── Raw string helpers (no JSON parse/stringify) ───

/** Safe raw string get from localStorage. For theme, language, simple flags. */
export function storageGetRaw(key: string, fallback = ''): string {
  try {
    return localStorage.getItem(key) ?? fallback;
  } catch {
    return fallback;
  }
}

/** Safe raw string set to localStorage. */
export function storageSetRaw(key: string, value: string): void {
  try {
    localStorage.setItem(key, value);
  } catch (error) {
    if (error instanceof DOMException && error.name === 'QuotaExceededError') {
      notifyStorageFull(key);
    }
  }
}

/** Safe localStorage remove. */
export function storageRemove(key: string): void {
  try {
    localStorage.removeItem(key);
  } catch { /* ignore */ }
}

// ─── Quota exceeded notification (picked up by OfflineBanner) ───

let _quotaNotified = false;
function notifyStorageFull(key: string) {
  logger.error('[Storage] QuotaExceededError writing key:', key);
  if (_quotaNotified) return; // fire once per session
  _quotaNotified = true;
  window.dispatchEvent(
    new CustomEvent('zenflow:offline-data-dropped', {
      detail: { message: 'Storage full — some changes may not be saved' },
    }),
  );
}

export default {
  parse: safeJsonParse,
  stringify: safeJsonStringify,
  localGet: safeLocalStorageGet,
  localSet: safeLocalStorageSet,
  sessionGet: safeSessionStorageGet,
  sessionSet: safeSessionStorageSet,
};
