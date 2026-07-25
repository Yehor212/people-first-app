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
    ? `\u{1F31F} ${tAny.bonusQuestPrefix || 'Extra:'} ${resolvedTitle}`
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
        'h-auto min-w-0 p-4 min-[420px]:p-6 rounded-xl border-2 motion-safe:transition-all',
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
      <div className="mb-3 flex min-w-0 items-start justify-between gap-2">
        <div className="flex min-w-0 flex-1 items-start gap-2">
          <span className="text-2xl flex-shrink-0">{getQuestCategoryEmoji(quest.category)}</span>
          <div className="min-w-0 flex-1">
            <h3 className={cn(
              'whitespace-normal break-words font-bold leading-snug',
              getQuestDifficultyColor(quest.type),
              quest.completed && 'line-through opacity-70'
            )}>
              {displayTitle}
            </h3>
            <p className="mt-0.5 whitespace-normal break-words text-xs text-muted-foreground">
              {getQuestTypeLabel(quest.type)}
            </p>
          </div>
        </div>
        {quest.completed && (
          <Trophy className="h-6 w-6 shrink-0 text-primary" />
        )}
      </div>

      {/* Description */}
      <p className="mb-4 whitespace-normal break-words text-sm leading-relaxed text-muted-foreground">
        {displayDesc}
      </p>

      {/* Progress Bar */}
      <div className="mb-4">
        <div className="mb-1 flex min-w-0 flex-col items-start gap-1 text-xs min-[420px]:flex-row min-[420px]:justify-between">
          <span className="min-w-0 whitespace-normal break-words font-medium">
            {t.questProgress} {quest.progress}/{quest.total}
          </span>
          <span className={cn(
            'min-w-0 whitespace-normal break-words font-medium min-[420px]:text-end',
            isExpired ? 'text-destructive' : 'text-primary'
          )}>
            {isExpired ? t.questExpired : getQuestTimeRemaining(quest)}
          </span>
        </div>
        <div className="h-2 bg-secondary rounded-full overflow-hidden">
          <div
            className={cn(
              'h-full motion-safe:transition-all motion-safe:duration-500',
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
      <div className="flex min-w-0 items-center justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-3 text-sm">
          <span className="inline-flex min-w-0 items-center gap-1 whitespace-normal break-words rounded-md bg-primary/10 px-2 py-1 font-medium text-primary">
            <Sparkles className="h-4 w-4 shrink-0" />
            +{quest.reward.xp} XP
          </span>
          {badgeName && (
            <span className="inline-flex min-w-0 items-center gap-1 whitespace-normal break-words rounded-md bg-yellow-500/10 px-2 py-1 font-medium text-yellow-700 dark:text-yellow-400">
              <Trophy className="h-4 w-4 shrink-0" />
              {badgeName}
            </span>
          )}
        </div>
      </div>

      {/* Completion Message */}
      {quest.completed && (
        <div className="mt-4 p-3 bg-primary/5 border border-primary/20 rounded-lg">
          <p className="whitespace-normal break-words text-sm font-medium leading-relaxed text-primary">
            {'\u2728'} {completionMessage}
          </p>
        </div>
      )}
    </div>
  );
});
