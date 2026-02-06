/**
 * Comeback Challenge System
 *
 * Tracks returning users' progress on the "Complete 3 habits for 3 days" challenge.
 * Awards bonus XP (100) upon completion to boost retention.
 */

const COMEBACK_CHALLENGE_KEY = 'zenflow_comeback_challenge';

export interface ComebackChallenge {
  startDate: string;        // ISO date (YYYY-MM-DD)
  targetDays: number;       // Days to complete (default 3)
  targetHabits: number;     // Habits per day (default 3)
  bonusXp: number;          // XP awarded on completion (default 100)
  completedDays: number;    // Days with target habits completed
  dailyProgress: Record<string, number>;  // date -> habits completed that day
  status: 'active' | 'completed' | 'expired';
}

/**
 * Get the current comeback challenge from localStorage
 */
export function getComebackChallenge(): ComebackChallenge | null {
  try {
    const stored = localStorage.getItem(COMEBACK_CHALLENGE_KEY);
    if (!stored) return null;
    return JSON.parse(stored) as ComebackChallenge;
  } catch {
    return null;
  }
}

/**
 * Start a new comeback challenge
 */
export function startComebackChallenge(): ComebackChallenge {
  const challenge: ComebackChallenge = {
    startDate: new Date().toISOString().split('T')[0],
    targetDays: 3,
    targetHabits: 3,
    bonusXp: 100,
    completedDays: 0,
    dailyProgress: {},
    status: 'active',
  };
  localStorage.setItem(COMEBACK_CHALLENGE_KEY, JSON.stringify(challenge));
  return challenge;
}

/**
 * Check if there's an active comeback challenge
 */
export function hasActiveComebackChallenge(): boolean {
  const challenge = getComebackChallenge();
  if (!challenge || challenge.status !== 'active') return false;

  // Check if challenge expired (more than 7 days since start)
  const startDate = new Date(challenge.startDate);
  const now = new Date();
  const daysSinceStart = Math.floor((now.getTime() - startDate.getTime()) / (1000 * 60 * 60 * 24));

  if (daysSinceStart > 7) {
    // Mark as expired
    challenge.status = 'expired';
    localStorage.setItem(COMEBACK_CHALLENGE_KEY, JSON.stringify(challenge));
    return false;
  }

  return true;
}

/**
 * Record a habit completion for the comeback challenge
 * Returns true if the challenge was completed (triggers XP award)
 */
export function recordHabitForChallenge(today: string): {
  challengeExists: boolean;
  dailyTarget: boolean;  // true if today's target was just reached
  challengeComplete: boolean;  // true if entire challenge is now complete
  bonusXp: number;
} {
  const result = {
    challengeExists: false,
    dailyTarget: false,
    challengeComplete: false,
    bonusXp: 0,
  };

  if (!hasActiveComebackChallenge()) return result;

  const challenge = getComebackChallenge();
  if (!challenge || challenge.status !== 'active') return result;

  result.challengeExists = true;

  // Increment today's progress
  const prevCount = challenge.dailyProgress[today] || 0;
  const newCount = prevCount + 1;
  challenge.dailyProgress[today] = newCount;

  // Check if daily target reached for the first time today
  if (prevCount < challenge.targetHabits && newCount >= challenge.targetHabits) {
    result.dailyTarget = true;
    challenge.completedDays += 1;

    // Check if entire challenge is complete
    if (challenge.completedDays >= challenge.targetDays) {
      challenge.status = 'completed';
      result.challengeComplete = true;
      result.bonusXp = challenge.bonusXp;
    }
  }

  localStorage.setItem(COMEBACK_CHALLENGE_KEY, JSON.stringify(challenge));
  return result;
}

/**
 * Get current challenge progress for display
 */
export function getChallengeProgress(): {
  active: boolean;
  completedDays: number;
  targetDays: number;
  todayProgress: number;
  targetHabits: number;
  bonusXp: number;
} | null {
  const challenge = getComebackChallenge();
  if (!challenge || challenge.status !== 'active') return null;

  const today = new Date().toISOString().split('T')[0];

  return {
    active: true,
    completedDays: challenge.completedDays,
    targetDays: challenge.targetDays,
    todayProgress: challenge.dailyProgress[today] || 0,
    targetHabits: challenge.targetHabits,
    bonusXp: challenge.bonusXp,
  };
}

/**
 * Clear the comeback challenge (for testing or reset)
 */
export function clearComebackChallenge(): void {
  localStorage.removeItem(COMEBACK_CHALLENGE_KEY);
}
