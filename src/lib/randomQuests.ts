// Random Quest Generator for ADHD engagement
// Generates daily/weekly quests with XP rewards and badge unlocks

export type QuestType = 'daily' | 'weekly' | 'bonus';
export type QuestCategory = 'habits' | 'focus' | 'streak' | 'gratitude' | 'speed' | 'consistency';

export interface Quest {
  id: string;
  type: QuestType;
  category: QuestCategory;
  title: string;
  description: string;
  condition: QuestCondition;
  reward: QuestReward;
  progress: number;
  total: number;
  completed: boolean;
  expiresAt: number; // timestamp
  createdAt: number;
}

export interface QuestCondition {
  type: 'complete_habits' | 'focus_minutes' | 'maintain_streak' | 'gratitude_count' | 'speed_challenge' | 'consecutive_days';
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
  difficulty: 'easy' | 'medium' | 'hard';
  templates: {
    title: string;
    description: string;
    condition: Omit<QuestCondition, 'count'>;
    baseReward: number;
    badgeReward?: string;
  }[];
}

// Quest Templates by Category
const QUEST_TEMPLATES: QuestTemplate[] = [
  // Habits Category
  {
    category: 'habits',
    difficulty: 'easy',
    templates: [
      {
        title: 'Morning Momentum',
        description: 'Complete 3 habits before 12:00',
        condition: { type: 'complete_habits', beforeTime: '12:00' },
        baseReward: 50,
      },
      {
        title: 'Habit Master',
        description: 'Complete 5 habits today',
        condition: { type: 'complete_habits' },
        baseReward: 75,
      },
      {
        title: 'Speed Demon',
        description: 'Complete 3 habits in 30 minutes',
        condition: { type: 'complete_habits', timeLimit: 30 },
        baseReward: 100,
        badgeReward: 'Speed Demon',
      },
    ],
  },
  // Focus Category
  {
    category: 'focus',
    difficulty: 'medium',
    templates: [
      {
        title: 'Focus Flow',
        description: '30 minutes of focus without breaks',
        condition: { type: 'focus_minutes' },
        baseReward: 75,
      },
      {
        title: 'Deep Work',
        description: '60 minutes of focused work',
        condition: { type: 'focus_minutes' },
        baseReward: 150,
        badgeReward: 'Deep Focus',
      },
      {
        title: 'Hyperfocus Hero',
        description: '90 minutes in Hyperfocus Mode',
        condition: { type: 'focus_minutes' },
        baseReward: 250,
        badgeReward: 'Hyperfocus Hero',
      },
    ],
  },
  // Streak Category
  {
    category: 'streak',
    difficulty: 'hard',
    templates: [
      {
        title: 'Streak Keeper',
        description: 'Maintain your streak for 7 days',
        condition: { type: 'maintain_streak' },
        baseReward: 200,
        badgeReward: 'Streak Keeper',
      },
      {
        title: 'Consistency King',
        description: 'Maintain your streak for 14 days',
        condition: { type: 'maintain_streak' },
        baseReward: 500,
        badgeReward: 'Consistency King',
      },
    ],
  },
  // Gratitude Category
  {
    category: 'gratitude',
    difficulty: 'easy',
    templates: [
      {
        title: 'Gratitude Sprint',
        description: 'Write 5 gratitudes in 5 minutes',
        condition: { type: 'gratitude_count', timeLimit: 5 },
        baseReward: 50,
      },
      {
        title: 'Thankful Heart',
        description: 'Write 10 gratitudes today',
        condition: { type: 'gratitude_count' },
        baseReward: 100,
        badgeReward: 'Thankful Heart',
      },
    ],
  },
  // Speed Category
  {
    category: 'speed',
    difficulty: 'medium',
    templates: [
      {
        title: 'Lightning Round',
        description: 'Complete 5 quick tasks in 15 minutes',
        condition: { type: 'speed_challenge', timeLimit: 15 },
        baseReward: 125,
        badgeReward: 'Lightning Fast',
      },
    ],
  },
  // Consistency Category
  {
    category: 'consistency',
    difficulty: 'hard',
    templates: [
      {
        title: 'Weekly Warrior',
        description: 'Complete habits 7 days in a row',
        condition: { type: 'consecutive_days' },
        baseReward: 300,
        badgeReward: 'Weekly Warrior',
      },
    ],
  },
];

/**
 * Generate a random daily quest
 */
