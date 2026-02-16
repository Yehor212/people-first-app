import { useState, useCallback } from 'react';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/haptics';
import { announce } from '@/lib/a11y';
import { addFriendByCode } from '@/storage/friendsSync';

interface UseFriendFormOptions {
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

export function useFriendForm({ onSuccess, t }: UseFriendFormOptions): UseFriendFormReturn {
  const [showAddFriend, setShowAddFriend] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);

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
        setAddError(result.error || t.addFriendError || 'Could not add friend');
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
