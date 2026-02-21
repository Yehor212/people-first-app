/**
 * TasksPanel — ADHD-friendly task momentum orchestrator
 * Decomposed from the original 501-line monolith (TD-20).
 * This file: ~180L, 0 useState, delegates state to 2 custom hooks.
 */

import { useEffect } from 'react';
import { Plus, Zap, Clock, Calendar, X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { SkeletonSection, SkeletonList } from '@/components/ui/skeleton';
import { EmptyState } from '@/components/EmptyState';

import type { TasksPanelProps } from './types';
import { useTasksData } from './useTasksData';
import { useTaskForm } from './useTaskForm';
import { TaskCard } from './TaskCard';
import { TaskAddForm } from './TaskAddForm';

export function TasksPanel({ onClose, onAwardXp, onEarnTreats }: TasksPanelProps) {
  const { t } = useLanguage();
  const tRecord = t as unknown as Record<string, string>;

  // --- Hooks ---
  const data = useTasksData({ onAwardXp, onEarnTreats });
  const taskForm = useTaskForm({ onAdd: data.addTask });

  // Android back button: close panel or dismiss add form
  useBackHandler(!!onClose && !taskForm.form.show, onClose ?? (() => {}));
  useBackHandler(taskForm.form.show, taskForm.hideForm);
  useScrollLock(!!onClose);

  // Escape key: dismiss add form first, then close panel
  useEffect(() => {
    const handler = (e: KeyboardEvent) => {
      if (e.key === 'Escape') {
        e.preventDefault();
        if (taskForm.form.show) {
          taskForm.hideForm();
        } else {
          onClose?.();
        }
      }
    };
    document.addEventListener('keydown', handler);
    return () => document.removeEventListener('keydown', handler);
  }, [taskForm, onClose]);

  return (
    <div role="dialog" aria-modal="true" aria-labelledby="tasks-panel-title" className="fixed inset-0 z-[60] bg-background/95 backdrop-blur-sm overflow-y-auto">
      <div className="max-w-lg mx-auto px-4 py-6 space-y-6">
        {/* Header */}
        <div className="flex items-center justify-between">
          <div>
            <h2 id="tasks-panel-title" className="text-2xl font-bold zen-text-gradient">{tRecord.taskMomentum || 'Task Momentum'}</h2>
            <p className="text-sm text-muted-foreground mt-1">
              {tRecord.taskMomentumDesc || 'ADHD-friendly task prioritization'}
            </p>
          </div>
          <div className="flex items-center gap-2">
            <button
              onClick={() => taskForm.form.show ? taskForm.hideForm() : taskForm.showForm()}
              className={cn(
                'p-3 rounded-xl transition-all zen-shadow-soft',
                taskForm.form.show
                  ? 'bg-muted text-foreground'
                  : 'zen-gradient text-white hover:opacity-90'
              )}
              aria-label={tRecord.addTask || 'Add task'}
            >
              <Plus className="w-5 h-5" />
            </button>
            {onClose && (
              <button
                onClick={onClose}
                aria-label={tRecord.close || 'Close'}
                className="p-3 rounded-xl bg-muted hover:bg-muted/80 transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            )}
          </div>
        </div>

        {/* Momentum Bonus */}
        {data.consecutiveCompletions > 0 && (
          <div className="p-4 zen-gradient rounded-xl zen-shadow motion-safe:animate-scale-in">
            <div className="flex items-center gap-3">
              <div className="text-4xl">🔥</div>
              <div className="flex-1">
                <div className="text-white font-bold">
                  {data.momentumBonus.message}
                </div>
                <div className="text-white/80 text-sm mt-1">
                  {data.consecutiveCompletions} {tRecord.tasksInARow || 'tasks in a row'} • +{Math.round(15 * data.momentumBonus.streakMultiplier)} XP • {data.momentumBonus.streakMultiplier}x
                </div>
              </div>
            </div>
          </div>
        )}

        {/* Add Task Form */}
        {taskForm.form.show && (
          <TaskAddForm
            form={taskForm.form}
            setField={taskForm.setField}
            handleBlurMinutes={taskForm.handleBlurMinutes}
            handleBlurBreak={taskForm.handleBlurBreak}
            handleBlurInterest={taskForm.handleBlurInterest}
            handleAddTask={taskForm.handleAddTask}
            hideForm={taskForm.hideForm}
            t={tRecord}
          />
        )}

        {/* Top 3 Recommended Tasks */}
        {data.topThree.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Zap className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {tRecord.topRecommendedTasks || 'Top 3 Recommended Tasks'}
              </h3>
            </div>
            <div className="space-y-3">
              {data.topThree.map((task, index) => (
                <TaskCard key={task.id} task={task} index={index} onToggle={data.handleToggleTask} onDelete={data.handleDeleteTask} t={tRecord} />
              ))}
            </div>
          </div>
        )}

        {/* Quick Wins (2-minute tasks) */}
        {data.categorized.immediate.length > 0 && (
          <div>
            <div className="flex items-center gap-2 mb-3">
              <Clock className="w-5 h-5 text-primary" />
              <h3 className="text-lg font-semibold">
                {tRecord.quickWins || 'Quick Wins (Under 2 min)'}
              </h3>
            </div>
            <div className="space-y-2">
              {data.categorized.immediate.map(task => (
                <TaskCard key={task.id} task={task} onToggle={data.handleToggleTask} onDelete={data.handleDeleteTask} t={tRecord} />
              ))}
            </div>
          </div>
        )}

        {/* All Tasks */}
        {data.prioritizedTasks.length > 0 && (
          <div>
            <h3 className="text-lg font-semibold mb-3">{tRecord.allTasks || 'All Tasks'}</h3>
            <div className="space-y-2">
              {data.prioritizedTasks.map(task => (
                <TaskCard key={task.id} task={task} onToggle={data.handleToggleTask} onDelete={data.handleDeleteTask} t={tRecord} />
              ))}
            </div>
          </div>
        )}

        {/* Loading State */}
        {!data.isLoaded && (
          <div className="space-y-4">
            <SkeletonSection hasIcon />
            <SkeletonList count={3} />
          </div>
        )}

        {/* Empty State */}
        {data.isLoaded && data.tasks.length === 0 && !taskForm.form.show && (
          <EmptyState
            icon={<Calendar className="w-8 h-8 text-primary" />}
            title={tRecord.noTasksYet || 'No tasks yet'}
            message={tRecord.addFirstTaskMessage || 'Add your first task to get started with Task Momentum!'}
            action={{
              label: tRecord.addFirstTask || 'Add Your First Task',
              onClick: taskForm.showForm,
            }}
          />
        )}

        {/* ADHD Tips */}
        <div className="p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-sm">
              <div className="font-medium mb-1">{tRecord.adhdTaskTips || 'ADHD Task Tips'}</div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>{tRecord.taskTip1 || 'Start with quick wins (2-5 min tasks)'}</li>
                <li>{tRecord.taskTip2 || 'Build momentum with consecutive completions'}</li>
                <li>{tRecord.taskTip3 || 'High interest tasks give more dopamine'}</li>
                <li>{tRecord.taskTip4 || 'Urgent + short = perfect combo'}</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
