import { Language } from '@/i18n/translations';
import type {
  HabitCategory,
  HabitNumericalEntryMode,
  LoopHabitType,
  TargetType,
} from '@/types';

/** Broad category for UI grouping inside the template picker (Phase 3-C). */
export type HabitTemplateCategory = 'body' | 'mind' | 'focus' | 'rest' | 'quit';

export interface HabitTemplateUnitOption {
  value: string;
  defaultTarget: number;
  step?: number;
}

export interface HabitTemplateSetup {
  defaultUnit?: string;
  unitOptions?: readonly HabitTemplateUnitOption[];
  targetStep?: number;
  targetType?: TargetType;
  quickEntryMode?: HabitNumericalEntryMode;
}

export interface HabitTemplate {
  id: string;
  names: Record<Language, string>;
  icon: string;
  color: number;             // Palette index 0-19
  habitType: LoopHabitType;  // 'boolean' | 'numerical'
  dailyTarget?: number;      // For numerical habits
  defaultTime?: string;
  category?: HabitTemplateCategory;
  setup?: HabitTemplateSetup;
}

export const ROUTINE_STARTER_TEMPLATE_IDS = [
  'drink-water',
  'walk-distance',
  'exercise',
  'read',
  'meditate',
  'sleep',
] as const;

export const habitTemplates: HabitTemplate[] = [
  // ------- BODY ---------
  {
    id: 'drink-water',
    names: {
      en: 'Drink water',
      uk: 'Випити воду',
      es: 'Beber agua',
      de: 'Wasser trinken',
      fr: 'Boire de l’eau',
      ja: '水を飲む',
      ar: 'شرب الماء',
      he: 'לשתות מים',
    },
    icon: '💧',
    color: 10,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'walk-distance',
    names: {
      en: 'Walk 3 km',
      uk: 'Прогулянка 3 км',
      es: 'Caminar 3 km',
      de: '3 km gehen',
      fr: 'Marcher 3 km',
      ja: '3km歩く',
      ar: 'المشي 3 كم',
      he: 'ללכת 3 ק״מ',
    },
    icon: '🚶',
    color: 2,
    habitType: 'numerical',
    dailyTarget: 3,
    defaultTime: '18:00',
    category: 'body',
    setup: {
      defaultUnit: 'km',
      targetStep: 0.5,
      targetType: 'atLeast',
      quickEntryMode: 'completeTarget',
      unitOptions: [
        { value: 'km', defaultTarget: 3, step: 0.5 },
        { value: 'mi', defaultTarget: 2, step: 0.25 },
      ],
    },
  },
  {
    id: 'walk-run',
    names: {
      en: 'Take a walk',
      uk: 'Прогулятися',
      es: 'Dar un paseo',
      de: 'Spazieren gehen',
      fr: 'Faire une marche',
      ja: '散歩する',
      ar: 'الخروج للمشي',
      he: 'לצאת להליכה',
    },
    icon: '🚶',
    color: 2,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'stretch',
    names: {
      en: 'Stretch',
      uk: 'Розтяжка',
      es: 'Estirar',
      de: 'Dehnen',
      fr: 'S’étirer',
      ja: 'ストレッチ',
      ar: 'تمارين إطالة',
      he: 'מתיחות',
    },
    icon: '🤸',
    color: 3,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'water',
    names: {
      en: 'Drink 2 L water',
      uk: '2 л води',
      es: 'Beber 2 L de agua',
      de: '2 L Wasser trinken',
      fr: 'Boire 2 L d’eau',
      ja: '水を2L飲む',
      ar: 'شرب 2 لتر ماء',
      he: 'לשתות 2 ליטר מים',
    },
    icon: '💧',
    color: 10,
    habitType: 'numerical',
    dailyTarget: 2,
    category: 'body',
    setup: {
      defaultUnit: 'L',
      targetStep: 0.25,
      targetType: 'atLeast',
      quickEntryMode: 'incrementStep',
      unitOptions: [
        { value: 'L', defaultTarget: 2, step: 0.25 },
        { value: 'ml', defaultTarget: 2000, step: 250 },
        { value: 'glasses', defaultTarget: 8, step: 1 },
      ],
    },
  },
  {
    id: 'exercise',
    names: {
      en: 'Workout',
      uk: 'Тренування',
      es: 'Entrenar',
      de: 'Training',
      fr: 'Faire du sport',
      ja: '運動する',
      ar: 'تمرين',
      he: 'אימון',
    },
    icon: '🏃',
    color: 2,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'healthy-food',
    names: {
      en: 'Eat vegetables',
      uk: 'Овочі або фрукти',
      es: 'Comer verduras',
      de: 'Gemüse essen',
      fr: 'Manger des légumes',
      ja: '野菜を食べる',
      ar: 'أكل الخضار',
      he: 'לאכול ירקות',
    },
    icon: '🥗',
    color: 5,
    habitType: 'boolean',
    defaultTime: '12:00',
    category: 'body',
  },
  {
    id: 'vitamins',
    names: {
      en: 'Take vitamins or meds',
      uk: 'Вітаміни або ліки',
      es: 'Tomar vitaminas o medicinas',
      de: 'Vitamine oder Medikamente nehmen',
      fr: 'Prendre vitamines ou médicaments',
      ja: 'ビタミンや薬を飲む',
      ar: 'تناول الفيتامينات أو الدواء',
      he: 'לקחת ויטמינים או תרופות',
    },
    icon: '💊',
    color: 15,
    habitType: 'boolean',
    defaultTime: '09:00',
    category: 'body',
  },
  {
    id: 'brush-teeth',
    names: {
      en: 'Brush teeth',
      uk: 'Почистити зуби',
      es: 'Cepillarse los dientes',
      de: 'Zähne putzen',
      fr: 'Se brosser les dents',
      ja: '歯を磨く',
      ar: 'تنظيف الأسنان',
      he: 'לצחצח שיניים',
    },
    icon: '🪥',
    color: 10,
    habitType: 'boolean',
    defaultTime: '21:30',
    category: 'body',
  },
  {
    id: 'sunlight',
    names: {
      en: 'Get daylight',
      uk: 'Вийти на денне світло',
      es: 'Recibir luz natural',
      de: 'Tageslicht bekommen',
      fr: 'Prendre la lumière du jour',
      ja: '日光を浴びる',
      ar: 'التعرض لضوء النهار',
      he: 'לקבל אור יום',
    },
    icon: '🌅',
    color: 16,
    habitType: 'numerical',
    dailyTarget: 10,
    defaultTime: '07:30',
    category: 'body',
    setup: {
      defaultUnit: 'min',
      targetStep: 5,
      targetType: 'atLeast',
      quickEntryMode: 'completeTarget',
      unitOptions: [
        { value: 'min', defaultTarget: 10, step: 5 },
        { value: 'hr', defaultTarget: 0.25, step: 0.25 },
      ],
    },
  },
  {
    id: 'touch-grass',
    names: {
      en: 'Touch grass',
      uk: 'Вийти надвір',
      es: 'Tocar pasto',
      de: 'Gras anfassen',
      fr: 'Toucher l’herbe',
      ja: '外の空気を吸う',
      ar: 'الخروج للطبيعة',
      he: 'לגעת בדשא',
    },
    icon: '🌿',
    color: 16,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'movement-break',
    names: {
      en: 'Movement break',
      uk: 'Рухова пауза',
      es: 'Pausa de movimiento',
      de: 'Bewegungspause',
      fr: 'Pause de mouvement',
      ja: '体を動かす休憩',
      ar: 'استراحة حركة',
      he: 'הפסקת תנועה',
    },
    icon: '🚶',
    color: 17,
    habitType: 'numerical',
    dailyTarget: 2,
    defaultTime: '11:00',
    category: 'body',
    setup: {
      defaultUnit: 'breaks',
      targetStep: 1,
      targetType: 'atLeast',
      quickEntryMode: 'incrementStep',
      unitOptions: [{ value: 'breaks', defaultTarget: 2, step: 1 }],
    },
  },
  {
    id: 'protein',
    names: {
      en: 'Eat protein',
      uk: 'З’їсти білок',
      es: 'Comer proteína',
      de: 'Protein essen',
      fr: 'Manger des protéines',
      ja: 'たんぱく質を食べる',
      ar: 'أكل البروتين',
      he: 'לאכול חלבון',
    },
    icon: '🥚',
    color: 4,
    habitType: 'numerical',
    dailyTarget: 30,
    defaultTime: '08:30',
    category: 'body',
    setup: {
      defaultUnit: 'g',
      targetStep: 5,
      targetType: 'atLeast',
      quickEntryMode: 'completeTarget',
      unitOptions: [{ value: 'g', defaultTarget: 30, step: 5 }],
    },
  },

  // ------- MIND ---------
  {
    id: 'meditate',
    names: {
      en: 'Meditate',
      uk: 'Медитація',
      es: 'Meditar',
      de: 'Meditieren',
      fr: 'Méditer',
      ja: '瞑想する',
      ar: 'تأمل',
      he: 'מדיטציה',
    },
    icon: '🧘',
    color: 13,
    habitType: 'boolean',
    category: 'mind',
  },
  {
    id: 'journal',
    names: {
      en: 'Write in journal',
      uk: 'Запис у щоденнику',
      es: 'Escribir en el diario',
      de: 'Ins Tagebuch schreiben',
      fr: 'Écrire dans le journal',
      ja: '日記を書く',
      ar: 'الكتابة في اليوميات',
      he: 'לכתוב ביומן',
    },
    icon: '✍️',
    color: 7,
    habitType: 'boolean',
    category: 'mind',
  },
  {
    id: 'gratitude',
    names: {
      en: 'Write gratitude',
      uk: 'Записати вдячність',
      es: 'Escribir gratitud',
      de: 'Dankbarkeit notieren',
      fr: 'Noter une gratitude',
      ja: '感謝を書く',
      ar: 'كتابة الامتنان',
      he: 'לכתוב תודה',
    },
    icon: '🙏',
    color: 11,
    habitType: 'boolean',
    defaultTime: '22:00',
    category: 'mind',
  },
  {
    id: 'breathwork',
    names: {
      en: 'Breathing exercise',
      uk: 'Дихальна вправа',
      es: 'Ejercicio de respiración',
      de: 'Atemübung',
      fr: 'Exercice de respiration',
      ja: '呼吸エクササイズ',
      ar: 'تمرين تنفس',
      he: 'תרגיל נשימה',
    },
    icon: '🌬️',
    color: 12,
    habitType: 'boolean',
    defaultTime: '15:00',
    category: 'mind',
  },
  {
    id: 'breath-pause',
    names: {
      en: 'Breathe for 2 minutes',
      uk: 'Дихати 2 хвилини',
      es: 'Respirar 2 minutos',
      de: '2 Minuten atmen',
      fr: 'Respirer 2 minutes',
      ja: '2分呼吸する',
      ar: 'التنفس دقيقتين',
      he: 'לנשום 2 דקות',
    },
    icon: '🌬️',
    color: 12,
    habitType: 'boolean',
    category: 'mind',
  },

  // ------- FOCUS ---------
  {
    id: 'read-page',
    names: {
      en: 'Read today',
      uk: 'Почитати сьогодні',
      es: 'Leer hoy',
      de: 'Heute lesen',
      fr: 'Lire aujourd’hui',
      ja: '今日読む',
      ar: 'القراءة اليوم',
      he: 'לקרוא היום',
    },
    icon: '📖',
    color: 7,
    habitType: 'boolean',
    category: 'focus',
  },
  {
    id: 'read',
    names: {
      en: 'Read 10 pages',
      uk: 'Прочитати 10 сторінок',
      es: 'Leer 10 páginas',
      de: '10 Seiten lesen',
      fr: 'Lire 10 pages',
      ja: '10ページ読む',
      ar: 'قراءة 10 صفحات',
      he: 'לקרוא 10 עמודים',
    },
    icon: '📚',
    color: 7,
    habitType: 'numerical',
    dailyTarget: 10,
    category: 'focus',
    setup: {
      defaultUnit: 'pages',
      targetStep: 1,
      targetType: 'atLeast',
      quickEntryMode: 'incrementStep',
      unitOptions: [{ value: 'pages', defaultTarget: 10, step: 1 }],
    },
  },
  {
    id: 'learn-english',
    names: {
      en: 'Learn a language',
      uk: 'Вчити мову',
      es: 'Aprender un idioma',
      de: 'Eine Sprache lernen',
      fr: 'Apprendre une langue',
      ja: '言語を学ぶ',
      ar: 'تعلم لغة',
      he: 'ללמוד שפה',
    },
    icon: '🗣️',
    color: 2,
    habitType: 'boolean',
    category: 'focus',
  },
  {
    id: 'phone-free-morning',
    names: {
      en: 'No phone morning',
      uk: 'Ранок без телефона',
      es: 'Mañana sin móvil',
      de: 'Morgen ohne Handy',
      fr: 'Matin sans téléphone',
      ja: 'スマホなしの朝',
      ar: 'صباح بلا هاتف',
      he: 'בוקר בלי טלפון',
    },
    icon: '📵',
    color: 14,
    habitType: 'boolean',
    defaultTime: '07:00',
    category: 'focus',
  },
  {
    id: 'phone-break',
    names: {
      en: 'Screen-time break',
      uk: 'Пауза від екрана',
      es: 'Descanso de pantalla',
      de: 'Bildschirmpause',
      fr: 'Pause d’écran',
      ja: '画面休憩',
      ar: 'استراحة من الشاشة',
      he: 'הפסקת מסך',
    },
    icon: '📵',
    color: 14,
    habitType: 'boolean',
    category: 'focus',
  },
  {
    id: 'deep-work',
    names: {
      en: 'Focus for 25 minutes',
      uk: 'Фокус 25 хвилин',
      es: 'Enfoque 25 minutos',
      de: '25 Minuten Fokus',
      fr: 'Focus 25 minutes',
      ja: '25分集中',
      ar: 'تركيز 25 دقيقة',
      he: '25 דקות מיקוד',
    },
    icon: '🎯',
    color: 3,
    habitType: 'numerical',
    dailyTarget: 25,
    defaultTime: '09:30',
    category: 'focus',
    setup: {
      defaultUnit: 'min',
      targetStep: 5,
      targetType: 'atLeast',
      quickEntryMode: 'completeTarget',
      unitOptions: [
        { value: 'min', defaultTarget: 25, step: 5 },
        { value: 'hr', defaultTarget: 0.5, step: 0.25 },
      ],
    },
  },
  {
    id: 'no-doomscroll',
    names: {
      en: 'No doomscrolling',
      uk: 'Без думскролу',
      es: 'Sin doomscrolling',
      de: 'Kein Doomscrolling',
      fr: 'Sans doomscrolling',
      ja: 'だらだらスクロールしない',
      ar: 'بدون تمرير لا نهائي',
      he: 'בלי גלילה אינסופית',
    },
    icon: '📵',
    color: 14,
    habitType: 'boolean',
    category: 'focus',
  },

  // ------- REST ---------
  {
    id: 'sleep',
    names: {
      en: 'Sleep routine',
      uk: 'Режим сну',
      es: 'Rutina de sueño',
      de: 'Schlafroutine',
      fr: 'Routine de sommeil',
      ja: '睡眠ルーティン',
      ar: 'روتين النوم',
      he: 'שגרת שינה',
    },
    icon: '🛏️',
    color: 2,
    habitType: 'boolean',
    defaultTime: '22:00',
    category: 'rest',
  },
  {
    id: 'delayed-caffeine',
    names: {
      en: 'No late coffee',
      uk: 'Без пізньої кави',
      es: 'Sin café tarde',
      de: 'Kein später Kaffee',
      fr: 'Pas de café tardif',
      ja: '遅いコーヒーなし',
      ar: 'بدون قهوة متأخرة',
      he: 'בלי קפה מאוחר',
    },
    icon: '☕',
    color: 6,
    habitType: 'boolean',
    defaultTime: '08:30',
    category: 'rest',
  },
  {
    id: 'tidy-room',
    names: {
      en: '10-minute tidy',
      uk: '10 хв прибирання',
      es: 'Ordenar 10 minutos',
      de: '10 Minuten aufräumen',
      fr: 'Ranger 10 minutes',
      ja: '10分片づける',
      ar: 'ترتيب 10 دقائق',
      he: '10 דקות סדר',
    },
    icon: '🧹',
    color: 17,
    habitType: 'boolean',
    defaultTime: '20:30',
    category: 'rest',
  },

  // ------- QUIT ---------
  {
    id: 'quit-smoking',
    names: {
      en: 'Tobacco-free day',
      uk: 'День без тютюну',
      es: 'Día sin tabaco',
      de: 'Tabakfreier Tag',
      fr: 'Journée sans tabac',
      ja: 'タバコなしの日',
      ar: 'يوم بلا تبغ',
      he: 'יום ללא טבק',
    },
    icon: '🚭',
    color: 15,
    habitType: 'boolean',
    category: 'quit',
  },
  {
    id: 'quit-drinking',
    names: {
      en: 'Alcohol-free day',
      uk: 'День без алкоголю',
      es: 'Día sin alcohol',
      de: 'Alkoholfreier Tag',
      fr: 'Journée sans alcool',
      ja: 'アルコールなしの日',
      ar: 'يوم بلا كحول',
      he: 'יום ללא אלכוהול',
    },
    icon: '🍷',
    color: 13,
    habitType: 'boolean',
    category: 'quit',
  },
  {
    id: 'smoking-limit',
    names: {
      en: 'Tobacco limit',
      uk: 'Ліміт тютюну',
      es: 'Límite de tabaco',
      de: 'Tabaklimit',
      fr: 'Limite de tabac',
      ja: 'タバコの上限',
      ar: 'حد التبغ',
      he: 'מגבלת טבק',
    },
    icon: '🚬',
    color: 15,
    habitType: 'numerical',
    category: 'quit',
    dailyTarget: 2,
    setup: {
      defaultUnit: 'cigarettes',
      targetStep: 1,
      targetType: 'atMost',
      quickEntryMode: 'limitCheck',
      unitOptions: [{ value: 'cigarettes', defaultTarget: 2, step: 1 }],
    },
  },
  {
    id: 'alcohol-limit',
    names: {
      en: 'Alcohol limit',
      uk: 'Ліміт алкоголю',
      es: 'Límite de alcohol',
      de: 'Alkohollimit',
      fr: 'Limite d’alcool',
      ja: 'アルコールの上限',
      ar: 'حد الكحول',
      he: 'מגבלת אלכוהול',
    },
    icon: '🍷',
    color: 13,
    habitType: 'numerical',
    category: 'quit',
    dailyTarget: 1,
    setup: {
      defaultUnit: 'drinks',
      targetStep: 1,
      targetType: 'atMost',
      quickEntryMode: 'limitCheck',
      unitOptions: [{ value: 'drinks', defaultTarget: 1, step: 1 }],
    },
  },
];

