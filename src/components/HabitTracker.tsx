import { useState } from 'react';
import { Habit, HabitType, HabitReminder } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Minus, Bell } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { habitTemplates } from '@/lib/habitTemplates';

const habitIcons = ['💧', '🏃', '📚', '🧘', '💊', '🥗', '😴', '✍️', '🎵', '🌿'];
const habitColors = [
  'bg-primary',
  'bg-accent', 
  'bg-mood-good',
  'bg-mood-okay',
  'bg-mood-great',
];

interface HabitTrackerProps {
  habits: Habit[];
  onToggleHabit: (habitId: string, date: string) => void;
  onAdjustHabit?: (habitId: string, date: string, delta: number) => void;
  onAddHabit: (habit: Habit) => void;
  onDeleteHabit: (habitId: string) => void;
}

export function HabitTracker({ habits, onToggleHabit, onAdjustHabit, onAddHabit, onDeleteHabit }: HabitTrackerProps) {
  const { t, language } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  const [selectedType, setSelectedType] = useState<HabitType>('daily');
  const [dailyTarget, setDailyTarget] = useState(1);
  const [reminders, setReminders] = useState<HabitReminder[]>([]);
  const [showReminderConfig, setShowReminderConfig] = useState(false);

  const today = getToday();

  const handleAddReminder = () => {
    setReminders([...reminders, {
      enabled: true,
      time: '09:00',
      days: [1, 2, 3, 4, 5] // Mon-Fri by default
    }]);
  };

  const handleRemoveReminder = (index: number) => {
    setReminders(reminders.filter((_, i) => i !== index));
  };

  const handleReminderChange = (index: number, field: keyof HabitReminder, value: any) => {
    const updated = [...reminders];
    updated[index] = { ...updated[index], [field]: value };
    setReminders(updated);
  };

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;

    const habit: Habit = {
      id: generateId(),
      name: newHabitName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      completedDates: [],
      createdAt: Date.now(),
      type: selectedType,
      reminders: reminders,
      ...(selectedType === 'multiple' && { dailyTarget, completionsByDate: {} }),
      ...(selectedType === 'continuous' && { startDate: today, failedDates: [] }),
      ...(selectedType === 'reduce' && { progressByDate: {}, targetCount: dailyTarget }),
    };

    onAddHabit(habit);
    setNewHabitName('');
    setSelectedType('daily');
    setDailyTarget(1);
    setReminders([]);
    setShowReminderConfig(false);
    setIsAdding(false);
  };

  const isCompletedToday = (habit: Habit) => {
    const habitType = habit.type || 'daily';

    if (habitType === 'reduce') {
      const progress = habit.progressByDate?.[today];
      return progress === 0;
    }

    if (habitType === 'multiple') {
      const completions = habit.completionsByDate?.[today] ?? 0;
      const target = habit.dailyTarget ?? 1;
      return completions >= target;
    }

    if (habitType === 'continuous') {
      // Continuous habits are "complete" if no failure today
      return !(habit.failedDates?.includes(today));
    }

    return habit.completedDates.includes(today);
  };

  const getProgress = (habit: Habit) => {
    const habitType = habit.type || 'daily';

    if (habitType === 'reduce') {
      return habit.progressByDate?.[today] ?? 0;
    }

    if (habitType === 'multiple') {
      return habit.completionsByDate?.[today] ?? 0;
    }

    if (habitType === 'continuous') {
      // Calculate days since start without failure
      if (!habit.startDate) return 0;
      const start = new Date(habit.startDate);
      const now = new Date();
      const daysSinceStart = Math.floor((now.getTime() - start.getTime()) / (1000 * 60 * 60 * 24));
      const failureCount = habit.failedDates?.length ?? 0;
      return Math.max(0, daysSinceStart - failureCount);
    }

    return 0;
  };

  return (
    <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-foreground">{t.habits}</h3>
        <button
          onClick={() => setIsAdding(!isAdding)}
          className={cn(
            "btn-press p-2 rounded-full transition-all",
            isAdding ? "bg-destructive text-destructive-foreground rotate-45" : "bg-primary text-primary-foreground"
          )}
        >
          <Plus className="w-5 h-5" />
        </button>
      </div>

      {isAdding && (
        <div className="mb-4 p-4 bg-secondary rounded-xl animate-scale-in">
          <input
            type="text"
            value={newHabitName}
            onChange={(e) => setNewHabitName(e.target.value)}
            placeholder={t.habitName}
            className="w-full p-3 bg-background rounded-lg text-foreground placeholder:text-muted-foreground focus:outline-none focus:ring-2 focus:ring-primary/30 mb-3"
          />
          
          <div className="mb-3">
            <p className="text-sm text-muted-foreground mb-2">{t.icon}:</p>
            <div className="flex gap-2 flex-wrap">
              {habitIcons.map((icon) => (
                <button
                  key={icon}
                  onClick={() => setSelectedIcon(icon)}
                  className={cn(
                    "btn-press w-10 h-10 rounded-lg flex items-center justify-center text-xl transition-all",
                    selectedIcon === icon ? "bg-primary/20 ring-2 ring-primary" : "bg-background hover:bg-muted"
                  )}
                >
                  {icon}
                </button>
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">{t.color}:</p>
            <div className="flex gap-2">
              {habitColors.map((color) => (
                <button
                  key={color}
                  onClick={() => setSelectedColor(color)}
                  className={cn(
                    "btn-press w-8 h-8 rounded-full transition-all",
                    color,
                    selectedColor === color ? "ring-2 ring-offset-2 ring-foreground" : ""
                  )}
                />
              ))}
            </div>
          </div>

          <div className="mb-4">
            <p className="text-sm text-muted-foreground mb-2">{t.habitType}:</p>
            <div className="grid grid-cols-2 gap-2">
              <button
                onClick={() => setSelectedType('daily')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'daily' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeDaily}
              </button>
              <button
                onClick={() => setSelectedType('scheduled')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'scheduled' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeScheduled}
              </button>
              <button
                onClick={() => setSelectedType('multiple')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'multiple' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeMultiple}
              </button>
              <button
                onClick={() => setSelectedType('continuous')}
                className={cn(
                  "btn-press p-2 rounded-lg text-sm transition-all",
                  selectedType === 'continuous' ? "bg-primary text-primary-foreground" : "bg-background hover:bg-muted"
                )}
              >
                {t.habitTypeContinuous}
              </button>
            </div>
          </div>

          {(selectedType === 'multiple' || selectedType === 'reduce') && (
            <div className="mb-4">
              <label className="text-sm text-muted-foreground mb-2 block">{t.habitDailyTarget}:</label>
              <input
                type="number"
                min="1"
                max="50"
                value={dailyTarget}
                onChange={(e) => setDailyTarget(parseInt(e.target.value) || 1)}
                className="w-full p-2 bg-background rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              />
            </div>
          )}

          <div className="mb-4">
            <div className="flex items-center justify-between mb-2">
              <p className="text-sm text-muted-foreground">{t.habitReminders}:</p>
              <button
                onClick={handleAddReminder}
                className="btn-press p-1 rounded-lg bg-primary/10 text-primary hover:bg-primary/20 transition-colors"
              >
                <Plus className="w-4 h-4" />
              </button>
            </div>
            {reminders.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">No reminders yet</p>
            ) : (
              <div className="space-y-2">
                {reminders.map((reminder, idx) => (
                  <div key={idx} className="flex items-center gap-2 p-2 bg-background rounded-lg">
                    <Bell className="w-4 h-4 text-muted-foreground" />
                    <input
                      type="time"
                      value={reminder.time}
                      onChange={(e) => handleReminderChange(idx, 'time', e.target.value)}
                      className="flex-1 p-1 bg-transparent text-sm text-foreground focus:outline-none"
                    />
                    <button
                      onClick={() => handleRemoveReminder(idx)}
                      className="p-1 text-destructive hover:bg-destructive/10 rounded transition-colors"
                    >
                      <X className="w-4 h-4" />
                    </button>
                  </div>
                ))}
              </div>
            )}
          </div>

          <button
            onClick={handleAddHabit}
            disabled={!newHabitName.trim()}
            className="btn-press w-full py-2 zen-gradient text-primary-foreground font-medium rounded-lg disabled:opacity-50 transition-opacity"
          >
            {t.addHabit}
          </button>
        </div>
      )}

      {habits.length === 0 ? (
        <p className="text-center text-muted-foreground py-8">
          {t.addFirstHabit}
        </p>
      ) : (
        <div className="space-y-3">
          {habits.map((habit) => {
            const completed = isCompletedToday(habit);
            const habitType = habit.type || 'daily';
            const progress = getProgress(habit);

            return (
              <div
                key={habit.id}
                className="flex items-center gap-3 p-3 bg-secondary rounded-xl group"
              >
                {habitType === 'reduce' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onAdjustHabit?.(habit.id, today, -1)}
                      className="btn-press w-8 h-8 rounded-lg bg-primary/10 flex items-center justify-center text-primary hover:bg-primary/20 transition-colors"
                    >
                      <Minus className="w-4 h-4" />
                    </button>
                    <span className={cn(
                      "w-8 text-center font-bold",
                      progress === 0 ? "text-mood-good" : "text-foreground"
                    )}>
                      {progress}
                    </span>
                    <button
                      onClick={() => onAdjustHabit?.(habit.id, today, 1)}
                      className="btn-press w-8 h-8 rounded-lg bg-secondary flex items-center justify-center text-muted-foreground hover:bg-muted transition-colors"
                    >
                      <Plus className="w-4 h-4" />
                    </button>
                  </div>
                ) : habitType === 'multiple' ? (
                  <div className="flex items-center gap-2">
                    <button
                      onClick={() => onToggleHabit(habit.id, today)}
                      className={cn(
                        "btn-press w-10 h-10 rounded-xl flex items-center justify-center text-xl transition-all",
                        completed
                          ? `${habit.color} text-primary-foreground zen-shadow-soft`
                          : "bg-background hover:opacity-80"
                      )}
                    >
                      {habit.icon}
                    </button>
                    <span className="text-sm font-medium">
                      {progress}/{habit.dailyTarget ?? 1}
                    </span>
                  </div>
                ) : habitType === 'continuous' ? (
                  <div className="flex flex-col items-center">
                    <div className={cn(
                      "w-12 h-12 rounded-xl flex items-center justify-center text-2xl",
                      `${habit.color} text-primary-foreground zen-shadow-soft`
                    )}>
                      {habit.icon}
                    </div>
                    <span className="text-xs font-bold text-mood-good mt-1">{progress}d</span>
                  </div>
                ) : (
                  <button
                    onClick={() => onToggleHabit(habit.id, today)}
                    className={cn(
                      "btn-press w-12 h-12 rounded-xl flex items-center justify-center text-2xl transition-all",
                      completed
                        ? `${habit.color} text-primary-foreground zen-shadow-soft`
                        : "bg-background hover:opacity-80"
                    )}
                  >
                    {completed ? <Check className="w-6 h-6" /> : habit.icon}
                  </button>
                )}
                <div className="flex-1">
                  <p className={cn(
                    "font-medium transition-all",
                    completed && habitType !== 'continuous' ? "text-muted-foreground line-through" : "text-foreground"
                  )}>
                    {habit.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {habitType === 'continuous'
                      ? `${progress} ${t.days} streak`
                      : `${t.completedTimes} ${habit.completedDates.length} ${t.completedTimes2}`
                    }
                  </p>
                  {habit.reminders && habit.reminders.length > 0 && (
                    <div className="flex items-center gap-1 mt-1">
                      <Bell className="w-3 h-3 text-muted-foreground" />
                      <span className="text-xs text-muted-foreground">
                        {habit.reminders.map(r => r.time).join(', ')}
                      </span>
                    </div>
                  )}
                </div>
                <button
                  onClick={() => onDeleteHabit(habit.id)}
                  className="p-2 opacity-0 group-hover:opacity-100 text-destructive hover:bg-destructive/10 rounded-lg transition-all"
                >
                  <X className="w-4 h-4" />
                </button>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}
