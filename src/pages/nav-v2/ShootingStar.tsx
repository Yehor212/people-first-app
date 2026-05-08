/**
 * ShootingStar - sparse decorative "quiet meteor" for the V2 Orb surface.
 *
 * Every 8-15 seconds a single layered meteor crosses the upper sky with a
 * soft blue-white head, tapered tail, small halo, and a few dust points.
 *
 * Gating:
 *   - useShouldAnimate() false renders nothing.
 *   - aria-hidden keeps it decorative.
 *   - pointer-events none keeps orb and slider input untouched.
 *
 * Performance: transform + opacity only; timers are cleaned up on unmount.
 */

import { useEffect, useRef, useState, memo, type CSSProperties } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./ShootingStar.css";

const MIN_INTERVAL_MS = 8_000;
const MAX_INTERVAL_MS = 15_000;
const FALLBACK_CLEANUP_BUFFER_MS = 90;

interface MeteorFlight {
  topPercent: number;
  angleDeg: number;
  durationMs: number;
  tailPx: number;
  arcAXvw: number;
  arcAYvh: number;
  arcBXvw: number;
  arcBYvh: number;
  arcCXvw: number;
  arcCYvh: number;
  travelXvw: number;
  travelYvh: number;
}

type MeteorStyle = CSSProperties & {
  "--meteor-top": string;
  "--meteor-angle": string;
  "--meteor-duration": string;
  "--meteor-tail": string;
  "--meteor-arc-a-x": string;
  "--meteor-arc-a-y": string;
  "--meteor-arc-b-x": string;
  "--meteor-arc-b-y": string;
  "--meteor-arc-c-x": string;
  "--meteor-arc-c-y": string;
  "--meteor-travel-x": string;
  "--meteor-travel-y": string;
};

function randomBetween(min: number, max: number): number {
  return min + Math.random() * (max - min);
}

function randomInterval(): number {
  return randomBetween(MIN_INTERVAL_MS, MAX_INTERVAL_MS);
}

function createMeteorFlight(): MeteorFlight {
  return {
    topPercent: Math.round(randomBetween(12, 26)),
    angleDeg: Math.round(randomBetween(7, 12)),
    durationMs: Math.round(randomBetween(1_220, 1_420)),
    tailPx: Math.round(randomBetween(96, 136)),
    arcAXvw: Math.round(randomBetween(26, 34)),
    arcAYvh: Math.round(randomBetween(-1, 1)),
    arcBXvw: Math.round(randomBetween(58, 70)),
    arcBYvh: Math.round(randomBetween(2, 5)),
    arcCXvw: Math.round(randomBetween(92, 104)),
    arcCYvh: Math.round(randomBetween(5, 8)),
    travelXvw: Math.round(randomBetween(128, 142)),
    travelYvh: Math.round(randomBetween(8, 12)),
  };
}

function getMeteorStyle(flight: MeteorFlight): MeteorStyle {
  return {
    "--meteor-top": `${flight.topPercent}%`,
    "--meteor-angle": `${flight.angleDeg}deg`,
    "--meteor-duration": `${flight.durationMs}ms`,
    "--meteor-tail": `${flight.tailPx}px`,
    "--meteor-arc-a-x": `${flight.arcAXvw}vw`,
    "--meteor-arc-a-y": `${flight.arcAYvh}vh`,
    "--meteor-arc-b-x": `${flight.arcBXvw}vw`,
    "--meteor-arc-b-y": `${flight.arcBYvh}vh`,
    "--meteor-arc-c-x": `${flight.arcCXvw}vw`,
    "--meteor-arc-c-y": `${flight.arcCYvh}vh`,
    "--meteor-travel-x": `${flight.travelXvw}vw`,
    "--meteor-travel-y": `${flight.travelYvh}vh`,
  };
}

export const ShootingStar = memo(function ShootingStar() {
  const shouldAnimate = useShouldAnimate();
  const [fireCount, setFireCount] = useState(0);
  const [flight, setFlight] = useState<MeteorFlight | null>(null);
  const finishFlightRef = useRef<(() => void) | null>(null);

  useEffect(() => {
    if (!shouldAnimate) return;
    let scheduleTimer: ReturnType<typeof setTimeout> | null = null;
    let cleanupTimer: ReturnType<typeof setTimeout> | null = null;
    let mounted = true;

    function clearCleanupTimer() {
      if (cleanupTimer) {
        clearTimeout(cleanupTimer);
        cleanupTimer = null;
      }
    }

    function schedule() {
      scheduleTimer = setTimeout(() => {
        if (!mounted) return;
        const nextFlight = createMeteorFlight();
        setFireCount((n) => n + 1);
        setFlight(nextFlight);
        cleanupTimer = setTimeout(
          finishFlight,
          nextFlight.durationMs + FALLBACK_CLEANUP_BUFFER_MS,
        );
      }, randomInterval());
    }

    function finishFlight() {
      if (!mounted) return;
      clearCleanupTimer();
      setFlight(null);
      schedule();
    }

    finishFlightRef.current = finishFlight;

    schedule();

    return () => {
      mounted = false;
      finishFlightRef.current = null;
      if (scheduleTimer) clearTimeout(scheduleTimer);
      clearCleanupTimer();
    };
  }, [shouldAnimate]);

  if (!shouldAnimate || !flight) return null;

  return (
    <div
      key={fireCount}
      aria-hidden="true"
      data-testid="shooting-star"
      className="shooting-star"
      style={getMeteorStyle(flight)}
      onAnimationEnd={(event) => {
        if (event.animationName === "shooting-star-fly") {
          finishFlightRef.current?.();
        }
      }}
    >
      <span className="shooting-star__halo" data-testid="shooting-star-halo" />
      <span className="shooting-star__tail" data-testid="shooting-star-tail" />
      <span className="shooting-star__core" data-testid="shooting-star-core" />
      <span
        className="shooting-star__dust shooting-star__dust--one"
        data-testid="shooting-star-dust"
      />
      <span
        className="shooting-star__dust shooting-star__dust--two"
        data-testid="shooting-star-dust"
      />
      <span
        className="shooting-star__dust shooting-star__dust--three"
        data-testid="shooting-star-dust"
      />
    </div>
  );
});
