/**
 * Types and translation bridge for UnifiedShareModal
 * Extracted from UnifiedShareModal.tsx for TD-20 decomposition
 */

import type { Badge } from '@/types';
import type {
  ShareCardData,
  WeeklyProgressData,
  TrophyShareData,
  ShareCardTranslations,
} from '@/lib/shareCards';
import { DEFAULT_CARD_TRANSLATIONS } from '@/lib/shareCards';

// ============================================
// TYPES
// ============================================

interface BaseProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  username?: string;
}

interface AchievementProps extends BaseProps {
  mode: 'achievement';
  badge: Badge;
}

interface StreakProps extends BaseProps {
  mode: 'streak';
  streak: number;
  habitName?: string;
}

interface ProgressProps extends BaseProps {
  mode: 'progress';
  data: ShareCardData;
}

interface WeeklyProps extends BaseProps {
  mode: 'weekly';
  data: WeeklyProgressData;
}

interface TrophyProps extends BaseProps {
  mode: 'trophy';
  data: TrophyShareData;
}

export type UnifiedShareModalProps =
  | AchievementProps
  | StreakProps
  | ProgressProps
  | WeeklyProps
  | TrophyProps;

// ============================================
// TRANSLATION BRIDGE
// ============================================

export function buildCardTranslations(t: Record<string, string>): ShareCardTranslations {
  return {
    dayStreak: t.shareCardDayStreak || DEFAULT_CARD_TRANSLATIONS.dayStreak,
    weeklyReview: t.shareCardWeeklyReview || DEFAULT_CARD_TRANSLATIONS.weeklyReview,
    mood: t.shareCardMood || DEFAULT_CARD_TRANSLATIONS.mood,
    habits: t.shareCardHabits || DEFAULT_CARD_TRANSLATIONS.habits,
    focus: t.shareCardFocus || DEFAULT_CARD_TRANSLATIONS.focus,
    streak: t.shareCardStreak || DEFAULT_CARD_TRANSLATIONS.streak,
    days: t.shareCardDays || DEFAULT_CARD_TRANSLATIONS.days,
    newAchievements: t.shareCardNewAchievements || DEFAULT_CARD_TRANSLATIONS.newAchievements,
    trackHabits: t.shareCardTrackHabits || DEFAULT_CARD_TRANSLATIONS.trackHabits,
    moodGreat: t.shareCardMoodGreat || DEFAULT_CARD_TRANSLATIONS.moodGreat,
    moodGood: t.shareCardMoodGood || DEFAULT_CARD_TRANSLATIONS.moodGood,
    moodOkay: t.shareCardMoodOkay || DEFAULT_CARD_TRANSLATIONS.moodOkay,
    moodLow: t.shareCardMoodLow || DEFAULT_CARD_TRANSLATIONS.moodLow,
    moodTough: t.shareCardMoodTough || DEFAULT_CARD_TRANSLATIONS.moodTough,
  };
}
