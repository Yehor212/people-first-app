// Tasks and Quests Cloud Synchronization with Supabase

import { supabase } from '@/lib/supabaseClient';
import { Task } from '@/lib/taskMomentum';
import { Quest } from '@/lib/randomQuests';

const TASKS_STORAGE_KEY = 'zenflow_tasks';
const QUESTS_STORAGE_KEY = 'zenflow_quests';

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
  condition: any;
  reward: any;
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
 */
export async function pullTasksFromCloud(): Promise<Task[]> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return [];

  const { data, error } = await supabase
    .from('user_tasks')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error pulling tasks:', error);
    return [];
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
    console.error('Error pushing tasks:', error);
  }
}

/**
 * Sync tasks: pull from cloud and merge with local
 */
export async function syncTasks(): Promise<Task[]> {
  // Pull from cloud
  const cloudTasks = await pullTasksFromCloud();

  // Get local tasks
  const localTasksStr = localStorage.getItem(TASKS_STORAGE_KEY);
  const localTasks: Task[] = localTasksStr ? JSON.parse(localTasksStr) : [];

  // Merge strategy: cloud wins for conflicts
  const taskMap = new Map<string, Task>();

  // Add local tasks
  localTasks.forEach(task => {
    taskMap.set(task.id, task);
  });

  // Override with cloud tasks (cloud wins)
  cloudTasks.forEach(task => {
    taskMap.set(task.id, task);
  });

  const mergedTasks = Array.from(taskMap.values());

  // Save merged to local
  localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(mergedTasks));

  // Push merged to cloud
  await pushTasksToCloud(mergedTasks);

  return mergedTasks;
}

/**
 * Pull quests from Supabase
 */
export async function pullQuestsFromCloud(): Promise<{ daily: Quest | null; weekly: Quest | null; bonus: Quest | null }> {
  const { data: { user } } = await supabase.auth.getUser();
  if (!user) return { daily: null, weekly: null, bonus: null };

  const { data, error } = await supabase
    .from('user_quests')
    .select('*')
    .eq('user_id', user.id)
    .order('updated_at', { ascending: false });

  if (error) {
    console.error('Error pulling quests:', error);
    return { daily: null, weekly: null, bonus: null };
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
    console.error('Error pushing quests:', error);
  }
}

/**
 * Sync quests: pull from cloud and merge with local
 */
export async function syncQuests(): Promise<{ daily: Quest | null; weekly: Quest | null; bonus: Quest | null }> {
  // Pull from cloud
  const cloudQuests = await pullQuestsFromCloud();

  // Get local quests
  const localQuestsStr = localStorage.getItem(QUESTS_STORAGE_KEY);
  const localQuests = localQuestsStr ? JSON.parse(localQuestsStr) : { daily: null, weekly: null, bonus: null };

  // Merge strategy: cloud wins
  const mergedQuests = {
    daily: cloudQuests.daily || localQuests.daily,
    weekly: cloudQuests.weekly || localQuests.weekly,
    bonus: cloudQuests.bonus || localQuests.bonus,
  };

  // Save merged to local
  localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(mergedQuests));

  // Push merged to cloud
  await pushQuestsToCloud(mergedQuests);

  return mergedQuests;
}

/**
 * Subscribe to real-time task updates
 */
export function subscribeToTaskUpdates(callback: (tasks: Task[]) => void) {
  const channel = supabase
    .channel('tasks-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_tasks',
      },
      async () => {
        const tasks = await pullTasksFromCloud();
        localStorage.setItem(TASKS_STORAGE_KEY, JSON.stringify(tasks));
        callback(tasks);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}

/**
 * Subscribe to real-time quest updates
 */
export function subscribeToQuestUpdates(callback: (quests: { daily: Quest | null; weekly: Quest | null; bonus: Quest | null }) => void) {
  const channel = supabase
    .channel('quests-changes')
    .on(
      'postgres_changes',
      {
        event: '*',
        schema: 'public',
        table: 'user_quests',
      },
      async () => {
        const quests = await pullQuestsFromCloud();
        localStorage.setItem(QUESTS_STORAGE_KEY, JSON.stringify(quests));
        callback(quests);
      }
    )
    .subscribe();

  return () => {
    supabase.removeChannel(channel);
  };
}
