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
  loadWeeklyDigest,
  updateWeeklyDigest,
  updateProfileName,
  deleteAccount,
} from '../accountService';

// Chainable mock builders for query builder pattern
const mockMaybeSingle = vi.fn();
const mockEq = vi.fn(() => ({ eq: mockEq, maybeSingle: mockMaybeSingle }));
const mockSelect = vi.fn(() => ({ eq: mockEq }));
const mockUpsert = vi.fn();
const mockProfileEq = vi.fn();
const mockProfileUpdate = vi.fn(() => ({ eq: mockProfileEq }));
const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  eq: mockEq,
  upsert: mockUpsert,
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
    mockMaybeSingle.mockReset();
    mockEq.mockReset().mockReturnValue({ eq: mockEq, maybeSingle: mockMaybeSingle });
    mockSelect.mockReset().mockReturnValue({ eq: mockEq });
    mockUpsert.mockReset();
    mockFrom.mockReset().mockImplementation(() => ({
      select: mockSelect,
      eq: mockEq,
      upsert: mockUpsert,
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

  describe('loadWeeklyDigest', () => {
    describe('when supabase is null', () => {
      it('returns null when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBeNull();
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('queries user_settings with key-value pattern', async () => {
        mockMaybeSingle.mockResolvedValue({ data: { value: true }, error: null });
        await loadWeeklyDigest('user-123');
        expect(mockFrom).toHaveBeenCalledWith('user_settings');
        expect(mockSelect).toHaveBeenCalledWith('value');
        expect(mockEq).toHaveBeenCalledWith('user_id', 'user-123');
        expect(mockEq).toHaveBeenCalledWith('key', 'weekly_digest_enabled');
      });

      it('returns true when value is true', async () => {
        mockMaybeSingle.mockResolvedValue({ data: { value: true }, error: null });
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBe(true);
      });

      it('returns false when value is false', async () => {
        mockMaybeSingle.mockResolvedValue({ data: { value: false }, error: null });
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBe(false);
      });

      it('returns false when data is null (no settings row)', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: null });
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBe(false);
      });

      it('returns null when query returns an error', async () => {
        mockMaybeSingle.mockResolvedValue({ data: null, error: { message: 'Query failed' } });
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBeNull();
      });

      it('logs error when query returns an error', async () => {
        const queryError = { message: 'Query failed' };
        mockMaybeSingle.mockResolvedValue({ data: null, error: queryError });
        await loadWeeklyDigest('user-123');
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Failed to load weekly digest:',
          queryError
        );
      });

      it('returns null when an exception is thrown', async () => {
        mockMaybeSingle.mockRejectedValue(new Error('Network error'));
        const result = await loadWeeklyDigest('user-123');
        expect(result).toBeNull();
      });

      it('logs error when an exception is thrown', async () => {
        const error = new Error('Network error');
        mockMaybeSingle.mockRejectedValue(error);
        await loadWeeklyDigest('user-123');
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Error loading weekly digest:',
          error
        );
      });
    });
  });

  describe('updateWeeklyDigest', () => {
    describe('when supabase is null', () => {
      it('returns false when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await updateWeeklyDigest('user-123', true);
        expect(result).toBe(false);
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns true when upsert succeeds', async () => {
        mockUpsert.mockResolvedValue({ error: null });
        const result = await updateWeeklyDigest('user-123', true);
        expect(result).toBe(true);
      });

      it('calls from with user_settings table', async () => {
        mockUpsert.mockResolvedValue({ error: null });
        await updateWeeklyDigest('user-123', true);
        expect(mockFrom).toHaveBeenCalledWith('user_settings');
      });

      it('passes correct key-value data with onConflict option', async () => {
        mockUpsert.mockResolvedValue({ error: null });
        await updateWeeklyDigest('user-456', false);
        expect(mockUpsert).toHaveBeenCalledWith(
          expect.objectContaining({
            user_id: 'user-456',
            key: 'weekly_digest_enabled',
            value: false,
            updated_at: expect.any(String),
          }),
          { onConflict: 'user_id,key' }
        );
      });

      it('includes ISO timestamp in updated_at', async () => {
        mockUpsert.mockResolvedValue({ error: null });
        await updateWeeklyDigest('user-123', true);
        const call = mockUpsert.mock.calls[0];
        const updatedAt = call[0].updated_at;
        // Should be valid ISO string
        expect(() => new Date(updatedAt).toISOString()).not.toThrow();
      });

      it('returns false when upsert returns an error', async () => {
        mockUpsert.mockResolvedValue({ error: { message: 'Upsert failed' } });
        const result = await updateWeeklyDigest('user-123', true);
        expect(result).toBe(false);
      });

      it('logs error when upsert fails', async () => {
        const upsertError = { message: 'Upsert failed' };
        mockUpsert.mockResolvedValue({ error: upsertError });
        await updateWeeklyDigest('user-123', true);
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Failed to update weekly digest:',
          upsertError
        );
      });

      it('returns false when an exception is thrown', async () => {
        mockUpsert.mockRejectedValue(new Error('Network error'));
        const result = await updateWeeklyDigest('user-123', true);
        expect(result).toBe(false);
      });
    });
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
        const result = await deleteAccount('user-123');
        expect(result).toEqual({ status: 'not-deleted', code: 'not-configured' });
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns deleted only when the edge function confirms deletion', async () => {
        mockInvoke.mockResolvedValue({ data: { status: 'deleted', userId: 'user-123' }, error: null });
        const result = await deleteAccount('user-123');
        expect(result).toEqual({ status: 'deleted', userId: 'user-123' });
      });

      it('calls functions.invoke with "delete-account"', async () => {
        mockInvoke.mockResolvedValue({ data: { status: 'deleted', userId: 'user-123' }, error: null });
        await deleteAccount('user-123');
        expect(mockInvoke).toHaveBeenCalledWith('delete-account', {
          body: { expectedOwnerUserId: 'user-123' },
        });
      });

      it('does not mix local sign-out into the remote deletion service', async () => {
        mockInvoke.mockResolvedValue({ data: { status: 'deleted', userId: 'user-123' }, error: null });
        await deleteAccount('user-123');
        expect(mockSignOut).not.toHaveBeenCalled();
      });

      it('returns invoke-failed when invoke returns an error', async () => {
        const invokeError = new Error('Delete function failed');
        mockInvoke.mockResolvedValue({ error: invokeError });
        const result = await deleteAccount('user-123');
        expect(result).toEqual({ status: 'not-deleted', code: 'invoke-failed' });
      });

      it('returns invoke-failed when invoke throws', async () => {
        mockInvoke.mockRejectedValue(new Error('Network failure'));
        const result = await deleteAccount('user-123');
        expect(result).toEqual({ status: 'not-deleted', code: 'invoke-failed' });
      });

      it('rejects an unconfirmed success payload', async () => {
        mockInvoke.mockResolvedValue({ data: { ok: true }, error: null });
        const result = await deleteAccount('user-123');
        expect(result).toEqual({ status: 'not-deleted', code: 'invalid-response' });
      });

      it('logs error when delete fails', async () => {
        const error = new Error('Network failure');
        mockInvoke.mockRejectedValue(error);
        await deleteAccount('user-123');
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Delete account failed:',
          error
        );
      });

      it('does not invoke deletion after the authenticated owner changes', async () => {
        mockGetCurrentSessionUserId.mockResolvedValue('user-456');

        const result = await deleteAccount('user-123');

        expect(result).toEqual({ status: 'not-deleted', code: 'owner-changed' });
        expect(mockInvoke).not.toHaveBeenCalled();
      });

      it('rejects a deleted response for any account other than the expected owner', async () => {
        mockInvoke.mockResolvedValue({
          data: { status: 'deleted', userId: 'user-456' },
          error: null,
        });

        const result = await deleteAccount('user-123');

        expect(result).toEqual({ status: 'not-deleted', code: 'invalid-response' });
      });
    });
  });
});
