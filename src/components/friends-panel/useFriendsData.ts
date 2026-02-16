import { useState, useEffect, useCallback } from 'react';
import { hapticTap } from '@/lib/haptics';
import { subscribeToPresence } from '@/lib/presenceService';
import {
  loadMyProfile,
  initializeMyProfile,
  updateMyProfile,
  getFriendsSortedByActivity,
  getRecentActivities,
  type Friend,
  type MyProfile,
  type FriendActivity,
} from '@/storage/friendsSync';

interface UseFriendsDataOptions {
  userName: string;
  currentStreak: number;
  level: number;
}

interface UseFriendsDataReturn {
  myProfile: MyProfile | null;
  friends: Friend[];
  activities: FriendActivity[];
  refreshAll: () => void;
  handlePrivacyChange: (key: keyof MyProfile, value: boolean) => void;
}

export function useFriendsData({ userName, currentStreak, level }: UseFriendsDataOptions): UseFriendsDataReturn {
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [, forcePresenceUpdate] = useState(0);

  // Presence: re-render when online users change
  useEffect(() => {
    return subscribeToPresence(() => forcePresenceUpdate(n => n + 1));
  }, []);

  // Initialize profile and load data on mount
  useEffect(() => {
    let profile = loadMyProfile();
    if (!profile) {
      profile = initializeMyProfile(userName);
    }

    if (profile.currentStreak !== currentStreak || profile.level !== level) {
      profile = updateMyProfile({ currentStreak, level });
    }

    setMyProfile(profile);
    setFriends(getFriendsSortedByActivity());
    setActivities(getRecentActivities(5));
  }, [userName, currentStreak, level]);

  const refreshAll = useCallback(() => {
    setFriends(getFriendsSortedByActivity());
    setActivities(getRecentActivities(5));
  }, []);

  const handlePrivacyChange = useCallback((key: keyof MyProfile, value: boolean) => {
    if (!myProfile) return;
    const updated = updateMyProfile({ [key]: value });
    setMyProfile(updated);
    void hapticTap();
  }, [myProfile]);

  return { myProfile, friends, activities, refreshAll, handlePrivacyChange };
}
