import { useState, useEffect, useMemo } from 'react';
import { MoodType, MoodEntry, PrimaryEmotion } from '@/types';
import { cn } from '@/lib/utils';
import { Heart, Calendar, ChevronLeft, ChevronRight, ChevronDown, ChevronUp, Sparkles } from 'lucide-react';
import { AnimatedMoodEmoji } from './AnimatedMoodEmoji';
import { AnimatedEmotionEmoji } from './AnimatedEmotionEmoji';
import { EMOTION_GRADIENTS, EMOTION_ORDER, getEmotionLabels } from '@/lib/emotionConstants';
import { safeParseInt } from '@/lib/validation';
import { useLanguage } from '@/contexts/LanguageContext';

// ============================================
// ANIMATED MOOD DISTRIBUTION
// ============================================

interface MoodDistributionProps {
  moodCounts: Record<MoodType, number>;
  totalMoods: number;
  title: string;
  allTags?: string[];
  selectedTag?: string;
  onTagChange?: (tag: string) => void;
  tagFilterLabel?: string;
  allTagsLabel?: string;
}

const moodConfig: Record<MoodType, { gradient: string; bgLight: string; emoji: string }> = {
  great: { gradient: 'from-emerald-400 to-teal-500', bgLight: 'bg-emerald-500/20', emoji: '😄' },
  good: { gradient: 'from-green-400 to-emerald-500', bgLight: 'bg-green-500/20', emoji: '🙂' },
  okay: { gradient: 'from-amber-400 to-yellow-500', bgLight: 'bg-amber-500/20', emoji: '😐' },
  bad: { gradient: 'from-orange-400 to-amber-500', bgLight: 'bg-orange-500/20', emoji: '😔' },
  terrible: { gradient: 'from-red-400 to-rose-500', bgLight: 'bg-red-500/20', emoji: '😢' },
};

