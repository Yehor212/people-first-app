import { useState, useEffect, useCallback, useMemo } from 'react';
import { logger } from '@/lib/logger';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { playSuccess, playStreakMilestone } from '@/lib/audioManager';
import { pushTasksToCloud } from '@/storage/tasksCloudSync';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import {
  type Task,
  type PrioritizedTask,
  prioritizeForADHD,
  getNextThreeTasks,
  calculateMomentumBonus,
  getTwoMinuteTasks,
} from '@/lib/taskMomentum';

interface UseTasksDataOptions {
  onAwardXp?: (source: string, amount: number) => void;
  onEarnTreats?: (source: string, amount: number, reason: string) => void;
}

interface UseTasksDataReturn {
  tasks: Task[];
  isLoaded: boolean;
  consecutiveCompletions: number;
  prioritizedTasks: PrioritizedTask[];
  topThree: PrioritizedTask[];
  categorized: { immediate: PrioritizedTask[]; short: PrioritizedTask[]; medium: PrioritizedTask[]; long: PrioritizedTask[] };
  momentumBonus: { streakMultiplier: number; message: string };
  addTask: (task: Task) => void;
  handleToggleTask: (taskId: string) => void;
  handleDeleteTask: (taskId: string) => void;
}

export function useTasksData({ onAwardXp, onEarnTreats }: UseTasksDataOptions): UseTasksDataReturn {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [consecutiveCompletions, setConsecutiveCompletions] = useState(0);
  const [isLoaded, setIsLoaded] = useState(false);

  // Load tasks from localStorage on mount
  useEffect(() => {
    const parsedTasks = safeLocalStorageGet<Task[]>(SK.TASKS, []);
    setTasks(Array.isArray(parsedTasks) ? parsedTasks : []);

    const parsedMomentum = safeLocalStorageGet<{ lastCompletion?: number; count?: number }>(SK.TASK_MOMENTUM, null);
    if (parsedMomentum) {
      if (parsedMomentum.lastCompletion && Date.now() - parsedMomentum.lastCompletion < 30 * 60 * 1000) {
        setConsecutiveCompletions(parsedMomentum.count || 0);
      }
    }
    setIsLoaded(true);
  }, []);

  // Save tasks to localStorage whenever they change
  useEffect(() => {
    if (!isLoaded) return;
    safeLocalStorageSet(SK.TASKS, tasks);

    window.dispatchEvent(new CustomEvent('zenflow-tasks-updated'));

    syncOrchestrator.sync('tasks', async () => {
      await pushTasksToCloud(tasks);
    }).catch(err => {
      logger.error('[TasksPanel] Cloud sync failed:', err);
    });
  }, [tasks, isLoaded]);

  // Save momentum state
  useEffect(() => {
    if (!isLoaded) return;
    safeLocalStorageSet(SK.TASK_MOMENTUM, {
      count: consecutiveCompletions,
      lastCompletion: consecutiveCompletions > 0 ? Date.now() : null,
    });
  }, [consecutiveCompletions, isLoaded]);

  const prioritizedTasks = useMemo(() => prioritizeForADHD(tasks), [tasks]);
  const topThree = useMemo(() => getNextThreeTasks(tasks), [tasks]);
  const categorized = useMemo(() => getTwoMinuteTasks(tasks), [tasks]);
  const momentumBonus = useMemo(() => calculateMomentumBonus(consecutiveCompletions), [consecutiveCompletions]);

  const addTask = useCallback((task: Task) => {
    setTasks(prev => [...prev, task]);
  }, []);

  const handleToggleTask = useCallback((taskId: string) => {
    setTasks(prev => prev.map(task => {
      if (task.id !== taskId) return task;

      const newCompleted = !task.completed;

      if (newCompleted) {
        setConsecutiveCompletions(c => {
          const newCount = c + 1;
          const bonus = calculateMomentumBonus(newCount);
          const baseXp = 15;
          const totalXp = Math.round(baseXp * bonus.streakMultiplier);

          if (onAwardXp) onAwardXp('task', totalXp);
          if (onEarnTreats) onEarnTreats('task', totalXp, `Task: ${task.name}`);

          if (newCount === 3 || newCount === 5 || newCount % 10 === 0) {
            playStreakMilestone();
          } else {
            playSuccess();
          }

          return newCount;
        });
      } else {
        setConsecutiveCompletions(0);
      }

      return { ...task, completed: newCompleted };
    }));
  }, [onAwardXp, onEarnTreats]);

  const handleDeleteTask = useCallback((taskId: string) => {
    setTasks(prev => prev.filter(task => task.id !== taskId));
  }, []);

  return {
    tasks, isLoaded, consecutiveCompletions,
    prioritizedTasks, topThree, categorized, momentumBonus,
    addTask, handleToggleTask, handleDeleteTask,
  };
}
