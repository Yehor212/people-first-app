import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeJsonParse } from '@/lib/safeJson';
import { Sparkles, Trophy, Clock, Zap, Target, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  Quest,
  generateDailyQuest,
  generateWeeklyQuest,
  generateBonusQuest,
  shouldRegenerateQuest,
  getQuestTimeRemaining,
  getQuestCategoryEmoji,
  getQuestDifficultyColor,
} from '@/lib/randomQuests';
import { pushQuestsToCloud } from '@/storage/tasksCloudSync';

const STORAGE_KEY = 'zenflow_quests';

interface QuestsPanelProps {
  onClose?: () => void;
}

export function QuestsPanel({ onClose }: QuestsPanelProps) {
  const { t } = useLanguage();
  const [dailyQuest, setDailyQuest] = useState<Quest | null>(null);
  const [weeklyQuest, setWeeklyQuest] = useState<Quest | null>(null);
  const [bonusQuest, setBonusQuest] = useState<Quest | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load quests from localStorage
  useEffect(() => {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = safeJsonParse<{ daily?: Quest | null; weekly?: Quest | null; bonus?: Quest | null }>(stored, {});
      setDailyQuest(parsed.daily || null);
      setWeeklyQuest(parsed.weekly || null);
      setBonusQuest(parsed.bonus || null);
    }
    setIsLoaded(true);
  }, []);

  // Save quests to localStorage
  useEffect(() => {
    if (!isLoaded) return;
    const data = {
      daily: dailyQuest,
      weekly: weeklyQuest,
      bonus: bonusQuest,
    };
    localStorage.setItem(STORAGE_KEY, JSON.stringify(data));
    pushQuestsToCloud(data).catch(err => logger.error('Failed to push quests to cloud:', err));
  }, [dailyQuest, weeklyQuest, bonusQuest, isLoaded]);

  // Check and regenerate expired/completed quests
  useEffect(() => {
    if (!isLoaded) return;

    if (!dailyQuest || shouldRegenerateQuest(dailyQuest)) {
      setDailyQuest(generateDailyQuest());
    }

    if (!weeklyQuest || shouldRegenerateQuest(weeklyQuest)) {
      setWeeklyQuest(generateWeeklyQuest());
    }

    // 20% chance to generate bonus quest if none exists
    if (!bonusQuest && Math.random() < 0.2) {
      setBonusQuest(generateBonusQuest());
    } else if (bonusQuest && shouldRegenerateQuest(bonusQuest)) {
      setBonusQuest(null);
    }
  }, [isLoaded]);

  // P1 Fix: Debounce refs to prevent rapid refresh spam
  const refreshDebounceRef = useRef<{ daily: boolean; weekly: boolean; bonus: boolean }>({
    daily: false,
    weekly: false,
    bonus: false,
  });

  // Manual refresh with debounce protection
  const handleRefreshDaily = useCallback(() => {
    if (refreshDebounceRef.current.daily) return;
    refreshDebounceRef.current.daily = true;
    setDailyQuest(generateDailyQuest());
    setTimeout(() => { refreshDebounceRef.current.daily = false; }, 300);
  }, []);

  const handleRefreshWeekly = useCallback(() => {
    if (refreshDebounceRef.current.weekly) return;
    refreshDebounceRef.current.weekly = true;
    setWeeklyQuest(generateWeeklyQuest());
    setTimeout(() => { refreshDebounceRef.current.weekly = false; }, 300);
  }, []);

  const handleGenerateBonus = useCallback(() => {
    if (refreshDebounceRef.current.bonus) return;
    if (!bonusQuest || shouldRegenerateQuest(bonusQuest)) {
      refreshDebounceRef.current.bonus = true;
      setBonusQuest(generateBonusQuest());
      setTimeout(() => { refreshDebounceRef.current.bonus = false; }, 300);
    }
  }, [bonusQuest]);

  // Map quest type to translation key
  const getQuestTypeLabel = (type: 'daily' | 'weekly' | 'bonus') => {
    const labels = {
      daily: t.dailyQuest,
      weekly: t.weeklyQuest,
      bonus: t.bonusQuest,
    };
    return labels[type] || t.questType;
  };

  const renderQuestCard = (quest: Quest | null) => {
    if (!quest) {
      return (
        <div className="p-6 bg-muted/50 rounded-xl border-2 border-dashed border-border text-center">
          <p className="text-muted-foreground">{t.noQuestAvailable}</p>
        </div>
      );
    }

    const progressPercent = (quest.progress / quest.total) * 100;
    const isExpired = Date.now() > quest.expiresAt;

    return (
      <div
        className={cn(
          'p-6 rounded-xl border-2 transition-all',
          quest.completed
            ? 'bg-primary/10 border-primary/50 zen-shadow'
            : isExpired
            ? 'bg-muted/50 border-border opacity-60'
            : quest.type === 'bonus'
            ? 'zen-gradient-card border-yellow-500/50 zen-shadow-xl'
            : 'bg-card border-border hover:border-primary/30 zen-shadow-soft'
        )}
      >
        {/* Header */}
        <div className="flex items-start justify-between mb-3 gap-2">
          <div className="flex items-center gap-2 min-w-0 flex-1">
            <span className="text-2xl flex-shrink-0">{getQuestCategoryEmoji(quest.category)}</span>
            <div className="min-w-0">
              <h3 className={cn(
                'font-bold line-clamp-2',
                getQuestDifficultyColor(quest.type),
                quest.completed && 'line-through opacity-70'
              )}>
                {quest.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5">
                {getQuestTypeLabel(quest.type)}
              </p>
            </div>
          </div>
          {quest.completed && (
            <Trophy className="w-6 h-6 text-primary" />
          )}
        </div>

        {/* Description */}
        <p className="text-sm text-muted-foreground mb-4">
          {quest.description}
        </p>

        {/* Progress Bar */}
        <div className="mb-4">
          <div className="flex items-center justify-between text-xs mb-1">
            <span className="font-medium">
              {t.questProgress} {quest.progress}/{quest.total}
            </span>
            <span className={cn(
              'font-medium',
              isExpired ? 'text-destructive' : 'text-primary'
            )}>
              {isExpired ? t.questExpired : getQuestTimeRemaining(quest)}
            </span>
          </div>
          <div className="h-2 bg-secondary rounded-full overflow-hidden">
            <div
              className={cn(
                'h-full transition-all duration-500',
                quest.completed
                  ? 'bg-primary'
                  : quest.type === 'bonus'
                  ? 'zen-gradient'
                  : 'bg-primary'
              )}
              style={{ width: `${progressPercent}%` }}
            />
          </div>
        </div>

        {/* Reward */}
        <div className="flex items-center justify-between">
          <div className="flex items-center gap-3 text-sm">
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md font-medium">
              <Sparkles className="w-4 h-4" />
              +{quest.reward.xp} XP
            </span>
            {quest.reward.badge && (
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md font-medium">
                <Trophy className="w-4 h-4" />
                {quest.reward.badge}
              </span>
            )}
          </div>
        </div>

        {/* Completion Message */}
        {quest.completed && (
          <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
            <p className="text-sm font-medium text-primary">
              ✨ {quest.reward.message}
            </p>
          </div>
        )}
      </div>
    );
  };

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="quests-title" className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="quests-title" className="text-2xl font-bold zen-text-gradient">{t.randomQuests}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.questsPanelSubtitle}
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
              aria-label={t.close || 'Close'}
              className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
            >
              <X className="w-5 h-5" />
            </button>
          )}
        </div>

      {/* Info Banner */}
      <div className="p-4 zen-gradient rounded-xl zen-shadow">
        <div className="flex items-start gap-3 text-white">
          <Target className="w-5 h-5 flex-shrink-0 mt-0.5" />
          <div className="text-sm">
            <div className="font-medium mb-1">🎯 {t.adhdEngagementSystem}</div>
            <div className="text-white/90">
              {t.adhdEngagementDesc}
            </div>
          </div>
        </div>
      </div>

      {/* Daily Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">{t.dailyQuest}</h3>
          </div>
          <button
            onClick={handleRefreshDaily}
            className="text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            {t.newQuest}
          </button>
        </div>
        {renderQuestCard(dailyQuest)}
      </div>

      {/* Weekly Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold">{t.weeklyQuest}</h3>
          </div>
          <button
            onClick={handleRefreshWeekly}
            className="text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            {t.newQuest}
          </button>
        </div>
        {renderQuestCard(weeklyQuest)}
      </div>

      {/* Bonus Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">{t.bonusQuest}</h3>
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full">
              {t.limitedTime}
            </span>
          </div>
          {(!bonusQuest || shouldRegenerateQuest(bonusQuest)) && (
            <button
              onClick={handleGenerateBonus}
              className="text-sm px-3 py-1 zen-gradient text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              {t.generate}
            </button>
          )}
        </div>
        {bonusQuest ? (
          renderQuestCard(bonusQuest)
        ) : (
          <div className="p-8 bg-muted/50 rounded-xl border-2 border-dashed border-border text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-yellow-500/50" />
            <p className="text-muted-foreground mb-3">{t.noBonusQuestAvailable}</p>
            <p className="text-xs text-muted-foreground">
              {t.bonusQuestsHint}
            </p>
          </div>
        )}
      </div>

        {/* Tips */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-sm">
              <div className="font-medium mb-1">{t.questTips}</div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t.questTipDaily}</li>
                <li>{t.questTipWeekly}</li>
                <li>{t.questTipBonus}</li>
                <li>{t.questTipExpire}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
