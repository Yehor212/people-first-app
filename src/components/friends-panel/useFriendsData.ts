import { useState, useEffect, useCallback } from 'react';
import { hapticTap } from '@/lib/haptics';
import { subscribeToPresence } from '@/lib/presenceService';
import {
  ensureMyFriendProfilePublished,
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
  profilePublication: "loading" | "ready" | "unavailable";
  friends: Friend[];
  activities: FriendActivity[];
  refreshAll: () => void;
  handlePrivacyChange: (key: keyof MyProfile, value: boolean) => void;
}

export function useFriendsData({ userName, currentStreak, level }: UseFriendsDataOptions): UseFriendsDataReturn {
  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [profilePublication, setProfilePublication] = useState<
    "loading" | "ready" | "unavailable"
  >("loading");
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);
  const [, forcePresenceUpdate] = useState(0);

  // Presence: re-render when online users change
  useEffect(() => {
    return subscribeToPresence(() => forcePresenceUpdate(n => n + 1));
  }, []);

  // A code is shareable only after the aligned cloud profile can resolve it.
  useEffect(() => {
    let cancelled = false;
    setMyProfile(null);
    setProfilePublication("loading");
    setFriends(getFriendsSortedByActivity());
    setActivities(getRecentActivities(5));

    void ensureMyFriendProfilePublished(userName, currentStreak, level).then((profile) => {
      if (cancelled) return;
      setMyProfile(profile);
      setProfilePublication(profile ? "ready" : "unavailable");
    });

    return () => {
      cancelled = true;
    };
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

  return {
    myProfile,
    profilePublication,
    friends,
    activities,
    refreshAll,
    handlePrivacyChange,
  };
}
