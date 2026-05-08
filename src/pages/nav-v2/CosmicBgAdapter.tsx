import { memo, type CSSProperties } from "react";
import { motion } from "framer-motion";
import { CosmicStar, cosmicStars } from "@/components/FocusReflectionModal";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useThemeStore } from "@/stores/themeStore";
import { DayCosmicBackground } from "./DayCosmicBackground";
import "./CosmicBgAdapter.css";

type CosmicBgVariant = "auto" | "day" | "night" | "starry";

interface CosmicBgAdapterProps {
  /**
   * `auto` keeps the theme-switch behaviour. OrbPage can force `day` when the
   * product direction wants the calm sky scene independent of app theme.
   */
  variant?: CosmicBgVariant;
}

type StarStyle = CSSProperties & {
  "--star-x": string;
  "--star-y": string;
  "--star-size": string;
  "--star-opacity": number;
  "--star-delay": string;
  "--star-duration": string;
};

const starrySkyStars = [
  { id: "a", x: 6, y: 9, size: 2, opacity: 0.58, delay: -0.2, duration: 4.8 },
  { id: "b", x: 18, y: 17, size: 1, opacity: 0.38, delay: -1.4, duration: 5.4 },
  { id: "c", x: 32, y: 10, size: 1, opacity: 0.3, delay: -2.8, duration: 6.2 },
  { id: "d", x: 49, y: 15, size: 2, opacity: 0.5, delay: -0.9, duration: 5.6 },
  { id: "e", x: 71, y: 8, size: 1, opacity: 0.34, delay: -3.1, duration: 6.6 },
  { id: "f", x: 88, y: 19, size: 2, opacity: 0.46, delay: -1.9, duration: 5.2 },
  { id: "g", x: 12, y: 31, size: 3, opacity: 0.72, delay: -2.2, duration: 5.8 },
  { id: "h", x: 25, y: 40, size: 1, opacity: 0.35, delay: -0.8, duration: 6.4 },
  { id: "i", x: 42, y: 34, size: 2, opacity: 0.42, delay: -3.6, duration: 5.5 },
  { id: "j", x: 61, y: 29, size: 1, opacity: 0.3, delay: -1.2, duration: 6.8 },
  { id: "k", x: 79, y: 39, size: 2, opacity: 0.48, delay: -4.1, duration: 5.9 },
  { id: "l", x: 94, y: 33, size: 1, opacity: 0.32, delay: -2.6, duration: 6.1 },
  { id: "m", x: 7, y: 56, size: 1, opacity: 0.34, delay: -3.3, duration: 6.7 },
  { id: "n", x: 22, y: 63, size: 2, opacity: 0.52, delay: -1.7, duration: 5.3 },
  { id: "o", x: 38, y: 54, size: 1, opacity: 0.36, delay: -4.4, duration: 6.5 },
  { id: "p", x: 57, y: 61, size: 2, opacity: 0.44, delay: -0.5, duration: 5.7 },
  { id: "q", x: 76, y: 57, size: 1, opacity: 0.31, delay: -2.9, duration: 6.3 },
  { id: "r", x: 92, y: 66, size: 3, opacity: 0.64, delay: -1.1, duration: 5.1 },
  { id: "s", x: 13, y: 78, size: 2, opacity: 0.5, delay: -4.7, duration: 6.2 },
  { id: "t", x: 31, y: 86, size: 1, opacity: 0.35, delay: -2.1, duration: 6.9 },
  { id: "u", x: 48, y: 76, size: 1, opacity: 0.34, delay: -3.8, duration: 5.6 },
  { id: "v", x: 66, y: 84, size: 2, opacity: 0.47, delay: -0.6, duration: 5.4 },
  { id: "w", x: 83, y: 77, size: 1, opacity: 0.33, delay: -2.4, duration: 6.4 },
  { id: "x", x: 98, y: 91, size: 2, opacity: 0.48, delay: -4.2, duration: 5.8 },
] as const;

