import { useState, useMemo, useCallback } from "react";
import type { DiaryThemeName, DiaryFontName, DiaryThemeConfig } from "./types";
import { DIARY_THEMES, DIARY_FONTS, DIARY_THEME_NAMES, DIARY_FONT_NAMES } from "./types";

function normalizeDiaryThemeName(value: unknown): DiaryThemeName {
  return DIARY_THEME_NAMES.includes(value as DiaryThemeName) ? (value as DiaryThemeName) : "dark";
}

function normalizeDiaryFontName(value: unknown): DiaryFontName {
  return DIARY_FONT_NAMES.includes(value as DiaryFontName) ? (value as DiaryFontName) : "caveat";
}

interface DiaryThemeState {
  theme: DiaryThemeName;
  font: DiaryFontName;
  themeVars: DiaryThemeConfig;
  fontFamily: string;
  fontStyle: "normal" | "italic";
  accentColor: string;
  setTheme: (theme: DiaryThemeName) => void;
  setFont: (font: DiaryFontName) => void;
}

export function useDiaryTheme(
  initialTheme: DiaryThemeName = "dark",
  initialFont: DiaryFontName = "caveat",
): DiaryThemeState {
  const [theme, setThemeState] = useState(() => normalizeDiaryThemeName(initialTheme));
  const [font, setFontState] = useState(() => normalizeDiaryFontName(initialFont));

  const setTheme = useCallback((nextTheme: DiaryThemeName) => {
    setThemeState(normalizeDiaryThemeName(nextTheme));
  }, []);

  const setFont = useCallback((nextFont: DiaryFontName) => {
    setFontState(normalizeDiaryFontName(nextFont));
  }, []);

  const themeVars = DIARY_THEMES[theme] ?? DIARY_THEMES.dark;
  const fontConfig = DIARY_FONTS[font] ?? DIARY_FONTS.caveat;
  const fontFamily = fontConfig.family;
  const fontStyle = fontConfig.style;
  const accentColor = themeVars["--diary-accent"];

  // Memoize the full return to prevent unnecessary re-renders downstream
  return useMemo(
    () => ({
      theme,
      font,
      themeVars,
      fontFamily,
      fontStyle,
      accentColor,
      setTheme,
      setFont,
    }),
    [theme, font, themeVars, fontFamily, fontStyle, accentColor, setTheme, setFont],
  );
}
