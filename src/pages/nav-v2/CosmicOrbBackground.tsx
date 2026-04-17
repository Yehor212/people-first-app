import { memo } from "react";
import { motion } from "framer-motion";
import { CosmicStar, cosmicStars } from "@/components/FocusReflectionModal";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useCosmicParallax } from "./useCosmicParallax";
import { getTimeOfDay, type TimeOfDay } from "./getTimeOfDay";
import { ShootingStar } from "./ShootingStar";
import "./CosmicOrbBackground.css";

/**
 * CosmicOrbBackground — Phase 3-A.3 A+++ WOW-factor backdrop for OrbPage.
 *
 * Layers (painter order, back to front):
 *   1. Time-of-day base wash (dawn/day/dusk/night palette via CSS vars).
 *   2. Dark-mode cosmic radial (opt-in, only when .dark ancestor).
 *   3. Far parallax layer — nebula twin radials, drift 0.1x (WOW-1).
 *   4. Mid parallax layer — 15 CosmicStar particles, drift 0.3x.
 *   5. Near parallax layer — 8 larger motes (3-6px), drift 0.6x (WOW-1).
 *   6. Shooting star — sparse cinematic flourish every 8-15s (WOW-3).
 *
 * WOW layers:
 *   WOW-1 Parallax — useCosmicParallax writes --parallax-x/y; CSS consumes.
 *   WOW-2 Time-of-day palette — data-tod attribute drives 4 palette buckets.
 *   WOW-3 Shooting star — <ShootingStar /> scheduler.
 *
 * Perf (Law 8):
 *   - All layers transform + opacity only (GPU compositor).
 *   - will-change: transform hints on each parallax layer.
 *   - No React re-renders during parallax (CSS vars bypass reconciler).
 *
 * a11y: aria-hidden root, pointer-events: none on every layer.
 *
 * Testability: accepts optional `tod` override so tests can freeze time.
 */
interface CosmicOrbBackgroundProps {
  /** Override time-of-day palette (tests only). Default = current hour. */
  tod?: TimeOfDay;
}

export const CosmicOrbBackground = memo(function CosmicOrbBackground({
  tod,
}: CosmicOrbBackgroundProps = {}) {
  const shouldAnimate = useShouldAnimate();
  const parallaxRef = useCosmicParallax<HTMLDivElement>();
  const resolvedTod: TimeOfDay = tod ?? getTimeOfDay();

  return (
    <div
      ref={parallaxRef}
      aria-hidden="true"
      data-testid="cosmic-orb-background"
      data-tod={resolvedTod}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Time-of-day base wash — palette driven by data-tod custom props */}
      <div className="absolute inset-0 cosmic-orb-bg__tod-wash" />

      {/* Dark-mode cosmic radial — kept for dark theme, tinted via vars */}
      <div className="absolute inset-0 hidden dark:block cosmic-orb-bg__dark-radial" />

      {/* Far layer — nebula glow, drifts at 0.1x */}
      <div className="cosmic-orb-bg__far">
        {shouldAnimate ? (
          <motion.div
            className="absolute inset-0 cosmic-orb-bg__nebula"
            animate={{ opacity: [0.3, 0.5, 0.3] }}
            transition={{ duration: 5, repeat: Infinity, ease: "easeInOut" }}
            data-testid="cosmic-orb-nebula"
            data-animated="true"
          />
        ) : (
          <div
            className="absolute inset-0 cosmic-orb-bg__nebula opacity-35"
            data-testid="cosmic-orb-nebula"
            data-animated="false"
          />
        )}
      </div>

      {/* Mid layer — existing CosmicStar particles, drifts at 0.3x */}
      <div
        className="cosmic-orb-bg__mid"
        data-testid="cosmic-orb-mid-layer"
      >
        {cosmicStars.map((star) => (
          <CosmicStar key={star.id} {...star} />
        ))}
      </div>

      {/* Near layer — 8 larger foreground motes, drifts at 0.6x */}
      <div
        className="cosmic-orb-bg__near"
        data-testid="cosmic-orb-near-layer"
      >
        <span className="dot dot-1" />
        <span className="dot dot-2" />
        <span className="dot dot-3" />
        <span className="dot dot-4" />
        <span className="dot dot-5" />
        <span className="dot dot-6" />
        <span className="dot dot-7" />
        <span className="dot dot-8" />
      </div>

      {/* Shooting star — sparse cinematic flourish */}
      <ShootingStar />
    </div>
  );
});
