import { useCallback, useRef, useState, type ReactElement, type RefObject } from "react";

import { AutomationHistorySheet } from "./AutomationHistorySheet";

interface V2ConnectedHistoryLayer {
  historyLayer: ReactElement;
  openConnectedHistory: (returnFocusTarget: HTMLElement | null) => void;
}

export function useV2ConnectedHistoryLayer(
  fallbackFocusRef: RefObject<HTMLElement | null>,
): V2ConnectedHistoryLayer {
  const [open, setOpen] = useState(false);
  const returnFocusRef = useRef<HTMLElement | null>(null);

  const openConnectedHistory = useCallback(
    (returnFocusTarget: HTMLElement | null) => {
      returnFocusRef.current = returnFocusTarget ?? fallbackFocusRef.current;
      setOpen(true);
    },
    [fallbackFocusRef],
  );

  const closeConnectedHistory = useCallback(() => setOpen(false), []);

  return {
    openConnectedHistory,
    historyLayer: (
      <AutomationHistorySheet
        open={open}
        onClose={closeConnectedHistory}
        returnFocusRef={returnFocusRef}
      />
    ),
  };
}
