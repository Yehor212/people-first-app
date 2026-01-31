import { useMemo, useState, memo } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry, MoodType, PrimaryEmotion } from '@/types';
import { calculateStreak, getDaysInMonth, getToday, cn } from '@/lib/utils';
import { getHabitCompletedDates, getHabitCompletionTotal, isHabitCompletedOnDate } from '@/lib/habits';
import { TrendingUp, Calendar, Zap, Heart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Share2, PlayCircle, Sparkles } from 'lucide-react';
import { SegmentedControl } from '@/components/ui/segmented-control';
import { SectionHeader } from '@/components/ui/section-header';
import { useLanguage } from '@/contexts/LanguageContext';
import { ShareProgress } from '@/components/ShareProgress';
import { AnimatedAchievementsSection } from '@/components/AnimatedAchievementCard';
import { AnimatedMoodDistribution, AnimatedEmotionDistribution, AnimatedCalendar } from '@/components/AnimatedStatsComponents';
import { TrendsView } from '@/components/TrendsView';
import { ActivityHeatMap, calculateActivityLevel } from '@/components/ui/activity-heatmap';
import { ProgressStoriesViewer } from '@/components/ProgressStoriesViewer';
import { generateWeeklyStory, hasEnoughDataForStory, getCurrentWeekRange } from '@/lib/progressStories';
import { WeeklyInsightsCard } from '@/components/WeeklyInsightsCard';
import { WeeklyCalendar } from '@/components/WeeklyCalendar';
import { hapticTap } from '@/lib/haptics';
import { AnimatedEmotionEmoji } from '@/components/AnimatedEmotionEmoji';
import { getEmotionScore, getEmotionLabels, EMOTION_ORDER, MOOD_TO_EMOTION_MAP } from '@/lib/emotionConstants';
import { getLocale } from '@/lib/timeUtils';
import { safeParseInt } from '@/lib/validation';

interface StatsPageProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  restDays?: string[];
  currentFocusMinutes?: number;
}

const moodEmojis: Record<string, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
};

