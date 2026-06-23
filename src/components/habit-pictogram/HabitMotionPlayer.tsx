import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

import drinkWaterLottieUrl from "../../assets/habit-icons/v2/drink-water/idle.lottie.json?url";
import readLottieUrl from "../../assets/habit-icons/v2/read/idle.lottie.json?url";
import walkDistanceLottieUrl from "../../assets/habit-icons/v2/walk-distance/idle.lottie.json?url";
import { shouldAnimate } from "@/lib/animationUtils";
import { logger } from "@/lib/logger";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import {
  getHabitIconAsset,
  isHabitLottieApproved,
  type HabitIconRenderer,
  type HabitIconMotionState,
} from "./habitMotionAssets";

const reducedIconUrls: Record<string, string> = import.meta.glob(
  "../../assets/habit-icons/v2/*/reduced.svg",
  {
    eager: true,
    import: "default",
    query: "?url",
  }
);

const lottieAnimationUrls: Record<string, string> = {
  "drink-water/idle.lottie.json": drinkWaterLottieUrl,
  "read/idle.lottie.json": readLottieUrl,
  "walk-distance/idle.lottie.json": walkDistanceLottieUrl,
};

async function loadHabitLottieAnimation(assetPath: string): Promise<unknown | null> {
  const animationUrl = lottieAnimationUrls[assetPath];
  if (!animationUrl) return null;

  const response = await fetch(animationUrl);
  if (!response.ok) {
    throw new Error(`Habit Lottie asset failed to load: ${assetPath}`);
  }

  return response.json() as Promise<unknown>;
}

interface HabitMotionPlayerProps {
  pictogramId: V2HabitPictogramId;
  renderer?: HabitIconRenderer | "auto";
  state?: HabitIconMotionState;
  motionAllowed?: boolean;
  forceMotionForReview?: boolean;
}

export function HabitMotionPlayer({
  pictogramId,
  renderer = "auto",
  state = "idle",
  motionAllowed = true,
  forceMotionForReview = false,
}: HabitMotionPlayerProps) {
  const asset = getHabitIconAsset(pictogramId);
  const lottieContainerRef = useRef<HTMLSpanElement | null>(null);
  const animationRef = useRef<AnimationItem | null>(null);
  const visibilityObserverRef = useRef<IntersectionObserver | null>(null);
  const animationAllowed = motionAllowed && (forceMotionForReview || shouldAnimate());
  const effectiveRenderer = animationAllowed
    ? renderer === "auto"
      ? asset.idle.renderer
      : renderer
    : "still";
  const reducedAssetKey = "../../assets/habit-icons/v2/" + asset.reduced;
  const reducedAssetSrc = reducedIconUrls[reducedAssetKey] ?? "";
  const canRenderLottie = forceMotionForReview || isHabitLottieApproved(pictogramId);
  const shouldRenderLottie =
    canRenderLottie && effectiveRenderer === "lottie" && Boolean(asset.lottie);

  useEffect(() => {
    if (!shouldRenderLottie || !asset.lottie || !lottieContainerRef.current) return;
    if (import.meta.env.MODE === "test") return;
    let cancelled = false;
    void Promise.all([loadHabitLottieAnimation(asset.lottie), import("lottie-web")])
      .then(([lottieAnimation, module]) => {
        if (cancelled || !lottieAnimation || !lottieContainerRef.current) return;
        const lottie = module.default ?? module;
        const container = lottieContainerRef.current;
        animationRef.current?.destroy();
        animationRef.current = lottie.loadAnimation({
          container,
          renderer: "svg",
          loop: true,
          autoplay: true,
          animationData: lottieAnimation,
          rendererSettings: {
            preserveAspectRatio: "xMidYMid meet",
            progressiveLoad: true,
          },
        });

        if (typeof IntersectionObserver !== "undefined") {
          visibilityObserverRef.current?.disconnect();
          visibilityObserverRef.current = new IntersectionObserver(
            ([entry]) => {
              if (!animationRef.current) return;
              if (entry.isIntersecting) {
                animationRef.current.play();
              } else {
                animationRef.current.pause();
              }
            },
            { rootMargin: "96px" }
          );
          visibilityObserverRef.current.observe(container);
        }
      })
      .catch((error) => {
        if (cancelled) return;
        logger.warn("[HabitMotionPlayer] Failed to load Lottie asset", {
          asset: asset.lottie,
          error: error instanceof Error ? error.message : String(error),
          pictogramId,
        });
      });

    return () => {
      cancelled = true;
      visibilityObserverRef.current?.disconnect();
      visibilityObserverRef.current = null;
      animationRef.current?.destroy();
      animationRef.current = null;
    };
  }, [asset.lottie, pictogramId, shouldRenderLottie]);

  return (
    <span
      aria-hidden="true"
      className="v2hp-motion-player"
      data-testid="habit-motion-player"
      data-habit-motion-player={pictogramId}
      data-renderer={shouldRenderLottie ? "lottie" : "still"}
      data-motion-state={state}
      data-loop-duration-ms={asset.idle.durationMs}
      data-motion-name={asset.idle.name}
      data-lottie-asset={shouldRenderLottie ? asset.lottie : undefined}
      data-reduced-asset={asset.reduced}
      data-reduced-asset-src={reducedAssetSrc}
      data-source-license={asset.license}
      data-force-motion-for-review={forceMotionForReview ? "true" : undefined}
    >
      {shouldRenderLottie ? (
        <span
          ref={lottieContainerRef}
          className="v2hp-motion-player__lottie"
          data-testid="habit-lottie-player"
          data-habit-lottie-player={pictogramId}
          data-lottie-asset={asset.lottie}
        />
      ) : reducedAssetSrc ? (
        <img
          aria-hidden="true"
          className="v2hp-motion-player__still"
          data-habit-motion-still={pictogramId}
          decoding="async"
          draggable={false}
          loading="lazy"
          role="img"
          src={reducedAssetSrc}
          alt=""
        />
      ) : null}
    </span>
  );
}
