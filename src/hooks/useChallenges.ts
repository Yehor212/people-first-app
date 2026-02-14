import { useState, useEffect } from 'react';
import { Challenge, Badge } from '@/types';
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
  const [_challenges, setChallenges] = useState<Challenge[]>([]);
  const [_badges, setBadges] = useState<Badge[]>([]);

  // Load challenges and badges on mount
  useEffect(() => {
    const loadedChallenges = getChallenges();
    const loadedBadges = getBadges();
    setChallenges(loadedChallenges);
    setBadges(loadedBadges);
  }, []);

  const _startChallenge = (challenge: Challenge) => {
    addChallenge(challenge);
    return challenge;
  };

  const _updateProgress = (challengeId: string, progress: number) => {
    return updateChallenge(challengeId, { progress });
  };

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
