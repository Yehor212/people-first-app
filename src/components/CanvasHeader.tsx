/**
 * CanvasHeader — Fixed top overlay for the Mind Map Canvas.
 *
 * Left: "Zenflow" logo + formatted date.
 * Right: Status pill (rest needed, streak, or time greeting).
 */

import { useMemo } from 'react';
import { Flame } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { MoodType } from '@/types';

interface CanvasHeaderProps {
  streak?: number;
  latestMood?: MoodType | null;
}

export function CanvasHeader({ streak, latestMood }: CanvasHeaderProps) {
  const { t, language } = useLanguage();

  const formattedDate = useMemo(() => {
    const localeMap: Record<string, string> = {
      uk: 'uk-UA', es: 'es-ES', de: 'de-DE', fr: 'fr-FR',
      ja: 'ja-JP', ar: 'ar-SA', he: 'he-IL',
    };
    const locale = localeMap[language] || 'en-US';
    return new Date().toLocaleDateString(locale, {
      weekday: 'long',
      day: 'numeric',
      month: 'long',
    });
  }, [language]);

  // Status: rest needed (bad mood), streak, or nothing
  const needsRest = latestMood === 'bad' || latestMood === 'terrible';
  const showStreak = !needsRest && streak != null && streak > 0;

  return (
    <header
      className="fixed top-0 inset-x-0 z-50 flex items-start justify-between px-4"
      style={{ paddingTop: 'calc(env(safe-area-inset-top, 0px) + 0.75rem)' }}
    >
      {/* Left: Logo + date */}
      <div>
        <h1 className="text-lg font-bold text-emerald-400 tracking-tight">
          {t.appName}
        </h1>
        <p className="text-xs text-white/40 capitalize">{formattedDate}</p>
      </div>

      {/* Right: Status pill */}
      {(needsRest || showStreak) && (
        <div className={cn(
          'flex items-center gap-1.5 px-3 py-1.5',
          'bg-white/5 backdrop-blur-md',
          'border border-white/10',
          'rounded-full',
        )}>
          {needsRest && (
            <>
              <span className="w-2 h-2 rounded-full bg-emerald-400" />
              <span className="text-xs text-white/70">{t.restNeeded}</span>
            </>
          )}
          {showStreak && (
            <>
              <Flame className="w-3 h-3 text-orange-400" />
              <span className="text-xs text-white/70">{streak} {t.daysInRow}</span>
            </>
          )}
        </div>
      )}
    </header>
  );
}
