/**
 * LazyLottiePlayer — Reusable wrapper for lazy-loaded Lottie animations.
 *
 * Eliminates repeated boilerplate: each consumer passes a dynamic import function
 * for the JSON file, and this component handles loading state, shouldAnimate()
 * preference check, and fallback rendering.
 *
 * The lottie-react library itself is statically imported (already in the separate
 * "lottie" Vite chunk via manualChunks). Only the JSON data is dynamic-imported.
 *
 * CSP-safe: Uses lottie_light.js (no expressions/eval) via Vite alias.
 */

import Lottie from "lottie-react";
import { useEffect, useState, useRef } from "react";
import { shouldAnimate } from "@/lib/animationUtils";
import { cn } from "@/lib/utils";
import { logger } from "@/lib/logger";

interface LazyLottiePlayerProps {
  /** Dynamic import function: () => import('@/assets/animations/file.json') */
  animationImport: () => Promise<{ default: object }>;
  /** Loop the animation (default: true) */
  loop?: boolean;
  /** Auto-play on mount (default: true) */
  autoplay?: boolean;
  /** Width in px or CSS string (default: '100%') */
  width?: number | string;
  /** Height in px or CSS string (default: '100%') */
  height?: number | string;
  /** Callback when single-shot animation completes */
  onComplete?: () => void;
  /** CSS class on wrapper div */
  className?: string;
  /** Fallback when loading or animations disabled (default: null) */
  fallback?: React.ReactNode;
  /** Opacity for ambient overlays (default: 1) */
  opacity?: number;
}

export function LazyLottiePlayer({
  animationImport,
  loop = true,
  autoplay = true,
  width = "100%",
  height = "100%",
  onComplete,
  className,
  fallback = null,
  opacity = 1,
}: LazyLottiePlayerProps) {
  const [animData, setAnimData] = useState<object | null>(null);
  const mountedRef = useRef(true);

  useEffect(() => {
    mountedRef.current = true;

    animationImport()
      .then((m) => {
        if (mountedRef.current) setAnimData(m.default);
      })
      .catch((err) => {
        logger.warn("[Lottie] Animation load failed:", err);
      });

    return () => {
      mountedRef.current = false;
    };
    // animationImport is a factory function — stable reference expected from caller
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, []);

  // Respect user preferences (reduced motion / dopamine settings)
  if (!shouldAnimate()) {
    return <>{fallback}</>;
  }

  // Still loading the JSON
  if (!animData) {
    return <>{fallback}</>;
  }

  return (
    <div
      className={cn("pointer-events-none", className)}
      style={{ width, height, opacity }}
      aria-hidden="true"
    >
      <Lottie
        animationData={animData}
        loop={loop}
        autoplay={autoplay}
        onComplete={onComplete}
        className="w-full h-full"
      />
    </div>
  );
}
