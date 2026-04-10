import { useMemo } from "react";
import { useMediaQuery } from "./useMediaQuery";

export type InputMethod = "touch" | "mouse" | "keyboard";

export function useInputMethod() {
  const isCoarsePointer = useMediaQuery("(pointer: coarse)");
  const canHover = useMediaQuery("(hover: hover)");

  const method = useMemo<InputMethod>(() => {
    if (isCoarsePointer && !canHover) return "touch";
    return "mouse";
  }, [isCoarsePointer, canHover]);

  return useMemo(
    () => ({
      method,
      isTouch: method === "touch",
      isMouse: method === "mouse",
      canHover,
    }),
    [method, canHover]
  );
}
