/**
 * Emotion tags for State of Mind — filtered by valence range.
 * Hybrid taxonomy: Russell circumplex (valence) × Cowen/Keltner 27 × Plutchik intensity.
 * v3.0.0 (Phase 3-A.4c): 100 emotions across 5 buckets × 20 each, warmth-gradient sorted.
 */

export type ArousalLevel = 'low' | 'medium' | 'high';
export type WarmthLevel = 'warm' | 'neutral' | 'cool';

export interface EmotionTag {
  key: string;
  /** Minimum valence where this tag appears (-1.0 to 1.0) */
  minValence: number;
  /** Maximum valence where this tag appears (-1.0 to 1.0) */
  maxValence: number;
  /** Arousal level within bucket for sort */
  arousal?: ArousalLevel;
  /** Warmth gradient for within-bucket sort (warm first, cool last) */
  warmth?: WarmthLevel;
  /** Appears in tier-1 collapsed view (top 8 per bucket) */
  initialVisible?: boolean;
  /** Crisis-adjacent emotion — triggers subtle support link in UI */
  sensitive?: boolean;
}

/**
 * Complete emotion vocabulary (100 tags).
 * Grouped by valence bucket, warmth-gradient sorted within each bucket.
 * Top 8 per bucket marked initialVisible: true.
 */
