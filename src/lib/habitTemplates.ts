import { Language } from '@/i18n/translations';
import type { HabitCategory, LoopHabitType, TargetType } from '@/types';

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

export const habitTemplates: HabitTemplate[] = [
  // ------- BODY ---------
  {
    id: 'water',
    names: {
      en: 'Drink water',
      uk: 'Пити воду',
      es: 'Beber agua',
      de: 'Wasser trinken',
      fr: "Boire de l'eau",
      ja: '水を飲む',
      ar: 'شرب الماء',
      he: 'לשתות מים',
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
      en: 'Exercise',
      uk: 'Вправи',
      es: 'Ejercicio',
      de: 'Sport',
      fr: 'Exercice',
      ja: '運動',
      ar: 'تمرين',
      he: 'פעילות גופנית',
    },
    icon: '🏃',
    color: 2,
    habitType: 'boolean',
    category: 'body',
  },
  {
    id: 'healthy-food',
    names: {
      en: 'Eat healthy',
      uk: 'Здорове харчування',
      es: 'Comer sano',
      de: 'Gesund essen',
      fr: 'Manger sainement',
      ja: '健康的な食事',
      ar: 'أكل صحي',
      he: 'לאכול בריא',
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
      en: 'Take vitamins',
      uk: 'Вітаміни',
      es: 'Vitaminas',
      de: 'Vitamine',
      fr: 'Vitamines',
      ja: 'ビタミンを摂る',
      ar: 'تناول الفيتامينات',
      he: 'לקחת ויטמינים',
    },
    icon: '💊',
    color: 15,
    habitType: 'boolean',
    defaultTime: '09:00',
    category: 'body',
  },
  {
    id: 'sunlight',
    names: {
      en: 'Morning sunlight — 10 min',
      uk: 'Ранкове сонце — 10 хв',
      es: 'Sol matutino — 10 min',
      de: 'Morgensonne — 10 Min',
      fr: 'Soleil du matin — 10 min',
      ja: '朝日 — 10分',
      ar: 'شمس الصباح — 10 د',
      he: 'שמש בוקר — 10 ד׳',
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
      unitOptions: [
        { value: 'min', defaultTarget: 10, step: 5 },
        { value: 'hr', defaultTarget: 0.25, step: 0.25 },
      ],
    },
  },
  {
    id: 'cold-exposure',
    names: {
      en: 'Cold exposure — 1 min',
      uk: 'Холодний душ — 1 хв',
      es: 'Ducha fría — 1 min',
      de: 'Kaltdusche — 1 Min',
      fr: 'Douche froide — 1 min',
      ja: '冷水浴 — 1分',
      ar: 'دش بارد — 1 د',
      he: 'מקלחת קרה — 1 ד׳',
    },
    icon: '🧊',
    color: 17,
    habitType: 'numerical',
    dailyTarget: 1,
    defaultTime: '08:00',
    category: 'body',
    setup: {
      defaultUnit: 'min',
      targetStep: 0.5,
      targetType: 'atLeast',
      unitOptions: [{ value: 'min', defaultTarget: 1, step: 0.5 }],
    },
  },
  {
    id: 'protein',
    names: {
      en: 'Protein target — 30 g',
      uk: 'Білок — 30 г',
      es: 'Proteína — 30 g',
      de: 'Eiweiß — 30 g',
      fr: 'Protéine — 30 g',
      ja: 'たんぱく質 — 30g',
      ar: 'بروتين — 30غ',
      he: 'חלבון — 30 גר׳',
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
      ja: '瞑想',
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
      en: 'Journal',
      uk: 'Щоденник',
      es: 'Diario',
      de: 'Tagebuch',
      fr: 'Journal',
      ja: '日記',
      ar: 'يوميات',
      he: 'יומן',
    },
    icon: '✍️',
    color: 7,
    habitType: 'boolean',
    category: 'mind',
  },
  {
    id: 'gratitude',
    names: {
      en: 'Name one gratitude',
      uk: 'Назвати одну вдячність',
      es: 'Una gratitud',
      de: 'Eine Dankbarkeit',
      fr: 'Une gratitude',
      ja: '感謝を一つ',
      ar: 'امتنان واحد',
      he: 'הכרת תודה אחת',
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
      en: 'Breathe — 4-7-8 once',
      uk: 'Подих — 4-7-8 раз',
      es: 'Respiración 4-7-8',
      de: 'Atmen 4-7-8',
      fr: 'Respiration 4-7-8',
      ja: '4-7-8呼吸',
      ar: 'تنفس 4-7-8',
      he: 'נשימה 4-7-8',
    },
    icon: '🌬️',
    color: 12,
    habitType: 'boolean',
    defaultTime: '15:00',
    category: 'mind',
  },

  // ------- FOCUS ---------
  {
    id: 'read',
    names: {
      en: 'Read 10 pages',
      uk: 'Читати 10 сторінок',
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
      targetStep: 5,
      targetType: 'atLeast',
      unitOptions: [{ value: 'pages', defaultTarget: 10, step: 5 }],
    },
  },
  {
    id: 'learn-english',
    names: {
      en: 'Learn English',
      uk: 'Вивчити англійську',
      es: 'Aprender inglés',
      de: 'Englisch lernen',
      fr: "Apprendre l'anglais",
      ja: '英語を学ぶ',
      ar: 'تعلم الإنجليزية',
      he: 'ללמוד אנגלית',
    },
    icon: '🗣️',
    color: 2,
    habitType: 'boolean',
    category: 'focus',
  },
  {
    id: 'phone-free-morning',
    names: {
      en: 'Phone-free first hour',
      uk: 'Без телефону першу годину',
      es: 'Sin móvil la 1ª hora',
      de: 'Eine Stunde ohne Handy',
      fr: '1 h sans téléphone',
      ja: '朝1時間スマホなし',
      ar: 'ساعة بدون هاتف',
      he: 'שעה בלי טלפון',
    },
    icon: '📵',
    color: 14,
    habitType: 'boolean',
    defaultTime: '07:00',
    category: 'focus',
  },
  {
    id: 'deep-work',
    names: {
      en: 'Deep work — 25 min',
      uk: 'Глибока робота — 25 хв',
      es: 'Trabajo profundo — 25 min',
      de: 'Deep Work — 25 Min',
      fr: 'Travail profond — 25 min',
      ja: 'ディープワーク 25分',
      ar: 'عمل عميق — 25 د',
      he: 'עבודה עמוקה — 25 ד׳',
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
      unitOptions: [
        { value: 'min', defaultTarget: 25, step: 5 },
        { value: 'hr', defaultTarget: 0.5, step: 0.25 },
      ],
    },
  },

  // ------- REST ---------
  {
    id: 'sleep',
    names: {
      en: 'Sleep 8 hours',
      uk: 'Сон 8 годин',
      es: 'Dormir 8 horas',
      de: '8 Stunden schlafen',
      fr: 'Dormir 8 heures',
      ja: '8時間睡眠',
      ar: 'النوم 8 ساعات',
      he: 'לישון 8 שעות',
    },
    icon: '😴',
    color: 2,
    habitType: 'numerical',
    dailyTarget: 8,
    category: 'rest',
    setup: {
      defaultUnit: 'hr',
      targetStep: 0.5,
      targetType: 'atLeast',
      unitOptions: [
        { value: 'hr', defaultTarget: 8, step: 0.5 },
        { value: 'min', defaultTarget: 480, step: 30 },
      ],
    },
  },
  {
    id: 'delayed-caffeine',
    names: {
      en: 'Delay caffeine 90 min',
      uk: 'Кава через 90 хв',
      es: 'Retrasar cafeína 90 min',
      de: 'Koffein 90 Min später',
      fr: 'Retarder caféine 90 min',
      ja: 'カフェインを90分遅らせる',
      ar: 'تأجيل الكافيين 90 د',
      he: 'לעכב קפאין 90 ד׳',
    },
    icon: '☕',
    color: 6,
    habitType: 'boolean',
    defaultTime: '08:30',
    category: 'rest',
  },
  {
    id: 'walk-distance',
    names: {
      en: 'Walk — 3 km',
      uk: 'Ходьба — 3 км',
      es: 'Caminar — 3 km',
      de: 'Gehen — 3 km',
      fr: 'Marche — 3 km',
      ja: 'ウォーク — 3km',
      ar: 'المشي — 3 كم',
      he: 'הליכה — 3 ק״מ',
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
      unitOptions: [
        { value: 'km', defaultTarget: 3, step: 0.5 },
        { value: 'mi', defaultTarget: 2, step: 0.25 },
      ],
    },
  },

  // ------- QUIT ---------
  {
    id: 'quit-smoking',
    names: {
      en: 'Quit smoking',
      uk: 'Кинути палити',
      es: 'Dejar de fumar',
      de: 'Mit Rauchen aufhören',
      fr: 'Arrêter de fumer',
      ja: '禁煙',
      ar: 'الإقلاع عن التدخين',
      he: 'להפסיק לעשן',
    },
    icon: '🚭',
    color: 15,
    habitType: 'boolean',
    category: 'quit',
  },
  {
    id: 'quit-drinking',
    names: {
      en: 'Quit drinking',
      uk: 'Кинути пити',
      es: 'Dejar de beber',
      de: 'Aufhören zu trinken',
      fr: 'Arrêter de boire',
      ja: '禁酒',
      ar: 'الإقلاع عن الشرب',
      he: 'להפסיק לשתות',
    },
    icon: '🍷',
    color: 13,
    habitType: 'boolean',
    category: 'quit',
  },
  {
    id: 'smoking-limit',
    names: {
      en: 'No more than 2 cigarettes',
      uk: 'Не більше 2 сигарет',
      es: 'No más de 2 cigarrillos',
      de: 'Nicht mehr als 2 Zigaretten',
      fr: 'Pas plus de 2 cigarettes',
      ja: 'タバコは2本まで',
      ar: 'لا أكثر من سيجارتين',
      he: 'לא יותר מ-2 סיגריות',
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
      unitOptions: [{ value: 'cigarettes', defaultTarget: 2, step: 1 }],
    },
  },
  {
    id: 'alcohol-limit',
    names: {
      en: 'No more than 1 drink',
      uk: 'Не більше 1 напою',
      es: 'No más de 1 bebida',
      de: 'Nicht mehr als 1 Drink',
      fr: 'Pas plus de 1 verre',
      ja: 'お酒は1杯まで',
      ar: 'لا أكثر من مشروب واحد',
      he: 'לא יותר ממשקה אחד',
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
