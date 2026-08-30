import { memo, type RefObject } from "react";

interface AndroidDayLargeEffectsProps {
  active: boolean;
  enabled: boolean;
  canvasRef: RefObject<HTMLCanvasElement>;
}

export function useAndroidDayLargeEffects(
  _enabled: boolean,
  _active: boolean,
  _rootRef: RefObject<HTMLDivElement>,
  _canvasRef: RefObject<HTMLCanvasElement>,
  _onFallbackRequired: (required: boolean) => void
): void {}

export const AndroidDayLargeEffects = memo(function AndroidDayLargeEffects(
  _props: AndroidDayLargeEffectsProps
) {
  return null;
});
