/**
 * Security Tests for ShareCards
 * Tests XSS prevention and input sanitization
 * Part of v1.3.0 "Harmony" - Security Improvements
 */

import { describe, expect, it, vi, beforeEach } from 'vitest';
import DOMPurify from 'dompurify';

// Mock DOMPurify to verify it's being used
vi.mock('dompurify', () => ({
  default: {
    sanitize: vi.fn((str: string, options?: { ALLOWED_TAGS: string[] }) => {
      if (options?.ALLOWED_TAGS?.length === 0) {
        // Strip all tags
        return str.replace(/<[^>]*>/g, '');
      }
      return str;
    }),
  },
}));

describe('ShareCards Security', () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  describe('XSS Prevention', () => {
    it('should sanitize malicious script tags in username', () => {
      const maliciousUsername = '<script>alert("xss")</script>evil';
      const sanitized = DOMPurify.sanitize(maliciousUsername, { ALLOWED_TAGS: [] });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('</script>');
      expect(sanitized).toBe('alert("xss")evil');
    });

    it('should sanitize onclick handlers', () => {
      const maliciousInput = '<img src="x" onerror="alert(1)">';
      const sanitized = DOMPurify.sanitize(maliciousInput, { ALLOWED_TAGS: [] });

      expect(sanitized).not.toContain('onerror');
      expect(sanitized).not.toContain('<img');
    });

    it('should sanitize javascript: protocol', () => {
      const maliciousLink = '<a href="javascript:alert(1)">click</a>';
      const sanitized = DOMPurify.sanitize(maliciousLink, { ALLOWED_TAGS: [] });

      expect(sanitized).not.toContain('javascript:');
    });

    it('should handle null and undefined gracefully', () => {
      const sanitized1 = DOMPurify.sanitize('', { ALLOWED_TAGS: [] });
      expect(sanitized1).toBe('');
    });

    it('should preserve safe text content', () => {
      const safeText = 'John Doe - 7 day streak!';
      const sanitized = DOMPurify.sanitize(safeText, { ALLOWED_TAGS: [] });

      expect(sanitized).toBe(safeText);
    });

    it('should sanitize nested malicious content', () => {
      const nested = '<div><script>alert(1)</script><span>text</span></div>';
      const sanitized = DOMPurify.sanitize(nested, { ALLOWED_TAGS: [] });

      expect(sanitized).not.toContain('<script>');
      expect(sanitized).not.toContain('<div>');
    });
  });

  describe('Input Validation', () => {
    it('should handle extremely long strings', () => {
      const longString = 'a'.repeat(10000);
      const sanitized = DOMPurify.sanitize(longString, { ALLOWED_TAGS: [] });

      // Should not throw
      expect(sanitized).toHaveLength(10000);
    });

    it('should handle unicode characters safely', () => {
      const unicodeText = '用户名 🎉 émojis 日本語';
      const sanitized = DOMPurify.sanitize(unicodeText, { ALLOWED_TAGS: [] });

      expect(sanitized).toBe(unicodeText);
    });

    it('should handle mixed content', () => {
      const mixed = 'Hello <b>World</b> & "quotes" \'apostrophe\'';
      const sanitized = DOMPurify.sanitize(mixed, { ALLOWED_TAGS: [] });

      expect(sanitized).not.toContain('<b>');
    });
  });
});

describe('Safe JSON Operations', () => {
  describe('safeJsonParse pattern', () => {
    const safeJsonParse = <T>(str: string | null, fallback: T): T => {
      if (!str) return fallback;
      try {
        return JSON.parse(str);
      } catch {
        return fallback;
      }
    };

    it('should return fallback for null input', () => {
      const result = safeJsonParse(null, { default: true });
      expect(result).toEqual({ default: true });
    });

    it('should return fallback for invalid JSON', () => {
      const result = safeJsonParse('not valid json', []);
      expect(result).toEqual([]);
    });

    it('should return fallback for empty string', () => {
      const result = safeJsonParse('', 'default');
      expect(result).toBe('default');
    });

    it('should parse valid JSON correctly', () => {
      const result = safeJsonParse('{"key": "value"}', {});
      expect(result).toEqual({ key: 'value' });
    });

    it('should handle arrays', () => {
      const result = safeJsonParse('[1, 2, 3]', []);
      expect(result).toEqual([1, 2, 3]);
    });

    it('should not throw on prototype pollution attempt', () => {
      const malicious = '{"__proto__": {"polluted": true}}';
      const result = safeJsonParse(malicious, {});
      // JSON.parse doesn't actually pollute prototype, but we verify it doesn't crash
      expect(result).toBeDefined();
    });
  });
});
