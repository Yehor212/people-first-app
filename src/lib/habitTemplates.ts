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
  { id: 'water', names: { en: 'Drink water', ru: 'Пить воду', uk: 'Пити воду', es: 'Beber agua', de: 'Wasser trinken', fr: 'Boire de l\'eau' }, icon: '💧', color: 'bg-primary', type: 'multiple', dailyTarget: 8 },
  { id: 'exercise', names: { en: 'Exercise', ru: 'Упражнения', uk: 'Вправи', es: 'Ejercicio', de: 'Sport', fr: 'Exercice' }, icon: '🏃', color: 'bg-accent', type: 'daily' },
  { id: 'read', names: { en: 'Read', ru: 'Читать', uk: 'Читати', es: 'Leer', de: 'Lesen', fr: 'Lire' }, icon: '📚', color: 'bg-mood-good', type: 'daily' },
  { id: 'meditate', names: { en: 'Meditate', ru: 'Медитация', uk: 'Медитація', es: 'Meditar', de: 'Meditieren', fr: 'Méditer' }, icon: '🧘', color: 'bg-mood-okay', type: 'daily' },
  { id: 'vitamins', names: { en: 'Take vitamins', ru: 'Витамины', uk: 'Вітаміни', es: 'Vitaminas', de: 'Vitamine', fr: 'Vitamines' }, icon: '💊', color: 'bg-mood-great', type: 'scheduled', defaultTime: '09:00' },
  { id: 'healthy-food', names: { en: 'Eat healthy', ru: 'Здоровое питание', uk: 'Здорове харчування', es: 'Comer sano', de: 'Gesund essen', fr: 'Manger sainement' }, icon: '🥗', color: 'bg-primary', type: 'scheduled', defaultTime: '12:00' },
  { id: 'sleep', names: { en: 'Sleep 8 hours', ru: 'Сон 8 часов', uk: 'Сон 8 годин', es: 'Dormir 8 horas', de: '8 Stunden schlafen', fr: 'Dormir 8 heures' }, icon: '😴', color: 'bg-accent', type: 'daily' },
  { id: 'journal', names: { en: 'Journal', ru: 'Дневник', uk: 'Щоденник', es: 'Diario', de: 'Tagebuch', fr: 'Journal' }, icon: '✍️', color: 'bg-mood-good', type: 'daily' },
  { id: 'quit-smoking', names: { en: 'Quit smoking', ru: 'Бросить курить', uk: 'Кинути палити', es: 'Dejar de fumar', de: 'Mit Rauchen aufhören', fr: 'Arrêter de fumer' }, icon: '🚭', color: 'bg-mood-great', type: 'continuous' },
  { id: 'quit-drinking', names: { en: 'Quit drinking', ru: 'Бросить пить', uk: 'Кинути пити', es: 'Dejar de beber', de: 'Aufhören zu trinken', fr: 'Arrêter de boire' }, icon: '🍷', color: 'bg-mood-okay', type: 'continuous' },
  { id: 'learn-english', names: { en: 'Learn English', ru: 'Выучить английский', uk: 'Вивчити англійську', es: 'Aprender inglés', de: 'Englisch lernen', fr: 'Apprendre l\'anglais' }, icon: '🇬🇧', color: 'bg-accent', type: 'daily' },
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
