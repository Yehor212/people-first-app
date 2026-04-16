import { memo, useState, useCallback } from "react";
import { AnimatePresence, motion, useReducedMotion } from "framer-motion";
import { hapticMedium } from "@/lib/haptics";

interface ThemeTransitionOverlayProps {
  isTransitioning: boolean;
  onTransitionEnd: () => void;
}

export const ThemeTransitionOverlay = memo(function ThemeTransitionOverlay({
  isTransitioning,
  onTransitionEnd,
}: ThemeTransitionOverlayProps) {
  const reducedMotion = useReducedMotion();

  if (reducedMotion) return null;

  return (
    <AnimatePresence mode="wait">
      {isTransitioning && (
        <motion.div
          key="theme-transition"
          className="fixed inset-0 z-[75] pointer-events-none bg-background/20 will-change-[opacity,filter]"
          initial={{ opacity: 1, filter: "blur(0px)" }}
          animate={{
            opacity: [1, 0.3, 1],
            filter: ["blur(0px)", "blur(8px)", "blur(0px)"],
          }}
          exit={{ opacity: 0 }}
          transition={{ duration: 0.4, ease: "easeInOut" }}
          onAnimationComplete={onTransitionEnd}
        />
      )}
    </AnimatePresence>
  );
});

export function useThemeTransition() {
  const [isTransitioning, setIsTransitioning] = useState(false);
  const reducedMotion = useReducedMotion();

  const triggerTransition = useCallback(() => {
    if (reducedMotion) return;
    setIsTransitioning(true);
    void hapticMedium();
  }, [reducedMotion]);

  const onTransitionEnd = useCallback(() => {
    setIsTransitioning(false);
  }, []);

  return { isTransitioning, triggerTransition, onTransitionEnd } as const;
}
