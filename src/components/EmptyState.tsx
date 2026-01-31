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
  /** Additional class names */
  className?: string;
}

export function EmptyState({
  icon,
  title,
  message,
  action,
  highlight = false,
  className,
}: EmptyStateProps) {
  return (
    <div className={cn("text-center py-8", className)}>
      <div className="w-16 h-16 mx-auto mb-4 bg-primary/10 rounded-2xl flex items-center justify-center text-3xl">
        {icon}
      </div>

      {highlight && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 rounded-full border border-primary/30 animate-glow-pulse mb-4">
          <span className="text-sm font-bold text-primary">{title}</span>
        </div>
      )}

      {!highlight && (
        <h3 className="text-lg font-semibold text-foreground mb-2">{title}</h3>
      )}

      {message && (
        <p className="text-muted-foreground text-sm mb-4 max-w-xs mx-auto">
          {message}
        </p>
      )}

      {action && (
        <Button
          variant="gradient"
          size="lg"
          onClick={action.onClick}
        >
          {action.label}
        </Button>
      )}
    </div>
  );
}
