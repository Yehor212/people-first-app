/**
 * Seasonal Events System
 * Stage 5.3 of Premium Upgrade Plan
 *
 * Provides infrastructure for:
 * - Time-limited achievements
 * - Thematic challenges
 * - Holiday rewards
 * - Special seasonal content
 */

import { generateId, getToday } from './utils';
import { logger } from '@/lib/logger';

// ============================================
// TYPES
// ============================================

export type SeasonalEventType =
  | 'holiday'      // Major holidays (Christmas, New Year, etc.)
  | 'seasonal'     // Season-based (Spring renewal, Summer vibes, etc.)
  | 'special'      // Special occasions (app anniversary, etc.)
  | 'community';   // Community-driven events

export type EventRewardType =
  | 'badge'        // Special achievement badge
  | 'xp_bonus'     // XP multiplier or bonus
  | 'theme'        // Unlock special theme
  | 'avatar'       // Special avatar/profile decoration
  | 'title';       // Display title for profile

export interface SeasonalReward {
  id: string;
  type: EventRewardType;
  name: string;
  description: string;
  icon: string;
  rarity: 'common' | 'rare' | 'epic' | 'legendary';
  /** For badges - the badge ID to unlock */
  badgeId?: string;
  /** For XP - the multiplier or flat bonus */
  xpBonus?: number;
  /** For themes - the theme ID to unlock */
  themeId?: string;
}

export interface SeasonalChallenge {
  id: string;
  name: string;
  description: string;
  icon: string;
  /** Challenge type determines tracking logic */
  type: 'habit_streak' | 'mood_logs' | 'focus_minutes' | 'gratitude_entries' | 'custom';
  /** Target value to complete the challenge */
  target: number;
  /** Current progress */
  progress: number;
  /** Whether challenge is completed */
  completed: boolean;
  /** Reward for completing this challenge */
  reward: SeasonalReward;
}

export interface SeasonalEvent {
  id: string;
  name: string;
  description: string;
  type: SeasonalEventType;
  icon: string;
  /** Theme color for event UI */
  themeColor: string;
  /** Start date (ISO string) */
  startDate: string;
  /** End date (ISO string) */
  endDate: string;
  /** Whether the event is currently active */
  isActive: boolean;
  /** Challenges associated with this event */
  challenges: SeasonalChallenge[];
  /** Main reward for completing all challenges */
  completionReward?: SeasonalReward;
  /** Background image or gradient for event banner */
  bannerStyle?: string;
}

export interface UserSeasonalProgress {
  eventId: string;
  challenges: Record<string, {
    progress: number;
    completed: boolean;
    completedAt?: string;
  }>;
  allChallengesCompleted: boolean;
  completionRewardClaimed: boolean;
  participatedAt: string;
}

// ============================================
// PREDEFINED SEASONAL EVENTS
// ============================================

/**
 * Get all predefined seasonal events
 * Events are configured by year - add new events here
 */
