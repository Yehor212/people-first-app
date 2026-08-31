import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";
import { nanoid } from "nanoid";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

/**
 * Interpolate template variables in translation strings.
 * Replaces {key} with corresponding values from the values object.
 * Example: interpolate("Hello {name}!", { name: "World" }) → "Hello World!"
 */
export function interpolate(template: string, values: Record<string, string | number>): string {
  return template.replace(/\{(\w+)\}/g, (_, key) => String(values[key] ?? `{${key}}`));
}

export function formatDate(date: Date): string {
  // Use local time, not UTC (toISOString uses UTC which can shift dates near midnight)
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getToday(): string {
  return formatDate(new Date());
}

/**
 * Parse date string as LOCAL time, not UTC
 * CRITICAL: new Date("2026-01-30") parses as UTC midnight!
 * In negative UTC timezones, this causes off-by-one day errors.
 * Use this function instead of new Date(dateStr) for date-only strings.
 */
export function parseLocalDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split('-').map(Number);
  return new Date(year, month - 1, day); // month is 0-indexed
}

/**
 * Generate cryptographically secure unique ID
 * Uses nanoid for collision-resistant IDs (21 chars, ~2 million years to 1% collision at 1000 IDs/hour)
 */
export function generateId(): string {
  return nanoid();
}

/** Generate an RFC 4122 UUIDv4 for records whose remote table requires UUID keys. */
export function generateUuid(): string {
  if (typeof globalThis.crypto?.randomUUID === "function") {
    return globalThis.crypto.randomUUID();
  }
  if (typeof globalThis.crypto?.getRandomValues !== "function") {
    throw new Error("Secure UUID generation is unavailable");
  }
  const bytes = globalThis.crypto.getRandomValues(new Uint8Array(16));
  bytes[6] = (bytes[6] & 0x0f) | 0x40;
  bytes[8] = (bytes[8] & 0x3f) | 0x80;
  const hex = Array.from(bytes, (byte) => byte.toString(16).padStart(2, "0"));
  return `${hex.slice(0, 4).join("")}-${hex.slice(4, 6).join("")}-${hex
    .slice(6, 8)
    .join("")}-${hex.slice(8, 10).join("")}-${hex.slice(10).join("")}`;
}

export function formatTime(seconds: number): string {
  const mins = Math.floor(seconds / 60);
  const secs = seconds % 60;
  return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
}

export function getDaysInMonth(year: number, month: number): number {
  return new Date(year, month + 1, 0).getDate();
}

export function calculateStreak(dates: string[]): number {
  if (dates.length === 0) return 0;
  
  const sortedDates = [...dates].sort().reverse();
  const today = getToday();
  const yesterdayDate = new Date();
  yesterdayDate.setDate(yesterdayDate.getDate() - 1);
  const yesterday = formatDate(yesterdayDate);
  
  if (sortedDates[0] !== today && sortedDates[0] !== yesterday) {
    return 0;
  }
  
  let streak = 1;
  for (let i = 1; i < sortedDates.length; i++) {
    const current = parseLocalDate(sortedDates[i - 1]);
    const prev = parseLocalDate(sortedDates[i]);
    const diffDays = Math.round((current.getTime() - prev.getTime()) / 86400000);
    
    if (diffDays === 1) {
      streak++;
    } else {
      break;
    }
  }
  
  return streak;
}
