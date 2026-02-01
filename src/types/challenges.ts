/**
 * Friend Challenge Types for Supabase backend
 * Part of Phase 5.15 - Participants Leaderboard
 */

// ============================================
// FRONTEND TYPES (camelCase)
// ============================================

export interface FriendChallenge {
  id: string;
  code: string;
  creatorId: string;
  habitName: string;
  habitIcon: string;
  duration: number;
  startDate: string;
  endDate: string;
  status: 'active' | 'completed' | 'expired';
  createdAt: string;
  updatedAt: string;
}

export interface ChallengeMember {
  id: string;
  challengeId: string;
  userId: string;
  displayName: string;
  daysCompleted: number;
  currentStreak: number;
  lastActivityDate: string | null;
  completed: boolean;
  completedAt: string | null;
  joinedAt: string;
  rank?: number;
  isCurrentUser?: boolean;
}

export interface ChallengeLeaderboard {
  challenge: FriendChallenge;
  members: ChallengeMember[];
  myProgress: ChallengeMember | null;
}

// ============================================
// DATABASE ROW TYPES (snake_case)
// ============================================

export interface FriendChallengeRow {
  id: string;
  code: string;
  creator_id: string;
  habit_name: string;
  habit_icon: string;
  duration: number;
  start_date: string;
  end_date: string;
  status: 'active' | 'completed' | 'expired';
  created_at: string;
  updated_at: string;
}

export interface ChallengeMemberRow {
  id: string;
  challenge_id: string;
  user_id: string;
  display_name: string;
  days_completed: number;
  current_streak: number;
  last_activity_date: string | null;
  completed: boolean;
  completed_at: string | null;
  joined_at: string;
}

// ============================================
// HELPER TYPES
// ============================================

export type ChallengeStatus = 'active' | 'completed' | 'expired';
