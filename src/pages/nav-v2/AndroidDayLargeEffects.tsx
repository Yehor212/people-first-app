import { memo, type RefObject } from "react";
import { ANDROID_DAY_MOTION_MODEL_LABEL } from "./dayCosmicMotionModel";

export {
  ANDROID_DAY_LARGE_EFFECT_FRAGMENT_SHADER,
  ANDROID_DAY_LARGE_EFFECT_TEST_IDS,
  ANDROID_DAY_LARGE_EFFECT_VERTEX_SHADER,
  calculateAndroidDayAmbiencePhases,
  useAndroidDayLargeEffects,
} from "./useAndroidDayLargeEffects";

interface AndroidDayLargeEffectsProps {
  active: boolean;
  enabled: boolean;
  canvasRef: RefObject<HTMLCanvasElement>;
}

export const AndroidDayLargeEffects = memo(function AndroidDayLargeEffects({
  active,
  canvasRef,
  enabled,
}: AndroidDayLargeEffectsProps) {
  if (!enabled) return null;
  return (
    <canvas
      ref={canvasRef}
      aria-hidden="true"
      className="day-cosmic__android-large-effects"
      data-android-day-active={active ? "true" : "false"}
      data-android-day-motion-model={ANDROID_DAY_MOTION_MODEL_LABEL}
      data-renderer="webgl2"
      data-testid="android-day-webgl-large-effects"
    />
  );
});
