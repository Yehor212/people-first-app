import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { Sparkles, Clock, Zap, Target, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { useModalKeyboard } from '@/hooks/useModalKeyboard';
import {
  Quest,
  generateDailyQuest,
  generateWeeklyQuest,
  generateBonusQuest,
  shouldRegenerateQuest,
} from '@/lib/randomQuests';
import { pushQuestsToCloud } from '@/storage/tasksCloudSync';
import { QuestCard } from './QuestCard';

interface QuestsPanelProps {
  onClose?: () => void;
}

export function QuestsPanel({ onClose }: QuestsPanelProps) {
  const { t } = useLanguage();

  // Android back button: close panel
  useBackHandler(!!onClose, onClose ?? (() => {}));
  useScrollLock(!!onClose);

  // Escape key + focus trap
  const { modalRef, handleKeyDown: modalKeyDown } = useModalKeyboard({
    isOpen: true,
    onClose: onClose ?? (() => {}),
    closeOnEscape: true,
    trapFocus: true,
  });

  const [dailyQuest, setDailyQuest] = useState<Quest | null>(null);
  const [weeklyQuest, setWeeklyQuest] = useState<Quest | null>(null);
  const [bonusQuest, setBonusQuest] = useState<Quest | null>(null);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load quests from localStorage
  useEffect(() => {
    const parsed = safeLocalStorageGet<{ daily?: Quest | null; weekly?: Quest | null; bonus?: Quest | null }>(SK.QUESTS, null);
    if (parsed) {
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
    safeLocalStorageSet(SK.QUESTS, data);
    pushQuestsToCloud(data).catch(err => {
      logger.error('Failed to push quests to cloud:', err);
    });
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
  // eslint-disable-next-line react-hooks/exhaustive-deps -- mount-only: regenerate expired quests once on load
  }, [isLoaded]);

  // Debounce refs to prevent rapid refresh spam
  const refreshDebounceRef = useRef<{ daily: boolean; weekly: boolean; bonus: boolean }>({
    daily: false,
    weekly: false,
    bonus: false,
  });
  // Timer refs for cleanup (D4)
  const dailyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const weeklyTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const bonusTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Cleanup debounce timers on unmount (D4)
  useEffect(() => {
    return () => {
      if (dailyTimerRef.current) clearTimeout(dailyTimerRef.current);
      if (weeklyTimerRef.current) clearTimeout(weeklyTimerRef.current);
      if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
    };
  }, []);

  // Manual refresh with debounce protection
  const handleRefreshDaily = useCallback(() => {
    if (refreshDebounceRef.current.daily) return;
    refreshDebounceRef.current.daily = true;
    setDailyQuest(generateDailyQuest());
    if (dailyTimerRef.current) clearTimeout(dailyTimerRef.current);
    dailyTimerRef.current = setTimeout(() => { refreshDebounceRef.current.daily = false; }, 300);
  }, []);

  const handleRefreshWeekly = useCallback(() => {
    if (refreshDebounceRef.current.weekly) return;
    refreshDebounceRef.current.weekly = true;
    setWeeklyQuest(generateWeeklyQuest());
    if (weeklyTimerRef.current) clearTimeout(weeklyTimerRef.current);
    weeklyTimerRef.current = setTimeout(() => { refreshDebounceRef.current.weekly = false; }, 300);
  }, []);

  const handleGenerateBonus = useCallback(() => {
    if (refreshDebounceRef.current.bonus) return;
    if (!bonusQuest || shouldRegenerateQuest(bonusQuest)) {
      refreshDebounceRef.current.bonus = true;
      setBonusQuest(generateBonusQuest());
      if (bonusTimerRef.current) clearTimeout(bonusTimerRef.current);
      bonusTimerRef.current = setTimeout(() => { refreshDebounceRef.current.bonus = false; }, 300);
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

  // Cast t for QuestCard compatibility
  const tRecord = t as unknown as QuestCardTranslations;

  return (
    <div ref={modalRef} onKeyDown={modalKeyDown} role="dialog" aria-modal="true" aria-labelledby="quests-title" className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm overflow-y-auto">
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
            <div className="font-medium mb-1">{'\u{1F3AF}'} {t.adhdEngagementSystem}</div>
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
        <QuestCard quest={dailyQuest} t={tRecord} getQuestTypeLabel={getQuestTypeLabel} />
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
        <QuestCard quest={weeklyQuest} t={tRecord} getQuestTypeLabel={getQuestTypeLabel} />
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
          <QuestCard quest={bonusQuest} t={tRecord} getQuestTypeLabel={getQuestTypeLabel} />
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
            <div className="text-2xl">{'\u{1F4A1}'}</div>
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

// Type helper for QuestCard t prop
type QuestCardTranslations = Record<string, string> & {
  noQuestAvailable?: string;
  questProgress?: string;
  questExpired?: string;
  limitedTime?: string;
  weeklyQuestPrefix?: string;
  bonusQuestPrefix?: string;
  questCompletedSuffix?: string;
};
