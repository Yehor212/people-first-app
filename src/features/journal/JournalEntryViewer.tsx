import { ArrowLeft, Pencil, Trash2 } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { JournalEntry } from './types';
import type { MoodType } from '@/types';
import { JournalPhotoGallery } from './JournalPhotoGallery';
import { StickerRenderer } from './StickerRenderer';

const MOOD_DISPLAY: Record<MoodType, string> = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  okay: '\u{1F610}',
  bad: '\u{1F614}',
  terrible: '\u{1F622}',
};

interface JournalEntryViewerProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export function JournalEntryViewer({ entry, onEdit, onDelete, onBack }: JournalEntryViewerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  const date = new Date(entry.createdAt);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });

  return (
    <>
      {/* Header */}
      <div className="flex items-center justify-between px-4 py-3 border-b border-border/30 bg-background/80 backdrop-blur-xl">
        <button
          onClick={onBack}
          className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
        >
          <ArrowLeft className="w-5 h-5 text-foreground" />
        </button>

        <span className="text-xs text-muted-foreground">
          {entry.date}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={onDelete}
            className="p-2 rounded-lg hover:bg-destructive/10 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Trash2 className="w-4 h-4" />
          </button>
          <button
            onClick={onEdit}
            className={cn(
              'flex items-center gap-1.5 px-3 py-2 rounded-lg text-sm font-medium min-h-[44px]',
              'bg-primary text-primary-foreground',
              'active:scale-[0.98] transition-transform',
            )}
          >
            <Pencil className="w-3.5 h-3.5" />
            {ts.journalEdit || 'Edit'}
          </button>
        </div>
      </div>

      {/* Content */}
      <motion.div
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: 'spring', stiffness: 300, damping: 25 }}
        className="flex-1 overflow-y-auto px-5 py-5 space-y-4"
      >
        {/* Mood */}
        {entry.mood && (
          <div className="flex items-center gap-2">
            <span className="text-2xl">{MOOD_DISPLAY[entry.mood]}</span>
            <span className="text-sm text-muted-foreground capitalize">{entry.mood}</span>
          </div>
        )}

        {/* Title */}
        {entry.title && (
          <h1 className="text-xl font-bold text-foreground leading-snug">
            {entry.title}
          </h1>
        )}

        {/* Date/time */}
        <div className="text-xs text-muted-foreground">
          {formattedDate} &middot; {formattedTime}
        </div>

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
          <JournalPhotoGallery
            entryId={entry.id}
            photoIds={entry.photoIds}
          />
        )}

        {/* Content */}
        {entry.content && (
          <div className="text-sm text-foreground leading-relaxed whitespace-pre-wrap">
            {entry.content}
          </div>
        )}

        {/* Tags */}
        {entry.tags.length > 0 && (
          <div className="flex gap-1.5 flex-wrap pt-2">
            {entry.tags.map(tag => (
              <span
                key={tag}
                className="text-xs px-2.5 py-1 rounded-full bg-primary/10 text-primary"
              >
                #{tag}
              </span>
            ))}
          </div>
        )}
      </motion.div>
    </>
  );
}
