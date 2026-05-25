import { useEffect, useState, useMemo } from 'react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWidgetData } from '@/hooks/useWidgetSync';
import { cn } from '@/lib/utils';
import type { WidgetData } from '@/plugins/WidgetPlugin';

interface WidgetPreviewProps {
  data?: WidgetData;
}

const WIDGET_ACCENTS = {
  orange: {
    text: { color: "hsl(var(--zf-role-energy))" },
    card: {
      color: "hsl(var(--zf-role-energy))",
      backgroundColor: "hsl(var(--zf-role-energy) / 0.10)",
      borderColor: "hsl(var(--zf-role-energy) / 0.20)",
    },
  },
  emerald: {
    text: { color: "hsl(var(--zf-role-gratitude))" },
    card: {
      color: "hsl(var(--zf-role-gratitude))",
      backgroundColor: "hsl(var(--zf-role-gratitude) / 0.10)",
      borderColor: "hsl(var(--zf-role-gratitude) / 0.20)",
    },
  },
  violet: {
    text: { color: "hsl(var(--zf-memory))" },
    card: {
      color: "hsl(var(--zf-memory))",
      backgroundColor: "hsl(var(--zf-memory) / 0.10)",
      borderColor: "hsl(var(--zf-memory) / 0.20)",
    },
  },
  amber: {
    text: { color: "hsl(var(--zf-warning))" },
    card: {
      backgroundColor: "hsl(var(--zf-warning) / 0.10)",
      borderColor: "hsl(var(--zf-warning) / 0.20)",
    },
  },
} as const;

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
  colorStyle,
  cardStyle,
}: {
  icon: React.ReactNode;
  value: string | number;
  label: string;
  colorStyle: React.CSSProperties;
  cardStyle: React.CSSProperties;
}) {
  return (
    <div className="flex flex-col items-center justify-center rounded-xl p-3 border" style={cardStyle}>
      <div style={colorStyle}>{icon}</div>
      <div className="text-xl font-bold mt-1" style={colorStyle}>{value}</div>
      <div className="text-xs text-muted-foreground">{label}</div>
    </div>
  );
}

/**
 * Progress indicator for habits
 */
function _HabitsProgress({ done, total }: { done: number; total: number }) {
  const percentage = total > 0 ? (done / total) * 100 : 0;

  return (
    <div className="w-full">
      <div className="h-1.5 bg-muted rounded-full overflow-hidden">
        <div
          className="h-full rounded-full motion-safe:transition-all motion-safe:duration-500 ease-out"
          style={{ width: `${percentage}%`, backgroundColor: "hsl(var(--zf-role-gratitude))" }}
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
            colorStyle={WIDGET_ACCENTS.orange.text}
            cardStyle={WIDGET_ACCENTS.orange.card}
          />

          {/* Habits Card */}
          <StatCard
            icon={<span className="text-lg font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorStyle={WIDGET_ACCENTS.emerald.text}
            cardStyle={WIDGET_ACCENTS.emerald.card}
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
            colorStyle={WIDGET_ACCENTS.orange.text}
            cardStyle={WIDGET_ACCENTS.orange.card}
          />

          {/* Habits */}
          <StatCard
            icon={<span className="text-base font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorStyle={WIDGET_ACCENTS.emerald.text}
            cardStyle={WIDGET_ACCENTS.emerald.card}
          />

          {/* Focus */}
          <StatCard
            icon={<span className="text-base">⏱</span>}
            value={data.focusMinutes}
            label={t.minutes}
            colorStyle={WIDGET_ACCENTS.violet.text}
            cardStyle={WIDGET_ACCENTS.violet.card}
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
            colorStyle={WIDGET_ACCENTS.orange.text}
            cardStyle={WIDGET_ACCENTS.orange.card}
          />

          <StatCard
            icon={<span className="text-base font-bold text-emerald-500">✓</span>}
            value={`${data.habitsToday}/${data.habitsTotalToday}`}
            label={t.habits}
            colorStyle={WIDGET_ACCENTS.emerald.text}
            cardStyle={WIDGET_ACCENTS.emerald.card}
          />

          <StatCard
            icon={<span className="text-base">⏱</span>}
            value={data.focusMinutes}
            label={t.minutes}
            colorStyle={WIDGET_ACCENTS.violet.text}
            cardStyle={WIDGET_ACCENTS.violet.card}
          />
        </div>

        {/* Habits List */}
        <div className="bg-muted/50 rounded-xl p-3 space-y-2">
          {(data.habits ?? []).slice(0, 4).map((habit, index) => (
            <div key={index} className="flex items-center gap-2">
              <span
                className={cn(
                  'text-sm',
                  habit.completed ? '' : 'text-muted-foreground'
                )}
                style={habit.completed ? WIDGET_ACCENTS.emerald.text : undefined}
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
          <div
            className="mt-3 border rounded-xl p-3 flex items-center gap-2"
            style={WIDGET_ACCENTS.amber.card}
          >
            <span className="text-lg">🏆</span>
            <span className="text-sm font-medium truncate" style={WIDGET_ACCENTS.amber.text}>
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
