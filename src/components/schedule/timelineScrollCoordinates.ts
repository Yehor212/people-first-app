const clampScrollPosition = (position: number, maxScroll: number): number =>
  Math.min(Math.max(position, 0), Math.max(maxScroll, 0));

/**
 * The timeline is positioned from the physical left edge. In an RTL scroller,
 * the DOM origin is the physical right edge, so standards-based engines expose
 * negative scrollLeft values while moving toward the physical left edge.
 */
export function physicalToDomScrollLeft(
  physicalPosition: number,
  maxScroll: number,
  isRTL: boolean,
): number {
  const clampedPosition = clampScrollPosition(physicalPosition, maxScroll);
  return isRTL ? clampedPosition - Math.max(maxScroll, 0) : clampedPosition;
}

export function domToPhysicalScrollLeft(
  domPosition: number,
  maxScroll: number,
  isRTL: boolean,
): number {
  const physicalPosition = isRTL ? Math.max(maxScroll, 0) + domPosition : domPosition;
  return clampScrollPosition(physicalPosition, maxScroll);
}
