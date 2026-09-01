export const TIMELINE_RENDER_WINDOW_RADIUS = 2;

export interface TimelineWindowDay {
  date: string;
  index: number;
}

export interface TimelineWindowPosition {
  globalIndex: number;
  localIndex: number;
  withinDayOffset: number;
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

export function getTimelineWindowPosition(
  renderWindow: readonly TimelineWindowDay[],
  physicalCenter: number,
  dayWidth: number,
): TimelineWindowPosition | null {
  if (renderWindow.length === 0 || !Number.isFinite(dayWidth) || dayWidth <= 0) return null;

  const localIndex = Math.max(
    0,
    Math.min(Math.floor(physicalCenter / dayWidth), renderWindow.length - 1),
  );
  const withinDayOffset = Math.max(
    0,
    Math.min(physicalCenter - localIndex * dayWidth, dayWidth),
  );

  return {
    globalIndex: renderWindow[localIndex].index,
    localIndex,
    withinDayOffset,
  };
}

export function getTimelineWindowPhysicalCenter(
  renderWindow: readonly TimelineWindowDay[],
  globalIndex: number,
  withinDayOffset: number,
  dayWidth: number,
): number | null {
  if (renderWindow.length === 0 || !Number.isFinite(dayWidth) || dayWidth <= 0) return null;

  const localIndex = renderWindow.findIndex((item) => item.index === globalIndex);
  if (localIndex < 0) return null;

  const safeWithinDayOffset = Math.max(0, Math.min(withinDayOffset, dayWidth));
  return localIndex * dayWidth + safeWithinDayOffset;
}
