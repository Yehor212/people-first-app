import { useEffect, useRef } from "react";
import type { AnimationItem } from "lottie-web";

import drinkWaterLottieUrl from "../../assets/habit-icons/v2/drink-water/idle.lottie.json?url";
import readLottieUrl from "../../assets/habit-icons/v2/read/idle.lottie.json?url";
import { shouldAnimate } from "@/lib/animationUtils";
import { logger } from "@/lib/logger";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import {
  getHabitIconAsset,
  isHabitAnimatedRasterApproved,
  isHabitLottieApproved,
  isHabitRasterApproved,
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

const rasterStickerUrls: Record<string, string> = {};

const animatedRasterUrls: Record<string, string> = {};

const animatedRasterPosterUrls: Record<string, string> = {};

const lottieAnimationUrls: Record<string, string> = {
  "drink-water/idle.lottie.json": drinkWaterLottieUrl,
  "read/idle.lottie.json": readLottieUrl,
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

function toAnimatedRasterState(state: HabitIconMotionState): "idle" | "complete" | "streak" {
  return state === "complete" || state === "streak" ? state : "idle";
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
  const requestedRenderer = renderer === "auto" ? asset.idle.renderer : renderer;
  const effectiveRenderer =
    requestedRenderer === "raster-sticker"
      ? "raster-sticker"
      : animationAllowed
        ? requestedRenderer
        : "still";
  const reducedAssetKey = "../../assets/habit-icons/v2/" + asset.reduced;
  const reducedAssetSrc = reducedIconUrls[reducedAssetKey] ?? "";
  const rasterAssetSrc = asset.raster ? (rasterStickerUrls[asset.raster] ?? "") : "";
  const animatedRasterState = toAnimatedRasterState(state);
  const animatedRasterAsset = asset.animatedRaster?.[animatedRasterState];
  const animatedRasterSrc = animatedRasterAsset
    ? (animatedRasterUrls[animatedRasterAsset] ?? "")
    : "";
  const animatedRasterPosterAsset = asset.animatedRaster?.poster;
  const animatedRasterPosterSrc = animatedRasterPosterAsset
    ? (animatedRasterPosterUrls[animatedRasterPosterAsset] ?? "")
    : "";
  const canRenderLottie = forceMotionForReview || isHabitLottieApproved(pictogramId);
  const shouldRenderLottie =
    canRenderLottie && effectiveRenderer === "lottie" && Boolean(asset.lottie);
  const shouldRenderRaster =
    isHabitRasterApproved(pictogramId) &&
    effectiveRenderer === "raster-sticker" &&
    Boolean(asset.raster) &&
    Boolean(rasterAssetSrc);
  const shouldRenderAnimatedRaster =
    isHabitAnimatedRasterApproved(pictogramId) &&
    effectiveRenderer === "animated-raster" &&
    Boolean(animatedRasterAsset) &&
    Boolean(animatedRasterSrc);
  const shouldRenderAnimatedRasterPoster =
    isHabitAnimatedRasterApproved(pictogramId) &&
    !shouldRenderAnimatedRaster &&
    Boolean(animatedRasterPosterAsset) &&
    Boolean(animatedRasterPosterSrc);
  const renderedKind = shouldRenderLottie
    ? "lottie"
    : shouldRenderAnimatedRaster
      ? "animated-raster"
      : shouldRenderRaster
        ? "raster-sticker"
        : "still";

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
      data-renderer={renderedKind}
      data-motion-state={state}
      data-loop-duration-ms={asset.idle.durationMs}
      data-motion-name={asset.idle.name}
      data-lottie-asset={shouldRenderLottie ? asset.lottie : undefined}
      data-raster-asset={shouldRenderRaster ? asset.raster : undefined}
      data-raster-asset-src={shouldRenderRaster ? rasterAssetSrc : undefined}
      data-animated-raster-asset={shouldRenderAnimatedRaster ? animatedRasterAsset : undefined}
      data-animated-raster-asset-src={shouldRenderAnimatedRaster ? animatedRasterSrc : undefined}
      data-animation-format={shouldRenderAnimatedRaster ? asset.animatedRaster?.format : undefined}
      data-poster-asset={shouldRenderAnimatedRaster || shouldRenderAnimatedRasterPoster ? animatedRasterPosterAsset : undefined}
      data-poster-asset-src={shouldRenderAnimatedRaster || shouldRenderAnimatedRasterPoster ? animatedRasterPosterSrc : undefined}
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
      ) : shouldRenderAnimatedRaster ? (
        <img
          key={pictogramId + "-" + animatedRasterState}
          aria-hidden="true"
          className="v2hp-motion-player__animated-raster"
          data-testid="habit-animated-raster"
          data-habit-animated-raster={pictogramId}
          data-animated-raster-state={animatedRasterState}
          data-animated-raster-asset={animatedRasterAsset}
          decoding="async"
          draggable={false}
          loading="eager"
          role="img"
          src={animatedRasterSrc}
          alt=""
        />
      ) : shouldRenderRaster ? (
        <img
          aria-hidden="true"
          className="v2hp-motion-player__raster"
          data-testid="habit-raster-sticker"
          data-habit-raster-sticker={pictogramId}
          data-raster-asset={asset.raster}
          decoding="async"
          draggable={false}
          loading="eager"
          role="img"
          src={rasterAssetSrc}
          alt=""
        />
      ) : shouldRenderAnimatedRasterPoster ? (
        <img
          aria-hidden="true"
          className="v2hp-motion-player__animated-raster-poster"
          data-testid="habit-animated-raster-poster"
          data-habit-animated-raster-poster={pictogramId}
          data-poster-asset={animatedRasterPosterAsset}
          decoding="async"
          draggable={false}
          loading="eager"
          role="img"
          src={animatedRasterPosterSrc}
          alt=""
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
