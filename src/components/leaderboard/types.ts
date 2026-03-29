import type { LeaderboardEntry, LeaderboardStats, LeaderboardType } from '@/lib/leaderboard';

export interface LeaderboardProps {
  trigger?: React.ReactNode;
}

export const FETCH_TIMEOUT = 10000;
export const MAX_RETRIES = 3;
export const RETRY_DELAYS = [1000, 3000, 5000];

export const RANK_CONFIGS = {
  1: {
    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.1) 100%)',
    border: 'rgba(245, 158, 11, 0.3)',
    glow: '0 0 16px rgba(245, 158, 11, 0.2)',
    rankBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
    textColor: 'text-amber-400',
  },
  2: {
    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.2) 0%, rgba(209, 213, 219, 0.1) 100%)',
    border: 'rgba(156, 163, 175, 0.3)',
    glow: '0 0 12px rgba(156, 163, 175, 0.15)',
    rankBg: 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)',
    textColor: 'text-gray-600 dark:text-gray-300',
  },
  3: {
    bg: 'linear-gradient(135deg, rgba(180, 83, 9, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
    border: 'rgba(180, 83, 9, 0.3)',
    glow: '0 0 12px rgba(180, 83, 9, 0.15)',
    rankBg: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
    textColor: 'text-orange-400',
  },
} as const;

export function getValue(entry: LeaderboardEntry, activeTab: LeaderboardType): number {
  switch (activeTab) {
    case 'weekly': return entry.weeklyXp;
    case 'monthly': return entry.monthlyXp;
    case 'streak': return entry.currentStreak;
  }
}

export function getUnit(activeTab: LeaderboardType, t: Record<string, string>): string {
  switch (activeTab) {
    case 'weekly':
    case 'monthly':
      return 'XP';
    case 'streak':
      return t.days || 'days';
  }
}

export function getCurrentRank(userRanks: LeaderboardStats | null, activeTab: LeaderboardType): number | null {
  if (!userRanks) return null;
  switch (activeTab) {
    case 'weekly': return userRanks.weeklyRank;
    case 'monthly': return userRanks.monthlyRank;
    case 'streak': return userRanks.streakRank;
  }
}
