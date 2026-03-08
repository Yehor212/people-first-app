/**
 * Emotion tags for State of Mind — filtered by valence range.
 * Apple Health model: adjective chips describing how you feel.
 */

export interface EmotionTag {
  key: string;
  /** Minimum valence where this tag appears (-1.0 to 1.0) */
  minValence: number;
  /** Maximum valence where this tag appears (-1.0 to 1.0) */
  maxValence: number;
}

/**
 * All emotion tags with their valence ranges.
 * Ranges overlap slightly for smooth transitions.
 */
export const EMOTION_TAGS: EmotionTag[] = [
  // Very Unpleasant (-1.0 to -0.5)
  { key: 'angry', minValence: -1.0, maxValence: -0.4 },
  { key: 'anxious', minValence: -1.0, maxValence: -0.2 },
  { key: 'ashamed', minValence: -1.0, maxValence: -0.4 },     // Apple HK
  { key: 'disgusted', minValence: -1.0, maxValence: -0.5 },
  { key: 'drained', minValence: -1.0, maxValence: -0.4 },
  { key: 'fearful', minValence: -1.0, maxValence: -0.5 },
  { key: 'hopeless', minValence: -1.0, maxValence: -0.5 },
  { key: 'lonely', minValence: -1.0, maxValence: -0.4 },
  { key: 'overwhelmed', minValence: -1.0, maxValence: -0.3 },
  { key: 'sad', minValence: -1.0, maxValence: -0.3 },
  { key: 'scared', minValence: -1.0, maxValence: -0.4 },      // Apple HK

  // Unpleasant (-0.7 to -0.1)
  { key: 'bored', minValence: -0.7, maxValence: -0.1 },
  { key: 'disappointed', minValence: -0.7, maxValence: -0.1 },
  { key: 'discouraged', minValence: -0.8, maxValence: -0.2 },  // Apple HK
  { key: 'embarrassed', minValence: -0.8, maxValence: -0.3 },  // Apple HK
  { key: 'frustrated', minValence: -0.7, maxValence: -0.1 },
  { key: 'guilty', minValence: -0.8, maxValence: -0.2 },       // Apple HK
  { key: 'indifferent', minValence: -0.7, maxValence: 0.0 },
  { key: 'irritated', minValence: -0.7, maxValence: -0.1 },
  { key: 'jealous', minValence: -0.7, maxValence: -0.1 },      // Apple HK
  { key: 'restless', minValence: -0.7, maxValence: 0.0 },
  { key: 'stressed', minValence: -0.7, maxValence: -0.1 },
  { key: 'uneasy', minValence: -0.7, maxValence: -0.1 },
  { key: 'worried', minValence: -0.8, maxValence: -0.2 },      // Apple HK

  // Neutral (-0.3 to +0.3)
  { key: 'calm', minValence: -0.3, maxValence: 0.4 },
  { key: 'content', minValence: -0.2, maxValence: 0.4 },
  { key: 'neutral', minValence: -0.3, maxValence: 0.3 },
  { key: 'nostalgic', minValence: -0.1, maxValence: 0.5 },     // Apple HK
  { key: 'peaceful', minValence: 0.0, maxValence: 0.6 },       // Apple HK
  { key: 'pensive', minValence: -0.3, maxValence: 0.2 },
  { key: 'reflective', minValence: -0.3, maxValence: 0.3 },
  { key: 'steady', minValence: -0.2, maxValence: 0.3 },
  { key: 'surprised', minValence: -0.2, maxValence: 0.6 },     // Apple HK

  // Pleasant (+0.1 to +0.7)
  { key: 'amused', minValence: 0.1, maxValence: 0.7 },
  { key: 'brave', minValence: 0.2, maxValence: 0.8 },          // Apple HK
  { key: 'cheerful', minValence: 0.1, maxValence: 0.7 },
  { key: 'confident', minValence: 0.1, maxValence: 0.7 },
  { key: 'curious', minValence: 0.0, maxValence: 0.7 },
  { key: 'happy', minValence: 0.3, maxValence: 1.0 },          // Apple HK
  { key: 'hopeful', minValence: 0.1, maxValence: 0.7 },
  { key: 'inspired', minValence: 0.2, maxValence: 0.8 },
  { key: 'motivated', minValence: 0.1, maxValence: 0.7 },
  { key: 'relieved', minValence: 0.0, maxValence: 0.6 },
  { key: 'satisfied', minValence: 0.2, maxValence: 0.7 },      // Apple HK

  // Very Pleasant (+0.4 to +1.0)
  { key: 'amazed', minValence: 0.4, maxValence: 1.0 },         // Apple HK
  { key: 'ecstatic', minValence: 0.5, maxValence: 1.0 },
  { key: 'energized', minValence: 0.4, maxValence: 1.0 },
  { key: 'euphoric', minValence: 0.6, maxValence: 1.0 },
  { key: 'excited', minValence: 0.4, maxValence: 1.0 },
  { key: 'grateful', minValence: 0.3, maxValence: 1.0 },
  { key: 'joyful', minValence: 0.5, maxValence: 1.0 },
  { key: 'loved', minValence: 0.4, maxValence: 1.0 },
  { key: 'passionate', minValence: 0.4, maxValence: 1.0 },     // Apple HK
  { key: 'proud', minValence: 0.4, maxValence: 1.0 },
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
