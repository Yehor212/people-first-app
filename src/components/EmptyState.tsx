/**
 * EmptyState - Unified empty state component
 * Provides consistent styling for empty state messages across the app
 * Enhanced with hints and quick actions for better UX guidance
 */

import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { Button } from '@/components/ui/button';
import { Lightbulb } from 'lucide-react';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';

interface EmptyStateProps {
  icon: React.ReactNode;
  title: string;
  message?: string;
  /** Contextual hint explaining what to do next */
  hint?: string;
  action?: {
    label: string;
    onClick: () => void;
    icon?: React.ReactNode;
  };
  /** Quick secondary action (e.g., "Learn more") */
  secondaryAction?: {
    label: string;
    onClick: () => void;
  };
  /** Show a badge/highlight around the CTA */
  highlight?: boolean;
  /** Size variant */
  size?: 'compact' | 'default' | 'large';
  /** Optional animated illustration rendered above the icon */
  animationSlot?: React.ReactNode;
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
  hint,
  action,
  secondaryAction,
  highlight = false,
  size = 'default',
  animationSlot,
  className,
}: EmptyStateProps) {
  const sizes = sizeClasses[size];

  return (
    <motion.div
      initial={shouldAnimate() ? { opacity: 0, y: 8 } : false}
      animate={{ opacity: 1, y: 0 }}
      transition={zenMotion.gentle}
      className={cn("text-center", sizes.container, className)}
    >
      {/* Optional animated illustration above the icon */}
      {animationSlot && (
        <div className="mx-auto mb-2 flex items-center justify-center">
          {animationSlot}
        </div>
      )}

      <div className={cn(
        "mx-auto mb-4 bg-primary/10 dark:bg-primary/20 rounded-2xl flex items-center justify-center",
        sizes.icon
      )}>
        {icon}
      </div>

      {highlight && (
        <div className="inline-flex items-center gap-2 px-4 py-2 bg-primary/15 dark:bg-primary/25 rounded-full border border-primary/30 mb-4">
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

      {/* Contextual hint with lightbulb icon */}
      {hint && (
        <div className={cn(
          "inline-flex items-center gap-2 px-3 py-2 rounded-xl mb-4 max-w-sm mx-auto",
          "bg-amber-500/10 dark:bg-amber-500/20 border border-amber-500/20"
        )}>
          <Lightbulb className="w-4 h-4 text-amber-600 dark:text-amber-400 shrink-0" />
          <p className={cn("text-amber-700 dark:text-amber-300 text-start", sizes.message)}>
            {hint}
          </p>
        </div>
      )}

      {/* Primary action button */}
      {action && (
        <Button
          variant="gradient"
          size={size === 'compact' ? 'default' : 'lg'}
          onClick={action.onClick}
          className={cn(
            "h-auto min-w-0 max-w-full gap-2 whitespace-normal break-words py-2.5",
            size === 'compact' ? 'min-h-11 px-4' : 'min-h-12 px-5'
          )}
        >
          {action.icon ? (
            <span className="flex shrink-0 items-center justify-center">
              {action.icon}
            </span>
          ) : null}
          <span className="min-w-0 text-center [hyphens:manual] [overflow-wrap:normal]">
            {action.label}
          </span>
        </Button>
      )}

      {/* Secondary action link */}
      {secondaryAction && (
        <button
          onClick={secondaryAction.onClick}
          className={cn(
            "block mx-auto mt-3 text-muted-foreground hover:text-foreground motion-safe:transition-colors",
            sizes.message
          )}
        >
          {secondaryAction.label}
        </button>
      )}
    </motion.div>
  );
}
