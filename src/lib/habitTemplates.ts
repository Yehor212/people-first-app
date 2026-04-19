import { Language } from '@/i18n/translations';
import type { LoopHabitType } from '@/types';

/** Broad category for UI grouping inside the template picker (Phase 3-C). */
export type HabitTemplateCategory = 'body' | 'mind' | 'focus' | 'rest' | 'quit';

export interface HabitTemplate {
  id: string;
  names: Record<Language, string>;
  icon: string;
  color: number;             // Palette index 0-19
  habitType: LoopHabitType;  // 'boolean' | 'numerical'
  dailyTarget?: number;      // For numerical habits
  defaultTime?: string;
  category?: HabitTemplateCategory;
}

export const habitTemplates: HabitTemplate[] = [
  // ------- BODY ---------
  { id: 'water', names: { en: 'Drink water', uk: 'Пити воду', es: 'Beber agua', de: 'Wasser trinken', fr: 'Boire de l\'eau', ja: '水を飲む', ar: 'شرب الماء', he: 'לשתות מים' }, icon: '💧', color: 10, habitType: 'numerical', dailyTarget: 8, category: 'body' },
  { id: 'exercise', names: { en: 'Exercise', uk: 'Вправи', es: 'Ejercicio', de: 'Sport', fr: 'Exercice', ja: '運動', ar: 'تمرين', he: 'פעילות גופנית' }, icon: '🏃', color: 2, habitType: 'boolean', category: 'body' },
  { id: 'healthy-food', names: { en: 'Eat healthy', uk: 'Здорове харчування', es: 'Comer sano', de: 'Gesund essen', fr: 'Manger sainement', ja: '健康的な食事', ar: 'أكل صحي', he: 'לאכול בריא' }, icon: '🥗', color: 5, habitType: 'boolean', defaultTime: '12:00', category: 'body' },
  { id: 'vitamins', names: { en: 'Take vitamins', uk: 'Вітаміни', es: 'Vitaminas', de: 'Vitamine', fr: 'Vitamines', ja: 'ビタミンを摂る', ar: 'تناول الفيتامينات', he: 'לקחת ויטמינים' }, icon: '💊', color: 15, habitType: 'boolean', defaultTime: '09:00', category: 'body' },
  // Phase 3-C addition (2026 trending, Huberman protocol): morning sunlight 10-15 min
  { id: 'sunlight', names: { en: 'Morning sunlight — 10 min', uk: 'Ранкове сонце — 10 хв', es: 'Sol matutino — 10 min', de: 'Morgensonne — 10 Min', fr: 'Soleil du matin — 10 min', ja: '朝日 — 10分', ar: 'شمس الصباح — 10 د', he: 'שמש בוקר — 10 ד׳' }, icon: '🌅', color: 16, habitType: 'boolean', defaultTime: '07:30', category: 'body' },
  // Phase 3-C addition (2026 trending): cold exposure 1-3 min (Huberman dopamine +250%)
  { id: 'cold-exposure', names: { en: 'Cold exposure — 1 min', uk: 'Холодний душ — 1 хв', es: 'Ducha fría — 1 min', de: 'Kaltdusche — 1 Min', fr: 'Douche froide — 1 min', ja: '冷水浴 — 1分', ar: 'دش بارد — 1 د', he: 'מקלחת קרה — 1 ד׳' }, icon: '🧊', color: 17, habitType: 'boolean', defaultTime: '08:00', category: 'body' },
  // Phase 3-C addition (Attia + Huberman): protein target
  { id: 'protein', names: { en: 'Protein target — 30 g', uk: 'Білок — 30 г', es: 'Proteína — 30 g', de: 'Eiweiß — 30 g', fr: 'Protéine — 30 g', ja: 'たんぱく質 — 30g', ar: 'بروتين — 30غ', he: 'חלבון — 30 גר׳' }, icon: '🥚', color: 4, habitType: 'numerical', dailyTarget: 30, defaultTime: '08:30', category: 'body' },

  // ------- MIND ---------
  { id: 'meditate', names: { en: 'Meditate', uk: 'Медитація', es: 'Meditar', de: 'Meditieren', fr: 'Méditer', ja: '瞑想', ar: 'تأمل', he: 'מדיטציה' }, icon: '🧘', color: 13, habitType: 'boolean', category: 'mind' },
  { id: 'journal', names: { en: 'Journal', uk: 'Щоденник', es: 'Diario', de: 'Tagebuch', fr: 'Journal', ja: '日記', ar: 'يوميات', he: 'יומן' }, icon: '✍️', color: 7, habitType: 'boolean', category: 'mind' },
  // Phase 3-C addition: gratitude practice
  { id: 'gratitude', names: { en: 'Name one gratitude', uk: 'Назвати одну вдячність', es: 'Una gratitud', de: 'Eine Dankbarkeit', fr: 'Une gratitude', ja: '感謝を一つ', ar: 'امتنان واحد', he: 'הכרת תודה אחת' }, icon: '🙏', color: 11, habitType: 'boolean', defaultTime: '22:00', category: 'mind' },
  // Phase 3-C addition: breathwork (4-7-8 once)
  { id: 'breathwork', names: { en: 'Breathe — 4-7-8 once', uk: 'Подих — 4-7-8 раз', es: 'Respiración 4-7-8', de: 'Atmen 4-7-8', fr: 'Respiration 4-7-8', ja: '4-7-8呼吸', ar: 'تنفس 4-7-8', he: 'נשימה 4-7-8' }, icon: '🌬️', color: 12, habitType: 'boolean', defaultTime: '15:00', category: 'mind' },

  // ------- FOCUS ---------
  { id: 'read', names: { en: 'Read 10 pages', uk: 'Читати 10 сторінок', es: 'Leer 10 páginas', de: '10 Seiten lesen', fr: 'Lire 10 pages', ja: '10ページ読む', ar: 'قراءة 10 صفحات', he: 'לקרוא 10 עמודים' }, icon: '📚', color: 7, habitType: 'boolean', category: 'focus' },
  { id: 'learn-english', names: { en: 'Learn English', uk: 'Вивчити англійську', es: 'Aprender inglés', de: 'Englisch lernen', fr: 'Apprendre l\'anglais', ja: '英語を学ぶ', ar: 'تعلم الإنجليزية', he: 'ללמוד אנגלית' }, icon: '🗣️', color: 2, habitType: 'boolean', category: 'focus' },
  // Phase 3-C addition (2026): phone-free first hour (dopamine detox)
  { id: 'phone-free-morning', names: { en: 'Phone-free first hour', uk: 'Без телефону першу годину', es: 'Sin móvil la 1ª hora', de: 'Eine Stunde ohne Handy', fr: '1 h sans téléphone', ja: '朝1時間スマホなし', ar: 'ساعة بدون هاتف', he: 'שעה בלי טלפון' }, icon: '📵', color: 14, habitType: 'boolean', defaultTime: '07:00', category: 'focus' },
  // Phase 3-C addition: deep work 25 min
  { id: 'deep-work', names: { en: 'Deep work — 25 min', uk: 'Глибока робота — 25 хв', es: 'Trabajo profundo — 25 min', de: 'Deep Work — 25 Min', fr: 'Travail profond — 25 min', ja: 'ディープワーク 25分', ar: 'عمل عميق — 25 د', he: 'עבודה עמוקה — 25 ד׳' }, icon: '🎯', color: 3, habitType: 'boolean', defaultTime: '09:30', category: 'focus' },

  // ------- REST ---------
  { id: 'sleep', names: { en: 'Sleep 8 hours', uk: 'Сон 8 годин', es: 'Dormir 8 horas', de: '8 Stunden schlafen', fr: 'Dormir 8 heures', ja: '8時間睡眠', ar: 'النوم 8 ساعات', he: 'לישון 8 שעות' }, icon: '😴', color: 2, habitType: 'boolean', category: 'rest' },
  // Phase 3-C addition (2026 Huberman): delayed caffeine (wait 90-120 min)
  { id: 'delayed-caffeine', names: { en: 'Delay caffeine 90 min', uk: 'Кава через 90 хв', es: 'Retrasar cafeína 90 min', de: 'Koffein 90 Min später', fr: 'Retarder caféine 90 min', ja: 'カフェインを90分遅らせる', ar: 'تأجيل الكافيين 90 د', he: 'לעכב קפאין 90 ד׳' }, icon: '☕', color: 6, habitType: 'boolean', defaultTime: '08:30', category: 'rest' },

  // ------- QUIT ---------
  { id: 'quit-smoking', names: { en: 'Quit smoking', uk: 'Кинути палити', es: 'Dejar de fumar', de: 'Mit Rauchen aufhören', fr: 'Arrêter de fumer', ja: '禁煙', ar: 'الإقلاع عن التدخين', he: 'להפסיק לעשן' }, icon: '🚭', color: 15, habitType: 'boolean', category: 'quit' },
  { id: 'quit-drinking', names: { en: 'Quit drinking', uk: 'Кинути пити', es: 'Dejar de beber', de: 'Aufhören zu trinken', fr: 'Arrêter de boire', ja: '禁酒', ar: 'الإقلاع عن الشرب', he: 'להפסיק לשתות' }, icon: '🍷', color: 13, habitType: 'boolean', category: 'quit' },
];

export function getHabitTemplateName(templateId: string, language: Language): string {
  const template = habitTemplates.find(t => t.id === templateId);
  return template?.names[language] || template?.names.en || templateId;
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
