import { useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Capacitor } from '@capacitor/core';
import { StatusBarStyle, Style } from '@/lib/statusBarStyle';
import { logger } from '@/lib/logger';
import { SK } from '@/lib/storageKeys';
import { storageGetRaw, storageSetRaw } from '@/lib/safeJson';

/** Theme options: light, dark, or follow system preference */
export type ThemeOption = 'light' | 'dark' | 'system';

/** Effective theme is always light or dark (system resolves to one of these) */
export type EffectiveTheme = 'light' | 'dark';

/** Get system preference */
export const getSystemTheme = (): EffectiveTheme => {
  if (typeof window === 'undefined') return 'light';
  return window.matchMedia('(prefers-color-scheme: dark)').matches ? 'dark' : 'light';
};

/** Get stored theme preference */
export const getStoredTheme = (): ThemeOption => {
  if (typeof window === 'undefined') return 'system';
  const stored = storageGetRaw(SK.THEME);
  if (stored === 'light' || stored === 'dark' || stored === 'system') {
    return stored;
  }
  return 'system'; // Default to system
};

/** Apply theme to document and update native status bar */
export const applyTheme = (effectiveTheme: EffectiveTheme) => {
  const root = document.documentElement;
  root.classList.toggle('dark', effectiveTheme === 'dark');

  if (Capacitor.isNativePlatform()) {
    const isDark = effectiveTheme === 'dark';
    StatusBarStyle.setStyle({ style: isDark ? Style.Dark : Style.Light }).catch(err => logger.warn('[Theme]', 'StatusBar style failed:', err));
  }
};

/** Save theme preference */
export const setThemePreference = (theme: ThemeOption) => {
  storageSetRaw(SK.THEME, theme);

  // Apply immediately
  const effective = theme === 'system' ? getSystemTheme() : theme;
  applyTheme(effective);

  // Dispatch event so other components can react
  window.dispatchEvent(new CustomEvent('zenflow:theme-change', { detail: { theme, effective } }));
};

/** Hook to use and manage theme */
export function useTheme() {
  const [theme, setTheme] = useState<ThemeOption>('system');
  const [effectiveTheme, setEffectiveTheme] = useState<EffectiveTheme>('light');
  const [mounted, setMounted] = useState(false);

  // Initialize theme on mount
  useEffect(() => {
    setMounted(true);
    const stored = getStoredTheme();
    setTheme(stored);

    const effective = stored === 'system' ? getSystemTheme() : stored;
    setEffectiveTheme(effective);
    applyTheme(effective);
  }, []);

  // Listen for system preference changes when theme is 'system'
  useEffect(() => {
    if (!mounted) return;

    const mediaQuery = window.matchMedia('(prefers-color-scheme: dark)');

    const handleChange = (e: MediaQueryListEvent) => {
      if (theme === 'system') {
        const newEffective = e.matches ? 'dark' : 'light';
        setEffectiveTheme(newEffective);
        applyTheme(newEffective);
      }
    };

    mediaQuery.addEventListener('change', handleChange);
    return () => mediaQuery.removeEventListener('change', handleChange);
  }, [theme, mounted]);

  // Listen for theme changes from other components
  useEffect(() => {
    const handleThemeChange = (e: CustomEvent<{ theme: ThemeOption; effective: EffectiveTheme }>) => {
      setTheme(e.detail.theme);
      setEffectiveTheme(e.detail.effective);
    };

    window.addEventListener('zenflow:theme-change', handleThemeChange as EventListener);
    return () => window.removeEventListener('zenflow:theme-change', handleThemeChange as EventListener);
  }, []);

  const changeTheme = useCallback((newTheme: ThemeOption) => {
    setTheme(newTheme);
    const effective = newTheme === 'system' ? getSystemTheme() : newTheme;
    setEffectiveTheme(effective);
    setThemePreference(newTheme);
  }, []);

  return { theme, effectiveTheme, changeTheme, mounted };
}

/** Header toggle component - cycles through themes */
export function ThemeToggle() {
  const { t } = useLanguage();
  const { effectiveTheme, changeTheme, mounted } = useTheme();

  const toggleTheme = () => {
    // Simple toggle between light and dark (ignores system for quick toggle)
    const newTheme = effectiveTheme === 'light' ? 'dark' : 'light';
    changeTheme(newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="relative flex-shrink-0 w-[52px] h-[36px] rounded-full bg-slate-700 transition-colors"
        style={{ minWidth: '52px', minHeight: '36px' }}
        aria-label={t.toggleTheme || 'Toggle theme'}
        disabled
      >
        <div className="absolute top-[7px] left-[27px] w-[22px] h-[22px] rounded-full bg-slate-800 flex items-center justify-center">
          <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex-shrink-0 rounded-full transition-all duration-300",
        "w-[52px] h-[36px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        effectiveTheme === 'light' ? 'bg-sky-300' : 'bg-slate-700'
      )}
      style={{ minWidth: '52px', minHeight: '36px' }}
      aria-label={effectiveTheme === 'light' ? (t.switchToDark || 'Switch to dark mode') : (t.switchToLight || 'Switch to light mode')}
    >
      {/* Toggle circle */}
      <div
        className={cn(
          "absolute top-[7px] w-[22px] h-[22px] rounded-full transition-all duration-300 flex items-center justify-center shadow-sm",
          effectiveTheme === 'light'
            ? 'left-[3px] bg-yellow-400'
            : 'left-[27px] bg-slate-800'
        )}
      >
        {effectiveTheme === 'light' ? (
          <Sun className="w-3.5 h-3.5 text-white" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" />
        )}
      </div>

      {/* Stars for dark mode */}
      {effectiveTheme === 'dark' && (
        <>
          <div className="absolute top-[6px] left-[6px] w-1 h-1 bg-foreground/60 rounded-full" />
          <div className="absolute top-[14px] left-[12px] w-0.5 h-0.5 bg-foreground/40 rounded-full" />
        </>
      )}
    </button>
  );
}
