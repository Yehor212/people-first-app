import { type LucideIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface EdgeHandleProps {
  side: 'left' | 'right';
  icon: LucideIcon;
  label: string;
  onActivate: () => void;
}

export function EdgeHandle({ side, icon: Icon, label, onActivate }: EdgeHandleProps) {
  return (
    <button
      onClick={() => {
        void haptics.buttonPress();
        onActivate();
      }}
      aria-label={label}
      className={cn(
        'fixed z-40 w-8 h-20 rounded-full',
        'bg-surface-glass backdrop-blur-[var(--surface-glass-blur)]',
        'border border-[var(--surface-glass-border)] zen-shadow-soft',
        'flex items-center justify-center',
        'transition-opacity duration-200 hover:opacity-90 active:scale-95',
        'animate-garden-breathe',
        side === 'left' ? 'left-2' : 'right-2',
      )}
      style={{ top: '50%', transform: 'translateY(-50%)' }}
    >
      <Icon className="w-4 h-4 text-muted-foreground" />
    </button>
  );
}
