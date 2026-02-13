/**
 * Leaderboard Component
 * Part of v1.3.0 "Harmony" - Social Features
 *
 * Displays weekly/monthly/streak leaderboards with opt-in system.
 */

import { useState, useEffect, useCallback, useRef } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';

// Constants for timeout and retry
const FETCH_TIMEOUT = 10000; // 10 seconds
const MAX_RETRIES = 3;
const RETRY_DELAYS = [1000, 3000, 5000]; // Exponential backoff
import {
  getLeaderboard,
  getUserLeaderboardEntry,
  getUserRanks,
  optInToLeaderboard,
  optOutOfLeaderboard,
  updateDisplayName,
  getRankMedal,
  formatRank,
  type LeaderboardEntry,
  type LeaderboardStats,
  type LeaderboardType,
} from '@/lib/leaderboard';
import { announce } from '@/lib/a11y';
import { SkeletonList } from '@/components/ui/skeleton';
import {
  Trophy,
  Flame,
  Star,
  Users,
  Eye,
  EyeOff,
  RefreshCw,
  Crown,
  Medal,
  Sparkles,
  X,
} from 'lucide-react';
// Sheet replaced with custom bottom-sheet modal
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { Input } from '@/components/ui/input';
import { Switch } from '@/components/ui/switch';
import { toast } from 'sonner';

// ============================================
// TYPES
// ============================================

interface LeaderboardProps {
  trigger?: React.ReactNode;
}

// ============================================
// COMPONENT
// ============================================

