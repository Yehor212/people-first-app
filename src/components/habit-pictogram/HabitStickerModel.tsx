import { cn } from "@/lib/utils";
import { Check } from "lucide-react";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import { V2HabitPictogram } from "./V2HabitPictogram";
import type { HabitIconMotionState } from "./habitMotionAssets";
import "./HabitStickerModel.css";

export type HabitStickerModelState = "idle" | "complete" | "streak";

type HabitStickerModelId = Extract<V2HabitPictogramId, "read" | "walk-distance">;

const STICKER_MODEL_CONTRACTS: Record<
  HabitStickerModelId,
  {
    caption: string;
    depthModel: string;
    productionCore: string;
    shapeContract: string;
  }
> = {
  read: {
    caption: "Read",
    depthModel: "layered-book-pages-cover-bookmark-shadow",
    productionCore: "approved-read-lottie-json",
    shapeContract: "concrete-open-book-not-blob",
  },
  "walk-distance": {
    caption: "Walk distance",
    depthModel: "layered-sneakers-laces-soles-toe-heel-shadow",
    productionCore: "blocked-walk-distance-awaiting-tgs-lottie-rig",
    shapeContract: "concrete-sneaker-pair-not-blob",
  },
};

interface HabitStickerModelProps {
  pictogramId?: HabitStickerModelId;
  state?: HabitStickerModelState;
  motionAllowed?: boolean;
  className?: string;
  showCaption?: boolean;
  streakCount?: number;
}

function toMotionState(state: HabitStickerModelState): HabitIconMotionState {
  if (state === "complete" || state === "streak") return state;
  return "idle";
}

export function HabitStickerModel({
  pictogramId = "read",
  state = "idle",
  motionAllowed = true,
  className,
  showCaption = false,
  streakCount = 7,
}: HabitStickerModelProps) {
  const showComplete = state === "complete";
  const showStreak = state === "streak";
  const contract = STICKER_MODEL_CONTRACTS[pictogramId];

  return (
    <figure
      className={cn("habit-sticker-model", className)}
      data-testid="habit-sticker-model"
      data-habit-sticker={pictogramId}
      data-sticker-state={state}
      data-art-direction="telegram-style-3d-sticker"
      data-shape-contract={contract.shapeContract}
      data-motion-allowed={motionAllowed ? "true" : "false"}
      data-production-core={contract.productionCore}
      data-model-contract={`${contract.depthModel}-state-reactions`}
    >
      <div
        className="habit-sticker-model__stage"
        data-testid="habit-sticker-stage"
        data-depth-model={contract.depthModel}
        data-state-reaction={state}
      >
        <span className="habit-sticker-model__lighting" aria-hidden="true" />
        <span className="habit-sticker-model__rim" aria-hidden="true" />
        <span
          className="habit-sticker-model__spark habit-sticker-model__spark--one"
          aria-hidden="true"
        />
        <span
          className="habit-sticker-model__spark habit-sticker-model__spark--two"
          aria-hidden="true"
        />
        <span
          className="habit-sticker-model__spark habit-sticker-model__spark--three"
          aria-hidden="true"
        />
        {showComplete && (
          <>
            <span
              className="habit-sticker-model__complete-burst"
              data-testid="habit-sticker-complete-burst"
              aria-hidden="true"
            />
            <span
              className="habit-sticker-model__check"
              data-testid="habit-sticker-check"
              aria-hidden="true"
            >
              <Check aria-hidden="true" />
            </span>
          </>
        )}
        {showStreak && (
          <>
            <span
              className="habit-sticker-model__streak-aura"
              data-testid="habit-sticker-streak-aura"
              aria-hidden="true"
            />
            <span
              className="habit-sticker-model__streak-count"
              data-testid="habit-sticker-streak-count"
              aria-hidden="true"
            >
              {streakCount}d
            </span>
          </>
        )}
        <V2HabitPictogram
          pictogramId={pictogramId}
          className="habit-sticker-model__pictogram"
          decorative={false}
          motionMode="auto"
          motionAllowed={motionAllowed}
          motionState={toMotionState(state)}
        />
      </div>

      {showCaption && (
        <figcaption className="habit-sticker-model__caption">{contract.caption}</figcaption>
      )}
    </figure>
  );
}
