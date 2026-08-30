import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";
import type { HabitCelebrationVariant } from "./habitCelebrationAssets";

export interface HabitCelebrationPlayback {
  destroy: () => void;
  ready: Promise<void>;
}

interface StartHabitCelebrationOptions {
  container: Element;
  pictogramId: V2HabitPictogramId;
  variant: HabitCelebrationVariant;
  onReady: () => void;
  onComplete: () => void;
  onError: () => void;
  signal?: AbortSignal;
}

export async function preloadHabitCelebrationAnimation(
  _pictogramId: V2HabitPictogramId,
  _variant: HabitCelebrationVariant
): Promise<void> {}

export async function startHabitCelebrationAnimation(
  _options: StartHabitCelebrationOptions
): Promise<HabitCelebrationPlayback> {
  throw new Error("habit-tgs-android-only");
}
