import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import { getHabitIconAsset, type HabitIconRenderer, type HabitIconMotionState } from "./habitMotionAssets";

const reducedIconUrls: Record<string, string> = import.meta.glob("../../assets/habit-icons/v2/*/reduced.svg", {
  eager: true,
  import: "default",
  query: "?url",
});

interface HabitMotionPlayerProps {
  pictogramId: V2HabitPictogramId;
  renderer?: HabitIconRenderer | "auto";
  state?: HabitIconMotionState;
  motionAllowed?: boolean;
}

export function HabitMotionPlayer({
  pictogramId,
  renderer = "auto",
  state = "idle",
  motionAllowed = true,
}: HabitMotionPlayerProps) {
  const asset = getHabitIconAsset(pictogramId);
  const effectiveRenderer = motionAllowed
    ? renderer === "auto"
      ? asset.idle.renderer
      : renderer
    : "still";
  const reducedAssetKey = "../../assets/habit-icons/v2/" + asset.reduced;
  const reducedAssetSrc = reducedIconUrls[reducedAssetKey] ?? "";

  return (
    <span
      aria-hidden="true"
      className="v2hp-motion-player"
      data-testid="habit-motion-player"
      data-habit-motion-player={pictogramId}
      data-renderer={effectiveRenderer}
      data-motion-state={state}
      data-loop-duration-ms={asset.idle.durationMs}
      data-motion-name={asset.idle.name}
      data-reduced-asset={asset.reduced}
      data-reduced-asset-src={reducedAssetSrc}
      data-source-license={asset.license}
    >
      {reducedAssetSrc ? (
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
