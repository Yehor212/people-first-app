/**
 * WeeklyReview - Ultra-Premium Weekly Summary Component
 *
 * Features:
 * - Glassmorphism with animated cosmic gradients
 * - Week-over-week comparison with trend indicators
 * - Top 3 achievements highlight
 * - Personalized recommendations
 * - Animated progress rings and sparkles
 */

import { useMemo, useState } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import {
  Trophy,
  TrendingUp,
  TrendingDown,
  Minus,
  Sparkles,
  Target,
  Brain,
  Heart,
  Flame,
  ChevronDown,
  ChevronUp,
  Zap,
  Star,
  Crown,
} from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Habit, MoodEntry, FocusSession } from '@/types';
import { formatDate, getToday } from '@/lib/utils';
import { isHabitCompletedOnDate } from '@/lib/habits';

interface WeeklyReviewProps {
  habits: Habit[];
  moods: MoodEntry[];
  focusSessions: FocusSession[];
  currentStreak: number;
  className?: string;
}

interface WeekStats {
  habitsCompleted: number;
  habitRate: number;
  focusMinutes: number;
  moodAvg: number;
  perfectDays: number;
  bestDay: string | null;
}

// Sparkle particle component
function SparkleParticle({ delay, color }: { delay: number; color: string }) {
  return (
    <motion.div
      className="absolute"
      style={{
        left: `${10 + Math.random() * 80}%`,
        top: `${10 + Math.random() * 80}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
        rotate: [0, 180],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 3,
      }}
    >
      <Sparkles className="w-3 h-3" style={{ color }} />
    </motion.div>
  );
}

// Mini progress ring
function MiniRing({
  value,
  color,
  size = 48,
}: {
  value: number;
  color: string;
  size?: number;
}) {
  const radius = (size - 8) / 2;
  const circumference = 2 * Math.PI * radius;
  const offset = circumference - (value / 100) * circumference;

  return (
    <svg width={size} height={size} className="-rotate-90">
      <circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="4"
        className="stroke-muted/20"
      />
      <motion.circle
        cx={size / 2}
        cy={size / 2}
        r={radius}
        fill="none"
        strokeWidth="4"
        strokeLinecap="round"
        stroke={color}
        strokeDasharray={circumference}
        initial={{ strokeDashoffset: circumference }}
        animate={{ strokeDashoffset: offset }}
        transition={{ duration: 1, ease: 'easeOut' }}
        style={{ filter: `drop-shadow(0 0 6px ${color})` }}
      />
    </svg>
  );
}

// Achievement badge component
function AchievementBadge({
  icon: Icon,
  title,
  value,
  color,
  delay,
}: {
  icon: typeof Trophy;
  title: string;
  value: string;
  color: string;
  delay: number;
}) {
  return (
    <motion.div
      initial={{ scale: 0.8, opacity: 0, y: 20 }}
      animate={{ scale: 1, opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 200 }}
      className="relative flex flex-col items-center p-3 rounded-2xl bg-gradient-to-br from-foreground/10 to-foreground/5 backdrop-blur-sm border border-foreground/10"
      style={{ boxShadow: `0 0 20px ${color}30` }}
    >
      <motion.div
        className="p-2.5 rounded-xl mb-2"
        style={{ background: `linear-gradient(135deg, ${color}40, ${color}20)` }}
        animate={{
          boxShadow: [
            `0 0 10px ${color}40`,
            `0 0 20px ${color}60`,
            `0 0 10px ${color}40`,
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <Icon className="w-5 h-5" style={{ color }} />
      </motion.div>
      <span className="text-lg font-bold text-foreground">{value}</span>
      <span className="text-[10px] text-muted-foreground text-center">{title}</span>
    </motion.div>
  );
}

export function WeeklyReview({
  habits,
  moods,
  focusSessions,
  currentStreak,
  className,
}: WeeklyReviewProps) {
  const { t } = useLanguage();
  const [isExpanded, setIsExpanded] = useState(false);
  const today = new Date();
  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  // Calculate this week and last week dates
  const weekDates = useMemo(() => {
    const thisWeek: string[] = [];
    const lastWeek: string[] = [];

    for (let i = 6; i >= 0; i--) {
      const d = new Date(today);
      d.setDate(d.getDate() - i);
      thisWeek.push(formatDate(d));

      const ld = new Date(today);
      ld.setDate(ld.getDate() - i - 7);
      lastWeek.push(formatDate(ld));
    }

    return { thisWeek, lastWeek };
  }, [today]);

  // Calculate week stats
  const calculateWeekStats = (dates: string[]): WeekStats => {
    let habitsCompleted = 0;
    let totalPossible = 0;
    let focusMinutes = 0;
    let moodTotal = 0;
    let moodCount = 0;
    let perfectDays = 0;
    let bestDay: string | null = null;
    let bestDayScore = 0;

    dates.forEach(date => {
      // Habits
      const dayHabits = habits.filter(h => isHabitCompletedOnDate(h, date)).length;
      habitsCompleted += dayHabits;
      totalPossible += habits.length;

      // Focus
      const dayFocus = focusSessions
        .filter(s => s.date === date && s.completed)
        .reduce((sum, s) => sum + s.duration, 0);
      focusMinutes += dayFocus;

      // Mood
      const dayMoods = moods.filter(m => m.date === date);
      dayMoods.forEach(m => {
        const score = m.mood === 'great' ? 5 : m.mood === 'good' ? 4 : m.mood === 'okay' ? 3 : m.mood === 'bad' ? 2 : 1;
        moodTotal += score;
        moodCount++;
      });

      // Perfect day check
      const isPerfect = dayHabits === habits.length && habits.length > 0 && dayFocus >= 30;
      if (isPerfect) perfectDays++;

      // Best day calculation
      const dayScore = (dayHabits / Math.max(habits.length, 1)) * 50 +
                       Math.min(dayFocus / 60, 1) * 30 +
                       (dayMoods.length > 0 ? (moodTotal / moodCount / 5) * 20 : 0);
      if (dayScore > bestDayScore) {
        bestDayScore = dayScore;
        bestDay = date;
      }
    });

    return {
      habitsCompleted,
      habitRate: totalPossible > 0 ? Math.round((habitsCompleted / totalPossible) * 100) : 0,
      focusMinutes,
      moodAvg: moodCount > 0 ? moodTotal / moodCount : 0,
      perfectDays,
      bestDay,
    };
  };

  const thisWeekStats = useMemo(() => calculateWeekStats(weekDates.thisWeek), [weekDates.thisWeek, habits, moods, focusSessions]);
  const lastWeekStats = useMemo(() => calculateWeekStats(weekDates.lastWeek), [weekDates.lastWeek, habits, moods, focusSessions]);

  // Calculate changes
  const changes = {
    habitRate: thisWeekStats.habitRate - lastWeekStats.habitRate,
    focusMinutes: thisWeekStats.focusMinutes - lastWeekStats.focusMinutes,
    moodAvg: thisWeekStats.moodAvg - lastWeekStats.moodAvg,
  };

  // Overall score
  const weekScore = Math.round(
    thisWeekStats.habitRate * 0.4 +
    Math.min(thisWeekStats.focusMinutes / 300, 1) * 100 * 0.3 +
    (thisWeekStats.moodAvg / 5) * 100 * 0.3
  );

  // Get recommendation based on stats
  const getRecommendation = () => {
    if (thisWeekStats.habitRate < 50) {
      return t.weeklyRecommendationHabits || "Focus on building one habit at a time. Consistency beats perfection.";
    }
    if (thisWeekStats.focusMinutes < 120) {
      return t.weeklyRecommendationFocus || "Try adding one 25-minute focus session per day to boost productivity.";
    }
    if (thisWeekStats.moodAvg < 3) {
      return t.weeklyRecommendationMood || "Consider adding gratitude journaling to improve your daily mood.";
    }
    return t.weeklyRecommendationGreat || "Outstanding week! Keep this momentum going into next week.";
  };

  // Top achievements
  const achievements = [
    {
      icon: Target,
      title: t.habitsCompleted || 'Habits',
      value: `${thisWeekStats.habitsCompleted}`,
      color: '#10b981',
    },
    {
      icon: Brain,
      title: t.focusMinutes || 'Focus',
      value: `${thisWeekStats.focusMinutes}m`,
      color: '#8b5cf6',
    },
    {
      icon: Flame,
      title: t.streak || 'Streak',
      value: `${currentStreak}d`,
      color: '#f97316',
    },
  ];

  // Best day of week
  const bestDayName = thisWeekStats.bestDay
    ? dayNames[new Date(thisWeekStats.bestDay).getDay()]
    : null;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className={cn(
        'relative overflow-hidden rounded-3xl',
        'bg-gradient-to-br from-card via-card to-card/90',
        'border border-border/50',
        'shadow-xl',
        className
      )}
    >
      {/* Animated cosmic background */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        <motion.div
          className="absolute -top-1/2 -end-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(139, 92, 246, 0.15) 0%, transparent 70%)',
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.3, 0.5, 0.3],
          }}
          transition={{ duration: 8, repeat: Infinity }}
        />
        <motion.div
          className="absolute -bottom-1/2 -start-1/2 w-full h-full rounded-full"
          style={{
            background: 'radial-gradient(circle, rgba(16, 185, 129, 0.1) 0%, transparent 60%)',
          }}
          animate={{
            scale: [1.2, 1, 1.2],
            opacity: [0.2, 0.4, 0.2],
          }}
          transition={{ duration: 10, repeat: Infinity }}
        />

        {/* Sparkle particles */}
        {[0, 0.5, 1, 1.5, 2].map((delay, i) => (
          <SparkleParticle key={i} delay={delay} color={i % 2 === 0 ? '#8b5cf6' : '#10b981'} />
        ))}
      </div>

      {/* Header */}
      <div className="relative p-5 pb-4">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className="p-2.5 rounded-xl bg-gradient-to-br from-violet-500/30 to-purple-600/20 backdrop-blur-sm"
              style={{ boxShadow: '0 0 20px rgba(139, 92, 246, 0.3)' }}
              animate={{
                boxShadow: [
                  '0 0 15px rgba(139, 92, 246, 0.3)',
                  '0 0 25px rgba(139, 92, 246, 0.5)',
                  '0 0 15px rgba(139, 92, 246, 0.3)',
                ],
              }}
              transition={{ duration: 3, repeat: Infinity }}
            >
              <Crown className="w-5 h-5 text-violet-400" />
            </motion.div>
            <div>
              <h3 className="text-base font-bold text-foreground">
                {t.weeklyReview || 'Weekly Review'}
              </h3>
              <p className="text-xs text-muted-foreground">
                {t.thisWeekSummary || 'Your week at a glance'}
              </p>
            </div>
          </div>

          {/* Week score */}
          <motion.div
            className="relative"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.2, type: 'spring' }}
          >
            <MiniRing value={weekScore} color="#8b5cf6" size={56} />
            <div className="absolute inset-0 flex items-center justify-center">
              <span className="text-sm font-bold text-foreground">{weekScore}</span>
            </div>
          </motion.div>
        </div>

        {/* Achievement badges */}
        <div className="grid grid-cols-3 gap-2 mb-4">
          {achievements.map((achievement, i) => (
            <AchievementBadge key={achievement.title} {...achievement} delay={0.3 + i * 0.1} />
          ))}
        </div>

        {/* Week comparison stats */}
        <div className="grid grid-cols-3 gap-3">
          {[
            {
              label: t.habits || 'Habits',
              value: `${thisWeekStats.habitRate}%`,
              change: changes.habitRate,
              icon: Target,
              color: '#10b981',
            },
            {
              label: t.focus || 'Focus',
              value: `${thisWeekStats.focusMinutes}m`,
              change: changes.focusMinutes,
              icon: Brain,
              color: '#8b5cf6',
            },
            {
              label: t.mood || 'Mood',
              value: thisWeekStats.moodAvg.toFixed(1),
              change: changes.moodAvg,
              icon: Heart,
              color: '#f43f5e',
            },
          ].map((stat, i) => (
            <motion.div
              key={stat.label}
              initial={{ opacity: 0, y: 10 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 0.5 + i * 0.1 }}
              className="p-3 rounded-xl bg-muted/30 backdrop-blur-sm"
            >
              <div className="flex items-center gap-1.5 mb-1">
                <stat.icon className="w-3.5 h-3.5" style={{ color: stat.color }} />
                <span className="text-[10px] text-muted-foreground">{stat.label}</span>
              </div>
              <div className="flex items-center justify-between">
                <span className="text-sm font-bold text-foreground">{stat.value}</span>
                <div className={cn(
                  'flex items-center gap-0.5 text-[10px] font-medium',
                  stat.change > 0 ? 'text-emerald-500' :
                  stat.change < 0 ? 'text-red-500' : 'text-muted-foreground'
                )}>
                  {stat.change > 0 ? <TrendingUp className="w-3 h-3" /> :
                   stat.change < 0 ? <TrendingDown className="w-3 h-3" /> :
                   <Minus className="w-3 h-3" />}
                  {stat.change > 0 ? '+' : ''}{typeof stat.change === 'number' && stat.label === t.mood
                    ? stat.change.toFixed(1)
                    : Math.round(stat.change)}
                </div>
              </div>
            </motion.div>
          ))}
        </div>

        {/* Expand button */}
        <button
          onClick={() => setIsExpanded(!isExpanded)}
          className="w-full flex items-center justify-center gap-1 mt-4 py-2 text-xs text-muted-foreground hover:text-foreground transition-colors"
          aria-expanded={isExpanded}
        >
          <span>{isExpanded ? (t.showLess || 'Show less') : (t.viewDetails || 'View details')}</span>
          {isExpanded ? <ChevronUp className="w-4 h-4" /> : <ChevronDown className="w-4 h-4" />}
        </button>
      </div>

      {/* Expanded content */}
      <AnimatePresence>
        {isExpanded && (
          <motion.div
            initial={{ height: 0, opacity: 0 }}
            animate={{ height: 'auto', opacity: 1 }}
            exit={{ height: 0, opacity: 0 }}
            transition={{ duration: 0.3 }}
            className="overflow-hidden"
          >
            <div className="px-5 pb-5 space-y-4 border-t border-border/30 pt-4">
              {/* Best day highlight */}
              {bestDayName && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-amber-500/10 to-orange-500/5 border border-amber-500/20"
                >
                  <div className="p-2 rounded-lg bg-amber-500/20">
                    <Star className="w-4 h-4 text-amber-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      {t.bestDayWas || 'Best day was'} <span className="text-amber-500">{bestDayName}</span>
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.bestDayDesc || 'You achieved the most on this day'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Perfect days */}
              {thisWeekStats.perfectDays > 0 && (
                <motion.div
                  initial={{ opacity: 0, x: -20 }}
                  animate={{ opacity: 1, x: 0 }}
                  transition={{ delay: 0.1 }}
                  className="flex items-center gap-3 p-3 rounded-xl bg-gradient-to-r from-emerald-500/10 to-teal-500/5 border border-emerald-500/20"
                >
                  <div className="p-2 rounded-lg bg-emerald-500/20">
                    <Trophy className="w-4 h-4 text-emerald-500" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground">
                      <span className="text-emerald-500">{thisWeekStats.perfectDays}</span> {t.perfectDays || 'perfect days'}
                    </p>
                    <p className="text-xs text-muted-foreground">
                      {t.perfectDaysDesc || 'All habits + 30min focus'}
                    </p>
                  </div>
                </motion.div>
              )}

              {/* Recommendation */}
              <motion.div
                initial={{ opacity: 0, y: 10 }}
                animate={{ opacity: 1, y: 0 }}
                transition={{ delay: 0.2 }}
                className="p-4 rounded-xl bg-gradient-to-br from-violet-500/10 to-purple-500/5 border border-violet-500/20"
              >
                <div className="flex items-start gap-3">
                  <div className="p-2 rounded-lg bg-violet-500/20">
                    <Zap className="w-4 h-4 text-violet-400" />
                  </div>
                  <div>
                    <p className="text-sm font-medium text-foreground mb-1">
                      {t.forNextWeek || 'For next week'}
                    </p>
                    <p className="text-xs text-muted-foreground leading-relaxed">
                      {getRecommendation()}
                    </p>
                  </div>
                </div>
              </motion.div>
            </div>
          </motion.div>
        )}
      </AnimatePresence>
    </motion.div>
  );
}

export default WeeklyReview;
