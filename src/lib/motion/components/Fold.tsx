/**
 * <Fold> — thin wrapper that applies the Fold verb to a `motion.div`.
 * Pair with Framer Motion's `<AnimatePresence>` so `exit` runs on unmount.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { fold } from '../fold';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

export interface FoldProps extends HTMLMotionProps<'div'> {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Fold({ children, className, disabled, transition, ...rest }: FoldProps) {
  const animate = useShouldAnimate();
  if (!animate || disabled) {
    return <div className={className}>{children}</div>;
  }
  return (
    <motion.div className={className} {...fold} {...rest} transition={{ ...fold.transition, ...transition }}>
      {children}
    </motion.div>
  );
}
