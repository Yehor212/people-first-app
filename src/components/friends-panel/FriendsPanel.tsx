/**
 * FriendsPanel — social friends panel orchestrator
 * Decomposed from the original 694-line monolith (TD-20).
 * This file: ~280L, 2 useState, delegates state to 3 custom hooks.
 */

import { useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Users,
  UserPlus,
  X,
  Flame,
  Trophy,
  Clock,
  ChevronLeft,
  RefreshCw,
  Settings,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { EmptyState } from '@/components/EmptyState';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { isUserOnline } from '@/lib/presenceService';
import type { Friend } from './types';
import { formatLastActive } from './types';
import type { FriendsPanelProps } from './types';
import { useFriendsData } from './useFriendsData';
import { useFriendForm } from './useFriendForm';
import { useFriendActions } from './useFriendActions';
import { FriendProfileCard } from './FriendProfileCard';
import { FriendDetailView } from './FriendDetailView';

export function FriendsPanel({
  onClose,
  userName = 'Zen User',
  currentStreak = 0,
  level = 1,
}: FriendsPanelProps) {
  const { t } = useLanguage();
  const tRecord = t as unknown as Record<string, string>;

  // --- Orchestrator-owned state (2 useState) ---
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // --- Hooks ---
  const data = useFriendsData({ userName, currentStreak, level });
  const form = useFriendForm({ onSuccess: data.refreshAll, t: tRecord });
  const actions = useFriendActions({
    myProfile: data.myProfile,
    onRefresh: data.refreshAll,
    onRemoveSuccess: data.refreshAll,
    t: tRecord,
  });

  // Dual back handler: detail view closes first, then panel
  useBackHandler(!selectedFriend, onClose);
  useBackHandler(!!selectedFriend, () => setSelectedFriend(null));
  useScrollLock(true);

  // Bound formatLastActive with current translations
  const fmtLastActive = (dateStr: string) => formatLastActive(dateStr, tRecord);

  // Filter visible activities for global feed
  const hiddenFriendIds = new Set(data.friends.filter(f => f.activityHidden).map(f => f.id));
  const visibleActivities = data.activities.filter(a => !hiddenFriendIds.has(a.friendId));

  return (
    <div
      role="dialog"
      aria-modal="true"
      aria-labelledby="friends-panel-title"
      className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm overflow-y-auto motion-safe:animate-fade-in"
    >
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="friends-panel-title" className="text-2xl font-bold zen-text-gradient flex items-center gap-2">
              <Users className="w-6 h-6" />
              {tRecord.friends || 'Friends'}
            </h2>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => void actions.handleRefresh()}
              disabled={actions.isRefreshing}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
              aria-label={tRecord.refresh || 'Refresh'}
            >
              <RefreshCw className={cn("w-4 h-4", actions.isRefreshing && "animate-spin")} />
            </button>
            <button
              onClick={() => setShowSettings(!showSettings)}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
              aria-label={tRecord.settings || 'Settings'}
            >
              <Settings className="w-4 h-4" />
            </button>
            <button
              onClick={onClose}
              aria-label={tRecord.close || 'Close'}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          </div>
        </div>

        {/* Content */}
        <div>
          {/* My Profile Card + Privacy Settings */}
          {data.myProfile && (
            <FriendProfileCard
              myProfile={data.myProfile}
              copied={actions.copied}
              isSharing={actions.isSharing}
              showSettings={showSettings}
              onCopy={() => void actions.handleCopyCode()}
              onShare={() => void actions.handleShare()}
              onPrivacyChange={data.handlePrivacyChange}
              t={tRecord}
            />
          )}

          {/* Add Friend Section */}
          <div className="p-4 border-b">
            <AnimatePresence mode="wait">
              {form.showAddFriend ? (
                <motion.div
                  key="add-form"
                  initial={{ opacity: 0, y: -10 }}
                  animate={{ opacity: 1, y: 0 }}
                  exit={{ opacity: 0, y: -10 }}
                  className="space-y-3"
                >
                  <div className="flex items-center gap-2">
                    <Input
                      value={form.friendCode}
                      onChange={(e) => {
                        form.setFriendCode(e.target.value.toUpperCase());
                        form.setAddError(null);
                      }}
                      placeholder="ZF-XXXXXXXX"
                      className="font-mono text-center"
                      maxLength={11}
                    />
                    <Button
                      variant="ghost"
                      size="icon"
                      onClick={() => {
                        form.setShowAddFriend(false);
                        form.setFriendCode('');
                        form.setAddError(null);
                      }}
                      className="shrink-0"
                      aria-label={tRecord.cancel || 'Cancel'}
                    >
                      <X className="w-4 h-4" />
                    </Button>
                  </div>
                  {form.addError && (
                    <p className="text-sm text-destructive" role="status" aria-live="polite">{form.addError}</p>
                  )}
                  <Button
                    variant="gradient"
                    className="w-full"
                    onClick={form.throttledAddFriend}
                    disabled={!form.friendCode.trim() || form.isAdding}
                  >
                    {form.isAdding ? (
                      <RefreshCw className="w-4 h-4 animate-spin me-2" />
                    ) : (
                      <UserPlus className="w-4 h-4 me-2" />
                    )}
                    {tRecord.addFriend || 'Add Friend'}
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
                    onClick={() => form.setShowAddFriend(true)}
                  >
                    <UserPlus className="w-4 h-4 me-2" />
                    {tRecord.addFriendByCode || 'Add Friend by Code'}
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
                  <FriendDetailView
                    friend={selectedFriend}
                    activities={data.activities}
                    confirmRemoveFriend={actions.confirmRemoveFriend}
                    onBack={() => setSelectedFriend(null)}
                    onRemove={(f) => actions.setConfirmRemoveFriend(f)}
                    onConfirmRemove={() => {
                      actions.handleRemoveFriend(selectedFriend);
                      actions.setConfirmRemoveFriend(null);
                      setSelectedFriend(null);
                    }}
                    onCancelRemove={() => actions.setConfirmRemoveFriend(null)}
                    formatLastActive={fmtLastActive}
                    t={tRecord}
                  />
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
                    {tRecord.yourFriends || 'Your Friends'} ({data.friends.length})
                  </h3>

                  {data.friends.length === 0 ? (
                    <EmptyState
                      icon={<Users className="w-6 h-6 text-primary" />}
                      title={tRecord.noFriendsYet || 'No friends yet'}
                      message={tRecord.addFriendsHint || 'Share your code or add friends by their code'}
                      size="compact"
                      action={{
                        label: tRecord.addFriendByCode || 'Add Friend by Code',
                        onClick: () => form.setShowAddFriend(true),
                        icon: <UserPlus className="w-4 h-4" />,
                      }}
                    />
                  ) : (
                    <div className="space-y-2">
                      {data.friends.map((friend) => (
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
                          <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0 relative">
                            {friend.avatarEmoji}
                            {friend.userId && isUserOnline(friend.userId) && (
                              <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                            )}
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
                                {fmtLastActive(friend.lastActive)}
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
          {visibleActivities.length > 0 && (
            <div className="p-4 border-t">
              <h3 className="text-sm font-medium text-muted-foreground mb-3">
                {tRecord.recentActivity || 'Recent Activity'}
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
                        {fmtLastActive(activity.timestamp)}
                      </p>
                    </div>
                  </div>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}

export default FriendsPanel;
