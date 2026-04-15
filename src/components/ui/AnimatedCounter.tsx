/**
 * AnimatedCounter — Reusable spring-based counting animation
 *
 * Counts from 0 to target with spring overshoot settle (~800ms).
 * Triggers on scroll-into-view via IntersectionObserver.
 * Respects prefers-reduced-motion / dopamine settings.
 *
 * EP6_US006 T2: Animated Counter & Streak Display
 */

import { useEffect, useRef, useState, useCallback, memo } from "react";
import { useSpring, useMotionValueEvent } from "framer-motion";
import { shouldAnimate } from "@/lib/animationUtils";

interface AnimatedCounterProps {
  /** Target number to animate to */
  target: number;
  /** Optional suffix (e.g., " days") */
  suffix?: string;
  /** Spring stiffness (default: 100) */
  stiffness?: number;
  /** Spring damping (default: 15 for overshoot) */
  damping?: number;
  /** Additional className for the span */
  className?: string;
  /** Format function for display (default: toLocaleString for integers) */
  format?: (value: number) => string;
}

export const AnimatedCounter = memo(function AnimatedCounter({
  target,
  suffix,
  stiffness = 100,
  damping = 15,
  className,
  format,
}: AnimatedCounterProps) {
  const containerRef = useRef<HTMLSpanElement>(null);
  const hasAnimatedRef = useRef(false);
  const [display, setDisplay] = useState(shouldAnimate() ? 0 : target);
  const animate = shouldAnimate();

  const spring = useSpring(0, { stiffness, damping });

  useMotionValueEvent(spring, "change", (v) => {
    // When format is provided, preserve decimal precision (e.g., avgPerWeek = 3.5)
    // Otherwise round to integer for clean counter display
    setDisplay(format ? Math.round(v * 10) / 10 : Math.round(v));
  });

  const triggerAnimation = useCallback(() => {
    if (hasAnimatedRef.current) return;
    hasAnimatedRef.current = true;
    spring.set(target);
  }, [spring, target]);

  // IntersectionObserver trigger
  useEffect(() => {
    if (!animate) {
      setDisplay(target);
      return;
    }

    const el = containerRef.current;
    if (!el) return;

    const observer = new IntersectionObserver(
      ([entry]) => {
        if (entry.isIntersecting) {
          triggerAnimation();
          observer.disconnect();
        }
      },
      { threshold: 0.3 }
    );

    observer.observe(el);
    return () => observer.disconnect();
  }, [animate, triggerAnimation, target]);

  // Update target if it changes after animation
  useEffect(() => {
    if (hasAnimatedRef.current && animate) {
      spring.set(target);
    } else if (!animate) {
      setDisplay(target);
    }
  }, [target, spring, animate]);

  const formatted = format ? format(display) : display.toLocaleString();

  return (
    <span ref={containerRef} className={className}>
      {formatted}
      {suffix}
    </span>
  );
});
