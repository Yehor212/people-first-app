/**
 * RingDetailSheet - Detailed breakdown when clicking a ring in RadialDashboard
 * Shows weekly history, trend, and recommendations for mood/habits/focus
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { Heart, Target, Brain, TrendingUp, TrendingDown, Minus } from 'lucide-react';
import { Sheet, SheetContent, SheetHeader, SheetTitle } from '@/components/ui/sheet';
import { useLanguage } from '@/contexts/LanguageContext';
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

// Mini sparkline component - 7 points for week
function MiniSparkline({ data, color }: { data: number[]; color: string }) {
  if (data.length < 2) return null;

  const max = Math.max(...data, 1);
  const min = Math.min(...data, 0);
  const range = max - min || 1;
  const height = 40;
  const width = 100;
  const padding = 4;

  const points = data.map((value, i) => {
    const x = padding + (i / (data.length - 1)) * (width - padding * 2);
    const y = height - padding - ((value - min) / range) * (height - padding * 2);
    return { x, y };
  });

  const pathD = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ');

  return (
    <svg width={width} height={height} className="overflow-visible">
      {/* Gradient fill */}
      <defs>
        <linearGradient id={`sparkline-${color}`} x1="0" y1="0" x2="0" y2="1">
          <stop offset="0%" stopColor={color} stopOpacity="0.3" />
          <stop offset="100%" stopColor={color} stopOpacity="0" />
        </linearGradient>
      </defs>

      {/* Area fill */}
      <path
        d={`${pathD} L ${points[points.length - 1].x} ${height - padding} L ${points[0].x} ${height - padding} Z`}
        fill={`url(#sparkline-${color})`}
      />

      {/* Line */}
      <path
        d={pathD}
        fill="none"
        stroke={color}
        strokeWidth="2"
        strokeLinecap="round"
        strokeLinejoin="round"
      />

      {/* End point */}
      <circle
        cx={points[points.length - 1].x}
        cy={points[points.length - 1].y}
        r="3"
        fill={color}
      />
    </svg>
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

  const ringConfig = useMemo(() => {
    const configs: Record<RingType, {
      title: string;
      icon: typeof Heart;
      color: string;
      gradient: string;
      description: string;
      unit: string;
    }> = {
      mood: {
        title: t.mood || 'Mood',
        icon: Heart,
        color: 'hsl(var(--chart-mood))',
        gradient: 'from-pink-500 to-rose-500',
        description: t.ringDetailMoodDesc || 'Your emotional wellbeing over the past week',
        unit: '%',
      },
      habits: {
        title: t.habits || 'Habits',
        icon: Target,
        color: 'hsl(var(--chart-habit))',
        gradient: 'from-emerald-500 to-teal-500',
        description: t.ringDetailHabitsDesc || 'Daily habit completion rate',
        unit: '%',
      },
      focus: {
        title: t.focus || 'Focus',
        icon: Brain,
        color: 'hsl(var(--chart-focus))',
        gradient: 'from-blue-500 to-indigo-500',
        description: t.ringDetailFocusDesc || 'Focus session productivity',
        unit: '%',
      },
    };
    return ringType ? configs[ringType] : null;
  }, [ringType, t]);

  // Calculate trend
  const trend = useMemo(() => {
    if (weeklyData.length < 2) return 0;
    const recent = weeklyData.slice(-3);
    const older = weeklyData.slice(0, 3);
    const recentAvg = recent.reduce((a, b) => a + b.value, 0) / recent.length;
    const olderAvg = older.reduce((a, b) => a + b.value, 0) / older.length;
    return recentAvg - olderAvg;
  }, [weeklyData]);

  const dayNames = [t.sun, t.mon, t.tue, t.wed, t.thu, t.fri, t.sat];

  if (!ringConfig || !ringType) return null;

  const Icon = ringConfig.icon;
  const sparklineData = weeklyData.map(d => d.value);

  return (
    <Sheet open={open} onOpenChange={onOpenChange}>
      <SheetContent side="bottom" className="rounded-t-3xl max-h-[80vh] overflow-y-auto">
        <SheetHeader className="text-left pb-4">
          <div className="flex items-center gap-3">
            <motion.div
              className={cn("p-3 rounded-2xl bg-gradient-to-br", ringConfig.gradient)}
              initial={{ scale: 0.8, opacity: 0 }}
              animate={{ scale: 1, opacity: 1 }}
              transition={{ type: 'spring', duration: 0.5 }}
            >
              <Icon className="w-6 h-6 text-white" />
            </motion.div>
            <div>
              <SheetTitle className="text-xl">{ringConfig.title}</SheetTitle>
              <p className="text-sm text-muted-foreground">{ringConfig.description}</p>
            </div>
          </div>
        </SheetHeader>

        {/* Current Value Display */}
        <motion.div
          className="flex items-center justify-between p-4 rounded-2xl bg-muted/50 mb-4"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.1 }}
        >
          <div>
            <p className="text-sm text-muted-foreground">{t.ringDetailToday || 'Today'}</p>
            <p className="text-3xl font-bold" style={{ color: ringConfig.color }}>
              {Math.round(currentValue)}{ringConfig.unit}
            </p>
          </div>

          {/* Trend indicator */}
          <div className={cn(
            "flex items-center gap-1 px-3 py-1.5 rounded-full text-sm font-medium",
            trend > 5 && "bg-green-500/10 text-green-600 dark:text-green-400",
            trend < -5 && "bg-red-500/10 text-red-600 dark:text-red-400",
            trend >= -5 && trend <= 5 && "bg-muted text-muted-foreground"
          )}>
            {trend > 5 ? (
              <>
                <TrendingUp className="w-4 h-4" />
                <span>+{Math.round(trend)}%</span>
              </>
            ) : trend < -5 ? (
              <>
                <TrendingDown className="w-4 h-4" />
                <span>{Math.round(trend)}%</span>
              </>
            ) : (
              <>
                <Minus className="w-4 h-4" />
                <span>{t.stable || 'Stable'}</span>
              </>
            )}
          </div>
        </motion.div>

        {/* Weekly Sparkline */}
        <motion.div
          className="mb-6"
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.2 }}
        >
          <p className="text-sm font-medium text-foreground mb-3">
            {t.ringDetailWeekTrend || 'This Week'}
          </p>
          <div className="flex items-end justify-between gap-2">
            <MiniSparkline data={sparklineData} color={ringConfig.color} />
            <div className="flex-1" />
          </div>
        </motion.div>

        {/* Day-by-day breakdown */}
        <motion.div
          initial={{ y: 20, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.3 }}
        >
          <p className="text-sm font-medium text-foreground mb-3">
            {t.ringDetailDayByDay || 'Day by Day'}
          </p>
          <div className="grid grid-cols-7 gap-2">
            {weeklyData.slice(-7).map((day, idx) => {
              const dayOfWeek = new Date(day.date).getDay();
              const isToday = day.date === new Date().toISOString().split('T')[0];

              return (
                <motion.div
                  key={day.date}
                  className={cn(
                    "text-center p-2 rounded-xl transition-colors",
                    isToday ? "bg-primary/10 ring-2 ring-primary/30" : "bg-muted/30"
                  )}
                  initial={{ scale: 0.8, opacity: 0 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ delay: 0.3 + idx * 0.05 }}
                >
                  <p className="text-xs text-muted-foreground mb-1">
                    {dayNames[dayOfWeek]?.slice(0, 2)}
                  </p>
                  <div
                    className="w-full aspect-square rounded-lg flex items-center justify-center text-xs font-bold text-white mb-1"
                    style={{
                      backgroundColor: ringConfig.color,
                      opacity: 0.3 + (day.value / 100) * 0.7
                    }}
                  >
                    {Math.round(day.value)}
                  </div>
                </motion.div>
              );
            })}
          </div>
        </motion.div>

        {/* Average comparison */}
        {average !== undefined && (
          <motion.div
            className="mt-6 p-4 rounded-2xl bg-muted/30 border border-border"
            initial={{ y: 20, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            transition={{ delay: 0.4 }}
          >
            <div className="flex items-center justify-between">
              <p className="text-sm text-muted-foreground">
                {t.ringDetailVsAverage || 'vs Weekly Average'}
              </p>
              <p className={cn(
                "font-bold",
                currentValue > average ? "text-green-600 dark:text-green-400" :
                currentValue < average ? "text-red-600 dark:text-red-400" :
                "text-muted-foreground"
              )}>
                {currentValue > average ? '+' : ''}{Math.round(currentValue - average)}%
              </p>
            </div>
            <div className="mt-2 h-2 rounded-full bg-muted overflow-hidden">
              <motion.div
                className="h-full rounded-full"
                style={{ backgroundColor: ringConfig.color }}
                initial={{ width: 0 }}
                animate={{ width: `${Math.min(currentValue, 100)}%` }}
                transition={{ delay: 0.5, duration: 0.5 }}
              />
            </div>
          </motion.div>
        )}
      </SheetContent>
    </Sheet>
  );
}

export default RingDetailSheet;
