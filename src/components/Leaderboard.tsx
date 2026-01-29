/**
 * Leaderboard Component
 * Part of v1.3.0 "Harmony" - Social Features
 *
 * Displays weekly/monthly/streak leaderboards with opt-in system.
 */

import { useState, useEffect, useCallback } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { logger } from '@/lib/logger';
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
} from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle, SheetTrigger } from '@/components/ui/sheet';
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
  const [activeTab, setActiveTab] = useState<LeaderboardType>('weekly');
  const [entries, setEntries] = useState<LeaderboardEntry[]>([]);
  const [userEntry, setUserEntry] = useState<LeaderboardEntry | null>(null);
  const [userRanks, setUserRanks] = useState<LeaderboardStats | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [displayName, setDisplayName] = useState('');
  const [isOptedIn, setIsOptedIn] = useState(false);

  // Tab config
  const tabs: { type: LeaderboardType; label: string; icon: React.ReactNode }[] = [
    { type: 'weekly', label: t.weekly || 'Weekly', icon: <Trophy className="w-4 h-4" /> },
    { type: 'monthly', label: t.monthly || 'Monthly', icon: <Star className="w-4 h-4" /> },
    { type: 'streak', label: t.streak || 'Streak', icon: <Flame className="w-4 h-4" /> },
  ];

  // Load leaderboard data
  const loadData = useCallback(async () => {
    setIsLoading(true);
    setError(null);
    try {
      const [leaderboardData, userData, ranksData] = await Promise.all([
        getLeaderboard(activeTab, 10),
        getUserLeaderboardEntry(),
        getUserRanks(),
      ]);

      setEntries(leaderboardData);
      setUserEntry(userData);
      setUserRanks(ranksData);

      if (userData) {
        setDisplayName(userData.displayName);
        setIsOptedIn(userData.optIn);
      }
    } catch (err) {
      logger.error('Failed to load leaderboard:', err);
      setError(t.leaderboardLoadError || 'Failed to load leaderboard');
    } finally {
      setIsLoading(false);
    }
  }, [activeTab, t.leaderboardLoadError]);

  // Load data when opened or tab changes
  useEffect(() => {
    if (isOpen) {
      loadData();
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
        loadData();
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
      loadData();
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
    <Sheet open={isOpen} onOpenChange={setIsOpen}>
      <SheetTrigger asChild>
        {trigger || (
          <button
            className="flex items-center gap-2 px-4 py-2 bg-secondary rounded-lg hover:bg-secondary/80 transition-colors"
            aria-label={t.leaderboard || 'Leaderboard'}
          >
            <Trophy className="w-5 h-5 text-primary" />
            <span className="font-medium">{t.leaderboard || 'Leaderboard'}</span>
          </button>
        )}
      </SheetTrigger>

      <SheetContent
        side="bottom"
        className="h-[85vh] rounded-t-3xl"
        aria-label={t.leaderboard || 'Leaderboard'}
      >
        <SheetHeader className="pb-4">
          <SheetTitle className="flex items-center gap-2 text-xl">
            <Trophy className="w-6 h-6 text-primary" />
            {t.leaderboard || 'Leaderboard'}
          </SheetTitle>
        </SheetHeader>

        {/* Tabs */}
        <div
          role="tablist"
          aria-label={t.leaderboardType || 'Leaderboard type'}
          className="flex gap-2 mb-4"
        >
          {tabs.map((tab) => (
            <button
              key={tab.type}
              role="tab"
              aria-selected={activeTab === tab.type}
              aria-controls={`leaderboard-${tab.type}`}
              onClick={() => setActiveTab(tab.type)}
              className={cn(
                "flex-1 flex items-center justify-center gap-2 py-2 px-3 rounded-lg font-medium transition-all",
                activeTab === tab.type
                  ? "bg-primary text-primary-foreground"
                  : "bg-secondary text-muted-foreground hover:bg-secondary/80"
              )}
            >
              {tab.icon}
              <span className="text-sm">{tab.label}</span>
            </button>
          ))}
        </div>

        {/* Opt-in Settings */}
        <div className="bg-secondary/50 rounded-xl p-4 mb-4">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              {isOptedIn ? (
                <Eye className="w-4 h-4 text-primary" />
              ) : (
                <EyeOff className="w-4 h-4 text-muted-foreground" />
              )}
              <span className="font-medium text-sm">
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
                className="flex-1"
                onBlur={handleNameUpdate}
                onKeyDown={(e) => e.key === 'Enter' && handleNameUpdate()}
              />
            </div>
          )}

          {/* User's rank */}
          {isOptedIn && getCurrentRank() && (
            <div className="mt-3 flex items-center gap-2 text-sm text-muted-foreground">
              <Medal className="w-4 h-4" />
              <span>
                {t.yourRank || 'Your rank'}: <strong className="text-foreground">{formatRank(getCurrentRank()!)}</strong>
                {userRanks && ` / ${userRanks.totalParticipants}`}
              </span>
            </div>
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
            <div className="flex items-center justify-center py-12">
              <RefreshCw className="w-6 h-6 animate-spin text-muted-foreground" />
            </div>
          ) : error ? (
            <div className="text-center py-12">
              <Trophy className="w-12 h-12 mx-auto mb-3 text-destructive/50" />
              <p className="text-destructive mb-3">{error}</p>
              <button
                onClick={loadData}
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
              {entries.map((entry, index) => (
                <motion.div
                  key={entry.id}
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  exit={{ opacity: 0, x: 20 }}
                  transition={{ delay: index * 0.05 }}
                  className={cn(
                    "flex items-center gap-3 p-3 rounded-xl transition-all",
                    entry.isCurrentUser
                      ? "bg-primary/10 ring-1 ring-primary/30"
                      : "bg-secondary/50"
                  )}
                >
                  {/* Rank */}
                  <div className={cn(
                    "w-8 h-8 flex items-center justify-center rounded-full font-bold text-sm",
                    entry.rank === 1 && "bg-yellow-500/20 text-yellow-600",
                    entry.rank === 2 && "bg-gray-300/30 text-gray-500",
                    entry.rank === 3 && "bg-amber-600/20 text-amber-700",
                    (entry.rank ?? 0) > 3 && "bg-secondary text-muted-foreground"
                  )}>
                    {getRankMedal(entry.rank ?? 0) || entry.rank}
                  </div>

                  {/* User info */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-1">
                      <span className={cn(
                        "font-medium truncate",
                        entry.isCurrentUser && "text-primary"
                      )}>
                        {entry.displayName}
                      </span>
                      {entry.isCurrentUser && (
                        <span className="text-xs text-primary">(you)</span>
                      )}
                      {entry.rank === 1 && (
                        <Crown className="w-4 h-4 text-yellow-500" />
                      )}
                    </div>
                    {activeTab === 'streak' && entry.longestStreak > entry.currentStreak && (
                      <span className="text-xs text-muted-foreground">
                        {t.best || 'Best'}: {entry.longestStreak} {t.days || 'days'}
                      </span>
                    )}
                  </div>

                  {/* Score */}
                  <div className="text-right">
                    <span className={cn(
                      "font-bold",
                      entry.rank === 1 && "text-yellow-600",
                      entry.rank === 2 && "text-gray-500",
                      entry.rank === 3 && "text-amber-700",
                      (entry.rank ?? 0) > 3 && "text-foreground"
                    )}>
                      {getValue(entry).toLocaleString()}
                    </span>
                    <span className="text-xs text-muted-foreground ml-1">
                      {getUnit()}
                    </span>
                  </div>
                </motion.div>
              ))}
            </AnimatePresence>
          )}
        </div>

        {/* Refresh button */}
        <button
          onClick={loadData}
          disabled={isLoading}
          className="absolute top-4 right-12 p-2 rounded-lg hover:bg-secondary transition-colors"
          aria-label={t.refresh || 'Refresh'}
        >
          <RefreshCw className={cn("w-5 h-5", isLoading && "animate-spin")} />
        </button>
      </SheetContent>
    </Sheet>
  );
}

export default Leaderboard;
