import { forwardRef, type ReactNode } from "react";
import { motion, useIsPresent } from "framer-motion";

import { motionPresets, zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

interface SettingsMotionSurfaceProps {
  children: ReactNode;
  view: "overview" | "detail";
  shouldAnimate: boolean;
}

export const SettingsMotionSurface = forwardRef<HTMLDivElement, SettingsMotionSurfaceProps>(
  function SettingsMotionSurface({ children, view, shouldAnimate }, ref) {
    const isPresent = useIsPresent();

    return (
      <motion.div
        ref={ref}
        inert={!isPresent}
        aria-hidden={!isPresent ? true : undefined}
        initial={shouldAnimate ? { opacity: 0.92 } : false}
        animate={motionPresets.fadeIn.animate}
        exit={shouldAnimate ? { opacity: 0.35 } : motionPresets.fadeIn.animate}
        transition={shouldAnimate ? zenMotion.exit : zenMotion.instant}
        className={cn("min-w-0", !isPresent && "pointer-events-none")}
        data-exiting={!isPresent ? "true" : undefined}
        data-settings-motion-surface={view}
      >
        {children}
      </motion.div>
    );
  }
);
