import { memo } from "react";
import { motion } from "framer-motion";
import { CosmicStar, cosmicStars } from "@/components/FocusReflectionModal";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./CosmicBgAdapter.css";

/**
 * CosmicBgAdapter — Phase 3-A.4a cosmic backdrop for OrbPage.
 *
 * Reuses the exact visual layers from src/components/focus-timer/CosmicBackground.tsx
 * (proven quality) — light-mode Sun-Dappled Meadow gradient + dark-mode cosmic
 * radial + cosmicStars particles + dual-pool nebula glow — but WITHOUT the CTA
 * "Start here" header pill that focus-timer needs for its own surface.
 *
 * Why an adapter (not direct reuse): focus-timer's CosmicBackground renders a
 * fragment with the pill baked in and always mounted. OrbPage is a mindfulness
 * surface — no pill. Modifying focus-timer to accept an optional label would
 * risk its main purpose. This adapter reproduces the four visual layers only,
 * identical palette/tokens, and wraps them in a single aria-hidden container
 * absolutely positioned so OrbPage can stack content on top.
 *
 * Layers (painter order):
 *   1. Light-mode base gradient — amber-50 → sky-50 → indigo-50 (dark:bg-none).
 *   2. Dark-mode cosmic radial — hsl(--focus-cosmic-*) via ellipse gradient.
 *   3. Star particles — CosmicStar instances from FocusReflectionModal seed.
 *   4. Dual-pool nebula glow — --nebula-a (30/30) + --nebula-b (70/70), pulsed.
 *
 * Perf (Law 8): every layer is transform/opacity only. Nebula pulse guarded by
 * useShouldAnimate so reduced-motion keeps the static frame (opacity 0.35).
 * Static CSS lives in CosmicBgAdapter.css to keep style={{}} ratchet budget.
 *
 * a11y: aria-hidden on root, pointer-events: none on every layer.
 */
export const CosmicBgAdapter = memo(function CosmicBgAdapter() {
  const shouldAnimate = useShouldAnimate();

  return (
    <div
      aria-hidden="true"
      data-testid="cosmic-orb-background"
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Light-mode Sun-Dappled Meadow base */}
      <div className="absolute inset-0 bg-gradient-to-b from-amber-50 via-sky-50 to-indigo-50 dark:bg-none" />

      {/* Dark-mode cosmic radial */}
      <div className="absolute inset-0 hidden dark:block cosmic-bg-adapter__dark-radial" />

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
