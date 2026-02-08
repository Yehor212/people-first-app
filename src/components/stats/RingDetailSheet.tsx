/**
 * RingDetailSheet - Ultra-Premium Detail Sheet for RadialDashboard
 *
 * Features:
 * - Glassmorphism with animated gradient backdrop
 * - Animated SVG chart with glow effects
 * - Sparkle particle animations
 * - Personalized recommendations
 * - Smooth spring animations
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Target, Brain, TrendingUp, TrendingDown, Minus, Sparkles, Zap, ChevronRight } from 'lucide-react';
// Sheet replaced with custom bottom-sheet modal
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { cn } from '@/lib/utils';

export type RingType = 'mood' | 'habits' | 'focus';

interface DayData {
  date: string;
  value: number;
  label?: string;
}

interface RingDetailSheetProps {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  ringType: RingType | null;
  currentValue: number;
  weeklyData: DayData[];
  average?: number;
}

// Ring theme configurations with premium styling
const ringThemes: Record<RingType, {
  icon: typeof Heart;
  label: string;
  gradient: string;
  glowColor: string;
  chartColor: string;
  bgGradient: string;
  particleColor: string;
}> = {
  mood: {
    icon: Heart,
    label: 'Mood',
    gradient: 'from-pink-500 via-rose-500 to-red-500',
    glowColor: 'rgba(244, 63, 94, 0.5)',
    chartColor: '#f43f5e',
    bgGradient: 'from-pink-500/20 via-rose-500/10 to-transparent',
    particleColor: '#fda4af',
  },
  habits: {
    icon: Target,
    label: 'Habits',
    gradient: 'from-emerald-400 via-teal-500 to-cyan-500',
    glowColor: 'rgba(20, 184, 166, 0.5)',
    chartColor: '#14b8a6',
    bgGradient: 'from-emerald-500/20 via-teal-500/10 to-transparent',
    particleColor: '#5eead4',
  },
  focus: {
    icon: Brain,
    label: 'Focus',
    gradient: 'from-violet-500 via-purple-500 to-indigo-500',
    glowColor: 'rgba(139, 92, 246, 0.5)',
    chartColor: '#8b5cf6',
    bgGradient: 'from-violet-500/20 via-purple-500/10 to-transparent',
    particleColor: '#c4b5fd',
  },
};

// Premium animated chart with glow effects
function PremiumChart({ data, color, glowColor }: { data: DayData[]; color: string; glowColor: string }) {
  if (data.length < 2) return null;

  const values = data.map(d => d.value);
  const max = Math.max(...values, 100);
  const height = 100;
  const width = 300;
  const padding = { top: 15, bottom: 25, left: 15, right: 15 };
  const chartWidth = width - padding.left - padding.right;
  const chartHeight = height - padding.top - padding.bottom;

  const points = values.map((value, i) => ({
    x: padding.left + (i / (values.length - 1)) * chartWidth,
    y: padding.top + chartHeight - (value / max) * chartHeight,
    value,
  }));

  const pathD = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x.toFixed(1)} ${p.y.toFixed(1)}`).join(' ');
  const areaD = `${pathD} L ${points[points.length - 1].x} ${height - padding.bottom} L ${points[0].x} ${height - padding.bottom} Z`;

  const dayLabels = data.map(d => {
    const date = new Date(d.date);
    return date.toLocaleDateString('en', { weekday: 'short' }).slice(0, 1);
  });

  return (
    <svg width={width} height={height} className="overflow-visible">
      <defs>
        <linearGradient id="chartGradient" x1="0%" y1="0%" x2="0%" y2="100%">
          <stop offset="0%" stopColor={color} stopOpacity="0.4" />
          <stop offset="100%" stopColor={color} stopOpacity="0.02" />
        </linearGradient>
        <filter id="chartGlow" x="-50%" y="-50%" width="200%" height="200%">
          <feGaussianBlur stdDeviation="4" result="coloredBlur"/>
          <feMerge>
            <feMergeNode in="coloredBlur"/>
            <feMergeNode in="SourceGraphic"/>
          </feMerge>
        </filter>
      </defs>

      {/* Area fill with gradient */}
      <motion.path
        d={areaD}
        fill="url(#chartGradient)"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 0.8 }}
      />

      {/* Glow line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={glowColor}
        strokeWidth="6"
        strokeLinecap="round"
        strokeLinejoin="round"
        style={{ filter: 'blur(4px)' }}
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Main line */}
      <motion.path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="3"
        strokeLinecap="round"
        strokeLinejoin="round"
        initial={{ pathLength: 0 }}
        animate={{ pathLength: 1 }}
        transition={{ duration: 1.2, ease: 'easeOut' }}
      />

      {/* Data points with animation */}
      {points.map((point, i) => (
        <motion.g key={i}>
          {/* Outer glow ring */}
          <motion.circle
            cx={point.x}
            cy={point.y}
            r="8"
            fill={glowColor}
            initial={{ scale: 0, opacity: 0 }}
            animate={{ scale: 1, opacity: 0.3 }}
            transition={{ delay: 0.8 + i * 0.08 }}
          />
          {/* Inner dot */}
          <motion.circle
            cx={point.x}
            cy={point.y}
            r="5"
            fill="white"
            stroke={color}
            strokeWidth="2"
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ delay: 0.8 + i * 0.08, type: 'spring' }}
          />
          {/* Value label for last point */}
          {i === points.length - 1 && (
            <motion.g
              initial={{ opacity: 0, y: 5 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: 1.2 }}
            >
              <rect
                x={point.x - 18}
                y={point.y - 28}
                width="36"
                height="20"
                rx="10"
                fill={color}
              />
              <text
                x={point.x}
                y={point.y - 14}
                textAnchor="middle"
                className="text-xs font-bold fill-white"
              >
                {Math.round(point.value)}%
              </text>
            </motion.g>
          )}
        </motion.g>
      ))}

      {/* Day labels */}
      {dayLabels.map((label, i) => (
        <text
          key={i}
          x={points[i]?.x || 0}
          y={height - 6}
          textAnchor="middle"
          className="text-[10px] font-medium fill-muted-foreground"
        >
          {label}
        </text>
      ))}
    </svg>
  );
}

