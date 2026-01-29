import { Challenge, Badge, UserStats } from '@/types';
import { badgeDefinitions } from './badges';
import { formatDate } from './utils';
import { logger } from './logger';
import { safeLocalStorageGet } from './safeJson';

const CHALLENGES_KEY = 'zenflow_challenges';
const BADGES_KEY = 'zenflow_badges';

// Challenge Storage
export function getChallenges(): Challenge[] {
  return safeLocalStorageGet<Challenge[]>(CHALLENGES_KEY, []);
}

export function saveChallenges(challenges: Challenge[]): void {
  try {
    localStorage.setItem(CHALLENGES_KEY, JSON.stringify(challenges));
  } catch (error) {
    logger.error('Failed to save challenges:', error);
  }
}

export function addChallenge(challenge: Challenge): void {
  const challenges = getChallenges();
  challenges.push(challenge);
  saveChallenges(challenges);
}

export function updateChallenge(challengeId: string, updates: Partial<Challenge>): void {
  const challenges = getChallenges();
  const index = challenges.findIndex(c => c.id === challengeId);
  if (index !== -1) {
    challenges[index] = { ...challenges[index], ...updates };
    saveChallenges(challenges);
  }
}

export function deleteChallenge(challengeId: string): void {
  const challenges = getChallenges();
  const filtered = challenges.filter(c => c.id !== challengeId);
  saveChallenges(filtered);
}

// Badge Storage
export function getBadges(): Badge[] {
  const data = safeLocalStorageGet<Badge[] | null>(BADGES_KEY, null);
  if (data) {
    return data;
  }
  // Initialize with default badges if not found
  return initializeBadges();
}

export function initializeBadges(): Badge[] {
  // Create a copy of badge definitions with unlocked = false
  const badges = badgeDefinitions.map(badge => ({ ...badge, unlocked: false }));
  saveBadges(badges);
  return badges;
}

export function saveBadges(badges: Badge[]): void {
  try {
    localStorage.setItem(BADGES_KEY, JSON.stringify(badges));
  } catch (error) {
    logger.error('Failed to save badges:', error);
  }
}

export function unlockBadge(badgeId: string): Badge | null {
  const badges = getBadges();
  const badge = badges.find(b => b.id === badgeId);
  if (badge && !badge.unlocked) {
    badge.unlocked = true;
    badge.unlockedDate = formatDate(new Date());
    saveBadges(badges);
    return badge;
  }
  return null;
}

// Challenge Progress Tracking
export function updateChallengeProgress(
  challengeId: string,
  progress: number
): Challenge | null {
  const challenges = getChallenges();
  const challenge = challenges.find(c => c.id === challengeId);

  if (challenge && !challenge.completed) {
    challenge.progress = progress;

    // Check if challenge is completed
    if (progress >= challenge.target) {
      challenge.completed = true;
      challenge.completedDate = formatDate(new Date());

      // Unlock reward badge if exists
      if (challenge.reward) {
        unlockBadge(challenge.reward);
      }
    }

    saveChallenges(challenges);
    return challenge;
  }

  return null;
}

// Update all challenge progress based on user stats
export function syncChallengeProgress(stats: UserStats, focusMinutes: number, gratitudeCount: number): Badge[] {
  const challenges = getChallenges();
  const newlyUnlockedBadges: Badge[] = [];

  challenges.forEach(challenge => {
    if (challenge.completed) return;

    let newProgress = challenge.progress;

    switch (challenge.type) {
      case 'streak':
        newProgress = stats.currentStreak;
        break;
      case 'focus':
        newProgress = focusMinutes;
        break;
      case 'gratitude':
        newProgress = gratitudeCount;
        break;
      case 'total':
        newProgress = stats.habitsCompleted;
        break;
    }

    if (newProgress !== challenge.progress) {
      const result = updateChallengeProgress(challenge.id, newProgress);
      if (result?.completed && result.reward) {
        const badge = unlockBadge(result.reward);
        if (badge) {
          newlyUnlockedBadges.push(badge);
        }
      }
    }
  });

  return newlyUnlockedBadges;
}

// Check and unlock special badges based on conditions
export function checkSpecialBadges(stats: UserStats, habits: any[]): Badge[] {
  const badges = getBadges();
  const newlyUnlocked: Badge[] = [];

  // First habit completed
  if (stats.habitsCompleted >= 1) {
    const badge = badges.find(b => b.id === 'badge_special_first_habit');
    if (badge && !badge.unlocked) {
      const unlocked = unlockBadge('badge_special_first_habit');
      if (unlocked) newlyUnlocked.push(unlocked);
    }
  }

  // Perfectionist - completed all habits in a day 10 times
  if ((stats.perfectDaysCount || 0) >= 10) {
    const badge = badges.find(b => b.id === 'badge_special_perfectionist');
    if (badge && !badge.unlocked) {
      const unlocked = unlockBadge('badge_special_perfectionist');
      if (unlocked) newlyUnlocked.push(unlocked);
    }
  }

  // Early Bird - completed habits before 8 AM 20 times
  if ((stats.earlyBirdCount || 0) >= 20) {
    const badge = badges.find(b => b.id === 'badge_special_early_bird');
    if (badge && !badge.unlocked) {
      const unlocked = unlockBadge('badge_special_early_bird');
      if (unlocked) newlyUnlocked.push(unlocked);
    }
  }

  // Night Owl - completed habits after 10 PM 20 times
  if ((stats.nightOwlCount || 0) >= 20) {
    const badge = badges.find(b => b.id === 'badge_special_night_owl');
    if (badge && !badge.unlocked) {
      const unlocked = unlockBadge('badge_special_night_owl');
      if (unlocked) newlyUnlocked.push(unlocked);
    }
  }

  // Zen Master - maintained perfect balance for 30 days
  // (mood + habits + focus + gratitude all done in same day)
  if ((stats.zenMasterDays || 0) >= 30) {
    const badge = badges.find(b => b.id === 'badge_special_zen_master');
    if (badge && !badge.unlocked) {
      const unlocked = unlockBadge('badge_special_zen_master');
      if (unlocked) newlyUnlocked.push(unlocked);
    }
  }

  return newlyUnlocked;
}

// Get active challenges count
export function getActiveChallengesCount(): number {
  const challenges = getChallenges();
  return challenges.filter(c => !c.completed).length;
}

// Get completed challenges count
export function getCompletedChallengesCount(): number {
  const challenges = getChallenges();
  return challenges.filter(c => c.completed).length;
}

// Get unlocked badges count
export function getUnlockedBadgesCount(): number {
  const badges = getBadges();
  return badges.filter(b => b.unlocked).length;
}

// Clear all challenges and badges (for testing or reset)
export function clearAllChallengesAndBadges(): void {
  localStorage.removeItem(CHALLENGES_KEY);
  localStorage.removeItem(BADGES_KEY);
}
