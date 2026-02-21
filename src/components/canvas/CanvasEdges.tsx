/**
 * CanvasEdges — SVG layer with cubic Bezier curves and gradient strokes.
 *
 * Root → Cluster edges use white→cluster color gradient.
 * Cluster → Habit edges use cluster color→transparent gradient.
 * Completion pulse animates Habit → Cluster → Root via <animateMotion>.
 */

import type { MindMapLayout } from './mindMapLayout';
import { COLOR_HEX_MAP } from './mindMapLayout';
import type { MoodType, Habit } from '@/types';

// ── Energy/effort mapping (reused from EnergyPaths) ──

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

// ── Cubic Bezier path (S-curve with two control points) ──

function cubicBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  // Perpendicular normal
  const nx = -dy;
  const ny = dx;
  const len = Math.sqrt(nx * nx + ny * ny) || 1;
  // 15% of segment length as offset magnitude
  const offset = len * 0.15;
  const ux = (nx / len) * offset;
  const uy = (ny / len) * offset;

  // Control point 1: 1/3 along + perpendicular offset
  const cp1x = x1 + dx * 0.33 + ux;
  const cp1y = y1 + dy * 0.33 + uy;
  // Control point 2: 2/3 along - perpendicular offset (S-curve)
  const cp2x = x1 + dx * 0.67 - ux;
  const cp2y = y1 + dy * 0.67 - uy;

  return `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
}

function reversedCubicBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  return cubicBezierPath(x2, y2, x1, y1);
}

// ── Types ──

interface Edge {
  id: string;
  d: string;
  startHex: string;
  endHex: string;
  opacity: number;
  dashed: boolean;
  // Absolute coordinates for gradient direction
  x1: number; y1: number;
  x2: number; y2: number;
}

interface CanvasEdgesProps {
  layout: MindMapLayout;
  canvasCenter: { x: number; y: number };
  latestMood: MoodType | null;
  recentlyCompleted: string[];
  onPulseEnd: (habitId: string) => void;
}

export function CanvasEdges({
  layout, canvasCenter, latestMood,
  recentlyCompleted, onPulseEnd,
}: CanvasEdgesProps) {
  const energy = energyFromMood(latestMood);
  const { x: ox, y: oy } = canvasCenter; // Absolute root position

  const edges: Edge[] = [];

  for (const cluster of layout.clusters) {
    const clusterHex = COLOR_HEX_MAP[cluster.color] || '#ffffff';
    const ax = ox + cluster.x;
    const ay = oy + cluster.y;

    // Root → Cluster: white fading to cluster color
    edges.push({
      id: `root-${cluster.id}`,
      d: cubicBezierPath(ox, oy, ax, ay),
      startHex: 'rgba(255,255,255,0.3)',
      endHex: clusterHex,
      opacity: 0.4,
      dashed: false,
      x1: ox, y1: oy, x2: ax, y2: ay,
    });

    // Cluster → each Habit
    for (const habit of cluster.habits) {
      const hx = ox + habit.x;
      const hy = oy + habit.y;
      const effort = getHabitEffort(habit.habit);
      const key = `${energy}-${effort}`;
      const opacity = ENERGY_OPACITY[key] ?? 0.5;
      const dashed = energy === 'low' && effort === 'high';

      edges.push({
        id: `${cluster.id}-${habit.id}`,
        d: cubicBezierPath(ax, ay, hx, hy),
        startHex: clusterHex,
        endHex: clusterHex,
        opacity,
        dashed,
        x1: ax, y1: ay, x2: hx, y2: hy,
      });
    }
  }

  // Completion pulse paths (Habit → Cluster → Root)
  const pulses: { habitId: string; path: string }[] = [];
  for (const hid of recentlyCompleted) {
    for (const cluster of layout.clusters) {
      const habitNode = cluster.habits.find(h => h.habit.id === hid);
      if (habitNode) {
        const ax = ox + cluster.x;
        const ay = oy + cluster.y;
        const hx = ox + habitNode.x;
        const hy = oy + habitNode.y;
        // Reversed: Habit → Cluster
        const p1 = reversedCubicBezierPath(ax, ay, hx, hy);
        // Reversed: Cluster → Root
        const p2 = reversedCubicBezierPath(ox, oy, ax, ay);
        pulses.push({ habitId: hid, path: `${p1} ${p2}` });
        break;
      }
    }
  }

  const { width, height } = layout.canvasSize;

  return (
    <svg
      className="absolute inset-0 pointer-events-none"
      width={width}
      height={height}
      viewBox={`0 0 ${width} ${height}`}
    >
      <defs>
        {edges.map(edge => (
          <linearGradient
            key={`grad-${edge.id}`}
            id={`grad-${edge.id}`}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop offset="0%" stopColor={edge.startHex} stopOpacity={0.4} />
            <stop offset="100%" stopColor={edge.endHex} stopOpacity={0.15} />
          </linearGradient>
        ))}
      </defs>

      {/* Edge paths */}
      {edges.map(edge => (
        <path
          key={edge.id}
          d={edge.d}
          fill="none"
          stroke={`url(#grad-${edge.id})`}
          strokeWidth={1.5}
          style={{ opacity: edge.opacity }}
          strokeDasharray={edge.dashed ? '4 4' : undefined}
        />
      ))}

      {/* Completion pulse animations */}
      {pulses.map(p => (
        <circle
          key={`pulse-${p.habitId}`}
          r={4}
          fill="#34d399"
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
