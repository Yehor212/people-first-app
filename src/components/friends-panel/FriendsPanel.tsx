/**
 * FriendsPanel — social friends panel orchestrator
 * Decomposed from the original 694-line monolith (TD-20).
 * This file: ~280L, 2 useState, delegates state to 3 custom hooks.
 */

import { useState } from "react";
import { motion, AnimatePresence, useReducedMotion } from "framer-motion";
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
} from "lucide-react";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { EmptyState } from "@/components/EmptyState";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useModalKeyboard } from "@/hooks/useModalKeyboard";
import { isUserOnline } from "@/lib/presenceService";
import type { Friend } from "./types";
import { formatLastActive } from "./types";
import type { FriendsPanelProps } from "./types";
import { useFriendsData } from "./useFriendsData";
import { useFriendForm } from "./useFriendForm";
import { useFriendActions } from "./useFriendActions";
import { FriendProfileCard } from "./FriendProfileCard";
import { FriendDetailView } from "./FriendDetailView";

export function FriendsPanel({
  onClose,
  onOpenChallenges,
  initialFriendCode,
  userName = "Zen User",
  currentStreak = 0,
  level = 1,
}: FriendsPanelProps) {
  const { t, language } = useLanguage();
  const tRecord = t as unknown as Record<string, string>;
  const prefersReducedMotion = useReducedMotion() ?? false;

  // --- Orchestrator-owned state (2 useState) ---
  const [showSettings, setShowSettings] = useState(false);
  const [selectedFriend, setSelectedFriend] = useState<Friend | null>(null);

  // --- Hooks ---
  const data = useFriendsData({ userName, currentStreak, level });
  const form = useFriendForm({ initialFriendCode, onSuccess: data.refreshAll, t: tRecord });
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

  // Escape key + focus trap (mirrors dual back handler logic)
  const escapeClose = selectedFriend ? () => setSelectedFriend(null) : onClose;
  const { modalRef, handleKeyDown: modalKeyDown } = useModalKeyboard({
    isOpen: true,
    onClose: escapeClose,
    closeOnEscape: true,
    trapFocus: true,
  });

  // Bound formatLastActive with current translations
  const fmtLastActive = (dateStr: string) => formatLastActive(dateStr, tRecord);

  // Filter visible activities for global feed
  const hiddenFriendIds = new Set(data.friends.filter((f) => f.activityHidden).map((f) => f.id));
  const visibleActivities = data.activities.filter((a) => !hiddenFriendIds.has(a.friendId));

  return (
    <>
      {/* Desktop backdrop */}
      <div
        className="hidden md:block fixed inset-0 z-[59] bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
        onClick={onClose}
        aria-hidden="true"
      />
      <div
        ref={modalRef}
        onKeyDown={modalKeyDown}
        role="dialog"
        aria-modal="true"
        aria-labelledby="friends-panel-title"
        data-testid="friends-panel"
        className="fixed inset-0 md:mx-auto md:my-6 md:max-w-2xl md:rounded-2xl md:shadow-2xl z-[60] bg-background/95 backdrop-blur-sm overflow-x-hidden overflow-y-auto motion-safe:animate-fade-in"
      >
        <div className="mx-auto max-w-lg space-y-[24px] px-[16px] py-[24px]">
          {/* Header */}
          <div className="flex flex-col gap-[12px] min-[420px]:flex-row min-[420px]:items-center min-[420px]:justify-between">
            <div className="min-w-0">
              <h2
                id="friends-panel-title"
                className="zen-text-gradient flex min-w-0 items-start gap-[8px] text-2xl font-bold"
              >
                <Users className="h-[24px] w-[24px] shrink-0" aria-hidden="true" />
                <span className="min-w-0 break-normal [overflow-wrap:normal]">
                  {tRecord.friends || "Friends"}
                </span>
              </h2>
            </div>
            <div className="flex items-center gap-[8px] self-end min-[420px]:self-auto">
              <button
                onClick={() => void actions.handleRefresh()}
                disabled={actions.isRefreshing}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-muted p-[12px] motion-safe:transition-colors hover:bg-muted/80"
                aria-label={tRecord.refresh || "Refresh"}
              >
                <RefreshCw
                  className={cn("h-[16px] w-[16px]", actions.isRefreshing && "animate-spin")}
                  aria-hidden="true"
                />
              </button>
              <button
                onClick={() => setShowSettings(!showSettings)}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-muted p-[12px] motion-safe:transition-colors hover:bg-muted/80"
                aria-label={tRecord.settings || "Settings"}
              >
                <Settings className="h-[16px] w-[16px]" aria-hidden="true" />
              </button>
              <button
                onClick={onClose}
                aria-label={tRecord.close || "Close"}
                className="flex min-h-[44px] min-w-[44px] shrink-0 items-center justify-center rounded-xl bg-muted p-[12px] motion-safe:transition-colors hover:bg-muted/80"
              >
                <X className="h-[20px] w-[20px]" aria-hidden="true" />
              </button>
            </div>
          </div>

          {onOpenChallenges && (
            <nav
              aria-label={tRecord.friendChallenges || "Friends & Challenges"}
              className="grid gap-[8px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,20ch),1fr))]"
            >
              <Button
                type="button"
                variant="outline"
                onClick={onOpenChallenges}
                data-testid="social-hub-challenges-tab"
                className="h-auto min-h-[48px] min-w-0 whitespace-normal break-normal px-[8px] py-[10px] hyphens-auto [overflow-wrap:normal]"
              >
                <Trophy className="me-[6px] h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {tRecord.socialHubChallengesTab || tRecord.challenges || "Challenges"}
              </Button>
              <Button
                type="button"
                variant="secondary"
                aria-current="page"
                data-testid="social-hub-friends-tab"
                className="h-auto min-h-[48px] min-w-0 whitespace-normal break-normal px-[8px] py-[10px] hyphens-auto [overflow-wrap:normal]"
              >
                <Users className="me-[6px] h-[18px] w-[18px] shrink-0" aria-hidden="true" />
                {tRecord.friends || "Friends"}
              </Button>
            </nav>
          )}

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
            {!data.myProfile && (
              <div
                className="flex min-w-0 items-start gap-[10px] border-b bg-card/50 p-[16px]"
                role="status"
                aria-live="polite"
              >
                <RefreshCw
                  className={cn(
                    "mt-[2px] h-[18px] w-[18px] shrink-0 text-muted-foreground",
                    data.profilePublication === "loading" && "motion-safe:animate-spin",
                  )}
                  aria-hidden="true"
                />
                <p className="min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
                  {data.profilePublication === "loading"
                    ? tRecord.friendProfilePreparing || "Preparing your friend code…"
                    : tRecord.friendProfileUnavailable ||
                      "Your friend code is unavailable right now. Check your connection and try again."}
                </p>
              </div>
            )}

            {/* Add Friend Section */}
            <div className="border-b p-[16px]">
              <AnimatePresence mode="wait">
                {form.showAddFriend ? (
                  <motion.div
                    key="add-form"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
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
                        aria-label={t.friendCode || "Friend code"}
                        className={cn("font-mono text-center", form.addError && "input-error")}
                        maxLength={11}
                        onFocus={(e) => {
                          const el = e.target;
                          setTimeout(
                            () =>
                              el.scrollIntoView({
                                behavior: "smooth",
                                block: "center",
                              }),
                            300
                          );
                        }}
                      />
                      <Button
                        variant="ghost"
                        size="icon"
                        onClick={() => {
                          form.setShowAddFriend(false);
                          form.setFriendCode("");
                          form.setAddError(null);
                        }}
                        className="shrink-0"
                        aria-label={tRecord.cancel || "Cancel"}
                      >
                        <X className="w-4 h-4" aria-hidden="true" />
                      </Button>
                    </div>
                    {form.addError && (
                      <p className="text-sm text-destructive" role="status" aria-live="polite">
                        {form.addError}
                      </p>
                    )}
                    <Button
                      variant="gradient"
                      className="h-auto min-h-11 w-full whitespace-normal break-words"
                      onClick={form.throttledAddFriend}
                      disabled={!form.friendCode.trim() || form.isAdding}
                    >
                      {form.isAdding ? (
                        <RefreshCw className="w-4 h-4 animate-spin me-2" aria-hidden="true" />
                      ) : (
                        <UserPlus className="w-4 h-4 me-2" aria-hidden="true" />
                      )}
                      {tRecord.addFriend || "Add Friend"}
                    </Button>
                  </motion.div>
                ) : (
                  <motion.div
                    key="add-button"
                    initial={prefersReducedMotion ? false : { opacity: 0, y: -10 }}
                    animate={{ opacity: 1, y: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, y: 0 } : { opacity: 0, y: -10 }}
                  >
                    <Button
                      variant="outline"
                      className="h-auto min-h-11 w-full whitespace-normal break-words"
                      onClick={() => form.setShowAddFriend(true)}
                      data-testid="friends-add-by-code"
                    >
                      <UserPlus className="w-4 h-4 me-2" aria-hidden="true" />
                      {tRecord.addFriendByCode || "Add Friend by Code"}
                    </Button>
                  </motion.div>
                )}
              </AnimatePresence>
            </div>

            {/* Friends List / Friend Detail */}
            <div className="p-[16px]">
              <AnimatePresence mode="wait">
                {selectedFriend ? (
                  <motion.div
                    key="friend-detail"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: 40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: 40 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
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
                      language={language}
                    />
                  </motion.div>
                ) : (
                  <motion.div
                    key="friends-list"
                    initial={prefersReducedMotion ? false : { opacity: 0, x: -40 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={prefersReducedMotion ? { opacity: 1, x: 0 } : { opacity: 0, x: -40 }}
                    transition={{ duration: prefersReducedMotion ? 0 : 0.2 }}
                  >
                    <h3 className="mb-3 break-words text-sm font-medium text-muted-foreground">
                      {tRecord.yourFriends || "Your Friends"} ({data.friends.length})
                    </h3>

                    {data.friends.length === 0 ? (
                      <EmptyState
                        icon={<Users className="w-6 h-6 text-primary" aria-hidden="true" />}
                        title={tRecord.noFriendsYet || "No friends yet"}
                        message={
                          tRecord.addFriendsHint || "Share your code or add friends by their code"
                        }
                        size="compact"
                        action={{
                          label: tRecord.addFriendByCode || "Add Friend by Code",
                          onClick: () => form.setShowAddFriend(true),
                          icon: <UserPlus className="w-4 h-4" aria-hidden="true" />,
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
                            className="flex items-center gap-3 p-3 rounded-xl bg-card border cursor-pointer hover:bg-accent/5 motion-safe:transition-colors"
                            onClick={() => setSelectedFriend(friend)}
                            role="button"
                            tabIndex={0}
                            onKeyDown={(e) => {
                              if (e.key === "Enter" || e.key === " ") {
                                e.preventDefault();
                                setSelectedFriend(friend);
                              }
                            }}
                          >
                            <div className="w-12 h-12 rounded-xl bg-primary/10 flex items-center justify-center text-xl shrink-0 relative">
                              {friend.avatarEmoji}
                              {friend.userId && isUserOnline(friend.userId) && (
                                <div className="absolute -bottom-0.5 -right-0.5 w-3 h-3 bg-green-500 rounded-full border-2 border-card" />
                              )}
                            </div>
                            <div className="flex-1 min-w-0">
                              <p className="font-medium text-foreground [overflow-wrap:anywhere]">
                                {friend.displayName}
                              </p>
                              <div className="flex flex-wrap items-center gap-x-3 gap-y-1 text-xs text-muted-foreground">
                                <span className="flex items-center gap-1">
                                  <Flame className="w-3 h-3 text-orange-500" aria-hidden="true" />
                                  {friend.streakHidden ? "—" : friend.currentStreak}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Trophy className="w-3 h-3 text-yellow-500" aria-hidden="true" />
                                  {friend.levelHidden ? "—" : friend.level}
                                </span>
                                <span className="flex items-center gap-1">
                                  <Clock className="w-3 h-3" aria-hidden="true" />
                                  {fmtLastActive(friend.lastActive)}
                                </span>
                              </div>
                            </div>
                            <ChevronLeft
                              className="w-4 h-4 text-muted-foreground rotate-180 rtl:scale-x-[-1] shrink-0"
                              aria-hidden="true"
                            />
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
              <div className="border-t p-[16px]">
                <h3 className="text-sm font-medium text-muted-foreground mb-3">
                  {tRecord.recentActivity || "Recent Activity"}
                </h3>
                <div className="space-y-2">
                  {visibleActivities.map((activity) => (
                    <div
                      key={activity.id}
                      className="flex items-center gap-3 p-2 rounded-lg bg-muted/50"
                    >
                      <span className="shrink-0 text-lg">{activity.icon}</span>
                      <div className="flex-1 min-w-0">
                        <p className="text-sm text-foreground [overflow-wrap:anywhere]">
                          <span className="font-medium">{activity.friendName}</span>{" "}
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
    </>
  );
}

export default FriendsPanel;
