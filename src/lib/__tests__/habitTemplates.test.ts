import { describe, it, expect } from 'vitest';
import {
  habitTemplates,
  getHabitTemplateName,
  findTemplateIdByName,
} from '../habitTemplates';
import type { Language } from '@/i18n/translations';

const ALL_LANGUAGES: Language[] = ['en', 'uk', 'es', 'de', 'fr', 'ja', 'ar', 'he'];

// ============================================
// habitTemplates
// ============================================

describe('habitTemplates', () => {
  it('contains 11 templates', () => {
    expect(habitTemplates).toHaveLength(11);
  });

  it('each template has id, names, icon, color, and type', () => {
    for (const template of habitTemplates) {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.icon).toBe('string');
      expect(typeof template.color).toBe('string');
      expect(typeof template.type).toBe('string');
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
    const ids = habitTemplates.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================
// getHabitTemplateName
// ============================================

describe('getHabitTemplateName', () => {
  it('returns English name for en language', () => {
    const name = getHabitTemplateName('water', 'en');
    expect(name).toBe('Drink water');
  });

  it('returns Ukrainian name for uk language', () => {
    const name = getHabitTemplateName('water', 'uk');
    expect(name).toBe('\u041F\u0438\u0442\u0438 \u0432\u043E\u0434\u0443');
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
    expect(findTemplateIdByName('Drink water')).toBe('water');
  });

  it('finds template by Ukrainian name (case-insensitive)', () => {
    expect(findTemplateIdByName('\u041F\u0438\u0442\u0438 \u0432\u043E\u0434\u0443')).toBe('water');
  });

  it('is case-insensitive', () => {
    expect(findTemplateIdByName('drink water')).toBe('water');
    expect(findTemplateIdByName('EXERCISE')).toBe('exercise');
  });

  it('returns undefined for non-matching name', () => {
    expect(findTemplateIdByName('Fly to the moon')).toBeUndefined();
  });
});