export const EMOTION_TAGS: EmotionTag[] = [
  // ============ TERRIBLE (v ∈ [-1.0, -0.6]) — 20 entries ============
  { key: 'furious', minValence: -1.0, maxValence: -0.5, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'anguished', minValence: -1.0, maxValence: -0.6, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'heartbroken', minValence: -1.0, maxValence: -0.5, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'grief-stricken', minValence: -1.0, maxValence: -0.6, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'betrayed', minValence: -1.0, maxValence: -0.5, arousal: 'medium', warmth: 'warm' },
  { key: 'humiliated', minValence: -1.0, maxValence: -0.6, arousal: 'medium', warmth: 'warm' },
  { key: 'devastated', minValence: -1.0, maxValence: -0.6, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'terrified', minValence: -1.0, maxValence: -0.5, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'panicked', minValence: -1.0, maxValence: -0.5, arousal: 'high', warmth: 'neutral' },
  { key: 'broken', minValence: -1.0, maxValence: -0.6, arousal: 'medium', warmth: 'neutral' },
  { key: 'trapped', minValence: -1.0, maxValence: -0.5, arousal: 'medium', warmth: 'neutral' },
  { key: 'haunted', minValence: -1.0, maxValence: -0.6, arousal: 'medium', warmth: 'neutral' },
  { key: 'defeated', minValence: -1.0, maxValence: -0.6, arousal: 'low', warmth: 'cool' },
  { key: 'despondent', minValence: -1.0, maxValence: -0.6, arousal: 'low', warmth: 'cool' },
  { key: 'hopeless', minValence: -1.0, maxValence: -0.5, arousal: 'low', warmth: 'cool', initialVisible: true, sensitive: true },
  { key: 'worthless', minValence: -1.0, maxValence: -0.6, arousal: 'low', warmth: 'cool', sensitive: true },
  { key: 'despairing', minValence: -1.0, maxValence: -0.6, arousal: 'low', warmth: 'cool', sensitive: true },
  { key: 'numb', minValence: -1.0, maxValence: -0.5, arousal: 'low', warmth: 'cool', initialVisible: true },
  { key: 'disgusted', minValence: -1.0, maxValence: -0.5, arousal: 'medium', warmth: 'cool' },
  { key: 'tormented', minValence: -1.0, maxValence: -0.6, arousal: 'high', warmth: 'cool' },

  // ============ BAD (v ∈ [-0.6, -0.2]) — 20 entries ============
  { key: 'angry', minValence: -0.8, maxValence: -0.2, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'irritated', minValence: -0.7, maxValence: -0.1, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'frustrated', minValence: -0.7, maxValence: -0.1, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'resentful', minValence: -0.7, maxValence: -0.2, arousal: 'medium', warmth: 'warm' },
  { key: 'jealous', minValence: -0.7, maxValence: -0.1, arousal: 'medium', warmth: 'warm' },
  { key: 'stressed', minValence: -0.7, maxValence: -0.1, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'overwhelmed', minValence: -0.8, maxValence: -0.2, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'anxious', minValence: -0.8, maxValence: -0.2, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'worried', minValence: -0.7, maxValence: -0.2, arousal: 'medium', warmth: 'neutral', initialVisible: true },
  { key: 'uneasy', minValence: -0.7, maxValence: -0.1, arousal: 'medium', warmth: 'neutral' },
  { key: 'scared', minValence: -0.7, maxValence: -0.3, arousal: 'high', warmth: 'neutral' },
  { key: 'restless', minValence: -0.7, maxValence: 0.0, arousal: 'medium', warmth: 'neutral' },
  { key: 'ashamed', minValence: -0.8, maxValence: -0.3, arousal: 'medium', warmth: 'neutral' },
  { key: 'guilty', minValence: -0.7, maxValence: -0.2, arousal: 'medium', warmth: 'neutral' },
  { key: 'embarrassed', minValence: -0.7, maxValence: -0.2, arousal: 'medium', warmth: 'neutral' },
  { key: 'insecure', minValence: -0.7, maxValence: -0.2, arousal: 'medium', warmth: 'cool' },
  { key: 'lonely', minValence: -0.8, maxValence: -0.2, arousal: 'low', warmth: 'cool', initialVisible: true },
  { key: 'sad', minValence: -0.8, maxValence: -0.2, arousal: 'low', warmth: 'cool' },
  { key: 'disappointed', minValence: -0.7, maxValence: -0.1, arousal: 'low', warmth: 'cool' },
  { key: 'drained', minValence: -0.8, maxValence: -0.2, arousal: 'low', warmth: 'cool' },

  // ============ OKAY (v ∈ [-0.2, +0.2]) — 20 entries ============
  { key: 'tender', minValence: -0.2, maxValence: 0.3, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'wistful', minValence: -0.2, maxValence: 0.2, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'nostalgic', minValence: -0.2, maxValence: 0.5, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'contemplative', minValence: -0.2, maxValence: 0.2, arousal: 'low', warmth: 'warm' },
  { key: 'pensive', minValence: -0.3, maxValence: 0.2, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'reflective', minValence: -0.3, maxValence: 0.3, arousal: 'low', warmth: 'neutral', initialVisible: true },
  { key: 'curious', minValence: -0.1, maxValence: 0.6, arousal: 'medium', warmth: 'neutral', initialVisible: true },
  { key: 'attentive', minValence: -0.1, maxValence: 0.3, arousal: 'medium', warmth: 'neutral' },
  { key: 'focused', minValence: -0.1, maxValence: 0.4, arousal: 'medium', warmth: 'neutral' },
  { key: 'present', minValence: -0.1, maxValence: 0.4, arousal: 'low', warmth: 'neutral' },
  { key: 'neutral', minValence: -0.3, maxValence: 0.3, arousal: 'low', warmth: 'neutral' },
  { key: 'ambivalent', minValence: -0.2, maxValence: 0.2, arousal: 'low', warmth: 'neutral' },
  { key: 'indifferent', minValence: -0.3, maxValence: 0.1, arousal: 'low', warmth: 'neutral' },
  { key: 'steady', minValence: -0.2, maxValence: 0.3, arousal: 'low', warmth: 'neutral' },
  { key: 'centered', minValence: -0.1, maxValence: 0.4, arousal: 'low', warmth: 'cool' },
  { key: 'grounded', minValence: -0.1, maxValence: 0.4, arousal: 'low', warmth: 'cool', initialVisible: true },
  { key: 'quiet', minValence: -0.2, maxValence: 0.3, arousal: 'low', warmth: 'cool' },
  { key: 'calm', minValence: -0.2, maxValence: 0.5, arousal: 'low', warmth: 'cool', initialVisible: true },
  { key: 'peaceful', minValence: 0.0, maxValence: 0.6, arousal: 'low', warmth: 'cool' },
  { key: 'serene', minValence: 0.0, maxValence: 0.5, arousal: 'low', warmth: 'cool' },

  // ============ GOOD (v ∈ [+0.2, +0.6]) — 20 entries ============
  { key: 'loved', minValence: 0.3, maxValence: 1.0, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'affectionate', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'warm', minValence: 0.2, maxValence: 0.7, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'connected', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'warm' },
  { key: 'appreciated', minValence: 0.2, maxValence: 0.7, arousal: 'low', warmth: 'warm' },
  { key: 'grateful', minValence: 0.3, maxValence: 1.0, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'content', minValence: 0.1, maxValence: 0.6, arousal: 'low', warmth: 'warm', initialVisible: true },
  { key: 'happy', minValence: 0.3, maxValence: 1.0, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'cheerful', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'warm' },
  { key: 'playful', minValence: 0.2, maxValence: 0.8, arousal: 'medium', warmth: 'warm' },
  { key: 'amused', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'warm' },
  { key: 'proud', minValence: 0.3, maxValence: 1.0, arousal: 'medium', warmth: 'neutral', initialVisible: true },
  { key: 'accomplished', minValence: 0.3, maxValence: 0.8, arousal: 'medium', warmth: 'neutral' },
  { key: 'fulfilled', minValence: 0.3, maxValence: 0.8, arousal: 'low', warmth: 'neutral' },
  { key: 'satisfied', minValence: 0.2, maxValence: 0.7, arousal: 'low', warmth: 'neutral', initialVisible: true },
  { key: 'relieved', minValence: 0.1, maxValence: 0.6, arousal: 'low', warmth: 'neutral' },
  { key: 'hopeful', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'neutral' },
  { key: 'inspired', minValence: 0.3, maxValence: 0.8, arousal: 'medium', warmth: 'cool' },
  { key: 'motivated', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'cool' },
  { key: 'confident', minValence: 0.2, maxValence: 0.7, arousal: 'medium', warmth: 'cool' },

  // ============ GREAT (v ∈ [+0.6, +1.0]) — 20 entries ============
  { key: 'cherished', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'adored', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'warm', initialVisible: true },
  { key: 'passionate', minValence: 0.5, maxValence: 1.0, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'joyful', minValence: 0.5, maxValence: 1.0, arousal: 'high', warmth: 'warm', initialVisible: true },
  { key: 'elated', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'warm' },
  { key: 'blissful', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'warm' },
  { key: 'radiant', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'warm' },
  { key: 'ecstatic', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'euphoric', minValence: 0.7, maxValence: 1.0, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'exhilarated', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'neutral' },
  { key: 'excited', minValence: 0.5, maxValence: 1.0, arousal: 'high', warmth: 'neutral' },
  { key: 'energized', minValence: 0.5, maxValence: 1.0, arousal: 'high', warmth: 'neutral' },
  { key: 'amazed', minValence: 0.5, maxValence: 1.0, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'enchanted', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'neutral' },
  { key: 'awestruck', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'neutral', initialVisible: true },
  { key: 'rapturous', minValence: 0.7, maxValence: 1.0, arousal: 'high', warmth: 'neutral' },
  { key: 'triumphant', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'cool' },
  { key: 'invincible', minValence: 0.6, maxValence: 1.0, arousal: 'high', warmth: 'cool' },
  { key: 'brave', minValence: 0.4, maxValence: 0.9, arousal: 'medium', warmth: 'cool' },
  { key: 'free', minValence: 0.6, maxValence: 1.0, arousal: 'medium', warmth: 'cool' },
];