export function generateDailyQuest(): Quest {
  // Pick random category (favor easier categories for daily quests)
  const easyCategories = QUEST_TEMPLATES.filter(t => t.difficulty === 'easy' || t.difficulty === 'medium');
  const categoryTemplate = easyCategories[Math.floor(Math.random() * easyCategories.length)];

  // Pick random template from category
  const template = categoryTemplate.templates[Math.floor(Math.random() * categoryTemplate.templates.length)];

  // Determine count based on condition type
  let count = 3;
  let total = 3;

  if (template.condition.type === 'complete_habits') {
    count = template.condition.beforeTime ? 3 : 5;
    total = count;
  } else if (template.condition.type === 'focus_minutes') {
    count = template.description.includes('30') ? 30 :
            template.description.includes('60') ? 60 : 90;
    total = count;
  } else if (template.condition.type === 'gratitude_count') {
    count = template.description.includes('5') ? 5 : 10;
    total = count;
  }

  // Calculate expiry (end of day)
  const now = Date.now();
  const tomorrow = new Date();
  tomorrow.setHours(23, 59, 59, 999);

  return {
    id: `quest-daily-${now}`,
    type: 'daily',
    category: categoryTemplate.category,
    title: template.title,
    description: template.description,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward,
      badge: template.badgeReward,
      message: `${template.title} completed! +${template.baseReward} XP`,
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
  // Pick random category (can include harder categories)
  const categoryTemplate = QUEST_TEMPLATES[Math.floor(Math.random() * QUEST_TEMPLATES.length)];

  // Pick random template from category
  const template = categoryTemplate.templates[Math.floor(Math.random() * categoryTemplate.templates.length)];

  // Determine count based on condition type
  let count = 7;
  let total = 7;

  if (template.condition.type === 'maintain_streak') {
    count = template.description.includes('14') ? 14 : 7;
    total = count;
  } else if (template.condition.type === 'consecutive_days') {
    count = 7;
    total = 7;
  } else if (template.condition.type === 'focus_minutes') {
    // Weekly focus quests are cumulative
    count = 300; // 5 hours total
    total = 300;
  }

  // Calculate expiry (end of week)
  const now = Date.now();
  const nextWeek = new Date();
  nextWeek.setDate(nextWeek.getDate() + 7);
  nextWeek.setHours(23, 59, 59, 999);

  return {
    id: `quest-weekly-${now}`,
    type: 'weekly',
    category: categoryTemplate.category,
    title: `Weekly: ${template.title}`,
    description: template.description,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward * 3, // Triple XP for weekly quests
      badge: template.badgeReward,
      message: `Weekly ${template.title} completed! +${template.baseReward * 3} XP`,
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
  // Only hard quests with badges
  const hardTemplates = QUEST_TEMPLATES
    .flatMap(cat => cat.templates.filter(t => t.badgeReward));

  const template = hardTemplates[Math.floor(Math.random() * hardTemplates.length)];
  const categoryTemplate = QUEST_TEMPLATES.find(cat =>
    cat.templates.some(t => t.title === template.title)
  )!;

  let count = 10;
  let total = 10;

  if (template.condition.type === 'focus_minutes') {
    count = 120; // 2 hours
    total = 120;
  } else if (template.condition.type === 'complete_habits') {
    count = 10;
    total = 10;
  }

  // Bonus quests expire in 24 hours
  const now = Date.now();
  const expires = now + (24 * 60 * 60 * 1000);

  return {
    id: `quest-bonus-${now}`,
    type: 'bonus',
    category: categoryTemplate.category,
    title: `🌟 BONUS: ${template.title}`,
    description: `${template.description} (Limited Time!)`,
    condition: {
      ...template.condition,
      count,
    },
    reward: {
      xp: template.baseReward * 5, // 5x XP for bonus quests!
      badge: template.badgeReward,
      message: `BONUS ${template.title} completed! +${template.baseReward * 5} XP + Badge!`,
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
    type: 'habit_completed' | 'focus_completed' | 'gratitude_added' | 'streak_updated';
    value: number;
    timestamp?: number;
  }
): Quest {
  if (quest.completed || Date.now() > quest.expiresAt) {
    return quest;
  }

  let newProgress = quest.progress;

  // Match action to quest condition
  if (action.type === 'habit_completed' && quest.condition.type === 'complete_habits') {
    newProgress += action.value;
  } else if (action.type === 'focus_completed' && quest.condition.type === 'focus_minutes') {
    newProgress += action.value;
  } else if (action.type === 'gratitude_added' && quest.condition.type === 'gratitude_count') {
    newProgress += action.value;
  } else if (action.type === 'streak_updated' && quest.condition.type === 'maintain_streak') {
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
    return 'Expired';
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
    habits: '✅',
    focus: '🎯',
    streak: '🔥',
    gratitude: '💖',
    speed: '⚡',
    consistency: '💪',
  };

  return emojis[category];
}

/**
 * Get quest difficulty color
 */
export function getQuestDifficultyColor(type: QuestType): string {
  const colors: Record<QuestType, string> = {
    daily: 'text-blue-500',
    weekly: 'text-purple-500',
    bonus: 'text-yellow-500',
  };

  return colors[type];
}
