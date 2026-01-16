import { z } from 'zod';

// Validation schemas
export const userNameSchema = z
  .string()
  .min(1, 'Name cannot be empty')
  .max(100, 'Name too long')
  .regex(/^[^<>{}]*$/, 'Invalid characters in name');

export const moodNoteSchema = z
  .string()
  .max(1000, 'Note too long')
  .regex(/^[^<>{}]*$/, 'Invalid characters in note');

export const gratitudeTextSchema = z
  .string()
  .min(1, 'Gratitude text cannot be empty')
  .max(500, 'Gratitude text too long')
  .regex(/^[^<>{}]*$/, 'Invalid characters');

export const habitNameSchema = z
  .string()
  .min(1, 'Habit name cannot be empty')
  .max(100, 'Habit name too long')
  .regex(/^[^<>{}]*$/, 'Invalid characters in habit name');

// Sanitization functions
export const sanitizeString = (input: string): string => {
  return input
    .replace(/[<>{}]/g, '')
    .trim()
    .slice(0, 1000);
};

export const sanitizeUserName = (name: string): string => {
  return name
    .replace(/[<>{}]/g, '')
    .trim()
    .slice(0, 100);
};

// Prototype pollution prevention
export const sanitizeObject = <T extends Record<string, unknown>>(obj: T): T => {
  const sanitized = { ...obj };

  // Remove dangerous properties
  delete (sanitized as Record<string, unknown>)['__proto__'];
  delete (sanitized as Record<string, unknown>)['constructor'];
  delete (sanitized as Record<string, unknown>)['prototype'];

  return sanitized;
};

// Individual item validation schemas for backup import
export const moodEntrySchema = z.object({
  id: z.string().min(1).max(100),
  mood: z.enum(['great', 'good', 'okay', 'bad', 'terrible']),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.number().int().positive(),
  note: z.string().max(1000).optional(),
}).passthrough();

export const habitSchema = z.object({
  id: z.string().min(1).max(100),
  name: z.string().min(1).max(200),
  icon: z.string().max(10),
  color: z.string().max(50),
  completedDates: z.array(z.string()).max(10000),
  createdAt: z.number().int().positive(),
}).passthrough();

export const focusSessionSchema = z.object({
  id: z.string().min(1).max(100),
  duration: z.number().int().min(0).max(86400), // max 24 hours
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  completedAt: z.number().int().positive(),
}).passthrough();

export const gratitudeEntrySchema = z.object({
  id: z.string().min(1).max(100),
  text: z.string().min(1).max(1000),
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  timestamp: z.number().int().positive(),
}).passthrough();

export const settingSchema = z.object({
  key: z.string().min(1).max(100).regex(/^[a-zA-Z0-9_-]+$/),
  value: z.unknown(),
}).passthrough();

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
