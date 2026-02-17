import { describe, it, expect } from 'vitest';
import { emojiToFluentUrl, STICKER_CATEGORIES } from '../stickerUtils';

// ─── emojiToFluentUrl ──────────────────────────────────────────────────────

describe('emojiToFluentUrl', () => {
  it('converts a simple emoji to the correct CDN URL', () => {
    // 😊 is U+1F60A
    const url = emojiToFluentUrl('\u{1F60A}');
    expect(url).toBe(
      'https://cdn.jsdelivr.net/npm/@lobehub/fluent-emoji-3d@1.1.0/assets/1f60a.webp'
    );
  });

  it('strips variation selector (fe0f) from emoji codepoints', () => {
    // ❤️ is U+2764 U+FE0F — fe0f should be stripped
    const url = emojiToFluentUrl('\u2764\uFE0F');
    expect(url).toContain('/2764.webp');
    expect(url).not.toContain('fe0f');
  });

  it('strips ZWJ (200d) from compound emoji codepoints', () => {
    // Use a compound emoji with ZWJ: ❤️‍🔥 (U+2764 U+FE0F U+200D U+1F525)
    const url = emojiToFluentUrl('\u2764\uFE0F\u200D\u{1F525}');
    expect(url).not.toContain('200d');
    expect(url).not.toContain('fe0f');
    expect(url).toContain('2764-1f525');
  });

  it('returns the correct CDN base URL format', () => {
    const url = emojiToFluentUrl('\u{1F60A}');
    expect(url).toMatch(
      /^https:\/\/cdn\.jsdelivr\.net\/npm\/@lobehub\/fluent-emoji-3d@1\.1\.0\/assets\/.+\.webp$/
    );
  });
});

// ─── STICKER_CATEGORIES ────────────────────────────────────────────────────

describe('STICKER_CATEGORIES', () => {
  it('has exactly 5 categories', () => {
    expect(STICKER_CATEGORIES).toHaveLength(5);
  });

  it('each category has required properties', () => {
    for (const category of STICKER_CATEGORIES) {
      expect(category).toHaveProperty('key');
      expect(category).toHaveProperty('labelKey');
      expect(category).toHaveProperty('icon');
      expect(category).toHaveProperty('stickers');
      expect(typeof category.key).toBe('string');
      expect(typeof category.labelKey).toBe('string');
      expect(typeof category.icon).toBe('string');
      expect(Array.isArray(category.stickers)).toBe(true);
    }
  });

  it('each category has a non-empty stickers array', () => {
    for (const category of STICKER_CATEGORIES) {
      expect(category.stickers.length).toBeGreaterThan(0);
    }
  });

  it('has the expected unique category keys', () => {
    const keys = STICKER_CATEGORIES.map(c => c.key);
    expect(keys).toEqual(['emotions', 'nature', 'activities', 'food', 'symbols']);
    // Verify uniqueness
    expect(new Set(keys).size).toBe(keys.length);
  });
});
