import { useState, useEffect, useMemo, useCallback, useRef, memo, useDeferredValue } from "react";
import { Plus, Search, X, Sparkles, Loader2, PenLine, Sprout, Flame } from "lucide-react";
import { motion, AnimatePresence, useReducedMotion, type Variants } from "framer-motion";
import { cn } from "@/lib/utils";
import { zenMotion } from "@/lib/animationUtils";
import { springs, stagger } from "@/config/animations";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import type { JournalEntry } from "./types";
import type { MoodType, GratitudeEntry } from "@/types";
import { JournalEntryCard } from "./JournalEntryCard";
import { ContextMenu } from "@/components/desktop/ContextMenu";
import { useInputMethod } from "@/hooks/useInputMethod";
import { StickerRenderer } from "./StickerRenderer";
import { GratitudeBloomWidget } from "./GratitudeBloomWidget";
import { BurnThoughtWidget } from "./BurnThoughtWidget";
import {
  searchJournalSemantic,
  generateAllMissingEmbeddings,
  type SemanticSearchResult,
} from "@/lib/journalAI";
import { supabase } from "@/lib/supabaseClient";
import { Quote } from "lucide-react";

const MOOD_EMOJIS: Record<string, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F614}",
  terrible: "\u{1F622}",
};

/** Daily rotating quotes — keyed by i18n key for translation */
const DAILY_QUOTES: { key: string; fallback: string; author: string }[] = [
  {
    key: "quoteJournal1",
    fallback: "Fill your paper with the breathings of your heart.",
    author: "William Wordsworth",
  },
  {
    key: "quoteJournal2",
    fallback: "Journal writing is a voyage to the interior.",
    author: "Christina Baldwin",
  },
  {
    key: "quoteJournal3",
    fallback: "The act of writing is the act of discovering what you believe.",
    author: "David Hare",
  },
  {
    key: "quoteJournal4",
    fallback: "We write to taste life twice, in the moment and in retrospect.",
    author: "Anaïs Nin",
  },
  {
    key: "quoteJournal5",
    fallback: "Writing is the painting of the voice.",
    author: "Voltaire",
  },
  {
    key: "quoteJournal6",
    fallback:
      "Start writing, no matter what. The water does not flow until the faucet is turned on.",
    author: "Louis L'Amour",
  },
  {
    key: "quoteJournal7",
    fallback: "In the journal I am at ease.",
    author: "Anaïs Nin",
  },
  {
    key: "quoteJournal8",
    fallback: "A personal journal is an ideal environment in which to become.",
    author: "Gail Sheehy",
  },
  {
    key: "quoteJournal9",
    fallback: "People who keep journals have life twice.",
    author: "Jessamyn West",
  },
  {
    key: "quoteJournal10",
    fallback:
      "The pages are still blank, but there is a miraculous feeling of the words being there.",
    author: "Vladimir Nabokov",
  },
  {
    key: "quoteJournal11",
    fallback:
      "Write what disturbs you, what you fear, what you have not been willing to speak about.",
    author: "Natalie Goldberg",
  },
  {
    key: "quoteJournal12",
    fallback: "One day I will find the right words, and they will be simple.",
    author: "Jack Kerouac",
  },
  {
    key: "quoteJournal13",
    fallback: "There is no greater agony than bearing an untold story inside you.",
    author: "Maya Angelou",
  },
  {
    key: "quoteJournal14",
    fallback: "Your journal is like your best friend. You don't have to pretend with it.",
    author: "Oprah Winfrey",
  },
];

function getDailyQuote(): (typeof DAILY_QUOTES)[0] {
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  return DAILY_QUOTES[dayOfYear % DAILY_QUOTES.length];
}

const containerVariants = {
  hidden: { opacity: 0 },
  show: { opacity: 1, transition: { staggerChildren: stagger.perItem / 1000 } },
} satisfies Variants;

/** Capped stagger: items beyond index 4 appear instantly (no delay).
 *  Telegram-style: subtle y + scale with snappy spring. */
const itemVariants = {
  hidden: { opacity: 0, y: 12, scale: 0.97 },
  show: (i: number) => ({
    opacity: 1,
    y: 0,
    scale: 1,
    transition: {
      type: "spring" as const,
      stiffness: 400,
      damping: 28,
      delay: stagger.delayForIndex(i),
    },
  }),
};

