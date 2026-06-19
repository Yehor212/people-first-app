/**
 * starterHabits — one-tap "popular 2-minute version" habit templates.
 *
 * Research basis:
 *   - BJ Fogg, Tiny Habits (2019): shrink to 2-minute version.
 *   - James Clear, Atomic Habits: identity-based entry point.
 *   - Habitify / Streaks onboarding analysis: the 5 most-added starter habits
 *     are consistently hydrate, walk, read, breathe, gratitude.
 *
 * Each starter is a fully-formed {@link Habit} draft — the user taps it and
 * it's immediately added via `setHabits`. The 2-minute framing is baked into
 * the name so the user commits to the minimum viable version, not the ideal.
 */

import type { Habit } from "@/types";
import {
  mapTemplateCategoryToHabitCategory,
  resolveHabitTemplateSetup,
  type HabitTemplate,
} from "@/lib/habitTemplates";
import type { Language } from "@/i18n/translations";

export interface StarterTemplate {
  key: string;
  icon: string;
  name: string;
  /** Optional reminder time (HH:mm). "07:00" places it in the Morning bucket. */
  reminderTime?: string;
  identityVerb?: string;
  identityIcon?: string;
}

export const STARTER_TEMPLATES: readonly StarterTemplate[] = [
  {
    key: "hydrate",
    icon: "drink-water",
    name: "Drink a glass of water",
    reminderTime: "08:00",
    identityVerb: "someone who cares for their body",
    identityIcon: "Leaf",
  },
  {
    key: "walk",
    icon: "walk-distance",
    name: "Walk for 2 minutes",
    reminderTime: "12:30",
    identityVerb: "a mover",
    identityIcon: "Dumbbell",
  },
  {
    key: "read",
    icon: "read",
    name: "Read 1 page",
    reminderTime: "21:30",
    identityVerb: "a reader",
    identityIcon: "BookOpen",
  },
  {
    key: "breathe",
    icon: "breathwork",
    name: "Breathe — 4-7-8 once",
    reminderTime: "15:00",
    identityVerb: "someone calm",
    identityIcon: "Heart",
  },
  {
    key: "gratitude",
    icon: "gratitude",
    name: "Write one gratitude line",
    reminderTime: "22:00",
    identityVerb: "someone grateful",
    identityIcon: "Sparkles",
  },
];

/** Pure: materialize a V1 {@link HabitTemplate} into a full Habit with a fresh id.
 *
 * Resolves the localized name via `language`, falling back to English.
 * The id carries the template id as a suffix so dedupe ("already added")
 * checks can match idempotently across sessions.
 */
export function templateToHabit(
  template: HabitTemplate,
  position: number,
  language: Language,
  now: number = Date.now(),
): Habit {
  const name = template.names[language] || template.names.en;
  const resolved = resolveHabitTemplateSetup(template);
  return {
    id: `tpl-${template.id}-${now}`,
    name,
    icon: template.id,
    color: template.color,
    position,
    createdAt: now,
    habitType: template.habitType,
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "",
    isArchived: false,
    targetValue: template.habitType === "numerical" ? resolved.targetValue : 1,
    targetType: resolved.targetType,
    unit: template.habitType === "numerical" ? resolved.unit : "",
    ...(template.habitType === "numerical" ? { quickEntryMode: resolved.quickEntryMode } : {}),
    entries: {},
    reminders: template.defaultTime
      ? [{ enabled: true, time: template.defaultTime, days: [0, 1, 2, 3, 4, 5, 6] }]
      : [],
    templateId: template.id,
    category: mapTemplateCategoryToHabitCategory(template.category),
  };
}

/** Pure: materialize a starter template into a full Habit with a fresh id. */
export function starterToHabit(
  starter: StarterTemplate,
  position: number,
  now: number = Date.now(),
): Habit {
  return {
    id: `starter-${starter.key}-${now}`,
    name: starter.name,
    icon: starter.icon,
    color: position % 20,
    position,
    createdAt: now,
    habitType: "boolean",
    frequency: { numerator: 1, denominator: 1 },
    question: "",
    description: "",
    isArchived: false,
    targetValue: 1,
    targetType: "atLeast",
    unit: "",
    entries: {},
    reminders: starter.reminderTime
      ? [
          {
            enabled: true,
            time: starter.reminderTime,
            days: [0, 1, 2, 3, 4, 5, 6],
          },
        ]
      : [],
    identityVerb: starter.identityVerb,
    identityIcon: starter.identityIcon,
  };
}
