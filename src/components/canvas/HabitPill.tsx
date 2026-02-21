/**
 * HabitPill — Level 2 pill node for individual habits.
 *
 * Deep glassmorphism with completion state styling.
 * Hover glow matches parent cluster color. PopIn entrance animation.
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
  animDelay: number;
}

export function HabitPill({ node, canvasCenter, onToggle, animDelay }: HabitPillProps) {
  return (
    <button
      onClick={() => {
        void haptics.habitCompleted();
        onToggle();
      }}
      className={cn(
        'absolute rounded-full',
        'backdrop-blur-md',
        'border',
        node.completed
          ? 'bg-emerald-900/40 border-emerald-400/40'
          : 'bg-slate-800/70 border-white/10',
        'flex items-center gap-1.5 px-2.5',
        'animate-canvas-pop-in',
        'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-400',
        'transition-shadow duration-300',
      )}
      style={{
        left: canvasCenter.x + node.x - node.pill.width / 2,
        top: canvasCenter.y + node.y - node.pill.height / 2,
        width: node.pill.width,
        height: node.pill.height,
        animationDelay: `${animDelay}ms`,
      }}
      onPointerEnter={(e) => {
        const color = node.completed ? '#34d39940' : `${node.parentColorHex}30`;
        (e.currentTarget as HTMLElement).style.boxShadow = `0 0 16px ${color}`;
      }}
      onPointerLeave={(e) => {
        (e.currentTarget as HTMLElement).style.boxShadow = '';
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