export function getSeasonalEventsConfig(year: number): SeasonalEvent[] {
  return [
    // New Year Challenge (January 1-14)
    {
      id: `new-year-${year}`,
      name: 'New Year, New You',
      description: 'Start the year strong with 14 days of consistent habits!',
      type: 'holiday',
      icon: '🎆',
      themeColor: '#FFD700',
      startDate: `${year}-01-01`,
      endDate: `${year}-01-14`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #1a1a2e 0%, #16213e 50%, #0f3460 100%)',
      challenges: [
        {
          id: `ny-${year}-streak`,
          name: 'Fresh Start',
          description: 'Complete all habits for 7 consecutive days',
          icon: '🌟',
          type: 'habit_streak',
          target: 7,
          progress: 0,
          completed: false,
          reward: {
            id: `ny-${year}-badge-streak`,
            type: 'badge',
            name: 'New Beginnings',
            description: 'Started the year with a 7-day streak',
            icon: '🌅',
            rarity: 'rare',
            badgeId: 'new-year-streak',
          },
        },
        {
          id: `ny-${year}-mood`,
          name: 'Mood Tracker',
          description: 'Log your mood 14 times during the event',
          icon: '💜',
          type: 'mood_logs',
          target: 14,
          progress: 0,
          completed: false,
          reward: {
            id: `ny-${year}-xp`,
            type: 'xp_bonus',
            name: 'Reflection Bonus',
            description: '+100 XP for consistent mood tracking',
            icon: '✨',
            rarity: 'common',
            xpBonus: 100,
          },
        },
      ],
      completionReward: {
        id: `ny-${year}-complete`,
        type: 'badge',
        name: 'Year Starter',
        description: 'Completed all New Year challenges',
        icon: '🏆',
        rarity: 'epic',
        badgeId: 'new-year-champion',
      },
    },

    // Valentine's Self-Love (February 7-14)
    {
      id: `valentine-${year}`,
      name: 'Self-Love Week',
      description: 'Focus on gratitude and self-care this Valentine\'s season',
      type: 'holiday',
      icon: '💝',
      themeColor: '#FF69B4',
      startDate: `${year}-02-07`,
      endDate: `${year}-02-14`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #ff9a9e 0%, #fecfef 50%, #fad0c4 100%)',
      challenges: [
        {
          id: `val-${year}-gratitude`,
          name: 'Gratitude Garden',
          description: 'Write 7 gratitude entries',
          icon: '🌸',
          type: 'gratitude_entries',
          target: 7,
          progress: 0,
          completed: false,
          reward: {
            id: `val-${year}-badge`,
            type: 'badge',
            name: 'Heart of Gold',
            description: 'Practiced gratitude during Self-Love Week',
            icon: '💛',
            rarity: 'rare',
            badgeId: 'gratitude-heart',
          },
        },
      ],
      completionReward: {
        id: `val-${year}-complete`,
        type: 'badge',
        name: 'Self-Love Champion',
        description: 'Completed Self-Love Week',
        icon: '💖',
        rarity: 'rare',
        badgeId: 'self-love-champion',
      },
    },

    // Spring Renewal (March 20 - April 3)
    {
      id: `spring-${year}`,
      name: 'Spring Renewal',
      description: 'Refresh your habits and bloom into a better you!',
      type: 'seasonal',
      icon: '🌷',
      themeColor: '#90EE90',
      startDate: `${year}-03-20`,
      endDate: `${year}-04-03`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #a8edea 0%, #fed6e3 100%)',
      challenges: [
        {
          id: `spring-${year}-habits`,
          name: 'Habit Bloom',
          description: 'Complete 50 habit check-ins',
          icon: '🌱',
          type: 'habit_streak',
          target: 50,
          progress: 0,
          completed: false,
          reward: {
            id: `spring-${year}-badge`,
            type: 'badge',
            name: 'Spring Bloomer',
            description: 'Flourished during Spring Renewal',
            icon: '🌻',
            rarity: 'rare',
            badgeId: 'spring-bloom',
          },
        },
        {
          id: `spring-${year}-focus`,
          name: 'Focus Flowers',
          description: 'Complete 120 minutes of focused work',
          icon: '🎯',
          type: 'focus_minutes',
          target: 120,
          progress: 0,
          completed: false,
          reward: {
            id: `spring-${year}-xp`,
            type: 'xp_bonus',
            name: 'Focus Bonus',
            description: '+150 XP for deep focus',
            icon: '⚡',
            rarity: 'common',
            xpBonus: 150,
          },
        },
      ],
      completionReward: {
        id: `spring-${year}-complete`,
        type: 'badge',
        name: 'Spring Champion',
        description: 'Completed all Spring Renewal challenges',
        icon: '🏵️',
        rarity: 'epic',
        badgeId: 'spring-champion',
      },
    },

    // Summer Solstice (June 20 - July 4)
    {
      id: `summer-${year}`,
      name: 'Summer Solstice',
      description: 'Harness the longest days for maximum productivity!',
      type: 'seasonal',
      icon: '☀️',
      themeColor: '#FFA500',
      startDate: `${year}-06-20`,
      endDate: `${year}-07-04`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #f6d365 0%, #fda085 100%)',
      challenges: [
        {
          id: `summer-${year}-focus`,
          name: 'Sunshine Focus',
          description: 'Complete 300 minutes of focused work',
          icon: '🌞',
          type: 'focus_minutes',
          target: 300,
          progress: 0,
          completed: false,
          reward: {
            id: `summer-${year}-badge`,
            type: 'badge',
            name: 'Sun Warrior',
            description: 'Maximized focus during Summer Solstice',
            icon: '🌅',
            rarity: 'epic',
            badgeId: 'sun-warrior',
          },
        },
      ],
    },

    // Fall Harvest (September 22 - October 6)
    {
      id: `fall-${year}`,
      name: 'Fall Harvest',
      description: 'Reap the rewards of your consistent efforts!',
      type: 'seasonal',
      icon: '🍂',
      themeColor: '#D2691E',
      startDate: `${year}-09-22`,
      endDate: `${year}-10-06`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #f093fb 0%, #f5576c 100%)',
      challenges: [
        {
          id: `fall-${year}-all`,
          name: 'Harvest All',
          description: 'Log mood, complete habits, and write gratitude daily for 7 days',
          icon: '🌾',
          type: 'custom',
          target: 7,
          progress: 0,
          completed: false,
          reward: {
            id: `fall-${year}-badge`,
            type: 'badge',
            name: 'Harvest Master',
            description: 'Completed the Fall Harvest challenge',
            icon: '🎃',
            rarity: 'epic',
            badgeId: 'harvest-master',
          },
        },
      ],
    },

    // Winter Warmth (December 20 - January 3)
    {
      id: `winter-${year}`,
      name: 'Winter Warmth',
      description: 'Stay cozy and consistent through the winter holidays!',
      type: 'holiday',
      icon: '❄️',
      themeColor: '#87CEEB',
      startDate: `${year}-12-20`,
      endDate: `${year + 1}-01-03`,
      isActive: false,
      bannerStyle: 'linear-gradient(135deg, #667eea 0%, #764ba2 100%)',
      challenges: [
        {
          id: `winter-${year}-gratitude`,
          name: 'Cozy Gratitude',
          description: 'Write 10 gratitude entries',
          icon: '🕯️',
          type: 'gratitude_entries',
          target: 10,
          progress: 0,
          completed: false,
          reward: {
            id: `winter-${year}-badge`,
            type: 'badge',
            name: 'Warm Heart',
            description: 'Practiced gratitude during Winter Warmth',
            icon: '💝',
            rarity: 'rare',
            badgeId: 'warm-heart',
          },
        },
        {
          id: `winter-${year}-mood`,
          name: 'Holiday Mood',
          description: 'Track your mood 14 times',
          icon: '🎄',
          type: 'mood_logs',
          target: 14,
          progress: 0,
          completed: false,
          reward: {
            id: `winter-${year}-xp`,
            type: 'xp_bonus',
            name: 'Holiday Spirit',
            description: '+200 XP for holiday tracking',
            icon: '🎁',
            rarity: 'common',
            xpBonus: 200,
          },
        },
      ],
      completionReward: {
        id: `winter-${year}-complete`,
        type: 'badge',
        name: 'Winter Champion',
        description: 'Completed all Winter Warmth challenges',
        icon: '⛄',
        rarity: 'legendary',
        badgeId: 'winter-champion',
      },
    },
  ];
}

