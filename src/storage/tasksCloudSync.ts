// Tasks and Quests Cloud Synchronization with Supabase

import { logger } from '@/lib/logger';
import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/lib/taskMomentum';
import { Quest, QuestCondition, QuestReward } from '@/lib/randomQuests';
import { syncOrchestrator } from '@/lib/syncOrchestrator';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';
import { SK } from '@/lib/storageKeys';
import { triggerDataRefresh } from '@/hooks/useIndexedDB';
import type { Json } from '@/types/supabase';
import { validateSyncOwner } from '@/storage/sync/syncOwner';

/**
 * Convert Task to Supabase row format (matches DB Insert type)
 */
function taskToRow(task: Task, userId: string) {
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
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert Supabase row to Task (handles nullable DB fields)
 */
function rowToTask(row: Record<string, unknown>): Task {
  return {
    id: row.task_id as string,
    name: row.name as string,
    description: (row.description as string) ?? undefined,
    urgent: (row.urgent as boolean) ?? false,
    estimatedMinutes: row.estimated_minutes as number,
    userRating: (row.user_rating as number) ?? undefined,
    completed: (row.completed as boolean) ?? false,
    dueDate: (row.due_date as string) ?? undefined,
    category: (row.category as string) ?? undefined,
  };
}

/**
 * Convert Quest to Supabase row format (matches DB Insert type)
 */
function questToRow(quest: Quest, userId: string) {
  return {
    user_id: userId,
    quest_id: quest.id,
    type: quest.type,
    category: quest.category,
    title: quest.title,
    description: quest.description,
    condition: quest.condition as unknown as Json,
    reward: quest.reward as unknown as Json,
    progress: quest.progress,
    total: quest.total,
    completed: quest.completed,
    expires_at: new Date(quest.expiresAt).toISOString(),
    updated_at: new Date().toISOString(),
  };
}

/**
 * Convert Supabase row to Quest (handles nullable DB fields)
 */
function rowToQuest(row: Record<string, unknown>): Quest {
  return {
    id: row.quest_id as string,
    type: row.type as Quest['type'],
    category: row.category as Quest['category'],
    title: row.title as string,
    description: row.description as string,
    condition: row.condition as QuestCondition,
    reward: row.reward as QuestReward,
    progress: (row.progress as number) ?? 0,
    total: row.total as number,
    completed: (row.completed as boolean) ?? false,
    expiresAt: new Date(row.expires_at as string).getTime(),
    createdAt: Date.now(), // Approximate
  };
}

/**
 * Pull tasks from Supabase
 * Returns null if there's an error to prevent data loss
 */
export async function pullTasksFromCloud(expectedOwnerUserId: string): Promise<Task[] | null> {
  if (!supabase) return null;
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, 'Task pull');
  if (!ownerUserId) return null;

  const { data, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(500);

  if (!(await validateSyncOwner(ownerUserId, 'Task pull'))) return null;

  if (error) {
    logger.error('[TasksSync] Error pulling tasks:', error);
    return null; // Return null to signal error - caller should keep local data
  }

  return (data || []).map(rowToTask);
}

/**
 * Push tasks to Supabase
 */
export async function pushTasksToCloud(
  tasks: Task[],
  expectedOwnerUserId: string
): Promise<void> {
  if (!supabase) return;
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, 'Task push');
  if (!ownerUserId) return;

  // Upsert tasks
  const rows = tasks.map(task => taskToRow(task, ownerUserId));

  if (!(await validateSyncOwner(ownerUserId, 'Task push'))) return;
  const { error } = await supabase
    .from('user_tasks')
    .upsert(rows, {
      onConflict: 'user_id,task_id',
      ignoreDuplicates: false,
    });

  if (error) {
    logger.error('[TasksSync] Error pushing tasks:', error);
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }
}

/**
 * P2-1 Fix: Delete a task from cloud
 * Call this when a task is deleted locally to maintain sync consistency
 */
