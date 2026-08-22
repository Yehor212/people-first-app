export interface VerticalBounds {
  bottom: number;
  top: number;
}

interface ScrollVisibilityInput {
  currentScrollTop: number;
  element: VerticalBounds;
  padding?: number;
  viewport: VerticalBounds;
}

/**
 * Calculates the smallest scroll adjustment that keeps a focused control
 * fully inside its owning scrollport. The scrollport bounds already reflect
 * visualViewport/IME layout, so no keyboard-height heuristic is required.
 */
export function calculateScrollTopForVisibility({
  currentScrollTop,
  element,
  padding = 12,
  viewport,
}: ScrollVisibilityInput): number {
  const values = [
    currentScrollTop,
    element.top,
    element.bottom,
    padding,
    viewport.top,
    viewport.bottom,
  ];
  if (!values.every(Number.isFinite)) return Math.max(0, currentScrollTop || 0);

  const viewportHeight = Math.max(0, viewport.bottom - viewport.top);
  const elementHeight = Math.max(0, element.bottom - element.top);
  const requestedPadding = Math.max(0, padding);
  const effectivePadding = Math.min(
    requestedPadding,
    Math.max(0, (viewportHeight - elementHeight) / 2),
  );
  const visibleTop = viewport.top + effectivePadding;
  const visibleBottom = viewport.bottom - effectivePadding;

  let delta = 0;
  if (element.top < visibleTop) {
    delta = element.top - visibleTop;
  } else if (element.bottom > visibleBottom) {
    delta = element.bottom - visibleBottom;
  }

  return Math.max(0, currentScrollTop + delta);
}

export function keepElementVisibleInScrollport(
  element: HTMLElement,
  scrollport: HTMLElement,
  padding = 12,
): boolean {
  const nextScrollTop = calculateScrollTopForVisibility({
    currentScrollTop: scrollport.scrollTop,
    element: element.getBoundingClientRect(),
    padding,
    viewport: scrollport.getBoundingClientRect(),
  });

  if (Math.abs(nextScrollTop - scrollport.scrollTop) < 0.5) return false;
  scrollport.scrollTop = nextScrollTop;
  return true;
}
