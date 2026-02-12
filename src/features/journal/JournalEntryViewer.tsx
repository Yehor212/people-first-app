import { useState, useEffect, useMemo, Fragment } from 'react';
import { ArrowLeft, Pencil, Trash2, Share2 } from 'lucide-react';
import { toast } from 'sonner';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { JournalEntry, JournalAudio } from './types';
import type { MoodType, PrimaryEmotion } from '@/types';
import { JournalPhotoGallery } from './JournalPhotoGallery';
import { JournalAudioPlayer } from './JournalAudioPlayer';
import { AnimatedEmotionEmoji } from '@/components/AnimatedEmotionEmoji';

const MOOD_DISPLAY: Record<MoodType, string> = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  okay: '\u{1F610}',
  bad: '\u{1F614}',
  terrible: '\u{1F622}',
};

const MOOD_HERO_GRADIENT: Record<string, string> = {
  great: 'from-green-500/20 via-emerald-500/10 to-transparent',
  good: 'from-emerald-500/20 via-teal-500/10 to-transparent',
  okay: 'from-amber-500/20 via-yellow-500/10 to-transparent',
  bad: 'from-orange-500/20 via-red-400/10 to-transparent',
  terrible: 'from-red-500/20 via-rose-500/10 to-transparent',
};

const MOOD_TO_EMOTION: Record<MoodType, PrimaryEmotion> = {
  great: 'joy',
  good: 'trust',
  okay: 'surprise',
  bad: 'sadness',
  terrible: 'anger',
};

/** Lightweight markdown renderer for **bold** and *italic* */
function renderContent(text: string): React.ReactNode[] {
  // Split by **bold** first, then *italic*
  const parts: React.ReactNode[] = [];
  const boldRegex = /\*\*(.+?)\*\*/g;
  let lastIndex = 0;
  let match: RegExpExecArray | null;

  while ((match = boldRegex.exec(text)) !== null) {
    if (match.index > lastIndex) {
      parts.push(text.slice(lastIndex, match.index));
    }
    parts.push(<strong key={match.index} className="font-semibold text-foreground">{match[1]}</strong>);
    lastIndex = match.index + match[0].length;
  }
  if (lastIndex < text.length) {
    parts.push(text.slice(lastIndex));
  }
  return parts;
}

function getRelativeTime(timestamp: number, t: Record<string, string>): string {
  const now = Date.now();
  const diffMs = now - timestamp;
  const diffMin = Math.floor(diffMs / 60000);
  const diffHr = Math.floor(diffMs / 3600000);
  const diffDays = Math.floor(diffMs / 86400000);

  if (diffMin < 1) return t.justNow || 'Just now';
  if (diffMin < 60) return `${diffMin} ${t.minutesAgo || 'min ago'}`;
  if (diffHr < 24) return `${diffHr} ${t.hoursAgo || 'hours ago'}`;
  if (diffDays === 1) return t.yesterday || 'Yesterday';
  if (diffDays < 7) return `${diffDays} ${t.daysAgo || 'days ago'}`;
  return '';
}

interface JournalEntryViewerProps {
  entry: JournalEntry;
  onEdit: () => void;
  onDelete: () => void;
  onBack: () => void;
}

