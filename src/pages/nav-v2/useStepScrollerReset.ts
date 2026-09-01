import { useLayoutEffect, useRef } from "react";

export function useStepScrollerReset() {
  const ref = useRef<HTMLDivElement>(null);

  useLayoutEffect(() => {
    if (ref.current) ref.current.scrollTop = 0;
  }, []);

  return ref;
}
