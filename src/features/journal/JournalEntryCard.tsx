import { memo, useState, useEffect, useMemo } from 'react';
import { Trash2, Clock, Image as ImageIcon, Mic, Bookmark } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { JournalEntry } from './types';
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

const DEFAULT_BG = 'from-primary/3 to-transparent';
const DEFAULT_ACCENT = 'from-primary/20 to-primary/10';

function getRelativeTime(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return 'Just now';
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  const days = Math.floor(hours / 24);
  if (days < 7) return `${days}d ago`;
  const weeks = Math.floor(days / 7);
  if (weeks < 5) return `${weeks}w ago`;
  return new Date(timestamp).toLocaleDateString(undefined, { month: 'short', day: 'numeric' });
}

interface JournalEntryCardProps {
  entry: JournalEntry;
  onTap: () => void;
  onDelete: () => void;
}

export const JournalEntryCard = memo(function JournalEntryCard({
  entry,
  onTap,
  onDelete,
}: JournalEntryCardProps) {
  const preview = entry.content.slice(0, 140) + (entry.content.length > 140 ? '...' : '');
  const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const relativeTime = useMemo(() => getRelativeTime(entry.createdAt), [entry.createdAt]);
  const wordCount = entry.content.trim() ? entry.content.trim().split(/\s+/).filter(Boolean).length : 0;

  // Load first photo thumbnail
  const [thumbnail, setThumbnail] = useState<string | null>(null);
  useEffect(() => {
    if (entry.photoIds.length === 0) return;
    let cancelled = false;
    getPhotoById(entry.photoIds[0]).then(photo => {
      if (!cancelled && photo?.thumbnail) setThumbnail(photo.thumbnail);
    });
    return () => { cancelled = true; };
  }, [entry.photoIds]);

  return (
    <motion.div
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2 }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative rounded-2xl overflow-hidden cursor-pointer group',
        'bg-card/70 backdrop-blur-sm',
        'border border-border/20',
        'shadow-[0_2px_12px_rgba(0,0,0,0.04)]',
        'hover:shadow-[0_8px_24px_rgba(0,0,0,0.08)]',
        'transition-shadow duration-300',
      )}
    >
      {/* Gradient overlay (always shown — mood or default) */}
      <div className={cn(
        'absolute inset-0 bg-gradient-to-r opacity-100 pointer-events-none',
        entry.mood ? MOOD_BG[entry.mood] : DEFAULT_BG,
      )} />

      <div className="flex">
        {/* Accent bar (always shown — mood or default) */}
        <div className={cn(
          'w-1 flex-shrink-0 bg-gradient-to-b rounded-l-2xl',
          entry.mood ? (MOOD_GRADIENT[entry.mood] || 'from-primary/60 to-primary/30') : DEFAULT_ACCENT,
        )} />

        <div className="flex-1 p-3.5 relative z-[1]">
          <div className="flex items-start gap-3">
            {/* Photo thumbnail */}
            {thumbnail ? (
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
            ) : null}

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
                  {entry.title || time}
                </h4>
                <span className="text-[10px] text-muted-foreground/50 flex-shrink-0">{relativeTime}</span>
              </div>

              {/* Content preview */}
              {preview && (
                <p className="text-xs text-muted-foreground/80 line-clamp-2 leading-relaxed">
                  {preview}
                </p>
              )}

              {/* Meta row: stickers + photo count + tags + word count */}
              <div className="flex items-center gap-1.5 mt-2 flex-wrap">
                {entry.stickers.length > 0 && (
                  <div className="flex -space-x-0.5 items-center">
                    {entry.stickers.slice(0, 4).map((s, i) => (
                      <StickerRenderer key={i} emoji={s} size="xs" />
                    ))}
                    {entry.stickers.length > 4 && (
                      <span className="text-[9px] text-muted-foreground/60 ms-1">+{entry.stickers.length - 4}</span>
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
                  <span className="text-[9px] text-muted-foreground/50">+{entry.tags.length - 2}</span>
                )}
                {wordCount > 0 && (
                  <span className="text-[9px] text-muted-foreground/40 ms-auto">
                    {wordCount}w
                  </span>
                )}
              </div>
            </div>

            {/* Time + delete */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground/60">
                <Clock className="w-2.5 h-2.5" />
                {time}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2.5 -m-1 rounded-lg opacity-0 group-hover:opacity-100 hover:bg-destructive/10 text-muted-foreground/40 hover:text-destructive transition-all min-w-[44px] min-h-[44px] flex items-center justify-center"
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
