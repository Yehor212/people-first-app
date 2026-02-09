/**
 * Weather Mood Config — Single source of truth for mood-to-weather mapping
 * 12 weather moods with visual theme, animation layers, and performance budgets
 */

import { MoodType, EmotionData } from '@/types';

// ============================================
// TYPES
// ============================================

export type WeatherMoodId =
  | 'calm'
  | 'happy'
  | 'focused'
  | 'anxious'
  | 'sad'
  | 'angry'
  | 'tired'
  | 'energized'
  | 'neutral'
  | 'radiant'
  | 'melancholy'
  | 'stormy';

export interface WeatherMoodPalette {
  accent: string;       // HSL for accent color
  surface: string;      // HSL for surface tint
  glow: string;         // rgba for glow/shadow
  gradientFrom: string; // Tailwind color class fragment
  gradientTo: string;
}

export type WeatherEffectType = 'sun' | 'clouds' | 'rain' | 'storm' | 'fog' | 'aurora' | 'wind' | 'clear' | 'none';
export type ParticleType = 'dots' | 'rain' | 'sparkle' | 'fog' | 'none';

export interface WeatherEffectConfig {
  type: WeatherEffectType;
  intensity: 'light' | 'medium' | 'heavy';
}

export interface ParticleLayerConfig {
  type: ParticleType;
  count: number;
  sizeRange: [number, number];
  speedRange: [number, number];
  color: string;
  opacity: [number, number];
}

export interface MotionConfig {
  bgDuration: number;
  effectDuration: number;
  particleDuration: number;
  easing: string;
}

export interface WeatherMoodConfig {
  id: WeatherMoodId;
  emoji: string;
  labelKey: string;
  messageKey: string;
  palette: {
    light: WeatherMoodPalette;
    dark: WeatherMoodPalette;
  };
  layers: {
    weatherEffect: WeatherEffectConfig;
    particles: ParticleLayerConfig;
  };
  motion: MotionConfig;
  reducedMotion: {
    staticGradient: string;
    staticEmoji: string;
  };
  performanceBudget: {
    maxParticles: number;
    fpsTarget: 30 | 60;
  };
}

// ============================================
// 12-MOOD REGISTRY
// ============================================

