/**
 * EnergyPaths — SVG Bezier curves connecting Orb → Clusters → Habits.
 *
 * Fix 2: Animated completion pulse travels Habit → Cluster → Orb
 * via <animateMotion> on a <circle> element.
 */

import type { CanvasLayout } from './canvasLayout';
import type { MoodType, Habit } from '@/types';

const ENERGY_OPACITY: Record<string, number> = {
  'high-high': 1,
  'high-medium': 0.8,
  'high-low': 0.6,
  'medium-high': 0.7,
  'medium-medium': 0.8,
  'medium-low': 0.9,
  'low-high': 0.3,
  'low-medium': 0.5,
  'low-low': 0.9,
};

function energyFromMood(mood: MoodType | null): 'low' | 'medium' | 'high' {
  if (!mood) return 'medium';
  if (mood === 'great' || mood === 'good') return 'high';
  if (mood === 'okay') return 'medium';
  return 'low';
}

function getHabitEffort(habit: Habit): 'low' | 'medium' | 'high' {
  if (habit.requiresDuration && (habit.targetDuration || 0) >= 30) return 'high';
  if (habit.type === 'reduce') return 'medium';
  return 'low';
}

/** Quadratic bezier control point perpendicular to midpoint */
function bezierPath(x1: number, y1: number, x2: number, y2: number): string {
  const mx = (x1 + x2) / 2;
  const my = (y1 + y2) / 2;
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Perpendicular offset — 30% of half-distance
  const cx = mx + dy * 0.15;
  const cy = my - dx * 0.15;
  return `M ${x1},${y1} Q ${cx},${cy} ${x2},${y2}`;
}

/** Reversed path for pulse animation (Habit → Cluster → Orb) */
function reversedBezierPath(x1: number, y1: number, x2: number, y2: number): string {
  return bezierPath(x2, y2, x1, y1);
}

interface EnergyPathsProps {
  layout: CanvasLayout;
  latestMood: MoodType | null;
  recentlyCompleted: string[];
  onPulseEnd: (habitId: string) => void;
}

export function EnergyPaths({ layout, latestMood, recentlyCompleted, onPulseEnd }: EnergyPathsProps) {
  const energy = energyFromMood(latestMood);
  // Canvas center offset — SVG viewBox is centered around (cx, cy)
  const cx = 0;
  const cy = 0;

  // Collect all paths
  const paths: { id: string; d: string; opacity: number; dashed: boolean }[] = [];

  for (const cluster of layout.clusters) {
    // Orb → Cluster
    paths.push({
      id: `orb-${cluster.id}`,
      d: bezierPath(cx, cy, cluster.x, cluster.y),
      opacity: 0.4,
      dashed: false,
    });

    // Cluster → each Habit
    for (const habit of cluster.habits) {
      const effort = getHabitEffort(habit.habit);
      const key = `${energy}-${effort}`;
      const opacity = ENERGY_OPACITY[key] ?? 0.5;
      const dashed = energy === 'low' && effort === 'high';

      paths.push({
        id: `${cluster.id}-${habit.id}`,
        d: bezierPath(cluster.x, cluster.y, habit.x, habit.y),
        opacity,
        dashed,
      });
    }
  }

  // Compute viewBox to fit all nodes with padding
  const allX = [0, ...layout.clusters.flatMap(c => [c.x, ...c.habits.map(h => h.x)])];
  const allY = [0, ...layout.clusters.flatMap(c => [c.y, ...c.habits.map(h => h.y)])];
  const pad = 60;
  const minX = Math.min(...allX) - pad;
  const minY = Math.min(...allY) - pad;
  const maxX = Math.max(...allX) + pad;
  const maxY = Math.max(...allY) + pad;
  const width = maxX - minX;
  const height = maxY - minY;

  // Build pulse animation paths: Habit → Cluster → Orb
  const pulses: { habitId: string; path: string }[] = [];
  for (const hid of recentlyCompleted) {
    for (const cluster of layout.clusters) {
      const habitNode = cluster.habits.find(h => h.habit.id === hid);
      if (habitNode) {
        // Habit → Cluster
        const p1 = reversedBezierPath(cluster.x, cluster.y, habitNode.x, habitNode.y);
        // Cluster → Orb
        const p2 = reversedBezierPath(cx, cy, cluster.x, cluster.y);
        pulses.push({ habitId: hid, path: `${p1} ${p2}` });
        break;
      }
    }
  }

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      style={{ left: '50%', top: '50%', transform: 'translate(-50%, -50%)' }}
      width={width}
      height={height}
      viewBox={`${minX} ${minY} ${width} ${height}`}
    >
      {/* Energy paths */}
      {paths.map(p => (
        <path
          key={p.id}
          d={p.d}
          fill="none"
          stroke="currentColor"
          strokeWidth={1.5}
          className="text-foreground/20"
          style={{ opacity: p.opacity }}
          strokeDasharray={p.dashed ? '4 4' : undefined}
        />
      ))}

      {/* Completion pulse animations (Fix 2) */}
      {pulses.map(p => (
        <circle
          key={`pulse-${p.habitId}`}
          r={4}
          className="text-emerald-500"
          fill="currentColor"
        >
          <animateMotion
            dur="0.8s"
            fill="freeze"
            path={p.path}
            onEnd={() => onPulseEnd(p.habitId)}
          />
        </circle>
      ))}
    </svg>
  );
}
