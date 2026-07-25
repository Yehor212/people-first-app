import { forwardRef, type ComponentProps, type ComponentType, type ReactNode } from "react";
import { motion, useIsPresent } from "framer-motion";

import { motionPresets, zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

// React 18's DOM types predate the now-baseline `inert` attribute. Keep the
// runtime attribute typed locally until the project moves to React 19 types.
const InertMotionDiv = motion.div as ComponentType<
  ComponentProps<typeof motion.div> & { inert?: "" }
>;

interface SettingsMotionSurfaceProps {
  children: ReactNode;
  view: "overview" | "detail";
  shouldAnimate: boolean;
}

export const SettingsMotionSurface = forwardRef<HTMLDivElement, SettingsMotionSurfaceProps>(
  function SettingsMotionSurface({ children, view, shouldAnimate }, ref) {
    const isPresent = useIsPresent();

    return (
      <InertMotionDiv
        ref={ref}
        inert={!isPresent ? "" : undefined}
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
      </InertMotionDiv>
    );
  }
);
