import { Language } from '@/i18n/translations';

interface HabitTemplate {
  id: string;
  names: Record<Language, string>;
  icon: string;
  color: string;
}

export const habitTemplates: HabitTemplate[] = [
  { id: 'water', names: { en: 'Drink water', ru: 'Пить воду', uk: 'Пити воду', es: 'Beber agua', de: 'Wasser trinken', fr: 'Boire de l\'eau' }, icon: '💧', color: 'bg-primary' },
  { id: 'exercise', names: { en: 'Exercise', ru: 'Упражнения', uk: 'Вправи', es: 'Ejercicio', de: 'Sport', fr: 'Exercice' }, icon: '🏃', color: 'bg-accent' },
  { id: 'read', names: { en: 'Read', ru: 'Читать', uk: 'Читати', es: 'Leer', de: 'Lesen', fr: 'Lire' }, icon: '📚', color: 'bg-mood-good' },
  { id: 'meditate', names: { en: 'Meditate', ru: 'Медитация', uk: 'Медитація', es: 'Meditar', de: 'Meditieren', fr: 'Méditer' }, icon: '🧘', color: 'bg-mood-okay' },
  { id: 'vitamins', names: { en: 'Take vitamins', ru: 'Витамины', uk: 'Вітаміни', es: 'Vitaminas', de: 'Vitamine', fr: 'Vitamines' }, icon: '💊', color: 'bg-mood-great' },
  { id: 'healthy-food', names: { en: 'Eat healthy', ru: 'Здоровое питание', uk: 'Здорове харчування', es: 'Comer sano', de: 'Gesund essen', fr: 'Manger sainement' }, icon: '🥗', color: 'bg-primary' },
  { id: 'sleep', names: { en: 'Sleep 8 hours', ru: 'Сон 8 часов', uk: 'Сон 8 годин', es: 'Dormir 8 horas', de: '8 Stunden schlafen', fr: 'Dormir 8 heures' }, icon: '😴', color: 'bg-accent' },
  { id: 'journal', names: { en: 'Journal', ru: 'Дневник', uk: 'Щоденник', es: 'Diario', de: 'Tagebuch', fr: 'Journal' }, icon: '✍️', color: 'bg-mood-good' },
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
