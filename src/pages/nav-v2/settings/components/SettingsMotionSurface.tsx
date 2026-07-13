import type { ComponentProps, ComponentType, ReactNode } from "react";
import { motion, useIsPresent } from "framer-motion";

import { motionPresets, zenMotion } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";

// React 18's DOM types predate the now-baseline `inert` attribute. Keep the
// runtime attribute typed locally until the project moves to React 19 types.
const InertMotionDiv = motion.div as ComponentType<
  ComponentProps<typeof motion.div> & { inert?: "" }
>;

export function SettingsMotionSurface({
  children,
  view,
  shouldAnimate,
}: {
  children: ReactNode;
  view: "overview" | "detail";
  shouldAnimate: boolean;
}) {
  const isPresent = useIsPresent();

  return (
    <InertMotionDiv
      inert={!isPresent ? "" : undefined}
      aria-hidden={!isPresent ? true : undefined}
      initial={false}
      animate={motionPresets.fadeIn.animate}
      exit={shouldAnimate ? motionPresets.fadeIn.initial : motionPresets.fadeIn.animate}
      transition={shouldAnimate ? zenMotion.exit : zenMotion.instant}
      className={cn("min-w-0", !isPresent && "pointer-events-none")}
      data-settings-motion-surface={view}
    >
      {children}
    </InertMotionDiv>
  );
}
