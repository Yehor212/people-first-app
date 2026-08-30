import { useEffect, useRef, useState } from "react";
import { shouldAnimate } from "@/lib/animationUtils";
import { isAndroid } from "@/lib/platform";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import { useThemeStore } from "@/stores/themeStore";
import {
  getHabitCelebrationAsset,
  getHabitCelebrationPosterUrl,
  type HabitCelebrationVariant,
} from "./habitCelebrationAssets";
import {
  startHabitCelebrationAnimation,
  type HabitCelebrationPlayback,
} from "./habitTgsRuntime";
import {
  HABIT_LOTTIE_RUNTIME_ENABLED,
  getHabitIconAsset,
  isHabitAnimatedRasterApproved,
  isHabitLottieApproved,
  isHabitRasterApproved,
  type HabitIconRenderer,
  type HabitIconMotionState,
} from "./habitMotionAssets";
import "./HabitMotionPlayer.css";

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

function toAnimatedRasterState(state: HabitIconMotionState): "idle" | "complete" | "streak" {
  return state === "complete" || state === "streak" ? state : "idle";
}

interface HabitMotionPlayerProps {
  pictogramId: V2HabitPictogramId;
  renderer?: HabitIconRenderer | "auto";
  state?: HabitIconMotionState;
  motionAllowed?: boolean;
  forceMotionForReview?: boolean;
  playToken?: number;
  celebrationVariant?: HabitCelebrationVariant;
}

export function HabitMotionPlayer({
  pictogramId,
  renderer = "auto",
  state = "idle",
  motionAllowed = true,
  forceMotionForReview = false,
  playToken,
  celebrationVariant,
}: HabitMotionPlayerProps) {
  const appliedTheme = useThemeStore((store) => store.appliedTheme);
  const posterVariant: HabitCelebrationVariant = appliedTheme === "paper" ? "day" : "night";
  const playbackVariant = celebrationVariant ?? posterVariant;
  const asset = getHabitIconAsset(pictogramId);
  const animationAllowed = motionAllowed && (forceMotionForReview || shouldAnimate());
  const requestedRenderer = renderer === "auto" ? asset.idle.renderer : renderer;
  const runtimeRenderer =
    requestedRenderer === "lottie" && !HABIT_LOTTIE_RUNTIME_ENABLED ? "still" : requestedRenderer;
  const effectiveRenderer =
    runtimeRenderer === "raster-sticker"
      ? "raster-sticker"
      : animationAllowed
        ? runtimeRenderer
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
  const canRenderLottie =
    HABIT_LOTTIE_RUNTIME_ENABLED &&
    (forceMotionForReview || isHabitLottieApproved(pictogramId));
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
  const celebrationAsset = getHabitCelebrationAsset(pictogramId);
  const celebrationPosterSrc = isAndroid
    ? getHabitCelebrationPosterUrl(pictogramId, posterVariant)
    : undefined;
  const shouldRenderCelebrationPoster = Boolean(celebrationPosterSrc);
  const shouldAttemptCelebration =
    isAndroid &&
    animationAllowed &&
    typeof playToken === "number" &&
    playToken > 0 &&
    Boolean(celebrationAsset);
  const celebrationContainerRef = useRef<HTMLSpanElement>(null);
  const playbackRef = useRef<HabitCelebrationPlayback | null>(null);
  const [readyToken, setReadyToken] = useState<number | null>(null);
  const [finishedToken, setFinishedToken] = useState<number | null>(null);
  const celebrationActive = shouldAttemptCelebration && finishedToken !== playToken;
  const celebrationReady = celebrationActive && readyToken === playToken;

  useEffect(() => {
    if (!shouldAttemptCelebration || !celebrationActive || playToken === undefined) return;
    const container = celebrationContainerRef.current;
    if (!container) return;
    const token = playToken;
    const abortController = new AbortController();
    let cancelled = false;
    let playback: HabitCelebrationPlayback | null = null;
    const finish = () => {
      if (!cancelled) setFinishedToken(token);
    };
    const safetyTimer = window.setTimeout(finish, 3_600);

    void startHabitCelebrationAnimation({
      container,
      pictogramId,
      variant: playbackVariant,
      signal: abortController.signal,
      onReady: () => {
        if (!cancelled) setReadyToken(token);
      },
      onComplete: finish,
      onError: finish,
    })
      .then((startedPlayback) => {
        if (cancelled) {
          void startedPlayback.ready.catch(() => undefined);
          startedPlayback.destroy();
          return;
        }
        playback = startedPlayback;
        playbackRef.current = startedPlayback;
        void startedPlayback.ready.catch(finish);
      })
      .catch(finish);

    return () => {
      cancelled = true;
      abortController.abort();
      window.clearTimeout(safetyTimer);
      void playback?.ready.catch(() => undefined);
      playback?.destroy();
      if (playbackRef.current === playback) playbackRef.current = null;
    };
  }, [
    celebrationActive,
    playbackVariant,
    pictogramId,
    playToken,
    shouldAttemptCelebration,
  ]);

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
      data-tgs-poster-asset={celebrationPosterSrc}
      data-tgs-poster-variant={shouldRenderCelebrationPoster ? posterVariant : undefined}
      data-source-license={asset.license}
      data-force-motion-for-review={forceMotionForReview ? "true" : undefined}
      data-celebration-token={playToken && playToken > 0 ? playToken : undefined}
      data-celebration-variant={celebrationAsset ? playbackVariant : undefined}
      data-celebration-active={celebrationActive ? "true" : undefined}
      data-celebration-ready={celebrationReady ? "true" : undefined}
    >
      {shouldRenderCelebrationPoster ? (
        <img
          aria-hidden="true"
          className="v2hp-motion-player__tgs-poster"
          data-testid="habit-tgs-poster"
          data-habit-tgs-poster={pictogramId}
          data-variant={posterVariant}
          decoding="async"
          draggable={false}
          loading="eager"
          role="img"
          src={celebrationPosterSrc}
          alt=""
        />
      ) : shouldRenderLottie ? (
        <span
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
      {celebrationActive ? (
        <span
          ref={celebrationContainerRef}
          className="v2hp-motion-player__tgs"
          data-testid="habit-tgs-player"
          data-habit-tgs-player={pictogramId}
          data-ready={celebrationReady ? "true" : "false"}
          data-variant={playbackVariant}
        />
      ) : null}
    </span>
  );
}
