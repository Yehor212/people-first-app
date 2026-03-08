/**
 * Friends Sync - Cloud synchronization for friends list
 * Stage 3.2 of Premium Upgrade Plan
 *
 * Features:
 * - Unique friend code generation
 * - Friend request system
 * - Activity sharing with friends
 */

import { supabase } from '@/lib/supabaseClient';
import { logger } from '@/lib/logger';
import { generateSecureId } from '@/lib/validation';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { isAbortError } from '@/lib/validation';
import * as Sentry from '@sentry/react';

// ============================================
// TYPES
// ============================================

export interface Friend {
  id: string;
  /** Supabase auth user ID (for Presence online status) */
  userId?: string;
  friendCode: string;
  displayName: string;
  avatarEmoji: string;
  /** Friend's current active streak */
  currentStreak: number;
  /** Last time friend was active */
  lastActive: string;
  /** Friend's total XP/level */
  level: number;
  /** When friendship was established */
  friendsSince: string;
  /** Optional status message */
  status?: string;
  /** Privacy: friend has hidden their streak */
  streakHidden?: boolean;
  /** Privacy: friend has hidden their level */
  levelHidden?: boolean;
  /** Privacy: friend has hidden their activity */
  activityHidden?: boolean;
}

export interface FriendActivity {
  id: string;
  friendId: string;
  friendName: string;
  activityType: 'habit_completed' | 'streak_milestone' | 'achievement_unlocked' | 'level_up';
  description: string;
  icon: string;
  timestamp: string;
}

