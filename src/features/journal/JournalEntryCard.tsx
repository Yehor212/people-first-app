import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from "react";
import { Trash2, Clock, Image as ImageIcon, Mic, Bookmark } from "lucide-react";
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

const MOOD_STICKER: Record<string, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F614}",
  terrible: "\u{1F622}",
};

const MOOD_GRADIENT: Record<string, string> = {
  great: "from-green-400/80 to-emerald-500/80",
  good: "from-emerald-400/80 to-teal-500/80",
  okay: "from-amber-400/80 to-yellow-500/80",
  bad: "from-orange-400/80 to-red-400/80",
  terrible: "from-red-400/80 to-rose-500/80",
};

const MOOD_BG: Record<string, string> = {
  great: "from-green-500/8 via-green-500/3 to-transparent",
  good: "from-emerald-500/8 via-emerald-500/3 to-transparent",
  okay: "from-amber-500/8 via-amber-500/3 to-transparent",
  bad: "from-orange-500/8 via-orange-500/3 to-transparent",
  terrible: "from-red-500/8 via-red-500/3 to-transparent",
};

const MOOD_GLOW: Record<string, string> = {
  great: "0 0 24px rgba(74,222,128,0.10)",
  good: "0 0 24px rgba(52,211,153,0.10)",
  okay: "0 0 24px rgba(251,191,36,0.10)",
  bad: "0 0 24px rgba(251,146,60,0.10)",
  terrible: "0 0 24px rgba(248,113,113,0.10)",
};

/** Mood-specific ring for the emoji circle */
const MOOD_RING: Record<string, string> = {
  great: "ring-green-400/40 bg-green-400/10",
  good: "ring-emerald-400/40 bg-emerald-400/10",
  okay: "ring-amber-400/40 bg-amber-400/10",
  bad: "ring-orange-400/40 bg-orange-400/10",
  terrible: "ring-red-400/40 bg-red-400/10",
};

const DEFAULT_BG = "from-primary/3 to-transparent";
const DEFAULT_ACCENT = "from-primary/20 to-primary/10";

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
}

