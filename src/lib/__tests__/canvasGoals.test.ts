import { describe, it, expect, vi } from 'vitest';
import {
  createGoal,
  toggleGoalCompletion,
  isBranchGoal,
  deleteGoal,
  updateGoalIcon,
  updateGoalEmoji,
  updateGoalColor,
  isGoalFullyComplete,
} from '@/lib/canvasGoals';
import type { CanvasGoal } from '@/types';

// Mock generateId to return predictable values
vi.mock('@/lib/utils', () => ({
  generateId: vi.fn(() => 'mock-id-' + Math.random().toString(36).slice(2, 8)),
}));

// ─── Helper ──────────────────────────────────────────────────────

function makeGoal(overrides: Partial<CanvasGoal> = {}): CanvasGoal {
  return {
    id: 'g1',
    title: 'Test Goal',
    completed: false,
    parentId: null,
    createdAt: 1700000000000,
    order: 0,
    ...overrides,
  };
}

// ─── createGoal ──────────────────────────────────────────────────

describe('createGoal', () => {
  it('creates a root-level goal with order 0 when no siblings', () => {
    const goal = createGoal('Learn TypeScript', null, []);
    expect(goal.title).toBe('Learn TypeScript');
    expect(goal.parentId).toBeNull();
    expect(goal.order).toBe(0);
    expect(goal.completed).toBe(false);
  });

  it('assigns next sibling order when siblings exist', () => {
    const existing = [
      makeGoal({ id: 'g1', parentId: null, order: 0 }),
      makeGoal({ id: 'g2', parentId: null, order: 2 }),
    ];
    const goal = createGoal('New Goal', null, existing);
    expect(goal.order).toBe(3); // max(0,2) + 1
  });

  it('creates a child goal with correct parentId', () => {
    const existing = [makeGoal({ id: 'parent', parentId: null })];
    const goal = createGoal('Subtask', 'parent', existing);
    expect(goal.parentId).toBe('parent');
    expect(goal.order).toBe(0); // first child
  });

  it('assigns icon when provided', () => {
    const goal = createGoal('Goal', null, [], 'Target');
    expect(goal.icon).toBe('Target');
  });

  it('has no icon when not provided', () => {
    const goal = createGoal('Goal', null, []);
    expect(goal.icon).toBeUndefined();
  });

  it('generates a unique id', () => {
    const a = createGoal('A', null, []);
    const b = createGoal('B', null, []);
    expect(a.id).not.toBe(b.id);
  });

  it('sets createdAt to a timestamp', () => {
    const goal = createGoal('Goal', null, []);
    expect(typeof goal.createdAt).toBe('number');
    expect(goal.createdAt).toBeGreaterThan(0);
  });
});

// ─── toggleGoalCompletion ────────────────────────────────────────

describe('toggleGoalCompletion', () => {
  it('toggles a leaf goal from incomplete to complete', () => {
    const goals = [makeGoal({ id: 'g1', completed: false })];
    const result = toggleGoalCompletion('g1', goals);
    expect(result[0].completed).toBe(true);
    expect(result[0].completedAt).toBeDefined();
  });

  it('toggles a leaf goal from complete to incomplete', () => {
    const goals = [makeGoal({ id: 'g1', completed: true, completedAt: 123 })];
    const result = toggleGoalCompletion('g1', goals);
    expect(result[0].completed).toBe(false);
    expect(result[0].completedAt).toBeUndefined();
  });

  it('blocks toggle on branch nodes (goals with children)', () => {
    const goals = [
      makeGoal({ id: 'parent', completed: false }),
      makeGoal({ id: 'child', parentId: 'parent' }),
    ];
    const result = toggleGoalCompletion('parent', goals);
    // Should return original array unchanged
    expect(result).toBe(goals);
  });

  it('does not mutate original array', () => {
    const goals = [makeGoal({ id: 'g1', completed: false })];
    const result = toggleGoalCompletion('g1', goals);
    expect(result).not.toBe(goals);
    expect(goals[0].completed).toBe(false);
  });

  it('only affects the targeted goal', () => {
    const goals = [
      makeGoal({ id: 'g1', completed: false }),
      makeGoal({ id: 'g2', completed: false }),
    ];
    const result = toggleGoalCompletion('g1', goals);
    expect(result[0].completed).toBe(true);
    expect(result[1].completed).toBe(false);
  });
});

// ─── isBranchGoal ────────────────────────────────────────────────