/** Static variants when prefers-reduced-motion is active */
const staticVariants = {
  hidden: { opacity: 1, y: 0 },
  show: { opacity: 1, y: 0 },
} satisfies Variants;

interface JournalEntryListProps {
  groupedEntries: { label: string; key: string; entries: JournalEntry[] }[];
  onOpenEntry: (id: string) => void;
  onDeleteEntry: (id: string) => void;
  onSwipeDelete?: (id: string) => void;
  onNewEntry: () => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
  totalCount: number;
  loading?: boolean;
  daysSinceLastEntry?: number | null;
  privateMode?: boolean;
  /** Compact single-column mode for desktop left panel */
  compact?: boolean;
  /** Currently active entry ID (desktop master-detail) — for active/dimmed styling */
  activeEntryId?: string | null;
}

export const JournalEntryList = memo(function JournalEntryList({
  groupedEntries,
  onOpenEntry,
  onDeleteEntry,
  onSwipeDelete,
  onNewEntry,
  onAddGratitude,
  totalCount,
  loading = false,
  daysSinceLastEntry,
  privateMode = false,
  compact = false,
  activeEntryId = null,
}: JournalEntryListProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const { isMouse } = useInputMethod();
  const reducedMotion = useReducedMotion();
  const activeContainerVariants = reducedMotion ? staticVariants : containerVariants;
  const activeItemVariants = reducedMotion ? staticVariants : itemVariants;

  // Stable handlers that accept ID — prevents inline arrows from defeating memo on JournalEntryCard
  const handleTap = useCallback((id: string) => onOpenEntry(id), [onOpenEntry]);
  const handleDelete = useCallback((id: string) => onDeleteEntry(id), [onDeleteEntry]);
  const handleSwipeDelete = useCallback((id: string) => onSwipeDelete?.(id), [onSwipeDelete]);
  const [searchInput, setSearchInput] = useState("");
  const [debouncedSearch, setDebouncedSearch] = useState("");
  // Defer the debounced value so list filtering doesn't block input responsiveness (INP)
  const deferredSearch = useDeferredValue(debouncedSearch);
  const [bannerDismissed, setBannerDismissed] = useState(false);
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [selectedTag, setSelectedTag] = useState<string | null>(null);

  // AI search state
  const [aiMode, setAiMode] = useState(false);
  const [aiSearching, setAiSearching] = useState(false);
  const [aiResults, setAiResults] = useState<SemanticSearchResult[]>([]);
  const [aiIndexing, setAiIndexing] = useState(false);
  const aiIndexedRef = useRef(false);

  // Debounce search input — 300ms for text, 800ms for AI
  useEffect(() => {
    const delay = aiMode ? 800 : 300;
    const timer = setTimeout(() => setDebouncedSearch(searchInput), delay);
    return () => clearTimeout(timer);
  }, [searchInput, aiMode]);

  // AI search effect
  useEffect(() => {
    if (!aiMode || !debouncedSearch.trim()) {
      setAiResults([]);
      return;
    }

    let cancelled = false;
    setAiSearching(true);

    searchJournalSemantic(debouncedSearch.trim())
      .then((results) => {
        if (!cancelled) setAiResults(results);
      })
      .catch(() => {
        // graceful: AI semantic search failure shows empty results — non-blocking UX
        if (!cancelled) setAiResults([]);
      })
      .finally(() => {
        if (!cancelled) setAiSearching(false);
      });

    return () => {
      cancelled = true;
    };
  }, [aiMode, debouncedSearch]);

  // Toggle AI mode — backfill embeddings on first activation
  const toggleAiMode = useCallback(() => {
    if (!supabase) return;

    setAiMode((prev) => {
      const next = !prev;
      if (next && !aiIndexedRef.current) {
        aiIndexedRef.current = true;
        setAiIndexing(true);
        void generateAllMissingEmbeddings().finally(() => setAiIndexing(false));
      }
      if (!next) {
        setAiResults([]);
        setAiSearching(false);
      }
      return next;
    });
  }, []);

  // Available moods and tags from entries (before local filtering)
  const activeMoods = useMemo(() => {
    const moods = new Set<MoodType>();
    groupedEntries.forEach((g) =>
      g.entries.forEach((e) => {
        if (e.mood) moods.add(e.mood);
      })
    );
    return moods;
  }, [groupedEntries]);

  const allTags = useMemo(() => {
    const tags = new Set<string>();
    groupedEntries.forEach((g) => g.entries.forEach((e) => e.tags.forEach((t2) => tags.add(t2))));
    return Array.from(tags).sort();
  }, [groupedEntries]);

  // Writing stats for mini-bar
  const thisWeekCount = useMemo(() => {
    const now = new Date();
    const weekAgo = new Date(now.getTime() - 7 * 86400000);
    let count = 0;
    groupedEntries.forEach((g) =>
      g.entries.forEach((e) => {
        if (e.createdAt >= weekAgo.getTime()) count++;
      })
    );
    return count;
  }, [groupedEntries]);

  // All entries flat map for ID lookup
  const entriesById = useMemo(() => {
    const map = new Map<string, JournalEntry>();
    groupedEntries.forEach((g) => g.entries.forEach((e) => map.set(e.id, e)));
    return map;
  }, [groupedEntries]);

  // AI search results mapped to local entries
  const aiMatchedEntries = useMemo(() => {
    if (!aiMode || aiResults.length === 0) return [];
    return aiResults
      .map((r) => {
        const entry = entriesById.get(r.entry_id);
        return entry ? { entry, similarity: r.similarity } : null;
      })
      .filter((r): r is { entry: JournalEntry; similarity: number } => r !== null);
  }, [aiMode, aiResults, entriesById]);

  // Filter entries by deferred search + mood + tag (text mode only)
  // Uses deferredSearch so the list filters in the background without blocking input
  const filteredGroups = useMemo(() => {
    if (aiMode) return []; // AI mode uses aiMatchedEntries instead
    const q = deferredSearch.toLowerCase().trim();
    return groupedEntries
      .map((group) => ({
        ...group,
        entries: group.entries.filter((e) => {
          if (
            q &&
            !(
              e.title.toLowerCase().includes(q) ||
              e.content.toLowerCase().includes(q) ||
              e.tags.some((tag) => tag.toLowerCase().includes(q))
            )
          ) {
            return false;
          }
          if (selectedMood && e.mood !== selectedMood) return false;
          if (selectedTag && !e.tags.includes(selectedTag)) return false;
          return true;
        }),
      }))
      .filter((g) => g.entries.length > 0);
  }, [groupedEntries, deferredSearch, selectedMood, selectedTag, aiMode]);

  const hasActiveFilters = deferredSearch || selectedMood || selectedTag;
  const showFilters = !aiMode && (activeMoods.size > 0 || allTags.length > 0);
  const showAiToggle = !!supabase; // Only show AI toggle when cloud is available

  // Loading skeleton — shimmer gradient + staggered spring entrance
  if (loading) {
    return (
      <div className="space-y-3 pb-24">
        {[0, 1, 2].map((i) => (
          <motion.div
            key={i}
            initial={reducedMotion ? false : { opacity: 0, y: 12, scale: 0.97 }}
            animate={{ opacity: 1, y: 0, scale: 1 }}
            transition={{ ...springs.quick, delay: stagger.delayForIndex(i) }}
            className="rounded-2xl overflow-hidden bg-card/60 backdrop-blur-sm border border-border/20"
          >
            <div className="flex">
              <div className="w-1 bg-gradient-to-b from-primary/20 to-primary/5 rounded-s" />
              <div className="flex-1 p-4 space-y-2.5">
                <div className="flex items-center gap-2">
                  <div className="w-8 h-8 rounded-full bg-muted-foreground/8 skeleton-shimmer" />
                  <div className="h-3.5 bg-muted-foreground/8 rounded-full w-24 skeleton-shimmer" />
                </div>
                <div className="h-2.5 bg-muted-foreground/6 rounded-full w-full skeleton-shimmer" />
                <div className="h-2.5 bg-muted-foreground/6 rounded-full w-2/3 skeleton-shimmer" />
                <div className="flex items-center gap-2 pt-1">
                  <div className="h-2 bg-muted-foreground/5 rounded-full w-12 skeleton-shimmer" />
                  <div className="h-2 bg-muted-foreground/5 rounded-full w-16 skeleton-shimmer" />
                </div>
              </div>
            </div>
          </motion.div>
        ))}
        <style>{`
          @keyframes shimmer {
            0% { background-position: -200% 0; }
            100% { background-position: 200% 0; }
          }
          .skeleton-shimmer {
            background: linear-gradient(90deg, transparent 25%, hsl(var(--muted-foreground) / 0.06) 50%, transparent 75%);
            background-size: 200% 100%;
            animation: shimmer 1.8s ease-in-out infinite;
          }
        `}</style>
      </div>
    );
  }

  // Empty state
  if (totalCount === 0) {
    return (
      <div className="flex flex-col items-center justify-center py-16 px-6 relative">
        {/* Ambient floating particles */}
        {[
          { x: "15%", y: "10%", size: 7, idx: 0 },
          { x: "80%", y: "20%", size: 9, idx: 1 },
          { x: "70%", y: "70%", size: 6, idx: 2 },
          { x: "25%", y: "80%", size: 8, idx: 3 },
        ].map((p) => (
          <div
            key={p.idx}
            className={cn(
              "absolute rounded-full bg-primary/15 blur-[1px]",
              `animate-particle-float-${(p.idx % 5) + 1}`
            )}
            style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
          />
        ))}

        <div className="relative w-24 h-24 mb-5">
          <motion.div
            animate={{ y: [0, -8, 0] }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            className="w-24 h-24 rounded-full bg-gradient-to-br from-primary/15 via-primary/8 to-transparent flex items-center justify-center animate-float"
          >
            <StickerRenderer emoji={"\u{1F4D3}"} size="lg" />
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
              transition={{
                duration: 2,
                repeat: Infinity,
                delay: sparkle.delay,
                ease: "easeInOut",
              }}
              className="absolute w-2 h-2 rounded-full bg-primary/40"
              style={{
                left: `calc(50% + ${sparkle.x}px)`,
                top: `calc(50% + ${sparkle.y}px)`,
              }}
            />
          ))}
        </div>
        <h3 className="text-base font-semibold text-foreground mb-1">
          {ts.journalEmpty || "Your diary is empty"}
        </h3>
        <p className="text-sm text-muted-foreground text-center mb-2 max-w-[260px]">
          {ts.journalEmptyHint || "Start writing to capture your thoughts, feelings, and memories."}
        </p>
        <p className="text-[10px] text-muted-foreground/60 text-center mb-6 italic">
          {ts.journalEmptyQuote || "Your thoughts are worth preserving"}
        </p>
        <motion.button
          whileTap={{ scale: 0.95 }}
          onClick={onNewEntry}
          className={cn(
            "flex items-center gap-2 px-6 py-3 rounded-2xl",
            "bg-gradient-to-r from-primary to-primary/90 text-primary-foreground text-sm font-semibold",
            "shadow-md",
            "hover:shadow-lg",
            "transition-shadow duration-300"
          )}
        >
          <Plus className="w-4 h-4" />
          {ts.journalStartYourStory || "Start your story"}
        </motion.button>
      </div>
    );
  }

  return (
    <div className="space-y-3 pb-24">
      {/* Inactivity banner */}
      {daysSinceLastEntry != null && daysSinceLastEntry >= 2 && !bannerDismissed && (
        <div className="flex items-center gap-3 p-3 rounded-xl bg-primary/5 border border-primary/15">
          <span className="text-xl flex-shrink-0">{"\u{1F4AD}"}</span>
          <div className="flex-1 min-w-0">
            <p className="text-xs text-foreground">
              {(
                ts.journalInactiveBanner ||
                "You haven't written in {days} days. How about a quick entry?"
              ).replace("{days}", String(daysSinceLastEntry))}
            </p>
          </div>
          <button
            onClick={() => setBannerDismissed(true)}
            className="p-1 rounded text-muted-foreground hover:bg-muted/50 flex-shrink-0"
            aria-label={ts.dismiss || "Dismiss"}
          >
            <X className="w-3.5 h-3.5" />
          </button>
        </div>
      )}

      {/* Daily inspirational quote */}
      {(() => {
        const quote = getDailyQuote();
        return (
          <div className="relative overflow-hidden rounded-xl bg-gradient-to-br from-primary/8 via-primary/4 to-transparent border border-primary/10 p-3.5">
            <Quote className="absolute top-2 end-2 w-6 h-6 text-primary/10" />
            <p className="text-xs text-foreground/80 italic leading-relaxed pe-6">
              {ts[quote.key] || quote.fallback}
            </p>
            <p className="text-[10px] text-muted-foreground/50 mt-1.5">— {quote.author}</p>
          </div>
        );
      })()}

      {/* Writing stats mini-bar */}
      {totalCount > 0 && (
        <div className="flex items-center gap-3 px-1">
          <span className="text-[10px] text-muted-foreground/50">
            {totalCount} {ts.journalEntries || "entries"}
          </span>
          <div className="w-px h-3 bg-border/20" />
          <span className="text-[10px] text-muted-foreground/50">
            {thisWeekCount} {ts.journalThisWeek || "this week"}
          </span>
        </div>
      )}

      {/* Search bar with AI toggle */}
      <div className="relative">
        <Search className="absolute start-3 top-1/2 -translate-y-1/2 w-4 h-4 text-muted-foreground pointer-events-none" />
        <input
          type="text"
          value={searchInput}
          onChange={(e) => setSearchInput(e.target.value)}
          placeholder={
            aiMode
              ? ts.journalAiSearchPlaceholder || "Describe what you're looking for..."
              : ts.journalSearch || "Search entries..."
          }
          aria-label={ts.journalSearch || "Search entries"}
          className={cn(
            "w-full ps-9 py-2.5 rounded-xl text-sm",
            "bg-muted/50 border border-border/30",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
            "placeholder:text-muted-foreground/50",
            showAiToggle ? "pe-20" : "pe-9",
            aiMode && "border-purple-500/30 ring-1 ring-purple-500/20"
          )}
        />
        <div className="absolute end-1 top-1/2 -translate-y-1/2 flex items-center gap-0.5">
          {(searchInput || aiSearching) && (
            <button
              onClick={() => {
                setSearchInput("");
                setAiResults([]);
              }}
              className="p-2 rounded-lg hover:bg-muted/50"
              aria-label={ts.clear || "Clear search"}
            >
              {aiSearching ? (
                <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin" />
              ) : (
                <X className="w-3.5 h-3.5 text-muted-foreground" />
              )}
            </button>
          )}
          {showAiToggle && (
            <button
              onClick={toggleAiMode}
              className={cn(
                "p-2 rounded-lg transition-colors min-h-[44px] min-w-[44px] flex items-center justify-center",
                aiMode
                  ? "bg-purple-500/15 text-purple-500"
                  : "hover:bg-muted/50 text-muted-foreground"
              )}
              aria-label={aiMode ? "Switch to text search" : "Switch to AI search"}
              title={aiMode ? "AI Search ON" : "AI Search"}
            >
              <Sparkles className="w-4 h-4" />
            </button>
          )}
        </div>
      </div>

      {/* AI indexing banner */}
      {aiIndexing && (
        <div className="flex items-center gap-2 px-3 py-2 rounded-lg bg-purple-500/10 border border-purple-500/20">
          <Loader2 className="w-3.5 h-3.5 text-purple-500 animate-spin flex-shrink-0" />
          <p className="text-xs text-purple-600 dark:text-purple-400">
            {ts.journalAiIndexing || "Building AI search index..."}
          </p>
        </div>
      )}

      {/* Mood / tag filter pills (text mode only) */}
      {showFilters && (
        <div className="flex gap-1.5 overflow-x-auto scrollbar-hide -mx-1 px-1 pb-1 snap-x snap-mandatory">
          {Array.from(activeMoods).map((m) => (
            <button
              key={m}
              onClick={() => setSelectedMood(selectedMood === m ? null : m)}
              className={cn(
                "snap-start flex-shrink-0 text-base px-2 py-0.5 rounded-full transition-colors min-h-[44px]",
                selectedMood === m ? "bg-primary/15 ring-1 ring-primary/30" : "hover:bg-muted/50"
              )}
            >
              {MOOD_EMOJIS[m]}
            </button>
          ))}

          {activeMoods.size > 0 && allTags.length > 0 && (
            <div className="w-px bg-border/30 my-1 flex-shrink-0" />
          )}

          {allTags.map((tag) => (
            <button
              key={tag}
              onClick={() => setSelectedTag(selectedTag === tag ? null : tag)}
              className={cn(
                "snap-start flex-shrink-0 px-2.5 py-0.5 rounded-full text-xs font-medium transition-colors min-h-[44px]",
                selectedTag === tag
                  ? "bg-primary/15 text-primary ring-1 ring-primary/30"
                  : "bg-muted/50 text-foreground hover:bg-muted/70"
              )}
            >
              #{tag}
            </button>
          ))}
        </div>
      )}

      {/* AI search results */}
      {aiMode && debouncedSearch.trim() && !aiSearching && (
        <>
          {aiMatchedEntries.length > 0 ? (
            <motion.div
              variants={activeContainerVariants}
              initial="hidden"
              animate="show"
              className="space-y-2"
            >
              <AnimatePresence mode="popLayout">
                {aiMatchedEntries.map(({ entry, similarity }, index) => (
                  <motion.div
                    key={entry.id}
                    variants={activeItemVariants}
                    custom={index}
                    layout
                    exit={{ x: -300, opacity: 0 }}
                    transition={{
                      ...springs.quick,
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                    }}
                    className="relative"
                  >
                    <div className="absolute top-2 end-2 z-10 px-1.5 py-0.5 rounded-md bg-purple-500/10 text-purple-600 dark:text-purple-400 text-[10px] font-medium">
                      {Math.round(similarity * 100)}%
                    </div>
                    {/* A11Y-OK: ContextMenu uses Radix with built-in aria; trigger is JournalEntryCard which has its own aria-labels */}
                    <ContextMenu
                      enabled={isMouse}
                      trigger={
                        // A11Y-OK: JournalEntryCard has role=button + tabIndex + aria internally
                        <JournalEntryCard
                          entry={entry}
                          onTap={handleTap}
                          onDelete={handleDelete}
                          onSwipeDelete={handleSwipeDelete}
                          privateMode={privateMode}
                          searchQuery={debouncedSearch}
                          isActive={activeEntryId === entry.id}
                          dimmed={!!activeEntryId && activeEntryId !== entry.id}
                        />
                      }
                      items={[
                        { label: ts.open || "Open", action: () => handleTap(entry.id) },
                        {
                          label: ts.delete || "Delete",
                          action: () => handleDelete(entry.id),
                          destructive: true,
                        },
                      ]}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          ) : (
            <div className="flex flex-col items-center py-8 text-center">
              <span className="text-3xl mb-2">{"\u{1F50D}"}</span>
              <p className="text-sm text-muted-foreground mb-1">
                {ts.journalNoAiResults || "No similar entries found"}
              </p>
              <p className="text-[10px] text-muted-foreground/50 mb-3 max-w-[220px]">
                {ts.journalNoAiResultsHint || "Try describing your thoughts differently"}
              </p>
            </div>
          )}
        </>
      )}

      {/* Text search: grouped entries with stagger animation */}
      {!aiMode &&
        filteredGroups.map((group) => (
          <div key={group.key}>
            <div className="flex items-center gap-2 px-1 mb-2.5">
              <h3 className="text-[10px] font-bold text-muted-foreground/50 uppercase tracking-widest">
                {ts[group.label] || group.label}
              </h3>
              <div className="flex-1 h-px bg-gradient-to-r from-border/30 to-transparent" />
              <span className="text-[10px] text-muted-foreground/60">{group.entries.length}</span>
            </div>
            <motion.div
              variants={activeContainerVariants}
              initial="hidden"
              animate="show"
              className={cn(
                "space-y-2",
                compact
                  ? "space-y-1.5"
                  : "md:grid md:grid-cols-2 lg:grid-cols-3 md:gap-3 md:space-y-0"
              )}
            >
              <AnimatePresence mode="popLayout">
                {group.entries.map((entry, index) => (
                  <motion.div
                    key={entry.id}
                    variants={activeItemVariants}
                    custom={index}
                    layout
                    exit={{ x: -300, opacity: 0 }}
                    transition={{
                      ...springs.quick,
                      layout: { type: "spring", stiffness: 300, damping: 30 },
                    }}
                  >
                    {/* A11Y-OK: ContextMenu uses Radix with built-in aria; trigger is JournalEntryCard which has its own aria-labels */}
                    <ContextMenu
                      enabled={isMouse}
                      trigger={
                        // A11Y-OK: JournalEntryCard has role=button + tabIndex + aria internally
                        <JournalEntryCard
                          entry={entry}
                          onTap={handleTap}
                          onDelete={handleDelete}
                          onSwipeDelete={handleSwipeDelete}
                          privateMode={privateMode}
                          searchQuery={debouncedSearch}
                          isActive={activeEntryId === entry.id}
                          dimmed={!!activeEntryId && activeEntryId !== entry.id}
                        />
                      }
                      items={[
                        { label: ts.open || "Open", action: () => handleTap(entry.id) },
                        {
                          label: ts.delete || "Delete",
                          action: () => handleDelete(entry.id),
                          destructive: true,
                        },
                      ]}
                    />
                  </motion.div>
                ))}
              </AnimatePresence>
            </motion.div>
          </div>
        ))}

      {/* No results after filtering (text mode) */}
      {!aiMode && hasActiveFilters && filteredGroups.length === 0 && (
        <div className="flex flex-col items-center py-8 text-center">
          <span className="text-3xl mb-2">{"\u{1F50D}"}</span>
          <p className="text-sm text-muted-foreground mb-1">
            {ts.journalNoMatchingEntries || "No entries match your search"}
          </p>
          <p className="text-[10px] text-muted-foreground/50 mb-3 max-w-[220px]">
            {ts.journalNoMatchingHint || "Try a different keyword or clear your filters"}
          </p>
          <button
            onClick={() => {
              setSearchInput("");
              setSelectedMood(null);
              setSelectedTag(null);
            }}
            className="text-xs text-primary font-medium px-3 py-1.5 rounded-lg hover:bg-primary/10 transition-colors min-h-[44px]"
          >
            {ts.journalClearAllFilters || "Clear all filters"}
          </button>
        </div>
      )}

      {/* Speed-dial FAB */}
      <SpeedDialFab onNewEntry={onNewEntry} onAddGratitude={onAddGratitude} />
    </div>
  );
});

// ── Speed-dial FAB ────────────────────────────────────────────────

interface SpeedDialFabProps {
  onNewEntry: () => void;
  onAddGratitude?: (entry: GratitudeEntry) => void;
}

const SpeedDialFab = memo(function SpeedDialFab({ onNewEntry, onAddGratitude }: SpeedDialFabProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [open, setOpen] = useState(false);

  // Escape key to close FAB menu
  useEffect(() => {
    if (!open) return;
    const handleEsc = (e: KeyboardEvent) => {
      if (e.key === "Escape") setOpen(false);
    };
    document.addEventListener("keydown", handleEsc);
    return () => document.removeEventListener("keydown", handleEsc);
  }, [open]);
  const [showQuickGratitude, setShowQuickGratitude] = useState(false);
  const [showQuickBurn, setShowQuickBurn] = useState(false);

  useBackHandler(open, () => setOpen(false));
  useBackHandler(showQuickGratitude, () => setShowQuickGratitude(false));
  useBackHandler(showQuickBurn, () => setShowQuickBurn(false));

  const handleNewEntry = useCallback(() => {
    setOpen(false);
    onNewEntry();
  }, [onNewEntry]);

  const handleQuickGratitude = useCallback(() => {
    setOpen(false);
    setShowQuickBurn(false);
    setShowQuickGratitude(true);
  }, []);

  const handleQuickBurn = useCallback(() => {
    setOpen(false);
    setShowQuickGratitude(false);
    setShowQuickBurn(true);
  }, []);

  const fabBottom = "bottom-[calc(6rem+env(safe-area-inset-bottom))]";

  const miniItems = [
    {
      label: ts.journalFabNewEntry || "New Entry",
      icon: PenLine,
      color: "bg-primary text-primary-foreground",
      action: handleNewEntry,
    },
    ...(onAddGratitude
      ? [
          {
            label: ts.journalQuickGratitude || "Quick Gratitude",
            icon: Sprout,
            color: "bg-emerald-500 text-white",
            action: handleQuickGratitude,
          },
        ]
      : []),
    {
      label: ts.journalBurnAThought || "Burn a Thought",
      icon: Flame,
      color: "bg-orange-500 text-white",
      action: handleQuickBurn,
    },
  ];

  return (
    <>
      {/* Backdrop */}
      <AnimatePresence>
        {open && (
          <motion.div
            className="fixed inset-0 z-[54] bg-black/20"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={() => setOpen(false)}
          />
        )}
      </AnimatePresence>

      {/* Mini-FABs */}
      <AnimatePresence>
        {open &&
          miniItems.map((item, i) => (
            <motion.button
              key={item.label}
              initial={{ opacity: 0, scale: 0.5, y: 20 }}
              animate={{ opacity: 1, scale: 1, y: 0 }}
              exit={{ opacity: 0, scale: 0.5, y: 20 }}
              transition={{
                delay: i * 0.08,
                type: "spring",
                stiffness: 400,
                damping: 22,
              }}
              onClick={item.action}
              aria-label={item.label}
              className={cn(
                "fixed end-5 z-[56] min-h-[44px]",
                fabBottom,
                "flex items-center gap-3 rtl:flex-row flex-row-reverse"
              )}
              style={{
                ["bottom" as string]: `calc(6rem + env(safe-area-inset-bottom) + ${(i + 1) * 56}px)`,
              }}
            >
              <div
                className={cn(
                  "w-11 h-11 rounded-full flex items-center justify-center shadow-lg",
                  item.color
                )}
              >
                <item.icon className="w-5 h-5" />
              </div>
              <span className="text-xs font-medium text-foreground bg-card/90 backdrop-blur-sm px-3 py-1.5 rounded-lg shadow-md whitespace-nowrap">
                {item.label}
              </span>
            </motion.button>
          ))}
      </AnimatePresence>

      {/* Main FAB */}
      <motion.button
        whileTap={{ scale: 0.96 }}
        whileHover={{ scale: 1.05 }}
        onClick={() => {
          if (showQuickGratitude || showQuickBurn) {
            setShowQuickGratitude(false);
            setShowQuickBurn(false);
            setOpen(true);
          } else {
            setOpen((prev) => !prev);
          }
        }}
        aria-label={open ? ts.close || "Close" : ts.journalFabNewEntry || "New entry"}
        className={cn(
          "fixed end-5 lg:end-8 z-[45]",
          fabBottom,
          "w-14 h-14 rounded-full",
          "bg-gradient-to-br from-primary to-primary/80",
          "text-primary-foreground",
          "flex items-center justify-center",
          "shadow-[0_4px_20px_rgba(var(--primary-rgb,99,102,241),0.35)]"
        )}
      >
        <motion.div animate={{ rotate: open ? 45 : 0 }} transition={zenMotion.snappy}>
          <Plus className="w-6 h-6" />
        </motion.div>
      </motion.button>

      {/* Inline Quick Gratitude */}
      <AnimatePresence>
        {showQuickGratitude && onAddGratitude && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={zenMotion.gentle}
          >
            <GratitudeBloomWidget
              onClose={() => setShowQuickGratitude(false)}
              onPlant={(entry) => {
                onAddGratitude(entry);
              }}
            />
          </motion.div>
        )}
      </AnimatePresence>

      {/* Inline Quick Burn */}
      <AnimatePresence>
        {showQuickBurn && (
          <motion.div
            className="mb-4"
            initial={{ opacity: 0, height: 0 }}
            animate={{ opacity: 1, height: "auto" }}
            exit={{ opacity: 0, height: 0 }}
            transition={zenMotion.gentle}
          >
            <BurnThoughtWidget onClose={() => setShowQuickBurn(false)} />
          </motion.div>
        )}
      </AnimatePresence>
    </>
  );
});
