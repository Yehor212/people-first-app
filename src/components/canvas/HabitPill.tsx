/**
 * HabitPill — Level 2 outline-only pill node for individual habits.
 *
 * 120×36 transparent pill with white/20 border (incomplete) or
 * emerald border + tint (complete). Toggles on tap with haptics.
 */

import { Check } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';
import { IdentityIcon } from '@/components/IdentityIconPicker';
import type { MindMapHabitNode } from './mindMapLayout';

interface HabitPillProps {
  node: MindMapHabitNode;
  canvasCenter: { x: number; y: number };
  onToggle: () => void;
}

export function HabitPill({ node, canvasCenter, onToggle }: HabitPillProps) {
  return (
    <button
      onClick={() => {
        void haptics.habitCompleted();
        onToggle();
      }}
      className={cn(
        'absolute rounded-full',
        'border',
        node.completed
          ? 'border-emerald-400/60 bg-emerald-500/10'
          : 'border-white/20',
        'flex items-center gap-1.5 px-2.5',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        'transition-colors duration-200',
      )}
      style={{
        left: canvasCenter.x + node.x - node.pill.width / 2,
        top: canvasCenter.y + node.y - node.pill.height / 2,
        width: node.pill.width,
        height: node.pill.height,
      }}
      aria-label={`${node.habit.name}${node.completed ? ' (done)' : ''}`}
    >
      {node.completed ? (
        <Check className="w-3.5 h-3.5 text-emerald-400 shrink-0" />
      ) : (
        <IdentityIcon name={node.habit.icon || 'Target'} className="w-3.5 h-3.5 text-white/50 shrink-0" />
      )}
      <span className={cn(
        'text-[11px] truncate',
        node.completed ? 'text-emerald-300/80' : 'text-white/60',
      )}>
        {node.habit.name}
      </span>
    </button>
  );
}
