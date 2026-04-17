import { memo } from "react";
import { motion } from "framer-motion";
import { CosmicStar, cosmicStars } from "@/components/FocusReflectionModal";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./CosmicOrbBackground.css";

/**
 * CosmicOrbBackground — Phase 3-A.2 WOW-factor backdrop for OrbPage.
 *
 * Composition (painter order, back to front):
 *   1. Theme-aware base gradient (Tailwind classes):
 *        Light → amber/sky/indigo "Sun-Dappled Meadow" (matches FocusTimer paper tone).
 *        Dark  → focus-cosmic radial via .cosmic-orb-bg__dark-radial (token-driven).
 *   2. CosmicStar particles (15) reused from FocusReflectionModal — already theme-aware
 *        via `--particle-color` (day = dust mote, night = starfield).
 *   3. Nebula glow (.cosmic-orb-bg__nebula) gated by useShouldAnimate() —
 *        reduced-motion / low-battery / OS-reduce fall back to a static frame.
 *
 * Gradients live in CosmicOrbBackground.css — keeps inline style count at 0
 * (Ratchet inlineStyles budget friendly) while remaining token-driven.
 *
 * Performance:
 *   - All particles use transform + opacity only → GPU compositor, 60 FPS (Law 8).
 *   - Nebula animation is a single framer-motion `opacity` keyframe — no layout thrash.
 *   - pointer-events: none on every layer — does not intercept orb / slider input.
 *
 * Integration:
 *   - Absolute-positioned inside a `relative` parent (OrbPage <main>).
 *   - z-0 so OrbPage content (z-10) paints above.
 *   - NOT a fork of focus-timer/CosmicBackground — that one owns the FocusTimer
 *     "Start here" CTA and only makes sense inside the timer surface. We consume
 *     the same CosmicStar + cosmicStars primitives for zero drift.
 */
export const CosmicOrbBackground = memo(function CosmicOrbBackground() {
  const shouldAnimate = useShouldAnimate();

  return (
    <div
      aria-hidden="true"
      data-testid="cosmic-orb-background"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Light-mode base — Sun-Dappled Meadow (amber → sky → indigo) */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-indigo-50 dark:bg-none" />

      {/* Dark-mode cosmic radial — reuses focus-cosmic tokens, zero drift */}
      <div className="absolute inset-0 hidden dark:block cosmic-orb-bg__dark-radial" />

      {/* Star particles — theme-aware via --particle-color (day motes / night stars) */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}

      {/* Nebula glow — animated when motion allowed, static otherwise */}
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
  );
});
