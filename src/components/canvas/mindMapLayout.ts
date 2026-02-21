/**
 * mindMapLayout — Organic radial layout for the Mind Map Canvas.
 *
 * Pure function: clusters orbit root at 280px with deterministic jitter,
 * habits fan outward from their cluster in a 144° sector.
 * No randomness — stableHash(name) produces repeatable organic offsets.
 */

import type { Habit } from '@/types';
import type { IdentityCluster } from '@/lib/identityClusters';

// ── Pill dimensions ──

export const ROOT_SIZE = { width: 80, height: 80 };
export const CLUSTER_ORBIT = 280;
export const CLUSTER_PILL = { width: 140, height: 44 };
export const HABIT_ORBIT = 120;
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
}

export interface MindMapClusterNode extends MindMapNode {
  cluster: IdentityCluster;
  habits: MindMapHabitNode[];
  color: string;
}

export interface MindMapLayout {
  root: MindMapNode;
  clusters: MindMapClusterNode[];
  canvasSize: { width: number; height: number };
}

// ── Deterministic hash → 0..1 ──

function stableHash(str: string): number {
  let h = 0;
  for (let i = 0; i < str.length; i++) {
    h = ((h << 5) - h + str.charCodeAt(i)) | 0;
  }
  return (Math.abs(h) % 1000) / 1000;
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
    // Base angle: evenly spaced, starting at top (-PI/2)
    const baseAngle = N > 0 ? (2 * Math.PI * i) / N - Math.PI / 2 : 0;

    // Deterministic jitter for organic feel
    const hash1 = stableHash(cluster.name);
    const hash2 = stableHash(cluster.name + 'r');
    const angleJitter = (hash1 - 0.5) * 0.3;  // ±0.15 radians (~8.5°)
    const radiusJitter = (hash2 - 0.5) * 60;   // ±30px

    const angle = baseAngle + angleJitter;
    const radius = CLUSTER_ORBIT + radiusJitter;
    const cx = Math.cos(angle) * radius;
    const cy = Math.sin(angle) * radius;

    const color = CLUSTER_COLORS[i % CLUSTER_COLORS.length];

    // Habit sub-layout: fan outward from cluster in a 144° sector
    const M = cluster.habits.length;
    const habitSpread = Math.PI * 0.8; // 144°
    const habitStartAngle = angle - habitSpread / 2;

    const habitNodes: MindMapHabitNode[] = cluster.habits.map((habit, j) => {
      const habitAngle = M > 1
        ? habitStartAngle + (habitSpread * j) / (M - 1)
        : angle; // single habit goes straight out

      const hHash = stableHash(habit.id || habit.name);
      const hJitter = (hHash - 0.5) * 20; // ±10px
      const hx = cx + Math.cos(habitAngle) * (HABIT_ORBIT + hJitter);
      const hy = cy + Math.sin(habitAngle) * (HABIT_ORBIT + hJitter);

      return {
        id: `habit-${habit.id}`,
        x: hx,
        y: hy,
        pill: HABIT_PILL,
        type: 'habit' as const,
        habit,
        completed: habit.completedDates?.includes(today) ?? false,
        parentColor: color,
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
  const size = Math.max(maxExtent * 2, 800); // Minimum 800px

  return {
    root,
    clusters: clusterNodes,
    canvasSize: { width: size, height: size },
  };
}
