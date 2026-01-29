import { useEffect, useState } from 'react';
import { Flame, Target, Clock, Trophy } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useWidgetData } from '@/hooks/useWidgetSync';
import type { WidgetData } from '@/plugins/WidgetPlugin';

interface WidgetPreviewProps {
  data?: WidgetData;
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

  if (!data) {
    return (
      <div className="bg-muted rounded-2xl p-6 text-center">
        <p className="text-sm text-muted-foreground">
          {t.widgetNoData || 'Нет данных для виджета'}
        </p>
      </div>
    );
  }

  return (
    <div className="space-y-4">
      {/* Small Widget Preview */}
      <div className="bg-gradient-to-br from-primary/10 via-primary/5 to-transparent rounded-2xl p-6 border-2 border-primary/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t.widgetSmall || 'Маленький виджет'}
          </h3>
          <span className="text-xs text-muted-foreground">2x2</span>
        </div>

        <div className="grid grid-cols-2 gap-4">
          {/* Streak */}
          <div className="flex flex-col items-center justify-center bg-background/50 rounded-xl p-3">
            <Flame className="w-6 h-6 text-orange-500 mb-1" />
            <div className="text-2xl font-bold">{data.streak}</div>
            <div className="text-xs text-muted-foreground">{t.streak || 'Стрик'}</div>
          </div>

          {/* Habits */}
          <div className="flex flex-col items-center justify-center bg-background/50 rounded-xl p-3">
            <Target className="w-6 h-6 text-green-500 mb-1" />
            <div className="text-2xl font-bold">
              {data.habitsToday}/{data.habitsTotalToday}
            </div>
            <div className="text-xs text-muted-foreground">{t.habits || 'Привычки'}</div>
          </div>
        </div>
      </div>

      {/* Medium Widget Preview */}
      <div className="bg-gradient-to-br from-purple-500/10 via-pink-500/5 to-transparent rounded-2xl p-6 border-2 border-purple-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t.widgetMedium || 'Средний виджет'}
          </h3>
          <span className="text-xs text-muted-foreground">4x2</span>
        </div>

        <div className="space-y-3">
          {/* Stats Row */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center bg-background/50 rounded-xl p-3">
              <Flame className="w-5 h-5 text-orange-500 mb-1" />
              <div className="text-xl font-bold">{data.streak}</div>
              <div className="text-xs text-muted-foreground">{t.days || 'дней'}</div>
            </div>

            <div className="flex flex-col items-center bg-background/50 rounded-xl p-3">
              <Target className="w-5 h-5 text-green-500 mb-1" />
              <div className="text-xl font-bold">{data.habitsToday}</div>
              <div className="text-xs text-muted-foreground">{t.done || 'готово'}</div>
            </div>

            <div className="flex flex-col items-center bg-background/50 rounded-xl p-3">
              <Clock className="w-5 h-5 text-blue-500 mb-1" />
              <div className="text-xl font-bold">{data.focusMinutes}</div>
              <div className="text-xs text-muted-foreground">{t.minutes || 'мин'}</div>
            </div>
          </div>

          {/* Badge */}
          {data.lastBadge && (
            <div className="flex items-center gap-2 bg-background/50 rounded-xl p-2">
              <Trophy className="w-4 h-4 text-yellow-500" />
              <span className="text-xs font-medium">{data.lastBadge}</span>
            </div>
          )}
        </div>
      </div>

      {/* Large Widget Preview */}
      <div className="bg-gradient-to-br from-blue-500/10 via-cyan-500/5 to-transparent rounded-2xl p-6 border-2 border-blue-500/20">
        <div className="flex items-center justify-between mb-4">
          <h3 className="text-sm font-semibold text-muted-foreground">
            {t.widgetLarge || 'Большой виджет'}
          </h3>
          <span className="text-xs text-muted-foreground">4x4</span>
        </div>

        <div className="space-y-4">
          {/* Stats Grid */}
          <div className="grid grid-cols-3 gap-3">
            <div className="flex flex-col items-center bg-background/50 rounded-xl p-4">
              <Flame className="w-6 h-6 text-orange-500 mb-2" />
              <div className="text-2xl font-bold">{data.streak}</div>
              <div className="text-xs text-muted-foreground">{t.streakDays || 'дней стрика'}</div>
            </div>

            <div className="flex flex-col items-center bg-background/50 rounded-xl p-4">
              <Target className="w-6 h-6 text-green-500 mb-2" />
              <div className="text-2xl font-bold">
                {data.habitsToday}/{data.habitsTotalToday}
              </div>
              <div className="text-xs text-muted-foreground">{t.habitsToday || 'привычек'}</div>
            </div>

            <div className="flex flex-col items-center bg-background/50 rounded-xl p-4">
              <Clock className="w-6 h-6 text-blue-500 mb-2" />
              <div className="text-2xl font-bold">{data.focusMinutes}</div>
              <div className="text-xs text-muted-foreground">{t.focusMinutes || 'минут фокуса'}</div>
            </div>
          </div>

          {/* Habits List */}
          <div className="space-y-2">
            <h4 className="text-xs font-semibold text-muted-foreground mb-2">
              {t.todayHabits || 'Привычки на сегодня'}:
            </h4>
            {(data.habits ?? []).slice(0, 5).map((habit, index) => (
              <div
                key={index}
                className="flex items-center gap-2 bg-background/50 rounded-lg p-2"
              >
                <div
                  className={`w-4 h-4 rounded-full border-2 flex items-center justify-center ${
                    habit.completed
                      ? 'bg-green-500 border-green-500'
                      : 'border-muted-foreground/30'
                  }`}
                >
                  {habit.completed && (
                    <svg
                      className="w-3 h-3 text-white"
                      fill="none"
                      stroke="currentColor"
                      viewBox="0 0 24 24"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={3}
                        d="M5 13l4 4L19 7"
                      />
                    </svg>
                  )}
                </div>
                <span
                  className={`text-sm ${
                    habit.completed ? 'line-through text-muted-foreground' : ''
                  }`}
                >
                  {habit.name}
                </span>
              </div>
            ))}
            {(!data.habits || data.habits.length === 0) && (
              <p className="text-xs text-muted-foreground text-center py-2">
                {t.noHabitsYet || 'Нет привычек'}
              </p>
            )}
          </div>

          {/* Last Badge */}
          {data.lastBadge && (
            <div className="flex items-center gap-3 bg-gradient-to-r from-yellow-500/20 to-orange-500/20 rounded-xl p-3">
              <Trophy className="w-6 h-6 text-yellow-500" />
              <div>
                <div className="text-xs text-muted-foreground">{t.lastBadge || 'Последний бейдж'}</div>
                <div className="text-sm font-semibold">{data.lastBadge}</div>
              </div>
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