export const StatsPage = memo(function StatsPage({ moods, habits, focusSessions, gratitudeEntries, restDays = [], currentFocusMinutes }: StatsPageProps) {
  const { t, language } = useLanguage();
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month');
  const todayKey = getToday();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
  const [showShareDialog, setShowShareDialog] = useState(false);
  const [showStoryViewer, setShowStoryViewer] = useState(false);
  const [selectedDate, setSelectedDate] = useState<string | null>(todayKey);
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const completedFocusSessions = useMemo(
    () => focusSessions.filter((session) => session.status !== 'aborted'),
    [focusSessions]
  );
  
  const monthNames = [
    t.january, t.february, t.march, t.april, t.may, t.june,
    t.july, t.august, t.september, t.october, t.november, t.december
  ];

  // Short month names for compact displays (heatmap)
  const shortMonthNames = monthNames.map(name => name?.slice(0, 3) || name);
  
  const moodLabels: Record<string, string> = {
    great: t.great,
    good: t.good,
    okay: t.okay,
    bad: t.bad,
    terrible: t.terrible,
  };

  // Score function that supports both legacy moods and new emotions
  const getMoodEntryScore = (entry: MoodEntry): number => {
    // Prefer emotion data if available
    if (entry.emotion?.primary) {
      return getEmotionScore(entry.emotion.primary, entry.emotion.intensity);
    }
    // Fallback to legacy mood
    switch (entry.mood) {
      case 'great': return 5;
      case 'good': return 4;
      case 'okay': return 3;
      case 'bad': return 2;
      case 'terrible': return 1;
      default: return 0;
    }
  };

  // Legacy moodScore for backward compat with components
  const moodScore = (mood: MoodEntry['mood']) => {
    switch (mood) {
      case 'great': return 5;
      case 'good': return 4;
      case 'okay': return 3;
      case 'bad': return 2;
      case 'terrible': return 1;
      default: return 0;
    }
  };

  // Get emotion labels for current language
  const emotionLabels = useMemo(() => getEmotionLabels(t.locale || 'en'), [t.locale]);

  const allTags = useMemo(() => {
    const set = new Set<string>();
    moods.forEach((entry) => (entry.tags || []).forEach((tag) => set.add(tag)));
    return Array.from(set).sort();
  }, [moods]);

  const filteredMoods = useMemo(() => {
    const now = new Date();
    const monthKey = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const weekStart = new Date(now);
    weekStart.setDate(now.getDate() - 6);
    weekStart.setHours(0, 0, 0, 0);

    let scoped = moods;
    if (range === 'month') {
      scoped = moods.filter((entry) => entry.date.startsWith(monthKey));
    } else if (range === 'week') {
      scoped = moods.filter((entry) => new Date(entry.date) >= weekStart);
    }

    if (selectedTag === 'all') return scoped;
    return scoped.filter((entry) => entry.tags?.includes(selectedTag));
  }, [moods, selectedTag, range]);

  const stats = useMemo(() => {
    const rangeDates = new Set(filteredMoods.map((entry) => entry.date));
    const totalFocusMinutes = completedFocusSessions
      .filter((session) => range === 'all' || rangeDates.has(session.date))
      .reduce((acc, s) => acc + s.duration, 0);

    // All-time focus minutes for achievements section (not filtered by range)
    // Include current running session minutes
    const completedMinutes = completedFocusSessions.reduce((acc, s) => acc + s.duration, 0);
    const allTimeFocusMinutes = completedMinutes + (currentFocusMinutes || 0);

    const totalHabitCompletions = habits.reduce((acc, habit) => {
      const count = getHabitCompletedDates(habit).filter((date) => range === 'all' || rangeDates.has(date)).length;
      return acc + count;
    }, 0);

    // Calculate streak from ALL activities (same as StreakBanner)
    const allActivityDates = [
      ...moods.map(m => m.date),
      ...habits.flatMap(h => getHabitCompletedDates(h)),
      ...completedFocusSessions.map(f => f.date),
      ...gratitudeEntries.map(g => g.date),
      ...restDays, // Rest days count towards streak!
    ];
    const uniqueDates = [...new Set(allActivityDates)].sort();
    const currentStreak = calculateStreak(uniqueDates);

    const moodCounts = filteredMoods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

    // v1.6.0: Count emotions with backward-compatible mapping of legacy moods
    // This ensures 8-emotion wheel shows for ALL data, not just new entries
    const emotionCounts = filteredMoods.reduce((acc, m) => {
      if (m.emotion?.primary) {
        // New format - use emotion directly
        acc[m.emotion.primary] = (acc[m.emotion.primary] || 0) + 1;
      } else if (m.mood) {
        // Legacy format - map mood to emotion
        const mappedEmotion = MOOD_TO_EMOTION_MAP[m.mood];
        if (mappedEmotion) {
          acc[mappedEmotion] = (acc[mappedEmotion] || 0) + 1;
        }
      }
      return acc;
    }, {} as Record<PrimaryEmotion, number>);

    const totalEmotionEntries = Object.values(emotionCounts).reduce((a, b) => a + b, 0);

    const now = new Date();
    const thisMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, '0')}`;
    const today = getToday();

    const thisMonthMoods = moods.filter(m => m.date.startsWith(thisMonth));
    const thisMonthFocus = completedFocusSessions.filter(s => s.date.startsWith(thisMonth));
    const thisMonthGratitude = gratitudeEntries.filter(g => g.date.startsWith(thisMonth));

    // Calculate current running minutes if available
    const thisMonthBaseFocusMinutes = thisMonthFocus.reduce((acc, s) => acc + s.duration, 0);
    const finalThisMonthFocusMinutes = currentFocusMinutes !== undefined && today.startsWith(thisMonth)
      ? currentFocusMinutes
      : thisMonthBaseFocusMinutes;

    return {
      totalFocusMinutes,
      allTimeFocusMinutes,
      totalHabitCompletions,
      currentStreak,
      moodCounts,
      emotionCounts,
      totalEmotionEntries,
      thisMonthMoods: thisMonthMoods.length,
      thisMonthFocusMinutes: finalThisMonthFocusMinutes,
      thisMonthGratitude: thisMonthGratitude.length,
      monthName: monthNames[now.getMonth()],
    };
  }, [moods, habits, completedFocusSessions, gratitudeEntries, monthNames, filteredMoods, range, currentFocusMinutes]);

  const moodInsights = useMemo(() => {
    if (filteredMoods.length === 0) {
      return {
        bestDay: null as null | { day: string; avg: number },
        focusAvg: null as null | { withFocus: number; withoutFocus: number },
        habitDiffs: [] as Array<{ id: string; name: string; diff: number }>
      };
    }

    const moodByDay: Record<number, { total: number; count: number }> = {};
    filteredMoods.forEach((entry) => {
      const day = new Date(entry.date).getDay();
      const score = getMoodEntryScore(entry);
      const current = moodByDay[day] || { total: 0, count: 0 };
      current.total += score;
      current.count += 1;
      moodByDay[day] = current;
    });

    const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];
    let bestDay: null | { day: string; avg: number } = null;
    Object.entries(moodByDay).forEach(([dayIndex, data]) => {
      if (!data.count) return;
      const avg = data.total / data.count;
      if (!bestDay || avg > bestDay.avg) {
        bestDay = { day: dayNames[safeParseInt(dayIndex, 0, 0, 6)] || '', avg };
      }
    });

    const moodByDate = new Map(filteredMoods.map((entry) => [entry.date, getMoodEntryScore(entry)]));
    const focusDates = new Set(completedFocusSessions.map((session) => session.date));
    let withFocusTotal = 0;
    let withFocusCount = 0;
    let withoutFocusTotal = 0;
    let withoutFocusCount = 0;
    moodByDate.forEach((score, date) => {
      if (focusDates.has(date)) {
        withFocusTotal += score;
        withFocusCount += 1;
      } else {
        withoutFocusTotal += score;
        withoutFocusCount += 1;
      }
    });

    const focusAvg = withFocusCount + withoutFocusCount > 0
      ? {
          withFocus: withFocusCount ? withFocusTotal / withFocusCount : 0,
          withoutFocus: withoutFocusCount ? withoutFocusTotal / withoutFocusCount : 0
        }
      : null;

    const habitDiffs = habits.map((habit) => {
      let completedTotal = 0;
      let completedCount = 0;
      let missedTotal = 0;
      let missedCount = 0;
      moodByDate.forEach((score, date) => {
        if (isHabitCompletedOnDate(habit, date)) {
          completedTotal += score;
          completedCount += 1;
        } else {
          missedTotal += score;
          missedCount += 1;
        }
      });

      const completedAvg = completedCount ? completedTotal / completedCount : 0;
      const missedAvg = missedCount ? missedTotal / missedCount : 0;
      return {
        id: habit.id,
        name: habit.name,
        diff: completedAvg - missedAvg
      };
    })
      .filter((item) => item.diff > 0)
      .sort((a, b) => b.diff - a.diff)
      .slice(0, 3);

    return { bestDay, focusAvg, habitDiffs };
  }, [filteredMoods, habits, completedFocusSessions, t]);

  // Store ALL mood entries per date (not just one)
  const moodsByDate = useMemo(() => {
    const map = new Map<string, MoodEntry[]>();
    moods.forEach((entry) => {
      const existing = map.get(entry.date) || [];
      existing.push(entry);
      map.set(entry.date, existing);
    });
    // Sort entries by timestamp within each day
    map.forEach((entries) => {
      entries.sort((a, b) => a.timestamp - b.timestamp);
    });
    return map;
  }, [moods]);

  // Legacy single mood per date (for calendar coloring - uses last mood of day)
  const moodByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    moods.forEach((entry) => {
      const existing = map.get(entry.date);
      if (!existing || entry.timestamp > existing.timestamp) {
        map.set(entry.date, entry);
      }
    });
    return map;
  }, [moods]);

  const focusMinutesByDate = useMemo(() => {
    const map = new Map<string, number>();
    completedFocusSessions.forEach((session) => {
      map.set(session.date, (map.get(session.date) || 0) + session.duration);
    });
    return map;
  }, [completedFocusSessions]);

  const gratitudeByDate = useMemo(() => {
    const map = new Map<string, GratitudeEntry[]>();
    gratitudeEntries.forEach((entry) => {
      const items = map.get(entry.date) || [];
      items.push(entry);
      map.set(entry.date, items);
    });
    return map;
  }, [gratitudeEntries]);

  const habitCompletionMap = useMemo(() => {
    const map = new Map<string, string[]>();
    habits.forEach((habit) => {
      getHabitCompletedDates(habit).forEach((date) => {
        const list = map.get(date) || [];
        list.push(habit.name);
        map.set(date, list);
      });
    });
    return map;
  }, [habits]);

  const availableYears = useMemo(() => {
    const set = new Set<number>();
    const currentYear = new Date().getFullYear();
    const addYear = (date: string) => {
      const year = safeParseInt(date.split('-')[0], currentYear, 2000, 2100);
      set.add(year);
    };
    [...moodByDate.keys()].forEach(addYear);
    [...focusMinutesByDate.keys()].forEach(addYear);
    [...gratitudeByDate.keys()].forEach(addYear);
    [...habitCompletionMap.keys()].forEach(addYear);
    set.add(currentYear);
    set.add(selectedYear);
    const years = Array.from(set).sort((a, b) => b - a);
    return years.length > 0 ? years : [currentYear];
  }, [moodByDate, focusMinutesByDate, gratitudeByDate, habitCompletionMap, selectedYear]);

  const yearStats = useMemo(() => {
    const prefix = `${selectedYear}-`;
    let moodCount = 0;
    let focusMinutes = 0;
    let habitCompletions = 0;
    let gratitudeCount = 0;

    moodByDate.forEach((_, date) => {
      if (date.startsWith(prefix)) moodCount += 1;
    });
    focusMinutesByDate.forEach((minutes, date) => {
      if (date.startsWith(prefix)) focusMinutes += minutes;
    });
    habitCompletionMap.forEach((list, date) => {
      if (date.startsWith(prefix)) habitCompletions += list.length;
    });
    gratitudeByDate.forEach((list, date) => {
      if (date.startsWith(prefix)) gratitudeCount += list.length;
    });

    return { moodCount, focusMinutes, habitCompletions, gratitudeCount };
  }, [selectedYear, moodByDate, focusMinutesByDate, habitCompletionMap, gratitudeByDate]);

  const calendarDays = useMemo(() => {
    const days = getDaysInMonth(selectedYear, selectedMonth);
    const firstDay = new Date(selectedYear, selectedMonth, 1).getDay();
    const monthKey = `${selectedYear}-${String(selectedMonth + 1).padStart(2, '0')}`;

    const cells: Array<{ dateKey?: string; day?: number }> = [];
    for (let i = 0; i < firstDay; i += 1) {
      cells.push({});
    }
    for (let day = 1; day <= days; day += 1) {
      const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
      cells.push({ dateKey, day });
    }
    return cells;
  }, [selectedYear, selectedMonth]);

  const selectedDayData = useMemo(() => {
    if (!selectedDate) return null;
    return {
      moods: moodsByDate.get(selectedDate) || [], // All moods for the day
      mood: moodByDate.get(selectedDate), // Last mood (for backward compat)
      focusMinutes: focusMinutesByDate.get(selectedDate) || 0,
      habits: habitCompletionMap.get(selectedDate) || [],
      gratitude: gratitudeByDate.get(selectedDate) || []
    };
  }, [selectedDate, moodsByDate, moodByDate, focusMinutesByDate, habitCompletionMap, gratitudeByDate]);

  // Helper to get time of day label from timestamp
  const getTimeOfDay = (timestamp: number | undefined): string => {
    if (!timestamp) return '';
    const hour = new Date(timestamp).getHours();
    if (hour < 12) return t.morning || 'Morning';
    if (hour < 18) return t.afternoon || 'Afternoon';
    return t.evening || 'Evening';
  };

  const getTimeOfDayEmoji = (timestamp: number | undefined): string => {
    if (!timestamp) return '📝';
    const hour = new Date(timestamp).getHours();
    if (hour < 12) return '🌅';
    if (hour < 18) return '☀️';
    return '🌙';
  };

  const heatmapDays = useMemo(() => {
    const now = new Date();
    const year = now.getFullYear();
    const month = now.getMonth();
    const daysInMonth = getDaysInMonth(year, month);
    const monthKey = `${year}-${String(month + 1).padStart(2, '0')}`;
    const moodByDate = new Map(filteredMoods.map((entry) => [entry.date, entry.mood]));

    return Array.from({ length: daysInMonth }, (_, index) => {
      const day = index + 1;
      const dateKey = `${monthKey}-${String(day).padStart(2, '0')}`;
      return {
        dateKey,
        day,
        mood: moodByDate.get(dateKey)
      };
    });
  }, [filteredMoods]);

  // Activity Heat Map data (GitHub-style contribution graph)
  const activityHeatmapData = useMemo(() => {
    const moodDates = new Set(moods.map(m => m.date));
    const focusDates = new Set(completedFocusSessions.map(f => f.date));
    const gratitudeDates = new Set(gratitudeEntries.map(g => g.date));

    // Get all unique dates from last 3 months
    const allDates = new Set<string>();
    const today = new Date();
    const threeMonthsAgo = new Date();
    threeMonthsAgo.setMonth(threeMonthsAgo.getMonth() - 3);

    // Add dates from all data sources
    [...moodDates, ...focusDates, ...gratitudeDates].forEach(date => {
      const d = new Date(date);
      if (d >= threeMonthsAgo && d <= today) {
        allDates.add(date);
      }
    });

    // Also ensure we cover all dates in range (even empty ones get checked)
    const current = new Date(threeMonthsAgo);
    while (current <= today) {
      allDates.add(current.toISOString().split('T')[0]);
      current.setDate(current.getDate() + 1);
    }

    return Array.from(allDates).map(date => {
      const habitsOnDate = habits.filter(h =>
        getHabitCompletedDates(h).includes(date)
      ).length;

      const level = calculateActivityLevel(date, {
        hasMood: moodDates.has(date),
        habitsCompleted: habitsOnDate,
        habitsTotal: habits.length,
        hasFocus: focusDates.has(date),
        hasGratitude: gratitudeDates.has(date),
      });

      return { date, level };
    }).sort((a, b) => a.date.localeCompare(b.date));
  }, [moods, habits, completedFocusSessions, gratitudeEntries]);

  const topHabit = habits.length > 0
    ? habits.reduce((a, b) => getHabitCompletionTotal(a) > getHabitCompletionTotal(b) ? a : b)
    : null;

  const handleMonthShift = (delta: number) => {
    setSelectedDate(null);
    setSelectedMonth((prev) => {
      const next = prev + delta;
      if (next < 0) {
        setSelectedYear((year) => year - 1);
        return 11;
      }
      if (next > 11) {
        setSelectedYear((year) => year + 1);
        return 0;
      }
      return next;
    });
  };

  // Generate weekly story data
  const canShowStory = useMemo(() => {
    return hasEnoughDataForStory(moods, habits, focusSessions);
  }, [moods, habits, focusSessions]);

  const storySlides = useMemo(() => {
    if (!canShowStory) return [];
    return generateWeeklyStory(moods, habits, focusSessions, gratitudeEntries, [], stats.currentStreak, t as Record<string, string>);
  }, [moods, habits, focusSessions, gratitudeEntries, stats.currentStreak, canShowStory, t]);

  const weekRange = useMemo(() => getCurrentWeekRange().range, []);

  return (
    <div className="space-y-4 animate-fade-in content-with-nav px-1">
      {/* Header with Weekly Story button */}
      <div className="flex items-center justify-between">
        <h2 className="text-xl sm:text-2xl font-bold text-foreground">{t.statistics}</h2>
        {canShowStory && (
          <button
            onClick={() => {
              hapticTap();
              setShowStoryViewer(true);
            }}
            aria-label={t.weeklyStory || 'Weekly Story'}
            className="flex items-center gap-2 px-3 py-2 bg-gradient-to-r from-violet-500 to-fuchsia-500 text-white text-sm font-medium rounded-xl hover:opacity-90 transition-all zen-shadow-soft"
          >
            <PlayCircle className="w-4 h-4" />
            {t.weeklyStory || 'Weekly Story'}
          </button>
        )}
      </div>

      {/* v1.4.0: Weekly Calendar - moved from My World tab */}
      <WeeklyCalendar moods={moods} habits={habits} />

      {/* Monthly Overview */}
      <div className="bg-card rounded-2xl p-4 sm:p-6 shadow-zen-md border">
        <SectionHeader
          icon={Calendar}
          title={stats.monthName}
          iconGradient="primary"
        />

        <SegmentedControl
          options={[
            { value: 'week', label: t.statsRangeWeek },
            { value: 'month', label: t.statsRangeMonth },
            { value: 'all', label: t.statsRangeAll },
          ]}
          value={range}
          onChange={setRange}
          aria-label={t.statsRange || 'Statistics range'}
          className="mb-4"
        />

        <div className="grid grid-cols-2 xs:grid-cols-3 gap-2 sm:gap-4">
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-primary">{stats.thisMonthMoods}</p>
            <p className="text-xs text-muted-foreground truncate">{t.moodEntries}</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl">
            <p className="text-xl sm:text-2xl font-bold text-accent">{stats.thisMonthFocusMinutes}</p>
            <p className="text-xs text-muted-foreground truncate">{t.focusMinutes}</p>
          </div>
          <div className="text-center p-3 sm:p-4 bg-secondary/60 rounded-xl col-span-2 xs:col-span-1">
            <p className="text-xl sm:text-2xl font-bold text-mood-good">{stats.thisMonthGratitude}</p>
            <p className="text-xs text-muted-foreground truncate">{t.gratitudes}</p>
          </div>
        </div>
      </div>

      {/* Achievements - Animated Cards */}
      <AnimatedAchievementsSection
        currentStreak={stats.currentStreak}
        totalFocusMinutes={stats.allTimeFocusMinutes}
        habitsCompleted={stats.totalHabitCompletions}
        streakLabel={t.currentStreak}
        streakSublabel={t.daysInRow}
        focusLabel={t.totalFocus}
        focusSublabel={t.allTime}
        habitsLabel={t.habitsCompleted}
        habitsSublabel={t.totalTimes}
        focusSuffix={t.min}
        title={t.achievements}
        onShare={() => setShowShareDialog(true)}
      />

      {/* Trends View - Long-term Analytics */}
      <div className="mb-8">
        <TrendsView
          moods={moods}
          habits={habits}
          focusSessions={focusSessions}
        />
      </div>

      {/* Activity Heat Map - GitHub-style contribution graph */}
      <ActivityHeatMap
        data={activityHeatmapData}
        months={3}
        labels={{
          title: t.activityHeatmap || 'Activity Overview',
          less: t.less || 'Less',
          more: t.more || 'More',
          monthNames: shortMonthNames,
        }}
      />

      {/* Weekly Insights - AI-powered recommendations */}
      <WeeklyInsightsCard
        moods={moods}
        habits={habits}
        focusSessions={completedFocusSessions}
        gratitudeEntries={gratitudeEntries}
        onRecommendationAction={(actionId) => {
          hapticTap();
          // Recommendations are actionable - clicking provides haptic feedback
          // Future: could navigate to relevant section based on actionId
          // e.g., 'low-focus' -> scroll to Focus Timer, 'more-gratitude' -> open Gratitude Journal
        }}
      />

      {/* Emotion Distribution - v1.6.0: Always show 8-emotion Plutchik wheel */}
      {/* Legacy moods are mapped to emotions for backward compatibility */}
      <AnimatedEmotionDistribution
        emotionCounts={stats.emotionCounts as Record<PrimaryEmotion, number>}
        totalEmotions={filteredMoods.length}
        title={t.moodDistribution}
        language={language}
        allTags={allTags}
        selectedTag={selectedTag}
        onTagChange={setSelectedTag}
        tagFilterLabel={t.moodTagFilter}
        allTagsLabel={t.allTags}
      />

      {/* Year Calendar - Redesigned */}
      <div className="bg-card rounded-2xl p-3 sm:p-6 zen-shadow-card overflow-hidden">
        {/* Header */}
        <div className="flex items-center gap-3 mb-5">
          <div className="relative">
            <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg shadow-violet-500/20">
              <Calendar className="w-5 h-5 text-white" />
            </div>
            <div className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
          </div>
          <h3 className="text-lg font-bold text-foreground">{t.calendarTitle}</h3>
        </div>

        {/* Year & Month Selector */}
        <div className="flex flex-wrap items-center gap-2 mb-5">
          <label className="text-sm text-muted-foreground">{t.calendarYear}</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(safeParseInt(e.target.value, new Date().getFullYear(), 2000, 2100))}
            className="p-2 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>{year}</option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleMonthShift(-1)}
              aria-label={t.calendarPrevMonth}
              className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMonthSelector(!showMonthSelector)}
              aria-expanded={showMonthSelector}
              aria-label={t.calendarSelectMonth || 'Select month'}
              className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 text-sm font-medium hover:from-primary/20 hover:to-accent/20 transition-all flex items-center gap-2"
            >
              {monthNames[selectedMonth]} {selectedYear}
              {showMonthSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleMonthShift(1)}
              aria-label={t.calendarNextMonth}
              className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {/* Month Selector Grid */}
        {showMonthSelector && (
          <div className="grid grid-cols-3 sm:grid-cols-4 gap-2 mb-5 animate-fade-in" role="listbox" aria-label={t.calendarSelectMonth || 'Select month'}>
            {monthNames.map((month, index) => (
              <button
                key={month}
                onClick={() => {
                  setSelectedMonth(index);
                  setSelectedDate(null);
                  setShowMonthSelector(false);
                }}
                aria-selected={selectedMonth === index}
                role="option"
                className={cn(
                  "px-2 py-2.5 rounded-xl text-xs font-medium transition-all",
                  selectedMonth === index
                    ? "bg-gradient-to-r from-primary to-accent text-white shadow-lg"
                    : "bg-secondary text-muted-foreground hover:bg-primary/10"
                )}
              >
                {month}
              </button>
            ))}
          </div>
        )}

        {/* Stats Grid */}
        <div className="grid grid-cols-2 sm:grid-cols-4 gap-2 sm:gap-3 mb-5">
          <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
            <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-pink-500 to-rose-500">{yearStats.moodCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.moodEntries}</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
            <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-violet-500 to-purple-500">{yearStats.focusMinutes}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.focusMinutes}</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
            <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-emerald-500 to-teal-500">{yearStats.habitCompletions}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.habitsCompleted}</p>
          </div>
          <div className="text-center p-2 sm:p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors">
            <p className="text-lg sm:text-xl font-bold bg-clip-text text-transparent bg-gradient-to-r from-amber-500 to-orange-500">{yearStats.gratitudeCount}</p>
            <p className="text-xs text-muted-foreground mt-1">{t.gratitudes}</p>
          </div>
        </div>

        {/* Day Names */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1 text-xs sm:text-xs text-muted-foreground mb-2">
          {[t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat].map((day) => (
            <div key={day} className="text-center font-medium py-1 sm:py-2">{day.slice(0, 2)}</div>
          ))}
        </div>

        {/* Calendar Days - Redesigned */}
        <div className="grid grid-cols-7 gap-0.5 sm:gap-1.5">
          {calendarDays.map((cell, index) => {
            if (!cell.dateKey) {
              return <div key={`empty-${index}`} className="w-full aspect-square" />;
            }
            const mood = moodByDate.get(cell.dateKey)?.mood;
            const hasData = moodByDate.has(cell.dateKey)
              || focusMinutesByDate.has(cell.dateKey)
              || habitCompletionMap.has(cell.dateKey)
              || gratitudeByDate.has(cell.dateKey);

            const moodGradient = mood === 'great' ? 'from-emerald-400/80 to-teal-500/80' :
                                 mood === 'good' ? 'from-green-400/80 to-emerald-500/80' :
                                 mood === 'okay' ? 'from-amber-400/80 to-yellow-500/80' :
                                 mood === 'bad' ? 'from-orange-400/80 to-amber-500/80' :
                                 mood === 'terrible' ? 'from-red-400/80 to-rose-500/80' : '';

            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDate(cell.dateKey || null)}
                aria-label={`${cell.day} ${monthNames[selectedMonth]} ${selectedYear}${mood ? `, ${t.mood}: ${t[mood] || mood}` : ''}`}
                aria-pressed={cell.dateKey === selectedDate}
                className={cn(
                  "relative w-full aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition-all duration-200",
                  "hover:scale-105 hover:shadow-lg",
                  mood
                    ? `bg-gradient-to-br ${moodGradient} text-white shadow-md`
                    : hasData
                      ? "bg-primary/20 text-foreground"
                      : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                  cell.dateKey === todayKey && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                  cell.dateKey === selectedDate && "ring-2 ring-accent ring-offset-1 ring-offset-card scale-110"
                )}
              >
                <span>{cell.day}</span>
                {gratitudeByDate.has(cell.dateKey) && (
                  <span className="absolute -top-0.5 -right-0.5 text-[8px]">✨</span>
                )}
              </button>
            );
          })}
        </div>

        {/* Selected Day Details - Redesigned */}
        <div className="mt-5 p-4 bg-gradient-to-br from-secondary/80 to-secondary rounded-xl">
          {selectedDate && selectedDayData ? (
            <div className="space-y-3 animate-fade-in">
              <div className="flex items-center justify-between">
                <p className="font-bold text-foreground">{selectedDate}</p>
                {selectedDayData.mood && (
                  selectedDayData.mood.emotion?.primary ? (
                    <AnimatedEmotionEmoji emotion={selectedDayData.mood.emotion.primary} size="md" />
                  ) : (
                    <span className="text-2xl">{moodEmojis[selectedDayData.mood.mood]}</span>
                  )
                )}
              </div>

              <div className="grid grid-cols-2 gap-3 text-sm">
                <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                  <span className="text-muted-foreground">{t.moodToday}</span>
                  <span className="font-medium">
                    {selectedDayData.mood
                      ? (selectedDayData.mood.emotion?.primary
                          ? emotionLabels[selectedDayData.mood.emotion.primary]
                          : moodLabels[selectedDayData.mood.mood])
                      : '—'}
                  </span>
                </div>
                <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                  <span className="text-muted-foreground">{t.focusMinutes}</span>
                  <span className="font-medium">{selectedDayData.focusMinutes}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                  <span className="text-muted-foreground">{t.habitsCompleted}</span>
                  <span className="font-medium">{selectedDayData.habits.length}</span>
                </div>
                <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                  <span className="text-muted-foreground">{t.gratitudes}</span>
                  <span className="font-medium">{selectedDayData.gratitude.length}</span>
                </div>
              </div>

              {/* All Mood Entries with Notes */}
              {selectedDayData.moods.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground">{t.moodNotes || 'Mood Notes'}</p>
                  {selectedDayData.moods.map((entry, idx) => (
                    <div
                      key={entry.id || `mood-${idx}`}
                      className="p-3 bg-card/50 rounded-lg border-l-4 border-primary/50"
                    >
                      <div className="flex items-center gap-2 mb-1">
                        {entry.emotion?.primary ? (
                          <AnimatedEmotionEmoji emotion={entry.emotion.primary} size="sm" />
                        ) : (
                          <span className="text-lg">{moodEmojis[entry.mood]}</span>
                        )}
                        <span className="text-sm font-medium">
                          {entry.emotion?.primary ? emotionLabels[entry.emotion.primary] : moodLabels[entry.mood]}
                        </span>
                        <span className="text-xs text-muted-foreground ml-auto flex items-center gap-1">
                          {getTimeOfDayEmoji(entry.timestamp)} {getTimeOfDay(entry.timestamp)}
                        </span>
                      </div>
                      {entry.note && (
                        <p className="text-sm text-foreground mt-2 pl-7 italic">
                          "{entry.note}"
                        </p>
                      )}
                      {entry.tags && entry.tags.length > 0 && (
                        <div className="flex flex-wrap gap-1 mt-2 pl-7">
                          {entry.tags.map((tag) => (
                            <span
                              key={tag}
                              className="px-2 py-0.5 bg-primary/10 text-primary text-xs rounded-full"
                            >
                              #{tag}
                            </span>
                          ))}
                        </div>
                      )}
                    </div>
                  ))}
                </div>
              )}

              {selectedDayData.habits.length > 0 && (
                <div className="text-xs text-muted-foreground bg-card/30 p-2 rounded-lg">
                  {selectedDayData.habits.join(', ')}
                </div>
              )}

              {selectedDayData.gratitude.length > 0 && (
                <div className="space-y-2">
                  <p className="text-xs font-medium text-muted-foreground flex items-center gap-1">
                    <Sparkles className="w-3 h-3 text-amber-500" />
                    {t.gratitude || 'Gratitude'}
                  </p>
                  {selectedDayData.gratitude.map((entry) => (
                    <div
                      key={entry.id}
                      className="p-3 bg-gradient-to-r from-amber-500/10 to-orange-500/5 rounded-lg border-l-4 border-amber-500/50"
                    >
                      <div className="flex items-start gap-2">
                        <span className="text-base flex-shrink-0">✨</span>
                        <div className="flex-1 min-w-0">
                          <p className="text-sm text-foreground">{entry.text}</p>
                          <p className="text-xs text-muted-foreground mt-1">
                            {new Date(entry.timestamp).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' })}
                          </p>
                        </div>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground text-center py-4">{t.calendarSelectDay}</p>
          )}
        </div>
      </div>

      {/* Mood Patterns */}
      <div className="bg-card rounded-2xl p-3 sm:p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient rounded-xl">
            <TrendingUp className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.moodPatternsTitle}</h3>
        </div>

        {filteredMoods.length === 0 ? (
          <p className="text-sm text-muted-foreground">{t.moodNoData}</p>
        ) : (
          <div className="space-y-3">
            <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
              <div>
                <p className="font-medium text-foreground">{t.moodBestDay}</p>
                <p className="text-sm text-muted-foreground">{moodInsights.bestDay?.day || t.moodNoData}</p>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {moodInsights.bestDay ? moodInsights.bestDay.avg.toFixed(1) : '--'}
              </div>
            </div>

            <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
              <div>
                <p className="font-medium text-foreground">{t.moodFocusComparison}</p>
                <p className="text-sm text-muted-foreground">{t.moodFocusWith}</p>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {moodInsights.focusAvg ? moodInsights.focusAvg.withFocus.toFixed(1) : '--'}
              </div>
            </div>
            <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
              <div>
                <p className="font-medium text-foreground">{t.moodFocusComparison}</p>
                <p className="text-sm text-muted-foreground">{t.moodFocusWithout}</p>
              </div>
              <div className="text-xl font-semibold text-foreground">
                {moodInsights.focusAvg ? moodInsights.focusAvg.withoutFocus.toFixed(1) : '--'}
              </div>
            </div>

            <div className="p-4 bg-secondary rounded-xl">
              <p className="font-medium text-foreground mb-2">{t.moodHabitCorrelations}</p>
              {moodInsights.habitDiffs.length === 0 ? (
                <p className="text-sm text-muted-foreground">{t.moodNoData}</p>
              ) : (
                <div className="space-y-2">
                  {moodInsights.habitDiffs.map((habit) => (
                    <div key={habit.id} className="flex items-center justify-between text-sm text-foreground">
                      <span>{habit.name}</span>
                      <span>+{habit.diff.toFixed(1)}</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Top Habit */}
      {topHabit && (
        <div className="bg-card rounded-2xl p-3 sm:p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 zen-gradient-warm rounded-xl">
              <TrendingUp className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.topHabit}</h3>
          </div>

          <div className="flex items-center gap-4 p-4 bg-secondary rounded-xl">
            <div className={`w-14 h-14 ${topHabit.color} rounded-xl flex items-center justify-center text-2xl`}>
              {topHabit.icon}
            </div>
            <div>
              <p className="font-semibold text-foreground">{topHabit.name}</p>
              <p className="text-sm text-muted-foreground">
                {t.completedTimes} {getHabitCompletionTotal(topHabit)} {t.completedTimes2}
              </p>
            </div>
          </div>
        </div>
      )}

      {/* Share Progress Dialog */}
      {showShareDialog && (
        <ShareProgress
          stats={{
            currentStreak: stats.currentStreak,
            habitsCompleted: habits.filter(h => h.completedDates.includes(todayKey)).length,
            totalHabits: habits.length,
            focusMinutes: stats.totalFocusMinutes,
            level: Math.floor(stats.currentStreak / 7) + 1,
          }}
          onClose={() => setShowShareDialog(false)}
        />
      )}

      {/* Weekly Progress Stories Viewer */}
      {showStoryViewer && storySlides.length > 0 && (
        <ProgressStoriesViewer
          slides={storySlides}
          onClose={() => setShowStoryViewer(false)}
          weekRange={weekRange}
          streak={stats.currentStreak}
        />
      )}
    </div>
  );
});
