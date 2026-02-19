import { describe, it, expect } from 'vitest';
import {
  BUILTIN_TEMPLATES,
  generateTemplateContent,
} from '../journalTemplates';
import type { JournalTemplate } from '../journalTemplates';

// ============================================
// BUILTIN_TEMPLATES
// ============================================

describe('BUILTIN_TEMPLATES', () => {
  it('contains 5 templates', () => {
    expect(BUILTIN_TEMPLATES).toHaveLength(5);
  });

  it('each template has id, nameKey, icon, and sections', () => {
    for (const template of BUILTIN_TEMPLATES) {
      expect(typeof template.id).toBe('string');
      expect(template.id.length).toBeGreaterThan(0);
      expect(typeof template.nameKey).toBe('string');
      expect(typeof template.descriptionKey).toBe('string');
      expect(typeof template.icon).toBe('string');
      expect(Array.isArray(template.sections)).toBe(true);
      expect(template.sections.length).toBeGreaterThan(0);
    }
  });

  it('each section has labelKey and placeholder', () => {
    for (const template of BUILTIN_TEMPLATES) {
      for (const section of template.sections) {
        expect(typeof section.labelKey).toBe('string');
        expect(typeof section.placeholder).toBe('string');
        expect(section.placeholder.length).toBeGreaterThan(0);
      }
    }
  });

  it('all template ids are unique', () => {
    const ids = BUILTIN_TEMPLATES.map(t => t.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

// ============================================
// generateTemplateContent
// ============================================

describe('generateTemplateContent', () => {
  it('uses translated labels when available', () => {
    const template: JournalTemplate = {
      id: 'test',
      nameKey: 'test',
      descriptionKey: 'testDesc',
      icon: 'X',
      sections: [{ labelKey: 'myLabel', placeholder: 'fallback text' }],
    };
    const translations: Record<string, string> = { myLabel: 'Translated Label' };
    const content = generateTemplateContent(template, translations);
    expect(content).toContain('**Translated Label**');
    expect(content).not.toContain('fallback text');
  });

  it('falls back to placeholder when translation is missing', () => {
    const template: JournalTemplate = {
      id: 'test',
      nameKey: 'test',
      descriptionKey: 'testDesc',
      icon: 'X',
      sections: [{ labelKey: 'missingKey', placeholder: 'Use this instead' }],
    };
    const content = generateTemplateContent(template, {});
    expect(content).toContain('**Use this instead**');
  });

  it('joins multiple sections with newline separator', () => {
    const template: JournalTemplate = {
      id: 'test',
      nameKey: 'test',
      descriptionKey: 'testDesc',
      icon: 'X',
      sections: [
        { labelKey: 'a', placeholder: 'Section A' },
        { labelKey: 'b', placeholder: 'Section B' },
      ],
    };
    const content = generateTemplateContent(template, {});
    expect(content).toContain('**Section A**');
    expect(content).toContain('**Section B**');
    // Two sections joined with newline between them
    const parts = content.split('\n');
    expect(parts.length).toBeGreaterThan(2);
  });

  it('works with a real built-in template', () => {
    const template = BUILTIN_TEMPLATES[0]; // daily-reflection
    const content = generateTemplateContent(template, {});
    // Should contain placeholders as bold labels since no translations provided
    for (const section of template.sections) {
      expect(content).toContain(`**${section.placeholder}**`);
    }
  });
});
