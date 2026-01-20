import { useState, useEffect, useCallback } from 'react';
import { Plus, Zap, Clock, Star, Calendar, Trash2, CheckCircle2, Circle, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { playSuccess, playStreakMilestone } from '@/lib/audioManager';
import {
  Task,
  PrioritizedTask,
  prioritizeForADHD,
  getNextThreeTasks,
  calculateMomentumBonus,
  getTwoMinuteTasks,
} from '@/lib/taskMomentum';
import { pushTasksToCloud } from '@/storage/tasksCloudSync';

const STORAGE_KEY = 'zenflow_tasks';
const MOMENTUM_KEY = 'zenflow_task_momentum';

interface TasksPanelProps {
  onClose?: () => void;
  onAwardXp?: (source: string, amount: number) => void;
  onEarnTreats?: (source: string, amount: number, reason: string) => void;
}

export function TasksPanel({ onClose, onAwardXp, onEarnTreats }: TasksPanelProps) {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState(15);
  const [newTaskUrgent, setNewTaskUrgent] = useState(false);
  const [newTaskInterest, setNewTaskInterest] = useState(5);
  const [consecutiveCompletions, setConsecutiveCompletions] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);

  // Load tasks from localStorage on mount
  useEffect(() => {
    const storedTasks = localStorage.getItem(STORAGE_KEY);
    if (storedTasks) {
      try {
        const parsed = JSON.parse(storedTasks);
        setTasks(Array.isArray(parsed) ? parsed : []);
      } catch (error) {
        console.error('[TasksPanel] Failed to parse stored tasks:', error);
      }
    }

    const storedMomentum = localStorage.getItem(MOMENTUM_KEY);
    if (storedMomentum) {
      try {
        const parsed = JSON.parse(storedMomentum);
        // Reset momentum if last completion was more than 30 minutes ago
        if (parsed.lastCompletion && Date.now() - parsed.lastCompletion < 30 * 60 * 1000) {
          setConsecutiveCompletions(parsed.count || 0);
        }
      } catch (error) {
        console.error('[TasksPanel] Failed to parse momentum:', error);
      }
    }
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    localStorage.setItem(STORAGE_KEY, JSON.stringify(tasks));
    pushTasksToCloud(tasks).catch(console.error);
  }, [tasks]);

  // Save momentum state
  useEffect(() => {
    localStorage.setItem(MOMENTUM_KEY, JSON.stringify({
      count: consecutiveCompletions,
      lastCompletion: consecutiveCompletions > 0 ? Date.now() : null,
    }));
  }, [consecutiveCompletions]);

  const prioritizedTasks = prioritizeForADHD(tasks);
  const topThree = getNextThreeTasks(tasks);
  const categorized = getTwoMinuteTasks(tasks);
  const momentumBonus = calculateMomentumBonus(consecutiveCompletions);

  const handleAddTask = useCallback(() => {
    if (!newTaskName.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      name: newTaskName.trim(),
      urgent: newTaskUrgent,
      estimatedMinutes: newTaskMinutes,
      userRating: newTaskInterest,
      completed: false,
    };

    setTasks(prev => [...prev, newTask]);
    setNewTaskName('');
    setNewTaskMinutes(15);
    setNewTaskUrgent(false);
    setNewTaskInterest(5);
    setShowAddForm(false);
  }, [newTaskName, newTaskMinutes, newTaskUrgent, newTaskInterest]);

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;

      const newCompleted = !task.completed;

      if (newCompleted) {
        // Increment momentum
        setConsecutiveCompletions(c => {
          const newCount = c + 1;

          // Calculate rewards with momentum bonus
          const bonus = calculateMomentumBonus(newCount);
          const baseXp = 15;
          const totalXp = Math.round(baseXp * bonus.streakMultiplier);

          // Award XP through gamification system
          if (onAwardXp) {
            onAwardXp('task', totalXp);
          }

          // Award treats for companion
          if (onEarnTreats) {
            onEarnTreats('task', totalXp, `Task: ${task.name}`);
          }

          // Play sound (streak milestone at 3, 5, 10)
          if (newCount === 3 || newCount === 5 || newCount % 10 === 0) {
            playStreakMilestone();
          } else {
            playSuccess();
          }

          return newCount;
        });
      } else {
        // Reset momentum when uncompleting
        setConsecutiveCompletions(0);
      }

      return { ...task, completed: newCompleted };
    }));
  }, [onAwardXp, onEarnTreats]);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  const renderTaskCard = (task: PrioritizedTask, index?: number) => {
    const isTopThree = index !== undefined && index < 3;

    return (
      <div
        key={task.id}
        className={cn(
          'p-4 rounded-xl transition-all duration-300 animate-fade-in',
          task.completed
            ? 'bg-primary/5 opacity-70 scale-95'
            : isTopThree
            ? 'zen-gradient-card zen-shadow-soft border-2 border-primary/30 hover:zen-shadow'
            : 'bg-card border border-border hover:border-primary/30 hover:zen-shadow-soft'
        )}
      >
        <div className="flex items-start gap-3">
          <button
            onClick={() => handleToggleTask(task.id)}
            className={cn(
              'mt-1 flex-shrink-0 transition-colors',
              task.completed ? 'text-primary' : 'text-muted-foreground hover:text-primary'
            )}
          >
            {task.completed ? (
              <CheckCircle2 className="w-5 h-5" />
            ) : (
              <Circle className="w-5 h-5" />
            )}
          </button>

          <div className="flex-1 min-w-0">
            <div className="flex items-start justify-between gap-2">
              <h4 className={cn(
                'font-medium',
                task.completed && 'line-through text-muted-foreground'
              )}>
                {task.name}
              </h4>
              {isTopThree && !task.completed && (
                <span className="flex-shrink-0 px-2 py-1 text-xs font-bold zen-gradient text-white rounded-full">
                  Top {index! + 1}
                </span>
              )}
            </div>

            <div className="flex flex-wrap gap-2 mt-2">
              {task.urgent && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-destructive/10 text-destructive rounded-md text-xs font-medium">
                  <Zap className="w-3 h-3" />
                  {t.urgent || 'Urgent'}
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                <Clock className="w-3 h-3" />
                {task.estimatedMinutes} {t.min || 'min'}
              </span>
              {task.userRating && task.userRating >= 7 && (
                <span className="inline-flex items-center gap-1 px-2 py-1 bg-yellow-500/10 text-yellow-700 dark:text-yellow-400 rounded-md text-xs">
                  <Star className="w-3 h-3" />
                  {task.userRating}/10
                </span>
              )}
            </div>

            {!task.completed && (
              <div className="mt-2 space-y-1">
                <p className="text-xs text-muted-foreground">
                  {task.reasoning}
                </p>
                <p className="text-xs font-medium text-primary">
                  {task.encouragement}
                </p>
              </div>
            )}
          </div>

          <button
            onClick={() => handleDeleteTask(task.id)}
            className="flex-shrink-0 p-1 text-muted-foreground hover:text-destructive transition-colors"
          >
            <Trash2 className="w-4 h-4" />
          </button>
        </div>
      </div>
    );
  };

  return (
    <div className="fixed inset-0 z-50 bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold zen-text-gradient">{t.taskMomentum || 'Task Momentum'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {t.taskMomentumDesc || 'ADHD-friendly task prioritization'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => setShowAddForm(!showAddForm)}
              className={cn(
                'p-3 rounded-xl transition-all zen-shadow-soft',
                showAddForm
                  ? 'bg-muted text-foreground'
                  : 'zen-gradient text-white hover:opacity-90'
              )}
            >
              <Plus className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Momentum Bonus */}
        {consecutiveCompletions > 0 && (
          <div className="p-4 zen-gradient rounded-xl zen-shadow animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔥</div>
              <div className="flex-1">
                <div className="text-white font-bold">
                  {momentumBonus.message}
                </div>
                <div className="text-white/80 text-sm mt-1">
                  {consecutiveCompletions} {t.tasksInARow || 'tasks in a row'} • +{Math.round(15 * momentumBonus.streakMultiplier)} XP • {momentumBonus.streakMultiplier}x
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Form */}
        {showAddForm && (
          <div className="p-4 bg-card rounded-xl border-2 border-primary/30 zen-shadow-card animate-scale-in space-y-4">
            <input
              type="text"
              value={newTaskName}
              onChange={(e) => setNewTaskName(e.target.value)}
              placeholder={t.taskNamePlaceholder || 'Task name...'}
              className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
              autoFocus
              onKeyDown={(e) => e.key === 'Enter' && handleAddTask()}
            />

            <div className="grid grid-cols-2 gap-3">
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t.durationMinutes || 'Duration (minutes)'}
                </label>
                <input
                  type="number"
                  value={newTaskMinutes}
                  onChange={(e) => setNewTaskMinutes(parseInt(e.target.value) || 0)}
                  min="1"
                  max="480"
                  className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
              <div>
                <label className="text-xs text-muted-foreground mb-1 block">
                  {t.interestLevel || 'Interest (1-10)'}
                </label>
                <input
                  type="number"
                  value={newTaskInterest}
                  onChange={(e) => setNewTaskInterest(Math.min(10, Math.max(1, parseInt(e.target.value) || 5)))}
                  min="1"
                  max="10"
                  className="w-full p-2 bg-secondary rounded-lg text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
                />
              </div>
            </div>

            <label className="flex items-center gap-2 cursor-pointer">
              <input
                type="checkbox"
                checked={newTaskUrgent}
                onChange={(e) => setNewTaskUrgent(e.target.checked)}
                className="w-4 h-4"
              />
              <span className="text-sm text-foreground">{t.markAsUrgent || 'Mark as urgent'}</span>
            </label>

            <div className="flex gap-2">
              <button
                onClick={handleAddTask}
                disabled={!newTaskName.trim()}
                className="flex-1 py-3 zen-gradient text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {t.addTask || 'Add Task'}
              </button>
              <button
                onClick={() => setShowAddForm(false)}
                className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
              >
                {t.cancel || 'Cancel'}
              </button>
            </div>
          </div>
        )}

        {/* Top 3 Recommended Tasks */}
        {topThree.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {t.topRecommendedTasks || 'Top 3 Recommended Tasks'}
              </h3>
            </div>
            <div className="space-y-3">
              {topThree.map((task, index) => renderTaskCard(task, index))}
            </div>
          </div>
        )}

        {/* Quick Wins (2-minute tasks) */}
        {categorized.immediate.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {t.quickWins || 'Quick Wins (Under 2 min)'}
              </h3>
            </div>
            <div className="space-y-2">
              {categorized.immediate.map(task => renderTaskCard(task))}
            </div>
          </div>
        )}

        {/* All Tasks */}
        {prioritizedTasks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">{t.allTasks || 'All Tasks'}</h3>
            <div className="space-y-2">
              {prioritizedTasks.map(task => renderTaskCard(task))}
            </div>
          </div>
        )}

        {/* Empty State */}
        {tasks.length === 0 && !showAddForm && (
          <div className="text-center py-12">
            <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center">
              <Calendar className="w-8 h-8 text-primary" />
            </div>
            <h3 className="text-lg font-semibold mb-2">{t.noTasksYet || 'No tasks yet'}</h3>
            <p className="text-muted-foreground mb-4">
              {t.addFirstTaskMessage || 'Add your first task to get started with Task Momentum!'}
            </p>
            <button
              onClick={() => setShowAddForm(true)}
              className="px-6 py-3 zen-gradient text-white rounded-xl font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
            >
              <Plus className="w-5 h-5" />
              {t.addFirstTask || 'Add Your First Task'}
            </button>
          </div>
        )}

        {/* ADHD Tips */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-sm">
              <div className="font-medium mb-1">{t.adhdTaskTips || 'ADHD Task Tips'}</div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>{t.taskTip1 || 'Start with quick wins (2-5 min tasks)'}</li>
                <li>{t.taskTip2 || 'Build momentum with consecutive completions'}</li>
                <li>{t.taskTip3 || 'High interest tasks give more dopamine'}</li>
                <li>{t.taskTip4 || 'Urgent + short = perfect combo'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
