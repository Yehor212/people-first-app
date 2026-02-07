import { useEffect, useState, useMemo } from 'react';
import { Flame, Clock, Trophy, Check, Circle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWidgetData } from '@/hooks/useWidgetSync';
import { cn } from '@/lib/utils';
import type { WidgetData } from '@/plugins/WidgetPlugin';

interface WidgetPreviewProps {
  data?: WidgetData;
}

/**
 * Generate a smart insight message based on current stats
 */
function getSmartInsight(
  streak: number,
  habitsToday: number,
  habitsTotalToday: number,
  focusMinutes: number,
  lastBadge?: string
): string {
  // Badge announcement
  if (lastBadge) {
    return `🏆 ${lastBadge}`;
  }

  // Streak milestones
  if (streak === 7) return '🎉 1 week streak!';
  if (streak === 14) return '🔥 2 weeks strong!';
  if (streak === 30) return '🏆 30 day champion!';
  if (streak === 100) return '💯 100 day legend!';

  // Focus milestones
  if (focusMinutes >= 120) return '🧠 Deep focus master!';
  if (focusMinutes >= 60) return '⚡ 1 hour focused!';

  // Completion status
  if (habitsTotalToday > 0 && habitsToday === habitsTotalToday) {
    return '✨ All habits done!';
  }

  const remaining = habitsTotalToday - habitsToday;
  if (remaining === 1) {
    return '🎯 1 habit to go!';
  }
  if (remaining > 1 && remaining <= 3) {
    return `💪 ${remaining} habits left`;
  }

  if (habitsToday === 0 && habitsTotalToday > 0) {
    return '🚀 Start your day!';
  }

  // Default based on streak
  if (streak > 0) {
    return '🔥 Keep going!';
  }

  return '';
}

/**
 * Stat Card component for widgets
 */
