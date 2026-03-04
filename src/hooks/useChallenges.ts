import {
  getChallenges,
  getBadges,
  addChallenge,
  updateChallenge,
  syncChallengeProgress,
  checkSpecialBadges,
  unlockBadge
} from '@/lib/challengeStorage';

export function useChallenges() {
  return {
    challenges: getChallenges(),
    badges: getBadges(),
    addChallenge,
    updateChallenge,
    unlockBadge,
    syncChallengeProgress,
    checkSpecialBadges
  };
}