/**
 * CosmicBgAdapter — Phase 3-A.4a cosmic backdrop for OrbPage.
 *
 * Phase 3-A.4a-day addition: this adapter now VARIANT-SWITCHES between two
 * parallel cinematic scenes based on the resolved paper/ink/oled theme:
 *   - appliedTheme === 'paper' → <DayCosmicBackground /> (aurora 7-layer scene)
 *   - appliedTheme === 'ink' | 'oled' → legacy cosmic dark (stars + nebula)
 *
 * The two scenes share the SAME "wow" mandate — night cosmic remains
 * UNTOUCHED (dark theme users still see stars + violet nebula exactly as
 * shipped in dfcce25). Day variant adds aurora mesh, bokeh pools,
 * soft-light atmosphere, god-rays, 35 dust motes, static paper grain,
 * and edge vignette — research-grounded (Calm/Headspace/Day One/iA Writer).
 *
 * Night layers (painter order):
 *   1. Dark-mode cosmic radial — hsl(--focus-cosmic-*) via ellipse gradient.
 *   2. Star particles — CosmicStar instances from FocusReflectionModal seed.
 *   3. Dual-pool nebula glow — --nebula-a (30/30) + --nebula-b (70/70), pulsed.
 *
 * Perf (Law 8): every layer is transform/opacity only. Nebula pulse guarded by
 * useShouldAnimate so reduced-motion keeps the static frame (opacity 0.35).
 * Static CSS lives in CosmicBgAdapter.css to keep style={{}} ratchet budget.
 *
 * a11y: aria-hidden on root, pointer-events: none on every layer.
 */
export const CosmicBgAdapter = memo(function CosmicBgAdapter({
  variant = "auto",
}: CosmicBgAdapterProps) {
  const shouldAnimate = useShouldAnimate();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const resolvedVariant =
    variant === "auto" ? (appliedTheme === "paper" ? "day" : "night") : variant;

  // Paper theme → day variant (aurora WOW). Ink/oled → night cosmic (untouched).
  if (resolvedVariant === "day") {
    return <DayCosmicBackground />;
  }

  if (resolvedVariant === "starry") {
    return (
      <div
        aria-hidden="true"
        data-testid="cosmic-orb-starry-background"
        className="pointer-events-none absolute inset-0 z-0 overflow-hidden cosmic-bg-adapter__starry"
      >
        <div className="absolute inset-0 cosmic-bg-adapter__starry-base" />
        <div className="absolute inset-0 cosmic-bg-adapter__starry-aurora" />
        <div
          className="absolute inset-0 cosmic-bg-adapter__starry-field"
          data-animated={shouldAnimate ? "true" : "false"}
        >
          {starrySkyStars.map((star) => (
            <span
              key={star.id}
              data-testid="cosmic-orb-starry-star"
              className="cosmic-bg-adapter__starry-star"
              style={
                {
                  "--star-x": `${star.x}%`,
                  "--star-y": `${star.y}%`,
                  "--star-size": `${star.size}px`,
                  "--star-opacity": star.opacity,
                  "--star-delay": `${star.delay}s`,
                  "--star-duration": `${star.duration}s`,
                } as StarStyle
              }
            />
          ))}
        </div>
        <div className="absolute inset-0 cosmic-bg-adapter__starry-vignette" />
      </div>
    );
  }

  return (
    <div
      aria-hidden="true"
      data-testid="cosmic-orb-background"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Dark-mode cosmic radial — paper variant routed to DayCosmicBackground above */}
      <div className="absolute inset-0 cosmic-bg-adapter__dark-radial" />

      {/* Star particles — reuse the proven FocusReflectionModal seed */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}

      {/* Nebula glow — dual radial pools, pulsed when shouldAnimate */}
      {shouldAnimate ? (
        <motion.div
          className="absolute inset-0 pointer-events-none cosmic-bg-adapter__nebula"
          animate={{ opacity: [0.3, 0.5, 0.3] }}
          transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
          data-testid="cosmic-orb-nebula"
          data-animated="true"
        />
      ) : (
        <div
          className="absolute inset-0 pointer-events-none opacity-35 cosmic-bg-adapter__nebula"
          data-testid="cosmic-orb-nebula"
          data-animated="false"
        />
      )}
    </div>
  );
});
