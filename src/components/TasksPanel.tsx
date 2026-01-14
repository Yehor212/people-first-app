import { useState } from 'react';
import { Plus, Zap, Clock, Star, Calendar, Trash2, CheckCircle2, Circle } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import {
  Task,
  PrioritizedTask,
  prioritizeForADHD,
  getNextThreeTasks,
  calculateMomentumBonus,
  getTwoMinuteTasks,
} from '@/lib/taskMomentum';

interface TasksPanelProps {
  onClose?: () => void;
}

export function TasksPanel({ onClose }: TasksPanelProps) {
  const { t } = useLanguage();
  const [tasks, setTasks] = useState<Task[]>([]);
  const [newTaskName, setNewTaskName] = useState('');
  const [newTaskMinutes, setNewTaskMinutes] = useState(15);
  const [newTaskUrgent, setNewTaskUrgent] = useState(false);
  const [newTaskInterest, setNewTaskInterest] = useState(5);
  const [consecutiveCompletions, setConsecutiveCompletions] = useState(0);
  const [showAddForm, setShowAddForm] = useState(false);

  const prioritizedTasks = prioritizeForADHD(tasks);
  const topThree = getNextThreeTasks(tasks);
  const categorized = getTwoMinuteTasks(tasks);
  const momentumBonus = calculateMomentumBonus(consecutiveCompletions);

  const handleAddTask = () => {
    if (!newTaskName.trim()) return;

    const newTask: Task = {
      id: Date.now().toString(),
      name: newTaskName.trim(),
      urgent: newTaskUrgent,
      estimatedMinutes: newTaskMinutes,
      userRating: newTaskInterest,
      completed: false,
    };

    setTasks([...tasks, newTask]);
    setNewTaskName('');
    setNewTaskMinutes(15);
    setNewTaskUrgent(false);
    setNewTaskInterest(5);
    setShowAddForm(false);
  };

  const handleToggleTask = (taskId: string) => {
    setTasks(tasks.map(task => {
      if (task.id === taskId) {
        const newCompleted = !task.completed;
        if (newCompleted) {
          setConsecutiveCompletions(prev => prev + 1);
        } else {
          setConsecutiveCompletions(0);
        }
        return { ...task, completed: newCompleted };
      }
      return task;
    }));
  };

  const handleDeleteTask = (taskId: string) => {
    setTasks(tasks.filter(task => task.id !== taskId));
    setConsecutiveCompletions(0);
  };

  const renderTaskCard = (task: PrioritizedTask, index?: number) => {
    const isTopThree = index !== undefined && index < 3;

    return (
      <div
        key={task.id}
        className={cn(
          'p-4 rounded-xl transition-all',
          task.completed
            ? 'bg-muted opacity-60'
            : isTopThree
            ? 'zen-gradient-card zen-shadow-soft border-2 border-primary/30'
            : 'bg-card border border-border hover:border-primary/30'
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
                  Urgent
                </span>
              )}
              <span className="inline-flex items-center gap-1 px-2 py-1 bg-primary/10 text-primary rounded-md text-xs">
                <Clock className="w-3 h-3" />
                {task.estimatedMinutes} min
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
                  💡 {task.reasoning}
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
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold zen-text-gradient">Task Momentum</h2>
          <p className="text-sm text-muted-foreground mt-1">
            ADHD-friendly task prioritization
          </p>
        </div>
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
                {consecutiveCompletions} tasks in a row • +{momentumBonus.xpBonus} XP • {momentumBonus.streakMultiplier}x multiplier
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
            placeholder="Task name..."
            className="w-full p-3 bg-secondary rounded-xl text-foreground focus:outline-none focus:ring-2 focus:ring-primary/30"
            autoFocus
          />

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className="text-xs text-muted-foreground mb-1 block">
                Duration (minutes)
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
                Interest (1-10)
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
            <span className="text-sm text-foreground">Mark as urgent</span>
          </label>

          <div className="flex gap-2">
            <button
              onClick={handleAddTask}
              disabled={!newTaskName.trim()}
              className="flex-1 py-3 zen-gradient text-white rounded-xl font-medium hover:opacity-90 transition-opacity disabled:opacity-50 disabled:cursor-not-allowed"
            >
              Add Task
            </button>
            <button
              onClick={() => setShowAddForm(false)}
              className="px-6 py-3 bg-secondary text-secondary-foreground rounded-xl font-medium hover:bg-muted transition-colors"
            >
              Cancel
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
              Top 3 Recommended Tasks
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
              Quick Wins (Under 2 min)
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
          <h3 className="text-lg font-semibold mb-3">All Tasks</h3>
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
          <h3 className="text-lg font-semibold mb-2">No tasks yet</h3>
          <p className="text-muted-foreground mb-4">
            Add your first task to get started with Task Momentum!
          </p>
          <button
            onClick={() => setShowAddForm(true)}
            className="px-6 py-3 zen-gradient text-white rounded-xl font-medium hover:opacity-90 transition-opacity inline-flex items-center gap-2"
          >
            <Plus className="w-5 h-5" />
            Add Your First Task
          </button>
        </div>
      )}

      {/* ADHD Tips */}
      <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
        <div className="flex gap-3">
          <div className="text-2xl">💡</div>
          <div className="text-sm">
            <div className="font-medium mb-1">ADHD Task Tips</div>
            <ul className="text-muted-foreground space-y-1 list-disc list-inside">
              <li>Start with quick wins (2-5 min tasks)</li>
              <li>Build momentum with consecutive completions</li>
              <li>High interest tasks give more dopamine</li>
              <li>Urgent + short = perfect combo</li>
            </ul>
          </div>
        </div>
      </div>
    </div>
  );
}