export const WEATHER_MOOD_REGISTRY: Record<WeatherMoodId, WeatherMoodConfig> = {
  calm: {
    id: 'calm',
    emoji: '🌿',
    labelKey: 'weatherCalm',
    messageKey: 'weatherMessageCalm',
    palette: {
      light: {
        accent: '158 45% 45%',
        surface: '158 30% 92%',
        glow: 'rgba(45, 160, 140, 0.3)',
        gradientFrom: 'teal-400/20',
        gradientTo: 'cyan-500/10',
      },
      dark: {
        accent: '158 45% 55%',
        surface: '158 25% 15%',
        glow: 'rgba(45, 160, 140, 0.25)',
        gradientFrom: 'teal-600/25',
        gradientTo: 'cyan-700/15',
      },
    },
    layers: {
      weatherEffect: { type: 'clear', intensity: 'light' },
      particles: { type: 'dots', count: 6, sizeRange: [4, 8], speedRange: [10, 14], color: 'teal', opacity: [0.2, 0.5] },
    },
    motion: { bgDuration: 12, effectDuration: 10, particleDuration: 12, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-teal-400/20 to-cyan-500/10', staticEmoji: '🌿' },
    performanceBudget: { maxParticles: 6, fpsTarget: 30 },
  },

  happy: {
    id: 'happy',
    emoji: '☀️',
    labelKey: 'weatherHappy',
    messageKey: 'weatherMessageHappy',
    palette: {
      light: {
        accent: '45 90% 55%',
        surface: '45 80% 94%',
        glow: 'rgba(251, 191, 36, 0.4)',
        gradientFrom: 'amber-400/20',
        gradientTo: 'orange-500/10',
      },
      dark: {
        accent: '45 90% 60%',
        surface: '45 40% 12%',
        glow: 'rgba(251, 191, 36, 0.3)',
        gradientFrom: 'amber-500/25',
        gradientTo: 'orange-600/15',
      },
    },
    layers: {
      weatherEffect: { type: 'sun', intensity: 'medium' },
      particles: { type: 'sparkle', count: 8, sizeRange: [3, 7], speedRange: [6, 10], color: 'amber', opacity: [0.3, 0.7] },
    },
    motion: { bgDuration: 8, effectDuration: 8, particleDuration: 8, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-amber-400/20 to-orange-500/10', staticEmoji: '☀️' },
    performanceBudget: { maxParticles: 8, fpsTarget: 30 },
  },

  focused: {
    id: 'focused',
    emoji: '⚡',
    labelKey: 'weatherFocused',
    messageKey: 'weatherMessageFocused',
    palette: {
      light: {
        accent: '263 70% 55%',
        surface: '263 40% 94%',
        glow: 'rgba(139, 92, 246, 0.3)',
        gradientFrom: 'violet-500/15',
        gradientTo: 'indigo-500/10',
      },
      dark: {
        accent: '263 70% 60%',
        surface: '263 30% 12%',
        glow: 'rgba(139, 92, 246, 0.25)',
        gradientFrom: 'violet-600/20',
        gradientTo: 'indigo-600/15',
      },
    },
    layers: {
      weatherEffect: { type: 'aurora', intensity: 'light' },
      particles: { type: 'dots', count: 5, sizeRange: [3, 6], speedRange: [8, 12], color: 'violet', opacity: [0.2, 0.5] },
    },
    motion: { bgDuration: 10, effectDuration: 10, particleDuration: 10, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-violet-500/15 to-indigo-500/10', staticEmoji: '⚡' },
    performanceBudget: { maxParticles: 5, fpsTarget: 30 },
  },

  anxious: {
    id: 'anxious',
    emoji: '🌫️',
    labelKey: 'weatherAnxious',
    messageKey: 'weatherMessageAnxious',
    palette: {
      light: {
        accent: '220 15% 55%',
        surface: '220 10% 90%',
        glow: 'rgba(148, 163, 184, 0.3)',
        gradientFrom: 'slate-400/25',
        gradientTo: 'gray-500/15',
      },
      dark: {
        accent: '220 15% 50%',
        surface: '220 10% 15%',
        glow: 'rgba(148, 163, 184, 0.2)',
        gradientFrom: 'slate-500/30',
        gradientTo: 'gray-600/20',
      },
    },
    layers: {
      weatherEffect: { type: 'fog', intensity: 'medium' },
      particles: { type: 'fog', count: 4, sizeRange: [20, 40], speedRange: [5, 8], color: 'slate', opacity: [0.15, 0.35] },
    },
    motion: { bgDuration: 6, effectDuration: 8, particleDuration: 8, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-slate-400/25 to-gray-500/15', staticEmoji: '🌫️' },
    performanceBudget: { maxParticles: 4, fpsTarget: 30 },
  },

  sad: {
    id: 'sad',
    emoji: '🌧️',
    labelKey: 'weatherSad',
    messageKey: 'weatherMessageSad',
    palette: {
      light: {
        accent: '217 70% 55%',
        surface: '217 50% 93%',
        glow: 'rgba(59, 130, 246, 0.3)',
        gradientFrom: 'blue-500/20',
        gradientTo: 'indigo-500/15',
      },
      dark: {
        accent: '217 70% 55%',
        surface: '217 30% 12%',
        glow: 'rgba(59, 130, 246, 0.2)',
        gradientFrom: 'blue-600/25',
        gradientTo: 'indigo-600/18',
      },
    },
    layers: {
      weatherEffect: { type: 'rain', intensity: 'light' },
      particles: { type: 'rain', count: 8, sizeRange: [2, 3], speedRange: [0.8, 1.2], color: 'blue', opacity: [0.4, 0.7] },
    },
    motion: { bgDuration: 10, effectDuration: 10, particleDuration: 1, easing: 'linear' },
    reducedMotion: { staticGradient: 'from-blue-500/20 to-indigo-500/15', staticEmoji: '🌧️' },
    performanceBudget: { maxParticles: 8, fpsTarget: 30 },
  },

  angry: {
    id: 'angry',
    emoji: '🔥',
    labelKey: 'weatherAngry',
    messageKey: 'weatherMessageAngry',
    palette: {
      light: {
        accent: '0 75% 55%',
        surface: '0 50% 94%',
        glow: 'rgba(239, 68, 68, 0.35)',
        gradientFrom: 'red-500/20',
        gradientTo: 'orange-600/15',
      },
      dark: {
        accent: '0 75% 55%',
        surface: '0 30% 12%',
        glow: 'rgba(239, 68, 68, 0.25)',
        gradientFrom: 'red-600/25',
        gradientTo: 'orange-700/18',
      },
    },
    layers: {
      weatherEffect: { type: 'wind', intensity: 'medium' },
      particles: { type: 'sparkle', count: 6, sizeRange: [3, 6], speedRange: [3, 5], color: 'red', opacity: [0.3, 0.6] },
    },
    motion: { bgDuration: 4, effectDuration: 3, particleDuration: 4, easing: 'ease-out' },
    reducedMotion: { staticGradient: 'from-red-500/20 to-orange-600/15', staticEmoji: '🔥' },
    performanceBudget: { maxParticles: 6, fpsTarget: 30 },
  },

  tired: {
    id: 'tired',
    emoji: '☁️',
    labelKey: 'weatherTired',
    messageKey: 'weatherMessageTired',
    palette: {
      light: {
        accent: '220 10% 60%',
        surface: '220 8% 92%',
        glow: 'rgba(148, 163, 184, 0.2)',
        gradientFrom: 'slate-300/20',
        gradientTo: 'gray-400/10',
      },
      dark: {
        accent: '220 10% 50%',
        surface: '220 8% 14%',
        glow: 'rgba(148, 163, 184, 0.15)',
        gradientFrom: 'slate-600/20',
        gradientTo: 'gray-700/12',
      },
    },
    layers: {
      weatherEffect: { type: 'clouds', intensity: 'light' },
      particles: { type: 'none', count: 0, sizeRange: [0, 0], speedRange: [0, 0], color: '', opacity: [0, 0] },
    },
    motion: { bgDuration: 15, effectDuration: 12, particleDuration: 0, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-slate-300/20 to-gray-400/10', staticEmoji: '☁️' },
    performanceBudget: { maxParticles: 0, fpsTarget: 30 },
  },

  energized: {
    id: 'energized',
    emoji: '⭐',
    labelKey: 'weatherEnergized',
    messageKey: 'weatherMessageEnergized',
    palette: {
      light: {
        accent: '48 90% 55%',
        surface: '48 70% 94%',
        glow: 'rgba(234, 179, 8, 0.4)',
        gradientFrom: 'yellow-400/20',
        gradientTo: 'amber-500/15',
      },
      dark: {
        accent: '48 90% 60%',
        surface: '48 40% 12%',
        glow: 'rgba(234, 179, 8, 0.3)',
        gradientFrom: 'yellow-500/25',
        gradientTo: 'amber-600/18',
      },
    },
    layers: {
      weatherEffect: { type: 'aurora', intensity: 'heavy' },
      particles: { type: 'sparkle', count: 10, sizeRange: [3, 8], speedRange: [4, 7], color: 'yellow', opacity: [0.3, 0.7] },
    },
    motion: { bgDuration: 5, effectDuration: 6, particleDuration: 5, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-yellow-400/20 to-amber-500/15', staticEmoji: '⭐' },
    performanceBudget: { maxParticles: 10, fpsTarget: 30 },
  },

  neutral: {
    id: 'neutral',
    emoji: '🌤️',
    labelKey: 'weatherNeutral',
    messageKey: 'weatherMessageNeutral',
    palette: {
      light: {
        accent: '210 20% 60%',
        surface: '210 15% 94%',
        glow: 'rgba(148, 163, 184, 0.2)',
        gradientFrom: 'slate-200/15',
        gradientTo: 'blue-100/10',
      },
      dark: {
        accent: '210 20% 55%',
        surface: '210 15% 14%',
        glow: 'rgba(148, 163, 184, 0.15)',
        gradientFrom: 'slate-600/18',
        gradientTo: 'blue-800/12',
      },
    },
    layers: {
      weatherEffect: { type: 'clouds', intensity: 'light' },
      particles: { type: 'dots', count: 4, sizeRange: [4, 7], speedRange: [10, 14], color: 'slate', opacity: [0.2, 0.4] },
    },
    motion: { bgDuration: 12, effectDuration: 10, particleDuration: 12, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-slate-200/15 to-blue-100/10', staticEmoji: '🌤️' },
    performanceBudget: { maxParticles: 4, fpsTarget: 30 },
  },

  radiant: {
    id: 'radiant',
    emoji: '🌈',
    labelKey: 'weatherRadiant',
    messageKey: 'weatherMessageRadiant',
    palette: {
      light: {
        accent: '35 90% 55%',
        surface: '35 70% 94%',
        glow: 'rgba(251, 146, 60, 0.4)',
        gradientFrom: 'amber-300/25',
        gradientTo: 'rose-400/15',
      },
      dark: {
        accent: '35 90% 60%',
        surface: '35 40% 12%',
        glow: 'rgba(251, 146, 60, 0.3)',
        gradientFrom: 'amber-500/28',
        gradientTo: 'rose-500/18',
      },
    },
    layers: {
      weatherEffect: { type: 'sun', intensity: 'heavy' },
      particles: { type: 'sparkle', count: 12, sizeRange: [3, 8], speedRange: [5, 9], color: 'amber', opacity: [0.4, 0.8] },
    },
    motion: { bgDuration: 7, effectDuration: 7, particleDuration: 7, easing: 'ease-in-out' },
    reducedMotion: { staticGradient: 'from-amber-300/25 to-rose-400/15', staticEmoji: '🌈' },
    performanceBudget: { maxParticles: 12, fpsTarget: 30 },
  },

  melancholy: {
    id: 'melancholy',
    emoji: '🌊',
    labelKey: 'weatherMelancholy',
    messageKey: 'weatherMessageMelancholy',
    palette: {
      light: {
        accent: '240 60% 50%',
        surface: '240 40% 93%',
        glow: 'rgba(79, 70, 229, 0.3)',
        gradientFrom: 'indigo-600/25',
        gradientTo: 'blue-700/15',
      },
      dark: {
        accent: '240 60% 55%',
        surface: '240 25% 12%',
        glow: 'rgba(79, 70, 229, 0.2)',
        gradientFrom: 'indigo-700/28',
        gradientTo: 'blue-800/18',
      },
    },
    layers: {
      weatherEffect: { type: 'rain', intensity: 'heavy' },
      particles: { type: 'rain', count: 12, sizeRange: [2, 4], speedRange: [0.7, 1.0], color: 'indigo', opacity: [0.4, 0.7] },
    },
    motion: { bgDuration: 12, effectDuration: 12, particleDuration: 1, easing: 'linear' },
    reducedMotion: { staticGradient: 'from-indigo-600/25 to-blue-700/15', staticEmoji: '🌊' },
    performanceBudget: { maxParticles: 12, fpsTarget: 30 },
  },

  stormy: {
    id: 'stormy',
    emoji: '⛈️',
    labelKey: 'weatherStormy',
    messageKey: 'weatherMessageStormy',
    palette: {
      light: {
        accent: '250 30% 40%',
        surface: '250 20% 90%',
        glow: 'rgba(100, 80, 160, 0.3)',
        gradientFrom: 'slate-600/25',
        gradientTo: 'purple-600/15',
      },
      dark: {
        accent: '250 30% 45%',
        surface: '250 15% 10%',
        glow: 'rgba(100, 80, 160, 0.25)',
        gradientFrom: 'slate-700/30',
        gradientTo: 'purple-700/20',
      },
    },
    layers: {
      weatherEffect: { type: 'storm', intensity: 'heavy' },
      particles: { type: 'rain', count: 10, sizeRange: [2, 3], speedRange: [0.6, 0.9], color: 'slate', opacity: [0.5, 0.8] },
    },
    motion: { bgDuration: 4, effectDuration: 4, particleDuration: 0.8, easing: 'linear' },
    reducedMotion: { staticGradient: 'from-slate-600/25 to-purple-600/15', staticEmoji: '⛈️' },
    performanceBudget: { maxParticles: 10, fpsTarget: 30 },
  },
};

// ============================================
// DERIVE WEATHER MOOD
// ============================================

/**
 * Derive weather mood from MoodType + optional EmotionData.
 * Emotion data takes priority when present; falls back to mood-only mapping.
 */
export function deriveWeatherMood(
  mood: MoodType,
  emotion?: EmotionData | null,
): WeatherMoodId {
  if (emotion) {
    const { primary, intensity } = emotion;

    switch (primary) {
      case 'joy':
        return intensity === 'intense' ? 'radiant' : 'happy';
      case 'trust':
        return 'calm';
      case 'anticipation':
        return intensity === 'intense' ? 'energized' : 'focused';
      case 'surprise':
        return intensity === 'intense' ? 'energized' : 'neutral';
      case 'fear':
        return 'anxious';
      case 'sadness':
        if (intensity === 'intense') return 'melancholy';
        if (intensity === 'mild') return 'tired';
        return 'sad';
      case 'disgust':
        return intensity === 'intense' ? 'stormy' : 'tired';
      case 'anger':
        return intensity === 'intense' ? 'stormy' : 'angry';
    }
  }

  // Fallback: legacy 5-mood mapping
  switch (mood) {
    case 'great': return 'happy';
    case 'good': return 'calm';
    case 'okay': return 'neutral';
    case 'bad': return 'sad';
    case 'terrible': return 'stormy';
  }
}

/**
 * Get config for a weather mood ID
 */
export function getWeatherMoodConfig(id: WeatherMoodId): WeatherMoodConfig {
  return WEATHER_MOOD_REGISTRY[id];
}

/**
 * All weather mood IDs in display order
 */
export const WEATHER_MOOD_ORDER: WeatherMoodId[] = [
  'radiant', 'happy', 'energized', 'calm', 'focused',
  'neutral', 'tired', 'anxious', 'sad', 'angry',
  'melancholy', 'stormy',
];

/**
 * Map MoodType to simple color for calendar indicators
 */
export const MOOD_SCORE: Record<MoodType, number> = {
  great: 5,
  good: 4,
  okay: 3,
  bad: 2,
  terrible: 1,
};
