import type { KeyboardEvent } from "react";

const NEXT_KEYS = new Set(["ArrowRight", "ArrowDown"]);
const PREVIOUS_KEYS = new Set(["ArrowLeft", "ArrowUp"]);

function targetIndexForKey(key: string, currentIndex: number, itemCount: number) {
  if (itemCount <= 0) return null;
  if (NEXT_KEYS.has(key)) return (currentIndex + 1) % itemCount;
  if (PREVIOUS_KEYS.has(key)) return (currentIndex - 1 + itemCount) % itemCount;
  if (key === "Home") return 0;
  if (key === "End") return itemCount - 1;
  return null;
}

export function handleRadioGroupKeyDown(
  event: KeyboardEvent<HTMLButtonElement>,
  currentIndex: number,
  itemCount: number,
  selectAtIndex: (index: number) => void
) {
  const targetIndex = targetIndexForKey(event.key, currentIndex, itemCount);
  if (targetIndex === null) return;

  event.preventDefault();
  const group = event.currentTarget.closest<HTMLElement>('[role="radiogroup"]');
  const target = group?.querySelectorAll<HTMLElement>('[role="radio"]').item(targetIndex);

  target?.focus();
  selectAtIndex(targetIndex);
}
