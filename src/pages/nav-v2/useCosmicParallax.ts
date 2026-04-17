/**
 * useCosmicParallax — Phase 3-A.3 A+++ WOW-1 (multi-depth parallax).
 *
 * Tracks pointer (desktop) + device orientation (mobile) and writes normalized
 * coordinates to CSS custom properties (`--parallax-x`, `--parallax-y`) on a
 * target element. Layers consume the vars via `transform: translate3d(...)` so
 * everything stays on the GPU compositor — no React re-renders, no layout
 * thrash, no per-pixel listener work (rAF-coalesced to 60Hz).
 *
 * Output range: x/y ∈ [-1, 1]. Layers scale by their own depth multiplier.
 *
 * Gating:
 *   - useShouldAnimate() false → vars stay 0, no listeners attached.
 *   - SSR safe — only attaches in useEffect.
 *   - Cleanup removes all listeners + cancels any pending rAF.
 *
 * Law 10 (cross-platform): pointer = desktop, orientation = mobile. Never both
 * attach at once (mobile browsers emit mousemove from touch which we ignore).
 * Law 8 (60fps): rAF-coalesced pointer updates; orientation fires ~60Hz natively.
 * Law 18 (cleanup): every addEventListener has matching cleanup in the return.
 */

import { useEffect, useRef } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";

/** Clamp to [-1, 1] to guarantee predictable layer transforms. */
function clamp01(n: number): number {
  return Math.max(-1, Math.min(1, n));
}

export function useCosmicParallax<T extends HTMLElement>() {
  const ref = useRef<T | null>(null);
  const shouldAnimate = useShouldAnimate();

  useEffect(() => {
    const el = ref.current;
    if (!el || !shouldAnimate) return;

    let rafId: number | null = null;
    let targetX = 0;
    let targetY = 0;

    const tick = () => {
      rafId = null;
      el.style.setProperty("--parallax-x", targetX.toFixed(3));
      el.style.setProperty("--parallax-y", targetY.toFixed(3));
    };

    const schedule = () => {
      if (rafId !== null) return;
      rafId = requestAnimationFrame(tick);
    };

    const onPointerMove = (e: PointerEvent) => {
      // Ignore touch-emulated mousemove on mobile — orientation handles it.
      if (e.pointerType === "touch") return;
      const { innerWidth, innerHeight } = window;
      if (!innerWidth || !innerHeight) return;
      targetX = clamp01((e.clientX / innerWidth) * 2 - 1);
      targetY = clamp01((e.clientY / innerHeight) * 2 - 1);
      schedule();
    };

    const onOrientation = (e: DeviceOrientationEvent) => {
      // gamma = left/right tilt (-90..90), beta = front/back (-180..180).
      // Normalise to roughly [-1, 1] with a 30° full-scale window so small
      // tilts produce visible parallax without making the layer jitter.
      const g = e.gamma ?? 0;
      const b = e.beta ?? 0;
      targetX = clamp01(g / 30);
      targetY = clamp01((b - 45) / 30); // bias so holding phone upright ≈ 0.
      schedule();
    };

    // Reset on leave so layers settle home instead of sticking to last coord.
    const onPointerLeave = () => {
      targetX = 0;
      targetY = 0;
      schedule();
    };

    const isCoarse =
      typeof window.matchMedia === "function" &&
      window.matchMedia("(pointer: coarse)").matches;

    if (isCoarse && typeof window.DeviceOrientationEvent !== "undefined") {
      window.addEventListener("deviceorientation", onOrientation, {
        passive: true,
      });
    } else {
      window.addEventListener("pointermove", onPointerMove, { passive: true });
      window.addEventListener("pointerleave", onPointerLeave, {
        passive: true,
      });
    }

    return () => {
      if (rafId !== null) cancelAnimationFrame(rafId);
      window.removeEventListener("pointermove", onPointerMove);
      window.removeEventListener("pointerleave", onPointerLeave);
      window.removeEventListener("deviceorientation", onOrientation);
      // Reset on cleanup so next mount starts from rest.
      el.style.setProperty("--parallax-x", "0");
      el.style.setProperty("--parallax-y", "0");
    };
  }, [shouldAnimate]);

  return ref;
}
