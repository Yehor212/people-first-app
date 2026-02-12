import { Language } from '@/i18n/translations';
import { HabitType } from '@/types';

interface HabitTemplate {
  id: string;
  names: Record<Language, string>;
  icon: string;
  color: string;
  type: HabitType;
  dailyTarget?: number;
  defaultTime?: string;
}

export const habitTemplates: HabitTemplate[] = [
  { id: 'water', names: { en: 'Drink water', uk: 'Пити воду', es: 'Beber agua', de: 'Wasser trinken', fr: 'Boire de l\'eau', ja: '水を飲む', ar: 'شرب الماء', he: 'לשתות מים' }, icon: '💧', color: 'bg-primary', type: 'multiple', dailyTarget: 8 },
  { id: 'exercise', names: { en: 'Exercise', uk: 'Вправи', es: 'Ejercicio', de: 'Sport', fr: 'Exercice', ja: '運動', ar: 'تمرين', he: 'פעילות גופנית' }, icon: '🏃', color: 'bg-accent', type: 'daily' },
  { id: 'read', names: { en: 'Read', uk: 'Читати', es: 'Leer', de: 'Lesen', fr: 'Lire', ja: '読書', ar: 'قراءة', he: 'לקרוא' }, icon: '📚', color: 'bg-mood-good', type: 'daily' },
  { id: 'meditate', names: { en: 'Meditate', uk: 'Медитація', es: 'Meditar', de: 'Meditieren', fr: 'Méditer', ja: '瞑想', ar: 'تأمل', he: 'מדיטציה' }, icon: '🧘', color: 'bg-mood-okay', type: 'daily' },
  { id: 'vitamins', names: { en: 'Take vitamins', uk: 'Вітаміни', es: 'Vitaminas', de: 'Vitamine', fr: 'Vitamines', ja: 'ビタミンを摂る', ar: 'تناول الفيتامينات', he: 'לקחת ויטמינים' }, icon: '💊', color: 'bg-mood-great', type: 'scheduled', defaultTime: '09:00' },
  { id: 'healthy-food', names: { en: 'Eat healthy', uk: 'Здорове харчування', es: 'Comer sano', de: 'Gesund essen', fr: 'Manger sainement', ja: '健康的な食事', ar: 'أكل صحي', he: 'לאכול בריא' }, icon: '🥗', color: 'bg-primary', type: 'scheduled', defaultTime: '12:00' },
  { id: 'sleep', names: { en: 'Sleep 8 hours', uk: 'Сон 8 годин', es: 'Dormir 8 horas', de: '8 Stunden schlafen', fr: 'Dormir 8 heures', ja: '8時間睡眠', ar: 'النوم 8 ساعات', he: 'לישון 8 שעות' }, icon: '😴', color: 'bg-accent', type: 'daily' },
  { id: 'journal', names: { en: 'Journal', uk: 'Щоденник', es: 'Diario', de: 'Tagebuch', fr: 'Journal', ja: '日記', ar: 'يوميات', he: 'יומן' }, icon: '✍️', color: 'bg-mood-good', type: 'daily' },
  { id: 'quit-smoking', names: { en: 'Quit smoking', uk: 'Кинути палити', es: 'Dejar de fumar', de: 'Mit Rauchen aufhören', fr: 'Arrêter de fumer', ja: '禁煙', ar: 'الإقلاع عن التدخين', he: 'להפסיק לעשן' }, icon: '🚭', color: 'bg-mood-great', type: 'continuous' },
  { id: 'quit-drinking', names: { en: 'Quit drinking', uk: 'Кинути пити', es: 'Dejar de beber', de: 'Aufhören zu trinken', fr: 'Arrêter de boire', ja: '禁酒', ar: 'الإقلاع عن الشرب', he: 'להפסיק לשתות' }, icon: '🍷', color: 'bg-mood-okay', type: 'continuous' },
  { id: 'learn-english', names: { en: 'Learn English', uk: 'Вивчити англійську', es: 'Aprender inglés', de: 'Englisch lernen', fr: 'Apprendre l\'anglais', ja: '英語を学ぶ', ar: 'تعلم الإنجليزية', he: 'ללמוד אנגלית' }, icon: '🇬🇧', color: 'bg-accent', type: 'daily' },
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
