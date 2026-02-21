/**
 * goalTreeLayout — Recursive radial layout for the Goal Tree on the Mind Map Canvas.
 *
 * Pure function: builds a tree from the flat CanvasGoal[] array, positions nodes
 * in polar coordinates radiating outward from Root, and computes recursive progress.
 *
 * Layout rules:
 *   Root-level goals: GOAL_ORBIT (250px) from canvas center, fanned in right hemisphere
 *                     (avoiding the upper zone reserved for the Emotion panel)
 *   Subtasks: SUB_ORBIT (150px) from their parent, fanned within the parent's corridor
 *   Deeper nesting: same SUB_ORBIT, corridor narrows recursively
 *
 * Angular corridor system:
 *   Each root-level goal receives an angular sector bounded by midpoints to its neighbors.
 *   Children are clamped to their parent's corridor, preventing inter-branch collisions.
 *   The corridor narrows at each depth level, enforcing strict non-overlap.
 *
 * Angular avoidance: the top 60° (from -120° to -60°, i.e. roughly "up") is reserved
 * for the Emotion flow GrowingEdge, so root-level goals fan from -50° clockwise to +210°.
 */

import type { CanvasGoal } from '@/types';

// ── Constants ──

const GOAL_ORBIT = 250;
const SUB_ORBIT = 150;

/** Angular zone reserved for the Emotion GrowingEdge (in radians) */
const AVOID_START = (-120 * Math.PI) / 180; // -2π/3
const AVOID_END = (-60 * Math.PI) / 180;    // -π/3

/** Root goals fan range: from AVOID_END clockwise around to AVOID_START */
const FAN_START = AVOID_END + 0.15;  // ~-50° — just past the exclusion zone
const FAN_END = AVOID_START + 2 * Math.PI - 0.15; // ~+230° — just before it wraps

/** Desired subtask spread per child (30° in radians) — clamped by corridor */
const SUB_SPREAD_PER_CHILD = (30 * Math.PI) / 180;
const SUB_SPREAD_MAX = (120 * Math.PI) / 180;

// ── Types ──

export interface Point {
  x: number;
  y: number;
}

export interface GoalTreeNode {
  goal: CanvasGoal;
  x: number;
  y: number;
  parentX: number;
  parentY: number;
  angle: number;
  depth: number;
  progressPercent: number; // 0–1
}

export interface GoalTreeLayout {
  nodes: GoalTreeNode[];
}

// ── Progress computation ──

/**
 * Recursively compute completion progress for a goal.
 * - Leaf (no children): completed ? 1 : 0
 * - Branch: average of children's progress
 */
export function computeProgress(goalId: string, goals: CanvasGoal[]): number {
  const goal = goals.find(g => g.id === goalId);
  if (!goal) return 0;

  const children = goals.filter(g => g.parentId === goalId);
  if (children.length === 0) return goal.completed ? 1 : 0;

  const total = children.reduce((sum, c) => sum + computeProgress(c.id, goals), 0);
  return total / children.length;
}

// ── Layout computation ──

