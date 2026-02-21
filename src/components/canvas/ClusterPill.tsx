/**
 * ClusterPill — Level 1 pill node for identity clusters.
 *
 * Deep glassmorphism pill (bg-slate-800/85) with colored border accent,
 * hover glow effect, and staggered popIn entrance animation.
 */

import { cn } from '@/lib/utils';
import { IdentityIcon } from '@/components/IdentityIconPicker';
import type { MindMapClusterNode } from './mindMapLayout';

interface ClusterPillProps {
  node: MindMapClusterNode;
  canvasCenter: { x: number; y: number };
  index: number;
}

export function ClusterPill({ node, canvasCenter, index }: ClusterPillProps) {
  return (
    <div
      className={cn(
        'absolute rounded-full',
        'bg-slate-800/85 backdrop-blur-lg',
        'border', node.color,
        'flex items-center gap-2 px-3',
        'animate-canvas-pop-in',
        'transition-shadow duration-300',
      )}
      style={{
        left: canvasCenter.x + node.x - node.pill.width / 2,
        top: canvasCenter.y + node.y - node.pill.height / 2,
        width: node.pill.width,
        height: node.pill.height,
        animationDelay: `${index * 80}ms`,
        // Hover glow via CSS custom property
        '--node-glow': `0 0 20px ${node.colorHex}4D`,
      } as React.CSSProperties}
      onPointerEnter={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 24px ${node.colorHex}40`;
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
      }}
    >
      <IdentityIcon name={node.cluster.icon} className="w-4 h-4 shrink-0 text-white/70" />
      <span className="text-xs font-medium text-white/90 truncate">
        {node.cluster.name}
      </span>
    </div>
  );
}