// Floating sparkle particles
function SparkleParticles({ color }: { color: string }) {
  return (
    <div className="absolute inset-0 overflow-hidden pointer-events-none">
      {[...Array(12)].map((_, i) => (
        <motion.div
          key={i}
          className="absolute"
          style={{
            left: `${5 + (i * 8)}%`,
            top: `${10 + (i % 4) * 20}%`,
          }}
          animate={{
            y: [0, -15, 0],
            opacity: [0, 1, 0],
            scale: [0.5, 1, 0.5],
          }}
          transition={{
            duration: 2 + (i % 3) * 0.5,
            delay: i * 0.15,
            repeat: Infinity,
            repeatDelay: 0.5,
          }}
        >
          <Sparkles className="w-3 h-3" style={{ color }} />
        </motion.div>
      ))}
    </div>
  );
}

export function RingDetailSheet({
  open,
  onOpenChange,
  ringType,
  currentValue,
  weeklyData,
  average,
}: RingDetailSheetProps) {
  const { t } = useLanguage();

  useBackHandler(open, () => onOpenChange(false));

  const theme = ringType ? ringThemes[ringType] : null;

  // Calculate stats
  const stats = useMemo(() => {
    if (weeklyData.length === 0) return { trend: 0, weekHigh: 0, weekLow: 0, avg: 0 };

    const values = weeklyData.map(d => d.value);
    const avg = values.reduce((a, b) => a + b, 0) / values.length;
    const trend = weeklyData.length >= 2
      ? weeklyData[weeklyData.length - 1].value - weeklyData[weeklyData.length - 2].value
      : 0;

    return {
      trend,
      weekHigh: Math.max(...values),
      weekLow: Math.min(...values),
      avg: Math.round(avg),
    };
  }, [weeklyData]);

  // Personalized recommendation
  const getRecommendation = () => {
    if (!ringType) return '';
    if (ringType === 'mood') {
      if (currentValue >= 80) return t.ringRecommendationMoodHigh || "You're in a great headspace! Share your positivity with someone today.";
      if (currentValue >= 50) return t.ringRecommendationMoodMid || "Try a 3-minute gratitude practice to boost your mood.";
      return t.ringRecommendationMoodLow || "Be gentle with yourself. A short walk or breathing exercise can help.";
    }
    if (ringType === 'habits') {
      if (currentValue >= 80) return t.ringRecommendationHabitsHigh || "Outstanding consistency! Your routines are building real momentum.";
      if (currentValue >= 50) return t.ringRecommendationHabitsMid || "You're making progress. Try starting with your favorite habit.";
      return t.ringRecommendationHabitsLow || "Small steps count. Just one habit today builds tomorrow's streak.";
    }
    if (currentValue >= 80) return t.ringRecommendationFocusHigh || "Deep work mastery! Your focused sessions are paying dividends.";
    if (currentValue >= 50) return t.ringRecommendationFocusMid || "Try a 25-minute Pomodoro session for your next task.";
    return t.ringRecommendationFocusLow || "Start with just 10 focused minutes. You've got this.";
  };

  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  if (!theme || !ringType) return null;

  const Icon = theme.icon;

  if (!open) return null;

  return (
    <>
      <div className="fixed inset-0 z-[60] bg-black/60 backdrop-blur-sm animate-fade-in" onClick={() => onOpenChange(false)} />
      <div role="dialog" aria-modal="true" className="fixed bottom-0 left-0 right-0 z-[60] rounded-t-[2rem] bg-background max-h-[90dvh] overflow-hidden animate-slide-up">
        <h2 className="sr-only">{t[ringType] || theme.label}</h2>

        {/* Premium Header with Gradient */}
        <div className={cn(
          'relative h-36 overflow-hidden',
          `bg-gradient-to-br ${theme.bgGradient}`
        )}>
          {/* Sparkle particles */}
          <SparkleParticles color={theme.particleColor} />

          {/* Animated gradient orb */}
          <motion.div
            className={cn(
              'absolute -top-24 -right-24 w-72 h-72 rounded-full blur-3xl',
              `bg-gradient-to-br ${theme.gradient}`
            )}
            animate={{
              scale: [1, 1.15, 1],
              opacity: [0.25, 0.4, 0.25],
            }}
            transition={{ duration: 5, repeat: Infinity }}
          />

          {/* Handle bar */}
          <div className="absolute top-3 left-1/2 -translate-x-1/2 w-12 h-1.5 rounded-full bg-white/30" />

          {/* Header content */}
          <div className="absolute bottom-5 left-6 right-6 flex items-end justify-between">
            <div className="flex items-center gap-4">
              <motion.div
                className="p-3.5 rounded-2xl bg-white/20 backdrop-blur-sm"
                style={{ boxShadow: `0 0 40px ${theme.glowColor}` }}
                animate={{
                  boxShadow: [
                    `0 0 25px ${theme.glowColor}`,
                    `0 0 50px ${theme.glowColor}`,
                    `0 0 25px ${theme.glowColor}`,
                  ],
                }}
                transition={{ duration: 2.5, repeat: Infinity }}
              >
                <Icon className="w-7 h-7 text-white" />
              </motion.div>
              <div>
                <h2 className="text-2xl font-bold text-white tracking-tight">
                  {t[ringType] || theme.label}
                </h2>
                <p className="text-sm text-white/70">
                  {t.last7Days || 'Last 7 days'}
                </p>
              </div>
            </div>
            <motion.div
              initial={{ scale: 0, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ delay: 0.2, type: 'spring' }}
            >
              <span
                className="text-4xl font-black text-white tabular-nums"
                style={{ textShadow: `0 0 30px ${theme.glowColor}` }}
              >
                {Math.round(currentValue)}%
              </span>
            </motion.div>
          </div>
        </div>

        {/* Content */}
        <div className="px-6 py-5 space-y-6 max-h-[55vh] overflow-y-auto bg-card">
          {/* Premium Chart Card */}
          <motion.div
            className="bg-muted/40 rounded-2xl p-5 backdrop-blur-sm"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.1 }}
          >
            <div className="flex items-center justify-between mb-4">
              <h3 className="text-sm font-semibold text-foreground">
                {t.weeklyTrend || 'Weekly Trend'}
              </h3>
              <div className={cn(
                'flex items-center gap-1.5 px-3 py-1.5 rounded-full text-xs font-bold',
                stats.trend > 0 ? 'bg-emerald-500/15 text-emerald-600 dark:text-emerald-400' :
                stats.trend < 0 ? 'bg-red-500/15 text-red-600 dark:text-red-400' :
                'bg-muted text-muted-foreground'
              )}>
                {stats.trend > 0 ? <TrendingUp className="w-3.5 h-3.5" /> :
                 stats.trend < 0 ? <TrendingDown className="w-3.5 h-3.5" /> :
                 <Minus className="w-3.5 h-3.5" />}
                <span>{stats.trend > 0 ? '+' : ''}{Math.round(stats.trend)}%</span>
              </div>
            </div>
            <div className="flex justify-center">
              <PremiumChart
                data={weeklyData.slice(-7)}
                color={theme.chartColor}
                glowColor={theme.glowColor}
              />
            </div>
          </motion.div>

          {/* Stats Grid */}
          <motion.div
            className="grid grid-cols-3 gap-3"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.2 }}
          >
            {[
              { label: t.average || 'Average', value: `${stats.avg}%`, emoji: '📊' },
              { label: t.weekHigh || 'Best', value: `${Math.round(stats.weekHigh)}%`, emoji: '🏆' },
              { label: t.weekLow || 'Low', value: `${Math.round(stats.weekLow)}%`, emoji: '📉' },
            ].map((stat, i) => (
              <motion.div
                key={stat.label}
                className="bg-muted/30 rounded-xl p-3.5 text-center backdrop-blur-sm"
                initial={{ scale: 0.9, opacity: 0 }}
                animate={{ scale: 1, opacity: 1 }}
                transition={{ delay: 0.25 + i * 0.08 }}
              >
                <span className="text-xl">{stat.emoji}</span>
                <p className="text-lg font-bold text-foreground mt-1">{stat.value}</p>
                <p className="text-[11px] text-muted-foreground font-medium">{stat.label}</p>
              </motion.div>
            ))}
          </motion.div>

          {/* Day-by-day mini crystals */}
          <motion.div
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.3 }}
          >
            <p className="text-sm font-semibold text-foreground mb-3">
              {t.dailyBreakdown || 'Daily Breakdown'}
            </p>
            <div className="grid grid-cols-7 gap-2">
              {weeklyData.slice(-7).map((day, idx) => {
                const dayOfWeek = new Date(day.date).getDay();
                const isToday = day.date === new Date().toISOString().split('T')[0];
                const intensity = day.value / 100;

                return (
                  <motion.div
                    key={day.date}
                    className={cn(
                      'flex flex-col items-center py-2 rounded-xl transition-all',
                      isToday && 'ring-2 ring-primary ring-offset-2 ring-offset-background'
                    )}
                    style={{
                      background: `linear-gradient(135deg, ${theme.chartColor}${Math.round(intensity * 40).toString(16).padStart(2, '0')}, transparent)`,
                    }}
                    initial={{ scale: 0.8, opacity: 0 }}
                    animate={{ scale: 1, opacity: 1 }}
                    transition={{ delay: 0.35 + idx * 0.05 }}
                  >
                    <span className="text-[10px] text-muted-foreground font-medium mb-1">
                      {dayNames[dayOfWeek]?.slice(0, 2)}
                    </span>
                    <div
                      className="w-6 h-8 rounded-md flex items-center justify-center"
                      style={{
                        background: `linear-gradient(180deg, ${theme.chartColor}, ${theme.chartColor}aa)`,
                        opacity: 0.3 + intensity * 0.7,
                        boxShadow: intensity > 0.6 ? `0 0 8px ${theme.glowColor}` : 'none',
                      }}
                    >
                      <span className="text-[9px] font-bold text-white">
                        {Math.round(day.value)}
                      </span>
                    </div>
                  </motion.div>
                );
              })}
            </div>
          </motion.div>

          {/* Recommendation Card */}
          <motion.div
            className={cn(
              'relative overflow-hidden rounded-2xl p-4',
              `bg-gradient-to-br ${theme.bgGradient}`,
              'border border-border/40'
            )}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-start gap-3">
              <div className={cn('p-2 rounded-xl', `bg-gradient-to-br ${theme.gradient}`)}>
                <Zap className="w-4 h-4 text-white" />
              </div>
              <div className="flex-1">
                <h4 className="text-sm font-semibold text-foreground mb-1">
                  {t.recommendation || 'For You'}
                </h4>
                <p className="text-sm text-muted-foreground leading-relaxed">
                  {getRecommendation()}
                </p>
              </div>
            </div>
          </motion.div>

          {/* CTA Button */}
          <motion.button
            className={cn(
              'w-full py-4 px-5 rounded-2xl font-semibold',
              'flex items-center justify-center gap-2',
              `bg-gradient-to-r ${theme.gradient}`,
              'text-white shadow-xl transition-all active:scale-[0.98]'
            )}
            style={{ boxShadow: `0 8px 32px ${theme.glowColor}` }}
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.5 }}
            whileHover={{ scale: 1.02, boxShadow: `0 12px 40px ${theme.glowColor}` }}
            whileTap={{ scale: 0.98 }}
            onClick={() => onOpenChange(false)}
          >
            <Sparkles className="w-5 h-5" />
            <span>
              {ringType === 'mood' ? (t.logMood || 'Log Mood') :
               ringType === 'habits' ? (t.viewHabits || 'View Habits') :
               (t.startFocus || 'Start Focus')}
            </span>
            <ChevronRight className="w-5 h-5" />
          </motion.button>
        </div>
      </div>
    </>
  );
}

export default RingDetailSheet;
