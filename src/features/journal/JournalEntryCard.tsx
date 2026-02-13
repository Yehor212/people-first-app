import React, { memo, useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { Trash2, Clock, Image as ImageIcon, Mic, Bookmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { hapticTap, hapticMedium } from '@/lib/haptics';
import type { JournalEntry } from './types';
import { countWords } from './types';
import { StickerRenderer } from './StickerRenderer';
import { getPhotoById } from './journalStorage';

const MOOD_STICKER: Record<string, string> = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  okay: '\u{1F610}',
  bad: '\u{1F614}',
  terrible: '\u{1F622}',
};

const MOOD_GRADIENT: Record<string, string> = {
  great: 'from-green-400/80 to-emerald-500/80',
  good: 'from-emerald-400/80 to-teal-500/80',
  okay: 'from-amber-400/80 to-yellow-500/80',
  bad: 'from-orange-400/80 to-red-400/80',
  terrible: 'from-red-400/80 to-rose-500/80',
};

const MOOD_BG: Record<string, string> = {
  great: 'from-green-500/5 to-transparent',
  good: 'from-emerald-500/5 to-transparent',
  okay: 'from-amber-500/5 to-transparent',
  bad: 'from-orange-500/5 to-transparent',
  terrible: 'from-red-500/5 to-transparent',
};

const MOOD_GLOW: Record<string, string> = {
  great: '0 0 20px rgba(74,222,128,0.08)',
  good: '0 0 20px rgba(52,211,153,0.08)',
  okay: '0 0 20px rgba(251,191,36,0.08)',
  bad: '0 0 20px rgba(251,146,60,0.08)',
  terrible: '0 0 20px rgba(248,113,113,0.08)',
};

const DEFAULT_BG = 'from-primary/3 to-transparent';
const DEFAULT_ACCENT = 'from-primary/20 to-primary/10';

function escapeRegex(str: string): string {
  return str.replace(/[.*+?^${}()|[\]\\]/g, '\\$&');
}

function getRelativeTime(timestamp: number, ts: Record<string, string>): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return ts.justNow || 'Just now';
  if (minutes < 60) return `${minutes} ${ts.minutesAgo || 'min ago'}`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours} ${hours === 1 ? (ts.hourAgo || 'hour ago') : (ts.hoursAgo || 'hours ago')}`;
  const days = Math.floor(hours / 24);
  if (days === 1) return ts.yesterday || 'Yesterday';
  if (days < 7) return `${days} ${ts.daysAgo || 'days ago'}`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onTap: () => void;
  onDelete: () => void;
  onEdit?: (entry: JournalEntry) => void;
  privateMode?: boolean;
  searchQuery?: string;
}

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onTap,
  onDelete,
  onEdit,
  privateMode = false,
  searchQuery,
}: JournalEntryCardProps) {
  const { t, isRTL } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // ── Search highlight ──
  const highlightText = useCallback((text: string): React.ReactNode => {
    if (!searchQuery || !searchQuery.trim()) return text;
    try {
      const regex = new RegExp(`(${escapeRegex(searchQuery)})`, 'gi');
      const parts = text.split(regex);
      if (parts.length <= 1) return text;
      return parts.map((part, i) =>
        regex.test(part)
          ? <mark key={i} className="bg-primary/20 text-foreground rounded-sm px-0.5">{part}</mark>
          : part
      );
    } catch {
      return text;
    }
  }, [searchQuery]);

  // ── Swipe-to-delete ──
  const swipeStartX = useRef(0);
  const swipeDeltaX = useRef(0);
  const cardRef = useRef<HTMLDivElement>(null);
  const isSwiping = useRef(false);

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

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    longPressTriggered.current = false;
    isSwiping.current = false;
    const touch = e.touches[0];
    touchStartPos.current = { x: touch.clientX, y: touch.clientY };

    // Exclude 20px edge zones (Android system back gesture)
    if (touch.clientX < 20 || touch.clientX > window.innerWidth - 20) {
      swipeStartX.current = 0;
      return;
    }

    swipeStartX.current = touch.clientX;
    swipeDeltaX.current = 0;

    touchStartTimer.current = setTimeout(() => {
      longPressTriggered.current = true;
      void hapticMedium();
      onEdit?.(entry);
    }, 500);
  }, [entry, onEdit]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!touchStartPos.current) return;
    const touch = e.touches[0];
    const dx = touch.clientX - touchStartPos.current.x;
    const dy = Math.abs(touch.clientY - touchStartPos.current.y);

    // Cancel long-press on any movement
    if (Math.abs(dx) > 10 || dy > 10) {
      clearLongPress();
    }

    // Swipe detection: only horizontal, skip if started in edge zone
    if (!swipeStartX.current) return;
    const swipeDelta = touch.clientX - swipeStartX.current;
    // In RTL, swipe right to delete; in LTR, swipe left to delete
    const deleteDelta = isRTL ? swipeDelta : -swipeDelta;

    if (deleteDelta > 10 && dy < 30) {
      isSwiping.current = true;
    }

    if (isSwiping.current && cardRef.current) {
      // Clamp: allow sliding up to 100px in delete direction
      const clamped = isRTL
        ? Math.min(swipeDelta, 100)
        : Math.max(swipeDelta, -100);
      swipeDeltaX.current = swipeDelta;
      cardRef.current.style.transform = `translateX(${clamped}px)`;
      cardRef.current.style.transition = 'none';
    }
  }, [clearLongPress, isRTL]);

  const handleTouchEnd = useCallback(() => {
    clearLongPress();
    touchStartPos.current = null;

    const deleteDelta = isRTL ? swipeDeltaX.current : -swipeDeltaX.current;

    if (isSwiping.current && deleteDelta > 80) {
      // Delete threshold reached
      void hapticTap();
      onDelete();
    }

    // Reset card position
    if (cardRef.current) {
      cardRef.current.style.transition = 'transform 0.2s ease-out';
      cardRef.current.style.transform = '';
    }

    swipeDeltaX.current = 0;
    isSwiping.current = false;
  }, [clearLongPress, isRTL, onDelete]);

  const handleContextMenu = useCallback((e: React.MouseEvent) => {
    if (onEdit) e.preventDefault();
  }, [onEdit]);

  const handleCardClick = useCallback(() => {
    // Prevent tap from firing after long-press
    if (longPressTriggered.current) {
      longPressTriggered.current = false;
      return;
    }
    onTap();
  }, [onTap]);

  // Strip markdown ** for cleaner preview
  const rawPreview = entry.content.replace(/\*\*/g, '').slice(0, 140);
  const preview = rawPreview + (entry.content.length > 140 ? '...' : '');
  const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const relativeTime = useMemo(() => getRelativeTime(entry.createdAt, ts), [entry.createdAt, ts]);
  const wordCount = countWords(entry.content);

  // Load first photo thumbnail
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    if (entry.photoIds.length === 0) return;
    let cancelled = false;
    getPhotoById(entry.photoIds[0]).then(photo => {
      if (!cancelled && photo?.thumbnail) setThumbnail(photo.thumbnail);
    }).catch(() => {});
    return () => { cancelled = true; };
  }, [entry.photoIds]);

  // Combine base shadow with mood glow
  const cardShadow = entry.mood && MOOD_GLOW[entry.mood]
    ? `0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06), ${MOOD_GLOW[entry.mood]}`
    : '0 2px 16px rgba(0,0,0,0.06), inset 0 1px 0 rgba(255,255,255,0.06)';

  return (
    <motion.div
      onClick={handleCardClick}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
      onContextMenu={handleContextMenu}
      whileTap={{ scale: 0.97 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer group',
        'bg-card/60 backdrop-blur-md',
        'border border-white/[0.08] dark:border-white/[0.05]',
        'transition-all duration-300',
      )}
      style={{ boxShadow: cardShadow }}
    >
      {/* Gradient overlay (always shown — mood or default) */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-r opacity-100 pointer-events-none',
        entry.mood ? MOOD_BG[entry.mood] : DEFAULT_BG,
      )} />

      <div className="flex">
        {/* Accent bar (always shown — mood or default) */}
        <div className={cn(
          'w-1.5 flex-shrink-0 bg-gradient-to-b rounded-s-2xl',
          entry.mood ? (MOOD_GRADIENT[entry.mood] || 'from-primary/60 to-primary/30') : DEFAULT_ACCENT,
        )} />

        <div className="flex-1 p-3.5 relative z-[1]">
          <div className="flex items-start gap-3">
            {/* Photo thumbnail (hidden in private mode) */}
            {!privateMode && (thumbnail ? (
              <div className="w-12 h-12 rounded-xl overflow-hidden flex-shrink-0 bg-muted/30 ring-1 ring-border/10">
                <img
                  src={thumbnail}
                  alt=""
                  className="w-full h-full object-cover"
                  loading="lazy"
                />
              </div>
            ) : entry.photoIds.length > 0 ? (
              <div className="w-12 h-12 rounded-xl flex-shrink-0 bg-muted/30 ring-1 ring-border/10 flex items-center justify-center">
                <ImageIcon className="w-5 h-5 text-muted-foreground/40" />
              </div>
            ) : null)}

            {/* Main content */}
            <div className="flex-1 min-w-0">
              {/* Title row with mood + relative time */}
              <div className="flex items-center gap-2 mb-0.5">
                {entry.mood ? (
                  <StickerRenderer emoji={MOOD_STICKER[entry.mood]} size="xs" />
                ) : !entry.title && (
                  <Bookmark className="w-3.5 h-3.5 text-muted-foreground/40 flex-shrink-0" />
                )}
                <h4 className="text-sm font-semibold text-foreground truncate">
                  {entry.title ? highlightText(entry.title) : time}
                </h4>
                <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{relativeTime}</span>
              </div>

              {/* Content preview (hidden in private mode) */}
              {!privateMode && preview && (
                <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {highlightText(preview)}
                </p>
              )}

              {/* Meta row: stickers + photo count + tags + word count (hidden in private mode) */}
              {!privateMode && <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {entry.stickers.length > 0 && (
                  <div className="flex -space-x-0.5 items-center">
                    {entry.stickers.slice(0, 4).map((s, i) => (
                      <StickerRenderer key={i} emoji={s} size="xs" />
                    ))}
                    {entry.stickers.length > 4 && (
                      <span className="text-[10px] text-muted-foreground/60 ms-1">+{entry.stickers.length - 4}</span>
                    )}
                  </div>
                )}
                {entry.photoIds.length > 1 && (
                  <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-md">
                    {'\u{1F4F7}'} {entry.photoIds.length}
                  </span>
                )}
                {entry.audioIds && entry.audioIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground/70 bg-muted/40 px-1.5 py-0.5 rounded-md flex items-center gap-0.5">
                    <Mic className="w-2.5 h-2.5" /> {entry.audioIds.length}
                  </span>
                )}
                {entry.tags.slice(0, 2).map(tag => (
                  <span key={tag} className="text-[10px] text-primary/70 bg-primary/8 px-1.5 py-0.5 rounded-md">
                    #{tag}
                  </span>
                ))}
                {entry.tags.length > 2 && (
                  <span className="text-[10px] text-muted-foreground/50">+{entry.tags.length - 2}</span>
                )}
                {wordCount > 0 && (
                  <span className="text-[10px] text-muted-foreground/40 ms-auto">
                    {wordCount}w
                  </span>
                )}
              </div>}
            </div>

            {/* Time + delete */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                <Clock className="w-2.5 h-2.5" />
                {time}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); void hapticTap(); onDelete(); }}
                className="p-2.5 -m-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
                aria-label={ts.delete || 'Delete'}
              >
                <Trash2 className="w-4 h-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </motion.div>
  );
});
