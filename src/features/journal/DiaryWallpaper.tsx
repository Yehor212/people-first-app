import { memo, useEffect, useMemo, useState, type CSSProperties } from "react";

import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";
import auroraMountainsUrl from "@/assets/journal/aurora-mountains.webp";
import daylightJournalWallpaperUrl from "@/assets/journal/daylight-journal-wallpaper.webp";

type DiaryWallpaperSurface = "page" | "empty";
type DiaryWallpaperTone = "day" | "night";

const DIARY_WALLPAPER_TONE_CLASS: Record<DiaryWallpaperTone, string> = {
  day: "journal-wallpaper--day",
  night: "journal-wallpaper--night",
};

const DIARY_WALLPAPER_SURFACE_CLASS: Record<DiaryWallpaperSurface, string> = {
  page: "journal-wallpaper--page",
  empty: "journal-wallpaper--empty",
};

interface DiaryWallpaperProps {
  surface?: DiaryWallpaperSurface;
  className?: string;
}

const DIARY_WALLPAPER_DAY_START_HOUR = 6;
const DIARY_WALLPAPER_NIGHT_START_HOUR = 19;
const DIARY_WALLPAPER_MIN_REFRESH_DELAY_MS = 250;

function getDiaryWallpaperTone(date = new Date()): DiaryWallpaperTone {
  const hour = date.getHours();
  return hour >= DIARY_WALLPAPER_DAY_START_HOUR && hour < DIARY_WALLPAPER_NIGHT_START_HOUR
    ? "day"
    : "night";
}

function getNextDiaryWallpaperToneBoundaryDelay(date = new Date()): number {
  const currentTime = date.getTime();
  const boundaries = [DIARY_WALLPAPER_DAY_START_HOUR, DIARY_WALLPAPER_NIGHT_START_HOUR]
    .map((hour) => {
      const boundary = new Date(date);
      boundary.setHours(hour, 0, 0, 0);
      return boundary.getTime();
    })
    .sort((a, b) => a - b);

  const nextTodayBoundary = boundaries.find((boundaryTime) => boundaryTime > currentTime);
  const nextBoundaryTime =
    nextTodayBoundary ??
    (() => {
      const boundary = new Date(date);
      boundary.setDate(boundary.getDate() + 1);
      boundary.setHours(DIARY_WALLPAPER_DAY_START_HOUR, 0, 0, 0);
      return boundary.getTime();
    })();

  return Math.max(
    DIARY_WALLPAPER_MIN_REFRESH_DELAY_MS,
    nextBoundaryTime - currentTime,
  );
}

export const DiaryWallpaper = memo(function DiaryWallpaper({
  surface = "page",
  className,
}: DiaryWallpaperProps) {
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    let timeoutId: number | undefined;

    const scheduleNextToneRefresh = () => {
      timeoutId = window.setTimeout(() => {
        setNow(new Date());
        scheduleNextToneRefresh();
      }, getNextDiaryWallpaperToneBoundaryDelay());
    };

    scheduleNextToneRefresh();

    return () => {
      if (timeoutId !== undefined) {
        window.clearTimeout(timeoutId);
      }
    };
  }, []);

  const naturalTone = getDiaryWallpaperTone(now);
  const tone: DiaryWallpaperTone =
    appliedTheme === "ink" || appliedTheme === "oled" ? "night" : naturalTone;

  const wallpaperClassName = useMemo(
    () =>
      cn(
        "journal-wallpaper",
        DIARY_WALLPAPER_TONE_CLASS[tone],
        DIARY_WALLPAPER_SURFACE_CLASS[surface],
        appliedTheme === "paper" && "journal-wallpaper--paper",
        appliedTheme === "oled" && "journal-wallpaper--oled",
        className,
      ),
    [appliedTheme, className, surface, tone],
  );

  return (
    <div
      className={wallpaperClassName}
      aria-hidden="true"
      data-testid="journal-wallpaper"
      data-wallpaper-surface={surface}
      data-wallpaper-tone={tone}
      data-wallpaper-motion="static"
      data-wallpaper-platform="universal"
      style={{
        "--journal-wallpaper-day-scenic-image": `url(${daylightJournalWallpaperUrl})`,
        "--journal-wallpaper-night-scenic-image": `url(${auroraMountainsUrl})`,
      } as CSSProperties}
    >
      <span className="journal-wallpaper__scenic-vista" />
      <span className="journal-wallpaper__sky" />
      <span className="journal-wallpaper__horizon" />
      <span className="journal-wallpaper__daybreak-arc" />
      <span className="journal-wallpaper__moon-gate" />
      <span className="journal-wallpaper__ink-river" />
      <span className="journal-wallpaper__prism-field" />
      <span className="journal-wallpaper__starfield" />
      <span className="journal-wallpaper__deep-stars" />
      <span className="journal-wallpaper__starlace" />
      <span className="journal-wallpaper__memory-bloom" />
      <span className="journal-wallpaper__luminance-wash" />
      <span className="journal-wallpaper__desktop-vista" />
      <span className="journal-wallpaper__constellation" />
      <span className="journal-wallpaper__sheet" />
      <span className="journal-wallpaper__margin-map" />
      <span className="journal-wallpaper__fiber journal-wallpaper__fiber--one" />
      <span className="journal-wallpaper__fiber journal-wallpaper__fiber--two" />
      <span className="journal-wallpaper__botanical" />
      <span className="journal-wallpaper__safe-frame" />
      <span className="journal-wallpaper__quiet-grain" />
      <span className="journal-wallpaper__veil" />
    </div>
  );
});
