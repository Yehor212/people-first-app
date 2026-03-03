import { describe, it, expect } from 'vitest';
import { emojiToFluentUrl, STICKER_CATEGORIES, MOOD_STICKER_SUGGESTIONS, searchStickers, DEFAULT_STICKER_PACK_PREFS } from '../stickerUtils';

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
  it('has exactly 10 categories', () => {
    expect(STICKER_CATEGORIES).toHaveLength(10);
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
    expect(keys).toEqual([
      'emotions', 'nature', 'activities', 'food', 'symbols',
      'weather', 'people', 'health', 'places', 'celebrations',
    ]);
    // Verify uniqueness
    expect(new Set(keys).size).toBe(keys.length);
  });
});

// ─── MOOD_STICKER_SUGGESTIONS ──────────────────────────────────────────────

describe('MOOD_STICKER_SUGGESTIONS', () => {
  it('has suggestions for all 5 moods', () => {
    for (const mood of ['great', 'good', 'okay', 'bad', 'terrible'] as const) {
      expect(MOOD_STICKER_SUGGESTIONS[mood].length).toBeGreaterThan(0);
    }
  });

  it('each mood has at least 10 suggestions', () => {
    for (const mood of ['great', 'good', 'okay', 'bad', 'terrible'] as const) {
      expect(MOOD_STICKER_SUGGESTIONS[mood].length).toBeGreaterThanOrEqual(10);
    }
  });
});

// ─── searchStickers ────────────────────────────────────────────────────────

describe('searchStickers', () => {
  it('returns results for known keywords', () => {
    const results = searchStickers('happy');
    expect(results.length).toBeGreaterThan(0);
    expect(results.some(r => r.emoji === '\u{1F60A}')).toBe(true);
  });

  it('returns empty array for empty query', () => {
    expect(searchStickers('')).toEqual([]);
    expect(searchStickers('   ')).toEqual([]);
  });

  it('returns empty array for nonsense query', () => {
    expect(searchStickers('xyzzy123')).toEqual([]);
  });

  it('is case-insensitive', () => {
    const lower = searchStickers('happy');
    const upper = searchStickers('HAPPY');
    expect(lower).toEqual(upper);
  });

  it('includes packKey in results', () => {
    const results = searchStickers('rain');
    expect(results.length).toBeGreaterThan(0);
    for (const r of results) {
      expect(r).toHaveProperty('packKey');
      expect(typeof r.packKey).toBe('string');
    }
  });
});

// ─── DEFAULT_STICKER_PACK_PREFS ────────────────────────────────────────────

describe('DEFAULT_STICKER_PACK_PREFS', () => {
  it('has enabled and seen maps for all categories', () => {
    for (const cat of STICKER_CATEGORIES) {
      expect(DEFAULT_STICKER_PACK_PREFS.enabled).toHaveProperty(cat.key);
      expect(DEFAULT_STICKER_PACK_PREFS.seen).toHaveProperty(cat.key);
    }
  });

  it('enables first 5 categories by default', () => {
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.emotions).toBe(true);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.nature).toBe(true);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.activities).toBe(true);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.food).toBe(true);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.symbols).toBe(true);
  });

  it('disables new 5 categories by default', () => {
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.weather).toBe(false);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.people).toBe(false);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.health).toBe(false);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.places).toBe(false);
    expect(DEFAULT_STICKER_PACK_PREFS.enabled.celebrations).toBe(false);
  });
});
