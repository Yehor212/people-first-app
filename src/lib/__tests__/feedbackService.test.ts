/**
 * Unit tests for FeedbackService
 * Tests quick feedback and detailed feedback submission to Supabase
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
import { submitQuickFeedback, submitDetailedFeedback } from '../feedbackService';

// Chainable mock builders
const mockInsert = vi.fn();
const mockFrom = vi.fn(() => ({ insert: mockInsert }));
const mockInvoke = vi.fn();

function createSupabaseMock() {
  return {
    from: mockFrom,
    functions: { invoke: mockInvoke },
  };
}

const quickFeedbackData = {
  type: 'bug',
  message: 'Something broke',
  app_version: '1.0.0',
  platform: 'android',
  user_agent: 'test-agent',
  created_at: '2026-02-17T00:00:00Z',
};

const detailedFeedbackData = {
  category: 'feature-request',
  message: 'Please add dark mode',
  email: 'user@example.com',
  device_info: { os: 'android', version: '14' },
  app_version: '1.0.0',
};

describe('feedbackService', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mockSupabase = null;
    mockInsert.mockReset();
    mockFrom.mockReset().mockReturnValue({ insert: mockInsert });
    mockInvoke.mockReset();
  });

  describe('submitQuickFeedback', () => {
    describe('when supabase is null', () => {
      it('returns false when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await submitQuickFeedback(quickFeedbackData);
        expect(result).toBe(false);
      });

      it('does not attempt any database operations', async () => {
        mockSupabase = null;
        await submitQuickFeedback(quickFeedbackData);
        expect(mockFrom).not.toHaveBeenCalled();
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns true when insert succeeds', async () => {
        mockInsert.mockResolvedValue({ error: null });
        const result = await submitQuickFeedback(quickFeedbackData);
        expect(result).toBe(true);
      });

      it('calls from with correct table name "feedback"', async () => {
        mockInsert.mockResolvedValue({ error: null });
        await submitQuickFeedback(quickFeedbackData);
        expect(mockFrom).toHaveBeenCalledWith('feedback');
      });

      it('maps QuickFeedbackData fields to feedback table schema', async () => {
        mockInsert.mockResolvedValue({ error: null });
        await submitQuickFeedback(quickFeedbackData);
        expect(mockInsert).toHaveBeenCalledWith({
          category: 'bug',
          message: 'Something broke',
          app_version: '1.0.0',
          device_info: {
            platform: 'android',
            userAgent: 'test-agent',
          },
        });
      });

      it('returns false when insert returns an error', async () => {
        mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } });
        const result = await submitQuickFeedback(quickFeedbackData);
        expect(result).toBe(false);
      });

      it('logs a warning when insert returns an error', async () => {
        mockInsert.mockResolvedValue({ error: { message: 'Insert failed' } });
        await submitQuickFeedback(quickFeedbackData);
        expect(logger.warn).toHaveBeenCalledWith(
          '[FeedbackService] Quick feedback error:',
          'Insert failed'
        );
      });
    });
  });

  describe('submitDetailedFeedback', () => {
    describe('when supabase is null', () => {
      it('returns false when supabase is not configured', async () => {
        mockSupabase = null;
        const result = await submitDetailedFeedback(detailedFeedbackData);
        expect(result).toBe(false);
      });
    });

    describe('when supabase is configured', () => {
      beforeEach(() => {
        mockSupabase = createSupabaseMock();
      });

      it('returns true when insert succeeds', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockResolvedValue({ error: null });
        const result = await submitDetailedFeedback(detailedFeedbackData);
        expect(result).toBe(true);
      });

      it('calls from with correct table name "feedback"', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockResolvedValue({ error: null });
        await submitDetailedFeedback(detailedFeedbackData);
        expect(mockFrom).toHaveBeenCalledWith('feedback');
      });

      it('passes structured data to insert', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockResolvedValue({ error: null });
        await submitDetailedFeedback(detailedFeedbackData);
        expect(mockInsert).toHaveBeenCalledWith({
          category: detailedFeedbackData.category,
          message: detailedFeedbackData.message,
          email: detailedFeedbackData.email,
          device_info: detailedFeedbackData.device_info,
          app_version: detailedFeedbackData.app_version,
        });
      });

      it('returns false when insert returns an error', async () => {
        mockInsert.mockResolvedValue({
          error: { code: '42P01', message: 'Table not found', details: null, hint: null },
        });
        const result = await submitDetailedFeedback(detailedFeedbackData);
        expect(result).toBe(false);
      });

      it('logs error details when insert fails', async () => {
        const insertError = { code: '42P01', message: 'Table not found', details: 'no details', hint: 'check name' };
        mockInsert.mockResolvedValue({ error: insertError });
        await submitDetailedFeedback(detailedFeedbackData);
        expect(logger.error).toHaveBeenCalledWith(
          '[FeedbackService] Detailed feedback error:',
          { code: '42P01', message: 'Table not found', details: 'no details', hint: 'check name' }
        );
      });

      it('fires send-feedback-email invoke after successful insert', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockResolvedValue({ error: null });
        await submitDetailedFeedback(detailedFeedbackData);
        expect(mockInvoke).toHaveBeenCalledWith('send-feedback-email', {
          body: detailedFeedbackData,
        });
      });

      it('logs success message after insert succeeds', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockResolvedValue({ error: null });
        await submitDetailedFeedback(detailedFeedbackData);
        expect(logger.log).toHaveBeenCalledWith('[FeedbackService] Feedback sent to Supabase');
      });

      it('returns true even if email invoke fails', async () => {
        mockInsert.mockResolvedValue({ error: null });
        mockInvoke.mockRejectedValue(new Error('Email service down'));
        const result = await submitDetailedFeedback(detailedFeedbackData);
        // The email is fire-and-forget (non-blocking), so insert success = true
        expect(result).toBe(true);
      });

      it('returns false when an exception is thrown during insert', async () => {
        mockInsert.mockRejectedValue(new Error('Network error'));
        const result = await submitDetailedFeedback(detailedFeedbackData);
        expect(result).toBe(false);
      });

      it('logs exception when insert throws', async () => {
        const error = new Error('Network error');
        mockInsert.mockRejectedValue(error);
        await submitDetailedFeedback(detailedFeedbackData);
        expect(logger.error).toHaveBeenCalledWith('[FeedbackService] Exception:', error);
      });
    });
  });
});
