import { Trophy, UserPlus } from 'lucide-react';
import { Button } from '@/components/ui/button';
import type { Translations } from '@/i18n/types';
import { Challenge, getAllChallenges } from '@/lib/friendChallenge';
import { ChallengeCard } from './ChallengeCard';

export function ChallengesListView({
  onSelectChallenge,
  onJoinChallenge,
  t,
}: {
  onSelectChallenge: (challenge: Challenge) => void;
  onJoinChallenge: () => void;
  t: Translations;
}) {
  // Note: No useMemo - getAllChallenges reads from localStorage
  // and we need fresh data every render to reflect changes
  const challenges = getAllChallenges();

  const activeChallenges = challenges.filter(c => c.status === 'active');
  const completedChallenges = challenges.filter(c => c.status === 'completed');
  const expiredChallenges = challenges.filter(c => c.status === 'expired');

  if (challenges.length === 0) {
    return (
      <div className="py-12 text-center">
        <div className="text-5xl mb-4">🤝</div>
        <p className="text-muted-foreground">
          {t.noChallenges || 'No challenges yet'}
        </p>
        <p className="text-sm text-muted-foreground mt-1">
          {t.createChallengePrompt || 'Create a challenge from any habit!'}
        </p>

        {/* Join button for empty state */}
        <Button
          onClick={onJoinChallenge}
          variant="outline"
          className="mt-6"
        >
          <UserPlus className="w-4 h-4 me-2" />
          {t.joinChallenge || 'Join Challenge'}
        </Button>
      </div>
    );
  }

  return (
    <div className="space-y-6 pb-8">
      {/* Join button at top */}
      <Button
        onClick={onJoinChallenge}
        variant="outline"
        className="w-full h-12"
      >
        <UserPlus className="w-4 h-4 me-2" />
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
