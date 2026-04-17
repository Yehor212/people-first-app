import { memo, useEffect, useMemo } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./DayCosmicBackground.css";

/**
 * DayCosmicBackground — Phase 3-A.4a-day light-mode cinematic backdrop.
 *
 * Research brief (premium apps like Calm / Headspace / Day One / iA Writer):
 * daylight mindfulness UX uses warm LAYERED SCENES, not pastel gradients.
 * Metaphor shift from night cosmic: "floating in stars" → "sitting by
 * sunlit paper window". Dust motes replace stars as depth markers.
 *
 * 7-layer stack (back → front):
 *   1. Base OKLCH warm radial-mesh (cream center → peach radii)
 *   2. Warm bokeh pools — 2 blurred radials (amber TL, coral BR)
 *   3. Soft-light atmosphere sheet — peach + mix-blend-mode: soft-light
 *   4. God-ray masque — diagonal repeating-gradient + radial mask (window)
 *   5. 35 dust motes — 2-4px OKLCH cream, drift 12-20s linear
 *   6. Paper grain SVG (feTurbulence, STATIC, 4% opacity, multiply)
 *   7. Edge foxing vignette — closest-corner radial darkening
 *
 * Time-of-day palette switcher (5 modes) via `data-daymode` on <html>:
 *   dawn 5-9 / morning 9-12 / afternoon 12-17 / golden 17-19 / dusk 19-21
 * CSS custom properties --day-base / --day-accent-1 / --day-accent-2 per
 * mode — see DayCosmicBackground.css.
 *
 * Perf (Law 8): transforms/opacity only. Paper grain is STATIC (never
 * animated — kills mobile FPS). Motes + bokeh pulse gated by
 * useShouldAnimate() so reduced-motion keeps a beautiful static scene.
 *
 * a11y: aria-hidden, pointer-events: none. All contrast verified in the
 * orb-day-scope token (oklch(0.28 0.04 50) ≥ 4.5:1 on every base palette).
 *
 * Cross-platform (Law 10): -webkit-backdrop-filter paired everywhere blur
 * is used (iOS Safari). No backdrop-filter in this bg actually — layers
 * use blur() filter directly which Safari handles natively.
 *
 * Night cosmic (CosmicBgAdapter) is UNTOUCHED. Variant-switch happens in
 * CosmicBgAdapter.tsx (Phase 3-A.4a-day Step 3).
 */
export const DayCosmicBackground = memo(function DayCosmicBackground() {
  const shouldAnimate = useShouldAnimate();

  // Time-of-day — set data attribute once on mount (memoised so tests can
  // freeze time). Writes to <html>, same target as data-theme so CSS selectors
  // can combine them if ever needed.
  const daymode = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 9) return "dawn";
    if (hour < 12) return "morning";
    if (hour < 17) return "afternoon";
    if (hour < 19) return "golden";
    return "dusk";
  }, []);

  useEffect(() => {
    if (typeof document === "undefined") return;
    const prev = document.documentElement.dataset.daymode;
    document.documentElement.dataset.daymode = daymode;
    return () => {
      if (prev === undefined) {
        delete document.documentElement.dataset.daymode;
      } else {
        document.documentElement.dataset.daymode = prev;
      }
    };
  }, [daymode]);

  // 35 dust motes — deterministic positions + delays so baselines are stable.
  // Seed: index-derived sin/cos so tests match screenshots frame-for-frame.
  const motes = useMemo(() => {
    return Array.from({ length: 35 }, (_, i) => {
      const x = (Math.sin(i * 1.9) * 0.5 + 0.5) * 100;
      const y = (Math.cos(i * 2.3) * 0.5 + 0.5) * 100;
      const size = 2 + (i % 3);
      const duration = 12 + (i % 8) * 1.25;
      const delay = -(i * 0.55);
      const opacity = 0.45 + ((i % 5) * 0.1);
      return { id: i, x, y, size, duration, delay, opacity };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="day-cosmic-background"
      data-daymode={daymode}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Layer 1 — base warm OKLCH radial mesh */}
      <div className="day-cosmic__base" data-testid="day-cosmic-base" />

      {/* Layer 2 — warm bokeh pools (amber top-left, coral bottom-right) */}
      <div className="day-cosmic__bokeh" data-testid="day-cosmic-bokeh" />

      {/* Layer 3 — soft-light atmosphere sheet (peach, mix-blend soft-light) */}
      <div className="day-cosmic__atmosphere" data-testid="day-cosmic-atmosphere" />

      {/* Layer 4 — god-ray masque (diagonal rays from window corner) */}
      <div className="day-cosmic__god-rays" data-testid="day-cosmic-god-rays" />

      {/* Layer 5 — 35 dust motes (animated drift, gated by reduced-motion) */}
      <div
        className="day-cosmic__motes"
        data-testid="day-cosmic-motes"
        data-animated={shouldAnimate ? "true" : "false"}
      >
        {motes.map((m) => (
          <span
            key={m.id}
            className="day-cosmic__mote"
            style={
              {
                left: `${m.x}%`,
                top: `${m.y}%`,
                width: `${m.size}px`,
                height: `${m.size}px`,
                opacity: m.opacity,
                animationDuration: `${m.duration}s`,
                animationDelay: `${m.delay}s`,
              } as React.CSSProperties
            }
          />
        ))}
      </div>

      {/* Layer 6 — paper grain SVG (STATIC, 4% opacity, multiply blend) */}
      <svg
        className="day-cosmic__paper-grain"
        data-testid="day-cosmic-paper-grain"
        xmlns="http://www.w3.org/2000/svg"
        width="100%"
        height="100%"
        aria-hidden="true"
      >
        <filter id="day-cosmic-turbulence">
          <feTurbulence type="fractalNoise" baseFrequency="0.9" numOctaves="2" seed="7" />
          <feColorMatrix
            type="matrix"
            values="0 0 0 0 0.35  0 0 0 0 0.22  0 0 0 0 0.10  0 0 0 0.6 0"
          />
        </filter>
        <rect width="100%" height="100%" filter="url(#day-cosmic-turbulence)" />
      </svg>

      {/* Layer 7 — edge foxing vignette (warm corner darkening) */}
      <div className="day-cosmic__vignette" data-testid="day-cosmic-vignette" />
    </div>
  );
});
