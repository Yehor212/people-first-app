/**
 * Emotion Wheel Constants
 * Based on Plutchik's Wheel of Emotions
 * ADHD-friendly: 8 primary emotions × 3 intensity levels = 24 states
 */

import { PrimaryEmotion, EmotionIntensity, SecondaryEmotion, MoodType } from '@/types';

// ============================================
// EMOTION COLORS (HSL for CSS variables)
// ============================================

export const EMOTION_COLORS: Record<PrimaryEmotion, { h: number; s: number; l: number }> = {
  joy:          { h: 45,  s: 90, l: 60 },  // Yellow
  trust:        { h: 120, s: 50, l: 50 },  // Green
  fear:         { h: 180, s: 50, l: 45 },  // Cyan-Teal
  surprise:     { h: 195, s: 70, l: 55 },  // Light Blue
  sadness:      { h: 220, s: 60, l: 50 },  // Blue
  disgust:      { h: 280, s: 50, l: 50 },  // Purple
  anger:        { h: 0,   s: 70, l: 55 },  // Red
  anticipation: { h: 30,  s: 80, l: 55 },  // Orange
};

/** Get CSS color string for an emotion */
export function getEmotionColor(emotion: PrimaryEmotion, intensity: EmotionIntensity = 'moderate'): string {
  const base = EMOTION_COLORS[emotion];
  // Adjust lightness based on intensity
  const lightness = intensity === 'mild' ? base.l + 15
                  : intensity === 'intense' ? base.l - 10
                  : base.l;
  return `hsl(${base.h}, ${base.s}%, ${lightness}%)`;
}

/** Get CSS class for emotion background */
export function getEmotionBgClass(emotion: PrimaryEmotion): string {
  return `bg-emotion-${emotion}`;
}

// ============================================
// SECONDARY EMOTIONS (derived from intensity)
// ============================================

/**
 * Map primary emotion + intensity to secondary emotion
 * mild → softer version, intense → stronger version
 */
export const SECONDARY_EMOTIONS: Record<PrimaryEmotion, {
  mild: SecondaryEmotion;
  moderate: PrimaryEmotion; // Returns primary for moderate
  intense: SecondaryEmotion;
}> = {
  joy:          { mild: 'serenity',     moderate: 'joy',          intense: 'ecstasy' },
  trust:        { mild: 'acceptance',   moderate: 'trust',        intense: 'admiration' },
  fear:         { mild: 'apprehension', moderate: 'fear',         intense: 'terror' },
  surprise:     { mild: 'distraction',  moderate: 'surprise',     intense: 'amazement' },
  sadness:      { mild: 'pensiveness',  moderate: 'sadness',      intense: 'grief' },
  disgust:      { mild: 'boredom',      moderate: 'disgust',      intense: 'loathing' },
  anger:        { mild: 'annoyance',    moderate: 'anger',        intense: 'rage' },
  anticipation: { mild: 'interest',     moderate: 'anticipation', intense: 'vigilance' },
};

/** Get the secondary emotion for a primary + intensity combination */
export function getSecondaryEmotion(
  primary: PrimaryEmotion,
  intensity: EmotionIntensity
): SecondaryEmotion | PrimaryEmotion {
  return SECONDARY_EMOTIONS[primary][intensity];
}

// ============================================
// LEGACY MOOD MAPPING (backward compatibility)
// ============================================

/**
 * Map emotion data to legacy MoodType for backward compatibility
 * This ensures old components and stats still work
 */
export function emotionToMoodType(primary: PrimaryEmotion, intensity: EmotionIntensity): MoodType {
  // Positive emotions
  if (primary === 'joy') {
    return intensity === 'intense' ? 'great' : intensity === 'moderate' ? 'good' : 'good';
  }
  if (primary === 'trust' || primary === 'anticipation') {
    return intensity === 'intense' ? 'great' : 'good';
  }
  if (primary === 'surprise') {
    return intensity === 'mild' ? 'okay' : 'good';
  }

  // Negative emotions
  if (primary === 'sadness') {
    return intensity === 'intense' ? 'terrible' : intensity === 'moderate' ? 'bad' : 'okay';
  }
  if (primary === 'anger' || primary === 'disgust') {
    return intensity === 'intense' ? 'terrible' : 'bad';
  }
  if (primary === 'fear') {
    return intensity === 'intense' ? 'bad' : 'okay';
  }

  return 'okay';
}

