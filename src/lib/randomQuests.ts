// Random Quest Generator for ADHD engagement
// Generates daily/weekly quests with XP rewards and badge unlocks

import { logger } from "./logger";
import { safeLocalStorageGet, safeLocalStorageSet, storageGetRaw } from "./safeJson";
import { SK } from "@/lib/storageKeys";
import { getTranslations } from "@/i18n/translations";
import type { Language, Translations } from "@/i18n/translations";

// Helper to get current language from localStorage
function getCurrentLanguage(): string {
  return storageGetRaw(SK.LANGUAGE, "en");
}

// Helper to get translations for current language
function getQuestTranslations(language?: string) {
  const lang = (language || getCurrentLanguage()) as Language;
  return getTranslations(lang);
}

export type QuestType = "daily" | "weekly" | "bonus";
export type QuestCategory = "habits" | "focus" | "streak" | "gratitude" | "speed" | "consistency";

export interface Quest {
  id: string;
  type: QuestType;
  category: QuestCategory;
  title: string;
  description: string;
  titleKey?: string; // translation key — resolve at render time
  descriptionKey?: string; // translation key — resolve at render time
  condition: QuestCondition;
  reward: QuestReward;
  progress: number;
  total: number;
  completed: boolean;
  expiresAt: number; // timestamp
  createdAt: number;
}

export interface QuestCondition {
  type:
    | "complete_habits"
    | "focus_minutes"
    | "maintain_streak"
    | "gratitude_count"
    | "speed_challenge"
    | "consecutive_days";
  count: number;
  timeLimit?: number; // in minutes
  beforeTime?: string; // "12:00" format
  category?: string;
}

export interface QuestReward {
  xp: number;
  badge?: string;
  message: string;
}

export interface QuestTemplate {
  category: QuestCategory;
  difficulty: "easy" | "medium" | "hard";
  templates: {
    titleKey: keyof Translations;
    descriptionKey: keyof Translations;
    condition: Omit<QuestCondition, "count"> & { count?: number };
    baseReward: number;
    badgeReward?: string;
  }[];
}

// Quest Templates by Category
const QUEST_TEMPLATES: QuestTemplate[] = [
  // Habits Category
  {
    category: "habits",
    difficulty: "easy",
    templates: [
      {
        titleKey: "questMorningMomentum",
        descriptionKey: "questMorningMomentumDesc",
        condition: { type: "complete_habits", beforeTime: "12:00" },
        baseReward: 50,
      },
      {
        titleKey: "questHabitMaster",
        descriptionKey: "questHabitMasterDesc",
        condition: { type: "complete_habits" },
        baseReward: 75,
      },
      {
        titleKey: "questSpeedDemon",
        descriptionKey: "questSpeedDemonDesc",
        condition: { type: "complete_habits", timeLimit: 30 },
        baseReward: 100,
        badgeReward: "questSpeedDemon",
      },
    ],
  },
  // Focus Category
  {
    category: "focus",
    difficulty: "medium",
    templates: [
      {
        titleKey: "questFocusFlow",
        descriptionKey: "questFocusFlowDesc",
        condition: { type: "focus_minutes", count: 30 },
        baseReward: 75,
      },
      {
        titleKey: "questDeepWork",
        descriptionKey: "questDeepWorkDesc",
        condition: { type: "focus_minutes", count: 60 },
        baseReward: 150,
        badgeReward: "questBadgeDeepFocus",
      },
      {
        titleKey: "questHyperfocusHero",
        descriptionKey: "questHyperfocusHeroDesc",
        condition: { type: "focus_minutes", count: 90 },
        baseReward: 250,
        badgeReward: "questHyperfocusHero",
      },
    ],
  },
  // Streak Category
  {
    category: "streak",
    difficulty: "hard",
    templates: [
      {
        titleKey: "questStreakKeeper",
        descriptionKey: "questStreakKeeperDesc",
        condition: { type: "maintain_streak", count: 7 },
        baseReward: 200,
        badgeReward: "questStreakKeeper",
      },
      {
        titleKey: "questConsistencyKing",
        descriptionKey: "questConsistencyKingDesc",
        condition: { type: "maintain_streak", count: 14 },
        baseReward: 500,
        badgeReward: "questConsistencyKing",
      },
    ],
  },
  // Gratitude Category
  {
    category: "gratitude",
    difficulty: "easy",
    templates: [
      {
        titleKey: "questGratitudeSprint",
        descriptionKey: "questGratitudeSprintDesc",
        condition: { type: "gratitude_count", count: 5, timeLimit: 5 },
        baseReward: 50,
      },
      {
        titleKey: "questThankfulHeart",
        descriptionKey: "questThankfulHeartDesc",
        condition: { type: "gratitude_count", count: 10 },
        baseReward: 100,
        badgeReward: "questThankfulHeart",
      },
    ],
  },
  // Speed Category
  {
    category: "speed",
    difficulty: "medium",
    templates: [
      {
        titleKey: "questLightningRound",
        descriptionKey: "questLightningRoundDesc",
        condition: { type: "speed_challenge", timeLimit: 15 },
        baseReward: 125,
        badgeReward: "questBadgeLightningFast",
      },
    ],
  },
  // Consistency Category
  {
    category: "consistency",
    difficulty: "hard",
    templates: [
      {
        titleKey: "questWeeklyWarrior",
        descriptionKey: "questWeeklyWarriorDesc",
        condition: { type: "consecutive_days" },
        baseReward: 300,
        badgeReward: "questWeeklyWarrior",
      },
    ],
  },
];

