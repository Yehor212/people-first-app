import { memo, useMemo } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocale } from "@/lib/timeUtils";
import { Trophy, CalendarPlus, Sparkles, Users, Flame } from "lucide-react";
import { ThemeToggle } from "@/components/ThemeToggle";
import { SyncStatusIndicatorCompact } from "@/components/SyncStatusIndicator";

interface HeaderProps {
  userName?: string;
  streak?: number;
  onOpenChallenges?: () => void;
  onOpenEvents?: () => void;
  onOpenQuests?: () => void;
  onOpenFriends?: () => void;
}

export const Header = memo(function Header({
  userName = "Friend",
  streak,
  onOpenChallenges,
  onOpenEvents,
  onOpenQuests,
  onOpenFriends,
}: HeaderProps) {
  const { t, language } = useLanguage();

  const greeting = useMemo(() => {
    const hour = new Date().getHours();
    if (hour < 12) return t.goodMorning;
    if (hour < 18) return t.goodAfternoon;
    return t.goodEvening;
  }, [t.goodMorning, t.goodAfternoon, t.goodEvening]);

  const formattedDate = useMemo(() => {
    return new Date().toLocaleDateString(getLocale(language), {
      weekday: "long",
      day: "numeric",
      month: "long",
    });
  }, [language]);

  return (
    <header className="mb-6 motion-safe:animate-fade-in">
      {/* Top row: date + utilities (Apple-style) */}
      <div className="mb-1 flex flex-col gap-2 min-[420px]:flex-row min-[420px]:items-start min-[420px]:justify-between">
        <div className="flex min-w-0 flex-wrap items-center gap-x-2 gap-y-1">
          <p className="min-w-0 break-words text-sm capitalize text-muted-foreground">
            {formattedDate}
          </p>
          {streak != null && streak > 0 && (
            <div className="flex items-center gap-1 text-xs font-medium text-orange-500">
              <Flame className="h-3 w-3 shrink-0" />
              <span className="break-words">
                {streak} {t.daysInRow}
              </span>
            </div>
          )}
        </div>
        <div className="flex shrink-0 items-center gap-2 self-end min-[420px]:self-auto">
          <SyncStatusIndicatorCompact />
          <ThemeToggle />
        </div>
      </div>

      {/* Large title — Apple Health style (Phase 2-B.2: sacred moment — font-display Fraunces) */}
      <h1 className="mb-4 text-3xl font-display font-semibold tracking-tight text-foreground">
        <span>{greeting}, </span>
        <span className="[overflow-wrap:anywhere]">{userName}</span>
      </h1>

      {/* Quick Actions Bar — clean, no colored backgrounds */}
      {(onOpenEvents || onOpenQuests || onOpenChallenges || onOpenFriends) && (
        <div className="grid grid-cols-[repeat(auto-fit,minmax(min(100%,calc(8rem*var(--font-scale,1))),1fr))] gap-2">
          {onOpenEvents && (
            <button
              onClick={onOpenEvents}
              className="flex h-auto min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-foreground motion-safe:transition-all hover:bg-secondary/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.scheduleAddEvent}
            >
              <CalendarPlus
                className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 whitespace-normal break-words text-center text-sm font-medium">
                {t.scheduleAddEvent}
              </span>
            </button>
          )}
          {onOpenQuests && (
            <button
              onClick={onOpenQuests}
              className="flex h-auto min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-foreground motion-safe:transition-all hover:bg-secondary/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.openQuests}
            >
              <Sparkles
                className="w-4 h-4 flex-shrink-0 text-muted-foreground"
                aria-hidden="true"
              />
              <span className="min-w-0 whitespace-normal break-words text-center text-sm font-medium">
                {t.quests}
              </span>
            </button>
          )}
          {onOpenChallenges && (
            <button
              onClick={onOpenChallenges}
              className="flex h-auto min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-foreground motion-safe:transition-all hover:bg-secondary/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.openChallenges}
            >
              <Trophy className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 whitespace-normal break-words text-center text-sm font-medium">
                {t.challenges}
              </span>
            </button>
          )}
          {onOpenFriends && (
            <button
              onClick={onOpenFriends}
              className="flex h-auto min-h-11 min-w-0 items-center justify-center gap-1.5 rounded-xl bg-secondary px-3 py-2.5 text-foreground motion-safe:transition-all hover:bg-secondary/80 active:scale-[0.97] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              aria-label={t.friends || "Friends"}
            >
              <Users className="w-4 h-4 flex-shrink-0 text-muted-foreground" aria-hidden="true" />
              <span className="min-w-0 whitespace-normal break-words text-center text-sm font-medium">
                {t.friends || "Friends"}
              </span>
            </button>
          )}
        </div>
      )}
    </header>
  );
});