export function JournalEntryViewer({ entry, onEdit, onDelete, onBack }: JournalEntryViewerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;

  // Load audio recordings
  const [audioRecordings, setAudioRecordings] = useState<JournalAudio[]>([]);
  useEffect(() => {
    if (entry.audioIds && entry.audioIds.length > 0) {
      import('./journalStorage').then(({ getAudioForEntry }) => {
        getAudioForEntry(entry.id).then(setAudioRecordings).catch(() => setAudioRecordings([]));
      });
    } else {
      setAudioRecordings([]);
    }
  }, [entry.id, entry.audioIds]);

  const date = new Date(entry.createdAt);
  const formattedDate = date.toLocaleDateString(undefined, {
    weekday: 'long',
    year: 'numeric',
    month: 'long',
    day: 'numeric',
  });
  const formattedTime = date.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  const relativeTime = useMemo(() => getRelativeTime(entry.createdAt, ts), [entry.createdAt, ts]);

  const wordCount = useMemo(() => {
    if (!entry.content.trim()) return 0;
    return entry.content.trim().split(/\s+/).filter(Boolean).length;
  }, [entry.content]);

  const handleShare = async () => {
    const text = [entry.title, entry.content].filter(Boolean).join('\n\n');
    if (!text) return;
    try {
      if (navigator.share) {
        await navigator.share({ title: entry.title || 'Journal Entry', text });
      } else {
        await navigator.clipboard.writeText(text);
        toast.success(ts.journalShareCopied || 'Copied to clipboard');
      }
    } catch {
      // User cancelled share
    }
  };

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
          {relativeTime || entry.date}
        </span>

        <div className="flex items-center gap-1">
          <button
            onClick={handleShare}
            className="p-2 rounded-lg hover:bg-muted/50 text-muted-foreground min-w-[44px] min-h-[44px] flex items-center justify-center"
          >
            <Share2 className="w-4 h-4" />
          </button>
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
        className="flex-1 overflow-y-auto"
      >
        {/* Hero mood header */}
        {entry.mood && (
          <div className={cn(
            'relative px-5 pt-8 pb-5 bg-gradient-to-b overflow-hidden',
            MOOD_HERO_GRADIENT[entry.mood] || 'from-primary/10 to-transparent',
          )}>
            {/* Floating particles */}
            {[
              { x: '15%', y: '20%', size: 6, delay: 1 },
              { x: '75%', y: '30%', size: 8, delay: 2 },
              { x: '85%', y: '65%', size: 5, delay: 3 },
              { x: '25%', y: '70%', size: 7, delay: 4 },
            ].map((p, i) => (
              <div
                key={i}
                className={cn(
                  'absolute rounded-full bg-primary/15 blur-[1px]',
                  `animate-particle-float-${(i % 5) + 1}`,
                )}
                style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
              />
            ))}
            <div className="relative flex items-center gap-3.5">
              <AnimatedEmotionEmoji
                emotion={MOOD_TO_EMOTION[entry.mood]}
                size="xl"
              />
              <div>
                <span className="text-base font-semibold text-foreground capitalize">{entry.mood}</span>
                <p className="text-[10px] text-muted-foreground/60">{formattedTime}</p>
              </div>
            </div>
          </div>
        )}

        <div className={cn('px-5 space-y-4', entry.mood ? 'pt-2 pb-5' : 'py-5')}>
          {/* Title */}
          {entry.title && (
            <h1 className="text-xl font-bold text-foreground leading-snug tracking-tight">
              {entry.title}
            </h1>
          )}

          {/* Date/time */}
          <div className="flex items-center gap-2 text-xs text-muted-foreground/70">
            <span>{formattedDate}</span>
            {!entry.mood && <span>&middot; {formattedTime}</span>}
            {wordCount > 0 && <span>&middot; {wordCount} {ts.journalWords || 'words'}</span>}
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

          {/* Audio recordings */}
          {audioRecordings.length > 0 && (
            <div className="space-y-1.5">
              {audioRecordings.map(audio => (
                <JournalAudioPlayer key={audio.id} src={audio.data} duration={audio.duration} />
              ))}
            </div>
          )}

          {/* Content */}
          {entry.content && (
            <div className="text-sm text-foreground/90 leading-8 whitespace-pre-wrap border-s-2 border-primary/10 ps-4">
              {renderContent(entry.content)}
            </div>
          )}

          {/* Tags */}
          {entry.tags.length > 0 && (
            <div className="flex gap-1.5 flex-wrap pt-2">
              {entry.tags.map(tag => (
                <span
                  key={tag}
                  className={cn(
                    'text-xs px-3 py-1.5 rounded-full',
                    'bg-gradient-to-r from-primary/10 to-primary/5',
                    'text-primary/80 border border-primary/10',
                  )}
                >
                  #{tag}
                </span>
              ))}
            </div>
          )}
        </div>
      </motion.div>
    </>
  );
}
