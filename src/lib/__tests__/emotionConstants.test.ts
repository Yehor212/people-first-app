import { describe, it, expect } from 'vitest';
import {
  EMOTION_COLORS,
  getEmotionColor,
  getEmotionColorWithAlpha,
  getEmotionBgClass,
  getSecondaryEmotion,
  emotionToMoodType,
  EMOTION_ORDER,
  EMOTION_EMOJIS,
  getEmotionTranslations,
  QUICK_EMOTIONS,
  EMOTION_HEX_COLORS,
  EMOTION_SCORES,
  getEmotionScore,
  getEmotionLabels,
  getEmotionGuide,
} from '../emotionConstants';
import type { PrimaryEmotion, EmotionIntensity } from '@/types';

const ALL_EMOTIONS: PrimaryEmotion[] = [
  'joy', 'trust', 'fear', 'surprise', 'sadness', 'disgust', 'anger', 'anticipation',
];

const ALL_INTENSITIES: EmotionIntensity[] = ['mild', 'moderate', 'intense'];

// ============================================
// getEmotionColor
// ============================================

describe('getEmotionColor', () => {
  it('returns string containing "hsl" for all primary emotions', () => {
    for (const emotion of ALL_EMOTIONS) {
      const result = getEmotionColor(emotion);
      expect(result).toContain('hsl');
    }
  });

  it('uses moderate intensity by default', () => {
    const moderate = getEmotionColor('joy');
    const explicit = getEmotionColor('joy', 'moderate');
    expect(moderate).toBe(explicit);
  });

  it('intensity changes lightness value', () => {
    const mild = getEmotionColor('joy', 'mild');
    const intense = getEmotionColor('joy', 'intense');
    // Mild has higher lightness (+15), intense has lower (-10)
    expect(mild).not.toBe(intense);
    // Extract lightness values from hsl strings
    const mildLightness = parseInt(mild.split(',')[2]);
    const intenseLightness = parseInt(intense.split(',')[2]);
    expect(mildLightness).toBeGreaterThan(intenseLightness);
  });

  it('returns correctly formatted hsl string', () => {
    const result = getEmotionColor('anger', 'moderate');
    // anger: h=0, s=70, l=55
    expect(result).toBe('hsl(0, 70%, 55%)');
  });
});

// ============================================
// getEmotionColorWithAlpha
// ============================================

describe('getEmotionColorWithAlpha', () => {
  it('returns hsla string with alpha value', () => {
    const result = getEmotionColorWithAlpha('joy', 'moderate', 0.5);
    expect(result).toContain('hsla');
    expect(result).toContain('0.5');
  });

  it('default alpha is 1', () => {
    const result = getEmotionColorWithAlpha('trust');
    expect(result).toContain('hsla');
    expect(result).toContain(', 1)');
  });
});

// ============================================
// getEmotionBgClass
// ============================================

describe('getEmotionBgClass', () => {
  it('returns CSS class string for each emotion', () => {
    for (const emotion of ALL_EMOTIONS) {
      const result = getEmotionBgClass(emotion);
      expect(result).toBe(`bg-emotion-${emotion}`);
    }
  });
});

// ============================================
// getSecondaryEmotion
// ============================================

describe('getSecondaryEmotion', () => {
  it('returns primary emotion for moderate intensity', () => {
    expect(getSecondaryEmotion('joy', 'moderate')).toBe('joy');
    expect(getSecondaryEmotion('anger', 'moderate')).toBe('anger');
  });

  it('returns mild secondary emotion', () => {
    expect(getSecondaryEmotion('joy', 'mild')).toBe('serenity');
    expect(getSecondaryEmotion('anger', 'mild')).toBe('annoyance');
  });

  it('returns intense secondary emotion', () => {
    expect(getSecondaryEmotion('joy', 'intense')).toBe('ecstasy');
    expect(getSecondaryEmotion('fear', 'intense')).toBe('terror');
  });
});

// ============================================
// emotionToMoodType
// ============================================

describe('emotionToMoodType', () => {
  it('maps joy+intense to great', () => {
    expect(emotionToMoodType('joy', 'intense')).toBe('great');
  });

  it('maps joy+moderate to good', () => {
    expect(emotionToMoodType('joy', 'moderate')).toBe('good');
  });

  it('maps sadness+intense to terrible', () => {
    expect(emotionToMoodType('sadness', 'intense')).toBe('terrible');
  });

  it('maps sadness+moderate to bad', () => {
    expect(emotionToMoodType('sadness', 'moderate')).toBe('bad');
  });

  it('maps sadness+mild to okay', () => {
    expect(emotionToMoodType('sadness', 'mild')).toBe('okay');
  });

  it('maps anger+intense to terrible', () => {
    expect(emotionToMoodType('anger', 'intense')).toBe('terrible');
  });

  it('maps anger+moderate to bad', () => {
    expect(emotionToMoodType('anger', 'moderate')).toBe('bad');
  });

  it('maps fear+mild to okay', () => {
    expect(emotionToMoodType('fear', 'mild')).toBe('okay');
  });

  it('maps surprise+moderate to good', () => {
    expect(emotionToMoodType('surprise', 'moderate')).toBe('good');
  });
});

// ============================================
// getEmotionScore
// ============================================

