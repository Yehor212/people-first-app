/**
 * ClusterNode — Identity cluster positioned at (x, y) on the canvas.
 */

import { cn } from '@/lib/utils';
import { IdentityIcon } from '@/components/IdentityIconPicker';
import type { IdentityCluster } from '@/lib/identityClusters';

interface ClusterNodeProps {
  cluster: IdentityCluster;
  x: number;
  y: number;
  radius: number;
}

export function ClusterNode({ cluster, x, y, radius }: ClusterNodeProps) {
  const size = radius * 2;
  const percent = cluster.weeklyAlignmentPercent;

  return (
    <div
      className="absolute animate-zen-float"
      style={{
        left: `calc(50% + ${x}px)`,
        top: `calc(50% + ${y}px)`,
        width: size,
        height: size,
        transform: 'translate(-50%, -50%)',
      }}
    >
      {/* Alignment ring (SVG arc) */}
      <svg
        className="absolute inset-0"
        width={size}
        height={size}
        viewBox={`0 0 ${size} ${size}`}
      >
        <circle
          cx={radius}
          cy={radius}
          r={radius - 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={2}
          className="text-border"
        />
        <circle
          cx={radius}
          cy={radius}
          r={radius - 2}
          fill="none"
          stroke="currentColor"
          strokeWidth={2.5}
          className="text-emerald-500"
          strokeDasharray={`${(percent / 100) * 2 * Math.PI * (radius - 2)} ${2 * Math.PI * (radius - 2)}`}
          strokeDashoffset={0}
          strokeLinecap="round"
          transform={`rotate(-90 ${radius} ${radius})`}
        />
      </svg>

      {/* Glass body */}
      <div className={cn(
        'absolute inset-1 rounded-full',
        'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
        'border border-[var(--surface-glass-border)]',
        'flex items-center justify-center',
      )}>
        <IdentityIcon name={cluster.icon} className="w-4 h-4 text-foreground/70" />
      </div>

      {/* Label */}
      <span className="absolute -bottom-4 left-1/2 -translate-x-1/2 text-[9px] font-medium text-muted-foreground whitespace-nowrap max-w-[60px] truncate text-center">
        {cluster.name}
      </span>
    </div>
  );
}