/**
 * REVERSE mapping: MoodType → PrimaryEmotion (for backward compatibility in stats)
 * Used to display 8-emotion wheel even when user has legacy 5-mood data
 */
export const MOOD_TO_EMOTION_MAP: Record<MoodType, PrimaryEmotion> = {
  great: 'joy',
  good: 'trust',
  okay: 'anticipation',
  bad: 'sadness',
  terrible: 'fear',
};

// ============================================
// EMOTION WHEEL CONFIGURATION
// ============================================

/** Wheel segment positions (degrees, starting from top) */
export const EMOTION_WHEEL_POSITIONS: Record<PrimaryEmotion, number> = {
  joy:          0,    // Top
  trust:        45,   // Top-right
  fear:         90,   // Right
  surprise:     135,  // Bottom-right
  sadness:      180,  // Bottom
  disgust:      225,  // Bottom-left
  anger:        270,  // Left
  anticipation: 315,  // Top-left
};

/** Order of emotions in the wheel (clockwise from top) */
export const EMOTION_ORDER: PrimaryEmotion[] = [
  'joy', 'trust', 'fear', 'surprise',
  'sadness', 'disgust', 'anger', 'anticipation'
];

/** Emoji for each primary emotion (quick visual feedback) */
export const EMOTION_EMOJIS: Record<PrimaryEmotion, string> = {
  joy:          '😊',
  trust:        '🤝',
  fear:         '😨',
  surprise:     '😮',
  sadness:      '😢',
  disgust:      '😖',
  anger:        '😠',
  anticipation: '🤔',
};

/** Emoji for intensity levels */
export const INTENSITY_EMOJIS: Record<EmotionIntensity, string> = {
  mild:     '○',
  moderate: '◐',
  intense:  '●',
};

// ============================================
// TRANSLATIONS (6 languages)
// ============================================

export interface EmotionTranslations {
  // Primary emotions
  joy: string;
  trust: string;
  fear: string;
  surprise: string;
  sadness: string;
  disgust: string;
  anger: string;
  anticipation: string;

  // Intensity levels
  mild: string;
  moderate: string;
  intense: string;

  // Secondary emotions
  serenity: string;
  ecstasy: string;
  acceptance: string;
  admiration: string;
  apprehension: string;
  terror: string;
  distraction: string;
  amazement: string;
  pensiveness: string;
  grief: string;
  boredom: string;
  loathing: string;
  annoyance: string;
  rage: string;
  interest: string;
  vigilance: string;

  // UI labels
  whatDoYouFeel: string;
  selectEmotion: string;
  selectIntensity: string;
  save: string;
}