function StatCard({
  icon,
  value,
  label,
  colorClass,
  bgClass,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorClass: string;
  bgClass: string;
}) {
  return (
    <div className={cn('flex flex-col items-center justify-center rounded-xl p-3 border', bgClass)}>
      <div className={colorClass}>{icon}</div>
      <div className={cn('text-xl font-bold mt-1', colorClass)}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Progress indicator for habits
 */
function HabitsProgress({ done, total }: { done: number; total: number }) {
  const percentage = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full bg-emerald-500 rounded-full transition-all duration-500 ease-out"
          style={{ width: `${percentage}%` }}
        />
      </div>
    </div>
  );
}

export function WidgetPreview({ data: providedData }: WidgetPreviewProps) {
  const { t } = useLanguage();
  const widgetData = useWidgetData();
  const [data, setData] = useState<WidgetData | null>(null);

  useEffect(() => {
    if (providedData) {
      setData(providedData);
    } else if (widgetData) {
      setData(widgetData);
    }
  }, [providedData, widgetData]);

  // Generate insights for each widget
  const smallInsight = useMemo(() => {
    if (!data) return '';
    return getSmartInsight(data.streak, data.habitsToday, data.habitsTotalToday, 0);
  }, [data]);

  const mediumInsight = useMemo(() => {
    if (!data) return '';
    return getSmartInsight(data.streak, data.habitsToday, data.habitsTotalToday, data.focusMinutes);
  }, [data]);

  const largeInsight = useMemo(() => {
    if (!data) return '';
    return getSmartInsight(
      data.streak,
      data.habitsToday,
      data.habitsTotalToday,
      data.focusMinutes,
      data.lastBadge
    );
  }, [data]);

  if (!data) {
    return (
      <div className="bg-card rounded-2xl p-6 text-center border border-border">
        <p className="text-sm text-muted-foreground">
          {t.widgetNoData}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Small Widget Preview (2x2) */}
      <div className="bg-card rounded-3xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.widgetSmall}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">2×2</span>
        </div>

        <div className="grid grid-cols-2 gap-2">
          {/* Streak Card */}
          <StatCard
            icon={<span className="text-lg">🔥</span>}
            value={data.streak}
            label={t.days}
            colorClass="text-orange-500"
            bgClass="bg-orange-500/10 border-orange-500/20"
          />

          {/* Habits Card */}
          <StatCard
            icon={<span className="text-lg font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorClass="text-emerald-500"
            bgClass="bg-emerald-500/10 border-emerald-500/20"
          />
        </div>

        {/* Smart Insight */}
        {smallInsight && (
          <div className="mt-3 text-center">
            <span className="text-xs text-muted-foreground">{smallInsight}</span>
          </div>
        )}
      </div>

      {/* Medium Widget Preview (4x2) */}
      <div className="bg-card rounded-3xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.widgetMedium}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">4×2</span>
        </div>

        <div className="grid grid-cols-3 gap-2">
          {/* Streak */}
          <StatCard
            icon={<span className="text-base">🔥</span>}
            value={data.streak}
            label={t.streak}
            colorClass="text-orange-500"
            bgClass="bg-orange-500/10 border-orange-500/20"
          />

          {/* Habits */}
          <StatCard
            icon={<span className="text-base font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorClass="text-emerald-500"
            bgClass="bg-emerald-500/10 border-emerald-500/20"
          />

          {/* Focus */}
          <StatCard
            icon={<span className="text-base">⏱</span>}
            value={data.focusMinutes}
            label={t.minutes}
            colorClass="text-violet-500"
            bgClass="bg-violet-500/10 border-violet-500/20"
          />
        </div>

        {/* Smart Insight */}
        {mediumInsight && (
          <div className="mt-3 text-center">
            <span className="text-xs text-muted-foreground">{mediumInsight}</span>
          </div>
        )}
      </div>

      {/* Large Widget Preview (4x4) */}
      <div className="bg-card rounded-3xl p-4 border border-border shadow-sm">
        <div className="flex items-center justify-between mb-3">
          <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wide">
            {t.widgetLarge}
          </h3>
          <span className="text-xs text-muted-foreground bg-muted px-2 py-0.5 rounded-full">4×4</span>
        </div>

        {/* Stats Row */}
        <div className="grid grid-cols-3 gap-2 mb-3">
          <StatCard
            icon={<span className="text-base">🔥</span>}
            value={data.streak}
            label={t.streak}
            colorClass="text-orange-500"
            bgClass="bg-orange-500/10 border-orange-500/20"
          />

          <StatCard
            icon={<span className="text-base font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorClass="text-emerald-500"
            bgClass="bg-emerald-500/10 border-emerald-500/20"
          />

          <StatCard
            icon={<span className="text-base">⏱</span>}
            value={data.focusMinutes}
            label={t.minutes}
            colorClass="text-violet-500"
            bgClass="bg-violet-500/10 border-violet-500/20"
          />
        </div>

        {/* Habits List */}
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          {(data.habits ?? []).slice(0, 4).map((habit, index) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm',
                  habit.completed ? 'text-emerald-500' : 'text-muted-foreground'
                )}
              >
                {habit.completed ? '✓' : '○'}
              </span>
              <span
                className={cn(
                  'text-sm flex-1 truncate',
                  habit.completed && 'text-muted-foreground'
                )}
              >
                {habit.name}
              </span>
            </div>
          ))}
          {(!data.habits || data.habits.length === 0) && (
            <p className="text-xs text-muted-foreground text-center py-2">
              {t.noHabitsYet}
            </p>
          )}
        </div>

        {/* Badge (if present) */}
        {data.lastBadge && (
          <div className="mt-3 bg-amber-500/10 border border-amber-500/20 rounded-xl p-3 flex items-center gap-2">
            <span className="text-lg">🏆</span>
            <span className="text-sm font-medium text-amber-600 dark:text-amber-400 truncate">
              {data.lastBadge}
            </span>
          </div>
        )}

        {/* Smart Insight */}
        {largeInsight && (
          <div className="mt-3 text-center">
            <span className="text-xs text-muted-foreground">{largeInsight}</span>
          </div>
        )}
      </div>
    </div>
  );
}
