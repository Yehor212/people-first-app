import { cn } from "@/lib/utils";
import {
  getV2HabitPictogramFamily,
  resolveV2HabitPictogramId,
  type V2HabitPictogramId,
} from "@/lib/v2HabitPictograms";
import { HabitMotionPlayer } from "./HabitMotionPlayer";
import {
  HABIT_LOTTIE_RUNTIME_ENABLED,
  getHabitIconAsset,
  isHabitAnimatedRasterApproved,
  isHabitLottieApproved,
  isHabitRasterApproved,
  type HabitIconMotionState,
  type HabitIconRenderer,
} from "./habitMotionAssets";

interface V2HabitPictogramProps {
  value?: string;
  pictogramId?: V2HabitPictogramId;
  className?: string;
  decorative?: boolean;
  motionMode?: HabitIconRenderer | "auto";
  motionState?: HabitIconMotionState;
  motionAllowed?: boolean;
  forceMotionForReview?: boolean;
}

function toReadableLabel(id: V2HabitPictogramId): string {
  return getHabitIconAsset(id).label || id.replace(/-/g, " ");
}

export function V2HabitPictogram({
  value,
  pictogramId,
  className,
  decorative = true,
  motionMode = "auto",
  motionState = "idle",
  motionAllowed = true,
  forceMotionForReview = false,
}: V2HabitPictogramProps) {
  const id = pictogramId ?? resolveV2HabitPictogramId(value);
  const family = getV2HabitPictogramFamily(id);
  const asset = getHabitIconAsset(id);
  const hasLottieCandidate = asset.idle.renderer === "lottie" && Boolean(asset.lottie);
  const canUseLottieRuntime = HABIT_LOTTIE_RUNTIME_ENABLED && hasLottieCandidate;
  const hasAnimatedRasterCandidate =
    asset.idle.renderer === "animated-raster" && Boolean(asset.animatedRaster);
  const isApprovedLottie = canUseLottieRuntime && isHabitLottieApproved(id);
  const isApprovedLottieStaticFallback =
    !HABIT_LOTTIE_RUNTIME_ENABLED && hasLottieCandidate && isHabitLottieApproved(id);
  const isApprovedAnimatedRaster =
    hasAnimatedRasterCandidate && isHabitAnimatedRasterApproved(id);
  const isApprovedRaster = asset.idle.renderer === "raster-sticker" && isHabitRasterApproved(id);
  const shouldExposeLottie =
    isApprovedLottie || (HABIT_LOTTIE_RUNTIME_ENABLED && forceMotionForReview && hasLottieCandidate);
  const shouldExposeAnimatedRaster = isApprovedAnimatedRaster && !shouldExposeLottie;
  const shouldExposeRaster = isApprovedRaster && !shouldExposeLottie && !shouldExposeAnimatedRaster;
  const iconSource = shouldExposeLottie
    ? isApprovedLottie
      ? "approved-lottie-json"
      : "review-candidate-lottie-json"
    : shouldExposeAnimatedRaster
      ? "approved-animated-raster"
      : shouldExposeRaster
        ? "approved-raster-sticker"
        : "static-reduced-svg-fallback";
  const iconTreatment = shouldExposeLottie
    ? "single-lottie-icon"
    : shouldExposeAnimatedRaster
      ? "artist-grade-animated-raster"
      : shouldExposeRaster
        ? "artist-grade-raster-sticker"
        : "reduced-static-fallback";

  return (
    <span
      className={cn(
        "v2-habit-pictogram v2hp-lottie inline-flex h-5 w-5 items-center justify-center",
        className
      )}
      data-habit-pictogram={id}
      data-pictogram-family={family}
      data-pictogram-style={
        shouldExposeLottie
          ? "single-lottie-json-icon"
          : shouldExposeAnimatedRaster
            ? "artist-grade-animated-raster-icon"
            : shouldExposeRaster
              ? "artist-grade-raster-sticker-icon"
              : "locked-static-reduced-icon"
      }
      data-icon-source={iconSource}
      data-icon-renderer={
        shouldExposeLottie
          ? "lottie-svg-runtime"
          : shouldExposeAnimatedRaster
            ? "animated-raster-apng"
            : shouldExposeRaster
              ? "raster-webp-image"
              : "reduced-svg-still"
      }
      data-icon-license={asset.license}
      data-icon-composition={
        shouldExposeLottie
          ? "one-lottie-json-asset-per-reviewable-habit"
          : shouldExposeAnimatedRaster
            ? "one-animated-raster-apng-sequence-per-approved-habit"
            : shouldExposeRaster
              ? "one-artist-grade-raster-sticker-asset"
              : "static-reduced-fallback-until-approval"
      }
      data-source-pack={
        shouldExposeAnimatedRaster
          ? "apng-raster-sequence"
          : shouldExposeRaster
            ? "imagegen-raster-webp"
            : shouldExposeLottie
              ? "lottie-runtime-optional"
              : "runtime-free-reduced-svg"
      }
      data-source-authenticity={
        shouldExposeLottie
          ? "review-gated-vector-lottie-json-not-emoji"
          : shouldExposeAnimatedRaster
            ? "artist-raster-sequence-not-code-drawn-not-emoji"
            : shouldExposeRaster
              ? "imagegen-raster-sticker-not-code-drawn-not-emoji"
              : "reduced-svg-fallback-not-emoji"
      }
      data-design-contract="no-emoji-no-dom-motion-stack-approval-gated-asset"
      data-visual-upgrade={
        shouldExposeAnimatedRaster
          ? "v2-animated-raster-habit-icon-system"
          : shouldExposeRaster
            ? "v2-raster-sticker-habit-icon-system"
            : shouldExposeLottie
              ? "v2-single-lottie-habit-icon-system"
              : "v2-reduced-svg-habit-icon-system"
      }
      data-art-direction={
        shouldExposeAnimatedRaster
          ? "premium-telegram-grade-animated-raster-walking-sticker"
          : shouldExposeRaster
            ? "premium-telegram-grade-raster-sticker"
            : shouldExposeLottie
              ? "premium-telegram-grade-lottie-icons"
              : "runtime-free-reduced-svg-icons"
      }
      data-icon-treatment={iconTreatment}
      data-template-guard="no-shared-ai-template"
      data-motion-system={
        isApprovedLottie
          ? "approved-single-lottie-json"
          : shouldExposeAnimatedRaster
            ? "approved-animated-raster-sequence"
            : shouldExposeRaster
              ? "approved-raster-sticker"
              : shouldExposeLottie
                ? "review-candidate-lottie-json"
                : isApprovedLottieStaticFallback
                  ? "approved-lottie-static-fallback-runtime-disabled"
                  : "locked-static-until-user-approval"
      }
      data-motion-quality={
        isApprovedLottie
          ? "telegram-grade-lottie-vector-loop"
          : shouldExposeAnimatedRaster
            ? "artist-grade-raster-footstep-road-motion"
            : shouldExposeRaster
              ? "artist-grade-raster-sticker-with-wrapper-motion"
              : shouldExposeLottie
                ? "rejected-candidate-visible-for-review-only"
                : isApprovedLottieStaticFallback
                  ? "approved-lottie-art-static-runtime-free-fallback"
                  : "awaiting-telegram-grade-lottie-approval"
      }
      data-animation-loop-profile={
        shouldExposeAnimatedRaster
          ? "footstep-road-loop"
          : shouldExposeRaster
            ? "wrapper-object-micro-loop"
            : shouldExposeLottie
              ? "seamless-vector-micro-loop"
              : "static-reduced-svg"
      }
      data-animation-frame-rate-target={shouldExposeLottie || shouldExposeAnimatedRaster ? "60" : undefined}
      data-animation-loop-max-duration-ms={asset.idle.durationMs}
      data-animation-performance-contract={
        shouldExposeAnimatedRaster
          ? "animated-raster-apng-with-poster-fallback"
          : shouldExposeRaster
            ? "raster-sticker-renderer-with-reduced-motion-still"
            : shouldExposeLottie
              ? "lottie-svg-renderer-with-reduced-motion-still"
              : "runtime-free-reduced-svg-still"
      }
      data-motion-storyboard={asset.idle.name}
      data-lottie-asset={shouldExposeLottie ? asset.lottie : undefined}
      data-raster-asset={shouldExposeRaster ? asset.raster : undefined}
      data-animated-raster-asset={shouldExposeAnimatedRaster ? asset.animatedRaster?.idle : undefined}
      data-poster-asset={shouldExposeAnimatedRaster ? asset.animatedRaster?.poster : undefined}
      data-reduced-asset={asset.reduced}
      aria-hidden={decorative ? "true" : undefined}
      aria-label={decorative ? undefined : toReadableLabel(id)}
      role={decorative ? undefined : "img"}
    >
      <HabitMotionPlayer
        pictogramId={id}
        renderer={motionMode}
        state={motionState}
        motionAllowed={motionAllowed}
        forceMotionForReview={forceMotionForReview}
      />
    </span>
  );
}