export const EMOTION_TRANSLATIONS: Record<string, EmotionTranslations> = {
  en: {
    // Primary
    joy: 'Joy', trust: 'Trust', fear: 'Fear', surprise: 'Surprise',
    sadness: 'Sadness', disgust: 'Disgust', anger: 'Anger', anticipation: 'Anticipation',
    // Intensity
    mild: 'Mild', moderate: 'Moderate', intense: 'Intense',
    // Secondary
    serenity: 'Serenity', ecstasy: 'Ecstasy', acceptance: 'Acceptance', admiration: 'Admiration',
    apprehension: 'Apprehension', terror: 'Terror', distraction: 'Distraction', amazement: 'Amazement',
    pensiveness: 'Pensiveness', grief: 'Grief', boredom: 'Boredom', loathing: 'Loathing',
    annoyance: 'Annoyance', rage: 'Rage', interest: 'Interest', vigilance: 'Vigilance',
    // UI
    whatDoYouFeel: 'How do you feel?', selectEmotion: 'Select emotion', selectIntensity: 'How strong?', save: 'Save',
  },
  ru: {
    // Primary
    joy: 'Радость', trust: 'Доверие', fear: 'Страх', surprise: 'Удивление',
    sadness: 'Грусть', disgust: 'Отвращение', anger: 'Гнев', anticipation: 'Ожидание',
    // Intensity
    mild: 'Слабо', moderate: 'Умеренно', intense: 'Сильно',
    // Secondary
    serenity: 'Спокойствие', ecstasy: 'Экстаз', acceptance: 'Принятие', admiration: 'Восхищение',
    apprehension: 'Опасение', terror: 'Ужас', distraction: 'Рассеянность', amazement: 'Изумление',
    pensiveness: 'Задумчивость', grief: 'Горе', boredom: 'Скука', loathing: 'Ненависть',
    annoyance: 'Раздражение', rage: 'Ярость', interest: 'Интерес', vigilance: 'Бдительность',
    // UI
    whatDoYouFeel: 'Что ты чувствуешь?', selectEmotion: 'Выбери эмоцию', selectIntensity: 'Насколько сильно?', save: 'Сохранить',
  },
  uk: {
    // Primary
    joy: 'Радість', trust: 'Довіра', fear: 'Страх', surprise: 'Здивування',
    sadness: 'Сум', disgust: 'Огида', anger: 'Гнів', anticipation: 'Очікування',
    // Intensity
    mild: 'Слабко', moderate: 'Помірно', intense: 'Сильно',
    // Secondary
    serenity: 'Спокій', ecstasy: 'Екстаз', acceptance: 'Прийняття', admiration: 'Захоплення',
    apprehension: 'Побоювання', terror: 'Жах', distraction: 'Розсіяність', amazement: 'Подив',
    pensiveness: 'Замисленість', grief: 'Горе', boredom: 'Нудьга', loathing: 'Ненависть',
    annoyance: 'Роздратування', rage: 'Лють', interest: 'Інтерес', vigilance: 'Пильність',
    // UI
    whatDoYouFeel: 'Що ти відчуваєш?', selectEmotion: 'Обери емоцію', selectIntensity: 'Наскільки сильно?', save: 'Зберегти',
  },
  de: {
    // Primary
    joy: 'Freude', trust: 'Vertrauen', fear: 'Angst', surprise: 'Überraschung',
    sadness: 'Traurigkeit', disgust: 'Ekel', anger: 'Wut', anticipation: 'Erwartung',
    // Intensity
    mild: 'Leicht', moderate: 'Mäßig', intense: 'Stark',
    // Secondary
    serenity: 'Gelassenheit', ecstasy: 'Ekstase', acceptance: 'Akzeptanz', admiration: 'Bewunderung',
    apprehension: 'Besorgnis', terror: 'Terror', distraction: 'Ablenkung', amazement: 'Staunen',
    pensiveness: 'Nachdenklichkeit', grief: 'Trauer', boredom: 'Langeweile', loathing: 'Abscheu',
    annoyance: 'Ärger', rage: 'Raserei', interest: 'Interesse', vigilance: 'Wachsamkeit',
    // UI
    whatDoYouFeel: 'Wie fühlst du dich?', selectEmotion: 'Wähle Emotion', selectIntensity: 'Wie stark?', save: 'Speichern',
  },
  es: {
    // Primary
    joy: 'Alegría', trust: 'Confianza', fear: 'Miedo', surprise: 'Sorpresa',
    sadness: 'Tristeza', disgust: 'Asco', anger: 'Ira', anticipation: 'Anticipación',
    // Intensity
    mild: 'Leve', moderate: 'Moderado', intense: 'Intenso',
    // Secondary
    serenity: 'Serenidad', ecstasy: 'Éxtasis', acceptance: 'Aceptación', admiration: 'Admiración',
    apprehension: 'Aprensión', terror: 'Terror', distraction: 'Distracción', amazement: 'Asombro',
    pensiveness: 'Melancolía', grief: 'Duelo', boredom: 'Aburrimiento', loathing: 'Repugnancia',
    annoyance: 'Molestia', rage: 'Furia', interest: 'Interés', vigilance: 'Vigilancia',
    // UI
    whatDoYouFeel: '¿Cómo te sientes?', selectEmotion: 'Elige emoción', selectIntensity: '¿Qué tan fuerte?', save: 'Guardar',
  },
  fr: {
    // Primary
    joy: 'Joie', trust: 'Confiance', fear: 'Peur', surprise: 'Surprise',
    sadness: 'Tristesse', disgust: 'Dégoût', anger: 'Colère', anticipation: 'Anticipation',
    // Intensity
    mild: 'Léger', moderate: 'Modéré', intense: 'Intense',
    // Secondary
    serenity: 'Sérénité', ecstasy: 'Extase', acceptance: 'Acceptation', admiration: 'Admiration',
    apprehension: 'Appréhension', terror: 'Terreur', distraction: 'Distraction', amazement: 'Émerveillement',
    pensiveness: 'Mélancolie', grief: 'Chagrin', boredom: 'Ennui', loathing: 'Répugnance',
    annoyance: 'Agacement', rage: 'Rage', interest: 'Intérêt', vigilance: 'Vigilance',
    // UI
    whatDoYouFeel: 'Comment te sens-tu?', selectEmotion: 'Choisis une émotion', selectIntensity: 'À quel point?', save: 'Enregistrer',
  },
};

