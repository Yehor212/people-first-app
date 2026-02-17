import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  prioritizeForADHD,
  getNextThreeTasks,
  getQuickWins,
  calculateMomentumBonus,
  getTwoMinuteTasks,
  suggestTaskForNow,
  Task,
} from '../taskMomentum';

// ============================================
// Helper: create a minimal Task
// ============================================
function makeTask(overrides: Partial<Task> = {}): Task {
  return {
    id: overrides.id ?? 'task-1',
    name: overrides.name ?? 'Test task',
    urgent: overrides.urgent ?? false,
    estimatedMinutes: overrides.estimatedMinutes ?? 30,
    completed: overrides.completed ?? false,
    ...overrides,
  };
}

// ============================================
// prioritizeForADHD
// ============================================
describe('prioritizeForADHD', () => {
  it('returns empty array when given no tasks', () => {
    expect(prioritizeForADHD([])).toEqual([]);
  });

  it('filters out completed tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', completed: true }),
      makeTask({ id: '2', completed: false }),
    ];
    const result = prioritizeForADHD(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('2');
  });

  it('returns all incomplete tasks when none are completed', () => {
    const tasks: Task[] = [
      makeTask({ id: '1' }),
      makeTask({ id: '2' }),
      makeTask({ id: '3' }),
    ];
    const result = prioritizeForADHD(tasks);
    expect(result).toHaveLength(3);
  });

  it('adds urgency score of 10 for urgent tasks', () => {
    const urgentTask = makeTask({ id: 'u', urgent: true, estimatedMinutes: 60 });
    const normalTask = makeTask({ id: 'n', urgent: false, estimatedMinutes: 60 });
    const [first, second] = prioritizeForADHD([normalTask, urgentTask]);
    // Urgent task should score higher (same duration, same default interest)
    expect(first.id).toBe('u');
    expect(first.momentumScore).toBeGreaterThan(second.momentumScore);
  });

  it('gives higher duration score to shorter tasks', () => {
    const shortTask = makeTask({ id: 'short', estimatedMinutes: 5 });
    const longTask = makeTask({ id: 'long', estimatedMinutes: 100 });
    const result = prioritizeForADHD([longTask, shortTask]);
    expect(result[0].id).toBe('short');
    expect(result[0].momentumScore).toBeGreaterThan(result[1].momentumScore);
  });

  it('caps duration at 120 minutes for scoring', () => {
    const veryLong = makeTask({ id: 'vl', estimatedMinutes: 300 });
    const atCap = makeTask({ id: 'cap', estimatedMinutes: 120 });
    const result = prioritizeForADHD([veryLong, atCap]);
    // Both should have durationScore = 0 (120/120 * 30 = 30, so 30-30=0)
    expect(result[0].momentumScore).toBe(result[1].momentumScore);
  });

  it('uses userRating as interest score when provided', () => {
    const highInterest = makeTask({ id: 'hi', userRating: 10, estimatedMinutes: 60 });
    const lowInterest = makeTask({ id: 'lo', userRating: 1, estimatedMinutes: 60 });
    const result = prioritizeForADHD([lowInterest, highInterest]);
    expect(result[0].id).toBe('hi');
    expect(result[0].momentumScore - result[1].momentumScore).toBe(9); // 10 - 1
  });

  it('defaults interest score to 5 when userRating is undefined', () => {
    const noRating = makeTask({ id: 'nr', estimatedMinutes: 60 });
    const rated5 = makeTask({ id: 'r5', userRating: 5, estimatedMinutes: 60 });
    const result = prioritizeForADHD([noRating, rated5]);
    // Same effective score — order doesn't matter, but scores must equal
    expect(result[0].momentumScore).toBe(result[1].momentumScore);
  });

  it('assigns momentumScore, reasoning, and encouragement to each result', () => {
    const tasks: Task[] = [makeTask({ id: '1' })];
    const result = prioritizeForADHD(tasks);
    expect(result[0]).toHaveProperty('momentumScore');
    expect(result[0]).toHaveProperty('reasoning');
    expect(result[0]).toHaveProperty('encouragement');
    expect(typeof result[0].momentumScore).toBe('number');
    expect(typeof result[0].reasoning).toBe('string');
    expect(typeof result[0].encouragement).toBe('string');
  });

  it('sorts tasks in descending order by momentumScore', () => {
    const tasks: Task[] = [
      makeTask({ id: 'low', estimatedMinutes: 120, userRating: 1 }),
      makeTask({ id: 'high', estimatedMinutes: 1, userRating: 10, urgent: true }),
      makeTask({ id: 'mid', estimatedMinutes: 30, userRating: 5 }),
    ];
    const result = prioritizeForADHD(tasks);
    for (let i = 0; i < result.length - 1; i++) {
      expect(result[i].momentumScore).toBeGreaterThanOrEqual(result[i + 1].momentumScore);
    }
  });

  it('includes reasoning about urgency when task is urgent', () => {
    const task = makeTask({ urgent: true, estimatedMinutes: 60 });
    const result = prioritizeForADHD([task]);
    expect(result[0].reasoning).toContain('urgent');
  });

  it('includes reasoning about quick win for short tasks', () => {
    const task = makeTask({ estimatedMinutes: 10 });
    const result = prioritizeForADHD([task]);
    expect(result[0].reasoning).toContain('Quick win');
  });

  it('includes reasoning about high interest for rating >= 8', () => {
    const task = makeTask({ userRating: 9, estimatedMinutes: 60 });
    const result = prioritizeForADHD([task]);
    expect(result[0].reasoning).toContain('High interest');
  });

  it('generates encouragement for very short tasks (<=5 min)', () => {
    const task = makeTask({ estimatedMinutes: 3 });
    const result = prioritizeForADHD([task]);
    expect(result[0].encouragement).toContain('5 minutes');
  });

  it('generates encouragement for quick win tasks (<=15 min, >5 min)', () => {
    const task = makeTask({ estimatedMinutes: 12 });
    const result = prioritizeForADHD([task]);
    expect(result[0].encouragement).toContain('Quick win');
  });

  // Due date tests require fake timers
  describe('due date scoring', () => {
    beforeEach(() => {
      vi.useFakeTimers();
      vi.setSystemTime(new Date('2026-02-17T12:00:00Z'));
    });

    afterEach(() => {
      vi.useRealTimers();
    });

    it('adds 15 points for tasks due within 1 day', () => {
      const task = makeTask({ id: 'due-soon', dueDate: '2026-02-18', estimatedMinutes: 60 });
      const taskNoDue = makeTask({ id: 'no-due', estimatedMinutes: 60 });
      const [first] = prioritizeForADHD([taskNoDue, task]);
      expect(first.id).toBe('due-soon');
      // The difference should include the 15-point due date bonus
      const results = prioritizeForADHD([taskNoDue, task]);
      expect(results[0].momentumScore - results[1].momentumScore).toBe(15);
    });

    it('adds 10 points for tasks due within 3 days', () => {
      const task = makeTask({ id: 'due-3d', dueDate: '2026-02-19', estimatedMinutes: 60 });
      const taskNoDue = makeTask({ id: 'no-due', estimatedMinutes: 60 });
      const results = prioritizeForADHD([taskNoDue, task]);
      expect(results[0].id).toBe('due-3d');
      expect(results[0].momentumScore - results[1].momentumScore).toBe(10);
    });

    it('adds 5 points for tasks due within 7 days', () => {
      const task = makeTask({ id: 'due-7d', dueDate: '2026-02-23', estimatedMinutes: 60 });
      const taskNoDue = makeTask({ id: 'no-due', estimatedMinutes: 60 });
      const results = prioritizeForADHD([taskNoDue, task]);
      expect(results[0].id).toBe('due-7d');
      expect(results[0].momentumScore - results[1].momentumScore).toBe(5);
    });

    it('adds 0 points for tasks due more than 7 days away', () => {
      const task = makeTask({ id: 'due-far', dueDate: '2026-03-15', estimatedMinutes: 60 });
      const taskNoDue = makeTask({ id: 'no-due', estimatedMinutes: 60 });
      const results = prioritizeForADHD([taskNoDue, task]);
      expect(results[0].momentumScore).toBe(results[1].momentumScore);
    });

    it('includes due date reasoning for tasks due today/tomorrow', () => {
      const task = makeTask({ dueDate: '2026-02-17', estimatedMinutes: 60 });
      const result = prioritizeForADHD([task]);
      expect(result[0].reasoning).toContain('today/tomorrow');
    });
  });
});

