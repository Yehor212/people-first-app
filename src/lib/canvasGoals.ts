/**
 * canvasGoals — CRUD helpers for the Goal Tree.
 *
 * All functions are pure: they take the current goals array and return a new one.
 * Persistence is handled by the caller (via userDataStore setCanvasGoals).
 */

import { generateId } from '@/lib/utils';
import type { CanvasGoal } from '@/types';

/**
 * Create a new goal (root-level or subtask).
 * Automatically assigns the next sibling order.
 */
export function createGoal(
  title: string,
  parentId: string | null,
  goals: CanvasGoal[],
  icon?: string,
): CanvasGoal {
  const siblings = goals.filter(g => g.parentId === parentId);
  const order = siblings.length > 0
    ? Math.max(...siblings.map(s => s.order)) + 1
    : 0;

  return {
    id: generateId(),
    title,
    description: undefined,
    icon,
    completed: false,
    parentId,
    createdAt: Date.now(),
    order,
  };
}

/**
 * Toggle a goal's completed state.
 * GUARD: Only leaf nodes (no children) can be toggled. Branch nodes derive
 * their progress strictly from children — manual toggle is blocked.
 * When uncompleting, clears completedAt.
 */
export function toggleGoalCompletion(
  goalId: string,
  goals: CanvasGoal[],
): CanvasGoal[] {
  // Block toggle on branch nodes (nodes that have children)
  const hasChildren = goals.some(g => g.parentId === goalId);
  if (hasChildren) return goals;

  return goals.map(g => {
    if (g.id !== goalId) return g;
    const nowComplete = !g.completed;
    return {
      ...g,
      completed: nowComplete,
      completedAt: nowComplete ? Date.now() : undefined,
    };
  });
}

/**
 * Check if a goal is a branch node (has at least one child).
 */
export function isBranchGoal(goalId: string, goals: CanvasGoal[]): boolean {
  return goals.some(g => g.parentId === goalId);
}

/**
 * Delete a goal and all its descendants recursively.
 */
export function deleteGoal(
  goalId: string,
  goals: CanvasGoal[],
): CanvasGoal[] {
  const idsToRemove = new Set<string>();

  function collectDescendants(id: string) {
    idsToRemove.add(id);
    for (const child of goals.filter(g => g.parentId === id)) {
      collectDescendants(child.id);
    }
  }

  collectDescendants(goalId);
  return goals.filter(g => !idsToRemove.has(g.id));
}

/**
 * Update a goal's icon.
 */
export function updateGoalIcon(
  goalId: string,
  icon: string | undefined,
  goals: CanvasGoal[],
): CanvasGoal[] {
  return goals.map(g => g.id === goalId ? { ...g, icon } : g);
}

/**
 * Check if a goal has reached 100% progress (all children completed recursively).
 * Returns true only for branch goals (goals with children) where every descendant leaf is done.
 */
export function isGoalFullyComplete(goalId: string, goals: CanvasGoal[]): boolean {
  const children = goals.filter(g => g.parentId === goalId);
  if (children.length === 0) {
    const goal = goals.find(g => g.id === goalId);
    return goal?.completed ?? false;
  }
  return children.every(c => isGoalFullyComplete(c.id, goals));
}