export function AnimatedMoodDistribution({
  moodCounts,
  totalMoods,
  title,
  allTags,
  selectedTag,
  onTagChange,
  tagFilterLabel,
  allTagsLabel,
}: MoodDistributionProps) {
  const { t } = useLanguage();
  const [animatedCounts, setAnimatedCounts] = useState<Record<MoodType, number>>({
    great: 0, good: 0, okay: 0, bad: 0, terrible: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setAnimatedCounts(moodCounts);
    }, 300);
    return () => clearTimeout(timer);
  }, [moodCounts]);

  const moods: MoodType[] = ['great', 'good', 'okay', 'bad', 'terrible'];

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {totalMoods > 0 && (
          <div className="px-3 py-1 bg-secondary rounded-full">
            <span className="text-sm font-medium text-muted-foreground">{totalMoods}</span>
          </div>
        )}
      </div>

      {/* Tag Filter */}
      {allTags && allTags.length > 0 && onTagChange && (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">{tagFilterLabel}</label>
          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">{allTagsLabel}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      )}

      {/* Mood Bars */}
      <div className="space-y-4">
        {moods.map((mood, index) => {
          const count = animatedCounts[mood] || 0;
          const percentage = totalMoods > 0 ? (count / totalMoods) * 100 : 0;
          const config = moodConfig[mood];

          return (
            <div
              key={mood}
              className="group animate-fade-in"
              style={{ animationDelay: `${index * 100}ms` }}
            >
              <div className="flex items-center gap-4">
                {/* Animated Emoji */}
                <div className={cn(
                  "w-12 h-12 rounded-xl flex items-center justify-center transition-all duration-300",
                  config.bgLight,
                  "group-hover:scale-110 group-hover:shadow-lg"
                )}>
                  <AnimatedMoodEmoji mood={mood} size="md" />
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1">
                  <div className="h-4 bg-secondary/80 rounded-full overflow-hidden relative">
                    {/* Animated Fill */}
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out relative",
                        `bg-gradient-to-r ${config.gradient}`
                      )}
                      style={{
                        width: `${percentage}%`,
                        transitionDelay: `${index * 150}ms`
                      }}
                    >
                      {/* Shimmer Effect */}
                      {percentage > 0 && (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute inset-0 animate-shimmer-slide">
                            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percentage Label on Bar */}
                    {percentage > 15 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-xs font-bold text-white/90">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Count */}
                <div className={cn(
                  "min-w-[3rem] text-right transition-all duration-300",
                  "group-hover:scale-110"
                )}>
                  <span className={cn(
                    "text-lg font-bold bg-clip-text text-transparent",
                    `bg-gradient-to-r ${config.gradient}`
                  )}>
                    {count}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {totalMoods === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.noMoodDataYet || 'No mood data yet'}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// ANIMATED EMOTION DISTRIBUTION (8 Plutchik emotions)
// ============================================

interface EmotionDistributionProps {
  emotionCounts: Record<PrimaryEmotion, number>;
  totalEmotions: number;
  title: string;
  language: string;
  allTags?: string[];
  selectedTag?: string;
  onTagChange?: (tag: string) => void;
  tagFilterLabel?: string;
  allTagsLabel?: string;
}

const emotionConfig: Record<PrimaryEmotion, { gradient: string; bgLight: string }> = {
  joy:          { gradient: 'from-yellow-400 to-amber-500', bgLight: 'bg-yellow-500/20' },
  trust:        { gradient: 'from-green-400 to-emerald-500', bgLight: 'bg-green-500/20' },
  fear:         { gradient: 'from-teal-400 to-cyan-500', bgLight: 'bg-teal-500/20' },
  surprise:     { gradient: 'from-blue-400 to-sky-500', bgLight: 'bg-blue-500/20' },
  sadness:      { gradient: 'from-indigo-400 to-blue-500', bgLight: 'bg-indigo-500/20' },
  disgust:      { gradient: 'from-purple-400 to-violet-500', bgLight: 'bg-purple-500/20' },
  anger:        { gradient: 'from-red-400 to-rose-500', bgLight: 'bg-red-500/20' },
  anticipation: { gradient: 'from-orange-400 to-amber-500', bgLight: 'bg-orange-500/20' },
};

export function AnimatedEmotionDistribution({
  emotionCounts,
  totalEmotions,
  title,
  language,
  allTags,
  selectedTag,
  onTagChange,
  tagFilterLabel,
  allTagsLabel,
}: EmotionDistributionProps) {
  const { t } = useLanguage();
  const [animatedCounts, setAnimatedCounts] = useState<Record<PrimaryEmotion, number>>({
    joy: 0, trust: 0, fear: 0, surprise: 0, sadness: 0, disgust: 0, anger: 0, anticipation: 0
  });
  const [isVisible, setIsVisible] = useState(false);

  const emotionLabels = useMemo(() => getEmotionLabels(language), [language]);

  useEffect(() => {
    setIsVisible(true);
    const timer = setTimeout(() => {
      setAnimatedCounts(emotionCounts);
    }, 300);
    return () => clearTimeout(timer);
  }, [emotionCounts]);

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-pink-500 to-rose-500 rounded-xl shadow-lg shadow-pink-500/20">
            <Heart className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-pink-400 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground flex-1">{title}</h3>
        {totalEmotions > 0 && (
          <div className="px-3 py-1 bg-secondary rounded-full">
            <span className="text-sm font-medium text-muted-foreground">{totalEmotions}</span>
          </div>
        )}
      </div>

      {/* Tag Filter */}
      {allTags && allTags.length > 0 && onTagChange && (
        <div className="mb-5">
          <label className="text-sm text-muted-foreground mb-2 block">{tagFilterLabel}</label>
          <select
            value={selectedTag}
            onChange={(e) => onTagChange(e.target.value)}
            className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
          >
            <option value="all">{allTagsLabel}</option>
            {allTags.map((tag) => (
              <option key={tag} value={tag}>{tag}</option>
            ))}
          </select>
        </div>
      )}

      {/* Emotion Bars - 8 emotions */}
      <div className="space-y-3">
        {EMOTION_ORDER.map((emotion, index) => {
          const count = animatedCounts[emotion] || 0;
          const percentage = totalEmotions > 0 ? (count / totalEmotions) * 100 : 0;
          const config = emotionConfig[emotion];

          return (
            <div
              key={emotion}
              className="group animate-fade-in"
              style={{ animationDelay: `${index * 80}ms` }}
            >
              <div className="flex items-center gap-3">
                {/* Animated Emotion Emoji */}
                <div className={cn(
                  "w-10 h-10 rounded-xl flex items-center justify-center transition-all duration-300",
                  config.bgLight,
                  "group-hover:scale-110 group-hover:shadow-lg"
                )}>
                  <AnimatedEmotionEmoji emotion={emotion} size="sm" />
                </div>

                {/* Progress Bar Container */}
                <div className="flex-1">
                  <div className="h-3.5 bg-secondary/80 rounded-full overflow-hidden relative">
                    {/* Animated Fill */}
                    <div
                      className={cn(
                        "h-full rounded-full transition-all duration-1000 ease-out relative",
                        `bg-gradient-to-r ${config.gradient}`
                      )}
                      style={{
                        width: `${percentage}%`,
                        transitionDelay: `${index * 100}ms`
                      }}
                    >
                      {/* Shimmer Effect */}
                      {percentage > 0 && (
                        <div className="absolute inset-0 overflow-hidden">
                          <div className="absolute inset-0 animate-shimmer-slide">
                            <div className="h-full w-1/3 bg-gradient-to-r from-transparent via-white/30 to-transparent" />
                          </div>
                        </div>
                      )}
                    </div>

                    {/* Percentage Label on Bar */}
                    {percentage > 20 && (
                      <span className="absolute right-2 top-1/2 -translate-y-1/2 text-[10px] font-bold text-white/90">
                        {Math.round(percentage)}%
                      </span>
                    )}
                  </div>
                </div>

                {/* Count */}
                <div className={cn(
                  "min-w-[2.5rem] text-right transition-all duration-300",
                  "group-hover:scale-110"
                )}>
                  <span className={cn(
                    "text-base font-bold bg-clip-text text-transparent",
                    `bg-gradient-to-r ${config.gradient}`
                  )}>
                    {count}
                  </span>
                </div>
              </div>
            </div>
          );
        })}
      </div>

      {/* Empty State */}
      {totalEmotions === 0 && (
        <div className="text-center py-8 text-muted-foreground">
          <Sparkles className="w-8 h-8 mx-auto mb-2 opacity-50" />
          <p className="text-sm">{t.noEmotionDataYet || 'No emotion data yet'}</p>
        </div>
      )}
    </div>
  );
}

// ============================================
// ANIMATED CALENDAR
// ============================================

interface CalendarDay {
  day: number | null;
  dateKey: string | null;
}

interface DayData {
  mood?: MoodEntry;
  focusMinutes: number;
  habits: string[];
  gratitude: { id: string; text: string }[];
}

interface AnimatedCalendarProps {
  title: string;
  yearLabel: string;
  selectedYear: number;
  availableYears: number[];
  onYearChange: (year: number) => void;
  selectedMonth: number;
  onMonthChange: (month: number) => void;
  monthNames: string[];
  dayNames: string[];
  calendarDays: CalendarDay[];
  todayKey: string;
  selectedDate: string | null;
  onDateSelect: (date: string | null) => void;
  getMoodForDate: (dateKey: string) => MoodEntry | undefined;
  hasDataForDate: (dateKey: string) => boolean;
  getDayData: (dateKey: string) => DayData | null;
  // Stats
  moodCount: number;
  focusMinutes: number;
  habitCompletions: number;
  gratitudeCount: number;
  // Labels
  moodEntriesLabel: string;
  focusMinutesLabel: string;
  habitsCompletedLabel: string;
  gratitudesLabel: string;
  selectDayLabel: string;
  moodTodayLabel: string;
  noDataLabel: string;
  prevMonthLabel: string;
  nextMonthLabel: string;
}

const moodGradients: Record<MoodType, string> = {
  great: 'from-emerald-400/80 to-teal-500/80',
  good: 'from-green-400/80 to-emerald-500/80',
  okay: 'from-amber-400/80 to-yellow-500/80',
  bad: 'from-orange-400/80 to-amber-500/80',
  terrible: 'from-red-400/80 to-rose-500/80',
};

// Helper to get gradient for mood entry (supports both emotions and legacy moods)
const getEntryGradient = (entry: MoodEntry): string => {
  if (entry.emotion?.primary) {
    return EMOTION_GRADIENTS[entry.emotion.primary];
  }
  return moodGradients[entry.mood] || 'from-gray-400/80 to-gray-500/80';
};

export function AnimatedCalendar({
  title,
  yearLabel,
  selectedYear,
  availableYears,
  onYearChange,
  selectedMonth,
  onMonthChange,
  monthNames,
  dayNames,
  calendarDays,
  todayKey,
  selectedDate,
  onDateSelect,
  getMoodForDate,
  hasDataForDate,
  getDayData,
  moodCount,
  focusMinutes,
  habitCompletions,
  gratitudeCount,
  moodEntriesLabel,
  focusMinutesLabel,
  habitsCompletedLabel,
  gratitudesLabel,
  selectDayLabel,
  moodTodayLabel,
  noDataLabel,
  prevMonthLabel,
  nextMonthLabel,
}: AnimatedCalendarProps) {
  const [showMonthSelector, setShowMonthSelector] = useState(false);
  const [isVisible, setIsVisible] = useState(false);

  useEffect(() => {
    setIsVisible(true);
  }, []);

  const handleMonthShift = (delta: number) => {
    let newMonth = selectedMonth + delta;
    if (newMonth < 0) {
      newMonth = 11;
      if (availableYears.includes(selectedYear - 1)) {
        onYearChange(selectedYear - 1);
      }
    } else if (newMonth > 11) {
      newMonth = 0;
      if (availableYears.includes(selectedYear + 1)) {
        onYearChange(selectedYear + 1);
      }
    }
    onMonthChange(newMonth);
  };

  const selectedDayData = selectedDate ? getDayData(selectedDate) : null;

  const stats = [
    { value: moodCount, label: moodEntriesLabel, gradient: 'from-pink-500 to-rose-500' },
    { value: focusMinutes, label: focusMinutesLabel, gradient: 'from-violet-500 to-purple-500' },
    { value: habitCompletions, label: habitsCompletedLabel, gradient: 'from-emerald-500 to-teal-500' },
    { value: gratitudeCount, label: gratitudesLabel, gradient: 'from-amber-500 to-orange-500' },
  ];

  return (
    <div className={cn(
      "bg-card rounded-2xl p-6 zen-shadow-card overflow-hidden transition-all duration-500",
      isVisible ? "opacity-100 translate-y-0" : "opacity-0 translate-y-4"
    )}>
      {/* Header */}
      <div className="flex items-center gap-3 mb-5">
        <div className="relative">
          <div className="p-2.5 bg-gradient-to-br from-violet-500 to-purple-500 rounded-xl shadow-lg shadow-violet-500/20">
            <Calendar className="w-5 h-5 text-white" />
          </div>
          <div className="absolute -top-1 -right-1 w-2 h-2 bg-violet-400 rounded-full animate-pulse" />
        </div>
        <h3 className="text-lg font-bold text-foreground">{title}</h3>
      </div>

      {/* Year & Month Selector */}
      <div className="flex flex-wrap items-center gap-2 mb-5">
        <label className="text-sm text-muted-foreground">{yearLabel}</label>
        <select
          value={selectedYear}
          onChange={(e) => onYearChange(safeParseInt(e.target.value, new Date().getFullYear(), 2020, 2100))}
          className="p-2 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
        >
          {availableYears.map((year) => (
            <option key={year} value={year}>{year}</option>
          ))}
        </select>

        <div className="ml-auto flex items-center gap-2">
          <button
            onClick={() => handleMonthShift(-1)}
            aria-label={prevMonthLabel}
            className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors"
          >
            <ChevronLeft className="w-4 h-4" />
          </button>
          <button
            onClick={() => setShowMonthSelector(!showMonthSelector)}
            className="px-4 py-2 rounded-xl bg-gradient-to-r from-primary/10 to-accent/10 text-sm font-medium hover:from-primary/20 hover:to-accent/20 transition-all flex items-center gap-2"
          >
            {monthNames[selectedMonth]} {selectedYear}
            {showMonthSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
          </button>
          <button
            onClick={() => handleMonthShift(1)}
            aria-label={nextMonthLabel}
            className="p-2 rounded-xl bg-secondary hover:bg-primary/10 transition-colors"
          >
            <ChevronRight className="w-4 h-4" />
          </button>
        </div>
      </div>

      {/* Month Selector Grid */}
      {showMonthSelector && (
        <div className="grid grid-cols-4 gap-2 mb-5 animate-fade-in">
          {monthNames.map((month, index) => (
            <button
              key={month}
              onClick={() => {
                onMonthChange(index);
                onDateSelect(null);
                setShowMonthSelector(false);
              }}
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
      <div className="grid grid-cols-4 gap-3 mb-5">
        {stats.map((stat, index) => (
          <div
            key={stat.label}
            className="text-center p-3 bg-secondary/50 rounded-xl hover:bg-secondary transition-colors animate-fade-in"
            style={{ animationDelay: `${index * 100}ms` }}
          >
            <p className={cn(
              "text-xl font-bold bg-clip-text text-transparent",
              `bg-gradient-to-r ${stat.gradient}`
            )}>
              {stat.value}
            </p>
            <p className="text-xs text-muted-foreground mt-1 line-clamp-1">{stat.label}</p>
          </div>
        ))}
      </div>

      {/* Day Names */}
      <div className="grid grid-cols-7 gap-1 text-xs text-muted-foreground mb-2">
        {dayNames.map((day) => (
          <div key={day} className="text-center font-medium py-2">
            {day.slice(0, 2)}
          </div>
        ))}
      </div>

      {/* Calendar Days */}
      <div className="grid grid-cols-7 gap-1.5">
        {calendarDays.map((cell, index) => {
          if (!cell.dateKey) {
            return <div key={`empty-${index}`} className="w-full aspect-square" />;
          }

          const moodEntry = getMoodForDate(cell.dateKey);
          const hasEmotion = !!moodEntry?.emotion?.primary;
          const hasLegacyMood = !!moodEntry?.mood;
          const hasData = hasDataForDate(cell.dateKey);
          const isToday = cell.dateKey === todayKey;
          const isSelected = cell.dateKey === selectedDate;

          const gradient = moodEntry ? getEntryGradient(moodEntry) : '';

          return (
            <button
              key={cell.dateKey}
              onClick={() => onDateSelect(cell.dateKey)}
              className={cn(
                "w-full aspect-square rounded-xl text-xs font-semibold flex items-center justify-center transition-all duration-200",
                "hover:scale-105 hover:shadow-lg",
                (hasEmotion || hasLegacyMood)
                  ? `bg-gradient-to-br ${gradient} text-white shadow-md`
                  : hasData
                    ? "bg-primary/20 text-foreground"
                    : "bg-secondary/50 text-muted-foreground hover:bg-secondary",
                isToday && "ring-2 ring-primary ring-offset-2 ring-offset-card",
                isSelected && "ring-2 ring-accent ring-offset-1 ring-offset-card scale-110"
              )}
            >
              {hasEmotion ? (
                <AnimatedEmotionEmoji emotion={moodEntry!.emotion!.primary} size="sm" />
              ) : hasLegacyMood ? (
                <AnimatedMoodEmoji mood={moodEntry!.mood} size="sm" />
              ) : (
                cell.day
              )}
            </button>
          );
        })}
      </div>

      {/* Selected Day Details */}
      <div className="mt-5 p-4 bg-gradient-to-br from-secondary/80 to-secondary rounded-xl">
        {selectedDate && selectedDayData ? (
          <div className="space-y-3 animate-fade-in">
            <div className="flex items-center justify-between">
              <p className="font-bold text-foreground">{selectedDate}</p>
              {selectedDayData.mood && (
                <div className="flex items-center gap-2">
                  {selectedDayData.mood.emotion?.primary ? (
                    <AnimatedEmotionEmoji emotion={selectedDayData.mood.emotion.primary} size="md" />
                  ) : (
                    <AnimatedMoodEmoji mood={selectedDayData.mood.mood} size="sm" />
                  )}
                </div>
              )}
            </div>

            <div className="grid grid-cols-2 gap-3 text-sm">
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{moodTodayLabel}</span>
                <span className="font-medium">
                  {selectedDayData.mood
                    ? (selectedDayData.mood.emotion?.primary
                        ? getEmotionLabels('en')[selectedDayData.mood.emotion.primary]
                        : moodConfig[selectedDayData.mood.mood].emoji)
                    : '—'}
                </span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{focusMinutesLabel}</span>
                <span className="font-medium">{selectedDayData.focusMinutes}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{habitsCompletedLabel}</span>
                <span className="font-medium">{selectedDayData.habits.length}</span>
              </div>
              <div className="flex items-center justify-between p-2 bg-card/50 rounded-lg">
                <span className="text-muted-foreground">{gratitudesLabel}</span>
                <span className="font-medium">{selectedDayData.gratitude.length}</span>
              </div>
            </div>

            {selectedDayData.habits.length > 0 && (
              <div className="text-xs text-muted-foreground bg-card/30 p-2 rounded-lg">
                {selectedDayData.habits.join(', ')}
              </div>
            )}
          </div>
        ) : (
          <p className="text-sm text-muted-foreground text-center py-4">{selectDayLabel}</p>
        )}
      </div>
    </div>
  );
}