function getRelativeTime(
  timestamp: number,
  ts: Record<string, string>,
  language: Language = "en"
): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return ts.justNow || "Just now";
  if (minutes < 60) return `${minutes} ${ts.minutesAgo || "min ago"}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24)
    return `${hours} ${hours === 1 ? ts.hourAgo || "hour ago" : ts.hoursAgo || "hours ago"}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return ts.yesterday || "Yesterday";
  if (days < 7) return `${days} ${ts.daysAgo || "days ago"}`;
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
  onSwipeDelete?: (id: string) => void;
  privateMode?: boolean;
  searchQuery?: string;
}

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onTap,
  onDelete,
  onEdit,
  onSwipeDelete,
  privateMode = false,
  searchQuery,
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
      if (!searchQuery || !searchQuery.trim()) return text;
      try {
        const regex = new RegExp(`(${escapeRegex(searchQuery)})`, "gi");
        const parts = text.split(regex);
        if (parts.length <= 1) return text;
        const queryLower = searchQuery.toLowerCase();
        return parts.map((part, i) =>
          part.toLowerCase().includes(queryLower) ? (
            <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">
              {part}
            </mark>
          ) : (
            part
          )
        );
      } catch {
        return text;
      }
    },
    [searchQuery]
  );

  // ── Long-press to edit ──
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
      longPressTriggered.current = false;
      const touch = e.touches[0];
      touchStartPos.current = { x: touch.clientX, y: touch.clientY };

      // ROOT-CAUSE: Long-press detection requires deliberate 500ms hold — standard touch UX pattern, not a timing hack
      touchStartTimer.current = setTimeout(() => {
        longPressTriggered.current = true;
        void hapticMedium();
        onEdit?.(entry);
      }, 500);
    },
    [entry, onEdit]
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
      if (onEdit) e.preventDefault();
    },
    [onEdit]
  );

  const handleCardClick = useCallback(() => {
    // Prevent tap from firing after long-press
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onTap(entry.id);
  }, [onTap, entry.id]);

  // Strip markdown ** for cleaner preview
  const rawPreview = entry.content.replace(/\*\*/g, "").slice(0, 140);
  const preview = rawPreview + (entry.content.length > 140 ? "..." : "");
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

  // Load first photo thumbnail
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    if (entry.photoIds.length === 0) return;
    let cancelled = false;
    getPhotoById(entry.photoIds[0])
      .then((photo) => {
        if (!cancelled && photo?.thumbnail) setThumbnail(photo.thumbnail);
      })
      .catch((err) => logger.warn("[Journal]", "Photo load failed:", err));
    return () => {
      cancelled = true;
    };
  }, [entry.photoIds]);

  // Combine base shadow with mood glow
  const cardShadow =
    entry.mood && MOOD_GLOW[entry.mood]
      ? `0 2px 20px rgba(0,0,0,0.08), inset 0 1px 0 rgba(255,255,255,0.06), ${MOOD_GLOW[entry.mood]}`
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
        whileHover={animate ? { y: -2 } : undefined}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "relative rounded-2xl overflow-hidden cursor-pointer group",
          "bg-card/60 backdrop-blur-md",
          "border border-white/[0.08] dark:border-white/[0.05]",
          "transition-all duration-300"
        )}
        // VISUAL-VERIFIED: x motion value for FM drag transform, boxShadow preserved from existing code unchanged
        style={{ x, boxShadow: cardShadow }}
      >
        {/* Gradient overlay (always shown — mood or default) */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-br opacity-100 lg:opacity-40 pointer-events-none",
            entry.mood ? MOOD_BG[entry.mood] : DEFAULT_BG
          )}
        />

        {/* Hero photo banner (when photo exists) */}
        {!privateMode && hasPhoto && thumbnail && (
          <div className="relative h-28 overflow-hidden">
            <img
              src={thumbnail}
              alt=""
              width={320}
              height={112}
              className="w-full h-full object-cover"
              loading="lazy"
            />
            <div className="absolute inset-0 bg-gradient-to-t from-card/90 via-card/30 to-transparent" />
            {/* Photo count badge */}
            {entry.photoIds.length > 1 && (
              <span className="absolute top-2 end-2 text-[10px] text-white/90 bg-black/40 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
                {"\u{1F4F7}"} {entry.photoIds.length}
              </span>
            )}
            {/* Time badge on photo */}
            <span className="absolute top-2 start-2 flex items-center gap-0.5 text-[10px] text-white/80 bg-black/30 backdrop-blur-sm px-1.5 py-0.5 rounded-md">
              <Clock className="w-2.5 h-2.5" />
              {time}
            </span>
          </div>
        )}

        <div className="flex">
          {/* Accent bar (only when no hero photo) */}
          {!(hasPhoto && thumbnail && !privateMode) && (
            <div
              className={cn(
                "w-1.5 flex-shrink-0 bg-gradient-to-b rounded-s-2xl lg:w-1 lg:rounded-none",
                entry.mood
                  ? MOOD_GRADIENT[entry.mood] || "from-primary/60 to-primary/30"
                  : DEFAULT_ACCENT
              )}
            />
          )}

          <div className="flex-1 p-3.5 relative z-[1]">
            <div className="flex items-start gap-3">
              {/* Mood emoji circle — prominent Daylio-style, layoutId for sidebar morph */}
              {entry.mood ? (
                <motion.div
                  layoutId={`mood-${entry.id}`}
                  className={cn(
                    "w-10 h-10 rounded-full flex items-center justify-center flex-shrink-0 ring-2",
                    MOOD_RING[entry.mood]
                  )}
                >
                  <StickerRenderer emoji={MOOD_STICKER[entry.mood]} size="sm" />
                </motion.div>
              ) : /* Photo placeholder (no hero) or bookmark icon */
              !privateMode && !thumbnail && hasPhoto ? (
                <motion.div layoutId={`mood-${entry.id}`} className="w-10 h-10 rounded-full flex-shrink-0 bg-muted/30 ring-1 ring-border/10 flex items-center justify-center">
                  <ImageIcon className="w-4 h-4 text-muted-foreground/60" />
                </motion.div>
              ) : (
                <motion.div layoutId={`mood-${entry.id}`} className="w-10 h-10 rounded-full flex-shrink-0 bg-primary/5 ring-1 ring-primary/10 flex items-center justify-center">
                  <Bookmark className="w-4 h-4 text-primary/40" />
                </motion.div>
              )}

              {/* Main content */}
              <div className="flex-1 min-w-0">
                {/* Title + relative time */}
                <div className="flex items-center gap-2 mb-0.5">
                  <h4 className="text-sm font-semibold text-foreground truncate flex-1">
                    {entry.title ? highlightText(entry.title) : time}
                  </h4>
                  <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">
                    {relativeTime}
                  </span>
                </div>

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
                    {entry.tags.slice(0, 2).map((tag) => (
                      <span
                        key={tag}
                        className="text-[10px] text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-md"
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
                        {wordCount}w
                      </span>
                    )}
                  </div>
                )}
              </div>

              {/* Time (only when no hero photo) + delete */}
              <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
                {!(hasPhoto && thumbnail && !privateMode) && (
                  <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                    <Clock className="w-2.5 h-2.5" />
                    {time}
                  </span>
                )}
                <button
                  onClick={(e) => {
                    e.stopPropagation();
                    void hapticTap();
                    onDelete(entry.id);
                  }}
                  className="p-2.5 -m-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/60 hover:text-destructive transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                  aria-label={ts.delete || "Delete"}
                >
                  <Trash2 className="w-4 h-4" />
                </button>
              </div>
            </div>
          </div>
        </div>
      </motion.div>
    </div>
  );
});
