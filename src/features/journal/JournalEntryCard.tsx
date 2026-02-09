import { memo } from 'react';
import { Trash2, Clock } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import type { JournalEntry } from './types';
import { StickerRenderer } from './StickerRenderer';

const MOOD_EMOJI: Record<string, string> = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  okay: '\u{1F610}',
  bad: '\u{1F614}',
  terrible: '\u{1F622}',
};

const MOOD_ACCENT: Record<string, string> = {
  great: 'from-green-400 to-emerald-500',
  good: 'from-emerald-400 to-teal-500',
  okay: 'from-amber-400 to-yellow-500',
  bad: 'from-orange-400 to-red-400',
  terrible: 'from-red-400 to-rose-500',
};

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
  const preview = entry.content.slice(0, 120) + (entry.content.length > 120 ? '...' : '');
  const time = new Date(entry.createdAt).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <motion.div
      onClick={onTap}
      whileTap={{ scale: 0.98 }}
      whileHover={{ y: -2, boxShadow: '0 4px 12px rgba(0,0,0,0.08)' }}
      transition={{ type: 'spring', stiffness: 400, damping: 25 }}
      className={cn(
        'relative rounded-xl overflow-hidden cursor-pointer',
        'bg-card/80 backdrop-blur-sm border border-border/30',
        'shadow-sm hover:shadow-md transition-shadow duration-200',
      )}
    >
      <div className="flex">
        {/* Mood accent bar */}
        {entry.mood && (
          <div className={cn(
            'w-1 flex-shrink-0 bg-gradient-to-b',
            MOOD_ACCENT[entry.mood] || 'from-primary/60 to-primary/30',
          )} />
        )}

        <div className="flex-1 p-3.5">
          <div className="flex items-start justify-between gap-2">
            <div className="flex-1 min-w-0">
              {/* Title row */}
              <div className="flex items-center gap-2 mb-1">
                {entry.mood && (
                  <span className="text-sm">{MOOD_EMOJI[entry.mood]}</span>
                )}
                <h4 className="text-sm font-semibold text-foreground truncate">
                  {entry.title || time}
                </h4>
              </div>

              {/* Content preview */}
              {preview && (
                <p className="text-xs text-muted-foreground line-clamp-2 leading-relaxed">
                  {preview}
                </p>
              )}

              {/* Stickers + photo count + tags */}
              <div className="flex items-center gap-2 mt-1.5">
                {entry.stickers.length > 0 && (
                  <div className="flex gap-0.5 items-center">
                    {entry.stickers.slice(0, 5).map((s, i) => (
                      <StickerRenderer key={i} emoji={s} size="xs" />
                    ))}
                  </div>
                )}
                {entry.photoIds.length > 0 && (
                  <span className="text-[10px] text-muted-foreground bg-primary/10 px-1.5 py-0.5 rounded-full">
                    {'\u{1F4F7}'} {entry.photoIds.length}
                  </span>
                )}
                {entry.tags.length > 0 && (
                  <span className="text-[10px] text-primary/80 bg-primary/10 px-1.5 py-0.5 rounded-full">
                    #{entry.tags[0]}
                  </span>
                )}
              </div>
            </div>

            {/* Time + delete */}
            <div className="flex flex-col items-end gap-1.5 flex-shrink-0">
              <span className="flex items-center gap-0.5 text-[10px] text-muted-foreground">
                <Clock className="w-2.5 h-2.5" />
                {time}
              </span>
              <button
                onClick={(e) => { e.stopPropagation(); onDelete(); }}
                className="p-2.5 -m-1 rounded-lg hover:bg-destructive/10 text-muted-foreground/50 hover:text-destructive transition-colors min-w-[44px] min-h-[44px] flex items-center justify-center"
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
