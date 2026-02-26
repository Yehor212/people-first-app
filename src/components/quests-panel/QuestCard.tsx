/**
 * QuestCard — renders a single quest card
 * Extracted from QuestsPanel.tsx for TD-20 decomposition
 */

import { memo } from 'react';
import { Sparkles, Trophy, Star } from 'lucide-react';
import { EmptyState } from '@/components/EmptyState';
import { cn } from '@/lib/utils';
import {
  Quest,
  getQuestTimeRemaining,
  getQuestCategoryEmoji,
  getQuestDifficultyColor,
} from '@/lib/randomQuests';

interface QuestCardProps {
  quest: Quest | null;
  t: Record<string, string> & {
    noQuestAvailable?: string;
    questProgress?: string;
    questExpired?: string;
    limitedTime?: string;
    weeklyQuestPrefix?: string;
    bonusQuestPrefix?: string;
    questCompletedSuffix?: string;
  };
  getQuestTypeLabel: (type: 'daily' | 'weekly' | 'bonus') => string;
}

export const QuestCard = memo(function QuestCard({ quest, t, getQuestTypeLabel }: QuestCardProps) {
  if (!quest) {
    return (
      <EmptyState
        icon={<Star className="w-5 h-5 text-primary" />}
        title={t.noQuestAvailable || 'No quest available'}
        size="compact"
      />
    );
  }

  // Resolve title/description from translation key (new quests) or use stored string (old quests)
  const tAny = t as unknown as Record<string, string>;
  const resolvedTitle = quest.titleKey && tAny[quest.titleKey]
    ? tAny[quest.titleKey]
    : quest.title;
  const resolvedDesc = quest.descriptionKey && tAny[quest.descriptionKey]
    ? tAny[quest.descriptionKey]
    : quest.description;

  // Add localized prefix for weekly/bonus quests
  const displayTitle = quest.type === 'weekly'
    ? `${tAny.weeklyQuestPrefix || 'Weekly:'} ${resolvedTitle}`
    : quest.type === 'bonus'
    ? `\u{1F31F} ${tAny.bonusQuestPrefix || 'BONUS:'} ${resolvedTitle}`
    : resolvedTitle;

  const displayDesc = quest.type === 'bonus'
    ? `${resolvedDesc} (${t.limitedTime})`
    : resolvedDesc;

  // Resolve badge name from translation key or use as-is
  const badgeName = quest.reward.badge && tAny[quest.reward.badge]
    ? tAny[quest.reward.badge]
    : quest.reward.badge;

  // Build completion message from translation if possible
  const completionMessage = quest.titleKey
    ? `${resolvedTitle} ${tAny.questCompletedSuffix || 'completed!'} +${quest.reward.xp} XP`
    : quest.reward.message;

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
              {displayTitle}
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
        {displayDesc}
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
          {badgeName && (
            <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md font-medium">
              <Trophy className="w-4 h-4" />
              {badgeName}
            </span>
          )}
        </div>
      </div>

      {/* Completion Message */}
      {quest.completed && (
        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="text-sm font-medium text-primary">
            {'\u2728'} {completionMessage}
          </p>
        </div>
      )}
    </div>
  );
});
