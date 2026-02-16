// Tasks and Quests Cloud Synchronization with Supabase

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/lib/taskMomentum';
import { Quest, QuestCondition, QuestReward } from '@/lib/randomQuests';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';

// UUID validation regex for secure user_id filtering
const UUID_REGEX = /^[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}$/i;

const _isValidUUID = (id: string): boolean => {
  return typeof id === 'string' && UUID_REGEX.test(id);
};

interface TaskRow {
  user_id: string;
  task_id: string;
  name: string;
  description?: string;
  urgent: boolean;
  estimated_minutes: number;
  user_rating?: number;
  completed: boolean;
  due_date?: string;
  category?: string;
  updated_at: string;
}

interface QuestRow {
  user_id: string;
  quest_id: string;
  type: 'daily' | 'weekly' | 'bonus';
  category: string;
  title: string;
  description: string;
  condition: QuestCondition;
  reward: QuestReward;
  progress: number;
  total: number;
  completed: boolean;
  expires_at: string;
  updated_at: string;
}

/**
 * Convert Task to Supabase row format
 */
function taskToRow(task: Task, userId: string): Partial<TaskRow> {
  return {
    user_id: userId,
    task_id: task.id,
    name: task.name,
    description: task.description,
    urgent: task.urgent,
    estimated_minutes: task.estimatedMinutes,
    user_rating: task.userRating,
    completed: task.completed,
    due_date: task.dueDate,
    category: task.category,
  };
}

/**
 * Convert Supabase row to Task
 */
function rowToTask(row: TaskRow): Task {
  return {
    id: row.task_id,
    name: row.name,
    description: row.description,
    urgent: row.urgent,
    estimatedMinutes: row.estimated_minutes,
    userRating: row.user_rating,
    completed: row.completed,
    dueDate: row.due_date,
    category: row.category,
  };
}

/**
 * Convert Quest to Supabase row format
 */
function questToRow(quest: Quest, userId: string): Partial<QuestRow> {
  return {
    user_id: userId,
    quest_id: quest.id,
    type: quest.type,
    category: quest.category,
    title: quest.title,
    description: quest.description,
    condition: quest.condition,
    reward: quest.reward,
    progress: quest.progress,
    total: quest.total,
    completed: quest.completed,
    expires_at: new Date(quest.expiresAt).toISOString(),
  };
}

/**
 * Convert Supabase row to Quest
 */
function rowToQuest(row: QuestRow): Quest {
  return {
    id: row.quest_id,
    type: row.type,
    category: row.category,
    title: row.title,
    description: row.description,
    condition: row.condition,
    reward: row.reward,
    progress: row.progress,
    total: row.total,
    completed: row.completed,
    expiresAt: new Date(row.expires_at).getTime(),
    createdAt: Date.now(), // Approximate
  };
}

/**
 * Pull tasks from Supabase
 * Returns null if there's an error to prevent data loss
 */
export async function pullTasksFromCloud(): Promise<Task[] | null> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return null; // Not authenticated - return null to keep local data

  const { data, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (error) {
    logger.error('Error pulling tasks:', error);
    return null; // Return null to signal error - caller should keep local data
  }

  return (data || []).map(rowToTask);
}

/**
 * Push tasks to Supabase
 */
export async function pushTasksToCloud(tasks: Task[]): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Upsert tasks
  const rows = tasks.map(task => taskToRow(task, user.id));

  const { error } = await supabase
    .from('user_tasks')
    .upsert(rows, {
      onConflict: 'user_id,task_id',
      ignoreDuplicates: false,
    });

  if (error) {
    logger.error('Error pushing tasks:', error);
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }
}

/**
 * P2-1 Fix: Delete a task from cloud
 * Call this when a task is deleted locally to maintain sync consistency
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  // Validate taskId format
  if (!taskId || typeof taskId !== 'string') {
    logger.warn('[TasksSync] Invalid taskId for delete:', taskId);
    return;
  }

  try {
    const { error } = await supabase
      .from('user_tasks')
      .delete()
      .eq('user_id', user.id)
      .eq('task_id', taskId);

    if (error) {
      logger.error('[TasksSync] Error deleting task from cloud:', error);
      throw error;
    }

    logger.log('[TasksSync] Task deleted from cloud:', taskId);
  } catch (error) {
    logger.error('[TasksSync] Delete failed:', error);
    throw error;
  }
}

/**
 * P2-1 Fix: Delete a quest from cloud
 * Call this when a quest is deleted/expired locally
 */
