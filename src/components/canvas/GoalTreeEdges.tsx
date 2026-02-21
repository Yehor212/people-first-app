/**
 * GoalTreeEdges — SVG layer with Cubic Bezier curves connecting goal tree nodes.
 *
 * Each edge runs from parentX,parentY → x,y with an S-curve.
 * Gradient: white/20 → emerald for completed edges, white/20 → white/10 for incomplete.
 * Completed edges glow brighter. Incomplete edges are dashed.
 */

import type { GoalTreeNode } from './goalTreeLayout';

// ── Bezier S-curve (same math as CanvasEdges) ──

const BEZIER_TENSION = 0.5;

function cubicBezierPath(
  x1: number, y1: number,
  x2: number, y2: number,
): string {
  const dx = x2 - x1;
  const dy = y2 - y1;
  const dist = Math.sqrt(dx * dx + dy * dy) || 1;

  const nx = -dy / dist;
  const ny = dx / dist;
  const offset = dist * BEZIER_TENSION * 0.3;

  const cp1x = x1 + dx / 3 + nx * offset;
  const cp1y = y1 + dy / 3 + ny * offset;
  const cp2x = x1 + (2 * dx) / 3 - nx * offset;
  const cp2y = y1 + (2 * dy) / 3 - ny * offset;

  return `M ${x1},${y1} C ${cp1x},${cp1y} ${cp2x},${cp2y} ${x2},${y2}`;
}

// ── Types ──

interface GoalEdge {
  id: string;
  d: string;
  x1: number; y1: number;
  x2: number; y2: number;
  completed: boolean;
}

interface GoalTreeEdgesProps {
  nodes: GoalTreeNode[];
  canvasSize: number;
}

export function GoalTreeEdges({ nodes, canvasSize }: GoalTreeEdgesProps) {
  if (nodes.length === 0) return null;

  const edges: GoalEdge[] = nodes.map(node => ({
    id: `goal-edge-${node.goal.id}`,
    d: cubicBezierPath(node.parentX, node.parentY, node.x, node.y),
    x1: node.parentX,
    y1: node.parentY,
    x2: node.x,
    y2: node.y,
    completed: node.goal.completed || node.progressPercent >= 1,
  }));

  return (
    <svg
      className="absolute inset-0 pointer-events-none z-0"
      width={canvasSize}
      height={canvasSize}
      viewBox={`0 0 ${canvasSize} ${canvasSize}`}
    >
      <defs>
        {edges.map(edge => (
          <linearGradient
            key={`ggrad-${edge.id}`}
            id={`ggrad-${edge.id}`}
            x1={edge.x1}
            y1={edge.y1}
            x2={edge.x2}
            y2={edge.y2}
            gradientUnits="userSpaceOnUse"
          >
            <stop
              offset="0%"
              stopColor={edge.completed ? 'rgba(52,211,153,0.4)' : 'rgba(255,255,255,0.2)'}
            />
            <stop
              offset="100%"
              stopColor={edge.completed ? 'rgba(52,211,153,0.2)' : 'rgba(255,255,255,0.06)'}
            />
          </linearGradient>
        ))}
      </defs>

      {edges.map(edge => (
        <path
          key={edge.id}
          d={edge.d}
          fill="none"
          stroke={`url(#ggrad-${edge.id})`}
          strokeWidth={1.5}
          strokeLinecap="round"
          strokeDasharray={edge.completed ? undefined : '6 4'}
          style={{ opacity: edge.completed ? 0.8 : 0.4 }}
        />
      ))}
    </svg>
  );
}
