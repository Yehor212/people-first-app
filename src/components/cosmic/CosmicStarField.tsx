import type { CSSProperties } from "react";

export interface CosmicStarConfig {
  id: number | string;
  x: number;
  y: number;
  size: number;
  delay: number;
}

type CosmicStarStyle = CSSProperties & {
  "--particle-duration": string;
  "--particle-delay": string;
};

/**
 * Shared theme-aware particle for cosmic surfaces.
 * Keep this module small so route backgrounds do not import modal code.
 */
export function CosmicStar({ x, y, size, delay }: CosmicStarConfig) {
  return (
    <div
      className="zen-particle absolute rounded-full"
      style={
        {
          left: `${x}%`,
          top: `${y}%`,
          width: size,
          height: size,
          backgroundColor: "var(--particle-color)",
          "--particle-duration": `${2 + delay}s`,
          "--particle-delay": `${delay}s`,
        } as CosmicStarStyle
      }
    />
  );
}

// Shared seed for the existing focus and V2 cosmic backdrops.
export const cosmicStars: CosmicStarConfig[] = Array.from({ length: 15 }, (_, i) => ({
  id: i,
  x: Math.random() * 100,
  y: Math.random() * 100,
  size: 1 + Math.random() * 2,
  delay: Math.random() * 3,
}));