export interface MyProfile {
  friendCode: string;
  displayName: string;
  avatarEmoji: string;
  currentStreak: number;
  level: number;
  shareStreak: boolean;
  shareLevel: boolean;
  shareActivity: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const CODE_CHARS = 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
const CODE_PREFIX = 'ZF';

// ============================================
// LOCAL STORAGE HELPERS
// ============================================

export function loadFriends(): Friend[] {
  return safeLocalStorageGet<Friend[]>(SK.FRIENDS, []);
}

export function saveFriends(friends: Friend[]): void {
  safeLocalStorageSet(SK.FRIENDS, friends);
}

export function loadMyProfile(): MyProfile | null {
  return safeLocalStorageGet<MyProfile | null>(SK.MY_FRIEND_PROFILE, null);
}

export function saveMyProfile(profile: MyProfile): void {
  safeLocalStorageSet(SK.MY_FRIEND_PROFILE, profile);
}

export function loadFriendActivities(): FriendActivity[] {
  return safeLocalStorageGet<FriendActivity[]>(SK.FRIEND_ACTIVITIES, []);
}

export function saveFriendActivities(activities: FriendActivity[]): void {
  // Keep only last 50 activities
  const trimmed = activities.slice(0, 50);
  safeLocalStorageSet(SK.FRIEND_ACTIVITIES, trimmed);
}

// ============================================
// FRIEND CODE GENERATION
// ============================================

/**
 * Generate a unique friend code
 * Format: ZF-XXXXXXXX (8 chars)
 */
export function generateFriendCode(): string {
  const values = crypto.getRandomValues(new Uint8Array(8));
  const code = Array.from(values, v => CODE_CHARS[v % CODE_CHARS.length]).join('');
  return `${CODE_PREFIX}-${code}`;
}

/**
 * Validate friend code format
 */
export function isValidFriendCode(code: string): boolean {
  if (!code || typeof code !== 'string') return false;
  const normalized = code.trim().toUpperCase();
  return /^ZF-[A-Z0-9]{8}$/.test(normalized);
}

/**
 * Normalize friend code
 */
export function normalizeFriendCode(code: string): string {
  return code.trim().toUpperCase();
}

// ============================================
// PROFILE MANAGEMENT
// ============================================

/**
 * Initialize or get user's friend profile
 */
export function initializeMyProfile(displayName: string = 'Zen User', avatarEmoji: string = '🧘'): MyProfile {
  let profile = loadMyProfile();

  if (!profile) {
    profile = {
      friendCode: generateFriendCode(),
      displayName,
      avatarEmoji,
      currentStreak: 0,
      level: 1,
      shareStreak: true,
      shareLevel: true,
      shareActivity: true,
    };
    saveMyProfile(profile);
  }

  return profile;
}

/**
 * Update my profile
 */
export function updateMyProfile(updates: Partial<MyProfile>): MyProfile {
  const current = loadMyProfile() || initializeMyProfile();
  const updated = { ...current, ...updates };
  saveMyProfile(updated);
  return updated;
}

/**
 * Update my streak (called when streak changes)
 */
export function updateMyStreak(streak: number): void {
  const profile = loadMyProfile();
  if (profile) {
    profile.currentStreak = streak;
    saveMyProfile(profile);

    // Sync to cloud if available
    syncMyProfileToCloud(profile).catch((err) => {
      logger.warn('[FriendsSync] Failed to sync profile to cloud:', err);
    });
  }
}

/**
 * Update my level (called when level changes)
 */
export function updateMyLevel(level: number): void {
  const profile = loadMyProfile();
  if (profile) {
    profile.level = level;
    saveMyProfile(profile);

    // Sync to cloud if available
    syncMyProfileToCloud(profile).catch((err) => {
      logger.warn('[FriendsSync] Failed to sync profile to cloud:', err);
    });
  }
}

// ============================================
// FRIEND MANAGEMENT
// ============================================

/**
 * Add a friend by their code
 */
export async function addFriendByCode(friendCode: string): Promise<{
  success: boolean;
  friend?: Friend;
  error?: string;
}> {
  const normalizedCode = normalizeFriendCode(friendCode);

  if (!isValidFriendCode(normalizedCode)) {
    return { success: false, error: 'Invalid friend code format' };
  }

  // Check if already friends
  const friends = loadFriends();
  const existing = friends.find(f => f.friendCode === normalizedCode);
  if (existing) {
    return { success: false, error: 'Already friends with this user' };
  }

  // Check if it's own code
  const myProfile = loadMyProfile();
  if (myProfile?.friendCode === normalizedCode) {
    return { success: false, error: 'Cannot add yourself as a friend' };
  }

  // Try to find friend in cloud
  if (supabase) {
    try {
      const friendData = await findFriendByCode(normalizedCode);
      if (friendData) {
        const friend: Friend = {
          id: generateSecureId('friend'),
          userId: friendData.userId,
          friendCode: normalizedCode,
          displayName: friendData.displayName,
          avatarEmoji: friendData.avatarEmoji,
          currentStreak: friendData.currentStreak,
          lastActive: friendData.lastActive || new Date().toISOString(),
          level: friendData.level,
          friendsSince: new Date().toISOString(),
          status: friendData.status,
        };

        friends.push(friend);
        saveFriends(friends);

        return { success: true, friend };
      }
    } catch (error) {
      if (!isAbortError(error)) {
        logger.warn('[FriendsSync] Error finding friend in cloud:', error);
      }
    }
  }

  // If no cloud data, create with defaults
  const friend: Friend = {
    id: generateSecureId('friend'),
    friendCode: normalizedCode,
    displayName: 'Zen Friend',
    avatarEmoji: '🧘',
    currentStreak: 0,
    lastActive: new Date().toISOString(),
    level: 1,
    friendsSince: new Date().toISOString(),
  };

  friends.push(friend);
  saveFriends(friends);

  return { success: true, friend };
}

/**
 * Remove a friend
 */
export function removeFriend(friendId: string): boolean {
  const friends = loadFriends();
  const filtered = friends.filter(f => f.id !== friendId);

  if (filtered.length === friends.length) {
    return false;
  }

  saveFriends(filtered);

  // Also remove their activities
  const activities = loadFriendActivities();
  const filteredActivities = activities.filter(a => a.friendId !== friendId);
  saveFriendActivities(filteredActivities);

  return true;
}

/**
 * Get friends sorted by activity
 */
export function getFriendsSortedByActivity(): Friend[] {
  const friends = loadFriends();
  return friends.sort((a, b) =>
    new Date(b.lastActive).getTime() - new Date(a.lastActive).getTime()
  );
}

// ============================================
// CLOUD SYNC
// ============================================

/**
 * Check if cloud sync is available
 */
export function isCloudSyncAvailable(): boolean {
  return !!supabase;
}

/**
 * Sync my profile to cloud
 */
async function syncMyProfileToCloud(profile: MyProfile): Promise<void> {
  if (!supabase) return;

  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const user = session.user;

  try {
    // Using a generic profiles approach - in production, you'd have a proper table
    const { error } = await (supabase
      .from('user_profiles') as any)
      .upsert({
        user_id: user.id,
        friend_code: profile.friendCode,
        display_name: profile.displayName,
        avatar_emoji: profile.avatarEmoji,
        current_streak: profile.shareStreak ? profile.currentStreak : null,
        level: profile.shareLevel ? profile.level : null,
        share_activity: profile.shareActivity,
        updated_at: new Date().toISOString(),
      }, {
        onConflict: 'user_id',
      });

    if (error) {
      // Silently fail - table might not exist yet
      logger.log('[FriendsSync] Profile sync skipped:', error.code);
    }
  } catch (error) {
    if (!isAbortError(error)) {
      logger.log('[FriendsSync] Profile sync failed:', error);
    }
  }
}

/**
 * Find friend by their code in cloud
 */
async function findFriendByCode(friendCode: string): Promise<{
  userId?: string;
  displayName: string;
  avatarEmoji: string;
  currentStreak: number;
  level: number;
  lastActive?: string;
  status?: string;
} | null> {
  if (!supabase) return null;

  try {
    const { data, error } = await (supabase
      .from('user_profiles') as any)
      .select('user_id, display_name, avatar_emoji, current_streak, level, updated_at, status')
      .eq('friend_code', friendCode)
      .maybeSingle();

    if (error || !data) return null;

    return {
      userId: data.user_id,
      displayName: data.display_name || 'Zen Friend',
      avatarEmoji: data.avatar_emoji || '🧘',
      currentStreak: data.current_streak || 0,
      level: data.level || 1,
      lastActive: data.updated_at,
      status: data.status,
    };
  } catch (error) {
    if (!isAbortError(error)) {
      logger.log('[FriendsSync] Find friend failed:', error);
    }
    return null;
  }
}

/**
 * Refresh friends' data from cloud
 */
export async function refreshFriendsData(): Promise<void> {
  if (!supabase) return;

  const friends = loadFriends();
  if (friends.length === 0) return;

  Sentry.addBreadcrumb({
    category: 'friends',
    message: 'Refreshing friends data',
    level: 'info',
    data: { count: friends.length },
  });

  try {
    const friendCodes = friends.map(f => f.friendCode);

    const { data, error } = await (supabase
      .from('user_profiles') as any)
      .select('user_id, friend_code, display_name, avatar_emoji, current_streak, level, updated_at, status, share_activity')
      .in('friend_code', friendCodes);

    if (error || !data) return;

    // Update local friends with cloud data, respecting privacy flags
    const updatedFriends = friends.map(friend => {
      const cloudData = data.find(d => d.friend_code === friend.friendCode);
      if (cloudData) {
        return {
          ...friend,
          userId: cloudData.user_id || friend.userId,
          displayName: cloudData.display_name || friend.displayName,
          avatarEmoji: cloudData.avatar_emoji || friend.avatarEmoji,
          currentStreak: cloudData.current_streak ?? 0,
          level: cloudData.level ?? 1,
          lastActive: cloudData.updated_at || friend.lastActive,
          status: cloudData.status || friend.status,
          streakHidden: cloudData.current_streak === null,
          levelHidden: cloudData.level === null,
          activityHidden: cloudData.share_activity === false,
        };
      }
      return friend;
    });

    saveFriends(updatedFriends);
  } catch (error) {
    if (!isAbortError(error)) {
      logger.warn('[FriendsSync] Refresh failed:', error);
    }
  }
}

// ============================================
// FRIEND ACTIVITIES
// ============================================

/**
 * Add a friend activity notification
 */
export function addFriendActivity(activity: Omit<FriendActivity, 'id' | 'timestamp'>): void {
  const activities = loadFriendActivities();

  const newActivity: FriendActivity = {
    ...activity,
    id: generateSecureId('activity'),
    timestamp: new Date().toISOString(),
  };

  activities.unshift(newActivity);
  saveFriendActivities(activities);
}

/**
 * Get recent friend activities
 */
export function getRecentActivities(limit: number = 10): FriendActivity[] {
  const activities = loadFriendActivities();
  return activities.slice(0, limit);
}

/**
 * Mark activities as read (clear them)
 */
export function clearActivities(): void {
  saveFriendActivities([]);
}

// ============================================
// SHARE HELPERS
// ============================================

/**
 * Generate share text for friend code
 */
export function generateFriendCodeShareText(
  profile: MyProfile,
  translations: Record<string, string> = {}
): string {
  const t = translations;

  return [
    `${profile.avatarEmoji} ${t.addMeOnZenFlow || 'Add me on ZenFlow!'}`,
    '',
    `${t.friendCode || 'Friend Code'}: ${profile.friendCode}`,
    '',
    t.friendCodeJoinPrompt || 'Track habits together!',
  ].join('\n');
}

/**
 * Share friend code using Web Share API
 */
export async function shareFriendCode(
  profile: MyProfile,
  translations: Record<string, string> = {}
): Promise<boolean> {
  const text = generateFriendCodeShareText(profile, translations);

  if (navigator.share) {
    try {
      await navigator.share({
        title: `${profile.avatarEmoji} ${translations.addFriend || 'Add Friend'}`,
        text,
      });
      return true;
    } catch (error) {
      if ((error as Error).name !== 'AbortError') {
        logger.warn('[FriendsSync] Share failed:', error);
      }
      return false;
    }
  }

  // Fallback: copy to clipboard
  try {
    await navigator.clipboard.writeText(text);
    return true;
  } catch {
    return false;
  }
}

export default {
  loadFriends,
  saveFriends,
  loadMyProfile,
  saveMyProfile,
  initializeMyProfile,
  updateMyProfile,
  updateMyStreak,
  updateMyLevel,
  addFriendByCode,
  removeFriend,
  getFriendsSortedByActivity,
  isValidFriendCode,
  refreshFriendsData,
  addFriendActivity,
  getRecentActivities,
  shareFriendCode,
};
