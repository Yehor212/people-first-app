import { memo, useEffect, useMemo, useState } from "react";

import { cn } from "@/lib/utils";
import { useThemeStore } from "@/stores/themeStore";

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

function getDiaryWallpaperTone(date = new Date()): DiaryWallpaperTone {
  const hour = date.getHours();
  return hour >= 6 && hour < 19 ? "day" : "night";
}

export const DiaryWallpaper = memo(function DiaryWallpaper({
  surface = "page",
  className,
}: DiaryWallpaperProps) {
  const appliedTheme = useThemeStore((state) => state.appliedTheme);
  const [now, setNow] = useState(() => new Date());

  useEffect(() => {
    const interval = window.setInterval(() => setNow(new Date()), 15 * 60 * 1000);
    return () => window.clearInterval(interval);
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
    >
      <span className="journal-wallpaper__sky" />
      <span className="journal-wallpaper__horizon" />
      <span className="journal-wallpaper__veil" />
    </div>
  );
});