export async function deleteTaskFromCloud(taskId: string): Promise<void> {
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const user = session.user;

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
  if (!supabase) return;
  const { data: { session } } = await supabase.auth.getSession();
  if (!session?.user) return;
  const user = session.user;

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
export async function syncTasks(expectedOwnerUserId: string): Promise<Task[]> {
  let mergedTasks: Task[] = [];

  await syncOrchestrator.sync('tasks', async () => {
    // Get local tasks first (safe fallback)
    const localTasks = safeLocalStorageGet<Task[]>(SK.TASKS, []);

    // Pull from cloud
    const cloudTasks = await pullTasksFromCloud(expectedOwnerUserId);

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
    const localOwnerUserId = await validateSyncOwner(
      expectedOwnerUserId,
      'Task local merge'
    );
    if (!localOwnerUserId) return;
    safeLocalStorageSet(SK.TASKS, mergedTasks);

    // Trigger React state refresh so UI updates
    await triggerDataRefresh();
    logger.log('[TasksSync] Data refresh triggered after merge');

    // Push merged to cloud
    if (!(await validateSyncOwner(localOwnerUserId, 'Task sync continuation'))) return;
    await pushTasksToCloud(mergedTasks, localOwnerUserId);
  }, { priority: 7, maxRetries: 3, expectedOwnerUserId }); // Higher priority for user tasks

  return mergedTasks;
}

type QuestsState = { daily: Quest | null; weekly: Quest | null; bonus: Quest | null };

/**
 * Pull quests from Supabase
 * Returns undefined if there's an error to prevent data loss
 */
export async function pullQuestsFromCloud(
  expectedOwnerUserId: string
): Promise<QuestsState | undefined> {
  if (!supabase) return undefined;
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, 'Quest pull');
  if (!ownerUserId) return undefined;

  const { data, error } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', ownerUserId)
    .order('updated_at', { ascending: false })
    .limit(50);

  if (!(await validateSyncOwner(ownerUserId, 'Quest pull'))) return undefined;

  if (error) {
    logger.error('[QuestsSync] Error pulling quests:', error);
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
export async function pushQuestsToCloud(
  quests: { daily: Quest | null; weekly: Quest | null; bonus: Quest | null },
  expectedOwnerUserId: string
): Promise<void> {
  if (!supabase) return;
  const ownerUserId = await validateSyncOwner(expectedOwnerUserId, 'Quest push');
  if (!ownerUserId) return;

  const rows: ReturnType<typeof questToRow>[] = [];

  if (quests.daily) rows.push(questToRow(quests.daily, ownerUserId));
  if (quests.weekly) rows.push(questToRow(quests.weekly, ownerUserId));
  if (quests.bonus) rows.push(questToRow(quests.bonus, ownerUserId));

  if (rows.length === 0) return;

  if (!(await validateSyncOwner(ownerUserId, 'Quest push'))) return;
  const { error } = await supabase
    .from('user_quests')
    .upsert(rows, {
      onConflict: 'user_id,quest_id',
      ignoreDuplicates: false,
    });

  if (error) {
    logger.error('[QuestsSync] Error pushing quests:', error);
    logger.warn('[Sync] Operation failed, will retry via orchestrator');
  }
}

/**
 * Sync quests: pull from cloud and merge with local
 * Uses orchestrator for queue-based sync
 * Never loses local data on sync errors
 */
export async function syncQuests(expectedOwnerUserId: string): Promise<QuestsState> {
  const defaultQuests: QuestsState = { daily: null, weekly: null, bonus: null };
  let mergedQuests: QuestsState = defaultQuests;

  await syncOrchestrator.sync('quests', async () => {
    // Get local quests first (safe fallback)
    const localQuests = safeLocalStorageGet<QuestsState>(SK.QUESTS, defaultQuests);

    // Pull from cloud
    const cloudQuests = await pullQuestsFromCloud(expectedOwnerUserId);

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
    const localOwnerUserId = await validateSyncOwner(
      expectedOwnerUserId,
      'Quest local merge'
    );
    if (!localOwnerUserId) return;
    safeLocalStorageSet(SK.QUESTS, mergedQuests);

    // Trigger React state refresh so UI updates
    await triggerDataRefresh();
    logger.log('[QuestsSync] Data refresh triggered after merge');

    // Push merged to cloud
    if (!(await validateSyncOwner(localOwnerUserId, 'Quest sync continuation'))) return;
    await pushQuestsToCloud(mergedQuests, localOwnerUserId);
  }, { priority: 7, maxRetries: 3, expectedOwnerUserId }); // Higher priority for user tasks

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
