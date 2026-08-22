import { useState, useCallback, useEffect } from 'react';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/haptics';
import { announce } from '@/lib/a11y';
import { addFriendByCode } from '@/storage/friendsSync';
import type { AddFriendFailureReason } from '@/storage/friendsSync';

interface UseFriendFormOptions {
  initialFriendCode?: string;
  onSuccess: () => void;
  t: Record<string, string>;
}

interface UseFriendFormReturn {
  showAddFriend: boolean;
  setShowAddFriend: (v: boolean) => void;
  friendCode: string;
  setFriendCode: (v: string) => void;
  isAdding: boolean;
  addError: string | null;
  setAddError: (v: string | null) => void;
  throttledAddFriend: () => void;
}

function getFriendFailureCopy(reason: AddFriendFailureReason, t: Record<string, string>): string {
  switch (reason) {
    case 'invalid':
      return t.friendInviteInvalid || 'That friend code is not valid. Check it and try again.';
    case 'self':
      return t.friendInviteSelf || 'That is your own friend code.';
    case 'duplicate':
      return t.friendInviteDuplicate || 'This friend is already in your list.';
    case 'offline':
      return t.friendInviteOffline || 'You are offline. Reconnect and try again.';
    case 'not_found':
      return t.friendInviteNotFound || 'We could not find that friend code. Check it and try again.';
    case 'signed_out':
      return t.friendInviteSignedOut || 'Sign in to add friends.';
    case 'unavailable':
      return t.friendInviteUnavailable || 'Friend lookup is unavailable right now. Try again later.';
  }
}

export function useFriendForm({ initialFriendCode, onSuccess, t }: UseFriendFormOptions): UseFriendFormReturn {
  const [showAddFriend, setShowAddFriend] = useState(Boolean(initialFriendCode));
  const [friendCode, setFriendCode] = useState(initialFriendCode ?? '');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

  useEffect(() => {
    if (!initialFriendCode) return;
    setFriendCode(initialFriendCode);
    setShowAddFriend(true);
    setAddError(null);
  }, [initialFriendCode]);

  const handleAddFriend = useCallback(async () => {
    if (!friendCode.trim()) return;

    setIsAdding(true);
    setAddError(null);
    void hapticTap();

    try {
      const result = await addFriendByCode(friendCode.trim());

      if (result.success) {
        void hapticSuccess();
        announce(t.friendAdded || 'Friend added successfully');
        setFriendCode('');
        setShowAddFriend(false);
        onSuccess();
      } else {
        void hapticError();
        setAddError(getFriendFailureCopy(result.reason, t));
      }
    } finally {
      setIsAdding(false);
    }
  }, [friendCode, t, onSuccess]);

  const throttledAddFriend = useThrottledCallback(handleAddFriend, 1000);

  return {
    showAddFriend, setShowAddFriend,
    friendCode, setFriendCode,
    isAdding, addError, setAddError,
    throttledAddFriend,
  };
}
