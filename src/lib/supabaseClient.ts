import { createClient, SupabaseClient } from '@supabase/supabase-js';
import { Capacitor } from '@capacitor/core';
import { Database } from '@/types/supabase';

const SUPABASE_URL = import.meta.env.VITE_SUPABASE_URL;
const SUPABASE_ANON_KEY = import.meta.env.VITE_SUPABASE_ANON_KEY;

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
export const getCurrentUser = async () => {
  if (!supabase) return null;
  const { data: { user } } = await supabase.auth.getUser();
  return user;
};

// Helper to get user ID
export const getCurrentUserId = async (): Promise<string | null> => {
  const user = await getCurrentUser();
  return user?.id ?? null;
};
