/** Built-in journal writing templates */

import type { JournalIconKey } from './types';

export interface JournalTemplate {
  id: string;
  nameKey: string;
  descriptionKey: string;
  iconKey: JournalIconKey;
  sections: { labelKey: string; placeholder: string }[];
}

export const BUILTIN_TEMPLATES: JournalTemplate[] = [
  {
    id: 'daily-reflection',
    nameKey: 'journalTemplateDailyReflection',
    descriptionKey: 'journalTemplateDailyReflectionDesc',
    iconKey: 'bookOpen',
    sections: [
      { labelKey: 'journalTemplateHighlight', placeholder: 'What was the highlight of your day?' },
      { labelKey: 'journalTemplateChallenge', placeholder: 'What was challenging?' },
      { labelKey: 'journalTemplateTomorrow', placeholder: 'What do you want to focus on tomorrow?' },
    ],
  },
  {
    id: 'gratitude',
    nameKey: 'journalTemplateGratitude',
    descriptionKey: 'journalTemplateGratitudeDesc',
    iconKey: 'sprout',
    sections: [
      { labelKey: 'journalTemplateGrateful1', placeholder: 'Something that made me happy...' },
      { labelKey: 'journalTemplateGrateful2', placeholder: 'Someone I appreciate...' },
      { labelKey: 'journalTemplateGrateful3', placeholder: 'A small moment I noticed...' },
    ],
  },
  {
    id: 'goal-setting',
    nameKey: 'journalTemplateGoalSetting',
    descriptionKey: 'journalTemplateGoalSettingDesc',
    iconKey: 'target',
    sections: [
      { labelKey: 'journalTemplateCurrentGoal', placeholder: 'What am I working towards?' },
      { labelKey: 'journalTemplateProgress', placeholder: 'What progress have I made?' },
      { labelKey: 'journalTemplateNextStep', placeholder: 'What is my next action step?' },
    ],
  },
  {
    id: 'free-write',
    nameKey: 'journalTemplateFreeWrite',
    descriptionKey: 'journalTemplateFreeWriteDesc',
    iconKey: 'penLine',
    sections: [
      { labelKey: 'journalTemplateFreeWritePrompt', placeholder: 'Just start writing... let your thoughts flow freely.' },
    ],
  },
  {
    id: 'weekly-review',
    nameKey: 'journalTemplateWeeklyReview',
    descriptionKey: 'journalTemplateWeeklyReviewDesc',
    iconKey: 'compass',
    sections: [
      { labelKey: 'journalTemplateWeekWins', placeholder: "What went well this week?" },
      { labelKey: 'journalTemplateWeekLessons', placeholder: "What did I learn?" },
      { labelKey: 'journalTemplateWeekAhead', placeholder: "What's my focus for next week?" },
    ],
  },
];

/** Generate pre-filled content from a template */
export function generateTemplateContent(
  template: JournalTemplate,
  translations: Record<string, string>,
): string {
  return template.sections
    .map(section => {
      const label = translations[section.labelKey] || section.placeholder;
      return `**${label}**\n\n`;
    })
    .join('\n');
}
