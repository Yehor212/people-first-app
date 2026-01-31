/**
 * EmptyState - Unified empty state component
 * Provides consistent styling for empty state messages across the app
 */

import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  action?: {
    label: string;
    onClick: () => void;
  };
  /** Show a badge/highlight around the CTA */
  highlight?: boolean;
  /** Size variant */
  size?: 'compact' | 'default' | 'large';
  /** Additional class names */
  className?: string;
}

const sizeClasses = {
  compact: {
    container: 'py-4',
    icon: 'w-12 h-12 text-2xl',
    title: 'text-base',
    message: 'text-xs',
  },
  default: {
    container: 'py-8',
    icon: 'w-16 h-16 text-3xl',
    title: 'text-lg',
    message: 'text-sm',
  },
  large: {
    container: 'py-12',
    icon: 'w-20 h-20 text-4xl',
    title: 'text-xl',
    message: 'text-base',
  },
};

export function EmptyState({
  icon,
  title,
  message,
  action,
  highlight = false,
  size = 'default',
  className,
}: EmptyStateProps) {
  const sizes = sizeClasses[size];

  return (
    <div className={cn("text-center", sizes.container, className)}>
      <div className={cn(
        "mx-auto mb-4 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center",
        sizes.icon
      )}>
        {icon}
      </div>

      {highlight && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-primary/25 rounded-full border border-primary/30 animate-glow-pulse mb-4">
          <span className={cn("font-bold text-primary", sizes.title === 'text-base' ? 'text-sm' : 'text-base')}>{title}</span>
        </div>
      )}

      {!highlight && (
        <h3 className={cn("font-semibold text-foreground mb-2", sizes.title)}>{title}</h3>
      )}

      {message && (
        <p className={cn("text-muted-foreground mb-4 max-w-xs mx-auto", sizes.message)}>
          {message}
        </p>
      )}

      {action && (
        <Button
          variant="gradient"
          size={size === 'compact' ? 'default' : 'lg'}
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
