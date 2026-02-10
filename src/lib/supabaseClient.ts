import { createClient, SupabaseClient, User } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Database } from '@/types/supabase';
import { z } from 'zod';

/**
 * Zod schema for validating Supabase user object
 * Ensures the user object has the expected shape before using it
 */
const supabaseUserSchema = z.object({
  id: z.string().uuid(),
  email: z.string().email().optional().nullable(),
  app_metadata: z.record(z.unknown()).optional(),
  user_metadata: z.record(z.unknown()).optional(),
  created_at: z.string().optional(),
});

/**
 * Validate user object from Supabase auth response
 * Returns the validated user or null if validation fails
 */
export function validateSupabaseUser(user: unknown): User | null {
  if (!user) return null;

  const result = supabaseUserSchema.safeParse(user);
  if (!result.success) {
    // Log validation error in development
    if (import.meta.env.DEV) {
      console.warn('[Supabase] User validation failed:', result.error.issues);
    }
    return null;
  }

  // Return the original user (with full Supabase type) since it passed validation
  return user as User;
}

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

/**
 * Validate Supabase environment variables
 * Returns validation status for use in UI notifications
 */
export interface SupabaseConfigStatus {
  isConfigured: boolean;
  missingUrl: boolean;
  missingKey: boolean;
}

export function getSupabaseConfigStatus(): SupabaseConfigStatus {
  const missingUrl = !SUPABASE_URL || typeof SUPABASE_URL !== 'string' || SUPABASE_URL.trim() === '';
  const missingKey = !SUPABASE_ANON_KEY || typeof SUPABASE_ANON_KEY !== 'string' || SUPABASE_ANON_KEY.trim() === '';

  return {
    isConfigured: !missingUrl && !missingKey,
    missingUrl,
    missingKey,
  };
}

// Emit event if Supabase is not configured so UI can show notification
const configStatus = getSupabaseConfigStatus();
if (!configStatus.isConfigured && typeof window !== 'undefined') {
  // Log warning in development
  if (import.meta.env.DEV) {
    console.warn(
      '[Supabase] Cloud sync disabled - environment variables not configured.',
      configStatus.missingUrl ? 'Missing VITE_SUPABASE_URL.' : '',
      configStatus.missingKey ? 'Missing VITE_SUPABASE_ANON_KEY.' : ''
    );
  }
  // Emit event for UI to show notification (async to not block initialization)
  setTimeout(() => {
    window.dispatchEvent(new CustomEvent('zenflow:supabase-not-configured', {
      detail: configStatus
    }));
  }, 0);
}

/**
 * Get storage adapter for auth persistence
 * Uses localStorage which works well in both web and Capacitor
 */
const getAuthStorage = () => {
  if (typeof window === 'undefined') return undefined;
  return window.localStorage;
};

/**
 * Determine if we should detect session from URL
 * - Web: true (handles OAuth callback in URL)
 * - Native: false (handled via deep links separately)
 */
const shouldDetectSessionInUrl = (): boolean => {
  return !Capacitor.isNativePlatform();
};

// Export null if not configured - app works in local-only mode
export const supabase: SupabaseClient<Database> | null =
  SUPABASE_URL && SUPABASE_ANON_KEY
    ? createClient<Database>(SUPABASE_URL, SUPABASE_ANON_KEY, {
        auth: {
          persistSession: true,
          autoRefreshToken: true,
          detectSessionInUrl: shouldDetectSessionInUrl(),
          storage: getAuthStorage(),
          flowType: 'pkce',
        },
      })
    : null;

// Helper to check if user is authenticated
// Validates user object shape before returning
export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user }, error } = await supabase.auth.getUser();

  // Log errors for debugging
  if (error) {
    if (import.meta.env.DEV) {
      console.warn('[Supabase] getUser error:', error.message);
    }
    return null;
  }

  // Validate user object shape
  return validateSupabaseUser(user);
};

// Helper to get user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id ?? null;
};
