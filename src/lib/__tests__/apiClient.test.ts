/**
 * Unit tests for API Client
 * Tests 401 detection, auth retry logic, and session management
 */

import { describe, expect, it, beforeEach, vi, afterEach } from 'vitest';

// Mock platform to skip BroadcastChannel init (isNative = true skips it)
vi.mock('@/lib/platform', () => ({
  isNative: true,
}));

// Dynamic mock for supabase
let mockSupabase: any = null;

vi.mock('../supabaseClient', () => ({
  get supabase() { return mockSupabase; },
}));

vi.mock('../logger', () => ({
  logger: {
    warn: vi.fn(),
    error: vi.fn(),
    log: vi.fn(),
    debug: vi.fn(),
  },
}));

import {
  is401Error,
  withAuthRetry,
  ensureAuthenticated,
  AUTH_SESSION_EXPIRED_EVENT,
} from '../apiClient';

// Auth mocks
const mockRefreshSession = vi.fn();
const mockGetUser = vi.fn();
const mockGetSession = vi.fn();

function createSupabaseMock() {
  return {
    auth: {
      refreshSession: mockRefreshSession,
      getUser: mockGetUser,
      getSession: mockGetSession,
    },
  };
}

describe('apiClient', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = null;
    mockRefreshSession.mockReset();
    mockGetUser.mockReset();
    mockGetSession.mockReset();
  });

  afterEach(() => {
    mockSupabase = null;
  });

  describe('AUTH_SESSION_EXPIRED_EVENT', () => {
    it('exports the correct event name', () => {
      expect(AUTH_SESSION_EXPIRED_EVENT).toBe('auth:session-expired');
    });
  });

  describe('is401Error', () => {
    describe('falsy values', () => {
      it('returns false for null', () => {
        expect(is401Error(null)).toBe(false);
      });

      it('returns false for undefined', () => {
        expect(is401Error(undefined)).toBe(false);
      });

      it('returns false for false', () => {
        expect(is401Error(false)).toBe(false);
      });

      it('returns false for 0', () => {
        expect(is401Error(0)).toBe(false);
      });

      it('returns false for empty string', () => {
        expect(is401Error('')).toBe(false);
      });
    });

    describe('HTTP status code detection', () => {
      it('returns true for status 401', () => {
        expect(is401Error({ status: 401 })).toBe(true);
      });

      it('returns false for status 200', () => {
        expect(is401Error({ status: 200 })).toBe(false);
      });

      it('returns false for status 403', () => {
        expect(is401Error({ status: 403 })).toBe(false);
      });

      it('returns false for status 500', () => {
        expect(is401Error({ status: 500 })).toBe(false);
      });
    });

    describe('PostgREST error code detection', () => {
      it('returns true for PGRST301 (JWT expired)', () => {
        expect(is401Error({ code: 'PGRST301' })).toBe(true);
      });

      it('returns true for PGRST302 (JWT invalid)', () => {
        expect(is401Error({ code: 'PGRST302' })).toBe(true);
      });

      it('returns false for PGRST116 (not a 401 code)', () => {
        expect(is401Error({ code: 'PGRST116' })).toBe(false);
      });

      it('returns false for arbitrary code', () => {
        expect(is401Error({ code: 'SOME_OTHER' })).toBe(false);
      });
    });

    describe('error message pattern detection', () => {
      it('returns true for "jwt expired"', () => {
        expect(is401Error({ message: 'jwt expired' })).toBe(true);
      });

      it('returns true for "JWT expired" (case insensitive)', () => {
        expect(is401Error({ message: 'JWT expired' })).toBe(true);
      });

      it('returns true for "jwt invalid"', () => {
        expect(is401Error({ message: 'jwt invalid' })).toBe(true);
      });

      it('returns true for "not authenticated"', () => {
        expect(is401Error({ message: 'not authenticated' })).toBe(true);
      });

      it('returns true for "invalid token"', () => {
        expect(is401Error({ message: 'invalid token' })).toBe(true);
      });

      it('returns true for "token expired"', () => {
        expect(is401Error({ message: 'token expired' })).toBe(true);
      });

      it('returns true for message containing pattern in longer text', () => {
        expect(is401Error({ message: 'Error: jwt expired at some point' })).toBe(true);
      });

      it('returns false for "some other error"', () => {
        expect(is401Error({ message: 'some other error' })).toBe(false);
      });

      it('returns false for "permission denied"', () => {
        expect(is401Error({ message: 'permission denied' })).toBe(false);
      });
    });

    describe('edge cases', () => {
      it('returns false for empty object', () => {
        expect(is401Error({})).toBe(false);
      });

      it('returns false for a string value', () => {
        expect(is401Error('jwt expired')).toBe(false);
      });

      it('returns false for a number', () => {
        expect(is401Error(401)).toBe(false);
      });

      it('returns true when multiple indicators are present', () => {
        expect(is401Error({ status: 401, code: 'PGRST301', message: 'jwt expired' })).toBe(true);
      });

      it('returns true for status 401 even with non-auth message', () => {
        expect(is401Error({ status: 401, message: 'random error' })).toBe(true);
      });
    });
  });

  describe('withAuthRetry', () => {
    beforeEach(() => {
      mockSupabase = createSupabaseMock();
      // Default: getSession returns no session (allows notifySessionExpired to dispatch)
      mockGetSession.mockResolvedValue({ data: { session: null } });
    });

    it('returns result when operation succeeds on first try', async () => {
      const operation = vi.fn().mockResolvedValue('success');
      const result = await withAuthRetry(operation, 'test-op');
      expect(result).toBe('success');
      expect(operation).toHaveBeenCalledTimes(1);
    });

    it('rethrows non-401 errors without retry', async () => {
      const error = new Error('Network error');
      const operation = vi.fn().mockRejectedValue(error);
      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow('Network error');
      expect(operation).toHaveBeenCalledTimes(1);
      expect(mockRefreshSession).not.toHaveBeenCalled();
    });

    it('attempts token refresh on 401 error', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ status: 401 })
        .mockResolvedValueOnce('retried');
      mockRefreshSession.mockResolvedValue({ data: { session: {} }, error: null });

      const result = await withAuthRetry(operation, 'test-op');
      expect(result).toBe('retried');
      expect(mockRefreshSession).toHaveBeenCalled();
      expect(operation).toHaveBeenCalledTimes(2);
    });

    it('retries operation after successful refresh', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ code: 'PGRST301' })
        .mockResolvedValueOnce({ data: 'refreshed data' });
      mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'new' } }, error: null });

      const result = await withAuthRetry(operation, 'test-op');
      expect(result).toEqual({ data: 'refreshed data' });
    });

    it('dispatches session expired event when refresh fails', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const operation = vi.fn().mockRejectedValue({ status: 401 });
      mockRefreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'Refresh failed' } });

      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow('Session expired');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: AUTH_SESSION_EXPIRED_EVENT })
      );
      dispatchSpy.mockRestore();
    });

    it('dispatches session expired when retry also returns 401', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      const operation = vi.fn().mockRejectedValue({ status: 401 });
      mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'new' } }, error: null });

      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow('Session expired');
      expect(dispatchSpy).toHaveBeenCalledWith(
        expect.objectContaining({ type: AUTH_SESSION_EXPIRED_EVENT })
      );
      dispatchSpy.mockRestore();
    });

    it('rethrows non-401 error on retry', async () => {
      const operation = vi.fn()
        .mockRejectedValueOnce({ status: 401 })
        .mockRejectedValueOnce(new Error('Different error on retry'));
      mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'new' } }, error: null });

      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow('Different error on retry');
    });

    it('throws "Session expired" message when refresh fails', async () => {
      const operation = vi.fn().mockRejectedValue({ message: 'jwt expired' });
      mockRefreshSession.mockResolvedValue({ data: { session: null }, error: { message: 'No refresh token' } });
      mockGetSession.mockResolvedValue({ data: { session: null } });

      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow(
        'Session expired. Please sign in again.'
      );
    });

    it('uses default operation name when not provided', async () => {
      const operation = vi.fn().mockResolvedValue('ok');
      const result = await withAuthRetry(operation);
      expect(result).toBe('ok');
    });

    it('does not dispatch session expired if getSession still shows valid session', async () => {
      const dispatchSpy = vi.spyOn(window, 'dispatchEvent');
      // Refresh fails but session is still valid (edge case)
      const operation = vi.fn()
        .mockRejectedValueOnce({ status: 401 })
        .mockRejectedValueOnce({ status: 401 });
      mockRefreshSession.mockResolvedValue({ data: { session: { access_token: 'valid' } }, error: null });
      // notifySessionExpired will check getSession — if valid, it won't dispatch
      mockGetSession.mockResolvedValue({ data: { session: { access_token: 'still-valid' } } });

      await expect(withAuthRetry(operation, 'test-op')).rejects.toThrow('Session expired');
      // dispatchEvent should NOT have been called with session expired because getSession showed valid session
      const sessionExpiredCalls = dispatchSpy.mock.calls.filter(
        call => (call[0] as CustomEvent).type === AUTH_SESSION_EXPIRED_EVENT
      );
      expect(sessionExpiredCalls).toHaveLength(0);
      dispatchSpy.mockRestore();
    });
  });

  describe('ensureAuthenticated', () => {
    describe('when supabase is null', () => {
      it('returns null when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns user id when getUser succeeds', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: { id: 'user-abc-123' } },
          error: null,
        });
        const result = await ensureAuthenticated();
        expect(result).toBe('user-abc-123');
      });

      it('returns null when getUser returns no user', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: null,
        });
        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });

      it('returns null when getUser returns a non-401 error', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { message: 'Some other error', status: 500 },
        });
        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });

      it('attempts refresh when getUser returns 401 error', async () => {
        mockGetUser.mockResolvedValueOnce({
          data: { user: null },
          error: { status: 401 },
        }).mockResolvedValueOnce({
          data: { user: { id: 'refreshed-user' } },
          error: null,
        });
        mockRefreshSession.mockResolvedValue({
          data: { session: { access_token: 'new-token' } },
          error: null,
        });

        const result = await ensureAuthenticated();
        expect(result).toBe('refreshed-user');
        expect(mockRefreshSession).toHaveBeenCalled();
      });

      it('returns refreshed user id after successful refresh', async () => {
        mockGetUser.mockResolvedValueOnce({
          data: { user: null },
          error: { code: 'PGRST301' },
        }).mockResolvedValueOnce({
          data: { user: { id: 'user-after-refresh' } },
          error: null,
        });
        mockRefreshSession.mockResolvedValue({
          data: { session: { access_token: 'refreshed' } },
          error: null,
        });

        const result = await ensureAuthenticated();
        expect(result).toBe('user-after-refresh');
      });

      it('returns null when 401 refresh fails', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: null },
          error: { status: 401 },
        });
        mockRefreshSession.mockResolvedValue({
          data: { session: null },
          error: { message: 'Refresh failed' },
        });

        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });

      it('returns null when getUser after refresh returns no user', async () => {
        mockGetUser.mockResolvedValueOnce({
          data: { user: null },
          error: { status: 401 },
        }).mockResolvedValueOnce({
          data: { user: null },
          error: null,
        });
        mockRefreshSession.mockResolvedValue({
          data: { session: { access_token: 'new' } },
          error: null,
        });

        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });

      it('returns null when an exception is thrown', async () => {
        mockGetUser.mockRejectedValue(new Error('Network error'));
        const result = await ensureAuthenticated();
        expect(result).toBeNull();
      });

      it('calls getUser on supabase.auth', async () => {
        mockGetUser.mockResolvedValue({
          data: { user: { id: 'test-user' } },
          error: null,
        });
        await ensureAuthenticated();
        expect(mockGetUser).toHaveBeenCalled();
      });
    });
  });
});
