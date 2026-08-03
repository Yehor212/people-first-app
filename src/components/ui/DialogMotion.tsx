/**
 * DialogMotion — additive variant of Dialog that runs through the motion
 * grammar (Bloom on enter, Fold on exit) while remaining API-compatible
 * with the shadcn/Radix Dialog primitive.
 *
 * Opt-in: consumers that want verb-driven motion change their import from
 *   `import { Dialog, DialogContent, ... } from '@/components/ui/dialog'`
 * to
 *   `import { DialogMotion as Dialog, DialogMotionContent as DialogContent, ... } from '@/components/ui/DialogMotion'`
 * Original Dialog stays untouched so dozens of call sites keep working.
 *
 * Honours AGENTS.md and docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md:
 *   - max-w-lg default, rounded-2xl, shadow-2xl on desktop
 *   - z-[70] content, z-[60] overlay (per existing Dialog numbering)
 *   - overflow-y-auto — never clips
 */

import * as DialogPrimitive from '@radix-ui/react-dialog';
import { X } from 'lucide-react';
import * as React from 'react';

import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { bloom, fold } from '@/lib/motion';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';
import { motion } from 'framer-motion';

const DialogMotion = DialogPrimitive.Root;

const DialogMotionTrigger = DialogPrimitive.Trigger;

const DialogMotionPortal = DialogPrimitive.Portal;

const DialogMotionClose = DialogPrimitive.Close;

const DialogMotionOverlay = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Overlay>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Overlay>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Overlay
    ref={ref}
    className={cn(
      'fixed inset-0 z-[60] bg-black/80 data-[state=open]:animate-in data-[state=closed]:animate-out data-[state=closed]:fade-out-0 data-[state=open]:fade-in-0',
      className,
    )}
    {...props}
  />
));
DialogMotionOverlay.displayName = 'DialogMotionOverlay';

const DialogMotionContent = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Content>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Content>
>(({ className, children, ...props }, ref) => {
  const { t } = useLanguage();
  const animate = useShouldAnimate();

  // When animation is suppressed, render the plain Radix Content so there
  // is zero motion overhead — matches rest of the grammar's gating behavior.
  if (!animate) {
    return (
      <DialogMotionPortal>
        <DialogMotionOverlay />
        <DialogPrimitive.Content
          ref={ref}
          className={cn(
            'fixed left-[50%] top-[50%] z-[70] grid w-[calc(100%-2rem)] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl max-h-[calc(100dvh-4rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg rounded-2xl md:rounded-2xl md:shadow-2xl',
            className,
          )}
          {...props}
          aria-modal="true"
        >
          {children}
          <DialogPrimitive.Close
            aria-label={t.close}
            className="absolute end-4 top-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg opacity-70 ring-offset-background motion-safe:transition-all hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t.close}</span>
          </DialogPrimitive.Close>
        </DialogPrimitive.Content>
      </DialogMotionPortal>
    );
  }

  // Motion path — Radix controls mount/unmount, framer-motion controls
  // the enter (Bloom) and exit (Fold) keyframes via initial/animate/exit.
  return (
    <DialogMotionPortal>
      <DialogMotionOverlay />
      <DialogPrimitive.Content ref={ref} asChild {...props} aria-modal="true">
        <motion.div
          initial={bloom.initial}
          animate={bloom.animate}
          exit={{ ...fold.exit, transition: fold.transition }}
          transition={bloom.transition}
          className={cn(
            'fixed left-[50%] top-[50%] z-[70] grid w-[calc(100%-2rem)] max-w-lg md:max-w-xl lg:max-w-2xl xl:max-w-3xl max-h-[calc(100dvh-4rem)] overflow-y-auto translate-x-[-50%] translate-y-[-50%] gap-4 border bg-background p-6 shadow-lg rounded-2xl md:rounded-2xl md:shadow-2xl',
            className,
          )}
        >
          {children}
          <DialogPrimitive.Close
            aria-label={t.close}
            className="absolute end-4 top-4 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-lg opacity-70 ring-offset-background motion-safe:transition-all hover:opacity-100 hover:bg-muted focus:outline-none focus:ring-2 focus:ring-ring focus:ring-offset-2 disabled:pointer-events-none"
          >
            <X className="h-4 w-4" />
            <span className="sr-only">{t.close}</span>
          </DialogPrimitive.Close>
        </motion.div>
      </DialogPrimitive.Content>
    </DialogMotionPortal>
  );
});
DialogMotionContent.displayName = 'DialogMotionContent';

const DialogMotionHeader = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col space-y-1.5 text-center sm:text-start', className)}
    {...props}
  />
);
DialogMotionHeader.displayName = 'DialogMotionHeader';

const DialogMotionFooter = ({ className, ...props }: React.HTMLAttributes<HTMLDivElement>) => (
  <div
    className={cn('flex flex-col-reverse sm:flex-row sm:justify-end sm:space-x-2', className)}
    {...props}
  />
);
DialogMotionFooter.displayName = 'DialogMotionFooter';

const DialogMotionTitle = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Title>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Title>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Title
    ref={ref}
    className={cn('text-lg font-semibold leading-none tracking-tight', className)}
    {...props}
  />
));
DialogMotionTitle.displayName = 'DialogMotionTitle';

const DialogMotionDescription = React.forwardRef<
  React.ElementRef<typeof DialogPrimitive.Description>,
  React.ComponentPropsWithoutRef<typeof DialogPrimitive.Description>
>(({ className, ...props }, ref) => (
  <DialogPrimitive.Description
    ref={ref}
    className={cn('text-sm text-muted-foreground', className)}
    {...props}
  />
));
DialogMotionDescription.displayName = 'DialogMotionDescription';

export {
  DialogMotion,
  DialogMotionPortal,
  DialogMotionOverlay,
  DialogMotionClose,
  DialogMotionTrigger,
  DialogMotionContent,
  DialogMotionHeader,
  DialogMotionFooter,
  DialogMotionTitle,
  DialogMotionDescription,
};
