import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

export function ThemeToggle() {
  const { t } = useLanguage();
  const [theme, setTheme] = useState<'light' | 'dark'>('light');
  const [mounted, setMounted] = useState(false);

  useEffect(() => {
    setMounted(true);
    // Check localStorage or system preference
    const stored = localStorage.getItem('zenflow-theme');
    if (stored === 'dark' || stored === 'light') {
      setTheme(stored);
      applyTheme(stored);
    } else {
      // Check system preference
      const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
      const detected = prefersDark ? 'dark' : 'light';
      setTheme(detected);
      applyTheme(detected);
    }
  }, []);

  const applyTheme = (newTheme: 'light' | 'dark') => {
    const root = document.documentElement;
    if (newTheme === 'dark') {
      root.classList.add('dark');
    } else {
      root.classList.remove('dark');
    }
  };

  const toggleTheme = () => {
    const newTheme = theme === 'light' ? 'dark' : 'light';
    setTheme(newTheme);
    applyTheme(newTheme);
    localStorage.setItem('zenflow-theme', newTheme);
  };

  // Prevent hydration mismatch
  if (!mounted) {
    return (
      <button
        className="relative flex-shrink-0 w-[52px] h-[28px] rounded-full bg-slate-700 transition-colors"
        style={{ minWidth: '52px', minHeight: '28px' }}
        aria-label={t.toggleTheme || 'Toggle theme'}
        disabled
      >
        <div className="absolute top-[3px] left-[27px] w-[22px] h-[22px] rounded-full bg-slate-800 flex items-center justify-center">
          <Moon className="w-3.5 h-3.5 text-slate-300" />
        </div>
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative flex-shrink-0 rounded-full transition-all duration-300",
        "w-[52px] h-[28px]",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        theme === 'light' ? 'bg-sky-300' : 'bg-slate-700'
      )}
      style={{ minWidth: '52px', minHeight: '28px' }}
      aria-label={theme === 'light' ? (t.switchToDark || 'Switch to dark mode') : (t.switchToLight || 'Switch to light mode')}
    >
      {/* Toggle circle */}
      <div
        className={cn(
          "absolute top-[3px] w-[22px] h-[22px] rounded-full transition-all duration-300 flex items-center justify-center shadow-sm",
          theme === 'light'
            ? 'left-[3px] bg-yellow-400'
            : 'left-[27px] bg-slate-800'
        )}
      >
        {theme === 'light' ? (
          <Sun className="w-3.5 h-3.5 text-white" />
        ) : (
          <Moon className="w-3.5 h-3.5 text-slate-300" />
        )}
      </div>

      {/* Stars for dark mode */}
      {theme === 'dark' && (
        <>
          <div className="absolute top-[6px] left-[6px] w-1 h-1 bg-white/60 rounded-full" />
          <div className="absolute top-[14px] left-[12px] w-0.5 h-0.5 bg-white/40 rounded-full" />
        </>
      )}
    </button>
  );
}