export function getHabitTemplateName(templateId: string, language: Language): string {
  const template = habitTemplates.find((t) => t.id === templateId);
  return template?.names[language] || template?.names.en || templateId;
}

export function mapTemplateCategoryToHabitCategory(
  category?: HabitTemplateCategory,
): HabitCategory {
  switch (category) {
    case 'mind':
      return 'mindfulness';
    case 'focus':
      return 'productivity';
    case 'rest':
      return 'self-care';
    case 'quit':
      return 'health';
    case 'body':
    default:
      return 'health';
  }
}

export function resolveHabitTemplateSetup(
  template: HabitTemplate,
  requestedUnit?: string,
): {
  targetType: TargetType;
  targetValue: number;
  targetStep: number;
  unit: string;
  quickEntryMode: HabitNumericalEntryMode;
} {
  const fallbackTarget = template.dailyTarget ?? 1;
  const options = template.setup?.unitOptions ?? [];
  const preferredUnit = requestedUnit ?? template.setup?.defaultUnit;
  const matchedOption =
    options.find((option) => option.value === preferredUnit) ?? options[0];

  return {
    targetType: template.setup?.targetType ?? 'atLeast',
    targetValue: matchedOption?.defaultTarget ?? fallbackTarget,
    targetStep: matchedOption?.step ?? template.setup?.targetStep ?? 1,
    unit: matchedOption?.value ?? template.setup?.defaultUnit ?? '',
    quickEntryMode:
      template.setup?.quickEntryMode ??
      (template.setup?.targetType === 'atMost' ? 'limitCheck' : 'completeTarget'),
  };
}

export function findTemplateIdByName(name: string): string | undefined {
  const lowered = name.toLowerCase();
  for (const template of habitTemplates) {
    for (const lang of Object.values(template.names)) {
      if (lang.toLowerCase() === lowered) {
        return template.id;
      }
    }
  }
  return undefined;
}
