import { describe, it, expect } from 'vitest';
import {
  habitTemplates,
  getHabitTemplateName,
  findTemplateIdByName,
  ROUTINE_STARTER_TEMPLATE_IDS,
  resolveHabitTemplateSetup,
} from '../habitTemplates';
import type { Language } from '@/i18n/translations';

const ALL_LANGUAGES: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];

// ============================================
// habitTemplates
// ============================================

describe('habitTemplates', () => {
  it('contains 32 templates', () => {
    // Phase 3-C originally extended the starter set from 11 -> 19.
    // Measurable-template expansion added walk-distance + 2 limit templates.
    // V2 competitor-standard refresh adds dental, outdoor, focus, and reset habits.
    expect(habitTemplates).toHaveLength(32);
  });

  it('each template has id, names, icon, color, and type', () => {
    for (const template of habitTemplates) {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.icon).toBe('string');
      expect(typeof template.color).toBe('number');
      expect(typeof template.habitType).toBe('string');
      expect(template.names).toBeDefined();
    }
  });

  it('each template has all 8 language keys in names', () => {
    for (const template of habitTemplates) {
      for (const lang of ALL_LANGUAGES) {
        expect(template.names[lang]).toBeDefined();
        expect(typeof template.names[lang]).toBe('string');
        expect(template.names[lang].length).toBeGreaterThan(0);
      }
    }
  });

  it('all template ids are unique', () => {
    const ids = habitTemplates.map((t) => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('defines localized broad V2 routine starter templates', () => {
    const starters = ROUTINE_STARTER_TEMPLATE_IDS.map((id) =>
      habitTemplates.find((template) => template.id === id),
    );

    expect(starters.map((template) => template?.id)).toEqual([
      'drink-water',
      'walk-distance',
      'exercise',
      'read',
      'meditate',
      'sleep',
    ]);
    for (const starter of starters) {
      expect(starter).toBeDefined();
      if (!starter) continue;
      expect(['boolean', 'numerical']).toContain(starter.habitType);
      expect(starter.category).toBeTruthy();
      for (const lang of ALL_LANGUAGES) {
        expect(starter.names[lang], `${starter.id}.${lang}`).toBeTruthy();
      }
    }
    expect(starters.some((template) => template?.habitType === 'numerical')).toBe(true);
  });

  it('assigns smart numerical entry modes to measurable templates', () => {
    const setupById = Object.fromEntries(
      habitTemplates
        .filter((template) => template.habitType === 'numerical')
        .map((template) => [template.id, resolveHabitTemplateSetup(template).quickEntryMode]),
    );

    expect(setupById['walk-distance']).toBe('completeTarget');
    expect(setupById.read).toBe('incrementStep');
    expect(setupById['deep-work']).toBe('completeTarget');
    expect(setupById['movement-break']).toBe('incrementStep');
    expect(setupById.water).toBe('incrementStep');
    expect(setupById.protein).toBe('completeTarget');
    expect(setupById['smoking-limit']).toBe('limitCheck');
    expect(setupById['alcohol-limit']).toBe('limitCheck');
  });

  it('separates numerical daily targets from natural tap steps', () => {
    const read = habitTemplates.find((template) => template.id === 'read');
    const protein = habitTemplates.find((template) => template.id === 'protein');

    expect(read).toBeDefined();
    expect(protein).toBeDefined();
    expect(read && resolveHabitTemplateSetup(read)).toMatchObject({
      targetValue: 10,
      targetStep: 1,
      quickEntryMode: 'incrementStep',
    });
    expect(protein && resolveHabitTemplateSetup(protein)).toMatchObject({
      targetValue: 30,
      targetStep: 5,
      quickEntryMode: 'completeTarget',
    });
  });

  it('models sleep as a routine with a suggested time instead of an hour counter', () => {
    const bedtime = habitTemplates.find((template) => template.id === 'sleep');

    expect(bedtime?.habitType).toBe('boolean');
    expect(bedtime?.defaultTime).toBe('22:00');
    expect(bedtime?.names.en).toBe('Sleep routine');
    expect(bedtime?.names.uk).toBe('Режим сну');
  });
});

// ============================================
// getHabitTemplateName
// ============================================

describe('getHabitTemplateName', () => {
  it('returns English name for en language', () => {
    const name = getHabitTemplateName('drink-water', 'en');
    expect(name).toBe('Drink water');
  });

  it('returns localized names for routine starters', () => {
    const name = getHabitTemplateName('walk-run', 'uk');
    expect(name).toBeTruthy();
    expect(name).not.toBe('Daily walk');
  });

  it('returns template id as fallback for unknown template', () => {
    const name = getHabitTemplateName('nonexistent', 'en');
    expect(name).toBe('nonexistent');
  });
});

// ============================================
// findTemplateIdByName
// ============================================

describe('findTemplateIdByName', () => {
  it('finds template by exact English name', () => {
    expect(findTemplateIdByName('Drink water')).toBe('drink-water');
  });

  it('is case-insensitive', () => {
    expect(findTemplateIdByName('drink water')).toBe('drink-water');
    expect(findTemplateIdByName('WORKOUT')).toBe('exercise');
  });

  it('returns undefined for non-matching name', () => {
    expect(findTemplateIdByName('Fly to the moon')).toBeUndefined();
  });
});
