/**
 * Task — momentum-driven task shape.
 *
 * Shared across schedule UI (TaskFocusPanel, ScheduleTimeline via useScheduleData)
 * and cloud sync (tasksCloudSync row converters). This file restores the
 * canonical source after a prior refactor removed it; type-only consumers
 * kept working because TypeScript elides unused type imports, but knip
 * correctly flagged the module path as unresolved.
 *
 * Fields align with the `rowToTask` / `taskToRow` converters in
 * `src/storage/tasksCloudSync.ts`.
 */
export interface Task {
  id: string;
  name: string;
  description?: string;
  urgent: boolean;
  estimatedMinutes: number;
  userRating?: number;
  completed: boolean;
  dueDate?: string;
  category?: string;
}
