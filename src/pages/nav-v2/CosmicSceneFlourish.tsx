import type { ReactNode } from "react";
import { CosmicSceneDecoration } from "./CosmicSceneHost";
import { useCosmicParallax } from "./useCosmicParallax";

function ParallaxFlourish({ children, testId }: { children: ReactNode; testId?: string }) {
  const parallaxRef = useCosmicParallax<HTMLDivElement>();
  return (
    <div
      ref={parallaxRef}
      aria-hidden="true"
      className="cosmic-scene-flourish pointer-events-none absolute inset-0 z-0 overflow-hidden"
      data-testid={testId}
    >
      {children}
    </div>
  );
}

/** The ref effect mounts with the actual portal element, never an empty slot. */
export function CosmicSceneFlourish(props: { children: ReactNode; testId?: string }) {
  return (
    <CosmicSceneDecoration>
      <ParallaxFlourish {...props} />
    </CosmicSceneDecoration>
  );
}
