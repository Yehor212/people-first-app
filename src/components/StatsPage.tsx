import { useMemo, useState } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { calculateStreak, getDaysInMonth, getToday, cn } from '@/lib/utils';
import { getHabitCompletedDates, getHabitCompletionTotal, isHabitCompletedOnDate } from '@/lib/habits';
import { TrendingUp, Calendar, Zap, Heart, ChevronLeft, ChevronRight, ChevronDown, ChevronUp } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface StatsPageProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  currentFocusMinutes?: number;
}

const moodEmojis: Record<string, string> = {
  great: '😄',
  good: '🙂',
  okay: '😐',
  bad: '😔',
  terrible: '😢',
};

export function StatsPage({ moods, habits, focusSessions, gratitudeEntries, currentFocusMinutes }: StatsPageProps) {
  const { t } = useLanguage();
  const [selectedTag, setSelectedTag] = useState<string>('all');
  const [range, setRange] = useState<'week' | 'month' | 'all'>('month');
  const todayKey = getToday();
  const [selectedYear, setSelectedYear] = useState(() => new Date().getFullYear());
  const [selectedMonth, setSelectedMonth] = useState(() => new Date().getMonth());
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
  
  const moodLabels: Record<string, string> = {
    great: t.great,
    good: t.good,
    okay: t.okay,
    bad: t.bad,
    terrible: t.terrible,
  };

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
    const totalHabitCompletions = habits.reduce((acc, habit) => {
      const count = getHabitCompletedDates(habit).filter((date) => range === 'all' || rangeDates.has(date)).length;
      return acc + count;
    }, 0);

    const allDates = habits.flatMap(h => getHabitCompletedDates(h));
    const uniqueDates = [...new Set(allDates)].sort();
    const currentStreak = calculateStreak(uniqueDates);

    const moodCounts = filteredMoods.reduce((acc, m) => {
      acc[m.mood] = (acc[m.mood] || 0) + 1;
      return acc;
    }, {} as Record<string, number>);

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
      totalHabitCompletions,
      currentStreak,
      moodCounts,
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
      const score = moodScore(entry.mood);
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
        bestDay = { day: dayNames[Number(dayIndex)] || '', avg };
      }
    });

    const moodByDate = new Map(filteredMoods.map((entry) => [entry.date, moodScore(entry.mood)]));
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

  const moodByDate = useMemo(() => {
    const map = new Map<string, MoodEntry>();
    moods.forEach((entry) => {
      map.set(entry.date, entry);
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
    const addYear = (date: string) => {
      const year = Number(date.split('-')[0]);
      if (!Number.isNaN(year)) {
        set.add(year);
      }
    };
    [...moodByDate.keys()].forEach(addYear);
    [...focusMinutesByDate.keys()].forEach(addYear);
    [...gratitudeByDate.keys()].forEach(addYear);
    [...habitCompletionMap.keys()].forEach(addYear);
    const currentYear = new Date().getFullYear();
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
      mood: moodByDate.get(selectedDate),
      focusMinutes: focusMinutesByDate.get(selectedDate) || 0,
      habits: habitCompletionMap.get(selectedDate) || [],
      gratitude: gratitudeByDate.get(selectedDate) || []
    };
  }, [selectedDate, moodByDate, focusMinutesByDate, habitCompletionMap, gratitudeByDate]);

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

  return (
    <div className="space-y-6 animate-fade-in pb-24">
      <h2 className="text-2xl font-bold text-foreground">{t.statistics}</h2>

      {/* Monthly Overview */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient rounded-xl">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{stats.monthName}</h3>
        </div>

        <div className="flex flex-wrap gap-2 mb-4">
          <button
            onClick={() => setRange('week')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${range === 'week' ? 'bg-primary/10 ring-2 ring-primary text-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}
          >
            {t.statsRangeWeek}
          </button>
          <button
            onClick={() => setRange('month')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${range === 'month' ? 'bg-primary/10 ring-2 ring-primary text-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}
          >
            {t.statsRangeMonth}
          </button>
          <button
            onClick={() => setRange('all')}
            className={`px-3 py-2 rounded-lg text-xs font-medium transition-colors ${range === 'all' ? 'bg-primary/10 ring-2 ring-primary text-foreground' : 'bg-secondary text-muted-foreground hover:bg-muted'}`}
          >
            {t.statsRangeAll}
          </button>
        </div>
        
        <div className="grid grid-cols-3 gap-4">
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-primary">{stats.thisMonthMoods}</p>
            <p className="text-xs text-muted-foreground">{t.moodEntries}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-accent">{stats.thisMonthFocusMinutes}</p>
            <p className="text-xs text-muted-foreground">{t.focusMinutes}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-2xl font-bold text-mood-good">{stats.thisMonthGratitude}</p>
            <p className="text-xs text-muted-foreground">{t.gratitudes}</p>
          </div>
        </div>
      </div>

      {/* Achievements */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient-sunset rounded-xl">
            <Zap className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.achievements}</h3>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.currentStreak}</p>
              <p className="text-sm text-muted-foreground">{t.daysInRow}</p>
            </div>
            <div className="text-3xl font-bold text-accent">
              🔥 {stats.currentStreak}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.totalFocus}</p>
              <p className="text-sm text-muted-foreground">{t.allTime}</p>
            </div>
            <div className="text-3xl font-bold text-primary">
              ⏱️ {stats.totalFocusMinutes}{t.min}
            </div>
          </div>

          <div className="flex items-center justify-between p-4 bg-secondary rounded-xl">
            <div>
              <p className="font-medium text-foreground">{t.habitsCompleted}</p>
              <p className="text-sm text-muted-foreground">{t.totalTimes}</p>
            </div>
            <div className="text-3xl font-bold text-mood-good">
              ✅ {stats.totalHabitCompletions}
            </div>
          </div>
        </div>
      </div>

      {/* Mood Distribution */}
      {Object.keys(stats.moodCounts).length > 0 && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 zen-gradient-calm rounded-xl">
              <Heart className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.moodDistribution}</h3>
          </div>

          {allTags.length > 0 && (
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-2 block">{t.moodTagFilter}</label>
              <select
                value={selectedTag}
                onChange={(e) => setSelectedTag(e.target.value)}
                className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              >
                <option value="all">{t.allTags}</option>
                {allTags.map((tag) => (
                  <option key={tag} value={tag}>
                    {tag}
                  </option>
                ))}
              </select>
            </div>
          )}

          <div className="space-y-3">
            {(['great', 'good', 'okay', 'bad', 'terrible'] as const).map((mood) => {
              const count = stats.moodCounts[mood] || 0;
              const total = filteredMoods.length;
              const percentage = total > 0 ? (count / total) * 100 : 0;
              
              return (
                <div key={mood} className="flex items-center gap-3">
                  <span className="text-2xl w-10">{moodEmojis[mood]}</span>
                  <div className="flex-1">
                    <div className="h-3 bg-secondary rounded-full overflow-hidden">
                      <div 
                        className={`h-full bg-mood-${mood} transition-all duration-500`}
                        style={{ width: `${percentage}%` }}
                      />
                    </div>
                  </div>
                  <span className="text-sm text-muted-foreground w-12 text-right">
                    {count}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      )}

      {/* Mood Heatmap */}
      {filteredMoods.length > 0 && (
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
          <div className="flex items-center gap-3 mb-4">
            <div className="p-2 zen-gradient rounded-xl">
              <Calendar className="w-5 h-5 text-primary-foreground" />
            </div>
            <h3 className="text-lg font-semibold text-foreground">{t.moodHeatmap}</h3>
          </div>
          <div className="grid grid-cols-7 gap-2">
            {heatmapDays.map((day) => (
              <div
                key={day.dateKey}
                className={`w-9 h-9 rounded-lg flex items-center justify-center text-xs font-semibold ${day.mood ? `bg-mood-${day.mood}` : 'bg-secondary text-muted-foreground'}`}
              >
                {day.day}
              </div>
            ))}
          </div>
        </div>
      )}

      {/* Year Calendar */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
        <div className="flex items-center gap-3 mb-4">
          <div className="p-2 zen-gradient rounded-xl">
            <Calendar className="w-5 h-5 text-primary-foreground" />
          </div>
          <h3 className="text-lg font-semibold text-foreground">{t.calendarTitle}</h3>
        </div>

        <div className="flex flex-wrap items-center gap-2 mb-4">
          <label className="text-sm text-muted-foreground">{t.calendarYear}</label>
          <select
            value={selectedYear}
            onChange={(e) => setSelectedYear(Number(e.target.value))}
            className="p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
          >
            {availableYears.map((year) => (
              <option key={year} value={year}>
                {year}
              </option>
            ))}
          </select>
          <div className="ml-auto flex items-center gap-2">
            <button
              onClick={() => handleMonthShift(-1)}
              aria-label={t.calendarPrevMonth}
              className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
            >
              <ChevronLeft className="w-4 h-4" />
            </button>
            <button
              onClick={() => setShowMonthSelector(!showMonthSelector)}
              className="px-3 py-2 rounded-lg bg-secondary text-sm text-foreground hover:bg-muted transition-colors flex items-center gap-2"
            >
              {monthNames[selectedMonth]} {selectedYear}
              {showMonthSelector ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
            </button>
            <button
              onClick={() => handleMonthShift(1)}
              aria-label={t.calendarNextMonth}
              className="p-2 rounded-lg bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
            >
              <ChevronRight className="w-4 h-4" />
            </button>
          </div>
        </div>

        {showMonthSelector && (
          <div className="grid grid-cols-4 gap-2 mb-4 animate-accordion-down">
            {monthNames.map((month, index) => (
              <button
                key={month}
                onClick={() => {
                  setSelectedMonth(index);
                  setSelectedDate(null);
                  setShowMonthSelector(false);
                }}
                className={cn(
                  "px-2 py-2 rounded-lg text-xs font-medium transition-colors",
                  selectedMonth === index
                    ? "bg-primary/10 ring-2 ring-primary text-foreground"
                    : "bg-secondary text-muted-foreground hover:bg-muted"
                )}
              >
                {month}
              </button>
            ))}
          </div>
        )}

        <div className="grid grid-cols-4 gap-4 mb-4">
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-lg font-bold text-primary">{yearStats.moodCount}</p>
            <p className="text-xs text-muted-foreground">{t.moodEntries}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-lg font-bold text-accent">{yearStats.focusMinutes}</p>
            <p className="text-xs text-muted-foreground">{t.focusMinutes}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-lg font-bold text-mood-good">{yearStats.habitCompletions}</p>
            <p className="text-xs text-muted-foreground">{t.habitsCompleted}</p>
          </div>
          <div className="text-center p-3 bg-secondary rounded-xl">
            <p className="text-lg font-bold text-primary">{yearStats.gratitudeCount}</p>
            <p className="text-xs text-muted-foreground">{t.gratitudes}</p>
          </div>
        </div>

        <div className="grid grid-cols-7 gap-2 text-xs text-muted-foreground mb-2">
          {[t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat].map((day) => (
            <div key={day} className="text-center">
              {day.slice(0, 2)}
            </div>
          ))}
        </div>
        <div className="grid grid-cols-7 gap-2">
          {calendarDays.map((cell, index) => {
            if (!cell.dateKey) {
              return <div key={`empty-${index}`} className="w-9 h-9" />;
            }
            const mood = moodByDate.get(cell.dateKey)?.mood;
            const hasData = moodByDate.has(cell.dateKey)
              || focusMinutesByDate.has(cell.dateKey)
              || habitCompletionMap.has(cell.dateKey)
              || gratitudeByDate.has(cell.dateKey);
            return (
              <button
                key={cell.dateKey}
                onClick={() => setSelectedDate(cell.dateKey || null)}
                className={cn(
                  "w-9 h-9 rounded-lg text-xs font-semibold flex items-center justify-center transition-colors",
                  mood ? `bg-mood-${mood} text-foreground` : hasData ? "bg-primary/10 text-foreground" : "bg-secondary text-muted-foreground",
                  cell.dateKey === todayKey && "ring-2 ring-primary",
                  cell.dateKey === selectedDate && "outline outline-2 outline-primary"
                )}
              >
                {cell.day}
              </button>
            );
          })}
        </div>

        <div className="mt-4 p-4 bg-secondary rounded-xl">
          {selectedDate && selectedDayData ? (
            <div className="space-y-2 text-sm text-foreground">
              <p className="font-medium">{selectedDate}</p>
              <div className="flex items-center justify-between">
                <span>{t.moodToday}</span>
                <span className="flex items-center gap-2">
                  <span>{selectedDayData.mood ? moodEmojis[selectedDayData.mood.mood] : '—'}</span>
                  <span>{selectedDayData.mood ? moodLabels[selectedDayData.mood.mood] : t.moodNoData}</span>
                </span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.focusMinutes}</span>
                <span>{selectedDayData.focusMinutes}</span>
              </div>
              <div className="flex items-center justify-between">
                <span>{t.habitsCompleted}</span>
                <span>{selectedDayData.habits.length}</span>
              </div>
              {selectedDayData.habits.length > 0 && (
                <div className="text-xs text-muted-foreground">
                  {selectedDayData.habits.join(', ')}
                </div>
              )}
              <div className="flex items-center justify-between">
                <span>{t.gratitudes}</span>
                <span>{selectedDayData.gratitude.length}</span>
              </div>
              {selectedDayData.gratitude.length > 0 && (
                <div className="text-xs text-muted-foreground space-y-1">
                  {selectedDayData.gratitude.slice(0, 3).map((entry) => (
                    <p key={entry.id}>• {entry.text}</p>
                  ))}
                </div>
              )}
            </div>
          ) : (
            <p className="text-sm text-muted-foreground">{t.calendarSelectDay}</p>
          )}
        </div>
      </div>

      {/* Mood Patterns */}
      <div className="bg-card rounded-2xl p-6 zen-shadow-card">
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
        <div className="bg-card rounded-2xl p-6 zen-shadow-card">
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
    </div>
  );
}