export async function deleteQuestFromCloud(questId: string, questType: 'daily' | 'weekly' | 'bonus'): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  try {
    const { error } = await supabase
      .from('user_quests')
      .delete()
      .eq('user_id', user.id)
      .eq('quest_id', questId)
      .eq('type', questType);

    if (error) {
      logger.error('[QuestsSync] Error deleting quest from cloud:', error);
      throw error;
    }

    logger.log('[QuestsSync] Quest deleted from cloud:', questId);
  } catch (error) {
    logger.error('[QuestsSync] Delete failed:', error);
    throw error;
  }
}

/**
 * Sync tasks: pull from cloud and merge with local
 * Uses orchestrator for queue-based sync
 * Never loses local data on sync errors
 */
export async function syncTasks(): Promise<Task[]> {
  let mergedTasks: Task[] = [];

  await syncOrchestrator.sync('tasks', async () => {
    // Get local tasks first (safe fallback)
    const localTasks = safeLocalStorageGet<Task[]>(SK.TASKS, []);

    // Pull from cloud
    const cloudTasks = await pullTasksFromCloud();

    // If cloud pull failed, keep local data and skip sync
    if (cloudTasks === null) {
      logger.warn('[TasksSync] Cloud pull failed, keeping local data');
      logger.warn('[Sync] Operation failed, will retry via orchestrator');
      mergedTasks = localTasks;
      return;
    }

    // Merge strategy: prefer completed tasks and higher progress
    const taskMap = new Map<string, Task>();
    const localMap = new Map<string, Task>();
    const cloudMap = new Map<string, Task>();

    localTasks.forEach(task => localMap.set(task.id, task));
    cloudTasks.forEach(task => cloudMap.set(task.id, task));

    // Get all unique task IDs
    const allTaskIds = new Set([...localMap.keys(), ...cloudMap.keys()]);

    allTaskIds.forEach(taskId => {
      const localTask = localMap.get(taskId);
      const cloudTask = cloudMap.get(taskId);

      if (localTask && cloudTask) {
        // Both exist - use smart merge
        if (localTask.completed && !cloudTask.completed) {
          // Local is completed, cloud is not - keep local
          taskMap.set(taskId, localTask);
        } else if (cloudTask.completed && !localTask.completed) {
          // Cloud is completed, local is not - keep cloud
          taskMap.set(taskId, cloudTask);
        } else {
          // Both same completion status - prefer local to avoid losing edits
          // (local changes are more recent since user just made them)
          taskMap.set(taskId, localTask);
        }
      } else if (localTask) {
        taskMap.set(taskId, localTask);
      } else if (cloudTask) {
        taskMap.set(taskId, cloudTask);
      }
    });

    mergedTasks = Array.from(taskMap.values());

    // Save merged to local
    safeLocalStorageSet(SK.TASKS, mergedTasks);

    // Trigger React state refresh so UI updates
    triggerDataRefresh();
    logger.log('[TasksSync] Data refresh triggered after merge');

    // Push merged to cloud
    await pushTasksToCloud(mergedTasks);
  }, { priority: 7, maxRetries: 3 }); // Higher priority for user tasks

  return mergedTasks;
}

type QuestsState = { daily: Quest | null; weekly: Quest | null; bonus: Quest | null };

/**
 * Pull quests from Supabase
 * Returns undefined if there's an error to prevent data loss
 */
export async function pullQuestsFromCloud(): Promise<QuestsState | undefined> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return undefined; // Not authenticated - return undefined to keep local data

  const { data, error } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (error) {
    logger.error('Error pulling quests:', error);
    return undefined; // Return undefined to signal error - caller should keep local data
  }

  const quests = (data || []).map(rowToQuest);

  return {
    daily: quests.find(q => q.type === 'daily') || null,
    weekly: quests.find(q => q.type === 'weekly') || null,
    bonus: quests.find(q => q.type === 'bonus') || null,
  };
}