// ============================================
// ACTIVE EVENT DETECTION
// ============================================

/**
 * Check if a date falls within an event's active period
 */
export function isEventActive(event: SeasonalEvent, date: Date = new Date()): boolean {
  const start = new Date(event.startDate);
  const end = new Date(event.endDate);
  end.setHours(23, 59, 59, 999); // Include the entire end day

  return date >= start && date <= end;
}

/**
 * Get currently active seasonal events
 */
export function getActiveEvents(date: Date = new Date()): SeasonalEvent[] {
  const year = date.getFullYear();
  const events = getSeasonalEventsConfig(year);

  // Also check previous year's events that might span into current year
  const prevYearEvents = getSeasonalEventsConfig(year - 1);

  const allEvents = [...events, ...prevYearEvents];

  return allEvents
    .filter(event => isEventActive(event, date))
    .map(event => ({ ...event, isActive: true }));
}

/**
 * Get upcoming events (within next 30 days)
 */
export function getUpcomingEvents(date: Date = new Date()): SeasonalEvent[] {
  const year = date.getFullYear();
  const events = getSeasonalEventsConfig(year);

  const thirtyDaysFromNow = new Date(date);
  thirtyDaysFromNow.setDate(thirtyDaysFromNow.getDate() + 30);

  return events.filter(event => {
    const start = new Date(event.startDate);
    return start > date && start <= thirtyDaysFromNow;
  });
}

// ============================================
// PROGRESS TRACKING
// ============================================

const SEASONAL_PROGRESS_KEY = 'zenflow_seasonal_progress';

/**
 * Get user's progress for all seasonal events
 */
export function getSeasonalProgress(): Record<string, UserSeasonalProgress> {
  try {
    const stored = localStorage.getItem(SEASONAL_PROGRESS_KEY);
    return stored ? JSON.parse(stored) : {};
  } catch {
    return {};
  }
}

/**
 * Save user's seasonal progress
 */
export function saveSeasonalProgress(progress: Record<string, UserSeasonalProgress>): void {
  try {
    localStorage.setItem(SEASONAL_PROGRESS_KEY, JSON.stringify(progress));
  } catch (error) {
    logger.warn('[SeasonalEvents] Failed to save progress:', error);
  }
}

/**
 * Initialize progress for an event if not exists
 */
export function initializeEventProgress(eventId: string, challenges: SeasonalChallenge[]): UserSeasonalProgress {
  const allProgress = getSeasonalProgress();

  if (allProgress[eventId]) {
    return allProgress[eventId];
  }

  const progress: UserSeasonalProgress = {
    eventId,
    challenges: challenges.reduce((acc, challenge) => ({
      ...acc,
      [challenge.id]: {
        progress: 0,
        completed: false,
      },
    }), {}),
    allChallengesCompleted: false,
    completionRewardClaimed: false,
    participatedAt: new Date().toISOString(),
  };

  allProgress[eventId] = progress;
  saveSeasonalProgress(allProgress);

  return progress;
}

