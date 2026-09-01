/**
 * SheetMotion — additive variant of Sheet that uses the motion grammar's
 * Bloom (enter) and Fold (exit) verbs instead of the default slide classes.
 * Sibling of the original Sheet — opt-in per call site, original untouched.
 *
 * Honours AGENTS.md and docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md: safe-area insets preserved on
 * `bottom` side, 44px touch target on close button, z-[60] content, z-[55]
 * overlay. Side choreography:
 *   - right  (default)  bloom from slight scale-up on the end edge
 *   - left               mirror of right
 *   - bottom             bloom-from-below (y: 16 → 0)
 *   - top                bloom-from-above
 */

import * as SheetPrimitive from '@radix-ui/react-dialog';
import { cva, type VariantProps } from 'class-variance-authority';
import { X } from 'lucide-react';
import * as React from 'react';
import { motion } from 'framer-motion';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { bloom, fold, easings } from '@/lib/motion';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

const SheetMotion = SheetPrimitive.Root;

const SheetMotionTrigger = SheetPrimitive.Trigger;

const SheetMotionClose = SheetPrimitive.Close;

const SheetMotionPortal = SheetPrimitive.Portal;

const SheetMotionOverlay = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Overlay
    className={cn(
      'fixed inset-0 z-[var(--z-sheet-overlay)] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetMotionOverlay.displayName = 'SheetMotionOverlay';

const sheetMotionVariants = cva(
  'fixed z-[var(--z-sheet)] flex flex-col gap-4 bg-background p-6 shadow-lg isolate',
  {
    variants: {
      side: {
        top: 'inset-x-0 top-0 border-b',
        bottom:
          'inset-x-0 bottom-0 border-t min-h-[50dvh] will-change-transform lg:max-w-4xl lg:mx-auto lg:rounded-t-2xl',
        left: 'inset-y-0 start-0 h-full w-3/4 border-e sm:max-w-sm lg:max-w-md xl:max-w-lg',
        right: 'inset-y-0 end-0 h-full w-3/4 border-s sm:max-w-sm lg:max-w-md xl:max-w-lg',
      },
    },
    defaultVariants: {
      side: 'right',
    },
  },
);

type SheetSide = 'top' | 'bottom' | 'left' | 'right';

/**
 * Compose Bloom with side-aware entry offset (y for top/bottom, x for
 * left/right) so a sheet feels like it slides in from its edge rather
 * than scaling from centre.
 */
function motionForSide(side: SheetSide, isRTL: boolean) {
  const offsetMap: Record<SheetSide, { x?: number; y?: number }> = {
    top: { y: -16 },
    bottom: { y: 16 },
    left: { x: -16 },
    right: { x: 16 },
  };
  let offset = offsetMap[side];
  // RTL: left/right sheets physically flip, so entry direction flips too.
  if (isRTL && (side === 'left' || side === 'right')) {
    offset = side === 'left' ? { x: 16 } : { x: -16 };
  }
  return {
    initial: { ...bloom.initial, ...offset },
    animate: { ...bloom.animate, x: 0, y: 0 },
    // Exits accelerate (M3 direction rule) with the Fold verb's own timing.
    exit: { ...fold.exit, ...offset, transition: fold.transition },
    transition: { duration: 0.32, ease: easings.bloomOut },
  };
}

interface SheetMotionContentProps
  extends React.ComponentPropsWithoutRef<typeof SheetPrimitive.Content>,
    VariantProps<typeof sheetMotionVariants> {}

const SheetMotionContent = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Content>,
  SheetMotionContentProps
>(({ side = 'right', className, children, ...props }, ref) => {
  const { t, isRTL } = useLanguage();
  const animate = useShouldAnimate();
  const sideKey: SheetSide = (side ?? 'right');

  const safeStyle =
    sideKey === 'bottom'
      ? {
          position: 'fixed' as const,
          bottom: 0,
          left: 0,
          right: 0,
          paddingBottom: 'env(safe-area-inset-bottom, 0px)',
        }
      : undefined;

  if (!animate) {
    return (
      <SheetMotionPortal>
        <SheetMotionOverlay />
        <SheetPrimitive.Content
          ref={ref}
          style={safeStyle}
          className={cn(sheetMotionVariants({ side }), 'relative', className)}
          {...props}
        >
          <SheetPrimitive.Close
            aria-label={t.close}
            className={cn(
              'absolute end-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm motion-safe:transition-all',
              'opacity-70 hover:bg-secondary hover:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:pointer-events-none',
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t.close}</span>
          </SheetPrimitive.Close>
          {children}
        </SheetPrimitive.Content>
      </SheetMotionPortal>
    );
  }

  const variant = motionForSide(sideKey, isRTL);

  return (
    <SheetMotionPortal>
      <SheetMotionOverlay />
      <SheetPrimitive.Content ref={ref} asChild {...props}>
        <motion.div
          initial={variant.initial}
          animate={variant.animate}
          exit={variant.exit}
          transition={variant.transition}
          style={safeStyle}
          className={cn(sheetMotionVariants({ side }), 'relative', className)}
        >
          <SheetPrimitive.Close
            aria-label={t.close}
            className={cn(
              'absolute end-4 top-4 z-10 flex min-h-[44px] min-w-[44px] items-center justify-center rounded-xl border border-border bg-secondary/80 p-2 text-secondary-foreground backdrop-blur-sm motion-safe:transition-all',
              'opacity-70 hover:bg-secondary hover:opacity-100',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 focus-visible:ring-offset-background',
              'disabled:pointer-events-none',
            )}
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t.close}</span>
          </SheetPrimitive.Close>
          {children}
        </motion.div>
      </SheetPrimitive.Content>
    </SheetMotionPortal>
  );
});
SheetMotionContent.displayName = 'SheetMotionContent';

const SheetMotionHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-2 text-center sm:text-start', className)}
    {...props}
  />
);
SheetMotionHeader.displayName = 'SheetMotionHeader';

const SheetMotionFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
SheetMotionFooter.displayName = 'SheetMotionFooter';

const SheetMotionTitle = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Title>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold text-foreground', className)}
    {...props}
  />
));
SheetMotionTitle.displayName = 'SheetMotionTitle';

const SheetMotionDescription = React.forwardRef<
  React.ElementRef<typeof SheetPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof SheetPrimitive.Description>
>(({ className, ...props }, ref) => (
  <SheetPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
SheetMotionDescription.displayName = 'SheetMotionDescription';

export {
  SheetMotion,
  SheetMotionClose,
  SheetMotionContent,
  SheetMotionDescription,
  SheetMotionFooter,
  SheetMotionHeader,
  SheetMotionOverlay,
  SheetMotionPortal,
  SheetMotionTitle,
  SheetMotionTrigger,
};