/**
 * Filter emotion tags by current valence value.
 * Returns tags whose range includes the given valence.
 */
export function getTagsForValence(valence: number): EmotionTag[] {
  return EMOTION_TAGS.filter(
    tag => valence >= tag.minValence && valence <= tag.maxValence
  );
}

/**
 * Sort emotion tags by warmth gradient (warm first, cool last) then arousal (low→high).
 */
export function sortByWarmth(tags: EmotionTag[]): EmotionTag[] {
  const warmthOrder: Record<WarmthLevel, number> = { warm: 0, neutral: 1, cool: 2 };
  const arousalOrder: Record<ArousalLevel, number> = { low: 0, medium: 1, high: 2 };
  return [...tags].sort((a, b) => {
    const wA = warmthOrder[a.warmth ?? 'neutral'];
    const wB = warmthOrder[b.warmth ?? 'neutral'];
    if (wA !== wB) return wA - wB;
    return arousalOrder[a.arousal ?? 'medium'] - arousalOrder[b.arousal ?? 'medium'];
  });
}

/**
 * Get initial (tier-1) visible tags for a valence — returns only tags marked initialVisible.
 */
export function getInitialTagsForValence(valence: number): EmotionTag[] {
  return sortByWarmth(getTagsForValence(valence).filter(t => t.initialVisible));
}

/**
 * Check whether an emotion key is sensitive (crisis-adjacent).
 */
export function isSensitiveTag(key: string): boolean {
  return EMOTION_TAGS.find(t => t.key === key)?.sensitive ?? false;
}
