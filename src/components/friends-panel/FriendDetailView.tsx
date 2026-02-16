import { ChevronLeft, Flame, Trophy, Clock, Users, Trash2 } from 'lucide-react';
import { Button } from '@/components/ui/button';
import { isUserOnline } from '@/lib/presenceService';
import type { Friend, FriendActivity } from './types';

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
}

export function FriendDetailView({
  friend, activities, confirmRemoveFriend,
  onBack, onRemove, onConfirmRemove, onCancelRemove,
  formatLastActive, t,
}: FriendDetailViewProps) {
  const friendActivities = friend.activityHidden
    ? []
    : activities.filter(a => a.friendId === friend.id);

  return (
    <>
      {/* Back button */}
      <button
        onClick={onBack}
        aria-label={t.back || 'Back'}
        className="flex items-center gap-1.5 text-sm text-muted-foreground hover:text-foreground transition-colors mb-4"
      >
        <ChevronLeft className="w-4 h-4" />
        {t.yourFriends || 'Your Friends'}
      </button>

      {/* Profile card */}
      <div className="flex flex-col items-center text-center mb-6">
        <div className="w-20 h-20 rounded-2xl bg-primary/10 flex items-center justify-center text-4xl mb-3 relative">
          {friend.avatarEmoji}
          {friend.userId && isUserOnline(friend.userId) && (
            <div className="absolute -bottom-1 -right-1 w-4 h-4 bg-green-500 rounded-full border-2 border-card" />
          )}
        </div>
        <h3 className="text-xl font-bold text-foreground">
          {friend.displayName}
        </h3>
        {friend.status && (
          <p className="text-sm text-muted-foreground mt-1">
            {friend.status}
          </p>
        )}
      </div>

      {/* Stats grid */}
      <div className="grid grid-cols-3 gap-3 mb-6">
        <div className="flex flex-col items-center p-3 rounded-xl bg-orange-500/10">
          <Flame className="w-5 h-5 text-orange-500 mb-1" />
          <span className="text-lg font-bold text-foreground">{friend.streakHidden ? '—' : friend.currentStreak}</span>
          <span className="text-xs text-muted-foreground">{t.streak || 'Streak'}</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-yellow-500/10">
          <Trophy className="w-5 h-5 text-yellow-500 mb-1" />
          <span className="text-lg font-bold text-foreground">{friend.levelHidden ? '—' : friend.level}</span>
          <span className="text-xs text-muted-foreground">{t.level || 'Level'}</span>
        </div>
        <div className="flex flex-col items-center p-3 rounded-xl bg-blue-500/10">
          <Clock className="w-5 h-5 text-blue-500 mb-1" />
          <span className="text-lg font-bold text-foreground">{formatLastActive(friend.lastActive)}</span>
          <span className="text-xs text-muted-foreground">{t.active || 'Active'}</span>
        </div>
      </div>

      {/* Friend since */}
      <div className="flex items-center justify-center gap-2 text-sm text-muted-foreground mb-6">
        <Users className="w-4 h-4" />
        <span>
          {t.friendsSince || 'Friends since'}{' '}
          {new Date(friend.friendsSince).toLocaleDateString(undefined, {
            day: 'numeric',
            month: 'long',
            year: 'numeric',
          })}
        </span>
      </div>

      {/* Friend's recent activity */}
      {friendActivities.length > 0 && (
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
      )}

      {/* Remove friend */}
      {confirmRemoveFriend?.id === friend.id ? (
        <div className="flex items-center gap-2">
          <Button
            variant="destructive"
            className="flex-1"
            onClick={onConfirmRemove}
          >
            <Trash2 className="w-4 h-4 me-2" />
            {t.delete}
          </Button>
          <Button
            variant="outline"
            className="flex-1"
            onClick={onCancelRemove}
          >
            {t.cancel}
          </Button>
        </div>
      ) : (
        <Button
          variant="outline"
          className="w-full text-destructive hover:text-destructive hover:bg-destructive/10"
          onClick={() => onRemove(friend)}
        >
          <Trash2 className="w-4 h-4 me-2" />
          {t.removeFriend || 'Remove Friend'}
        </Button>
      )}
    </>
  );
}
