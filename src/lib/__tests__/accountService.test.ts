/**
 * Unit tests for AccountService
 * Tests account/settings operations against Supabase
 */

import { describe, expect, it, beforeEach, vi } from 'vitest';

// Dynamic mock for supabase — allows switching between null and configured
let mockSupabase: any = null;

vi.mock('../supabaseClient', () => ({
  get supabase() { return mockSupabase; },
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
const mockFrom = vi.fn((_table: string) => ({
  select: mockSelect,
  eq: mockEq,
  upsert: mockUpsert,
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
    }));
    mockUpdateUser.mockReset();
    mockSignOut.mockReset();
    mockInvoke.mockReset();
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
        const result = await updateProfileName('New Name');
        expect(result).toBe(false);
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns true when updateUser succeeds', async () => {
        mockUpdateUser.mockResolvedValue({ data: {}, error: null });
        const result = await updateProfileName('John Doe');
        expect(result).toBe(true);
      });

      it('calls auth.updateUser with full_name in data', async () => {
        mockUpdateUser.mockResolvedValue({ data: {}, error: null });
        await updateProfileName('John Doe');
        expect(mockUpdateUser).toHaveBeenCalledWith({ data: { full_name: 'John Doe' } });
      });

      it('returns false when updateUser throws an exception', async () => {
        mockUpdateUser.mockRejectedValue(new Error('Auth error'));
        const result = await updateProfileName('John Doe');
        expect(result).toBe(false);
      });

      it('logs error when updateUser throws', async () => {
        const error = new Error('Auth error');
        mockUpdateUser.mockRejectedValue(error);
        await updateProfileName('John Doe');
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Failed to update profile name:',
          error
        );
      });
    });
  });

  describe('deleteAccount', () => {
    describe('when supabase is null', () => {
      it('returns failure with specific error message', async () => {
        mockSupabase = null;
        const result = await deleteAccount();
        expect(result).toEqual({ success: false, error: 'Supabase not configured' });
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns success true when invoke and signOut succeed', async () => {
        mockInvoke.mockResolvedValue({ error: null });
        mockSignOut.mockResolvedValue({ error: null });
        const result = await deleteAccount();
        expect(result).toEqual({ success: true });
      });

      it('calls functions.invoke with "delete-account"', async () => {
        mockInvoke.mockResolvedValue({ error: null });
        mockSignOut.mockResolvedValue({ error: null });
        await deleteAccount();
        expect(mockInvoke).toHaveBeenCalledWith('delete-account');
      });

      it('calls auth.signOut after successful invoke', async () => {
        mockInvoke.mockResolvedValue({ error: null });
        mockSignOut.mockResolvedValue({ error: null });
        await deleteAccount();
        expect(mockSignOut).toHaveBeenCalled();
      });

      it('returns failure when invoke returns an error', async () => {
        const invokeError = new Error('Delete function failed');
        mockInvoke.mockResolvedValue({ error: invokeError });
        const result = await deleteAccount();
        expect(result).toEqual({ success: false, error: 'Delete function failed' });
      });

      it('does not call signOut when invoke fails', async () => {
        mockInvoke.mockResolvedValue({ error: new Error('Delete function failed') });
        await deleteAccount();
        expect(mockSignOut).not.toHaveBeenCalled();
      });

      it('returns failure when invoke throws', async () => {
        mockInvoke.mockRejectedValue(new Error('Network failure'));
        const result = await deleteAccount();
        expect(result).toEqual({ success: false, error: 'Network failure' });
      });

      it('returns "Unknown error" for non-Error exceptions', async () => {
        mockInvoke.mockRejectedValue('string error');
        const result = await deleteAccount();
        expect(result).toEqual({ success: false, error: 'Unknown error' });
      });

      it('logs error when delete fails', async () => {
        const error = new Error('Network failure');
        mockInvoke.mockRejectedValue(error);
        await deleteAccount();
        expect(logger.error).toHaveBeenCalledWith(
          '[AccountService] Delete account failed:',
          error
        );
      });
    });
  });
});