describe('getEmotionScore', () => {
  it('joy scores higher than sadness at same intensity', () => {
    const joyScore = getEmotionScore('joy', 'moderate');
    const sadnessScore = getEmotionScore('sadness', 'moderate');
    expect(joyScore).toBeGreaterThan(sadnessScore);
  });

  it('intensity affects score: intense > moderate > mild', () => {
    // Use 'trust' (base=4) so that clamping to 5 doesn't flatten intense vs moderate
    const mild = getEmotionScore('trust', 'mild');
    const moderate = getEmotionScore('trust', 'moderate');
    const intense = getEmotionScore('trust', 'intense');
    expect(intense).toBeGreaterThan(moderate);
    expect(moderate).toBeGreaterThan(mild);
  });

  it('clamps score between 1 and 5', () => {
    for (const emotion of ALL_EMOTIONS) {
      for (const intensity of ALL_INTENSITIES) {
        const score = getEmotionScore(emotion, intensity);
        expect(score).toBeGreaterThanOrEqual(1);
        expect(score).toBeLessThanOrEqual(5);
      }
    }
  });

  it('defaults to moderate intensity when not specified', () => {
    const defaultScore = getEmotionScore('trust');
    const moderateScore = getEmotionScore('trust', 'moderate');
    expect(defaultScore).toBe(moderateScore);
  });
});

// ============================================
// getEmotionTranslations
// ============================================

describe('getEmotionTranslations', () => {
  it('returns valid translations for "en"', () => {
    const t = getEmotionTranslations('en');
    expect(t.joy).toBe('Joy');
    expect(t.mild).toBe('Mild');
    expect(t.whatDoYouFeel).toBe('How do you feel?');
  });

  it('returns Ukrainian translations for "uk"', () => {
    const t = getEmotionTranslations('uk');
    expect(t.joy).toBe('Радість');
  });

  it('falls back to English for unknown language', () => {
    const t = getEmotionTranslations('zz');
    expect(t.joy).toBe('Joy');
  });
});

// ============================================
// getEmotionLabels
// ============================================

describe('getEmotionLabels', () => {
  it('returns labels for all 8 primary emotions', () => {
    const labels = getEmotionLabels('en');
    for (const emotion of ALL_EMOTIONS) {
      expect(labels[emotion]).toBeDefined();
      expect(typeof labels[emotion]).toBe('string');
    }
  });

  it('uses language-specific labels', () => {
    const enLabels = getEmotionLabels('en');
    const ukLabels = getEmotionLabels('uk');
    expect(enLabels.joy).toBe('Joy');
    expect(ukLabels.joy).toBe('Радість');
  });
});

// ============================================
// getEmotionGuide
// ============================================

describe('getEmotionGuide', () => {
  it('returns object with expected structure for "en"', () => {
    const guide = getEmotionGuide('en');
    expect(guide.title).toBe('Emotion Guide');
    expect(guide.subtitle).toBeDefined();
    expect(guide.chooseWhen).toBeDefined();
    expect(guide.tapToSelect).toBeDefined();
    expect(guide.intensity).toBeDefined();
    expect(guide.emotions).toBeDefined();
  });

  it('has entries for all 8 primary emotions', () => {
    const guide = getEmotionGuide('en');
    for (const emotion of ALL_EMOTIONS) {
      expect(guide.emotions[emotion]).toBeDefined();
      expect(guide.emotions[emotion].description).toBeDefined();
      expect(guide.emotions[emotion].feelings.length).toBeGreaterThan(0);
    }
  });

  it('falls back to English for unknown language', () => {
    const guide = getEmotionGuide('xx');
    expect(guide.title).toBe('Emotion Guide');
  });
});

// ============================================
// Constants
// ============================================

describe('Emotion constants', () => {
  it('EMOTION_ORDER is non-empty and has 8 entries', () => {
    expect(EMOTION_ORDER.length).toBe(8);
  });

  it('EMOTION_EMOJIS has all primary emotions', () => {
    for (const emotion of ALL_EMOTIONS) {
      expect(EMOTION_EMOJIS[emotion]).toBeDefined();
      expect(typeof EMOTION_EMOJIS[emotion]).toBe('string');
    }
  });

  it('QUICK_EMOTIONS is non-empty', () => {
    expect(QUICK_EMOTIONS.length).toBeGreaterThan(0);
  });

  it('EMOTION_SCORES has values for all emotions', () => {
    for (const emotion of ALL_EMOTIONS) {
      expect(EMOTION_SCORES[emotion]).toBeGreaterThanOrEqual(1);
      expect(EMOTION_SCORES[emotion]).toBeLessThanOrEqual(5);
    }
  });

  it('EMOTION_HEX_COLORS has hex values for all emotions', () => {
    for (const emotion of ALL_EMOTIONS) {
      expect(EMOTION_HEX_COLORS[emotion]).toMatch(/^#[0-9a-f]{6}$/i);
    }
  });

  it('EMOTION_COLORS has h/s/l for all emotions', () => {
    for (const emotion of ALL_EMOTIONS) {
      const color = EMOTION_COLORS[emotion];
      expect(typeof color.h).toBe('number');
      expect(typeof color.s).toBe('number');
      expect(typeof color.l).toBe('number');
    }
  });
});
