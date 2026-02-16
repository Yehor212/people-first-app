import { useState, useEffect, useCallback, useRef } from 'react';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/haptics';
import { announce } from '@/lib/a11y';
import {
  refreshFriendsData,
  shareFriendCode,
  removeFriend,
  getFriendsSortedByActivity,
  type Friend,
  type MyProfile,
} from '@/storage/friendsSync';

interface UseFriendActionsOptions {
  myProfile: MyProfile | null;
  onRefresh: () => void;
  onRemoveSuccess: () => void;
  t: Record<string, string>;
}

interface UseFriendActionsReturn {
  copied: boolean;
  isRefreshing: boolean;
  isSharing: boolean;
  confirmRemoveFriend: Friend | null;
  setConfirmRemoveFriend: (f: Friend | null) => void;
  handleRefresh: () => Promise<void>;
  handleCopyCode: () => Promise<void>;
  handleShare: () => Promise<void>;
  handleRemoveFriend: (friend: Friend) => void;
}

export function useFriendActions({ myProfile, onRefresh, onRemoveSuccess, t }: UseFriendActionsOptions): UseFriendActionsReturn {
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState<Friend | null>(null);

  const copiedTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup timer on unmount
  useEffect(() => {
    return () => {
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
    };
  }, []);

  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    void hapticTap();

    try {
      await refreshFriendsData();
      onRefresh();
      announce(t.friendsRefreshed || 'Friends list refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }, [t, onRefresh]);

  const handleCopyCode = useCallback(async () => {
    if (!myProfile) return;

    try {
      await navigator.clipboard.writeText(myProfile.friendCode);
      setCopied(true);
      void hapticSuccess();
      announce(t.codeCopied || 'Code copied to clipboard');
      if (copiedTimerRef.current) clearTimeout(copiedTimerRef.current);
      copiedTimerRef.current = setTimeout(() => setCopied(false), 2000);
    } catch {
      void hapticError();
    }
  }, [myProfile, t]);

  const handleShare = useCallback(async () => {
    if (!myProfile) return;

    setIsSharing(true);
    void hapticTap();
    try {
      const success = await shareFriendCode(myProfile, t);
      if (success) {
        void hapticSuccess();
      }
    } finally {
      setIsSharing(false);
    }
  }, [myProfile, t]);

  const handleRemoveFriend = useCallback((friend: Friend) => {
    void hapticTap();
    if (removeFriend(friend.id)) {
      onRemoveSuccess();
      announce(t.friendRemoved || 'Friend removed');
    }
  }, [t, onRemoveSuccess]);

  return {
    copied, isRefreshing, isSharing,
    confirmRemoveFriend, setConfirmRemoveFriend,
    handleRefresh, handleCopyCode, handleShare, handleRemoveFriend,
  };
}