/**
 * Generate a random daily quest
 */
export function generateDailyQuest(): Quest {
  // Get translations for current language
  const t = getQuestTranslations();

  // Pick random category (favor easier categories for daily quests)
  const easyCategories = QUEST_TEMPLATES.filter(
    (t) => t.difficulty === "easy" || t.difficulty === "medium"
  );
  const categoryTemplate = easyCategories[Math.floor(Math.random() * easyCategories.length)];

  // Pick random template from category
  const template =
    categoryTemplate.templates[Math.floor(Math.random() * categoryTemplate.templates.length)];

  // Get translated title and description (for backward compat in stored quests)
  const title = t[template.titleKey] as string;
  const description = t[template.descriptionKey] as string;

  // Determine count from template or fallback
  let count = template.condition.count || 3;
  if (!template.condition.count && template.condition.type === "complete_habits") {
    count = template.condition.beforeTime ? 3 : 5;
  }
  const total = count;

  // Calculate expiry (end of day)
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setHours(23, 59, 59, 999);

  return {
    id: `quest-daily-${now}`,
    type: "daily",
    category: categoryTemplate.category,
    title,
    description,
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward,
      badge: template.badgeReward,
      message: `${title} completed! +${template.baseReward} XP`,
    },
    progress: 0,
    total,
    completed: false,
    expiresAt: tomorrow.getTime(),
    createdAt: now,
  };
}

/**
 * Generate a random weekly quest
 */
export function generateWeeklyQuest(): Quest {
  // Get translations for current language
  const t = getQuestTranslations();

  // Pick random category (can include harder categories)
  const categoryTemplate = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];

  // Pick random template from category
  const template =
    categoryTemplate.templates[Math.floor(Math.random() * categoryTemplate.templates.length)];

  // Get translated title and description (for backward compat in stored quests)
  const title = t[template.titleKey] as string;
  const description = t[template.descriptionKey] as string;

  // Determine count from template or fallback
  let count = template.condition.count || 7;
  if (!template.condition.count) {
    if (template.condition.type === "focus_minutes") {
      count = 300; // 5 hours total for weekly
    } else if (template.condition.type === "consecutive_days") {
      count = 7;
    }
  }
  const total = count;

  // Calculate expiry (end of week)
  const now = Date.now();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(23, 59, 59, 999);

  return {
    id: `quest-weekly-${now}`,
    type: "weekly",
    category: categoryTemplate.category,
    title, // No prefix — added at render time by QuestsPanel
    description,
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward * 3, // Triple XP for weekly quests
      badge: template.badgeReward,
      message: `${title} completed! +${template.baseReward * 3} XP`,
    },
    progress: 0,
    total,
    completed: false,
    expiresAt: nextWeek.getTime(),
    createdAt: now,
  };
}

/**
 * Generate a bonus quest (rare, high reward)
 */
