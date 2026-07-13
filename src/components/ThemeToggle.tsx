import { useEffect, useState, useCallback } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThemeStore, type ThemePreference } from '@/stores/themeStore';

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
  const stored = useThemeStore.getState().theme;
  if (stored === 'paper') return 'light';
  if (stored === 'auto') return 'system';
  return 'dark';
};

/** Compatibility bridge. The canonical store owns every derived theme side effect. */
export const applyTheme = (effectiveTheme: EffectiveTheme) => {
  const current = useThemeStore.getState();
  if (current.theme === 'auto') current._resolve();
  else if ((current.appliedTheme === 'paper' ? 'light' : 'dark') !== effectiveTheme) {
    current.setTheme(effectiveTheme === 'light' ? 'paper' : 'ink');
  }
};

/** Save theme preference */
export const setThemePreference = (theme: ThemeOption) => {
  const canonical: ThemePreference =
    theme === 'light' ? 'paper' : theme === 'dark' ? 'ink' : 'auto';
  return useThemeStore.getState().setTheme(canonical);
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

    const effective = useThemeStore.getState().appliedTheme === 'paper' ? 'light' : 'dark';
    setEffectiveTheme(effective);
  }, []);

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
        className="relative flex-shrink-0 w-[52px] h-[36px] rounded-full bg-muted motion-safe:transition-colors"
        aria-label={t.toggleTheme || 'Toggle theme'}
        disabled
      >
        <div className="absolute top-[7px] left-[27px] w-[22px] h-[22px] rounded-full bg-muted-foreground/30 flex items-center justify-center">
          <Moon className="w-3.5 h-3.5 text-muted-foreground" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex-shrink-0 rounded-full motion-safe:transition-all motion-safe:duration-300",
        "w-[52px] h-[36px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        effectiveTheme === 'light' ? 'bg-sky-300' : 'bg-slate-700'
      )}
      aria-label={effectiveTheme === 'light' ? (t.switchToDark || 'Switch to dark mode') : (t.switchToLight || 'Switch to light mode')}
    >
      {/* Toggle circle */}
      <div
        className={cn(
          "absolute top-[7px] w-[22px] h-[22px] rounded-full motion-safe:transition-all motion-safe:duration-300 flex items-center justify-center shadow-sm",
          effectiveTheme === 'light'
            ? 'left-[3px] bg-yellow-400'
            : 'left-[27px] bg-indigo-950 ring-1 ring-slate-500/30'
        )}
      >
        {effectiveTheme === 'light' ? (
          <Sun className="w-3.5 h-3.5 text-white" aria-hidden="true" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-slate-600 dark:text-slate-300" aria-hidden="true" />
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