export function Leaderboard({ trigger }: LeaderboardProps) {
  const { t } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);

  useBackHandler(isOpen, () => setIsOpen(false));
  useScrollLock(isOpen);
  const [activeTab, setActiveTab] = useState<LeaderboardType>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userRanks, setUserRanks] = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isOptedIn, setIsOptedIn] = useState(false);
  const [retryCount, setRetryCount] = useState(0);

  // Track mounted state to prevent state updates after unmount
  const isMountedRef = useRef(true);

  useEffect(() => {
    isMountedRef.current = true;
    return () => {
      isMountedRef.current = false;
    };
  }, []);

  // Tab config
  const tabs: { type: LeaderboardType; label: string; icon: React.ReactNode }[] = [
    { type: 'weekly', label: t.weekly || 'Weekly', icon: <Trophy className="w-4 h-4" /> },
    { type: 'monthly', label: t.monthly || 'Monthly', icon: <Star className="w-4 h-4" /> },
    { type: 'streak', label: t.streak || 'Streak', icon: <Flame className="w-4 h-4" /> },
  ];

  // Helper to add timeout to a promise
  const withTimeout = <T,>(promise: Promise<T>, ms: number): Promise<T> => {
    return Promise.race([
      promise,
      new Promise<T>((_, reject) =>
        setTimeout(() => reject(new Error('Request timeout')), ms)
      ),
    ]);
  };

  // Load leaderboard data with timeout and retry
  const loadData = useCallback(async (retry = 0) => {
    if (!isMountedRef.current) return;

    setIsLoading(true);
    setError(null);
    setRetryCount(retry);

    try {
      // Add timeout to prevent indefinite loading
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

      // Retry with exponential backoff
      if (retry < MAX_RETRIES) {
        const delay = RETRY_DELAYS[retry] || 5000;
        logger.log(`[Leaderboard] Retrying in ${delay}ms (attempt ${retry + 1}/${MAX_RETRIES})`);
        setTimeout(() => {
          if (isMountedRef.current) {
            void loadData(retry + 1);
          }
        }, delay);
        return;
      }

      setError(
        isTimeout
          ? (t.leaderboardTimeout || 'Loading took too long. Please try again.')
          : (t.leaderboardLoadError || 'Failed to load leaderboard')
      );
    } finally {
      if (isMountedRef.current) {
        setIsLoading(false);
      }
    }
  }, [activeTab, t.leaderboardLoadError, t.leaderboardTimeout]);

  // Load data when opened or tab changes
  useEffect(() => {
    if (isOpen) {
      void loadData(0); // Start fresh with retry count 0
    }
  }, [isOpen, loadData]);

  // Handle opt-in toggle
  const handleOptInToggle = async (checked: boolean) => {
    if (checked) {
      const success = await optInToLeaderboard(displayName || 'Zen User');
      if (success) {
        setIsOptedIn(true);
        toast.success(t.leaderboardOptedIn || 'You joined the leaderboard!');
        announce('You joined the leaderboard');
        void loadData(0);
      }
    } else {
      const success = await optOutOfLeaderboard();
      if (success) {
        setIsOptedIn(false);
        toast.success(t.leaderboardOptedOut || 'You left the leaderboard');
        announce('You left the leaderboard');
      }
    }
  };

  // Handle display name update
  const handleNameUpdate = async () => {
    if (!displayName.trim()) return;

    const success = await updateDisplayName(displayName);
    if (success) {
      toast.success(t.nameUpdated || 'Display name updated!');
      void loadData(0);
    }
  };

  // Get value to display based on tab
  const getValue = (entry: LeaderboardEntry): number => {
    switch (activeTab) {
      case 'weekly': return entry.weeklyXp;
      case 'monthly': return entry.monthlyXp;
      case 'streak': return entry.currentStreak;
    }
  };

  // Get unit label
  const getUnit = (): string => {
    switch (activeTab) {
      case 'weekly':
      case 'monthly':
        return 'XP';
      case 'streak':
        return t.days || 'days';
    }
  };

  // Get user's rank for current tab
  const getCurrentRank = (): number | null => {
    if (!userRanks) return null;
    switch (activeTab) {
      case 'weekly': return userRanks.weeklyRank;
      case 'monthly': return userRanks.monthlyRank;
      case 'streak': return userRanks.streakRank;
    }
  };

  return (
    <>
      {/* Trigger */}
      <div onClick={() => setIsOpen(true)}>
        {trigger || (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            aria-label={t.leaderboard || 'Leaderboard'}
          >
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-medium">{t.leaderboard || 'Leaderboard'}</span>
          </button>
        )}
      </div>

      {isOpen && (
        <>
          <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => setIsOpen(false)} />
          <div role="dialog" aria-modal="true" aria-label={t.leaderboard || 'Leaderboard'} className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[2rem] bg-background max-h-[85dvh] overflow-hidden animate-slide-up pb-safe">

        <div className="pb-4 px-6 pt-6 flex items-center justify-between">
          <h2 className="flex items-center gap-2 text-xl font-semibold">
            <Trophy className="w-6 h-6 text-primary" />
            {t.leaderboard || 'Leaderboard'}
          </h2>
          <button
            onClick={() => setIsOpen(false)}
            className="p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-muted transition-colors"
            aria-label={t.close || 'Close'}
          >
            <X className="w-5 h-5 text-muted-foreground" />
          </button>
        </div>

        {/* Inner content */}
        <div className="px-6 overflow-y-auto" style={{ maxHeight: 'calc(85vh - 72px)' }}>

        {/* Tabs - Premium */}
        <div
          role="tablist"
          aria-label={t.leaderboardType || 'Leaderboard type'}
          className="flex gap-1.5 p-1.5 mb-4 rounded-xl"
          style={{
            background: 'hsl(var(--foreground) / 0.05)',
          }}
        >
          {tabs.map((tab) => (
            <motion.button
              key={tab.type}
              role="tab"
              aria-selected={activeTab === tab.type}
              aria-controls={`leaderboard-${tab.type}`}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2.5 px-3 rounded-lg font-medium transition-all",
                activeTab === tab.type
                  ? "bg-gradient-to-r from-violet-500/80 to-purple-600/80 text-white"
                  : "text-foreground/60 hover:text-foreground hover:bg-foreground/5"
              )}
              style={activeTab === tab.type ? {
                boxShadow: '0 0 12px rgba(139, 92, 246, 0.3)'
              } : undefined}
              whileHover={{ scale: activeTab !== tab.type ? 1.02 : 1 }}
              whileTap={{ scale: 0.98 }}
            >
              {tab.icon}
              <span className="text-sm">{tab.label}</span>
            </motion.button>
          ))}
        </div>

        {/* Opt-in Settings - Premium */}
        <div
          className="rounded-xl p-4 mb-4"
          style={{
            background: 'linear-gradient(135deg, hsl(var(--foreground) / 0.05) 0%, hsl(var(--foreground) / 0.02) 100%)',
            border: '1px solid hsl(var(--foreground) / 0.1)',
          }}
        >
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOptedIn ? (
                <Eye className="w-4 h-4 text-violet-400" />
              ) : (
                <EyeOff className="w-4 h-4 text-foreground/40" />
              )}
              <span className="font-medium text-sm text-foreground/80">
                {t.showOnLeaderboard || 'Show on leaderboard'}
              </span>
            </div>
            <Switch
              checked={isOptedIn}
              onCheckedChange={handleOptInToggle}
              aria-label={t.showOnLeaderboard || 'Show on leaderboard'}
            />
          </div>

          {isOptedIn && (
            <div className="flex gap-2">
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                placeholder={t.displayName || 'Display name'}
                maxLength={20}
                className="flex-1 bg-foreground/10 border-foreground/10 text-foreground placeholder:text-foreground/40"
                onBlur={handleNameUpdate}
                onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
              />
            </div>
          )}

          {/* User's rank - Premium */}
          {isOptedIn && getCurrentRank() && (
            <motion.div
              className="mt-3 flex items-center gap-2 text-sm px-3 py-2 rounded-lg"
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              style={{
                background: 'rgba(139, 92, 246, 0.15)',
              }}
            >
              <Medal className="w-4 h-4 text-violet-400" />
              <span className="text-foreground/70">
                {t.yourRank || 'Your rank'}: <strong className="text-violet-700 dark:text-violet-300">{formatRank(getCurrentRank())}</strong>
                {userRanks && <span className="text-foreground/40"> / {userRanks.totalParticipants}</span>}
              </span>
            </motion.div>
          )}
        </div>

        {/* Leaderboard List */}
        <div
          id={`leaderboard-${activeTab}`}
          role="tabpanel"
          aria-label={`${tabs.find(t => t.type === activeTab)?.label} leaderboard`}
          className="space-y-2 overflow-y-auto max-h-[45vh] pb-4"
        >
          {isLoading ? (
            <div className="py-4">
              <SkeletonList count={5} />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-destructive/50" />
              <p className="text-destructive mb-3">{error}</p>
              <button
                onClick={() => loadData(0)}
                className="px-4 py-2 bg-primary text-primary-foreground rounded-lg hover:bg-primary/90 transition-colors"
              >
                {t.retry || 'Retry'}
              </button>
            </div>
          ) : entries.length === 0 ? (
            <div className="text-center py-12 text-muted-foreground">
              <Users className="w-12 h-12 mx-auto mb-3 opacity-50" />
              <p>{t.noParticipants || 'No participants yet'}</p>
              <p className="text-sm mt-1">{t.beFirst || 'Be the first to join!'}</p>
            </div>
          ) : (
            <AnimatePresence>
              {entries.map((entry, index) => {
                const rankConfig = {
                  1: {
                    bg: 'linear-gradient(135deg, rgba(245, 158, 11, 0.2) 0%, rgba(251, 191, 36, 0.1) 100%)',
                    border: 'rgba(245, 158, 11, 0.3)',
                    glow: '0 0 16px rgba(245, 158, 11, 0.2)',
                    rankBg: 'linear-gradient(135deg, #f59e0b 0%, #fbbf24 100%)',
                    textColor: 'text-amber-400',
                  },
                  2: {
                    bg: 'linear-gradient(135deg, rgba(156, 163, 175, 0.2) 0%, rgba(209, 213, 219, 0.1) 100%)',
                    border: 'rgba(156, 163, 175, 0.3)',
                    glow: '0 0 12px rgba(156, 163, 175, 0.15)',
                    rankBg: 'linear-gradient(135deg, #9ca3af 0%, #d1d5db 100%)',
                    textColor: 'text-gray-600 dark:text-gray-300',
                  },
                  3: {
                    bg: 'linear-gradient(135deg, rgba(180, 83, 9, 0.2) 0%, rgba(217, 119, 6, 0.1) 100%)',
                    border: 'rgba(180, 83, 9, 0.3)',
                    glow: '0 0 12px rgba(180, 83, 9, 0.15)',
                    rankBg: 'linear-gradient(135deg, #b45309 0%, #d97706 100%)',
                    textColor: 'text-orange-400',
                  },
                }[entry.rank as 1 | 2 | 3];

                return (
                  <motion.div
                    key={entry.id}
                    initial={{ opacity: 0, x: -20 }}
                    animate={{ opacity: 1, x: 0 }}
                    exit={{ opacity: 0, x: 20 }}
                    transition={{ delay: index * 0.05 }}
                    className={cn(
                      "flex items-center gap-3 p-3.5 rounded-xl transition-all",
                      entry.isCurrentUser && "ring-1 ring-violet-500/40"
                    )}
                    style={rankConfig ? {
                      background: rankConfig.bg,
                      border: `1px solid ${rankConfig.border}`,
                      boxShadow: rankConfig.glow,
                    } : {
                      background: entry.isCurrentUser
                        ? 'rgba(139, 92, 246, 0.1)'
                        : 'hsl(var(--foreground) / 0.05)',
                      border: '1px solid hsl(var(--foreground) / 0.1)',
                    }}
                  >
                    {/* Rank - Premium */}
                    <div
                      className="w-9 h-9 flex items-center justify-center rounded-lg font-bold text-sm"
                      style={rankConfig ? {
                        background: rankConfig.rankBg,
                        boxShadow: '0 2px 8px rgba(0, 0, 0, 0.2)',
                      } : {
                        background: 'hsl(var(--foreground) / 0.1)',
                      }}
                    >
                      <span className={rankConfig ? 'text-white' : 'text-foreground/60'}>
                        {getRankMedal(entry.rank ?? 0) || entry.rank}
                      </span>
                    </div>

                    {/* User info */}
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-1.5">
                        <span className={cn(
                          "font-medium truncate",
                          entry.isCurrentUser ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-white"
                        )}>
                          {entry.displayName}
                        </span>
                        {entry.isCurrentUser && (
                          <span className="text-xs px-1.5 py-0.5 rounded bg-violet-500/20 text-violet-700 dark:text-violet-300">({t.you || 'you'})</span>
                        )}
                        {entry.rank === 1 && (
                          <Crown className="w-4 h-4 text-amber-400" />
                        )}
                      </div>
                      {activeTab === 'streak' && entry.longestStreak > entry.currentStreak && (
                        <span className="text-xs text-foreground/40">
                          {t.best || 'Best'}: {entry.longestStreak} {t.days || 'days'}
                        </span>
                      )}
                    </div>

                    {/* Score - Premium */}
                    <div className="text-end">
                      <span className={cn(
                        "font-bold text-lg",
                        rankConfig?.textColor || (entry.isCurrentUser ? "text-violet-700 dark:text-violet-300" : "text-gray-900 dark:text-white")
                      )}>
                        {getValue(entry).toLocaleString()}
                      </span>
                      <span className="text-xs text-foreground/40 ms-1">
                        {getUnit()}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </AnimatePresence>
          )}
        </div>

        </div>

        {/* Refresh button - Premium */}
        <motion.button
          onClick={() => loadData(0)}
          disabled={isLoading}
          className="absolute top-4 end-4 p-2.5 rounded-xl bg-foreground/5 border border-foreground/10 hover:bg-foreground/10 transition-colors"
          aria-label={t.refresh || 'Refresh'}
          whileHover={{ scale: 1.05 }}
          whileTap={{ scale: 0.95 }}
        >
          <RefreshCw className={cn("w-5 h-5 text-foreground/60", isLoading && "animate-spin")} />
        </motion.button>
          </div>
        </>
      )}
    </>
  );
}

export default Leaderboard;