export function computeGoalTreeLayout(
  goals: CanvasGoal[],
  rootCenter: Point,
): GoalTreeLayout {
  if (goals.length === 0) return { nodes: [] };

  const nodes: GoalTreeNode[] = [];

  // Root-level goals (parentId === null), sorted by order
  const rootGoals = goals
    .filter(g => g.parentId === null)
    .sort((a, b) => a.order - b.order);

  const N = rootGoals.length;

  // Compute angles for root goals
  const rootAngles = rootGoals.map((_, i) =>
    N === 1
      ? (FAN_START + FAN_END) / 2
      : FAN_START + ((FAN_END - FAN_START) * i) / (N - 1),
  );

  rootGoals.forEach((goal, i) => {
    const angle = rootAngles[i];
    const x = rootCenter.x + Math.cos(angle) * GOAL_ORBIT;
    const y = rootCenter.y + Math.sin(angle) * GOAL_ORBIT;
    const progress = computeProgress(goal.id, goals);

    // Compute this goal's angular corridor: bounded by midpoints to neighbors
    let corridorMin: number;
    let corridorMax: number;

    if (N === 1) {
      // Single goal: gets the full fan
      corridorMin = FAN_START;
      corridorMax = FAN_END;
    } else if (i === 0) {
      corridorMin = FAN_START;
      corridorMax = (rootAngles[0] + rootAngles[1]) / 2;
    } else if (i === N - 1) {
      corridorMin = (rootAngles[N - 2] + rootAngles[N - 1]) / 2;
      corridorMax = FAN_END;
    } else {
      corridorMin = (rootAngles[i - 1] + rootAngles[i]) / 2;
      corridorMax = (rootAngles[i] + rootAngles[i + 1]) / 2;
    }

    nodes.push({
      goal,
      x,
      y,
      parentX: rootCenter.x,
      parentY: rootCenter.y,
      angle,
      depth: 0,
      progressPercent: progress,
    });

    // Recursively lay out children within this corridor
    layoutChildren(goal.id, x, y, angle, corridorMin, corridorMax, 1, goals, nodes);
  });

  return { nodes };
}

function layoutChildren(
  parentId: string,
  parentX: number,
  parentY: number,
  parentAngle: number,
  corridorMin: number,
  corridorMax: number,
  depth: number,
  allGoals: CanvasGoal[],
  nodes: GoalTreeNode[],
): void {
  const children = allGoals
    .filter(g => g.parentId === parentId)
    .sort((a, b) => a.order - b.order);

  if (children.length === 0) return;

  const M = children.length;
  const corridorWidth = corridorMax - corridorMin;

  // Desired spread: min(120°, (N-1)×30°), but CLAMPED to the available corridor
  const desiredSpread = M === 1 ? 0 : Math.min(SUB_SPREAD_MAX, (M - 1) * SUB_SPREAD_PER_CHILD);
  const spread = Math.min(desiredSpread, corridorWidth * 0.9); // 90% of corridor to leave margin

  // Compute child angles, centered on parentAngle, clamped within corridor
  const childAngles = children.map((_, j) => {
    const raw = M === 1
      ? parentAngle
      : parentAngle - spread / 2 + (spread * j) / (M - 1);
    // Clamp to corridor bounds with small inner margin
    const margin = corridorWidth * 0.05;
    return Math.max(corridorMin + margin, Math.min(corridorMax - margin, raw));
  });

  children.forEach((child, j) => {
    const childAngle = childAngles[j];
    const x = parentX + Math.cos(childAngle) * SUB_ORBIT;
    const y = parentY + Math.sin(childAngle) * SUB_ORBIT;
    const progress = computeProgress(child.id, allGoals);

    // Child's corridor: bounded by midpoints to sibling angles
    let childCorridorMin: number;
    let childCorridorMax: number;

    if (M === 1) {
      childCorridorMin = corridorMin;
      childCorridorMax = corridorMax;
    } else if (j === 0) {
      childCorridorMin = corridorMin;
      childCorridorMax = (childAngles[0] + childAngles[1]) / 2;
    } else if (j === M - 1) {
      childCorridorMin = (childAngles[M - 2] + childAngles[M - 1]) / 2;
      childCorridorMax = corridorMax;
    } else {
      childCorridorMin = (childAngles[j - 1] + childAngles[j]) / 2;
      childCorridorMax = (childAngles[j] + childAngles[j + 1]) / 2;
    }

    nodes.push({
      goal: child,
      x,
      y,
      parentX,
      parentY,
      angle: childAngle,
      depth,
      progressPercent: progress,
    });

    // Recurse with narrowed corridor
    layoutChildren(child.id, x, y, childAngle, childCorridorMin, childCorridorMax, depth + 1, allGoals, nodes);
  });
}
