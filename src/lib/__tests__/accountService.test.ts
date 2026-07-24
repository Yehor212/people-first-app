/**
 * Unit tests for AccountService
 * Tests account/settings operations against Supabase
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

// Dynamic mock for supabase — allows switching between null and configured
let mockSupabase: any = null;
const { mockGetCurrentSessionUserId, mockValidateSyncOwner, ownerState } = vi.hoisted(() => ({
  mockGetCurrentSessionUserId: vi.fn(),
  mockValidateSyncOwner: vi.fn(),
  ownerState: { current: 'user-123' },
}));

vi.mock('@/storage/sync/syncOwner', () => {
  class SyncOwnerBoundaryError extends Error {
    constructor(operation: string) {
      super(`${operation} stopped at an account boundary`);
      this.name = 'SyncOwnerBoundaryError';
    }
  }
  return {
    SyncOwnerBoundaryError,
    validateSyncOwner: mockValidateSyncOwner,
  };
});

vi.mock('../supabaseClient', () => ({
  get supabase() { return mockSupabase; },
  getCurrentSessionUserId: mockGetCurrentSessionUserId,
}));

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
  },
}));

import { logger } from '../logger';
import {
  updateProfileName,
  deleteAccount,
  resumeAccountDeletion,
} from '../accountService';

const DELETION_AUTHORITY = {
  operationId: '5bbbcf4f-3f44-4f3b-89eb-7f779c2ad85a',
  recoverySecret: 'AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA',
};

// Chainable mock builders for query builder pattern
const mockProfileEq = vi.fn();
const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileEq }));
const mockFrom = vi.fn((_table: string) => ({
  update: mockProfileUpdate,
}));

// Auth mocks
const mockUpdateUser = vi.fn();
const mockSignOut = vi.fn();
const mockInvoke = vi.fn();

function createSupabaseMock() {
  return {
    from: mockFrom,
    auth: {
      updateUser: mockUpdateUser,
      signOut: mockSignOut,
    },
    functions: {
      invoke: mockInvoke,
    },
  };
}

describe('accountService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = null;
    mockFrom.mockReset().mockImplementation(() => ({
      update: mockProfileUpdate,
    }));
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
    mockInvoke.mockReset();
    mockGetCurrentSessionUserId.mockReset().mockResolvedValue('user-123');
    ownerState.current = 'user-123';
    mockValidateSyncOwner.mockReset().mockImplementation(async (expectedOwnerUserId: string) => {
      if (ownerState.current !== expectedOwnerUserId) {
        const { SyncOwnerBoundaryError } = await import('@/storage/sync/syncOwner');
        throw new SyncOwnerBoundaryError('Profile name update');
      }
      return expectedOwnerUserId;
    });
    mockProfileEq.mockReset();
    mockProfileUpdate.mockReset().mockReturnValue({ eq: mockProfileEq });
  });

  describe('updateProfileName', () => {
    describe('when supabase is null', () => {
      it('returns false when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await updateProfileName('user-123', 'New Name');
        expect(result).toBe(false);
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns true when the owner-bound profile update succeeds', async () => {
        mockProfileEq.mockResolvedValue({ data: null, error: null });
        const result = await updateProfileName('user-123', 'John Doe');
        expect(result).toBe(true);
      });

      it('binds the profile row to the expected owner instead of mutating whichever auth session is current', async () => {
        mockProfileEq.mockResolvedValue({ data: null, error: null });

        await updateProfileName('user-123', 'John Doe');

        expect(mockFrom).toHaveBeenCalledWith('profiles');
        expect(mockProfileUpdate).toHaveBeenCalledWith({
          display_name: 'John Doe',
          updated_at: expect.any(String),
        });
        expect(mockProfileEq).toHaveBeenCalledWith('id', 'user-123');
        expect(mockUpdateUser).not.toHaveBeenCalled();
      });

      it('returns false when the bound profile update throws an exception', async () => {
        mockProfileEq.mockRejectedValue(new Error('Profile error'));
        const result = await updateProfileName('user-123', 'John Doe');
        expect(result).toBe(false);
      });

      it('returns false when the bound profile update resolves with an error', async () => {
        const authError = { message: 'Profile update rejected' };
        mockProfileEq.mockResolvedValue({ data: null, error: authError });

        const result = await updateProfileName('user-123', 'John Doe');

        expect(result).toBe(false);
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Failed to update profile name:',
          authError,
        );
      });

      it('logs error when the bound profile update throws', async () => {
        const error = new Error('Profile error');
        mockProfileEq.mockRejectedValue(error);
        await updateProfileName('user-123', 'John Doe');
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Failed to update profile name:',
          error
        );
      });

      it('rejects a delayed account A completion after the active owner becomes account B', async () => {
        let finishUpdate!: (result: { data: null; error: null }) => void;
        mockProfileEq.mockReturnValueOnce(
          new Promise((resolve) => {
            finishUpdate = resolve;
          }),
        );

        const updatePromise = updateProfileName('user-123', 'John Doe');
        await vi.waitFor(() => expect(mockProfileEq).toHaveBeenCalledTimes(1));
        ownerState.current = 'user-456';
        finishUpdate({ data: null, error: null });

        await expect(updatePromise).rejects.toMatchObject({
          name: 'SyncOwnerBoundaryError',
        });
        expect(mockUpdateUser).not.toHaveBeenCalled();
      });
    });
  });

  describe('deleteAccount', () => {
    describe('when supabase is null', () => {
      it('returns a not-configured result', async () => {
        mockSupabase = null;
        const result = await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(result).toEqual({ status: 'not-deleted', code: 'not-configured' });
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns deleted only when the edge function confirms deletion', async () => {
        mockInvoke.mockResolvedValue({
          data: { status: 'deleted', operationId: DELETION_AUTHORITY.operationId },
          error: null,
        });
        const result = await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(result).toEqual({ status: 'deleted', userId: 'user-123' });
      });

      it('calls functions.invoke with "delete-account"', async () => {
        mockInvoke.mockResolvedValue({
          data: { status: 'deleted', operationId: DELETION_AUTHORITY.operationId },
          error: null,
        });
        await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
          body: {
            expectedOwnerUserId: 'user-123',
            ...DELETION_AUTHORITY,
          },
          signal: expect.any(AbortSignal),
        });
      });

      it('does not mix local sign-out into the remote deletion service', async () => {
        mockInvoke.mockResolvedValue({
          data: { status: 'deleted', operationId: DELETION_AUTHORITY.operationId },
          error: null,
        });
        await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(mockSignOut).not.toHaveBeenCalled();
      });

      it('returns invoke-failed when invoke returns an error', async () => {
        const invokeError = new Error('Delete function failed');
        mockInvoke.mockResolvedValue({ error: invokeError });
        const result = await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(result).toEqual({ status: 'not-deleted', code: 'invoke-failed' });
      });

      it('returns invoke-failed when invoke throws', async () => {
        mockInvoke.mockRejectedValue(new Error('Network failure'));
        const result = await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(result).toEqual({ status: 'not-deleted', code: 'invoke-failed' });
      });

      it('bounds a deletion request that never settles and aborts its transport', async () => {
        vi.useFakeTimers();
        try {
          mockInvoke.mockImplementationOnce(
            () => new Promise(() => undefined),
          );

          const deletion = deleteAccount('user-123', DELETION_AUTHORITY);
          await vi.advanceTimersByTimeAsync(30_000);
          await Promise.resolve();

          const outcome = await Promise.race([
            deletion,
            Promise.resolve('still-pending' as const),
          ]);
          expect(outcome).toEqual({
            status: 'not-deleted',
            code: 'invoke-failed',
          });
          const options = mockInvoke.mock.calls[0]?.[1] as
            | { signal?: AbortSignal }
            | undefined;
          expect(options?.signal?.aborted).toBe(true);
        } finally {
          vi.useRealTimers();
        }
      });

      it('rejects an unconfirmed success payload', async () => {
        mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
        const result = await deleteAccount('user-123', DELETION_AUTHORITY);
        expect(result).toEqual({ status: 'not-deleted', code: 'invalid-response' });
      });

      it('never logs the recovery capability when deletion transport fails', async () => {
        const error = new Error(
          `Network failure for ${DELETION_AUTHORITY.recoverySecret}`,
        );
        mockInvoke.mockRejectedValue(error);
        await deleteAccount('user-123', DELETION_AUTHORITY);
        const serializedCalls = JSON.stringify(vi.mocked(logger.error).mock.calls);
        expect(serializedCalls).not.toContain(DELETION_AUTHORITY.recoverySecret);
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Delete account request failed',
          { code: 'invoke-failed' },
        );
      });

      it('does not invoke deletion after the authenticated owner changes', async () => {
        mockGetCurrentSessionUserId.mockResolvedValue('user-456');

        const result = await deleteAccount('user-123', DELETION_AUTHORITY);

        expect(result).toEqual({ status: 'not-deleted', code: 'owner-changed' });
        expect(mockInvoke).not.toHaveBeenCalled();
      });

      it('rejects a deleted response for any account other than the expected owner', async () => {
        mockInvoke.mockResolvedValue({
          data: {
            status: 'deleted',
            operationId: '8a2aa2b8-182c-4c9c-8ae2-afd70725bd18',
          },
          error: null,
        });

        const result = await deleteAccount('user-123', DELETION_AUTHORITY);

        expect(result).toEqual({ status: 'not-deleted', code: 'invalid-response' });
      });

      it('recovers a completed deletion by capability without reading the deleted session', async () => {
        mockGetCurrentSessionUserId.mockRejectedValue(
          new Error('deleted sessions cannot be refreshed'),
        );
        mockInvoke.mockResolvedValue({
          data: { status: 'deleted', operationId: DELETION_AUTHORITY.operationId },
          error: null,
        });

        const result = await resumeAccountDeletion(DELETION_AUTHORITY);

        expect(result).toEqual({ status: 'deleted' });
        expect(mockGetCurrentSessionUserId).not.toHaveBeenCalled();
        expect(mockInvoke).toHaveBeenCalledWith('resume-account-deletion', {
          body: DELETION_AUTHORITY,
          signal: expect.any(AbortSignal),
        });
      });

      it('keeps an active lease pending instead of fabricating completion', async () => {
        mockInvoke.mockResolvedValue({
          data: { status: 'pending', operationId: DELETION_AUTHORITY.operationId },
          error: null,
        });

        const result = await resumeAccountDeletion(DELETION_AUTHORITY);

        expect(result).toEqual({ status: 'not-deleted', code: 'pending' });
      });
    });
  });
});
