import { getCurrentSessionUserId, supabase } from './supabaseClient';
import { logger } from './logger';
import { SyncOwnerBoundaryError, validateSyncOwner } from '@/storage/sync/syncOwner';
import {
  type AccountDeletionCapability,
  isAccountDeletionCapability,
} from './accountDeletionCapability';

/**
 * Account Service - Supabase operations for account/settings management
 * Extracted from UI components per TD-23.
 */

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
      code:
        | 'not-configured'
        | 'invoke-failed'
        | 'invalid-response'
        | 'owner-changed'
        | 'pending';
    };

export type RemoteAccountDeletionRecoveryResult =
  | { status: 'deleted' }
  | Extract<RemoteAccountDeletionResult, { status: 'not-deleted' }>;

const ACCOUNT_DELETION_REQUEST_TIMEOUT_MS = 30_000;

async function invokeAccountDeletionFunction(
  functionName: 'delete-account' | 'resume-account-deletion',
  body: Record<string, unknown>,
) {
  if (!supabase) throw new Error('Account deletion is not configured');
  const controller = new AbortController();
  let timeoutId: ReturnType<typeof setTimeout> | undefined;
  const deadline = new Promise<never>((_resolve, reject) => {
    timeoutId = setTimeout(() => {
      controller.abort();
      reject(new Error('Account deletion request timed out'));
    }, ACCOUNT_DELETION_REQUEST_TIMEOUT_MS);
  });

  try {
    return await Promise.race([
      supabase.functions.invoke(functionName, {
        body,
        signal: controller.signal,
      }),
      deadline,
    ]);
  } finally {
    if (timeoutId !== undefined) clearTimeout(timeoutId);
  }
}

function readOperationResult(
  data: unknown,
  capability: AccountDeletionCapability,
): 'deleted' | 'pending' | 'invalid' {
  if (!data || typeof data !== 'object') return 'invalid';
  const response = data as { status?: unknown; operationId?: unknown };
  if (response.operationId !== capability.operationId) return 'invalid';
  if (response.status === 'deleted') return 'deleted';
  if (response.status === 'pending') return 'pending';
  return 'invalid';
}

/** Delete the remote account via the edge function. Client cleanup is a separate boundary. */
export async function deleteAccount(
  expectedOwnerUserId: string,
  capability: AccountDeletionCapability,
): Promise<RemoteAccountDeletionResult> {
  if (!supabase) return { status: 'not-deleted', code: 'not-configured' };
  if (!expectedOwnerUserId.trim() || !isAccountDeletionCapability(capability)) {
    return { status: 'not-deleted', code: 'owner-changed' };
  }

  try {
    if ((await getCurrentSessionUserId()) !== expectedOwnerUserId) {
      return { status: 'not-deleted', code: 'owner-changed' };
    }

    const { data, error } = await invokeAccountDeletionFunction(
      'delete-account',
      { expectedOwnerUserId, ...capability },
    );
    if (error) throw error;

    const result = readOperationResult(data, capability);
    if (result === 'pending') {
      return { status: 'not-deleted', code: 'pending' };
    }
    if (result !== 'deleted') {
      logger.error('[AccountService] Delete account returned an unconfirmed response');
      return { status: 'not-deleted', code: 'invalid-response' };
    }

    return { status: 'deleted', userId: expectedOwnerUserId };
  } catch {
    logger.error('[AccountService] Delete account request failed', {
      code: 'invoke-failed',
    });
    return { status: 'not-deleted', code: 'invoke-failed' };
  }
}

/** Continue only an operation that was already bound by an authenticated call. */
export async function resumeAccountDeletion(
  capability: AccountDeletionCapability,
): Promise<RemoteAccountDeletionRecoveryResult> {
  if (!supabase) return { status: 'not-deleted', code: 'not-configured' };
  if (!isAccountDeletionCapability(capability)) {
    return { status: 'not-deleted', code: 'invalid-response' };
  }

  try {
    const { data, error } = await invokeAccountDeletionFunction(
      'resume-account-deletion',
      { ...capability },
    );
    if (error) throw error;

    const result = readOperationResult(data, capability);
    if (result === 'deleted') return { status: 'deleted' };
    if (result === 'pending') return { status: 'not-deleted', code: 'pending' };
    return { status: 'not-deleted', code: 'invalid-response' };
  } catch {
    logger.error('[AccountService] Account deletion recovery request failed', {
      code: 'invoke-failed',
    });
    return { status: 'not-deleted', code: 'invoke-failed' };
  }
}
