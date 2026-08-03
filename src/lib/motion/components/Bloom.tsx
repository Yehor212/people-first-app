/**
 * <Bloom> — thin wrapper that applies the Bloom verb to a stable `motion.div`,
 * gated through `useShouldAnimate()`. Reduced motion uses the zero-duration
 * identity variant so preference changes never remount stateful children.
 */

import { isValidMotionProp, motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { bloom, bloomStatic } from '../bloom';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

export interface BloomProps extends HTMLMotionProps<'div'> {
  children?: ReactNode;
  /** Optional className forwarded to the rendered element. */
  className?: string;
  /** When true, settle immediately without remounting the wrapper or its children. */
  disabled?: boolean;
}

function keepNonMotionProps(props: HTMLMotionProps<'div'>): HTMLMotionProps<'div'> {
  return Object.fromEntries(
    Object.entries(props).filter(([key]) => key === 'style' || !isValidMotionProp(key)),
  );
}

export function Bloom({ children, className, disabled, transition, ...rest }: BloomProps) {
  const animate = useShouldAnimate() && !disabled;
  // Merge caller transition keys over the verb timing instead of replacing
  // it — a bare `staggerDelay()` object must not silently downgrade the
  // bloomOut glide to framer-motion library defaults.
  const resolvedProps = animate
    ? { ...bloom, ...rest, transition: { ...bloom.transition, ...transition } }
    : { ...keepNonMotionProps(rest), ...bloomStatic };

  return (
    <motion.div
      className={className}
      {...resolvedProps}
    >
      {children}
    </motion.div>
  );
}
