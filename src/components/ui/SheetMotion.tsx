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
      'fixed inset-0 z-[55] bg-black/60 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)] data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
    ref={ref}
  />
));
SheetMotionOverlay.displayName = 'SheetMotionOverlay';

const sheetMotionVariants = cva(
  'fixed z-[60] flex flex-col gap-4 bg-background p-6 shadow-lg isolate',
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
function motionForSide(side: SheetSide) {
  const offsetMap: Record<SheetSide, { x?: number; y?: number }> = {
    top: { y: -16 },
    bottom: { y: 16 },
    left: { x: -16 },
    right: { x: 16 },
  };
  const offset = offsetMap[side];
  return {
    initial: { ...bloom.initial, ...offset },
    animate: { ...bloom.animate, x: 0, y: 0 },
    exit: { ...fold.exit, ...offset },
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
  const { t } = useLanguage();
  const animate = useShouldAnimate();
  const sideKey: SheetSide = (side ?? 'right');

  const safeStyle =
    sideKey === 'bottom'
      ? {
          position: 'fixed' as const,
          bottom: 0,
          left: 0,
          right: 0,
          zIndex: 80,
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
              'absolute right-4 top-4 rounded-xl p-2 z-50 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-all',
              'bg-slate-200/80 dark:bg-white/10 backdrop-blur-sm border border-slate-300 dark:border-white/10',
              'opacity-70 hover:opacity-100 hover:bg-slate-300/80 dark:hover:bg-white/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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

  const variant = motionForSide(sideKey);

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
              'absolute right-4 top-4 rounded-xl p-2 z-50 min-w-[44px] min-h-[44px] flex items-center justify-center motion-safe:transition-all',
              'bg-slate-200/80 dark:bg-white/10 backdrop-blur-sm border border-slate-300 dark:border-white/10',
              'opacity-70 hover:opacity-100 hover:bg-slate-300/80 dark:hover:bg-white/20',
              'focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-violet-500/50 focus-visible:ring-offset-2 focus-visible:ring-offset-background',
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
