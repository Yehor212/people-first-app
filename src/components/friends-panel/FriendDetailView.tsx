import { ChevronLeft, Flame, Trophy, Clock, Users, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { isUserOnline } from "@/lib/presenceService";
import { getLocale } from "@/lib/timeUtils";
import type { Language } from "@/i18n/translations";
import type { Friend, FriendActivity } from "./types";

interface FriendDetailViewProps {
  friend: Friend;
  activities: FriendActivity[];
  confirmRemoveFriend: Friend | null;
  onBack: () => void;
  onRemove: (friend: Friend) => void;
  onConfirmRemove: () => void;
  onCancelRemove: () => void;
  formatLastActive: (dateStr: string) => string;
  t: Record<string, string>;
  language: Language;
}

export function FriendDetailView({
  friend,
  activities,
  confirmRemoveFriend,
  onBack,
  onRemove,
  onConfirmRemove,
  onCancelRemove,
  formatLastActive,
  t,
  language,
}: FriendDetailViewProps) {
  const friendActivities = friend.activityHidden
    ? []
    : activities.filter((a) => a.friendId === friend.id);

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        aria-label={t.back || "Back"}
        className="mb-4 flex min-h-11 items-center gap-1.5 px-1 text-start text-sm text-muted-foreground motion-safe:transition-colors hover:text-foreground"
      >
        <ChevronLeft className="h-4 w-4 shrink-0 rtl:scale-x-[-1]" aria-hidden="true" />
        <span className="min-w-0 break-words">{t.yourFriends || "Your Friends"}</span>
      </button>

      {/* Profile card */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl mb-3 relative">
          {friend.avatarEmoji}
          {friend.userId && isUserOnline(friend.userId) && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
          )}
        </div>
        <h3 className="max-w-full text-xl font-bold text-foreground [overflow-wrap:anywhere]">
          {friend.displayName}
        </h3>
        {friend.status && (
          <p className="mt-1 max-w-full text-sm text-muted-foreground [overflow-wrap:anywhere]">
            {friend.status}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="mb-6 grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(7rem*var(--font-scale,1))),1fr))] gap-3">
        <div className="flex min-w-0 flex-col items-center rounded-xl bg-orange-500/10 p-3">
          <Flame className="w-5 h-5 text-orange-500 mb-1" />
          <span className="text-lg font-bold text-foreground">
            {friend.streakHidden ? "—" : friend.currentStreak}
          </span>
          <span className="break-words text-center text-xs text-muted-foreground">
            {t.streak || "Streak"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center rounded-xl bg-yellow-500/10 p-3">
          <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
          <span className="text-lg font-bold text-foreground">
            {friend.levelHidden ? "—" : friend.level}
          </span>
          <span className="break-words text-center text-xs text-muted-foreground">
            {t.level || "Level"}
          </span>
        </div>
        <div className="flex min-w-0 flex-col items-center rounded-xl bg-blue-500/10 p-3">
          <Clock className="w-5 h-5 text-blue-500 mb-1" />
          <span className="break-words text-center text-lg font-bold text-foreground">
            {formatLastActive(friend.lastActive)}
          </span>
          <span className="break-words text-center text-xs text-muted-foreground">
            {t.active || "Active"}
          </span>
        </div>
      </div>

      {/* Friend since */}
      <div className="mb-6 flex items-start justify-center gap-2 text-sm text-muted-foreground">
        <Users className="h-4 w-4 shrink-0" />
        <span className="min-w-0 break-words">
          {t.friendsSince || "Friends since"}{" "}
          {new Date(friend.friendsSince).toLocaleDateString(getLocale(language), {
            day: "numeric",
            month: "long",
            year: "numeric",
          })}
        </span>
      </div>

      {/* Friend's recent activity */}
      {friendActivities.length > 0 && (
        <div className="mb-6">
          <h4 className="text-sm font-medium text-muted-foreground mb-2">
            {t.recentActivity || "Recent Activity"}
          </h4>
          <div className="space-y-2">
            {friendActivities.map((activity) => (
              <div key={activity.id} className="flex items-start gap-3 rounded-lg bg-muted/50 p-2">
                <span className="shrink-0 text-lg">{activity.icon}</span>
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-foreground [overflow-wrap:anywhere]">
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
      )}

      {/* Remove friend */}
      {confirmRemoveFriend?.id === friend.id ? (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(9rem*var(--font-scale,1))),1fr))] gap-2">
          <Button
            variant="destructive"
            className="h-auto min-h-11 whitespace-normal break-words"
            onClick={onConfirmRemove}
          >
            <Trash2 className="w-4 h-4 me-2" />
            {t.delete}
          </Button>
          <Button
            variant="outline"
            className="h-auto min-h-11 whitespace-normal break-words"
            onClick={onCancelRemove}
          >
            {t.cancel}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="h-auto min-h-11 w-full whitespace-normal break-words text-destructive hover:bg-destructive/10 hover:text-destructive"
          onClick={() => onRemove(friend)}
        >
          <Trash2 className="w-4 h-4 me-2" />
          {t.removeFriend || "Remove Friend"}
        </Button>
      )}
    </>
  );
}
