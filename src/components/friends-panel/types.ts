import type { Friend, MyProfile, FriendActivity } from '@/storage/friendsSync';

export type { Friend, MyProfile, FriendActivity };

export interface FriendsPanelProps {
  onClose: () => void;
  onOpenChallenges?: () => void;
  initialFriendCode?: string;
  userName?: string;
  currentStreak?: number;
  level?: number;
}

/**
 * Format a date string as relative time (e.g., "Just now", "3h ago", "Yesterday").
 */
export function formatLastActive(dateStr: string, t: Record<string, string>): string {
  const date = new Date(dateStr);
  const now = new Date();
  const diffMs = now.getTime() - date.getTime();
  const diffHours = Math.floor(diffMs / (1000 * 60 * 60));
  const diffDays = Math.floor(diffMs / (1000 * 60 * 60 * 24));

  if (diffHours < 1) return t.justNow || 'Just now';
  if (diffHours < 24) return `${diffHours}${t.hoursAgo || 'h ago'}`;
  if (diffDays === 1) return t.yesterday || 'Yesterday';
  if (diffDays < 7) return `${diffDays}${t.daysAgo || 'd ago'}`;
  return date.toLocaleDateString();
}