/** Get translations for current language */
export function getEmotionTranslations(lang: string): EmotionTranslations {
  return EMOTION_TRANSLATIONS[lang] || EMOTION_TRANSLATIONS.en;
}

// ============================================
// ADHD-FRIENDLY QUICK SELECT OPTIONS
// ============================================

/** Quick-select presets for common emotional states */
export const QUICK_EMOTIONS = [
  { primary: 'joy' as PrimaryEmotion, intensity: 'moderate' as EmotionIntensity, label: 'happy' },
  { primary: 'sadness' as PrimaryEmotion, intensity: 'moderate' as EmotionIntensity, label: 'sad' },
  { primary: 'anger' as PrimaryEmotion, intensity: 'mild' as EmotionIntensity, label: 'frustrated' },
  { primary: 'fear' as PrimaryEmotion, intensity: 'mild' as EmotionIntensity, label: 'anxious' },
  { primary: 'anticipation' as PrimaryEmotion, intensity: 'moderate' as EmotionIntensity, label: 'excited' },
] as const;

// ============================================
// GAMIFICATION
// ============================================

/** XP rewards for emotion tracking */
export const EMOTION_XP = {
  simple: 5,      // Basic 5-emoji mood (legacy)
  detailed: 8,    // Emotion wheel (primary + intensity)
  withNote: 10,   // Emotion + note
};

// ============================================
// GRADIENTS FOR UI (StatsPage, etc.)
// ============================================

/** Tailwind gradient classes for each emotion */
export const EMOTION_GRADIENTS: Record<PrimaryEmotion, string> = {
  joy:          'from-yellow-400/80 to-amber-500/80',
  trust:        'from-green-400/80 to-emerald-500/80',
  fear:         'from-teal-400/80 to-cyan-500/80',
  surprise:     'from-blue-400/80 to-sky-500/80',
  sadness:      'from-indigo-400/80 to-blue-500/80',
  disgust:      'from-purple-400/80 to-violet-500/80',
  anger:        'from-red-400/80 to-rose-500/80',
  anticipation: 'from-orange-400/80 to-amber-500/80',
};

/** Hex colors for charts and graphs */
export const EMOTION_HEX_COLORS: Record<PrimaryEmotion, string> = {
  joy:          '#fbbf24',  // Yellow
  trust:        '#22c55e',  // Green
  fear:         '#14b8a6',  // Teal
  surprise:     '#3b82f6',  // Blue
  sadness:      '#6366f1',  // Indigo
  disgust:      '#a855f7',  // Purple
  anger:        '#ef4444',  // Red
  anticipation: '#f97316',  // Orange
};

// ============================================
// SCORES FOR ANALYTICS
// ============================================

/**
 * Emotion scores for analytics (1-5 scale like legacy moods)
 * Higher = more positive/energetic, Lower = more negative/low energy
 */
export const EMOTION_SCORES: Record<PrimaryEmotion, number> = {
  joy:          5,
  trust:        4,
  anticipation: 4,
  surprise:     3.5,
  fear:         2,
  sadness:      1.5,
  disgust:      2,
  anger:        2,
};

/** Get numeric score for an emotion entry */
export function getEmotionScore(
  primary: PrimaryEmotion,
  intensity: EmotionIntensity = 'moderate'
): number {
  const baseScore = EMOTION_SCORES[primary];
  // Intensity modifier: mild = -0.5, moderate = 0, intense = +0.5 (clamped 1-5)
  const modifier = intensity === 'mild' ? -0.5 : intensity === 'intense' ? 0.5 : 0;
  return Math.max(1, Math.min(5, baseScore + modifier));
}

// ============================================
// EMOTION LABELS FOR UI COMPONENTS
// ============================================

/** Get all emotion labels in a given language (for dropdowns, filters, etc.) */
export function getEmotionLabels(lang: string): Record<PrimaryEmotion, string> {
  const t = getEmotionTranslations(lang);
  return {
    joy: t.joy,
    trust: t.trust,
    fear: t.fear,
    surprise: t.surprise,
    sadness: t.sadness,
    disgust: t.disgust,
    anger: t.anger,
    anticipation: t.anticipation,
  };
}
