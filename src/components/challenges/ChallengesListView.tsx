import { Trophy, UserPlus, Users } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Translations } from '@/i18n/types';
import { Challenge, getAllChallenges } from '@/lib/friendChallenge';
import { ChallengeCard } from './ChallengeCard';

export function ChallengesListView({
  onSelectChallenge,
  onJoinChallenge,
  onOpenFriends,
  t,
}: {
  onSelectChallenge: (challenge: Challenge) => void;
  onJoinChallenge: () => void;
  onOpenFriends?: () => void;
  t: Translations;
}) {
  // Note: No useMemo - getAllChallenges reads from localStorage
  // and we need fresh data every render to reflect changes
  const challenges = getAllChallenges();

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const expiredChallenges = challenges.filter(c => c.status === 'expired');

  const socialHubNavigation = onOpenFriends ? (
    <nav
      aria-label={t.friendChallenges || "Friends & Challenges"}
      className="grid gap-[8px] [grid-template-columns:repeat(auto-fit,minmax(min(100%,20ch),1fr))]"
    >
      <Button
        type="button"
        variant="secondary"
        aria-current="page"
        data-testid="social-hub-challenges-tab"
        className="h-auto min-h-[48px] min-w-0 whitespace-normal break-normal px-[8px] py-[10px] hyphens-auto [overflow-wrap:normal]"
      >
        <Trophy className="me-[6px] h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {t.socialHubChallengesTab || t.challenges || "Challenges"}
      </Button>
      <Button
        type="button"
        variant="outline"
        onClick={onOpenFriends}
        data-testid="social-hub-friends-tab"
        className="h-auto min-h-[48px] min-w-0 whitespace-normal break-normal px-[8px] py-[10px] hyphens-auto [overflow-wrap:normal]"
      >
        <Users className="me-[6px] h-[18px] w-[18px] shrink-0" aria-hidden="true" />
        {t.friends || "Friends"}
      </Button>
    </nav>
  ) : null;

  if (challenges.length === 0) {
    return (
      <div className="space-y-[20px] pb-[24px] text-center">
        {socialHubNavigation}
        <div className="pt-[4px]">
        <div className="mb-[16px] text-[48px]" aria-hidden="true">🤝</div>
        <p className="min-w-0 break-words text-muted-foreground [overflow-wrap:anywhere]">
          {t.noChallenges || 'No challenges yet'}
        </p>
        <p className="mt-[4px] min-w-0 break-words text-sm text-muted-foreground [overflow-wrap:anywhere]">
          {t.createChallengePrompt || 'Create a challenge from any habit!'}
        </p>

        {/* Join button for empty state */}
        <Button
          onClick={onJoinChallenge}
          variant="outline"
          className="mt-[24px] h-auto min-h-12 max-w-full whitespace-normal break-words px-[12px] py-[12px] [overflow-wrap:anywhere]"
        >
          <UserPlus className="me-[8px] h-[20px] w-[20px] shrink-0" />
          {t.joinChallenge || 'Join Challenge'}
        </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {socialHubNavigation}

      {/* Join button at top */}
      <Button
        onClick={onJoinChallenge}
        variant="outline"
        className="w-full h-auto min-h-12 whitespace-normal break-words py-3"
      >
        <UserPlus className="w-4 h-4 me-2 shrink-0" />
        {t.joinChallenge || 'Join Challenge'}
      </Button>

      {/* Active challenges */}
      {activeChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <div className="w-2 h-2 rounded-full bg-[hsl(var(--mood-good))]" />
            {t.activeChallenges || 'Active Challenges'}
          </h3>
          <div className="space-y-2">
            {activeChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Completed challenges */}
      {completedChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-foreground mb-3 flex items-center gap-2">
            <Trophy className="w-4 h-4 text-accent" />
            {t.completedChallenges || 'Completed'}
          </h3>
          <div className="space-y-2">
            {completedChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}

      {/* Expired challenges */}
      {expiredChallenges.length > 0 && (
        <div>
          <h3 className="text-sm font-semibold text-muted-foreground mb-3">
            {t.expiredChallenges || 'Expired'}
          </h3>
          <div className="space-y-2 opacity-60">
            {expiredChallenges.map(challenge => (
              <ChallengeCard
                key={challenge.id}
                challenge={challenge}
                onClick={() => onSelectChallenge(challenge)}
                t={t}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