export function generateBonusQuest(): Quest {
  // Get translations for current language
  const t = getQuestTranslations();

  // Only hard quests with badges
  const hardTemplates = QUEST_TEMPLATES.flatMap((cat) =>
    cat.templates.filter((t) => t.badgeReward)
  );

  const template = hardTemplates[Math.floor(Math.random() * hardTemplates.length)];
  const categoryTemplate = QUEST_TEMPLATES.find((cat) =>
    cat.templates.some((t) => t.titleKey === template.titleKey)
  );

  // Get translated title and description (for backward compat in stored quests)
  const title = t[template.titleKey] as string;
  const description = t[template.descriptionKey] as string;

  let count = 10;
  let total = 10;

  if (template.condition.type === "focus_minutes") {
    count = 120; // 2 hours
    total = 120;
  } else if (template.condition.type === "complete_habits") {
    count = 10;
    total = 10;
  }

  // Bonus quests expire in 24 hours
  const now = Date.now();
  const expires = now + 24 * 60 * 60 * 1000;

  return {
    id: `quest-bonus-${now}`,
    type: "bonus",
    category: categoryTemplate?.category ?? "habits",
    title, // No prefix — added at render time by QuestsPanel
    description, // No suffix — added at render time
    titleKey: template.titleKey,
    descriptionKey: template.descriptionKey,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward * 5, // 5x XP for bonus quests!
      badge: template.badgeReward,
      message: `${title} completed! +${template.baseReward * 5} XP`,
    },
    progress: 0,
    total,
    completed: false,
    expiresAt: expires,
    createdAt: now,
  };
}

/**
 * Update quest progress based on user action
 */
export function updateQuestProgress(
  quest: Quest,
  action: {
    type: "habit_completed" | "focus_completed" | "gratitude_added" | "streak_updated";
    value: number;
    timestamp?: number;
  }
): Quest {
  if (quest.completed || Date.now() > quest.expiresAt) {
    return quest;
  }

  let newProgress = quest.progress;

  // Match action to quest condition
  if (action.type === "habit_completed" && quest.condition.type === "complete_habits") {
    newProgress += action.value;
  } else if (action.type === "focus_completed" && quest.condition.type === "focus_minutes") {
    newProgress += action.value;
  } else if (action.type === "gratitude_added" && quest.condition.type === "gratitude_count") {
    newProgress += action.value;
  } else if (action.type === "streak_updated" && quest.condition.type === "maintain_streak") {
    newProgress = action.value;
  }

  // Check for completion
  const completed = newProgress >= quest.total;

  return {
    ...quest,
    progress: Math.min(newProgress, quest.total),
    completed,
  };
}

/**
 * Check if quest should be regenerated (expired or completed)
 */
export function shouldRegenerateQuest(quest: Quest): boolean {
  return quest.completed || Date.now() > quest.expiresAt;
}

/**
 * Get time remaining for quest
 */
export function getQuestTimeRemaining(quest: Quest): string {
  const now = Date.now();
  const remaining = quest.expiresAt - now;

  if (remaining <= 0) {
    return "Expired";
  }

  const hours = Math.floor(remaining / (1000 * 60 * 60));
  const days = Math.floor(hours / 24);

  if (days > 0) {
    return `${days}d ${hours % 24}h`;
  }

  if (hours > 0) {
    return `${hours}h`;
  }

  const minutes = Math.floor(remaining / (1000 * 60));
  return `${minutes}m`;
}

/**
 * Get quest category emoji
 */
export function getQuestCategoryEmoji(category: QuestCategory): string {
  const emojis: Record<QuestCategory, string> = {
    habits: "✅",
    focus: "🎯",
    streak: "🔥",
    gratitude: "💖",
    speed: "⚡",
    consistency: "💪",
  };

  return emojis[category];
}

/**
 * Get quest difficulty color
 */
export function getQuestDifficultyColor(type: QuestType): string {
  const colors: Record<QuestType, string> = {
    daily: "text-blue-500",
    weekly: "text-purple-500",
    bonus: "text-yellow-500",
  };

  return colors[type];
}

/**
 * Update all quests progress from localStorage and return newly completed quests
 * Call this from Index.tsx when user performs actions
 */
export function updateAllQuestsProgress(action: {
  type: "habit_completed" | "focus_completed" | "gratitude_added" | "streak_updated";
  value: number;
}): Quest[] {
  try {
    const data = safeLocalStorageGet<{
      daily?: Quest | null;
      weekly?: Quest | null;
      bonus?: Quest | null;
    } | null>(SK.QUESTS, null);
    if (!data) return [];

    const newlyCompleted: Quest[] = [];

    // Update each quest type
    (["daily", "weekly", "bonus"] as const).forEach((questType) => {
      const quest = data[questType];
      if (!quest || quest.completed || Date.now() > quest.expiresAt) return;

      const wasCompleted = quest.completed;
      const updated = updateQuestProgress(quest, action);

      // Check if quest just became completed
      if (updated.completed && !wasCompleted) {
        newlyCompleted.push(updated);
      }

      data[questType] = updated;
    });

    // Save updated quests back to localStorage
    safeLocalStorageSet(SK.QUESTS, data);

    return newlyCompleted;
  } catch (error) {
    logger.error("[QuestsSync] Failed to update quests progress:", error);
    return [];
  }
}
