/**
 * ClusterPill — Level 1 pill node for identity clusters.
 *
 * 140×44 glassmorphic pill with colored border and IdentityIcon.
 */

import { cn } from '@/lib/utils';
import { IdentityIcon } from '@/components/IdentityIconPicker';
import type { MindMapClusterNode } from './mindMapLayout';

interface ClusterPillProps {
  node: MindMapClusterNode;
  canvasCenter: { x: number; y: number };
}

export function ClusterPill({ node, canvasCenter }: ClusterPillProps) {
  return (
    <div
      className={cn(
        'absolute rounded-full',
        'bg-white/5 backdrop-blur-md',
        'border', node.color,
        'flex items-center gap-2 px-3',
        'animate-zen-float',
      )}
      style={{
        left: canvasCenter.x + node.x - node.pill.width / 2,
        top: canvasCenter.y + node.y - node.pill.height / 2,
        width: node.pill.width,
        height: node.pill.height,
      }}
    >
      <IdentityIcon name={node.cluster.icon} className="w-4 h-4 shrink-0 text-white/70" />
      <span className="text-xs font-medium text-white/90 truncate">
        {node.cluster.name}
      </span>
    </div>
  );
}