/**
 * Update progress for a specific challenge
 */
export function updateChallengeProgress(
  eventId: string,
  challengeId: string,
  progressIncrement: number
): { completed: boolean; newProgress: number } {
  const allProgress = getSeasonalProgress();
  const eventProgress = allProgress[eventId];

  if (!eventProgress) {
    return { completed: false, newProgress: 0 };
  }

  const challengeProgress = eventProgress.challenges[challengeId];
  if (!challengeProgress || challengeProgress.completed) {
    return {
      completed: challengeProgress?.completed ?? false,
      newProgress: challengeProgress?.progress ?? 0
    };
  }

  // Get the challenge to find the target
  const activeEvents = getActiveEvents();
  const event = activeEvents.find(e => e.id === eventId);
  const challenge = event?.challenges.find(c => c.id === challengeId);

  if (!challenge) {
    return { completed: false, newProgress: challengeProgress.progress };
  }

  const newProgress = Math.min(challengeProgress.progress + progressIncrement, challenge.target);
  const completed = newProgress >= challenge.target;

  eventProgress.challenges[challengeId] = {
    progress: newProgress,
    completed,
    completedAt: completed ? new Date().toISOString() : undefined,
  };

  // Check if all challenges are completed
  const allCompleted = Object.values(eventProgress.challenges).every(c => c.completed);
  eventProgress.allChallengesCompleted = allCompleted;

  saveSeasonalProgress(allProgress);

  return { completed, newProgress };
}

/**
 * Claim completion reward for an event
 */
export function claimCompletionReward(eventId: string): SeasonalReward | null {
  const allProgress = getSeasonalProgress();
  const eventProgress = allProgress[eventId];

  if (!eventProgress || !eventProgress.allChallengesCompleted || eventProgress.completionRewardClaimed) {
    return null;
  }

  const activeEvents = getActiveEvents();
  const event = activeEvents.find(e => e.id === eventId);

  if (!event?.completionReward) {
    return null;
  }

  eventProgress.completionRewardClaimed = true;
  saveSeasonalProgress(allProgress);

  return event.completionReward;
}

// ============================================
// EVENT INTEGRATION HELPERS
// ============================================

/**
 * Process a habit completion for active seasonal events
 */
export function onHabitCompleted(): void {
  const activeEvents = getActiveEvents();

  for (const event of activeEvents) {
    initializeEventProgress(event.id, event.challenges);

    for (const challenge of event.challenges) {
      if (challenge.type === 'habit_streak') {
        updateChallengeProgress(event.id, challenge.id, 1);
      }
    }
  }
}

/**
 * Process a mood log for active seasonal events
 */
export function onMoodLogged(): void {
  const activeEvents = getActiveEvents();

  for (const event of activeEvents) {
    initializeEventProgress(event.id, event.challenges);

    for (const challenge of event.challenges) {
      if (challenge.type === 'mood_logs') {
        updateChallengeProgress(event.id, challenge.id, 1);
      }
    }
  }
}

/**
 * Process focus session completion for active seasonal events
 */
export function onFocusCompleted(minutes: number): void {
  const activeEvents = getActiveEvents();

  for (const event of activeEvents) {
    initializeEventProgress(event.id, event.challenges);

    for (const challenge of event.challenges) {
      if (challenge.type === 'focus_minutes') {
        updateChallengeProgress(event.id, challenge.id, minutes);
      }
    }
  }
}

/**
 * Process gratitude entry for active seasonal events
 */
export function onGratitudeAdded(): void {
  const activeEvents = getActiveEvents();

  for (const event of activeEvents) {
    initializeEventProgress(event.id, event.challenges);

    for (const challenge of event.challenges) {
      if (challenge.type === 'gratitude_entries') {
        updateChallengeProgress(event.id, challenge.id, 1);
      }
    }
  }
}

/**
 * Get event with user's current progress merged in
 */
export function getEventWithProgress(event: SeasonalEvent): SeasonalEvent & { userProgress: UserSeasonalProgress | null } {
  const allProgress = getSeasonalProgress();
  const userProgress = allProgress[event.id] || null;

  // Merge progress into challenges
  const challengesWithProgress = event.challenges.map(challenge => ({
    ...challenge,
    progress: userProgress?.challenges[challenge.id]?.progress ?? 0,
    completed: userProgress?.challenges[challenge.id]?.completed ?? false,
  }));

  return {
    ...event,
    challenges: challengesWithProgress,
    userProgress,
  };
}

export default {
  getSeasonalEventsConfig,
  getActiveEvents,
  getUpcomingEvents,
  isEventActive,
  getSeasonalProgress,
  initializeEventProgress,
  updateChallengeProgress,
  claimCompletionReward,
  onHabitCompleted,
  onMoodLogged,
  onFocusCompleted,
  onGratitudeAdded,
  getEventWithProgress,
};
