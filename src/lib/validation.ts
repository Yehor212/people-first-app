import { z } from 'zod';
import DOMPurify from 'dompurify';

/**
 * Generate a cryptographically secure random string.
 * Uses crypto.getRandomValues() instead of Math.random() for better security.
 * @param length - Length of the random string (default: 9)
 * @returns Alphanumeric random string
 */
export const generateSecureRandom = (length: number = 9): string => {
  const chars = 'abcdefghijklmnopqrstuvwxyz0123456789';
  const values = crypto.getRandomValues(new Uint8Array(length));
  return Array.from(values, v => chars[v % chars.length]).join('');
};

/**
 * Generate a secure unique ID with timestamp prefix.
 * Format: {prefix}_{timestamp}_{random}
 * @param prefix - ID prefix (e.g., 'challenge', 'task')
 * @returns Secure unique ID
 */
export const generateSecureId = (prefix: string): string => {
  return `${prefix}_${Date.now()}_${generateSecureRandom()}`;
};

// Dangerous patterns that could indicate XSS attempts
const DANGEROUS_PATTERNS = [
  /javascript:/gi,
  /data:/gi,
  /vbscript:/gi,
  /on\w+\s*=/gi, // onclick=, onerror=, etc.
  /<script/gi,
  /eval\s*\(/gi,
  /expression\s*\(/gi,
  /url\s*\(/gi,
];

// Check if string contains dangerous patterns
const containsDangerousPatterns = (input: string): boolean => {
  return DANGEROUS_PATTERNS.some(pattern => pattern.test(input));
};

// Safe character regex - allows letters, numbers, common punctuation, and unicode
const SAFE_CHARS_REGEX = /^[^<>{}\\]*$/;

// Validation schemas
export const userNameSchema = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name too long')
  .regex(SAFE_CHARS_REGEX, 'Invalid characters in name')
  .refine(val => !containsDangerousPatterns(val), 'Invalid content detected');

export const moodNoteSchema = z
  .string()
  .max(1000, 'Note too long')
  .regex(SAFE_CHARS_REGEX, 'Invalid characters in note')
  .refine(val => !containsDangerousPatterns(val), 'Invalid content detected');

export const gratitudeTextSchema = z
  .string()
  .min(1, 'Gratitude text cannot be empty')
  .max(500, 'Gratitude text too long')
  .regex(SAFE_CHARS_REGEX, 'Invalid characters')
  .refine(val => !containsDangerousPatterns(val), 'Invalid content detected');

export const habitNameSchema = z
  .string()
  .min(1, 'Habit name cannot be empty')
  .max(100, 'Habit name too long')
  .regex(SAFE_CHARS_REGEX, 'Invalid characters in habit name')
  .refine(val => !containsDangerousPatterns(val), 'Invalid content detected');

export const taskNameSchema = z
  .string()
  .min(1, 'Task name cannot be empty')
  .max(200, 'Task name too long')
  .regex(SAFE_CHARS_REGEX, 'Invalid characters in task name')
  .refine(val => !containsDangerousPatterns(val), 'Invalid content detected');

export const emailSchema = z
  .string()
  .email('Invalid email format')
  .max(254, 'Email too long')
  .optional()
  .or(z.literal('')); // Allow empty string

// Sanitization functions using DOMPurify for robust XSS protection
export const sanitizeString = (input: string): string => {
  // First pass: DOMPurify strips all HTML
  let sanitized = DOMPurify.sanitize(input, {
    ALLOWED_TAGS: [],
    ALLOWED_ATTR: [],
  });

  // Second pass: Remove any remaining dangerous patterns
  for (const pattern of DANGEROUS_PATTERNS) {
    sanitized = sanitized.replace(pattern, '');
  }

  // Remove angle brackets and curly braces
  return sanitized
    .replace(/[<>{}\\]/g, '')
    .trim()
    .slice(0, 1000);
};

export const sanitizeUserName = (name: string): string => {
  return sanitizeString(name).slice(0, 100);
};

/**
 * Safely parse a string to integer with bounds checking.
 * Returns defaultValue if parsing fails or value is NaN.
 */
export const safeParseInt = (
  value: string | number,
  defaultValue: number,
  min?: number,
  max?: number
): number => {
  const parsed = typeof value === 'number' ? value : parseInt(value, 10);
  if (isNaN(parsed)) return defaultValue;
  let result = parsed;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
};

/**
 * Safely parse a string to float with bounds checking.
 * Returns defaultValue if parsing fails or value is NaN.
 */
export const safeParseFloat = (
  value: string | number,
  defaultValue: number,
  min?: number,
  max?: number
): number => {
  const parsed = typeof value === 'number' ? value : parseFloat(value);
  if (isNaN(parsed)) return defaultValue;
  let result = parsed;
  if (min !== undefined) result = Math.max(min, result);
  if (max !== undefined) result = Math.min(max, result);
  return result;
};

/**
 * Safely calculate average of an array of numbers.
 * Returns 0 for empty or null arrays to prevent division by zero.
 */
export const safeAverage = (values: number[]): number => {
  if (!values || values.length === 0) return 0;
  return values.reduce((a, b) => a + b, 0) / values.length;
};

// Prototype pollution prevention - recursive
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
  if (obj === null || typeof obj !== 'object') {
    return obj;
  }

  const sanitized = { ...obj };
  const dangerousKeys = ['__proto__', 'constructor', 'prototype'];

  // Remove dangerous properties at current level
  for (const key of dangerousKeys) {
    delete (sanitized as Record<string, unknown>)[key];
  }

  // Recursively sanitize nested objects
  for (const [key, value] of Object.entries(sanitized)) {
    if (value !== null && typeof value === 'object' && !Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = sanitizeObject(value as Record<string, unknown>);
    } else if (Array.isArray(value)) {
      (sanitized as Record<string, unknown>)[key] = value.map(item =>
        item !== null && typeof item === 'object'
          ? sanitizeObject(item as Record<string, unknown>)
          : item
      );
    }
  }

  return sanitized;
};

// Individual item validation schemas for backup import
// Note: Default Zod behavior strips unknown keys for security (no .passthrough())
export const moodEntrySchema = z.object({
  id: z.string().min(1).max(100),
  mood: z.enum(['great', 'good', 'okay', 'bad', 'terrible']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.number().int().positive(),
  note: z.string().max(1000).optional(),
});

export const habitSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  icon: z.string().max(10),
  color: z.string().max(50),
  completedDates: z.array(z.string()).max(10000),
  createdAt: z.number().int().positive(),
});

export const focusSessionSchema = z.object({
  id: z.string().min(1).max(100),
  duration: z.number().int().min(0).max(86400), // max 24 hours
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedAt: z.number().int().positive(),
});

export const gratitudeEntrySchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.number().int().positive(),
});

export const settingSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  value: z.unknown(),
});

// Safe validation with fallback
export const safeValidate = <T>(schema: z.ZodSchema<T>, data: unknown): T | null => {
  const result = schema.safeParse(data);
  return result.success ? result.data : null;
};

// Validate backup data structure (legacy schema for backwards compat)
export const backupDataSchema = z.object({
  version: z.string(),
  exportDate: z.string(),
  data: z.object({
    moods: z.array(z.unknown()).max(100000),
    habits: z.array(z.unknown()).max(100000),
    habitCompletions: z.array(z.unknown()).max(100000),
    gratitudeEntries: z.array(z.unknown()).max(100000),
    settings: z.array(z.unknown()).max(100000),
  }),
});