// ============================================
// getNextThreeTasks
// ============================================
describe('getNextThreeTasks', () => {
  it('returns at most 3 tasks', () => {
    const tasks: Task[] = Array.from({ length: 10 }, (_, i) =>
      makeTask({ id: `t-${i}` })
    );
    const result = getNextThreeTasks(tasks);
    expect(result).toHaveLength(3);
  });

  it('returns fewer than 3 when fewer incomplete tasks exist', () => {
    const tasks: Task[] = [makeTask({ id: '1' }), makeTask({ id: '2' })];
    const result = getNextThreeTasks(tasks);
    expect(result).toHaveLength(2);
  });

  it('returns empty array when all tasks are completed', () => {
    const tasks: Task[] = [
      makeTask({ id: '1', completed: true }),
      makeTask({ id: '2', completed: true }),
    ];
    expect(getNextThreeTasks(tasks)).toEqual([]);
  });

  it('returns the highest scored tasks', () => {
    const tasks: Task[] = [
      makeTask({ id: 'low', estimatedMinutes: 120, userRating: 1 }),
      makeTask({ id: 'high', estimatedMinutes: 1, urgent: true, userRating: 10 }),
      makeTask({ id: 'mid1', estimatedMinutes: 30, userRating: 7 }),
      makeTask({ id: 'mid2', estimatedMinutes: 45, userRating: 6 }),
    ];
    const result = getNextThreeTasks(tasks);
    expect(result[0].id).toBe('high');
  });
});

