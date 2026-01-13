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

// Validate backup data structure
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
