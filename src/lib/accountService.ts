import { supabase } from './supabaseClient';
import { logger } from './logger';

/**
 * Account Service - Supabase operations for account/settings management
 * Extracted from UI components per TD-23.
 */

/** Load weekly digest enabled setting for a user (key-value schema) */
export async function loadWeeklyDigest(userId: string): Promise<boolean | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await supabase
      .from('user_settings')
      .select('value')
      .eq('user_id', userId)
      .eq('key', 'weekly_digest_enabled')
      .maybeSingle();

    if (error) {
      logger.error('[AccountService] Failed to load weekly digest:', error);
      return null;
    }

    return data?.value === true;
  } catch (error) {
    logger.error('[AccountService] Error loading weekly digest:', error);
    return null;
  }
}

/** Update weekly digest setting for a user (key-value schema). Returns true on success. */
export async function updateWeeklyDigest(userId: string, enabled: boolean): Promise<boolean> {
  if (!supabase) return false;

  try {
    const { error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: userId,
        key: 'weekly_digest_enabled',
        value: enabled,
        updated_at: new Date().toISOString(),
      }, { onConflict: 'user_id,key' });

    if (error) {
      logger.error('[AccountService] Failed to update weekly digest:', error);
      return false;
    }

    return true;
  } catch (error) {
    logger.error('[AccountService] Weekly digest update error:', error);
    return false;
  }
}

/** Update user profile display name in Supabase Auth. Returns true on success. */
export async function updateProfileName(name: string): Promise<boolean> {
  if (!supabase) return false;

  try {
    await supabase.auth.updateUser({ data: { full_name: name } });
    return true;
  } catch (error) {
    logger.error('[AccountService] Failed to update profile name:', error);
    return false;
  }
}

/** Delete user account via edge function + sign out. */
export async function deleteAccount(): Promise<{ success: boolean; error?: string }> {
  if (!supabase) return { success: false, error: 'Supabase not configured' };

  try {
    const { error } = await supabase.functions.invoke('delete-account');
    if (error) throw error;

    await supabase.auth.signOut();
    return { success: true };
  } catch (error) {
    logger.error('[AccountService] Delete account failed:', error);
    return { success: false, error: error instanceof Error ? error.message : 'Unknown error' };
  }
}
