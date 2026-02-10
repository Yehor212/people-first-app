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

/** Get CSS color string with alpha for an emotion (cross-browser safe hsla) */
export function getEmotionColorWithAlpha(
  emotion: PrimaryEmotion,
  intensity: EmotionIntensity = 'moderate',
  alpha: number = 1
): string {
  const base = EMOTION_COLORS[emotion];
  const lightness = intensity === 'mild' ? base.l + 15
                  : intensity === 'intense' ? base.l - 10
                  : base.l;
  return `hsla(${base.h}, ${base.s}%, ${lightness}%, ${alpha})`;
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

// ============================================
// EMOTION GUIDE (Help users choose)
// ============================================

export interface EmotionGuideEntry {
  description: string;
  feelings: string[];
}

export interface EmotionGuideData {
  title: string;
  subtitle: string;
  chooseWhen: string;
  tapToSelect: string;
  intensity: string;
  emotions: Record<PrimaryEmotion, EmotionGuideEntry>;
}

const EMOTION_GUIDE: Record<string, EmotionGuideData> = {
  en: {
    title: 'Emotion Guide',
    subtitle: 'Not sure what to choose? Find your feeling below',
    chooseWhen: 'Choose when you feel:',
    tapToSelect: 'Tap to select',
    intensity: 'Intensity levels',
    emotions: {
      joy: {
        description: 'Positive energy, happiness, and delight',
        feelings: ['Happy', 'Grateful', 'Proud', 'Inspired', 'Content', 'Loving', 'Playful'],
      },
      trust: {
        description: 'Safety, confidence, and inner peace',
        feelings: ['Calm', 'Safe', 'Confident', 'Connected', 'Peaceful', 'Supported'],
      },
      fear: {
        description: 'Worry, anxiety, and feeling unsafe',
        feelings: ['Anxious', 'Worried', 'Nervous', 'Stressed', 'Insecure', 'Tense'],
      },
      surprise: {
        description: 'Unexpected events, shock, or amazement',
        feelings: ['Shocked', 'Confused', 'Amazed', 'Bewildered', 'Astonished'],
      },
      sadness: {
        description: 'Low energy, heaviness, and loss',
        feelings: ['Lonely', 'Tired', 'Apathetic', 'Empty', 'Nostalgic', 'Disappointed'],
      },
      disgust: {
        description: 'Rejection, displeasure, and aversion',
        feelings: ['Bored', 'Uncomfortable', 'Dissatisfied', 'Repulsed', 'Fed up'],
      },
      anger: {
        description: 'Frustration, injustice, and resistance',
        feelings: ['Frustrated', 'Irritated', 'Jealous', 'Impatient', 'Resentful'],
      },
      anticipation: {
        description: 'Excitement, hope, and looking forward',
        feelings: ['Excited', 'Curious', 'Hopeful', 'Motivated', 'Restless'],
      },
    },
  },
  ru: {
    title: 'Гид по эмоциям',
    subtitle: 'Не знаешь что выбрать? Найди своё состояние ниже',
    chooseWhen: 'Выбери, когда чувствуешь:',
    tapToSelect: 'Нажми для выбора',
    intensity: 'Уровни интенсивности',
    emotions: {
      joy: {
        description: 'Позитивная энергия, счастье и восторг',
        feelings: ['Счастье', 'Благодарность', 'Гордость', 'Вдохновение', 'Удовлетворение', 'Любовь', 'Игривость'],
      },
      trust: {
        description: 'Безопасность, уверенность и внутренний покой',
        feelings: ['Спокойствие', 'Безопасность', 'Уверенность', 'Связь', 'Умиротворение', 'Поддержка'],
      },
      fear: {
        description: 'Беспокойство, тревога и чувство опасности',
        feelings: ['Тревога', 'Беспокойство', 'Нервозность', 'Стресс', 'Неуверенность', 'Напряжение'],
      },
      surprise: {
        description: 'Неожиданные события, шок или изумление',
        feelings: ['Шок', 'Замешательство', 'Восхищение', 'Растерянность', 'Потрясение'],
      },
      sadness: {
        description: 'Упадок сил, тяжесть и потеря',
        feelings: ['Одиночество', 'Усталость', 'Апатия', 'Пустота', 'Ностальгия', 'Разочарование'],
      },
      disgust: {
        description: 'Отторжение, неприязнь и отвращение',
        feelings: ['Скука', 'Дискомфорт', 'Недовольство', 'Отвращение', 'Пресыщение'],
      },
      anger: {
        description: 'Фрустрация, несправедливость и сопротивление',
        feelings: ['Фрустрация', 'Раздражение', 'Ревность', 'Нетерпение', 'Обида'],
      },
      anticipation: {
        description: 'Волнение, надежда и предвкушение',
        feelings: ['Волнение', 'Любопытство', 'Надежда', 'Мотивация', 'Нетерпеливость'],
      },
    },
  },
  uk: {
    title: 'Гід по емоціях',
    subtitle: 'Не знаєш що обрати? Знайди свій стан нижче',
    chooseWhen: 'Обери, коли відчуваєш:',
    tapToSelect: 'Натисни для вибору',
    intensity: 'Рівні інтенсивності',
    emotions: {
      joy: {
        description: 'Позитивна енергія, щастя та захват',
        feelings: ['Щастя', 'Вдячність', 'Гордість', 'Натхнення', 'Задоволення', 'Любов', 'Грайливість'],
      },
      trust: {
        description: 'Безпека, впевненість та внутрішній спокій',
        feelings: ['Спокій', 'Безпека', 'Впевненість', "Зв'язок", 'Умиротворення', 'Підтримка'],
      },
      fear: {
        description: 'Занепокоєння, тривога та відчуття небезпеки',
        feelings: ['Тривога', 'Занепокоєння', 'Нервозність', 'Стрес', 'Невпевненість', 'Напруга'],
      },
      surprise: {
        description: 'Несподівані події, шок або здивування',
        feelings: ['Шок', 'Розгубленість', 'Захоплення', 'Збентеження', 'Потрясіння'],
      },
      sadness: {
        description: 'Занепад сил, важкість та втрата',
        feelings: ['Самотність', 'Втома', 'Апатія', 'Порожнеча', 'Ностальгія', 'Розчарування'],
      },
      disgust: {
        description: 'Відторгнення, неприязнь та огида',
        feelings: ['Нудьга', 'Дискомфорт', 'Невдоволення', 'Огида', 'Пересичення'],
      },
      anger: {
        description: 'Фрустрація, несправедливість та опір',
        feelings: ['Фрустрація', 'Роздратування', 'Ревнощі', 'Нетерплячість', 'Образа'],
      },
      anticipation: {
        description: 'Хвилювання, надія та передчуття',
        feelings: ['Хвилювання', 'Цікавість', 'Надія', 'Мотивація', 'Нетерплячість'],
      },
    },
  },
  de: {
    title: 'Emotions-Guide',
    subtitle: 'Unsicher was du wählen sollst? Finde dein Gefühl unten',
    chooseWhen: 'Wähle wenn du dich fühlst:',
    tapToSelect: 'Tippe zum Auswählen',
    intensity: 'Intensitätsstufen',
    emotions: {
      joy: {
        description: 'Positive Energie, Glück und Begeisterung',
        feelings: ['Glücklich', 'Dankbar', 'Stolz', 'Inspiriert', 'Zufrieden', 'Liebevoll', 'Verspielt'],
      },
      trust: {
        description: 'Sicherheit, Selbstvertrauen und innerer Frieden',
        feelings: ['Ruhig', 'Sicher', 'Selbstbewusst', 'Verbunden', 'Friedlich', 'Unterstützt'],
      },
      fear: {
        description: 'Sorgen, Angst und Unsicherheit',
        feelings: ['Ängstlich', 'Besorgt', 'Nervös', 'Gestresst', 'Unsicher', 'Angespannt'],
      },
      surprise: {
        description: 'Unerwartete Ereignisse, Schock oder Staunen',
        feelings: ['Geschockt', 'Verwirrt', 'Erstaunt', 'Verblüfft', 'Fassungslos'],
      },
      sadness: {
        description: 'Energielosigkeit, Schwere und Verlust',
        feelings: ['Einsam', 'Müde', 'Apathisch', 'Leer', 'Nostalgisch', 'Enttäuscht'],
      },
      disgust: {
        description: 'Ablehnung, Unmut und Abneigung',
        feelings: ['Gelangweilt', 'Unwohl', 'Unzufrieden', 'Angewidert', 'Überdrüssig'],
      },
      anger: {
        description: 'Frustration, Ungerechtigkeit und Widerstand',
        feelings: ['Frustriert', 'Gereizt', 'Eifersüchtig', 'Ungeduldig', 'Nachtragend'],
      },
      anticipation: {
        description: 'Aufregung, Hoffnung und Vorfreude',
        feelings: ['Aufgeregt', 'Neugierig', 'Hoffnungsvoll', 'Motiviert', 'Rastlos'],
      },
    },
  },
  es: {
    title: 'Guía de emociones',
    subtitle: '¿No sabes qué elegir? Encuentra tu estado abajo',
    chooseWhen: 'Elige cuando sientas:',
    tapToSelect: 'Toca para seleccionar',
    intensity: 'Niveles de intensidad',
    emotions: {
      joy: {
        description: 'Energía positiva, felicidad y deleite',
        feelings: ['Feliz', 'Agradecido', 'Orgulloso', 'Inspirado', 'Contento', 'Amoroso', 'Juguetón'],
      },
      trust: {
        description: 'Seguridad, confianza y paz interior',
        feelings: ['Tranquilo', 'Seguro', 'Confiado', 'Conectado', 'Pacífico', 'Apoyado'],
      },
      fear: {
        description: 'Preocupación, ansiedad e inseguridad',
        feelings: ['Ansioso', 'Preocupado', 'Nervioso', 'Estresado', 'Inseguro', 'Tenso'],
      },
      surprise: {
        description: 'Eventos inesperados, shock o asombro',
        feelings: ['Impactado', 'Confundido', 'Asombrado', 'Desconcertado', 'Atónito'],
      },
      sadness: {
        description: 'Baja energía, pesadez y pérdida',
        feelings: ['Solo', 'Cansado', 'Apático', 'Vacío', 'Nostálgico', 'Decepcionado'],
      },
      disgust: {
        description: 'Rechazo, disgusto y aversión',
        feelings: ['Aburrido', 'Incómodo', 'Insatisfecho', 'Asqueado', 'Harto'],
      },
      anger: {
        description: 'Frustración, injusticia y resistencia',
        feelings: ['Frustrado', 'Irritado', 'Celoso', 'Impaciente', 'Resentido'],
      },
      anticipation: {
        description: 'Emoción, esperanza y expectativa',
        feelings: ['Emocionado', 'Curioso', 'Esperanzado', 'Motivado', 'Inquieto'],
      },
    },
  },
  fr: {
    title: 'Guide des émotions',
    subtitle: 'Pas sûr de quoi choisir ? Trouve ton état ci-dessous',
    chooseWhen: 'Choisis quand tu ressens :',
    tapToSelect: 'Appuie pour sélectionner',
    intensity: "Niveaux d'intensité",
    emotions: {
      joy: {
        description: 'Énergie positive, bonheur et plaisir',
        feelings: ['Heureux', 'Reconnaissant', 'Fier', 'Inspiré', 'Content', 'Aimant', 'Joueur'],
      },
      trust: {
        description: 'Sécurité, confiance et paix intérieure',
        feelings: ['Calme', 'En sécurité', 'Confiant', 'Connecté', 'Paisible', 'Soutenu'],
      },
      fear: {
        description: "Inquiétude, anxiété et sentiment d'insécurité",
        feelings: ['Anxieux', 'Inquiet', 'Nerveux', 'Stressé', 'Insécure', 'Tendu'],
      },
      surprise: {
        description: 'Événements inattendus, choc ou émerveillement',
        feelings: ['Choqué', 'Confus', 'Émerveillé', 'Déconcerté', 'Stupéfait'],
      },
      sadness: {
        description: "Manque d'énergie, lourdeur et perte",
        feelings: ['Seul', 'Fatigué', 'Apathique', 'Vide', 'Nostalgique', 'Déçu'],
      },
      disgust: {
        description: 'Rejet, déplaisir et aversion',
        feelings: ['Ennuyé', 'Mal à l\'aise', 'Insatisfait', 'Dégoûté', 'Exaspéré'],
      },
      anger: {
        description: 'Frustration, injustice et résistance',
        feelings: ['Frustré', 'Irrité', 'Jaloux', 'Impatient', 'Rancunier'],
      },
      anticipation: {
        description: 'Excitation, espoir et attente',
        feelings: ['Excité', 'Curieux', 'Plein d\'espoir', 'Motivé', 'Agité'],
      },
    },
  },
  ja: {
    title: '感情ガイド',
    subtitle: '何を選べばいいかわからない？下から探してみて',
    chooseWhen: 'こう感じた時に選んで：',
    tapToSelect: 'タップで選択',
    intensity: '強度レベル',
    emotions: {
      joy: {
        description: 'ポジティブなエネルギー、幸福感、喜び',
        feelings: ['幸せ', '感謝', '誇り', 'インスピレーション', '満足', '愛情', '遊び心'],
      },
      trust: {
        description: '安心感、自信、内なる平和',
        feelings: ['穏やか', '安全', '自信', 'つながり', '平和', '支え'],
      },
      fear: {
        description: '心配、不安、危険を感じること',
        feelings: ['不安', '心配', '緊張', 'ストレス', '自信がない', '張り詰め'],
      },
      surprise: {
        description: '予想外の出来事、ショック、驚き',
        feelings: ['ショック', '混乱', '感嘆', '困惑', '仰天'],
      },
      sadness: {
        description: 'エネルギー不足、重さ、喪失感',
        feelings: ['孤独', '疲れ', '無気力', '空虚', '郷愁', '失望'],
      },
      disgust: {
        description: '拒絶、不快感、嫌悪',
        feelings: ['退屈', '不快', '不満', '嫌悪', 'うんざり'],
      },
      anger: {
        description: 'フラストレーション、不公平、抵抗',
        feelings: ['イライラ', '苛立ち', '嫉妬', '焦り', '恨み'],
      },
      anticipation: {
        description: 'ワクワク、希望、期待感',
        feelings: ['興奮', '好奇心', '希望', 'やる気', 'そわそわ'],
      },
    },
  },
  ar: {
    title: 'دليل المشاعر',
    subtitle: 'لست متأكدًا ماذا تختار؟ ابحث عن حالتك أدناه',
    chooseWhen: 'اختر عندما تشعر بـ:',
    tapToSelect: 'انقر للاختيار',
    intensity: 'مستويات الشدة',
    emotions: {
      joy: {
        description: 'طاقة إيجابية وسعادة وبهجة',
        feelings: ['سعيد', 'ممتن', 'فخور', 'ملهم', 'راضٍ', 'محب', 'مرح'],
      },
      trust: {
        description: 'أمان وثقة وسلام داخلي',
        feelings: ['هادئ', 'آمن', 'واثق', 'متصل', 'مطمئن', 'مدعوم'],
      },
      fear: {
        description: 'قلق وتوتر وشعور بعدم الأمان',
        feelings: ['قلق', 'مهموم', 'متوتر', 'مضغوط', 'غير آمن', 'مشدود'],
      },
      surprise: {
        description: 'أحداث غير متوقعة أو صدمة أو دهشة',
        feelings: ['مصدوم', 'مرتبك', 'مندهش', 'حائر', 'مذهول'],
      },
      sadness: {
        description: 'طاقة منخفضة وثقل وفقدان',
        feelings: ['وحيد', 'متعب', 'لا مبالي', 'فارغ', 'حنين', 'محبط'],
      },
      disgust: {
        description: 'رفض واستياء ونفور',
        feelings: ['ملل', 'عدم ارتياح', 'عدم رضا', 'اشمئزاز', 'سأم'],
      },
      anger: {
        description: 'إحباط وظلم ومقاومة',
        feelings: ['محبط', 'منزعج', 'غيور', 'نافد الصبر', 'حاقد'],
      },
      anticipation: {
        description: 'حماس وأمل وتطلع',
        feelings: ['متحمس', 'فضولي', 'متفائل', 'محفّز', 'قلق بتشوّق'],
      },
    },
  },
  he: {
    title: 'מדריך רגשות',
    subtitle: 'לא בטוח מה לבחור? מצא את ההרגשה שלך למטה',
    chooseWhen: 'בחר כשאתה מרגיש:',
    tapToSelect: 'לחץ לבחירה',
    intensity: 'רמות עוצמה',
    emotions: {
      joy: {
        description: 'אנרגיה חיובית, אושר והנאה',
        feelings: ['שמח', 'אסיר תודה', 'גאה', 'מלא השראה', 'מרוצה', 'אוהב', 'שובב'],
      },
      trust: {
        description: 'ביטחון, ביטחון עצמי ושלווה פנימית',
        feelings: ['רגוע', 'בטוח', 'בטוח בעצמו', 'מחובר', 'שלו', 'נתמך'],
      },
      fear: {
        description: 'דאגה, חרדה ותחושת חוסר ביטחון',
        feelings: ['חרד', 'מודאג', 'עצבני', 'לחוץ', 'חסר ביטחון', 'מתוח'],
      },
      surprise: {
        description: 'אירועים בלתי צפויים, הלם או תדהמה',
        feelings: ['המום', 'מבולבל', 'נדהם', 'נבוך', 'המום'],
      },
      sadness: {
        description: 'אנרגיה נמוכה, כובד ואובדן',
        feelings: ['בודד', 'עייף', 'אדיש', 'ריק', 'נוסטלגי', 'מאוכזב'],
      },
      disgust: {
        description: 'דחייה, אי-נוחות וסלידה',
        feelings: ['משועמם', 'לא בנוח', 'לא מרוצה', 'נגעל', 'נמאס'],
      },
      anger: {
        description: 'תסכול, עוול והתנגדות',
        feelings: ['מתוסכל', 'מרוגז', 'קנאי', 'חסר סבלנות', 'טינה'],
      },
      anticipation: {
        description: 'התרגשות, תקווה וציפייה',
        feelings: ['נרגש', 'סקרן', 'מלא תקווה', 'מוטיבציה', 'חסר מנוחה'],
      },
    },
  },
};

/** Get emotion guide data for a language */
export function getEmotionGuide(lang: string): EmotionGuideData {
  return EMOTION_GUIDE[lang] || EMOTION_GUIDE.en;
}
