import { useState, useEffect, useMemo } from "react";
import { Gift, Sparkles, X, ChevronRight } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { getToday } from "@/lib/utils";
import { SK } from "@/lib/storageKeys";
import { storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import { surprisesPool } from "./surprisesData";
import { getTypeIcon, getTypeColor } from "./helpers";

interface DailySurpriseProps {
  onNavigate?: (section: "mood" | "habits" | "focus" | "gratitude") => void;
}

export function DailySurprise({ onNavigate }: DailySurpriseProps) {
  const { t, language } = useLanguage();
  const [isOpen, setIsOpen] = useState(false);
  const [hasSeenToday, setHasSeenToday] = useState(false);

  // Get today's surprise based on day of year
  const todaySurprise = useMemo(() => {
    const today = new Date();
    const start = new Date(today.getFullYear(), 0, 0);
    const diff = today.getTime() - start.getTime();
    const dayOfYear = Math.floor(diff / (1000 * 60 * 60 * 24));
    return surprisesPool[dayOfYear % surprisesPool.length];
  }, []);

  // Check if already seen today
  useEffect(() => {
    const seenDate = storageGetRaw(SK.DAILY_SURPRISE_SEEN);
    const today = getToday();
    if (seenDate === today) {
      setHasSeenToday(true);
    }
  }, []);

  const handleOpen = () => {
    setIsOpen(true);
    const today = getToday();
    storageSetRaw(SK.DAILY_SURPRISE_SEEN, today);
    setHasSeenToday(true);
  };

  const handleAction = () => {
    if (todaySurprise.action && onNavigate) {
      const sectionMap: Record<
        string,
        "mood" | "habits" | "focus" | "gratitude"
      > = {
        mood: "mood",
        habit: "habits",
        focus: "focus",
        gratitude: "gratitude",
      };
      onNavigate(sectionMap[todaySurprise.action.type]);
      setIsOpen(false);
    }
  };

  const Icon = getTypeIcon(todaySurprise.type);

  // Collapsed card (shows when not yet opened today)
  if (!hasSeenToday) {
    return (
      <button
        onClick={handleOpen}
        className={cn(
          "w-full p-4 rounded-2xl border transition-all",
          "bg-gradient-to-r",
          getTypeColor(todaySurprise.type),
          "hover:scale-[1.02] active:scale-[0.98]",
          "animate-pulse-subtle",
        )}
      >
        <div className="flex items-center gap-3">
          <div className="p-2 bg-secondary rounded-xl">
            <Gift className="w-6 h-6 text-primary" />
          </div>
          <div className="flex-1 text-start">
            <p className="font-semibold text-foreground">
              {language === "uk"
                ? "Сюрприз дня"
                : language === "es"
                  ? "Sorpresa del día"
                  : language === "de"
                    ? "Tagesüberraschung"
                    : language === "fr"
                      ? "Surprise du jour"
                      : language === "ja"
                        ? "今日のサプライズ"
                        : language === "ar"
                          ? "مفاجأة اليوم"
                          : language === "he"
                            ? "ההפתעה היומית"
                            : "Daily Surprise"}
            </p>
            <p className="text-sm text-muted-foreground">
              {language === "uk"
                ? "Натисни, щоб відкрити!"
                : language === "es"
                  ? "¡Toca para abrir!"
                  : language === "de"
                    ? "Tippe zum Öffnen!"
                    : language === "fr"
                      ? "Appuie pour ouvrir!"
                      : language === "ja"
                        ? "タップして開こう！"
                        : language === "ar"
                          ? "انقر للكشف!"
                          : language === "he"
                            ? "לחץ לגילוי!"
                            : "Tap to reveal!"}
            </p>
          </div>
          <Sparkles className="w-5 h-5 text-amber-400 animate-pulse" />
        </div>
      </button>
    );
  }

  // Already seen - show mini reminder
  if (!isOpen) {
    return (
      <button
        onClick={() => setIsOpen(true)}
        className={cn(
          "w-full p-3 rounded-xl border transition-all opacity-70 hover:opacity-100",
          "bg-gradient-to-r",
          getTypeColor(todaySurprise.type),
        )}
      >
        <div className="flex items-center gap-2">
          <span className="text-lg">{todaySurprise.emoji}</span>
          <p className="text-sm text-muted-foreground flex-1 text-start truncate">
            {todaySurprise.title[language] || todaySurprise.title.en}
          </p>
          <ChevronRight className="w-4 h-4 text-muted-foreground rtl:scale-x-[-1]" />
        </div>
      </button>
    );
  }

  // Full expanded card
  return (
    <div
      className={cn(
        "relative p-5 rounded-2xl border transition-all animate-scale-in",
        "bg-gradient-to-br",
        getTypeColor(todaySurprise.type),
      )}
    >
      {/* Close button */}
      <button
        onClick={() => setIsOpen(false)}
        className="absolute top-3 end-3 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full hover:bg-black/10 transition-colors"
        aria-label={t.close || "Close"}
      >
        <X className="w-4 h-4 text-muted-foreground" />
      </button>

      {/* Header */}
      <div className="flex items-center gap-3 mb-3">
        <div className="p-2 bg-secondary rounded-xl">
          <Icon className="w-5 h-5 text-primary" />
        </div>
        <div>
          <p className="font-semibold text-foreground">
            {todaySurprise.title[language] || todaySurprise.title.en}
          </p>
          <p className="text-xs text-muted-foreground">{getToday()}</p>
        </div>
        <span className="text-2xl ms-auto">{todaySurprise.emoji}</span>
      </div>

      {/* Content */}
      <p className="text-foreground/90 leading-relaxed mb-4">
        {todaySurprise.content[language] || todaySurprise.content.en}
      </p>

      {/* Action button */}
      {todaySurprise.action && (
        <button
          onClick={handleAction}
          className={cn(
            "w-full py-2.5 rounded-xl font-medium transition-all",
            "bg-primary/20 hover:bg-primary/30 text-primary",
            "flex items-center justify-center gap-2",
          )}
        >
          <span>
            {todaySurprise.action.label[language] ||
              todaySurprise.action.label.en}
          </span>
          <ChevronRight className="w-4 h-4 rtl:scale-x-[-1]" />
        </button>
      )}
    </div>
  );
}
