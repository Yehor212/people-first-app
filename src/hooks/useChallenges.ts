import { useState, useEffect } from 'react';
import { Challenge, Badge, UserStats } from '@/types';
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
  const [challenges, setChallenges] = useState<Challenge[]>([]);
  const [badges, setBadges] = useState<Badge[]>([]);

  // Load challenges and badges on mount
  useEffect(() => {
    const loadedChallenges = getChallenges();
    const loadedBadges = getBadges();
    setChallenges(loadedChallenges);
    setBadges(loadedBadges);
  }, []);

  const startChallenge = (challenge: Challenge) => {
    addChallenge(challenge);
    return challenge;
  };

  const updateProgress = (challengeId: string, progress: number) => {
    return updateChallengeProgress(challengeId, progress);
  };

  return {
    challenges: getChallenges(),
    badges: getBadges(),
    addChallenge,
    updateChallengeProgress,
    unlockBadge,
    syncChallengeProgress,
    checkSpecialBadges
  };
}
