import { useState, useEffect, useCallback, useRef } from 'react';
import {
  getLeaderboard,
  getUserLeaderboardEntry,
  getUserRanks,
  optInToLeaderboard,
  optOutOfLeaderboard,
  updateDisplayName,
  type LeaderboardEntry,
  type LeaderboardStats,
  type LeaderboardType,
} from '@/lib/leaderboard';
import { announce } from '@/lib/a11y';
import { logger } from '@/lib/logger';
import { FETCH_TIMEOUT, MAX_RETRIES, RETRY_DELAYS } from './types';

function withTimeout<T>(promise: Promise<T>, ms: number): Promise<T> {
  return Promise.race([
    promise,
    new Promise<T>((_, reject) =>
      setTimeout(() => reject(new Error('Request timeout')), ms)
    ),
  ]);
}

interface UseLeaderboardDataOptions {
  activeTab: LeaderboardType;
  isOpen: boolean;
  timeoutLabel: string;
  loadErrorLabel: string;
}

export function useLeaderboardData({ activeTab, isOpen, timeoutLabel, loadErrorLabel }: UseLeaderboardDataOptions) {
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userRanks, setUserRanks] = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [, setRetryCount] = useState(0);

  const isMountedRef = useRef(true);
  const retryTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
      if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
    };
  }, []);

  const loadData = useCallback(async (retry = 0) => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    setRetryCount(retry);

    try {
      const [leaderboardData, userData, ranksData] = await withTimeout(
        Promise.all([
          getLeaderboard(activeTab, 10),
          getUserLeaderboardEntry(),
          getUserRanks(),
        ]),
        FETCH_TIMEOUT
      );

      if (!isMountedRef.current) return;

      setEntries(leaderboardData);
      setUserEntry(userData);
      setUserRanks(ranksData);

      if (userData) {
        setDisplayName(userData.displayName);
        setIsOptedIn(userData.optIn);
      }
    } catch (err) {
      if (!isMountedRef.current) return;

      const isTimeout = err instanceof Error && err.message === 'Request timeout';
      logger.error('Failed to load leaderboard:', isTimeout ? 'Timeout' : err);

      if (retry < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retry] || 5000;
        logger.log(`[Leaderboard] Retrying in ${delay}ms (attempt ${retry + 1}/${MAX_RETRIES})`);
        if (retryTimerRef.current) clearTimeout(retryTimerRef.current);
        retryTimerRef.current = setTimeout(() => {
          if (isMountedRef.current) void loadData(retry + 1);
        }, delay);
        return;
      }

      setError(
        isTimeout
          ? (timeoutLabel || 'Loading took too long. Please try again.')
          : (loadErrorLabel || 'Failed to load leaderboard')
      );
    } finally {
      if (isMountedRef.current) setIsLoading(false);
    }
  }, [activeTab, timeoutLabel, loadErrorLabel]);

  useEffect(() => {
    if (isOpen) void loadData(0);
  }, [isOpen, loadData]);

  const handleOptInToggle = async (checked: boolean) => {
    try {
      if (checked) {
        const success = await optInToLeaderboard(displayName || 'Zen User');
        if (success) {
          setIsOptedIn(true);
          announce('You joined the leaderboard');
          void loadData(0);
        }
      } else {
        const success = await optOutOfLeaderboard();
        if (success) {
          setIsOptedIn(false);
          announce('You left the leaderboard');
        }
      }
    } catch (err) {
      logger.error('[Leaderboard] Opt-in toggle failed:', err);
    }
  };

  const handleNameUpdate = async () => {
    if (!displayName.trim()) return;
    try {
      const success = await updateDisplayName(displayName);
      if (success) void loadData(0);
    } catch (err) {
      logger.error('[Leaderboard] Name update failed:', err);
    }
  };

  return {
    entries, userRanks, isLoading, error,
    displayName, setDisplayName, isOptedIn,
    loadData, handleOptInToggle, handleNameUpdate,
  };
}
