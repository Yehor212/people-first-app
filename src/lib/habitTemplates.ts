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
    names: { en: 'Drink water', uk: 'РџРёС‚Рё РІРѕРґСѓ', es: 'Beber agua', de: 'Wasser trinken', fr: 'Boire de l\'eau', ja: 'ж°ґг‚’йЈІг‚Ђ', ar: 'ШґШ±ШЁ Ш§Щ„Щ…Ш§ШЎ', he: 'ЧњЧ©ЧЄЧ•ЧЄ ЧћЧ™Чќ' },
    icon: 'рџ’§',
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
  { id: 'exercise', names: { en: 'Exercise', uk: 'Р’РїСЂР°РІРё', es: 'Ejercicio', de: 'Sport', fr: 'Exercice', ja: 'йЃ‹е‹•', ar: 'ШЄЩ…Ш±ЩЉЩ†', he: 'Ч¤ЧўЧ™ЧњЧ•ЧЄ Ч’Ч•Ч¤Ч Ч™ЧЄ' }, icon: 'рџЏѓ', color: 2, habitType: 'boolean', category: 'body' },
  { id: 'healthy-food', names: { en: 'Eat healthy', uk: 'Р—РґРѕСЂРѕРІРµ С…Р°СЂС‡СѓРІР°РЅРЅСЏ', es: 'Comer sano', de: 'Gesund essen', fr: 'Manger sainement', ja: 'еЃҐеє·зљ„гЃЄйЈџдє‹', ar: 'ШЈЩѓЩ„ ШµШ­ЩЉ', he: 'ЧњЧђЧ›Ч•Чљ Ч‘ЧЁЧ™Чђ' }, icon: 'рџҐ—', color: 5, habitType: 'boolean', defaultTime: '12:00', category: 'body' },
  { id: 'vitamins', names: { en: 'Take vitamins', uk: 'Р’С–С‚Р°РјС–РЅРё', es: 'Vitaminas', de: 'Vitamine', fr: 'Vitamines', ja: 'гѓ“г‚їгѓџгѓіг‚’ж‘‚г‚‹', ar: 'ШЄЩ†Ш§Щ€Щ„ Ш§Щ„ЩЃЩЉШЄШ§Щ…ЩЉЩ†Ш§ШЄ', he: 'ЧњЧ§Ч—ЧЄ Ч•Ч™ЧЧћЧ™Ч Ч™Чќ' }, icon: 'рџ’Љ', color: 15, habitType: 'boolean', defaultTime: '09:00', category: 'body' },
  {
    id: 'sunlight',
    names: { en: 'Morning sunlight вЂ” 10 min', uk: 'Р Р°РЅРєРѕРІРµ СЃРѕРЅС†Рµ вЂ” 10 С…РІ', es: 'Sol matutino вЂ” 10 min', de: 'Morgensonne вЂ” 10 Min', fr: 'Soleil du matin вЂ” 10 min', ja: 'жњќж—Ґ вЂ” 10е€†', ar: 'ШґЩ…Ші Ш§Щ„ШµШЁШ§Ш­ вЂ” 10 ШЇ', he: 'Ч©ЧћЧ© Ч‘Ч•Ч§ЧЁ вЂ” 10 Ч“Чі' },
    icon: 'рџЊ…',
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
    names: { en: 'Cold exposure вЂ” 1 min', uk: 'РҐРѕР»РѕРґРЅРёР№ РґСѓС€ вЂ” 1 С…РІ', es: 'Ducha frГ­a вЂ” 1 min', de: 'Kaltdusche вЂ” 1 Min', fr: 'Douche froide вЂ” 1 min', ja: 'е†·ж°ґжµґ вЂ” 1е€†', ar: 'ШЇШґ ШЁШ§Ш±ШЇ вЂ” 1 ШЇ', he: 'ЧћЧ§ЧњЧ—ЧЄ Ч§ЧЁЧ” вЂ” 1 Ч“Чі' },
    icon: 'рџ§Љ',
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
    names: { en: 'Protein target вЂ” 30 g', uk: 'Р‘С–Р»РѕРє вЂ” 30 Рі', es: 'ProteГ­na вЂ” 30 g', de: 'EiweiГџ вЂ” 30 g', fr: 'ProtГ©ine вЂ” 30 g', ja: 'гЃџг‚“гЃ±гЃЏиіЄ вЂ” 30g', ar: 'ШЁШ±Щ€ШЄЩЉЩ† вЂ” 30Шє', he: 'Ч—ЧњЧ‘Ч•Чџ вЂ” 30 Ч’ЧЁЧі' },
    icon: 'рџҐљ',
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
  { id: 'meditate', names: { en: 'Meditate', uk: 'РњРµРґРёС‚Р°С†С–СЏ', es: 'Meditar', de: 'Meditieren', fr: 'MГ©diter', ja: 'зћ‘жѓі', ar: 'ШЄШЈЩ…Щ„', he: 'ЧћЧ“Ч™ЧЧ¦Ч™Ч”' }, icon: 'рџ§', color: 13, habitType: 'boolean', category: 'mind' },
  { id: 'journal', names: { en: 'Journal', uk: 'Р©РѕРґРµРЅРЅРёРє', es: 'Diario', de: 'Tagebuch', fr: 'Journal', ja: 'ж—ҐиЁ', ar: 'ЩЉЩ€Щ…ЩЉШ§ШЄ', he: 'Ч™Ч•ЧћЧџ' }, icon: 'вњЌпёЏ', color: 7, habitType: 'boolean', category: 'mind' },
  { id: 'gratitude', names: { en: 'Name one gratitude', uk: 'РќР°Р·РІР°С‚Рё РѕРґРЅСѓ РІРґСЏС‡РЅС–СЃС‚СЊ', es: 'Una gratitud', de: 'Eine Dankbarkeit', fr: 'Une gratitude', ja: 'ж„џи¬ќг‚’дёЂгЃ¤', ar: 'Ш§Щ…ШЄЩ†Ш§Щ† Щ€Ш§Ш­ШЇ', he: 'Ч”Ч›ЧЁЧЄ ЧЄЧ•Ч“Ч” ЧђЧ—ЧЄ' }, icon: 'рџ™Џ', color: 11, habitType: 'boolean', defaultTime: '22:00', category: 'mind' },
  { id: 'breathwork', names: { en: 'Breathe вЂ” 4-7-8 once', uk: 'РџРѕРґРёС… вЂ” 4-7-8 СЂР°Р·', es: 'RespiraciГіn 4-7-8', de: 'Atmen 4-7-8', fr: 'Respiration 4-7-8', ja: '4-7-8е‘јеђё', ar: 'ШЄЩ†ЩЃШі 4-7-8', he: 'Ч Ч©Ч™ЧћЧ” 4-7-8' }, icon: 'рџЊ¬пёЏ', color: 12, habitType: 'boolean', defaultTime: '15:00', category: 'mind' },

  // ------- FOCUS ---------
  {
    id: 'read',
    names: { en: 'Read 10 pages', uk: 'Р§РёС‚Р°С‚Рё 10 СЃС‚РѕСЂС–РЅРѕРє', es: 'Leer 10 pГЎginas', de: '10 Seiten lesen', fr: 'Lire 10 pages', ja: '10гѓљгѓјг‚ёиЄ­г‚Ђ', ar: 'Щ‚Ш±Ш§ШЎШ© 10 ШµЩЃШ­Ш§ШЄ', he: 'ЧњЧ§ЧЁЧ•Чђ 10 ЧўЧћЧ•Ч“Ч™Чќ' },
    icon: 'рџ“љ',
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
  { id: 'learn-english', names: { en: 'Learn English', uk: 'Р’РёРІС‡РёС‚Рё Р°РЅРіР»С–Р№СЃСЊРєСѓ', es: 'Aprender inglГ©s', de: 'Englisch lernen', fr: 'Apprendre l\'anglais', ja: 'и‹±иЄћг‚’е­¦гЃ¶', ar: 'ШЄШ№Щ„Щ… Ш§Щ„ШҐЩ†Ш¬Щ„ЩЉШІЩЉШ©', he: 'ЧњЧњЧћЧ•Ч“ ЧђЧ Ч’ЧњЧ™ЧЄ' }, icon: 'рџ—ЈпёЏ', color: 2, habitType: 'boolean', category: 'focus' },
  { id: 'phone-free-morning', names: { en: 'Phone-free first hour', uk: 'Р‘РµР· С‚РµР»РµС„РѕРЅСѓ РїРµСЂС€Сѓ РіРѕРґРёРЅСѓ', es: 'Sin mГіvil la 1ВЄ hora', de: 'Eine Stunde ohne Handy', fr: '1 h sans tГ©lГ©phone', ja: 'жњќ1ж™‚й–“г‚№гѓћгѓ›гЃЄгЃ—', ar: 'ШіШ§Ш№Ш© ШЁШЇЩ€Щ† Щ‡Ш§ШЄЩЃ', he: 'Ч©ЧўЧ” Ч‘ЧњЧ™ ЧЧњЧ¤Ч•Чџ' }, icon: 'рџ“µ', color: 14, habitType: 'boolean', defaultTime: '07:00', category: 'focus' },
  {
    id: 'deep-work',
    names: { en: 'Deep work вЂ” 25 min', uk: 'Р“Р»РёР±РѕРєР° СЂРѕР±РѕС‚Р° вЂ” 25 С…РІ', es: 'Trabajo profundo вЂ” 25 min', de: 'Deep Work вЂ” 25 Min', fr: 'Travail profond вЂ” 25 min', ja: 'гѓ‡г‚Јгѓјгѓ—гѓЇгѓјг‚Ї 25е€†', ar: 'Ш№Щ…Щ„ Ш№Щ…ЩЉЩ‚ вЂ” 25 ШЇ', he: 'ЧўЧ‘Ч•Ч“Ч” ЧўЧћЧ•Ч§Ч” вЂ” 25 Ч“Чі' },
    icon: 'рџЋЇ',
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
    names: { en: 'Sleep 8 hours', uk: 'РЎРѕРЅ 8 РіРѕРґРёРЅ', es: 'Dormir 8 horas', de: '8 Stunden schlafen', fr: 'Dormir 8 heures', ja: '8ж™‚й–“зќЎзњ ', ar: 'Ш§Щ„Щ†Щ€Щ… 8 ШіШ§Ш№Ш§ШЄ', he: 'ЧњЧ™Ч©Ч•Чџ 8 Ч©ЧўЧ•ЧЄ' },
    icon: 'рџґ',
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
  { id: 'delayed-caffeine', names: { en: 'Delay caffeine 90 min', uk: 'РљР°РІР° С‡РµСЂРµР· 90 С…РІ', es: 'Retrasar cafeГ­na 90 min', de: 'Koffein 90 Min spГ¤ter', fr: 'Retarder cafГ©ine 90 min', ja: 'г‚«гѓ•г‚§г‚¤гѓіг‚’90е€†йЃ…г‚‰гЃ›г‚‹', ar: 'ШЄШЈШ¬ЩЉЩ„ Ш§Щ„ЩѓШ§ЩЃЩЉЩЉЩ† 90 ШЇ', he: 'ЧњЧўЧ›Ч‘ Ч§Ч¤ЧђЧ™Чџ 90 Ч“Чі' }, icon: 'в•', color: 6, habitType: 'boolean', defaultTime: '08:30', category: 'rest' },
  {
    id: 'walk-distance',
    names: { en: 'Walk вЂ” 3 km', uk: 'РҐРѕРґСЊР±Р° вЂ” 3 РєРј', es: 'Caminar вЂ” 3 km', de: 'Gehen вЂ” 3 km', fr: 'Marche вЂ” 3 km', ja: 'г‚¦РѕРє вЂ” 3km', ar: 'Ш§Щ„Щ…ШґЩЉ вЂ” 3 РєЩ…', he: 'Ч”ЧњЧ™Ч›Ч” вЂ” 3 Ч§"Чћ' },
    icon: 'рџљ¶',
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
  { id: 'quit-smoking', names: { en: 'Quit smoking', uk: 'РљРёРЅСѓС‚Рё РїР°Р»РёС‚Рё', es: 'Dejar de fumar', de: 'Mit Rauchen aufhГ¶ren', fr: 'ArrГЄter de fumer', ja: 'з¦Ѓз…™', ar: 'Ш§Щ„ШҐЩ‚Щ„Ш§Ш№ Ш№Щ† Ш§Щ„ШЄШЇШ®ЩЉЩ†', he: 'ЧњЧ”Ч¤ЧЎЧ™Ч§ ЧњЧўЧ©Чџ' }, icon: 'рџљ­', color: 15, habitType: 'boolean', category: 'quit' },
  { id: 'quit-drinking', names: { en: 'Quit drinking', uk: 'РљРёРЅСѓС‚Рё РїРёС‚Рё', es: 'Dejar de beber', de: 'AufhГ¶ren zu trinken', fr: 'ArrГЄter de boire', ja: 'з¦Ѓй…’', ar: 'Ш§Щ„ШҐЩ‚Щ„Ш§Ш№ Ш№Щ† Ш§Щ„ШґШ±ШЁ', he: 'ЧњЧ”Ч¤ЧЎЧ™Ч§ ЧњЧ©ЧЄЧ•ЧЄ' }, icon: 'рџЌ·', color: 13, habitType: 'boolean', category: 'quit' },
  {
    id: 'smoking-limit',
    names: { en: 'No more than 2 cigarettes', uk: 'РќРµ Р±С–Р»СЊС€Рµ 2 СЃРёРіР°СЂРµС‚', es: 'No mГЎs de 2 cigarrillos', de: 'Nicht mehr als 2 Zigaretten', fr: 'Pas plus de 2 cigarettes', ja: 'гЃџгЃ°гЃ“гЃЇ2жњ¬гЃѕРґ', ar: 'Щ„Ш§ ЩЉШІЩЉШЇ Ш№Щ† ШіЩЉШ¬Ш§Ш±ШЄЩЉЩ†', he: 'ЧњЧђ Ч™Ч•ЧЄЧЁ Чћ-2 ЧЎЧ™Ч’ЧЁЧ™Ч•ЧЄ' },
    icon: 'рџљ¬',
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
    names: { en: 'No more than 1 drink', uk: 'РќРµ Р±С–Р»СЊС€Рµ 1 РЅР°РїРѕСЋ', es: 'No mГЎs de 1 bebida', de: 'Nicht mehr als 1 Drink', fr: 'Pas plus de 1 verre', ja: 'гЃЉй…’гЃЇ1жќЇгЃѕРґ', ar: 'Щ„Ш§ ЩЉШІЩЉШЇ Ш№Щ† Щ…ШґШ±Щ€ШЁ Щ€Ш§Ш­ШЇ', he: 'ЧњЧђ Ч™Ч•ЧЄЧЁ ЧћЧћЧ©Ч§Ч” ЧђЧ—Ч“' },
    icon: 'рџЌ·',
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
  const template = habitTemplates.find(t => t.id === templateId);
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
