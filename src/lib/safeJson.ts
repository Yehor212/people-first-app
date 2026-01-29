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
    return false;
  }
};

export default {
  parse: safeJsonParse,
  stringify: safeJsonStringify,
  localGet: safeLocalStorageGet,
  localSet: safeLocalStorageSet,
};
