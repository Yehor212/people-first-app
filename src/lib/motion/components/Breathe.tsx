/**
 * <Breathe> — infinite idle pulse, reduced-motion aware.
 *
 * When animations are permitted, applies the breathing scale + opacity loop.
 * When NOT permitted (OS reduced-motion, Dopamine off, low battery), renders
 * a plain `<div>` — the pulse stops, visuals stay visible.
 */

import { motion, type HTMLMotionProps } from 'framer-motion';
import type { ReactNode } from 'react';
import { breathe } from '../breathe';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

export interface BreatheProps extends HTMLMotionProps<'div'> {
  children?: ReactNode;
  className?: string;
  disabled?: boolean;
}

export function Breathe({ children, className, disabled, ...rest }: BreatheProps) {
  const animate = useShouldAnimate();
  if (!animate || disabled) {
    return <div className={className}>{children}</div>;
  }
  const motionProps = {
    ...breathe,
    animate: {
      scale: [...breathe.animate.scale],
      opacity: [...breathe.animate.opacity],
    },
  };
  return (
    <motion.div className={className} {...motionProps} {...rest}>
      {children}
    </motion.div>
  );
}