// ============================================
// getQuickWins
// ============================================
describe('getQuickWins', () => {
  it('returns only tasks with estimatedMinutes <= 15', () => {
    const tasks: Task[] = [
      makeTask({ id: 'quick', estimatedMinutes: 10 }),
      makeTask({ id: 'slow', estimatedMinutes: 60 }),
      makeTask({ id: 'exact', estimatedMinutes: 15 }),
    ];
    const result = getQuickWins(tasks);
    expect(result).toHaveLength(2);
    expect(result.every(t => t.estimatedMinutes <= 15)).toBe(true);
  });

  it('returns empty array when no tasks are under 15 minutes', () => {
    const tasks: Task[] = [makeTask({ estimatedMinutes: 30 })];
    expect(getQuickWins(tasks)).toEqual([]);
  });

  it('filters out completed tasks before selecting quick wins', () => {
    const tasks: Task[] = [
      makeTask({ id: 'done', estimatedMinutes: 5, completed: true }),
      makeTask({ id: 'active', estimatedMinutes: 10 }),
    ];
    const result = getQuickWins(tasks);
    expect(result).toHaveLength(1);
    expect(result[0].id).toBe('active');
  });
});

// ============================================
// calculateMomentumBonus
// ============================================
describe('calculateMomentumBonus', () => {
  it('returns (0, 1x) for 0 consecutive completions', () => {
    const result = calculateMomentumBonus(0);
    expect(result.xpBonus).toBe(0);
    expect(result.streakMultiplier).toBe(1);
  });

  it('returns (10, 1.2x) for 1 consecutive completion', () => {
    const result = calculateMomentumBonus(1);
    expect(result.xpBonus).toBe(10);
    expect(result.streakMultiplier).toBe(1.2);
  });

  it('returns (10, 1.2x) for 2 consecutive completions', () => {
    const result = calculateMomentumBonus(2);
    expect(result.xpBonus).toBe(10);
    expect(result.streakMultiplier).toBe(1.2);
  });

  it('returns (25, 1.5x) for 3 consecutive completions', () => {
    const result = calculateMomentumBonus(3);
    expect(result.xpBonus).toBe(25);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('returns (25, 1.5x) for 4 consecutive completions', () => {
    const result = calculateMomentumBonus(4);
    expect(result.xpBonus).toBe(25);
    expect(result.streakMultiplier).toBe(1.5);
  });

  it('returns (50, 2x) for 5 consecutive completions', () => {
    const result = calculateMomentumBonus(5);
    expect(result.xpBonus).toBe(50);
    expect(result.streakMultiplier).toBe(2);
  });

  it('returns (50, 2x) for 9 consecutive completions', () => {
    const result = calculateMomentumBonus(9);
    expect(result.xpBonus).toBe(50);
    expect(result.streakMultiplier).toBe(2);
  });

  it('returns (100, 3x) for 10 consecutive completions', () => {
    const result = calculateMomentumBonus(10);
    expect(result.xpBonus).toBe(100);
    expect(result.streakMultiplier).toBe(3);
  });

  it('returns (100, 3x) for very high consecutive completions', () => {
    const result = calculateMomentumBonus(999);
    expect(result.xpBonus).toBe(100);
    expect(result.streakMultiplier).toBe(3);
  });

  it('always returns a message string', () => {
    for (const n of [0, 1, 3, 5, 10, 50]) {
      const result = calculateMomentumBonus(n);
      expect(typeof result.message).toBe('string');
      expect(result.message.length).toBeGreaterThan(0);
    }
  });
});

// ============================================
// getTwoMinuteTasks
// ============================================
describe('getTwoMinuteTasks', () => {
  it('categorizes tasks into immediate, quick, focused, and deep', () => {
    const tasks: Task[] = [
      makeTask({ id: 'imm', estimatedMinutes: 1 }),
      makeTask({ id: 'quick', estimatedMinutes: 10 }),
      makeTask({ id: 'focused', estimatedMinutes: 30 }),
      makeTask({ id: 'deep', estimatedMinutes: 90 }),
    ];
    const result = getTwoMinuteTasks(tasks);
    expect(result.immediate).toHaveLength(1);
    expect(result.immediate[0].id).toBe('imm');
    expect(result.quick).toHaveLength(1);
    expect(result.quick[0].id).toBe('quick');
    expect(result.focused).toHaveLength(1);
    expect(result.focused[0].id).toBe('focused');
    expect(result.deep).toHaveLength(1);
    expect(result.deep[0].id).toBe('deep');
  });

  it('puts exactly 2-minute tasks in immediate bucket', () => {
    const tasks: Task[] = [makeTask({ estimatedMinutes: 2 })];
    const result = getTwoMinuteTasks(tasks);
    expect(result.immediate).toHaveLength(1);
    expect(result.quick).toHaveLength(0);
  });

  it('puts exactly 15-minute tasks in quick bucket', () => {
    const tasks: Task[] = [makeTask({ estimatedMinutes: 15 })];
    const result = getTwoMinuteTasks(tasks);
    expect(result.quick).toHaveLength(1);
    expect(result.focused).toHaveLength(0);
  });

  it('puts exactly 60-minute tasks in focused bucket', () => {
    const tasks: Task[] = [makeTask({ estimatedMinutes: 60 })];
    const result = getTwoMinuteTasks(tasks);
    expect(result.focused).toHaveLength(1);
    expect(result.deep).toHaveLength(0);
  });

  it('returns all empty arrays for empty input', () => {
    const result = getTwoMinuteTasks([]);
    expect(result.immediate).toEqual([]);
    expect(result.quick).toEqual([]);
    expect(result.focused).toEqual([]);
    expect(result.deep).toEqual([]);
  });

  it('excludes completed tasks from all buckets', () => {
    const tasks: Task[] = [
      makeTask({ id: 'done', estimatedMinutes: 1, completed: true }),
      makeTask({ id: 'active', estimatedMinutes: 1 }),
    ];
    const result = getTwoMinuteTasks(tasks);
    expect(result.immediate).toHaveLength(1);
    expect(result.immediate[0].id).toBe('active');
  });
});

// ============================================
// suggestTaskForNow
// ============================================
describe('suggestTaskForNow', () => {
  it('returns null when there are no incomplete tasks', () => {
    const tasks: Task[] = [makeTask({ completed: true })];
    expect(suggestTaskForNow(tasks, 10, 'high')).toBeNull();
  });

  it('returns null for empty task list', () => {
    expect(suggestTaskForNow([], 10, 'high')).toBeNull();
  });

  it('prefers urgent tasks in the morning (6-12)', () => {
    const tasks: Task[] = [
      makeTask({ id: 'normal', estimatedMinutes: 10 }),
      makeTask({ id: 'urgent', urgent: true, estimatedMinutes: 60 }),
    ];
    const result = suggestTaskForNow(tasks, 9, 'high');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('urgent');
  });

  it('prefers medium-duration tasks in the afternoon (12-18)', () => {
    const tasks: Task[] = [
      makeTask({ id: 'short', estimatedMinutes: 5 }),
      makeTask({ id: 'medium', estimatedMinutes: 30 }),
      makeTask({ id: 'long', estimatedMinutes: 120 }),
    ];
    const result = suggestTaskForNow(tasks, 14, 'medium');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('medium');
  });

  it('prefers quick tasks in the evening with low energy', () => {
    const tasks: Task[] = [
      makeTask({ id: 'quick', estimatedMinutes: 10 }),
      makeTask({ id: 'long', estimatedMinutes: 60 }),
    ];
    const result = suggestTaskForNow(tasks, 20, 'low');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('quick');
  });

  it('prefers fun tasks (rating >= 7) in the evening with non-low energy', () => {
    const tasks: Task[] = [
      makeTask({ id: 'boring', estimatedMinutes: 60, userRating: 3 }),
      makeTask({ id: 'fun', estimatedMinutes: 60, userRating: 8 }),
    ];
    const result = suggestTaskForNow(tasks, 19, 'medium');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('fun');
  });

  it('falls back to top prioritized task when no special match', () => {
    const tasks: Task[] = [
      makeTask({ id: 'only', estimatedMinutes: 60 }),
    ];
    // Hour 23 (night) — no special time range matches
    const result = suggestTaskForNow(tasks, 23, 'medium');
    expect(result).not.toBeNull();
    expect(result?.id).toBe('only');
  });

  it('falls back to top task in morning when no urgent tasks exist', () => {
    const tasks: Task[] = [
      makeTask({ id: 'a', estimatedMinutes: 5 }),
      makeTask({ id: 'b', estimatedMinutes: 10 }),
    ];
    const result = suggestTaskForNow(tasks, 8, 'high');
    // No urgent tasks, so falls through to default (top prioritized)
    expect(result).not.toBeNull();
  });

  it('falls back to top task in afternoon when no medium-duration tasks exist', () => {
    const tasks: Task[] = [
      makeTask({ id: 'tiny', estimatedMinutes: 2 }),
      makeTask({ id: 'huge', estimatedMinutes: 120 }),
    ];
    const result = suggestTaskForNow(tasks, 15, 'high');
    // No 15-45 min tasks — falls through to default
    expect(result).not.toBeNull();
  });
});
