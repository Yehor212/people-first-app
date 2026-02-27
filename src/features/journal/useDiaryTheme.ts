import { useState, useEffect, useRef, useMemo } from 'react';
import type { DiaryThemeName, DiaryFontName, DiaryThemeConfig } from './types';
import { DIARY_THEMES, DIARY_FONTS } from './types';

interface DiaryThemeState {
  theme: DiaryThemeName;
  font: DiaryFontName;
  themeVars: DiaryThemeConfig;
  fontFamily: string;
  accentColor: string;
  setTheme: (theme: DiaryThemeName) => void;
  setFont: (font: DiaryFontName) => void;
}

export function useDiaryTheme(
  initialTheme: DiaryThemeName = 'dark',
  initialFont: DiaryFontName = 'caveat',
): DiaryThemeState {
  const [theme, setTheme] = useState(initialTheme);
  const [font, setFont] = useState(initialFont);
  const fontLinkRef = useRef<HTMLLinkElement | null>(null);

  // Load Google Font dynamically — cleaned up on unmount/change
  useEffect(() => {
    const config = DIARY_FONTS[font];
    if (!config) return;

    // Check if font already loaded (avoid duplicate <link> tags)
    const existing = document.querySelector(`link[href="${config.url}"]`);
    if (existing) return;

    const link = document.createElement('link');
    link.rel = 'stylesheet';
    link.href = config.url;
    document.head.appendChild(link);
    fontLinkRef.current = link;

    return () => {
      if (fontLinkRef.current) {
        fontLinkRef.current.remove();
        fontLinkRef.current = null;
      }
    };
  }, [font]);

  const themeVars = DIARY_THEMES[theme];
  const fontFamily = DIARY_FONTS[font].family;
  const accentColor = themeVars['--diary-accent'];

  // Memoize the full return to prevent unnecessary re-renders downstream
  return useMemo(() => ({
    theme,
    font,
    themeVars,
    fontFamily,
    accentColor,
    setTheme,
    setFont,
  }), [theme, font]);
}
