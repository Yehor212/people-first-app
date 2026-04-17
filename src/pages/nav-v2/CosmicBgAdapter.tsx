import { memo } from "react";
import { motion } from "framer-motion";
import { CosmicStar, cosmicStars } from "@/components/FocusReflectionModal";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useThemeStore } from "@/stores/themeStore";
import { DayCosmicBackground } from "./DayCosmicBackground";
import "./CosmicBgAdapter.css";

/**
 * CosmicBgAdapter — Phase 3-A.4a cosmic backdrop for OrbPage.
 *
 * Phase 3-A.4a-day addition: this adapter now VARIANT-SWITCHES between two
 * parallel cinematic scenes based on the resolved paper/ink/oled theme:
 *   - appliedTheme === 'paper' → <DayCosmicBackground /> (warm 7-layer scene)
 *   - appliedTheme === 'ink' | 'oled' → legacy cosmic dark (stars + nebula)
 *
 * The two scenes share the SAME "wow" mandate — night cosmic remains
 * UNTOUCHED (dark theme users still see stars + violet nebula exactly as
 * shipped in dfcce25). Day variant adds warm OKLCH mesh, bokeh pools,
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
export const CosmicBgAdapter = memo(function CosmicBgAdapter() {
  const shouldAnimate = useShouldAnimate();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);

  // Paper theme → day variant (warm WOW). Ink/oled → night cosmic (untouched).
  if (appliedTheme === "paper") {
    return <DayCosmicBackground />;
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
