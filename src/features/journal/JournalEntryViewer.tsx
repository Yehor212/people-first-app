import { useState, useEffect, useMemo, memo } from "react";
import { ArrowLeft, Pencil, Trash2, Share2 } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocale } from "@/lib/timeUtils";
import type { JournalEntry, JournalAudio } from "./types";
import { countWords, DIARY_THEMES, DIARY_FONTS } from "./types";
import { getBgPatternStyle, getPaperTextureStyle } from "./diaryBgPatterns";
import { JournalPhotoGallery } from "./JournalPhotoGallery";
import { JournalAudioPlayer } from "./JournalAudioPlayer";
import { StickerRenderer } from "./StickerRenderer";
import { logger } from "@/lib/logger";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { getLocalizedEmotionLabel } from "@/components/state-of-mind/emotionI18n";
import { getJournalDisplayText } from "./journalDisplay";
import { getDiaryAura } from "./journalAura";
import { formatJournalRelativeTime, formatJournalWordCount } from "./journalWordCount";

function getLocalizedMoodLabel(mood: string | null | undefined, ts: Record<string, string>): string {
  if (!mood) return "";
  const key = `mood${mood.charAt(0).toUpperCase()}${mood.slice(1)}`;
  return ts[key] || ts[mood] || getLocalizedEmotionLabel(mood, ts);
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
        <h3 key={key} className="text-sm font-bold text-foreground mt-3 mb-1">
          {renderInline(trimmed.slice(4), key)}
        </h3>
      );
    } else if (trimmed.startsWith("## ")) {
      elements.push(
        <h2 key={key} className="text-base font-bold text-foreground mt-4 mb-1">
          {renderInline(trimmed.slice(3), key)}
        </h2>
      );
    } else if (trimmed.startsWith("> ")) {
      elements.push(
        <blockquote
          key={key}
          className="border-s-2 border-primary/40 ps-3 my-2 text-muted-foreground italic"
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
          <span className="text-muted-foreground select-none" aria-hidden="true">
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
}

export const JournalEntryViewer = memo(function JournalEntryViewer({
  entry,
  onEdit,
  onDelete,
  onBack,
}: JournalEntryViewerProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // Load audio recordings
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  useEffect(() => {
    let cancelled = false;
    if (entry.audioIds && entry.audioIds.length > 0) {
      import("./journalStorage")
        .then(({ getAudioForEntry }) => {
          getAudioForEntry(entry.id)
            .then((recordings) => {
              if (!cancelled) setAudioRecordings(recordings);
            })
            .catch((err) => {
              logger.warn("[Journal]", "Audio load failed:", err);
              if (!cancelled) setAudioRecordings([]);
            });
        })
        .catch((err) => logger.warn("[Journal]", "Audio module load failed:", err));
    } else {
      setAudioRecordings([]);
    }
    return () => {
      cancelled = true;
    };
  }, [entry.id, entry.audioIds]);

  const date = new Date(entry.createdAt);
  const formattedDate = date.toLocaleDateString(getLocale(language), {
    weekday: "long",
    year: "numeric",
    month: "long",
    day: "numeric",
  });
  const formattedTime = date.toLocaleTimeString(getLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const relativeTime = useMemo(
    () => formatJournalRelativeTime(entry.createdAt, language, ts),
    [entry.createdAt, language, ts]
  );

  const displayContent = useMemo(
    () => getJournalDisplayText(entry.content, ts),
    [entry.content, ts]
  );
  const displayTitle = entry.title ? getLocalizedEmotionLabel(entry.title, ts) : "";
  const displayTags = entry.tags.map((tag) => getLocalizedEmotionLabel(tag, ts));
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
  const moodTagStyle = moodAura
    ? {
        backgroundColor: moodAura.color(0.12),
        borderColor: moodAura.color(0.24),
        color: moodAura.color(0.96),
      }
    : undefined;

  const wordCount = useMemo(() => countWords(displayContent), [displayContent]);

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

  const fontFamily = entry.font ? DIARY_FONTS[entry.font]?.family : undefined;

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
        style={{
          borderColor: themeStyle ? "var(--diary-border)" : undefined,
          backgroundColor: themeStyle
            ? "color-mix(in srgb, var(--diary-bg) 80%, transparent)"
            : undefined,
        }}
      >
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
          aria-label={ts.back || "Back"}
        >
          <ArrowLeft className="w-5 h-5 text-foreground rtl:scale-x-[-1]" />
        </button>

        <span className="text-xs text-muted-foreground">{relativeTime || entry.date}</span>

        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.shareButton || "Share"}
          >
            <Share2 className="w-4 h-4" />
          </button>
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
            aria-label={ts.delete || "Delete"}
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className={cn(
              "flex items-center gap-1.5 px-3 py-2 rounded-lg border text-sm font-medium min-h-[44px]",
              "bg-primary text-primary-foreground border-primary/20",
              "active:scale-[0.98] motion-safe:transition-transform"
            )}
            style={moodActionStyle}
          >
            <Pencil className="w-3.5 h-3.5" aria-hidden="true" />
            {ts.journalEdit || "Edit"}
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
              style={{
                backgroundImage:
                  "linear-gradient(115deg, hsl(var(--foreground) / 0.08), transparent 38%, hsl(var(--background) / 0.18))",
              }}
            />
            {moodAura && (
              <>
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute -start-14 top-1/2 h-40 w-40 -translate-y-1/2 rounded-full blur-3xl"
                  style={{ backgroundColor: moodAura.color(0.28) }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute end-5 top-5 h-24 w-24 rounded-full border opacity-60"
                  style={{ borderColor: moodAura.color(0.24) }}
                />
                <div
                  aria-hidden="true"
                  className="pointer-events-none absolute inset-x-12 bottom-3 h-px"
                  style={{
                    backgroundImage: `linear-gradient(90deg, transparent, ${moodAura.color(0.42)}, transparent)`,
                  }}
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
                style={{
                  left: p.x,
                  top: p.y,
                  width: p.size,
                  height: p.size,
                  backgroundColor: moodAura ? moodAura.color(0.34) : undefined,
                }}
              />
            ))}
            <div className="relative flex items-center gap-4">
              <div
                className="relative flex h-[4.5rem] w-[4.5rem] shrink-0 items-center justify-center rounded-[1.45rem] border bg-background/55 shadow-[inset_0_1px_0_hsl(var(--foreground)/0.08)]"
                style={{
                  borderColor: moodAura ? moodAura.color(0.22) : undefined,
                  boxShadow: moodAura
                    ? `0 0 42px ${moodAura.color(0.18)}, inset 0 1px 0 ${moodAura.color(0.16)}`
                    : undefined,
                }}
              >
                <span
                  aria-hidden="true"
                  className="absolute inset-2 rounded-[1.05rem] border"
                  style={{ borderColor: moodAura ? moodAura.color(0.18) : undefined }}
                />
                <DiaryMiniOrb mood={entry.mood} size="hero" className="relative scale-[1.02]" />
              </div>
              <div className="min-w-0">
                <p className="text-[10px] font-bold uppercase tracking-[0.2em] text-muted-foreground/60">
                  {ts.mood || "Mood"}
                </p>
                <span className="mt-1 block truncate text-2xl font-black leading-tight text-foreground">
                  {displayMood || entry.mood}
                </span>
                <p
                  data-testid="journal-entry-mood-hero-meta"
                  className="mt-1 flex flex-wrap items-center gap-x-1.5 gap-y-0.5 text-xs font-medium text-muted-foreground/70"
                >
                  <span>{formattedTime}</span>
                  <span aria-hidden="true">&middot;</span>
                  <span>{formattedDate}</span>
                </p>
              </div>
            </div>
          </div>
        )}

        <div className={cn("px-5 space-y-4", entry.mood ? "pt-4 pb-5" : "py-5")}>
          {/* Title */}
          {entry.title && (
            <h1 className="text-xl font-bold text-foreground leading-snug tracking-tight">
              {displayTitle}
            </h1>
          )}

          {/* Date/time */}
          {(!entry.mood || wordCount > 0) && (
            <div
              data-testid="journal-entry-body-meta"
              className="flex flex-wrap items-center gap-x-2 gap-y-1 text-xs text-muted-foreground/70"
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
          {entry.photoIds.length > 0 && (
            <JournalPhotoGallery entryId={entry.id} photoIds={entry.photoIds} />
          )}

          {/* Audio recordings */}
          {audioRecordings.length > 0 && (
            <div className="space-y-1.5">
              {audioRecordings.map((audio) => (
                <JournalAudioPlayer key={audio.id} src={audio.data} duration={audio.duration} />
              ))}
            </div>
          )}

          {/* Content */}
          {displayContent && (
            <div className="text-[15px] leading-7 text-foreground/90" style={{ fontFamily }}>
              {renderContent(displayContent)}
            </div>
          )}

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-2">
              {displayTags.map((tag, index) => (
                <span
                  key={`${entry.tags[index]}-${tag}`}
                  className={cn(
                    "text-xs px-3 py-1.5 rounded-full border",
                    "bg-primary/10 text-primary/80 border-primary/10"
                  )}
                  data-testid="journal-entry-tag"
                  style={moodTagStyle}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </div>
  );
});
