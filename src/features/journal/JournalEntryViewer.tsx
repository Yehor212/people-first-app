import { useState, useEffect, useMemo, useCallback, memo, type CSSProperties } from "react";
import { ArrowLeft, Pencil, RotateCcw, Share2, Star, Trash2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import type { TranslationStrings } from "@/i18n/types";
import { getLocale } from "@/lib/timeUtils";
import type { JournalEntry, JournalAudio, PaperColor } from "./types";
import type { MoodType } from "@/types";
import {
  countWordsHtml,
  DIARY_THEMES,
  DIARY_FONTS,
  getScaledJournalFontSize,
  PAPER_COLORS,
} from "./types";
import { getBgPatternStyle, getPaperTextureStyle } from "./diaryBgPatterns";
import { JournalPhotoGallery } from "./JournalPhotoGallery";
import { ReadOnlyFloatingMediaLayer } from "./FloatingMediaLayer";
import { isJournalPhotoPlaced } from "./photoLayout";
import { JournalAudioPlayer } from "./JournalAudioPlayer";
import { StickerRenderer } from "./StickerRenderer";
import { logger } from "@/lib/logger";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { getLocalizedEmotionLabel } from "@/components/state-of-mind/emotionI18n";
import { getJournalDisplayText } from "./journalDisplay";
import { getDiaryAura } from "./journalAura";
import { formatJournalWordCount } from "./journalWordCount";
import { isFavoriteJournalEntry } from "./journalFavorite";
import { formatJournalCivilDate } from "./journalDateUtils";
import { useBackHandler } from "@/hooks/useBackHandler";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";

const LIGHT_PAPER_READABLE_INK_COLORS: Record<string, string> = {
  "#34d399": "#047857",
  "#fbbf24": "#92400e",
  "#fb7185": "#be123c",
};

function resolveViewerInkColor(inkColor: string | undefined, paperColor: PaperColor): string {
  if (!inkColor || inkColor === "#ffffff") return PAPER_COLORS[paperColor].text;
  if (paperColor === "dark") return inkColor;
  return LIGHT_PAPER_READABLE_INK_COLORS[inkColor] || inkColor;
}

function getLocalizedMoodLabel(mood: MoodType | null | undefined, ts: TranslationStrings): string {
  if (!mood) return "";
  const moodLabels: Record<MoodType, string> = {
    great: ts.moodGreat,
    good: ts.moodGood,
    okay: ts.moodOkay,
    bad: ts.moodBad,
    terrible: ts.moodTerrible,
  };
  return moodLabels[mood] || getLocalizedEmotionLabel(mood, ts);
}

type AuraColor = (opacity: number) => string;

const MOOD_HERO_SHEEN_STYLE: CSSProperties = {
  backgroundImage:
    "linear-gradient(115deg, hsl(var(--foreground) / 0.08), transparent 38%, hsl(var(--background) / 0.18))",
};

function getViewerHeaderStyle(themed: boolean): CSSProperties {
  return {
    borderColor: themed ? "var(--diary-border)" : undefined,
    backgroundColor: themed ? "color-mix(in srgb, var(--diary-bg) 80%, transparent)" : undefined,
  };
}

function getAuraBackgroundStyle(color: AuraColor): CSSProperties {
  return { backgroundColor: color(0.28) };
}

function getAuraBorderStyle(color: AuraColor, opacity: number): CSSProperties {
  return { borderColor: color(opacity) };
}

function getAuraLineStyle(color: AuraColor): CSSProperties {
  return {
    backgroundImage: `linear-gradient(90deg, transparent, ${color(0.42)}, transparent)`,
  };
}

function getMoodParticleStyle(
  particle: { x: string; y: string; size: number },
  color?: AuraColor
): CSSProperties {
  return {
    left: particle.x,
    top: particle.y,
    width: particle.size,
    height: particle.size,
    backgroundColor: color?.(0.34),
  };
}

function getMoodOrbStyle(color?: AuraColor): CSSProperties {
  return {
    borderColor: color?.(0.22),
    boxShadow: color ? `0 0 42px ${color(0.18)}, inset 0 1px 0 ${color(0.16)}` : undefined,
  };
}

function getViewerPaperStyle(paperColors: {
  bg: string;
  border: string;
  text: string;
  muted: string;
}): CSSProperties {
  return {
    backgroundColor: paperColors.bg,
    borderColor: paperColors.border,
    color: paperColors.text,
    "--journal-paper-text": paperColors.text,
    "--journal-paper-muted": paperColors.muted,
  } as CSSProperties;
}

function getViewerTitleStyle(
  color: string,
  fontFamily: CSSProperties["fontFamily"],
  fontStyle: CSSProperties["fontStyle"]
): CSSProperties {
  return { color, fontFamily, fontStyle };
}

function getViewerMutedStyle(color: string): CSSProperties {
  return { color };
}

function getAudioSurfaceStyle(
  paperColors: { text: string; border: string },
  mixOpacity: number
): CSSProperties {
  return {
    color: paperColors.text,
    borderColor: paperColors.border,
    backgroundColor: `color-mix(in srgb, var(--journal-paper-text) ${mixOpacity}%, transparent)`,
  };
}

function getViewerContentStyle(
  fontFamily: CSSProperties["fontFamily"],
  fontStyle: CSSProperties["fontStyle"],
  color: string,
  fontSize: CSSProperties["fontSize"]
): CSSProperties {
  return { fontFamily, fontStyle, color, fontSize };
}

/** Lightweight markdown renderer: **bold**, *italic*, ## headings, - lists, > quotes, --- hr */
function renderContent(content: string): React.ReactNode[] {
  const lines = content.split("\n");
  const elements: React.ReactNode[] = [];

  const renderInline = (text: string, key: string): React.ReactNode => {
    const parts: React.ReactNode[] = [];
    const regex = /(\*\*(.+?)\*\*|\*(.+?)\*)/g;
    let lastIndex = 0;
    let match: RegExpExecArray | null;
    let partIdx = 0;

    while ((match = regex.exec(text)) !== null) {
      if (match.index > lastIndex) {
        parts.push(text.slice(lastIndex, match.index));
      }
      if (match[2]) {
        parts.push(
          <strong key={`${key}-b-${partIdx++}`} className="font-semibold">
            {match[2]}
          </strong>
        );
      } else if (match[3]) {
        parts.push(
          <em key={`${key}-i-${partIdx++}`} className="italic">
            {match[3]}
          </em>
        );
      }
      lastIndex = match.index + match[0].length;
    }

    if (lastIndex < text.length) {
      parts.push(text.slice(lastIndex));
    }

    return parts.length > 0 ? <>{parts}</> : text;
  };

  lines.forEach((line, i) => {
    const trimmed = line.trim();
    const key = `line-${i}`;

    if (trimmed.startsWith("### ")) {
      elements.push(
        <h3 key={key} className="text-sm font-bold text-[var(--journal-paper-text)] mt-3 mb-1">
          {renderInline(trimmed.slice(4), key)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key} className="text-base font-bold text-[var(--journal-paper-text)] mt-4 mb-1">
          {renderInline(trimmed.slice(3), key)}
        </h2>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key}
          className="border-s-2 border-current/40 ps-3 my-2 text-[var(--journal-paper-muted)] italic"
        >
          {renderInline(trimmed.slice(2), key)}
        </blockquote>
      );
    } else if (trimmed === "---" || trimmed === "***") {
      elements.push(<hr key={key} className="my-3 border-border/30" />);
    } else if (
      trimmed.startsWith("- ") ||
      (trimmed.startsWith("* ") && !trimmed.startsWith("**"))
    ) {
      const listText = trimmed.slice(2);
      elements.push(
        <div key={key} className="flex gap-2 my-0.5">
          <span className="text-[var(--journal-paper-muted)] select-none" aria-hidden="true">
            {"\u2022"}
          </span>
          <span>{renderInline(listText, key)}</span>
        </div>
      );
    } else if (trimmed === "") {
      elements.push(<div key={key} className="h-2" />);
    } else {
      elements.push(
        <p key={key} className="my-0.5">
          {renderInline(trimmed, key)}
        </p>
      );
    }
  });

  return elements;
}

