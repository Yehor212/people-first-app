import { useState } from 'react';
import { Habit } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Plus, Check, X, Minus } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

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
  const { t } = useLanguage();
  const [isAdding, setIsAdding] = useState(false);
  const [newHabitName, setNewHabitName] = useState('');
  const [selectedIcon, setSelectedIcon] = useState(habitIcons[0]);
  const [selectedColor, setSelectedColor] = useState(habitColors[0]);
  
  const today = getToday();

  const handleAddHabit = () => {
    if (!newHabitName.trim()) return;
    
    const habit: Habit = {
      id: generateId(),
      name: newHabitName.trim(),
      icon: selectedIcon,
      color: selectedColor,
      completedDates: [],
      createdAt: Date.now(),
    };
    
    onAddHabit(habit);
    setNewHabitName('');
    setIsAdding(false);
  };

  const isCompletedToday = (habit: Habit) => {
    if ((habit.type || 'daily') === 'reduce') {
      const progress = habit.progressByDate?.[today];
      return progress === 0;
    }
    return habit.completedDates.includes(today);
  };

  const getProgress = (habit: Habit) => {
    if ((habit.type || 'daily') === 'reduce') {
      return habit.progressByDate?.[today] ?? 0;
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
            const isReduce = (habit.type || 'daily') === 'reduce';
            const progress = getProgress(habit);
            
            return (
              <div
                key={habit.id}
                className="flex items-center gap-3 p-3 bg-secondary rounded-xl group"
              >
                {isReduce ? (
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
                    completed ? "text-muted-foreground line-through" : "text-foreground"
                  )}>
                    {habit.name}
                  </p>
                  <p className="text-xs text-muted-foreground">
                    {t.completedTimes} {habit.completedDates.length} {t.completedTimes2}
                  </p>
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
