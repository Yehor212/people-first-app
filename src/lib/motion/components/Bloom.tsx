/**
 * <Bloom> — thin wrapper that applies the Bloom verb to a `motion.div`,
 * gated through `useShouldAnimate()`. When animations are disabled, renders
 * a plain `<div>` with children and no motion overhead.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { bloom } from '../bloom';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

export interface BloomProps extends HTMLMotionProps<'div'> {
  children?: ReactNode;
  /** Optional className forwarded to the rendered element. */
  className?: string;
  /** When true, skip the verb and render children wrapped in a plain div. */
  disabled?: boolean;
}

export function Bloom({ children, className, disabled, ...rest }: BloomProps) {
  const animate = useShouldAnimate();
  if (!animate || disabled) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={className} {...bloom} {...rest}>
      {children}
    </motion.div>
  );
}
