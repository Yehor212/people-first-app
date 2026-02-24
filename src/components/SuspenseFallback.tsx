/**
 * Unified Suspense Fallback Components
 * Consistent loading states across lazy-loaded components
 *
 * Provides standardized loading skeletons to replace ad-hoc
 * animate-pulse divs, spinners, and null fallbacks.
 */

import { cn } from '@/lib/utils';
import { PremiumLoader } from '@/components/PremiumLoader';

interface SuspenseFallbackProps {
  /** Height of the skeleton (Tailwind class like 'h-24' or pixel value) */
  height?: string;
  /** Whether this is a card-style component */
  card?: boolean;
  /** Additional CSS classes */
  className?: string;
}

/**
 * Card-style skeleton for lazy-loaded panel components
 */
export function CardSkeleton({ height = 'h-24', className }: SuspenseFallbackProps) {
  return (
    <div
      className={cn(
        'bg-card rounded-3xl animate-pulse',
        height,
        className
      )}
      aria-hidden="true"
      role="presentation"
    />
  );
}

/**
 * Full-page loading spinner for route-level lazy loading
 */
export function PageSpinner() {
  return (
    <div
      className="fixed inset-0 z-50 bg-background flex items-center justify-center"
      role="status"
      aria-label="Loading"
    >
      <PremiumLoader size="lg" />
    </div>
  );
}

/**
 * Inline spinner for small lazy-loaded elements
 */
export function InlineSpinner({ className }: { className?: string }) {
  return (
    <div className={cn('flex items-center justify-center p-4', className)}>
      <PremiumLoader size="sm" />
    </div>
  );
}

/**
 * Modal skeleton for lazy-loaded dialogs
 */
export function ModalSkeleton() {
  return (
    <div
      className="fixed inset-0 z-50 bg-black/50 flex items-center justify-center"
      aria-hidden="true"
      role="presentation"
    >
      <div className="w-full max-w-md mx-4 h-96 bg-card rounded-2xl animate-pulse" />
    </div>
  );
}

/**
 * Generic fallback that returns null but with proper typing
 * Use when component doesn't need a visual placeholder
 */
export function EmptyFallback() {
  return null;
}

export default CardSkeleton;
