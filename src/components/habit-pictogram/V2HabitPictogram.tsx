import { cn } from "@/lib/utils";
import {
  getV2HabitPictogramFamily,
  resolveV2HabitPictogramId,
  type V2HabitPictogramId,
} from "@/lib/v2HabitPictograms";
import { HabitMotionPlayer } from "./HabitMotionPlayer";
import {
  getHabitIconAsset,
  isHabitLottieApproved,
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
  const isApprovedLottie = hasLottieCandidate && isHabitLottieApproved(id);
  const shouldExposeLottie = isApprovedLottie || (forceMotionForReview && hasLottieCandidate);
  const iconSource = shouldExposeLottie
    ? isApprovedLottie
      ? "approved-lottie-json"
      : "review-candidate-lottie-json"
    : "static-reduced-svg-fallback";
  const iconTreatment = shouldExposeLottie ? "single-lottie-icon" : "reduced-static-fallback";

  return (
    <span
      className={cn(
        "v2-habit-pictogram v2hp-lottie inline-flex h-5 w-5 items-center justify-center",
        className
      )}
      data-habit-pictogram={id}
      data-pictogram-family={family}
      data-pictogram-style={
        shouldExposeLottie ? "single-lottie-json-icon" : "locked-static-reduced-icon"
      }
      data-icon-source={iconSource}
      data-icon-renderer={shouldExposeLottie ? "lottie-web-svg" : "reduced-svg-still"}
      data-icon-license={asset.license}
      data-icon-composition={
        shouldExposeLottie
          ? "one-lottie-json-asset-per-reviewable-habit"
          : "static-reduced-fallback-until-approval"
      }
      data-source-pack="lottie-web@5.13.0"
      data-source-authenticity={
        shouldExposeLottie
          ? "review-gated-vector-lottie-json-not-emoji"
          : "reduced-svg-fallback-not-emoji"
      }
      data-design-contract="no-emoji-no-dom-motion-stack-approval-gated-lottie"
      data-visual-upgrade="v2-single-lottie-habit-icon-system"
      data-art-direction="premium-telegram-grade-lottie-icons"
      data-icon-treatment={iconTreatment}
      data-template-guard="no-shared-ai-template"
      data-motion-system={
        isApprovedLottie
          ? "approved-single-lottie-json"
          : shouldExposeLottie
            ? "review-candidate-lottie-json"
            : "locked-static-until-user-approval"
      }
      data-motion-quality={
        isApprovedLottie
          ? "telegram-grade-lottie-vector-loop"
          : shouldExposeLottie
            ? "rejected-candidate-visible-for-review-only"
            : "awaiting-telegram-grade-lottie-approval"
      }
      data-animation-loop-profile="seamless-vector-micro-loop"
      data-animation-frame-rate-target={shouldExposeLottie ? "60" : undefined}
      data-animation-loop-max-duration-ms={asset.idle.durationMs}
      data-animation-performance-contract="lottie-svg-renderer-with-reduced-motion-still"
      data-motion-storyboard={asset.idle.name}
      data-lottie-asset={shouldExposeLottie ? asset.lottie : undefined}
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