interface JournalEntryViewerProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
  onToggleFavorite?: () => void;
  favoritePending?: boolean;
}

export const JournalEntryViewer = memo(function JournalEntryViewer({
  entry,
  onEdit,
  onDelete,
  onBack,
  onToggleFavorite,
  favoritePending = false,
}: JournalEntryViewerProps) {
  const { t, language } = useLanguage();
  const ts = t;
  const isFavorite = isFavoriteJournalEntry(entry);
  const [deleteConfirmOpen, setDeleteConfirmOpen] = useState(false);
  const closeDeleteConfirm = useCallback(() => setDeleteConfirmOpen(false), []);
  const confirmDelete = useCallback(() => {
    setDeleteConfirmOpen(false);
    onDelete();
  }, [onDelete]);

  useBackHandler(deleteConfirmOpen, closeDeleteConfirm);

  // Load audio recordings
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  const [audioLoadError, setAudioLoadError] = useState(false);
  const [audioLoadAttempt, setAudioLoadAttempt] = useState(0);
  const retryAudioLoad = useCallback(() => {
    setAudioLoadAttempt((attempt) => attempt + 1);
  }, []);

  useEffect(() => {
    let cancelled = false;
    setAudioLoadError(false);

    if (entry.audioIds && entry.audioIds.length > 0) {
      const loadAudio = async () => {
        try {
          const { getAudioForEntry } = await import("./journalStorage");
          const recordings = await getAudioForEntry(entry.id);
          if (!cancelled) {
            setAudioRecordings(recordings);
            setAudioLoadError(false);
          }
        } catch (err) {
          logger.warn("[Journal]", "Audio load failed:", err);
          if (!cancelled) {
            setAudioRecordings([]);
            setAudioLoadError(true);
          }
        }
      };

      void loadAudio();
    } else {
      setAudioRecordings([]);
    }
    return () => {
      cancelled = true;
    };
  }, [audioLoadAttempt, entry.id, entry.audioIds]);

  const createdAt = new Date(entry.createdAt);
  const formattedDate = formatJournalCivilDate(entry.date, language, "long");
  const formattedShortDate = formatJournalCivilDate(entry.date, language, "short");
  const formattedTime = createdAt.toLocaleTimeString(getLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const displayContent = useMemo(
    () => getJournalDisplayText(entry.content, ts),
    [entry.content, ts]
  );
  const displayTitle = entry.title ? getLocalizedEmotionLabel(entry.title, ts) : "";
  const displayMood = getLocalizedMoodLabel(entry.mood, ts);
  const moodAura = getDiaryAura(entry.mood);
  const moodHeroStyle = moodAura
    ? {
        backgroundImage: [
          `radial-gradient(circle at 18% 56%, ${moodAura.color(0.36)}, transparent 31%)`,
          `radial-gradient(circle at 72% 18%, ${moodAura.color(0.18)}, transparent 30%)`,
          `linear-gradient(135deg, color-mix(in srgb, var(--diary-bg, hsl(var(--card))) 78%, ${moodAura.color(0.22)}), color-mix(in srgb, var(--diary-bg, hsl(var(--background))) 92%, transparent))`,
        ].join(", "),
        borderColor: moodAura.color(0.3),
        boxShadow: [
          `inset 0 1px 0 ${moodAura.color(0.2)}`,
          `0 24px 70px ${moodAura.color(0.18)}`,
          "0 20px 54px hsl(var(--foreground) / 0.10)",
        ].join(", "),
      }
    : undefined;
  const moodActionStyle = moodAura
    ? {
        backgroundColor: moodAura.color(0.88),
        borderColor: moodAura.color(0.32),
        boxShadow: `0 12px 34px ${moodAura.color(0.24)}, inset 0 1px 0 ${moodAura.color(0.18)}`,
      }
    : undefined;

  const wordCount = useMemo(() => countWordsHtml(displayContent), [displayContent]);
  const floatingPhotoIds = useMemo(
    () => entry.photoIds.filter((photoId) => isJournalPhotoPlaced(entry.photoLayout?.[photoId])),
    [entry.photoIds, entry.photoLayout]
  );
  const galleryPhotoIds = useMemo(
    () => entry.photoIds.filter((photoId) => !isJournalPhotoPlaced(entry.photoLayout?.[photoId])),
    [entry.photoIds, entry.photoLayout]
  );

  // Diary theme/font for themed entries
  const themeStyle = useMemo(() => {
    if (!entry.theme) return undefined;
    const vars = DIARY_THEMES[entry.theme] ?? DIARY_THEMES.dark;
    return {
      ...vars,
      backgroundColor: vars["--diary-bg"],
      color: vars["--diary-text"],
    };
  }, [entry.theme]);

  const fontConfig = entry.font ? DIARY_FONTS[entry.font] : undefined;
  const fontFamily = fontConfig?.family;
  const fontStyle = fontConfig?.style;
  const paperColor = PAPER_COLORS[entry.paperColor ?? "dark"]
    ? (entry.paperColor ?? "dark")
    : "dark";
  const paperColors = PAPER_COLORS[paperColor];
  const viewerInkColor = resolveViewerInkColor(entry.inkColor, paperColor);
  const viewerFontSize = entry.fontSize ? getScaledJournalFontSize(entry.fontSize) : undefined;

  const handleShare = async () => {
    const text = [entry.title, entry.content].filter(Boolean).join("\n\n");
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: entry.title || "Diary Entry", text });
      } else {
        await navigator.clipboard.writeText(text);
      }
    } catch {
      // User cancelled share
    }
  };

  // Atmospheric pattern for viewer
  const bgPatternStyle = useMemo(() => {
    if (!entry.bgPattern || entry.bgPattern === "none") return undefined;
    return getBgPatternStyle(entry.bgPattern);
  }, [entry.bgPattern]);

  // Paper texture for viewer
  const paperTextureStyle = useMemo(() => {
    if (!entry.paperTexture || entry.paperTexture === "clean") return undefined;
    const isDark = entry.paperColor === "dark" || (!entry.paperColor && true); // default is dark
    return getPaperTextureStyle(entry.paperTexture, isDark);
  }, [entry.paperTexture, entry.paperColor]);

  return (
    <div style={themeStyle} className="flex flex-col flex-1 min-h-0 relative">
      {/* Atmospheric background pattern (Layer 1) */}
      {bgPatternStyle && (
        <div className="absolute inset-0 z-0 pointer-events-none" style={bgPatternStyle} />
      )}
      {/* Header */}
      <div
        className="relative z-[1] flex items-center justify-between px-4 py-3 border-b backdrop-blur-xl"
        style={getViewerHeaderStyle(Boolean(themeStyle))}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.back || "Back"}
        >
          <ArrowLeft className="w-5 h-5 text-[var(--diary-text,hsl(var(--foreground)))] rtl:scale-x-[-1]" />
        </button>

        <span
          data-testid="journal-entry-header-date"
          className="hidden text-xs text-[var(--diary-muted,hsl(var(--muted-foreground)))] min-[520px]:inline"
        >
          {formattedShortDate}
        </span>

        <div className="flex items-center gap-1">
          {onToggleFavorite ? (
            <button
              type="button"
              onClick={onToggleFavorite}
              disabled={favoritePending}
              aria-busy={favoritePending || undefined}
              className={cn(
                "p-2 rounded-lg min-w-[44px] min-h-[44px] flex items-center justify-center",
                "motion-safe:transition-[color,background-color,transform] active:scale-[0.96]",
                "disabled:cursor-wait disabled:opacity-60 disabled:active:scale-100",
                isFavorite
                  ? "bg-primary/15 text-primary"
                  : "text-[var(--diary-muted,hsl(var(--muted-foreground)))] hover:bg-muted/50"
              )}
              aria-label={
                isFavorite
                  ? ts.journalRemoveFavorite || "Remove from favorites"
                  : ts.journalAddFavorite || "Add to favorites"
              }
              aria-pressed={isFavorite}
            >
              <Star className={cn("w-4 h-4", isFavorite && "fill-current")} aria-hidden="true" />
            </button>
          ) : null}
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-muted/50 text-[var(--diary-muted,hsl(var(--muted-foreground)))] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.shareButton || "Share"}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={() => setDeleteConfirmOpen(true)}
            className="p-2 rounded-lg hover:bg-destructive/10 text-[var(--diary-muted,hsl(var(--muted-foreground)))] min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.delete || "Delete"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            aria-label={ts.journalEdit || "Edit"}
            className={cn(
              "flex items-center justify-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium min-h-[44px]",
              "max-[359px]:w-11 max-[359px]:px-0",
              "bg-primary text-primary-foreground border-primary/20",
              "active:scale-[0.98] motion-safe:transition-transform"
            )}
            style={moodActionStyle}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            <span className="max-[359px]:sr-only">{ts.journalEdit || "Edit"}</span>
          </button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className="flex-1 overflow-y-auto relative z-[1]"
      >
        {/* Paper texture overlay */}
        {paperTextureStyle && (
          <div className="absolute inset-0 z-0 pointer-events-none" style={paperTextureStyle} />
        )}
        {/* Hero mood header */}
        {entry.mood && (
          <div
            className={cn(
              "relative mx-4 mt-4 overflow-hidden rounded-[1.75rem] border px-4 py-4",
              "bg-card/60 backdrop-blur-2xl [-webkit-backdrop-filter:blur(24px)]",
              "motion-safe:transition-[border-color,box-shadow,background]"
            )}
            data-testid="journal-entry-mood-hero"
            style={moodHeroStyle}
          >
            <div
              aria-hidden="true"
              className="pointer-events-none absolute inset-0 opacity-70"
              style={MOOD_HERO_SHEEN_STYLE}
            />
            {moodAura && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -start-14 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full blur-3xl"
                  style={getAuraBackgroundStyle(moodAura.color)}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute end-5 top-5 h-24 w-24 rounded-full border opacity-60"
                  style={getAuraBorderStyle(moodAura.color, 0.24)}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-12 bottom-3 h-px"
                  style={getAuraLineStyle(moodAura.color)}
                />
              </>
            )}
            {[
              { x: "18%", y: "22%", size: 5 },
              { x: "78%", y: "28%", size: 7 },
              { x: "86%", y: "68%", size: 4 },
              { x: "30%", y: "76%", size: 6 },
            ].map((p, i) => (
              <div
                key={i}
                aria-hidden="true"
                className={cn(
                  "absolute rounded-full blur-[1px]",
                  `animate-particle-float-${(i % 5) + 1}`
                )}
                style={getMoodParticleStyle(p, moodAura?.color)}
              />
            ))}
            <div className="relative flex items-center gap-4">
              <div
                className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1.45rem] border bg-background/55 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]"
                style={getMoodOrbStyle(moodAura?.color)}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-2 rounded-[1.05rem] border"
                  style={moodAura ? getAuraBorderStyle(moodAura.color, 0.18) : undefined}
                />
                <DiaryMiniOrb mood={entry.mood} size="hero" className="relative scale-[1.02]" />
              </div>
              <div className="min-w-0">
                <p className="text-xs font-bold uppercase tracking-[0.2em] text-muted-foreground">
                  {ts.mood || "Mood"}
                </p>
                <span className="mt-1 block whitespace-normal break-words text-2xl font-black leading-tight text-foreground">
                  {displayMood || entry.mood}
                </span>
                <p
                  data-testid="journal-entry-mood-hero-meta"
                  className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground"
                >
                  <span>{formattedTime}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{formattedDate}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div
          data-testid="journal-entry-viewer-paper"
          className={cn(
            "px-5 space-y-4",
            entry.mood ? "pt-4 pb-5" : "py-5",
            floatingPhotoIds.length > 0 && "relative min-h-[60dvh] overflow-hidden"
          )}
          style={getViewerPaperStyle(paperColors)}
        >
          {/* Title */}
          {entry.title && (
            <h1
              className="text-xl font-bold leading-snug tracking-tight [overflow-wrap:anywhere]"
              style={getViewerTitleStyle(paperColors.text, fontFamily, fontStyle)}
              dir="auto"
            >
              {displayTitle}
            </h1>
          )}

          {/* Date/time */}
          {(!entry.mood || wordCount > 0) && (
            <div
              data-testid="journal-entry-body-meta"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs font-medium"
              style={getViewerMutedStyle(paperColors.muted)}
            >
              {!entry.mood && (
                <>
                  <span>{formattedDate}</span>
                  <span>&middot; {formattedTime}</span>
                </>
              )}
              {wordCount > 0 && (
                <span>
                  {entry.mood ? "" : "\u00b7 "}
                  {formatJournalWordCount(wordCount, language, ts)}
                </span>
              )}
            </div>
          )}

          {/* Stickers */}
          {entry.stickers.length > 0 && (
            <div className="flex gap-2 items-center">
              {entry.stickers.map((s, i) => (
                <StickerRenderer key={i} emoji={s} size="md" />
              ))}
            </div>
          )}

          {/* Photos */}
          {galleryPhotoIds.length > 0 && (
            <JournalPhotoGallery
              entryId={entry.id}
              photoIds={galleryPhotoIds}
              photoLayout={entry.photoLayout}
            />
          )}

          {/* Audio recordings */}
          {audioLoadError && (
            <div
              role="alert"
              aria-live="polite"
              className="flex flex-col gap-3 rounded-lg border p-3 sm:flex-row sm:items-center sm:justify-between"
              style={getAudioSurfaceStyle(paperColors, 5)}
            >
              <p className="text-sm leading-6">
                {ts.journalAudioLoadError || "This entry's audio could not be loaded."}
              </p>
              <button
                type="button"
                onClick={retryAudioLoad}
                className={cn(
                  "inline-flex min-h-[44px] shrink-0 items-center justify-center gap-2 rounded-lg border px-3 text-sm font-semibold",
                  "motion-safe:transition-[background-color,transform] active:scale-[0.98]"
                )}
                style={getAudioSurfaceStyle(paperColors, 8)}
              >
                <RotateCcw className="h-4 w-4" aria-hidden="true" />
                <span>{ts.journalAudioLoadRetry || "Try loading audio again"}</span>
              </button>
            </div>
          )}

          {audioRecordings.length > 0 && (
            <div className="space-y-1.5">
              {audioRecordings.map((audio, audioIndex) => (
                <JournalAudioPlayer
                  key={audio.id}
                  src={audio.data}
                  duration={audio.duration}
                  index={audioIndex + 1}
                />
              ))}
            </div>
          )}

          {/* Content */}
          {displayContent && (
            <div
              className="leading-7 [unicode-bidi:plaintext] [overflow-wrap:anywhere]"
              style={getViewerContentStyle(fontFamily, fontStyle, viewerInkColor, viewerFontSize)}
              dir="auto"
            >
              {renderContent(displayContent)}
            </div>
          )}

          {floatingPhotoIds.length > 0 && entry.photoLayout && (
            <ReadOnlyFloatingMediaLayer
              entryId={entry.id}
              photoIds={floatingPhotoIds}
              layout={entry.photoLayout}
            />
          )}
        </div>
      </motion.div>

      <AlertDialog open={deleteConfirmOpen} onOpenChange={setDeleteConfirmOpen}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>{ts.delete || "Delete"}</AlertDialogTitle>
            <AlertDialogDescription>
              {ts.journalDeleteConfirm || "Are you sure you want to delete this entry?"}
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>{ts.cancel || "Cancel"}</AlertDialogCancel>
            <AlertDialogAction
              onClick={confirmDelete}
              className="bg-destructive text-destructive-foreground hover:bg-destructive/90"
            >
              {ts.delete || "Delete"}
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
});
