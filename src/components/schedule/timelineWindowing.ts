export const TIMELINE_RENDER_WINDOW_RADIUS = 2;

export interface TimelineWindowDay {
  date: string;
  index: number;
}

export function getTimelineRenderWindow(
  allDates: readonly string[],
  selectedDate: string,
  radius = TIMELINE_RENDER_WINDOW_RADIUS,
): TimelineWindowDay[] {
  if (allDates.length === 0) return [];

  const selectedIndex = allDates.indexOf(selectedDate);
  const anchorIndex = selectedIndex >= 0 ? selectedIndex : 0;
  const safeRadius = Math.max(0, Math.floor(radius));
  const startIndex = Math.max(0, anchorIndex - safeRadius);
  const endIndex = Math.min(allDates.length - 1, anchorIndex + safeRadius);

  return allDates.slice(startIndex, endIndex + 1).map((date, offset) => ({
    date,
    index: startIndex + offset,
  }));
}
