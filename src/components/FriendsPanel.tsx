/**
 * FriendsPanel - Social friends feature
 * Stage 3.2 of Premium Upgrade Plan
 *
 * Features:
 * - Add friend by code
 * - View friends list with streaks
 * - Share your friend code
 * - Friend activity feed
 */

import { useState, useEffect, useCallback } from 'react';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  Share2,
  Copy,
  Check,
  ChevronLeft,
  X,
  Flame,
  Trophy,
  Clock,
  RefreshCw,
  Trash2,
  Settings,
  Loader2,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import { Switch } from '@/components/ui/switch';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap, hapticSuccess, hapticError } from '@/lib/haptics';
import { announce } from '@/lib/a11y';
import { useBackHandler } from '@/hooks/useBackHandler';
import {
  loadMyProfile,
  initializeMyProfile,
  updateMyProfile,
  addFriendByCode,
  removeFriend,
  getFriendsSortedByActivity,
  refreshFriendsData,
  shareFriendCode,
  getRecentActivities,
  type Friend,
  type MyProfile,
  type FriendActivity,
} from '@/storage/friendsSync';

interface FriendsPanelProps {
  onClose: () => void;
  userName?: string;
  currentStreak?: number;
  level?: number;
}

export function FriendsPanel({
  onClose,
  userName = 'Zen User',
  currentStreak = 0,
  level = 1,
}: FriendsPanelProps) {
  const { t } = useLanguage();

  const [myProfile, setMyProfile] = useState<MyProfile | null>(null);
  const [friends, setFriends] = useState<Friend[]>([]);
  const [activities, setActivities] = useState<FriendActivity[]>([]);

  const [showAddFriend, setShowAddFriend] = useState(false);
  const [showSettings, setShowSettings] = useState(false);
  const [friendCode, setFriendCode] = useState('');
  const [isAdding, setIsAdding] = useState(false);
  const [addError, setAddError] = useState<string | null>(null);
  const [copied, setCopied] = useState(false);
  const [isRefreshing, setIsRefreshing] = useState(false);
  const [isSharing, setIsSharing] = useState(false);
  const [confirmRemoveFriend, setConfirmRemoveFriend] = useState<Friend | null>(null);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // Dual back handler: detail view closes first, then panel
  useBackHandler(!selectedFriend, onClose);
  useBackHandler(!!selectedFriend, () => setSelectedFriend(null));

  // Initialize profile and load data on mount
  useEffect(() => {
    let profile = loadMyProfile();
    if (!profile) {
      profile = initializeMyProfile(userName);
    }

    // Update streak and level in profile
    if (profile.currentStreak !== currentStreak || profile.level !== level) {
      profile = updateMyProfile({ currentStreak, level });
    }

    setMyProfile(profile);
    setFriends(getFriendsSortedByActivity());
    setActivities(getRecentActivities(5));
  }, [userName, currentStreak, level]);

  // Refresh friends data from cloud
  const handleRefresh = useCallback(async () => {
    setIsRefreshing(true);
    hapticTap();

    try {
      await refreshFriendsData();
      setFriends(getFriendsSortedByActivity());
      announce(t.friendsRefreshed || 'Friends list refreshed');
    } finally {
      setIsRefreshing(false);
    }
  }, [t]);

  // Copy friend code
  const handleCopyCode = useCallback(async () => {
    if (!myProfile) return;

    try {
      await navigator.clipboard.writeText(myProfile.friendCode);
      setCopied(true);
      hapticSuccess();
      announce(t.codeCopied || 'Code copied to clipboard');
      setTimeout(() => setCopied(false), 2000);
    } catch {
      hapticError();
    }
  }, [myProfile, t]);

  // Share friend code
  const handleShare = useCallback(async () => {
    if (!myProfile) return;

    setIsSharing(true);
    hapticTap();
    try {
      const success = await shareFriendCode(myProfile, t);
      if (success) {
        hapticSuccess();
      }
    } finally {
      setIsSharing(false);
    }
  }, [myProfile, t]);

  // Add friend
  const handleAddFriend = useCallback(async () => {
    if (!friendCode.trim()) return;

    setIsAdding(true);
    setAddError(null);
    hapticTap();

    try {
      const result = await addFriendByCode(friendCode.trim());

      if (result.success) {
        hapticSuccess();
        announce(t.friendAdded || 'Friend added successfully');
        setFriendCode('');
        setShowAddFriend(false);
        setFriends(getFriendsSortedByActivity());
      } else {
        hapticError();
        setAddError(result.error || t.addFriendError || 'Could not add friend');
      }
    } finally {
      setIsAdding(false);
    }
  }, [friendCode, t]);

  const throttledAddFriend = useThrottledCallback(handleAddFriend, 1000);

  // Remove friend
  const handleRemoveFriend = useCallback((friend: Friend) => {
    hapticTap();

    if (removeFriend(friend.id)) {
      setFriends(getFriendsSortedByActivity());
      announce(t.friendRemoved || 'Friend removed');
    }
  }, [t]);

  // Update privacy settings
  const handlePrivacyChange = useCallback((key: keyof MyProfile, value: boolean) => {
    if (!myProfile) return;

    const updated = updateMyProfile({ [key]: value });
    setMyProfile(updated);
    hapticTap();
  }, [myProfile]);

  // Format relative time
  const formatLastActive = (dateStr: string): string => {
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
  };

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-panel-title"
      className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm overflow-y-auto animate-fade-in"
    >
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="friends-panel-title" className="text-2xl font-bold zen-text-gradient flex items-center gap-2">
              <Users className="w-6 h-6" />
              {t.friends || 'Friends'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={handleRefresh}
              disabled={isRefreshing}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <RefreshCw className={cn("w-4 h-4", isRefreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label={t.close || 'Close'}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
            {/* My Profile Card */}
            {myProfile && (
              <div className="p-4 border-b bg-card/50">
                <div className="flex items-center gap-4 mb-3">
                  <div className="w-14 h-14 rounded-2xl bg-primary/10 flex items-center justify-center text-2xl">
                    {myProfile.avatarEmoji}
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="font-semibold text-foreground truncate">
                      {myProfile.displayName}
                    </p>
                    <div className="flex items-center gap-3 text-sm text-muted-foreground">
                      <span className="flex items-center gap-1">
                        <Flame className="w-4 h-4 text-orange-500" />
                        {myProfile.currentStreak}
                      </span>
                      <span className="flex items-center gap-1">
                        <Trophy className="w-4 h-4 text-yellow-500" />
                        {t.level || 'Lvl'} {myProfile.level}
                      </span>
                    </div>
                  </div>
                </div>

                {/* Friend Code */}
                <div className="flex items-center gap-2">
                  <div className="flex-1 bg-background rounded-xl px-3 py-2 font-mono text-sm text-center">
                    {myProfile.friendCode}
                  </div>
                  <Button
                    variant="outline"
                    size="icon"
                    onClick={handleCopyCode}
                    className="h-10 w-10 shrink-0"
                  >
                    {copied ? (
                      <Check className="w-4 h-4 text-green-500" />
                    ) : (
                      <Copy className="w-4 h-4" />
                    )}
                  </Button>
                  <Button
                    variant="gradient"
                    size="icon"
                    onClick={handleShare}
                    disabled={isSharing}
                    className="h-10 w-10 shrink-0"
                  >
                    {isSharing ? <Loader2 className="w-4 h-4 animate-spin" /> : <Share2 className="w-4 h-4" />}
                  </Button>
                </div>
              </div>
            )}

            {/* Privacy Settings (collapsible) */}
            <AnimatePresence>
              {showSettings && myProfile && (
                <motion.div
                  initial={{ height: 0, opacity: 0 }}
                  animate={{ height: 'auto', opacity: 1 }}
                  exit={{ height: 0, opacity: 0 }}
                  className="border-b overflow-hidden"
                >
                  <div className="p-4 space-y-4">
                    <p className="text-sm font-medium text-muted-foreground">
                      {t.privacySettings || 'Privacy Settings'}
                    </p>
                    <div className="space-y-3">
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t.shareStreak || 'Share streak'}</span>
                        <Switch
                          checked={myProfile.shareStreak}
                          onCheckedChange={(v) => handlePrivacyChange('shareStreak', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t.shareLevel || 'Share level'}</span>
                        <Switch
                          checked={myProfile.shareLevel}
                          onCheckedChange={(v) => handlePrivacyChange('shareLevel', v)}
                        />
                      </div>
                      <div className="flex items-center justify-between">
                        <span className="text-sm">{t.shareActivity || 'Share activity'}</span>
                        <Switch
                          checked={myProfile.shareActivity}
                          onCheckedChange={(v) => handlePrivacyChange('shareActivity', v)}
                        />
                      </div>
                    </div>
                  </div>
                </motion.div>
              )}
            </AnimatePresence>

            {/* Add Friend Section */}
            <div className="p-4 border-b">
              <AnimatePresence mode="wait">
                {showAddFriend ? (
                  <motion.div
                    key="add-form"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                    className="space-y-3"
                  >
                    <div className="flex items-center gap-2">
                      <Input
                        value={friendCode}
                        onChange={(e) => {
                          setFriendCode(e.target.value.toUpperCase());
                          setAddError(null);
                        }}
                        placeholder="ZF-XXXXXXXX"
                        className="font-mono text-center"
                        maxLength={11}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          setShowAddFriend(false);
                          setFriendCode('');
                          setAddError(null);
                        }}
                        className="shrink-0"
                      >
                        <X className="w-4 h-4" />
                      </Button>
                    </div>
                    {addError && (
                      <p className="text-sm text-destructive">{addError}</p>
                    )}
                    <Button
                      variant="gradient"
                      className="w-full"
                      onClick={throttledAddFriend}
                      disabled={!friendCode.trim() || isAdding}
                    >
                      {isAdding ? (
                        <RefreshCw className="w-4 h-4 animate-spin mr-2" />
                      ) : (
                        <UserPlus className="w-4 h-4 mr-2" />
                      )}
                      {t.addFriend || 'Add Friend'}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="add-button"
                    initial={{ opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={{ opacity: 0, y: -10 }}
                  >
                    <Button
                      variant="outline"
                      className="w-full"
                      onClick={() => setShowAddFriend(true)}
                    >
                      <UserPlus className="w-4 h-4 mr-2" />
                      {t.addFriendByCode || 'Add Friend by Code'}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Friends List / Friend Detail */}
            <div className="p-4">
              <AnimatePresence mode="wait">
                {selectedFriend ? (
                  <motion.div
                    key="friend-detail"
                    initial={{ opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 40 }}
                    transition={{ duration: 0.2 }}
                  >
                    {/* Back button */}
                    <button
                      onClick={() => setSelectedFriend(null)}
                      aria-label={t.back || 'Back'}
                      className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
                    >
                      <ChevronLeft className="w-4 h-4" />
                      {t.yourFriends || 'Your Friends'}
                    </button>

                    {/* Profile card */}
                    <div className="flex flex-col items-center text-center mb-6">
                      <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl mb-3">
                        {selectedFriend.avatarEmoji}
                      </div>
                      <h3 className="text-xl font-bold text-foreground">
                        {selectedFriend.displayName}
                      </h3>
                      {selectedFriend.status && (
                        <p className="text-sm text-muted-foreground mt-1">
                          {selectedFriend.status}
                        </p>
                      )}
                    </div>

                    {/* Stats grid */}
                    <div className="grid grid-cols-3 gap-3 mb-6">
                      <div className="flex flex-col items-center p-3 rounded-xl bg-orange-500/10">
                        <Flame className="w-5 h-5 text-orange-500 mb-1" />
                        <span className="text-lg font-bold text-foreground">{selectedFriend.streakHidden ? '—' : selectedFriend.currentStreak}</span>
                        <span className="text-xs text-muted-foreground">{t.streak || 'Streak'}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-xl bg-yellow-500/10">
                        <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
                        <span className="text-lg font-bold text-foreground">{selectedFriend.levelHidden ? '—' : selectedFriend.level}</span>
                        <span className="text-xs text-muted-foreground">{t.level || 'Level'}</span>
                      </div>
                      <div className="flex flex-col items-center p-3 rounded-xl bg-blue-500/10">
                        <Clock className="w-5 h-5 text-blue-500 mb-1" />
                        <span className="text-lg font-bold text-foreground">{formatLastActive(selectedFriend.lastActive)}</span>
                        <span className="text-xs text-muted-foreground">{'Active'}</span>
                      </div>
                    </div>

                    {/* Friend since */}
                    <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
                      <Users className="w-4 h-4" />
                      <span>
                        {'Friends since'}{' '}
                        {new Date(selectedFriend.friendsSince).toLocaleDateString(undefined, {
                          day: 'numeric',
                          month: 'long',
                          year: 'numeric',
                        })}
                      </span>
                    </div>

                    {/* Friend's recent activity */}
                    {(() => {
                      if (selectedFriend.activityHidden) return null;
                      const friendActivities = activities.filter(a => a.friendId === selectedFriend.id);
                      if (friendActivities.length === 0) return null;
                      return (
                        <div className="mb-6">
                          <h4 className="text-sm font-medium text-muted-foreground mb-2">
                            {t.recentActivity || 'Recent Activity'}
                          </h4>
                          <div className="space-y-2">
                            {friendActivities.map((activity) => (
                              <div
                                key={activity.id}
                                className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                              >
                                <span className="text-lg">{activity.icon}</span>
                                <div className="flex-1 min-w-0">
                                  <p className="text-sm text-foreground truncate">
                                    {activity.description}
                                  </p>
                                  <p className="text-xs text-muted-foreground">
                                    {formatLastActive(activity.timestamp)}
                                  </p>
                                </div>
                              </div>
                            ))}
                          </div>
                        </div>
                      );
                    })()}

                    {/* Remove friend */}
                    {confirmRemoveFriend?.id === selectedFriend.id ? (
                      <div className="flex items-center gap-2">
                        <Button
                          variant="destructive"
                          className="flex-1"
                          onClick={() => {
                            handleRemoveFriend(selectedFriend);
                            setConfirmRemoveFriend(null);
                            setSelectedFriend(null);
                          }}
                        >
                          <Trash2 className="w-4 h-4 mr-2" />
                          {t.delete}
                        </Button>
                        <Button
                          variant="outline"
                          className="flex-1"
                          onClick={() => setConfirmRemoveFriend(null)}
                        >
                          {t.cancel}
                        </Button>
                      </div>
                    ) : (
                      <Button
                        variant="outline"
                        className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
                        onClick={() => setConfirmRemoveFriend(selectedFriend)}
                      >
                        <Trash2 className="w-4 h-4 mr-2" />
                        {'Remove Friend'}
                      </Button>
                    )}
                  </motion.div>
                ) : (
                  <motion.div
                    key="friends-list"
                    initial={{ opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: -40 }}
                    transition={{ duration: 0.2 }}
                  >
                    <h3 className="text-sm font-medium text-muted-foreground mb-3">
                      {t.yourFriends || 'Your Friends'} ({friends.length})
                    </h3>

                    {friends.length === 0 ? (
                      <EmptyState
                        icon={<Users className="w-6 h-6 text-primary" />}
                        title={t.noFriendsYet || 'No friends yet'}
                        message={t.addFriendsHint || 'Share your code or add friends by their code'}
                        size="compact"
                        action={{
                          label: t.addFriendByCode || 'Add Friend by Code',
                          onClick: () => setShowAddFriend(true),
                          icon: <UserPlus className="w-4 h-4" />,
                        }}
                      />
                    ) : (
                      <div className="space-y-2">
                        {friends.map((friend) => (
                          <motion.div
                            key={friend.id}
                            layout
                            initial={{ opacity: 0, y: 10 }}
                            animate={{ opacity: 1, y: 0 }}
                            exit={{ opacity: 0, x: -20 }}
                            className="flex items-center gap-3 p-3 rounded-xl bg-card border cursor-pointer hover:bg-accent/5 transition-colors"
                            onClick={() => setSelectedFriend(friend)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setSelectedFriend(friend); } }}
                          >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0">
                              {friend.avatarEmoji}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground truncate">
                                {friend.displayName}
                              </p>
                              <div className="flex items-center gap-3 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-orange-500" />
                                  {friend.streakHidden ? '—' : friend.currentStreak}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Trophy className="w-3 h-3 text-yellow-500" />
                                  {friend.levelHidden ? '—' : friend.level}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" />
                                  {formatLastActive(friend.lastActive)}
                                </span>
                              </div>
                            </div>
                            <ChevronLeft className="w-4 h-4 text-muted-foreground rotate-180 shrink-0" />
                          </motion.div>
                        ))}
                      </div>
                    )}
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Recent Activity */}
            {(() => {
              const hiddenFriendIds = new Set(friends.filter(f => f.activityHidden).map(f => f.id));
              const visibleActivities = activities.filter(a => !hiddenFriendIds.has(a.friendId));
              if (visibleActivities.length === 0) return null;
              return (
              <div className="p-4 border-t">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {t.recentActivity || 'Recent Activity'}
                </h3>
                <div className="space-y-2">
                  {visibleActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="text-lg">{activity.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground truncate">
                          <span className="font-medium">{activity.friendName}</span>{' '}
                          {activity.description}
                        </p>
                        <p className="text-xs text-muted-foreground">
                          {formatLastActive(activity.timestamp)}
                        </p>
                      </div>
                    </div>
                  ))}
                </div>
              </div>
              );
            })()}
          </div>
      </div>
    </div>
  );
}

export default FriendsPanel;
