import { memo, useEffect, useMemo, type CSSProperties } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./DayCosmicBackground.css";

type PhotonTone = "aqua" | "gold" | "mint" | "iris" | "rose";

type PhotonStyle = CSSProperties & {
  "--photon-x": string;
  "--photon-y": string;
  "--photon-size": string;
  "--photon-opacity": number;
  "--photon-delay": string;
  "--photon-duration": string;
  "--photon-drift": string;
};

type SunThreadStyle = CSSProperties & {
  "--thread-x": string;
  "--thread-y": string;
  "--thread-length": string;
  "--thread-opacity": number;
  "--thread-delay": string;
  "--thread-duration": string;
  "--thread-tilt": string;
  "--thread-width": string;
};

/**
 * DayCosmicBackground — Phase 3-A.4a-day light-mode cinematic backdrop.
 *
 * Research brief (premium apps like Calm / Headspace / Day One / iA Writer):
 * daylight mindfulness UX uses aurora LAYERED SCENES, not pastel gradients.
 * Metaphor shift from night cosmic: "floating in stars" → "sitting by
 * sunlit paper window". Dust motes replace stars as depth markers.
 *
 * 7-layer stack (back → front):
 *   1. Base aurora radial-mesh (quiet center → green-ink radii)
 *   2. Aurora bokeh pools — 2 blurred radials (violet TL, seafoam BR)
 *   3. Soft-light atmosphere sheet — trace tint + mix-blend-mode: soft-light
 *   4. God-ray masque — diagonal repeating-gradient + radial mask (window)
 *   5. 35 dust motes — 2-4px aurora light, drift 12-20s linear
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
 * orb-day-scope token (green-ink) ≥ 4.5:1 on every base palette.
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

  const photons = useMemo(() => {
    const tones: PhotonTone[] = ["aqua", "gold", "mint", "iris", "rose"];
    return Array.from({ length: 78 }, (_, i) => {
      const x = (Math.sin(i * 2.17 + 0.4) * 0.5 + 0.5) * 104 - 2;
      const y = (Math.cos(i * 2.71 + 1.2) * 0.5 + 0.5) * 104 - 2;
      const size = 2.6 + (i % 6) * 0.92;
      const duration = 5.4 + (i % 9) * 0.72;
      const delay = -(i * 0.19);
      const opacity = 0.66 + ((i % 7) * 0.045);
      const drift = 10 + (i % 5) * 4;
      return {
        id: i,
        x,
        y,
        size,
        duration,
        delay,
        opacity,
        drift,
        tone: tones[i % tones.length],
      };
    });
  }, []);

  const sunThreads = useMemo(() => {
    return Array.from({ length: 18 }, (_, i) => {
      const x = 3 + ((Math.sin(i * 1.57 + 0.8) * 0.5 + 0.5) * 94);
      const y = -18 + ((Math.cos(i * 1.83 + 0.5) * 0.5 + 0.5) * 38);
      const length = 42 + (i % 5) * 10;
      const width = 1.4 + (i % 4) * 0.42;
      const opacity = 0.22 + (i % 6) * 0.045;
      const duration = 10.5 + (i % 7) * 1.2;
      const delay = -(i * 0.47);
      const tilt = -18 + (i % 6) * 4.4;
      return { id: i, x, y, length, width, opacity, duration, delay, tilt };
    });
  }, []);

  return (
    <div
      aria-hidden="true"
      data-testid="day-cosmic-background"
      data-daymode={daymode}
      className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
    >
      {/* Layer 1 — base aurora radial mesh */}
      <div className="day-cosmic__base" data-testid="day-cosmic-base" />

      <div className="day-cosmic__solar-portal" data-testid="day-cosmic-solar-portal">
        <span className="day-cosmic__solar-portal-core" />
        <span className="day-cosmic__solar-portal-orbit day-cosmic__solar-portal-orbit--one" />
        <span className="day-cosmic__solar-portal-orbit day-cosmic__solar-portal-orbit--two" />
      </div>

      {/* Layer 2 — aurora bokeh pools (violet top-left, seafoam bottom-right) */}
      <div className="day-cosmic__bokeh" data-testid="day-cosmic-bokeh" />

      {/* Layer 3 — soft-light atmosphere sheet (trace tint, mix-blend soft-light) */}
      <div className="day-cosmic__atmosphere" data-testid="day-cosmic-atmosphere" />

      <div className="day-cosmic__horizon-glow" data-testid="day-cosmic-horizon-glow" />
      <div className="day-cosmic__light-curtain" data-testid="day-cosmic-light-curtain" />

      <div
        className="day-cosmic__sun-threads"
        data-testid="day-cosmic-sun-threads"
        data-animated={shouldAnimate ? "true" : "false"}
      >
        {sunThreads.map((thread) => (
          <span
            key={thread.id}
            className="day-cosmic__sun-thread"
            style={
              {
                "--thread-x": `${thread.x}%`,
                "--thread-y": `${thread.y}%`,
                "--thread-length": `${thread.length}svh`,
                "--thread-opacity": thread.opacity,
                "--thread-delay": `${thread.delay}s`,
                "--thread-duration": `${thread.duration}s`,
                "--thread-tilt": `${thread.tilt}deg`,
                "--thread-width": `${thread.width}px`,
              } as SunThreadStyle
            }
          />
        ))}
      </div>

      {/* Layer 4 — god-ray masque (diagonal rays from window corner) */}
      <div className="day-cosmic__god-rays" data-testid="day-cosmic-god-rays" />

      <div className="day-cosmic__sun-shower" data-testid="day-cosmic-sun-shower" />
      <div className="day-cosmic__prism-ribbon" data-testid="day-cosmic-prism-ribbon" />
      <div className="day-cosmic__caustics" data-testid="day-cosmic-caustics" />
      <div className="day-cosmic__glass-depth" data-testid="day-cosmic-glass-depth" />

      <div
        className="day-cosmic__photon-field"
        data-testid="day-cosmic-photon-field"
        data-animated={shouldAnimate ? "true" : "false"}
      >
        {photons.map((photon) => (
          <span
            key={photon.id}
            className={`day-cosmic__photon day-cosmic__photon--${photon.tone}`}
            style={
              {
                "--photon-x": `${photon.x}%`,
                "--photon-y": `${photon.y}%`,
                "--photon-size": `${photon.size}px`,
                "--photon-opacity": photon.opacity,
                "--photon-delay": `${photon.delay}s`,
                "--photon-duration": `${photon.duration}s`,
                "--photon-drift": `${photon.drift}px`,
              } as PhotonStyle
            }
          />
        ))}
      </div>

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
              }
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

      {/* Layer 7 — edge vignette (quiet corner darkening) */}
      <div className="day-cosmic__vignette" data-testid="day-cosmic-vignette" />
    </div>
  );
});
