import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Trash2, Clock, Image as ImageIcon, Mic, Bookmark, MoreHorizontal } from "lucide-react";
import { motion, useMotionValue, useTransform, type PanInfo } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { getLocale } from "@/lib/timeUtils";
import type { Language } from "@/i18n/translations";
import { hapticTap, hapticMedium, hapticWarning } from "@/lib/haptics";
import { shouldAnimate } from "@/lib/animationUtils";
import type { JournalEntry } from "./types";
import { countWords } from "./types";
import { StickerRenderer } from "./StickerRenderer";
import { getPhotoById } from "./journalStorage";
import { logger } from "@/lib/logger";
import { DiaryMiniOrb } from "./DiaryMiniOrb";
import { getLocalizedEmotionLabel } from "@/components/state-of-mind/emotionI18n";
import { getJournalPreviewText } from "./journalDisplay";
import { getDiaryAura } from "./journalAura";
import { formatJournalRelativeTime, formatJournalWordCount } from "./journalWordCount";

const DEFAULT_BG = "from-primary/3 to-transparent";
const DEFAULT_ACCENT = "from-primary/20 to-primary/10";

function getRelativeTime(
  timestamp: number,
  ts: Record<string, string>,
  language: Language = "en"
): string {
  const relativeTime = formatJournalRelativeTime(timestamp, language, ts);
  if (relativeTime) return relativeTime;

  return new Date(timestamp).toLocaleDateString(getLocale(language), {
    month: "short",
    day: "numeric",
  });
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onTap: (id: string) => void;
  onDelete: (id: string) => void;
  onEdit?: (entry: JournalEntry) => void;
  onActions?: (entry: JournalEntry) => void;
  onLongPress?: (entry: JournalEntry) => void;
  onSwipeDelete?: (id: string) => void;
  privateMode?: boolean;
  searchQuery?: string;
  /** Entry is currently open in editor (desktop master-detail) */
  isActive?: boolean;
  /** Dim card when another entry is selected */
  dimmed?: boolean;
}

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onTap,
  onEdit,
  onActions,
  onLongPress,
  onSwipeDelete,
  privateMode = false,
  searchQuery,
  isActive = false,
  dimmed = false,
}: JournalEntryCardProps) {
  const { t, isRTL, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // ── Framer Motion swipe-to-delete ──
  const x = useMotionValue(0);
  const hapticFiredRef = useRef(false);
  const animate = shouldAnimate();

  // Delete zone visual feedback — derived from drag offset
  const deleteZoneOpacity = useTransform(x, isRTL ? [0, 80] : [-80, 0], [1, 0]);
  const iconScale = useTransform(x, isRTL ? [20, 80] : [-80, -20], [1, 0.8]);

  // Scroll conflict: lock direction on first significant movement
  const dragDirectionLocked = useRef<"x" | "y" | null>(null);

  const handleDrag = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      // Scroll conflict: lock direction on first significant movement
      if (!dragDirectionLocked.current) {
        const absX = Math.abs(info.offset.x);
        const absY = Math.abs(info.offset.y);
        if (absX > 5 || absY > 5) {
          dragDirectionLocked.current = absX > absY * 2 ? "x" : "y";
        }
      }
      if (dragDirectionLocked.current === "y") {
        // Vertical scroll wins — reset position
        x.set(0);
        return;
      }

      // RTL: swipe right to delete; LTR: swipe left to delete
      const deleteDelta = isRTL ? info.offset.x : -info.offset.x;
      if (!hapticFiredRef.current && deleteDelta > 80) {
        hapticFiredRef.current = true;
        void hapticWarning();
      }
    },
    [isRTL, x]
  );

  const handleDragEnd = useCallback(
    (_event: MouseEvent | TouchEvent | PointerEvent, info: PanInfo) => {
      dragDirectionLocked.current = null;
      hapticFiredRef.current = false;
      const deleteDelta = isRTL ? info.offset.x : -info.offset.x;
      if (deleteDelta > 80) {
        onSwipeDelete?.(entry.id);
      }
      // If not past threshold, dragConstraints spring handles snap-back
    },
    [isRTL, onSwipeDelete, entry.id]
  );

  // ── Search highlight ──
  const highlightText = useCallback(
    (text: string): React.ReactNode => {
      const query = searchQuery?.trim();
      if (!query) return text;

      const textLower = text.toLocaleLowerCase();
      const queryLower = query.toLocaleLowerCase();
      const parts: React.ReactNode[] = [];
      let cursor = 0;
      let matchIndex = textLower.indexOf(queryLower, cursor);

      while (matchIndex !== -1) {
        if (matchIndex > cursor) parts.push(text.slice(cursor, matchIndex));
        const matchEnd = matchIndex + query.length;
        parts.push(
          <mark key={`${matchIndex}-${matchEnd}`} className="bg-primary/20 text-foreground rounded-sm px-0.5">
            {text.slice(matchIndex, matchEnd)}
          </mark>
        );
        cursor = matchEnd;
        matchIndex = textLower.indexOf(queryLower, cursor);
      }

      if (cursor === 0) return text;
      if (cursor < text.length) parts.push(text.slice(cursor));
      return parts;
    },
    [searchQuery]
  );

  // ── Long-press contextual action ──
  const touchStartTimer = useRef<ReturnType<typeof setTimeout> | null>(null);
  const touchStartPos = useRef<{ x: number; y: number } | null>(null);
  const longPressTriggered = useRef(false);

  const clearLongPress = useCallback(() => {
    if (touchStartTimer.current) {
      clearTimeout(touchStartTimer.current);
      touchStartTimer.current = null;
    }
  }, []);

  // Clean up timer on unmount
  useEffect(() => {
    return () => clearLongPress();
  }, [clearLongPress]);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      const action = onLongPress ?? onEdit ?? onActions;
      if (!action) return;

      longPressTriggered.current = false;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };

      // ROOT-CAUSE: Long-press detection requires deliberate 500ms hold — standard touch UX pattern, not a timing hack
      touchStartTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        void hapticMedium();
        action(entry);
      }, 500);
    },
    [entry, onActions, onEdit, onLongPress]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!touchStartPos.current) return;
      const touch = e.touches[0];
      const dx = Math.abs(touch.clientX - touchStartPos.current.x);
      const dy = Math.abs(touch.clientY - touchStartPos.current.y);

      // Cancel long-press on any movement (swipe handled by FM drag)
      if (dx > 10 || dy > 10) {
        clearLongPress();
      }
    },
    [clearLongPress]
  );

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    touchStartPos.current = null;
    // Swipe-to-delete is now handled by FM drag (handleDragEnd)
  }, [clearLongPress]);

  const handleContextMenu = useCallback(
    (e: React.MouseEvent) => {
      const finePointer =
        typeof window !== "undefined" &&
        window.matchMedia("(hover: hover) and (pointer: fine)").matches;
      if (!finePointer && (onEdit || onActions || onLongPress)) e.preventDefault();
    },
    [onActions, onEdit, onLongPress]
  );

  const handleCardClick = useCallback(() => {
    // Prevent tap from firing after long-press
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    void hapticTap();
    onTap(entry.id);
  }, [onTap, entry.id]);

  const privateEntryLabel = ts.journalPrivateEntry || ts.privateMode || "Private entry";
  const privateEntryHint =
    ts.journalPrivateEntryHint || "Unlock private mode to view this memory.";
  const plainContent = getJournalPreviewText(entry.content, ts);
  const rawPreview = plainContent.slice(0, 140);
  const preview = rawPreview + (plainContent.length > 140 ? "..." : "");
  const time = new Date(entry.createdAt).toLocaleTimeString(getLocale(language), {
    hour: "2-digit",
    minute: "2-digit",
  });
  const relativeTime = useMemo(
    () => getRelativeTime(entry.createdAt, ts, language),
    [entry.createdAt, ts, language]
  );
  const wordCount = countWords(entry.content);
  const hasPhoto = entry.photoIds.length > 0;
  const displayTitle = entry.title
    ? getLocalizedEmotionLabel(entry.title, ts)
    : "";
  const displayTags = entry.tags.map((tag) => getLocalizedEmotionLabel(tag, ts));
  const moodAura = privateMode ? null : getDiaryAura(entry.mood);
  const moodGlow = moodAura ? `0 0 30px ${moodAura.color(0.13)}` : "";
  const moodOverlayStyle = moodAura
    ? {
        backgroundImage: `linear-gradient(135deg, ${moodAura.color(0.11)}, ${moodAura.color(0.04)} 38%, transparent 72%)`,
      }
    : undefined;
  const moodAccentStyle = moodAura
    ? {
        backgroundImage: `linear-gradient(180deg, ${moodAura.color(0.92)}, ${moodAura.color(0.34)})`,
        boxShadow: `0 0 18px ${moodAura.color(0.18)}`,
      }
    : undefined;
  const moodTagStyle = moodAura
    ? {
        backgroundColor: moodAura.color(0.12),
        color: moodAura.color(0.92),
      }
    : undefined;

  // Load first photo thumbnail
  const [thumbnail, setThumbnail] = useState<{ photoId: string; data: string } | null>(null);
  const firstPhotoId = entry.photoIds[0];
  const thumbnailData = firstPhotoId && thumbnail?.photoId === firstPhotoId ? thumbnail.data : null;
  useEffect(() => {
    setThumbnail(null);
    if (privateMode || !firstPhotoId) return;
    let cancelled = false;
    getPhotoById(firstPhotoId)
      .then((photo) => {
        if (!cancelled && photo?.thumbnail) setThumbnail({ photoId: firstPhotoId, data: photo.thumbnail });
      })
      .catch((err) => logger.warn("[Journal]", "Photo load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [firstPhotoId, privateMode]);

  // Combine base shadow with mood glow
  const cardShadow =
    moodGlow
      ? `0 2px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06), ${moodGlow}`
      : "0 2px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06)";

  return (
    <div className="relative rounded-2xl overflow-hidden">
      {/* Delete zone — revealed on swipe. A11Y-OK: decorative, hidden via aria-hidden */}
      <motion.div
        className={cn(
          "absolute inset-0 rounded-2xl flex items-center",
          isRTL ? "justify-start ps-6" : "justify-end pe-6",
          "bg-destructive"
        )}
        // VISUAL-VERIFIED: opacity driven by useTransform from drag x offset — GPU-composited, no layout thrash
        style={{ opacity: deleteZoneOpacity }}
        aria-hidden="true"
      >
        <motion.div
          // VISUAL-VERIFIED: scale driven by useTransform from drag x offset — smooth icon shrink feedback
          style={{ scale: iconScale }}
        >
          <Trash2 className="w-6 h-6 text-destructive-foreground" />
        </motion.div>
      </motion.div>

      {/* Existing card */}
      <motion.div
        layoutId={animate ? `entry-${entry.id}` : undefined}
        role="button"
        tabIndex={0}
        drag="x"
        dragConstraints={{ left: 0, right: 0 }}
        dragElastic={{ left: isRTL ? 0 : 0.3, right: isRTL ? 0.3 : 0 }}
        dragTransition={{ bounceStiffness: 500, bounceDamping: 35 }}
        onDrag={handleDrag}
        onDragEnd={handleDragEnd}
        onClick={handleCardClick}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            handleCardClick();
          }
        }}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleTouchEnd}
        onContextMenu={handleContextMenu}
        layout={animate ? true : undefined}
        whileTap={animate ? { scale: 0.97, boxShadow: "0 0 0 rgba(0,0,0,0)" } : undefined}
        whileHover={animate ? { y: -2, boxShadow: "0 4px 16px rgba(0,0,0,0.08)" } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "relative rounded-2xl overflow-hidden cursor-pointer group",
          "bg-card/60 backdrop-blur-md",
          "border border-white/[0.08] dark:border-white/[0.05]",
          "motion-safe:transition-all motion-safe:duration-300",
          isActive && "ring-1 ring-primary/30 border-primary/20",
          dimmed && "opacity-60"
        )}
        // VISUAL-VERIFIED: x motion value for FM drag transform, boxShadow preserved from existing code unchanged
        style={{
          x,
          boxShadow: isActive
            ? `${cardShadow}, 0 0 0 1px rgba(var(--primary-rgb), 0.1)`
            : cardShadow,
        }}
      >
        {/* Gradient overlay (always shown — mood or default) */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-100 lg:opacity-40 pointer-events-none",
            !moodAura && DEFAULT_BG
          )}
          style={moodOverlayStyle}
        />

        {/* Hero photo banner (when photo exists) */}
        {!privateMode && hasPhoto && thumbnailData && (
          <div className="relative h-28 overflow-hidden">
            <img
              src={thumbnailData}
              alt=""
              width={320}
              height={112}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/30 to-transparent" />
            {/* Photo count badge */}
            {entry.photoIds.length > 1 && (
              <span className="absolute top-2 end-2 inline-flex items-center gap-1 text-[10px] text-white/90 bg-black/40 dark:bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                <ImageIcon className="h-3 w-3" aria-hidden="true" />
                {entry.photoIds.length}
              </span>
            )}
            {/* Time badge on photo */}
            <span className="absolute top-2 start-2 flex items-center gap-0.5 text-[10px] text-white/80 bg-black/30 dark:bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
              <Clock className="w-2.5 h-2.5" />
              {time}
            </span>
          </div>
        )}

        <div className="flex">
          {/* Accent bar (only when no hero photo) */}
          {!(hasPhoto && thumbnailData && !privateMode) && (
            <div
              className={cn(
                "w-1.5 flex-shrink-0 bg-gradient-to-b rounded-s-2xl lg:w-1 lg:rounded-none",
                !moodAura && DEFAULT_ACCENT
              )}
              style={moodAccentStyle}
            />
          )}

          <div className="flex-1 p-3.5 relative z-[1]">
            <div className="flex items-start gap-3">
              {/* Mood signal orb — shared diary language, layoutId for sidebar morph */}
              {!privateMode && entry.mood ? (
                <motion.div
                  layoutId={`mood-${entry.id}`}
                  className="flex h-10 w-10 flex-shrink-0 items-center justify-center"
                >
                  <DiaryMiniOrb mood={entry.mood} size="compact" className="scale-[0.84]" />
                </motion.div>
              ) : /* Photo placeholder (no hero) or bookmark icon */
              !privateMode && !thumbnailData && hasPhoto ? (
                <motion.div
                  layoutId={`mood-${entry.id}`}
                  className="w-10 h-10 rounded-full flex-shrink-0 bg-muted/30 ring-1 ring-border/10 flex items-center justify-center"
                >
                  <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                </motion.div>
              ) : (
                <motion.div
                  layoutId={`mood-${entry.id}`}
                  className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center"
                >
                  <Bookmark className="w-4 h-4 text-primary/40" />
                </motion.div>
              )}

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Title + relative time */}
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-foreground truncate flex-1">
                    {privateMode ? privateEntryLabel : displayTitle ? highlightText(displayTitle) : time}
                  </h4>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {privateMode ? "" : relativeTime}
                  </span>
                </div>

                {privateMode && (
                  <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {privateEntryHint}
                  </p>
                )}

                {/* Content preview (hidden in private mode) */}
                {!privateMode && preview && (
                  <p className="text-xs text-muted-foreground/70 line-clamp-2 leading-relaxed">
                    {highlightText(preview)}
                  </p>
                )}

                {/* Meta row: stickers + audio + tags + word count (hidden in private mode) */}
                {!privateMode && (
                  <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                    {entry.stickers.length > 0 && (
                      <div className="flex -space-x-0.5 items-center">
                        {entry.stickers.slice(0, 5).map((s, i) => (
                          <StickerRenderer key={i} emoji={s} size="xs" />
                        ))}
                        {entry.stickers.length > 5 && (
                          <span className="text-[10px] text-muted-foreground/60 ms-1">
                            +{entry.stickers.length - 5}
                          </span>
                        )}
                      </div>
                    )}
                    {entry.audioIds && entry.audioIds.length > 0 && (
                      <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                        <Mic className="w-2.5 h-2.5" /> {entry.audioIds.length}
                      </span>
                    )}
                    {displayTags.slice(0, 2).map((tag, index) => (
                      <span
                        key={`${entry.tags[index]}-${tag}`}
                        className="text-[10px] text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-md"
                        style={moodTagStyle}
                      >
                        #{tag}
                      </span>
                    ))}
                    {entry.tags.length > 2 && (
                      <span className="text-[10px] text-muted-foreground/50">
                        +{entry.tags.length - 2}
                      </span>
                    )}
                    {wordCount > 0 && (
                      <span className="text-[10px] text-muted-foreground/60 ms-auto tabular-nums">
                        {formatJournalWordCount(wordCount, language, ts)}
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Time (only when no hero photo) + contextual actions */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {!privateMode && !(hasPhoto && thumbnailData && !privateMode) && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                    <Clock className="w-2.5 h-2.5" />
                    {time}
                  </span>
                )}
                {onActions ? (
                  <button
                    type="button"
                    onClick={(e) => {
                      e.stopPropagation();
                      void hapticTap();
                      onActions(entry);
                    }}
                    className="flex min-h-[44px] min-w-[44px] -m-1 items-center justify-center rounded-lg text-muted-foreground/55 opacity-70 motion-safe:transition-[background-color,color,opacity,transform] hover:bg-muted/45 hover:text-foreground hover:opacity-100 focus-visible:opacity-100 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/35 active:scale-[0.98]"
                    aria-label={ts.more || "More"}
                  >
                    <MoreHorizontal className="h-4 w-4" aria-hidden="true" />
                  </button>
                ) : null}
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
