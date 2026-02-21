/**
 * mindMapLayout — Strict trigonometric radial layout for the Mind Map Canvas.
 *
 * Pure function: clusters orbit root at R_c=300px, habits fan outward from
 * their cluster at R_h=180px. No randomness — deterministic positions only.
 *
 * Layout rules:
 *   Root: (0, 0)
 *   Clusters: R_c=300, evenly spaced from top (-PI/2); single cluster at -PI/6
 *   Habits: R_h=180 from their cluster, fanned outward; >5 habits 3-ring stagger 160/210/260
 */

import type { Habit } from '@/types';
import type { IdentityCluster } from '@/lib/identityClusters';

// ── Pill dimensions ──

export const ROOT_SIZE = { width: 80, height: 80 };
export const CLUSTER_ORBIT = 300;
export const CLUSTER_PILL = { width: 160, height: 44 };
export const HABIT_ORBIT = 180;
export const HABIT_ORBIT_BASE = 160;
export const HABIT_ORBIT_STEP = 50;
export const HABIT_PILL = { width: 120, height: 36 };

// ── Color rotation (8 Tailwind border classes, cycling) ──

export const CLUSTER_COLORS = [
  'border-emerald-400',
  'border-sky-400',
  'border-amber-400',
  'border-rose-400',
  'border-violet-400',
  'border-cyan-400',
  'border-orange-400',
  'border-pink-400',
] as const;

export const COLOR_HEX_MAP: Record<string, string> = {
  'border-emerald-400': '#34d399',
  'border-sky-400': '#38bdf8',
  'border-amber-400': '#fbbf24',
  'border-rose-400': '#fb7185',
  'border-violet-400': '#a78bfa',
  'border-cyan-400': '#22d3ee',
  'border-orange-400': '#fb923c',
  'border-pink-400': '#f472b6',
};

// ── Types ──

export interface PillDimensions {
  width: number;
  height: number;
}

export interface MindMapNode {
  id: string;
  x: number;
  y: number;
  pill: PillDimensions;
  type: 'root' | 'cluster' | 'habit';
}

export interface MindMapHabitNode extends MindMapNode {
  habit: Habit;
  completed: boolean;
  parentColor: string;
  parentColorHex: string;
}

export interface MindMapClusterNode extends MindMapNode {
  cluster: IdentityCluster;
  habits: MindMapHabitNode[];
  color: string;
  colorHex: string;
}

export interface MindMapLayout {
  root: MindMapNode;
  clusters: MindMapClusterNode[];
  canvasSize: { width: number; height: number };
}

// ── Layout computation ──

export function computeMindMapLayout(
  clusters: IdentityCluster[],
  today: string,
): MindMapLayout {
  const root: MindMapNode = {
    id: 'root',
    x: 0,
    y: 0,
    pill: ROOT_SIZE,
    type: 'root',
  };

  const N = clusters.length;

  const clusterNodes: MindMapClusterNode[] = clusters.map((cluster, i) => {
    // Cluster angle: single cluster at -PI/6 (upper-right), multiple evenly from top
    const angle = N === 1
      ? -Math.PI / 6
      : (2 * Math.PI * i) / N - Math.PI / 2;

    const cx = Math.cos(angle) * CLUSTER_ORBIT;
    const cy = Math.sin(angle) * CLUSTER_ORBIT;

    const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

    // ── Habit fan layout ──
    const M = cluster.habits.length;
    // Fan spread: min(144°, (M-1)*0.35 rad) — narrows for few habits
    const spread = M > 1
      ? Math.min(Math.PI * 0.8, (M - 1) * 0.35)
      : 0;

    const habitNodes: MindMapHabitNode[] = cluster.habits.map((habit, j) => {
      // Habit angle: fan centered on cluster's radial angle
      const habitAngle = M > 1
        ? angle - spread / 2 + (spread * j) / (M - 1)
        : angle; // single habit goes straight out

      // Overlap guard: 3-ring stagger for >5 habits (160/210/260)
      const radius = M > 5
        ? HABIT_ORBIT_BASE + (j % 3) * HABIT_ORBIT_STEP
        : HABIT_ORBIT;

      const hx = cx + Math.cos(habitAngle) * radius;
      const hy = cy + Math.sin(habitAngle) * radius;

      return {
        id: `habit-${habit.id}`,
        x: hx,
        y: hy,
        pill: HABIT_PILL,
        type: 'habit' as const,
        habit,
        completed: habit.completedDates?.includes(today) ?? false,
        parentColor: color,
        parentColorHex: COLOR_HEX_MAP[color] || '#ffffff',
      };
    });

    return {
      id: `cluster-${cluster.name}`,
      x: cx,
      y: cy,
      pill: CLUSTER_PILL,
      type: 'cluster' as const,
      cluster,
      habits: habitNodes,
      color,
      colorHex: COLOR_HEX_MAP[color] || '#ffffff',
    };
  });

  // Compute canvas size from node extents + padding
  const allX = [0, ...clusterNodes.flatMap(c => [c.x, ...c.habits.map(h => h.x)])];
  const allY = [0, ...clusterNodes.flatMap(c => [c.y, ...c.habits.map(h => h.y)])];
  const pad = 200;
  const maxExtent = Math.max(
    Math.abs(Math.min(...allX)) + pad,
    Math.abs(Math.max(...allX)) + pad,
    Math.abs(Math.min(...allY)) + pad,
    Math.abs(Math.max(...allY)) + pad,
  );
  const size = Math.max(maxExtent * 2, 800);

  return {
    root,
    clusters: clusterNodes,
    canvasSize: { width: size, height: size },
  };
}
