import { useEffect, useState } from 'react';
import { Sun, Moon } from 'lucide-react';
import { cn } from '@/lib/utils';

export function ThemeToggle() {
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
        className="relative w-16 h-8 rounded-full bg-secondary transition-colors"
        aria-label="Toggle theme"
        disabled
      >
        <div className="absolute top-1 left-1 w-6 h-6 rounded-full bg-primary transition-transform" />
      </button>
    );
  }

  return (
    <button
      onClick={toggleTheme}
      className={cn(
        "relative w-16 h-8 rounded-full transition-all duration-500",
        theme === 'light' ? 'bg-sky-200' : 'bg-slate-700'
      )}
      aria-label={`Switch to ${theme === 'light' ? 'dark' : 'light'} mode`}
    >
      {/* Toggle circle */}
      <div
        className={cn(
          "absolute top-1 w-6 h-6 rounded-full transition-all duration-500 flex items-center justify-center",
          theme === 'light'
            ? 'left-1 bg-yellow-400'
            : 'left-9 bg-slate-900'
        )}
      >
        {theme === 'light' ? (
          <Sun className="w-4 h-4 text-white animate-spin-slow" />
        ) : (
          <Moon className="w-4 h-4 text-white" />
        )}
      </div>

      {/* Animated stars for dark mode */}
      {theme === 'dark' && (
        <>
          <div className="absolute top-2 left-2 w-1 h-1 bg-white rounded-full animate-twinkle" />
          <div className="absolute top-4 left-4 w-1 h-1 bg-white rounded-full animate-twinkle" style={{ animationDelay: '0.5s' }} />
          <div className="absolute top-3 left-6 w-1 h-1 bg-white rounded-full animate-twinkle" style={{ animationDelay: '1s' }} />
        </>
      )}

      {/* Animated clouds for light mode */}
      {theme === 'light' && (
        <>
          <div className="absolute top-2 right-2 w-2 h-1 bg-white rounded-full opacity-70 animate-float" />
          <div className="absolute top-4 right-4 w-3 h-1 bg-white rounded-full opacity-60 animate-float" style={{ animationDelay: '0.3s' }} />
        </>
      )}
    </button>
  );
}
