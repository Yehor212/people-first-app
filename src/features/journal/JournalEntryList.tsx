import { useState, useMemo } from 'react';
import { Plus, Search, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import type { JournalEntry } from './types';
import type { MoodType } from '@/types';
import { JournalEntryCard } from './JournalEntryCard';
import { StickerRenderer } from './StickerRenderer';

const MOOD_EMOJIS: Record<string, string> = {
  great: '\u{1F604}',
  good: '\u{1F642}',
  okay: '\u{1F610}',
  bad: '\u{1F614}',
  terrible: '\u{1F622}',
};

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: 0.04 } },
};

const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: { opacity: 1, y: 0, scale: 1, transition: { type: 'spring', stiffness: 300, damping: 25 } },
};

interface JournalEntryListProps {
  groupedEntries: { label: string; key: string; entries: JournalEntry[] }[];
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onNewEntry: () => void;
  totalCount: number;
  loading?: boolean;
  daysSinceLastEntry?: number | null;
  privateMode?: boolean;
}

export function JournalEntryList({
  groupedEntries,
  onOpenEntry,
  onDeleteEntry,
  onNewEntry,
  totalCount,
  loading = false,
  daysSinceLastEntry,
  privateMode = false,
}: JournalEntryListProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [searchQuery, setSearchQuery] = useState('');
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // Available moods and tags from entries (before local filtering)
  const activeMoods = useMemo(() => {
    const moods = new Set<MoodType>();
    groupedEntries.forEach(g => g.entries.forEach(e => { if (e.mood) moods.add(e.mood); }));
    return moods;
  }, [groupedEntries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    groupedEntries.forEach(g => g.entries.forEach(e => e.tags.forEach(t2 => tags.add(t2))));
    return Array.from(tags).sort();
  }, [groupedEntries]);

  // Writing stats for mini-bar
  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    let count = 0;
    groupedEntries.forEach(g => g.entries.forEach(e => {
      if (e.createdAt >= weekAgo.getTime()) count++;
    }));
    return count;
  }, [groupedEntries]);

  // Filter entries by search + mood + tag
  const filteredGroups = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    return groupedEntries
      .map(group => ({
        ...group,
        entries: group.entries.filter(e => {
          if (q && !(e.title.toLowerCase().includes(q) || e.content.toLowerCase().includes(q) || e.tags.some(tag => tag.toLowerCase().includes(q)))) {
            return false;
          }
          if (selectedMood && e.mood !== selectedMood) return false;
          if (selectedTag && !e.tags.includes(selectedTag)) return false;
          return true;
        }),
      }))
      .filter(g => g.entries.length > 0);
  }, [groupedEntries, searchQuery, selectedMood, selectedTag]);

  const hasActiveFilters = searchQuery || selectedMood || selectedTag;
  const showFilters = activeMoods.size > 0 || allTags.length > 0;

  // Loading skeleton
  if (loading) {
    return (
      <div className="space-y-3 pb-24">
        {[1, 2, 3].map(i => (
          <div key={i} className="animate-pulse rounded-xl overflow-hidden bg-card/80 border border-border/30">
            <div className="flex">
              <div className="w-1 bg-muted-foreground/10" />
              <div className="flex-1 p-3.5 space-y-2">
                <div className="h-3.5 bg-muted-foreground/10 rounded w-1/3" />
                <div className="h-2.5 bg-muted-foreground/8 rounded w-full" />
                <div className="h-2.5 bg-muted-foreground/8 rounded w-2/3" />
              </div>
            </div>
          </div>
        ))}
      </div>
    );
  }

  // Empty state
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 relative">
        {/* Ambient floating particles */}
        {[
          { x: '15%', y: '10%', size: 7, idx: 0 },
          { x: '80%', y: '20%', size: 9, idx: 1 },
          { x: '70%', y: '70%', size: 6, idx: 2 },
          { x: '25%', y: '80%', size: 8, idx: 3 },
        ].map(p => (
          <div
            key={p.idx}
            className={cn(
              'absolute rounded-full bg-primary/15 blur-[1px]',
              `animate-particle-float-${(p.idx % 5) + 1}`,
            )}
            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          />
        ))}

        <div className="relative w-24 h-24 mb-5">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/15 via-primary/8 to-transparent flex items-center justify-center animate-float"
          >
            <StickerRenderer emoji={'\u{1F4D3}'} size="lg" />
          </motion.div>
          {/* Sparkle dots */}
          {[
            { x: -10, y: -6, delay: 0 },
            { x: 22, y: -10, delay: 0.7 },
            { x: 24, y: 20, delay: 1.4 },
            { x: -8, y: 22, delay: 2.1 },
          ].map((sparkle, i) => (
            <motion.div
              key={i}
              animate={{ opacity: [0, 1, 0], scale: [0.5, 1, 0.5] }}
              transition={{ duration: 2, repeat: Infinity, delay: sparkle.delay, ease: 'easeInOut' }}
              className="absolute w-2 h-2 rounded-full bg-primary/40"
              style={{ left: `calc(50% + ${sparkle.x}px)`, top: `calc(50% + ${sparkle.y}px)` }}
            />
          ))}
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          {ts.journalEmpty || 'Your journal is empty'}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-2 max-w-[260px]">
          {ts.journalEmptyHint || 'Start writing to capture your thoughts, feelings, and memories.'}
        </p>
        <p className="text-[10px] text-muted-foreground/40 text-center mb-6 italic">
          {ts.journalEmptyQuote || 'Your thoughts are worth preserving'}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onNewEntry}
          className={cn(
            'flex items-center gap-2 px-6 py-3 rounded-2xl',
            'bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-semibold',
            'shadow-[0_4px_20px_rgba(var(--primary-rgb,99,102,241),0.3)]',
            'hover:shadow-[0_6px_28px_rgba(var(--primary-rgb,99,102,241),0.4)]',
            'animate-glow-pulse',
            'transition-shadow duration-300',
          )}
        >
          <Plus className="w-4 h-4" />
          {ts.journalStartYourStory || 'Start your story'}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Inactivity banner */}
      {daysSinceLastEntry != null && daysSinceLastEntry >= 2 && !bannerDismissed && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <span className="text-xl flex-shrink-0">{'\u{1F4AD}'}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground">
              {(ts.journalInactiveBanner || "You haven't written in {days} days. How about a quick entry?").replace('{days}', String(daysSinceLastEntry))}
            </p>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 rounded text-muted-foreground hover:bg-muted/50 flex-shrink-0"
            aria-label={ts.dismiss || 'Dismiss'}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Writing stats mini-bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] text-muted-foreground/50">
            {totalCount} {ts.journalEntries || 'entries'}
          </span>
          <div className="w-px h-3 bg-border/20" />
          <span className="text-[10px] text-muted-foreground/50">
            {thisWeekCount} {ts.journalThisWeek || 'this week'}
          </span>
        </div>
      )}

      {/* Search bar */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchQuery}
          onChange={e => setSearchQuery(e.target.value)}
          placeholder={ts.journalSearch || 'Search entries...'}
          className={cn(
            'w-full ps-9 pe-9 py-2.5 rounded-xl text-sm',
            'bg-muted/50 border border-border/30',
            'focus:outline-none focus:ring-2 focus:ring-primary/30',
            'placeholder:text-muted-foreground/50',
          )}
        />
        {searchQuery && (
          <button
            onClick={() => setSearchQuery('')}
            className="absolute end-1 top-1/2 -translate-y-1/2 p-2 rounded-lg hover:bg-muted/50"
            aria-label={ts.clear || 'Clear search'}
          >
            <X className="w-3.5 h-3.5 text-muted-foreground" />
          </button>
        )}
      </div>

      {/* Mood / tag filter pills */}
      {showFilters && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1">
          {Array.from(activeMoods).map(m => (
            <button
              key={m}
              onClick={() => setSelectedMood(selectedMood === m ? null : m)}
              className={cn(
                'flex-shrink-0 text-base px-2 py-0.5 rounded-full transition-colors min-h-[32px]',
                selectedMood === m ? 'bg-primary/15 ring-1 ring-primary/30' : 'hover:bg-muted/50',
              )}
            >
              {MOOD_EMOJIS[m]}
            </button>
          ))}

          {activeMoods.size > 0 && allTags.length > 0 && (
            <div className="w-px bg-border/30 my-1 flex-shrink-0" />
          )}

          {allTags.map(tag => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={cn(
                'flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors min-h-[32px]',
                selectedTag === tag
                  ? 'bg-primary/15 text-primary ring-1 ring-primary/30'
                  : 'bg-muted/50 text-foreground hover:bg-muted/70',
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* Grouped entries with stagger animation */}
      {filteredGroups.map(group => (
        <div key={group.key}>
          <div className="flex items-center gap-2 px-1 mb-2.5">
            <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
              {ts[group.label] || group.label}
            </h3>
            <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
            <span className="text-[10px] text-muted-foreground/30">{group.entries.length}</span>
          </div>
          <motion.div
            variants={containerVariants}
            initial="hidden"
            animate="show"
            className="space-y-2 md:grid md:grid-cols-2 md:gap-3 md:space-y-0"
          >
            {group.entries.map(entry => (
              <motion.div key={entry.id} variants={itemVariants}>
                <JournalEntryCard
                  entry={entry}
                  onTap={() => onOpenEntry(entry.id)}
                  onDelete={() => onDeleteEntry(entry.id)}
                  privateMode={privateMode}
                />
              </motion.div>
            ))}
          </motion.div>
        </div>
      ))}

      {/* No results */}
      {hasActiveFilters && filteredGroups.length === 0 && (
        <div className="text-center py-8">
          <p className="text-sm text-muted-foreground">
            {ts.journalNoResults || 'No entries found'}
          </p>
          {(selectedMood || selectedTag) && (
            <button
              onClick={() => { setSelectedMood(null); setSelectedTag(null); }}
              className="mt-2 text-xs text-primary hover:underline"
            >
              {ts.journalClearFilters || 'Clear filters'}
            </button>
          )}
        </div>
      )}

      {/* FAB — New Entry */}
      <motion.button
        whileTap={{ scale: 0.85 }}
        whileHover={{ scale: 1.05 }}
        onClick={onNewEntry}
        className={cn(
          'fixed bottom-[calc(6rem+env(safe-area-inset-bottom))] end-5 z-[55]',
          'w-14 h-14 rounded-full',
          'bg-gradient-to-br from-primary to-primary/80',
          'text-primary-foreground',
          'flex items-center justify-center',
          'shadow-[0_4px_20px_rgba(var(--primary-rgb,99,102,241),0.35)]',
        )}
      >
        <Plus className="w-6 h-6" />
      </motion.button>
    </div>
  );
}
