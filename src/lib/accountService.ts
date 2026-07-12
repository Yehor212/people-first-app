import { getCurrentSessionUserId, supabase } from './supabaseClient';
import { logger } from './logger';
import { SyncOwnerBoundaryError, validateSyncOwner } from '@/storage/sync/syncOwner';

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

/** Update the explicitly owned profile row. Returns true on success. */
export async function updateProfileName(
  expectedOwnerUserId: string,
  name: string,
): Promise<boolean> {
  if (!supabase || !expectedOwnerUserId.trim()) return false;

  try {
    await validateSyncOwner(expectedOwnerUserId, 'Profile name update');
    // Auth.updateUser mutates whichever session the SDK considers current when
    // its internal request executes. The profiles row is explicitly bound to
    // the owner captured by the Settings action, and RLS fails closed.
    const { error } = await supabase
      .from('profiles')
      .update({
        display_name: name,
        updated_at: new Date().toISOString(),
      })
      .eq('id', expectedOwnerUserId);
    await validateSyncOwner(expectedOwnerUserId, 'Profile name update');
    if (error) {
      logger.error('[AccountService] Failed to update profile name:', error);
      return false;
    }
    return true;
  } catch (error) {
    if (error instanceof SyncOwnerBoundaryError) throw error;
    logger.error('[AccountService] Failed to update profile name:', error);
    return false;
  }
}

export type RemoteAccountDeletionResult =
  | { status: 'deleted'; userId: string }
  | {
      status: 'not-deleted';
      code: 'not-configured' | 'invoke-failed' | 'invalid-response' | 'owner-changed';
    };

/** Delete the remote account via the edge function. Client cleanup is a separate boundary. */
export async function deleteAccount(
  expectedOwnerUserId: string,
): Promise<RemoteAccountDeletionResult> {
  if (!supabase) return { status: 'not-deleted', code: 'not-configured' };
  if (!expectedOwnerUserId.trim()) return { status: 'not-deleted', code: 'owner-changed' };

  try {
    if ((await getCurrentSessionUserId()) !== expectedOwnerUserId) {
      return { status: 'not-deleted', code: 'owner-changed' };
    }

    const { data, error } = await supabase.functions.invoke('delete-account', {
      body: { expectedOwnerUserId },
    });
    if (error) throw error;

    if (
      !data ||
      typeof data !== 'object' ||
      !('status' in data) ||
      data.status !== 'deleted' ||
      !('userId' in data) ||
      data.userId !== expectedOwnerUserId
    ) {
      logger.error('[AccountService] Delete account returned an unconfirmed response');
      return { status: 'not-deleted', code: 'invalid-response' };
    }

    return { status: 'deleted', userId: expectedOwnerUserId };
  } catch (error) {
    logger.error('[AccountService] Delete account failed:', error);
    return { status: 'not-deleted', code: 'invoke-failed' };
  }
}