describe('isBranchGoal', () => {
  it('returns true for goal with children', () => {
    const goals = [
      makeGoal({ id: 'parent' }),
      makeGoal({ id: 'child', parentId: 'parent' }),
    ];
    expect(isBranchGoal('parent', goals)).toBe(true);
  });

  it('returns false for leaf goal', () => {
    const goals = [makeGoal({ id: 'leaf' })];
    expect(isBranchGoal('leaf', goals)).toBe(false);
  });

  it('returns false for non-existent goal', () => {
    expect(isBranchGoal('nonexistent', [])).toBe(false);
  });
});

// ─── deleteGoal ──────────────────────────────────────────────────

describe('deleteGoal', () => {
  it('removes target goal from array', () => {
    const goals = [
      makeGoal({ id: 'g1' }),
      makeGoal({ id: 'g2' }),
    ];
    const result = deleteGoal('g1', goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('g2');
  });

  it('removes descendants recursively', () => {
    const goals = [
      makeGoal({ id: 'root' }),
      makeGoal({ id: 'child', parentId: 'root' }),
      makeGoal({ id: 'grandchild', parentId: 'child' }),
      makeGoal({ id: 'other' }),
    ];
    const result = deleteGoal('root', goals);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('other');
  });

  it('does not mutate original array', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const result = deleteGoal('g1', goals);
    expect(goals).toHaveLength(1);
    expect(result).toHaveLength(0);
  });

  it('returns full array if goalId not found', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const result = deleteGoal('nonexistent', goals);
    expect(result).toHaveLength(1);
  });
});

// ─── updateGoalIcon / updateGoalEmoji / updateGoalColor ──────────

describe('updateGoalIcon', () => {
  it('sets icon on target goal', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const result = updateGoalIcon('g1', 'Star', goals);
    expect(result[0].icon).toBe('Star');
  });

  it('clears icon when set to undefined', () => {
    const goals = [makeGoal({ id: 'g1', icon: 'Star' })];
    const result = updateGoalIcon('g1', undefined, goals);
    expect(result[0].icon).toBeUndefined();
  });
});

describe('updateGoalEmoji', () => {
  it('sets emoji on target goal', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const result = updateGoalEmoji('g1', '🎯', goals);
    expect(result[0].emoji).toBe('🎯');
  });
});

describe('updateGoalColor', () => {
  it('sets color on target goal', () => {
    const goals = [makeGoal({ id: 'g1' })];
    const result = updateGoalColor('g1', 'emerald', goals);
    expect(result[0].color).toBe('emerald');
  });
});

// ─── isGoalFullyComplete ─────────────────────────────────────────

describe('isGoalFullyComplete', () => {
  it('returns true for completed leaf goal', () => {
    const goals = [makeGoal({ id: 'g1', completed: true })];
    expect(isGoalFullyComplete('g1', goals)).toBe(true);
  });

  it('returns false for incomplete leaf goal', () => {
    const goals = [makeGoal({ id: 'g1', completed: false })];
    expect(isGoalFullyComplete('g1', goals)).toBe(false);
  });

  it('returns true for branch where all children are completed', () => {
    const goals = [
      makeGoal({ id: 'parent' }),
      makeGoal({ id: 'c1', parentId: 'parent', completed: true }),
      makeGoal({ id: 'c2', parentId: 'parent', completed: true }),
    ];
    expect(isGoalFullyComplete('parent', goals)).toBe(true);
  });

  it('returns false for branch where some children are incomplete', () => {
    const goals = [
      makeGoal({ id: 'parent' }),
      makeGoal({ id: 'c1', parentId: 'parent', completed: true }),
      makeGoal({ id: 'c2', parentId: 'parent', completed: false }),
    ];
    expect(isGoalFullyComplete('parent', goals)).toBe(false);
  });

  it('checks deeply nested descendants', () => {
    const goals = [
      makeGoal({ id: 'root' }),
      makeGoal({ id: 'mid', parentId: 'root' }),
      makeGoal({ id: 'leaf', parentId: 'mid', completed: true }),
    ];
    expect(isGoalFullyComplete('root', goals)).toBe(true);
  });

  it('returns false for deeply nested incomplete descendant', () => {
    const goals = [
      makeGoal({ id: 'root' }),
      makeGoal({ id: 'mid', parentId: 'root' }),
      makeGoal({ id: 'leaf', parentId: 'mid', completed: false }),
    ];
    expect(isGoalFullyComplete('root', goals)).toBe(false);
  });

  it('returns false for non-existent goal', () => {
    expect(isGoalFullyComplete('ghost', [])).toBe(false);
  });
});
