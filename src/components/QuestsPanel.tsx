import { useState, useEffect } from 'react';
import { logger } from '@/lib/logger';
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
      try {
        const parsed = JSON.parse(stored);
        setDailyQuest(parsed.daily || null);
        setWeeklyQuest(parsed.weekly || null);
        setBonusQuest(parsed.bonus || null);
      } catch (error) {
        logger.error('Failed to parse quests:', error);
      }
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

  // Manual refresh
  const handleRefreshDaily = () => {
    setDailyQuest(generateDailyQuest());
  };

  const handleRefreshWeekly = () => {
    setWeeklyQuest(generateWeeklyQuest());
  };

  const handleGenerateBonus = () => {
    if (!bonusQuest || shouldRegenerateQuest(bonusQuest)) {
      setBonusQuest(generateBonusQuest());
    }
  };

  const renderQuestCard = (quest: Quest | null) => {
    if (!quest) {
      return (
        <div className="p-6 bg-muted/50 rounded-xl border-2 border-dashed border-border text-center">
          <p className="text-muted-foreground">No quest available</p>
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
        <div className="flex items-start justify-between mb-3">
          <div className="flex items-center gap-2">
            <span className="text-2xl">{getQuestCategoryEmoji(quest.category)}</span>
            <div>
              <h3 className={cn(
                'font-bold',
                getQuestDifficultyColor(quest.type),
                quest.completed && 'line-through opacity-70'
              )}>
                {quest.title}
              </h3>
              <p className="text-xs text-muted-foreground mt-0.5 capitalize">
                {quest.type} Quest
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
              Progress: {quest.progress}/{quest.total}
            </span>
            <span className={cn(
              'font-medium',
              isExpired ? 'text-destructive' : 'text-primary'
            )}>
              {isExpired ? 'Expired' : getQuestTimeRemaining(quest)}
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
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold zen-text-gradient">Random Quests</h2>
            <p className="text-sm text-muted-foreground mt-1">
              Complete quests for bonus XP and exclusive badges
            </p>
          </div>
          {onClose && (
            <button
              onClick={onClose}
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
            <div className="font-medium mb-1">🎯 ADHD Engagement System</div>
            <div className="text-white/90">
              Quests provide variety and unexpected rewards - perfect for ADHD brains that crave novelty!
            </div>
          </div>
        </div>
      </div>

      {/* Daily Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Clock className="w-5 h-5 text-blue-500" />
            <h3 className="text-lg font-semibold">Daily Quest</h3>
          </div>
          <button
            onClick={handleRefreshDaily}
            className="text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            New Quest
          </button>
        </div>
        {renderQuestCard(dailyQuest)}
      </div>

      {/* Weekly Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Zap className="w-5 h-5 text-purple-500" />
            <h3 className="text-lg font-semibold">Weekly Quest</h3>
          </div>
          <button
            onClick={handleRefreshWeekly}
            className="text-sm px-3 py-1 bg-primary/10 hover:bg-primary/20 text-primary rounded-lg transition-colors"
          >
            New Quest
          </button>
        </div>
        {renderQuestCard(weeklyQuest)}
      </div>

      {/* Bonus Quest */}
      <div>
        <div className="flex items-center justify-between mb-3">
          <div className="flex items-center gap-2">
            <Sparkles className="w-5 h-5 text-yellow-500" />
            <h3 className="text-lg font-semibold">Bonus Quest</h3>
            <span className="px-2 py-0.5 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 text-xs font-medium rounded-full">
              Limited Time
            </span>
          </div>
          {(!bonusQuest || shouldRegenerateQuest(bonusQuest)) && (
            <button
              onClick={handleGenerateBonus}
              className="text-sm px-3 py-1 zen-gradient text-white rounded-lg hover:opacity-90 transition-opacity"
            >
              Generate
            </button>
          )}
        </div>
        {bonusQuest ? (
          renderQuestCard(bonusQuest)
        ) : (
          <div className="p-8 bg-muted/50 rounded-xl border-2 border-dashed border-border text-center">
            <Sparkles className="w-12 h-12 mx-auto mb-3 text-yellow-500/50" />
            <p className="text-muted-foreground mb-3">No bonus quest available</p>
            <p className="text-xs text-muted-foreground">
              Bonus quests appear randomly or can be generated manually
            </p>
          </div>
        )}
      </div>

        {/* Tips */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-sm">
              <div className="font-medium mb-1">Quest Tips</div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Daily quests reset every 24 hours</li>
                <li>Weekly quests offer 3x XP rewards</li>
                <li>Bonus quests are rare with 5x XP</li>
                <li>Complete quests before they expire!</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
