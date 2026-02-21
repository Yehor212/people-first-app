/**
 * canvasLayout — Pure trigonometric layout for Spatial Canvas.
 *
 * Central Orb → Clusters (radial orbit) → Habits (child orbit).
 * All coords relative to canvas center (0, 0).
 * NaN-safe: guards against division by zero.
 */

import type { IdentityCluster } from '@/lib/identityClusters';
import type { Habit } from '@/types';

export interface LayoutNode {
  id: string;
  x: number;
  y: number;
  radius: number;
  type: 'orb' | 'cluster' | 'habit';
}

export interface HabitLayoutNode extends LayoutNode {
  habit: Habit;
  completed: boolean;
}

export interface ClusterLayoutNode extends LayoutNode {
  cluster: IdentityCluster;
  habits: HabitLayoutNode[];
}

export interface CanvasLayout {
  orb: LayoutNode;
  clusters: ClusterLayoutNode[];
}

export const ORB_RADIUS = 40;
export const CLUSTER_ORBIT = 180;
export const CLUSTER_RADIUS = 32;
export const HABIT_ORBIT = 70;
export const HABIT_RADIUS = 24;

export function computeCanvasLayout(
  clusters: IdentityCluster[],
  today: string,
): CanvasLayout {
  const orb: LayoutNode = {
    id: 'central-orb',
    x: 0,
    y: 0,
    radius: ORB_RADIUS,
    type: 'orb',
  };

  const N = clusters.length;
  const clusterNodes: ClusterLayoutNode[] = clusters.map((cluster, i) => {
    // NaN guard: N > 0 guaranteed by .map iteration
    const angle = N > 0 ? (2 * Math.PI * i) / N - Math.PI / 2 : 0;
    const cx = Math.cos(angle) * CLUSTER_ORBIT;
    const cy = Math.sin(angle) * CLUSTER_ORBIT;

    const M = cluster.habits.length;
    const habitNodes: HabitLayoutNode[] = cluster.habits.map((habit, j) => {
      const childAngle = M > 0 ? (2 * Math.PI * j) / M - Math.PI / 2 : 0;
      const hx = cx + Math.cos(childAngle) * HABIT_ORBIT;
      const hy = cy + Math.sin(childAngle) * HABIT_ORBIT;

      return {
        id: `habit-${habit.id}`,
        x: hx,
        y: hy,
        radius: HABIT_RADIUS,
        type: 'habit' as const,
        habit,
        completed: habit.completedDates?.includes(today) ?? false,
      };
    });

    return {
      id: `cluster-${cluster.name}`,
      x: cx,
      y: cy,
      radius: CLUSTER_RADIUS,
      type: 'cluster' as const,
      cluster,
      habits: habitNodes,
    };
  });

  return { orb, clusters: clusterNodes };
}