/**
 * Push quests to Supabase
 */
export async function pushQuestsToCloud(quests: { daily: Quest | null; weekly: Quest | null; bonus: Quest | null }): Promise<void> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return;

  const rows: Partial<QuestRow>[] = [];

  if (quests.daily) rows.push(questToRow(quests.daily, user.id));
  if (quests.weekly) rows.push(questToRow(quests.weekly, user.id));
  if (quests.bonus) rows.push(questToRow(quests.bonus, user.id));

  if (rows.length === 0) return;

  const { error } = await supabase
    .from('user_quests')
    .upsert(rows, {
      onConflict: 'user_id,quest_id',
      ignoreDuplicates: false,
    });

  if (error) {
    logger.error('Error pushing quests:', error);
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }
}

/**
 * Sync quests: pull from cloud and merge with local
 * Uses orchestrator for queue-based sync
 * Never loses local data on sync errors
 */
export async function syncQuests(): Promise<QuestsState> {
  const defaultQuests: QuestsState = { daily: null, weekly: null, bonus: null };
  let mergedQuests: QuestsState = defaultQuests;

  await syncOrchestrator.sync('quests', async () => {
    // Get local quests first (safe fallback)
    const localQuests = safeLocalStorageGet<QuestsState>(SK.QUESTS, defaultQuests);

    // Pull from cloud
    const cloudQuests = await pullQuestsFromCloud();

    // If cloud pull failed, keep local data and skip sync
    if (cloudQuests === undefined) {
      logger.warn('[QuestsSync] Cloud pull failed, keeping local data');
      logger.warn('[Sync] Operation failed, will retry via orchestrator');
      mergedQuests = localQuests;
      return;
    }

    // Merge strategy: prefer completed quests and higher progress
    const mergeQuest = (local: Quest | null, cloud: Quest | null): Quest | null => {
      if (!local && !cloud) return null;
      if (!local) return cloud;
      if (!cloud) return local;

      // Both exist - smart merge
      if (local.completed && !cloud.completed) {
        return local; // Local is completed, keep it
      } else if (cloud.completed && !local.completed) {
        return cloud; // Cloud is completed, keep it
      } else if (local.progress > cloud.progress) {
        return local; // Local has more progress
      } else if (cloud.progress > local.progress) {
        return cloud; // Cloud has more progress
      }
      // Same progress - prefer local (more recent user changes)
      return local;
    };

    mergedQuests = {
      daily: mergeQuest(localQuests.daily, cloudQuests.daily),
      weekly: mergeQuest(localQuests.weekly, cloudQuests.weekly),
      bonus: mergeQuest(localQuests.bonus, cloudQuests.bonus),
    };

    // Save merged to local
    safeLocalStorageSet(SK.QUESTS, mergedQuests);

    // Trigger React state refresh so UI updates
    triggerDataRefresh();
    logger.log('[QuestsSync] Data refresh triggered after merge');

    // Push merged to cloud
    await pushQuestsToCloud(mergedQuests);
  }, { priority: 7, maxRetries: 3 }); // Higher priority for user tasks

  return mergedQuests;
}

/**
 * DISABLED: Realtime subscriptions for tasks and quests
 *
 * Performance optimization: WAL query was consuming 96% of database time.
 * Data syncs on app resume via pullTasksFromCloud()/pullQuestsFromCloud() instead.
 */

/**
 * Subscribe to real-time task updates (DISABLED)
 * @param _userId - Filter changes to only this user's tasks
 * @param _callback - Function to call with updated tasks
 */
export function subscribeToTaskUpdates(_userId: string, _callback: (tasks: Task[]) => void) {
  // Disabled for performance - data syncs on app resume
  return () => {};
}

/**
 * Subscribe to real-time quest updates (DISABLED)
 * @param _userId - Filter changes to only this user's quests
 * @param _callback - Function to call with updated quests
 */
export function subscribeToQuestUpdates(_userId: string, _callback: (quests: { daily: Quest | null; weekly: Quest | null; bonus: Quest | null }) => void) {
  // Disabled for performance - data syncs on app resume
  return () => {};
}
