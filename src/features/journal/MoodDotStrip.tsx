import { memo, useCallback, useRef, useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Bookmark } from "lucide-react";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { StickerRenderer } from "./StickerRenderer";
import type { JournalEntry } from "./types";

const MOOD_STICKER: Record<string, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F614}",
  terrible: "\u{1F622}",
};

const MOOD_RING_COLOR: Record<string, string> = {
  great: "ring-green-400/40",
  good: "ring-emerald-400/40",
  okay: "ring-amber-400/40",
  bad: "ring-orange-400/40",
  terrible: "ring-red-400/40",
};

function getRelativeTimeShort(timestamp: number): string {
  const diff = Date.now() - timestamp;
  const minutes = Math.floor(diff / 60_000);
  if (minutes < 1) return "now";
  if (minutes < 60) return `${minutes}m`;
  const hours = Math.floor(minutes / 60);
  if (hours < 24) return `${hours}h`;
  const days = Math.floor(hours / 24);
  if (days === 1) return "1d";
  return `${days}d`;
}

interface MoodDotStripProps {
  entries: JournalEntry[];
  activeEntryId: string | null;
  onOpenEntry: (id: string) => void;
}

export const MoodDotStrip = memo(function MoodDotStrip({
  entries,
  activeEntryId,
  onOpenEntry,
}: MoodDotStripProps) {
  const { isRTL } = useLanguage();
  const listRef = useRef<HTMLDivElement>(null);
  const [focusIndex, setFocusIndex] = useState(-1);
  const [hoveredId, setHoveredId] = useState<string | null>(null);
  const hoverTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Virtualization: render only visible dots + buffer
  const [visibleRange, setVisibleRange] = useState({ start: 0, end: 12 });

  useEffect(() => {
    const container = listRef.current;
    if (!container) return;
    const handleScroll = () => {
      const scrollTop = container.scrollTop;
      const itemHeight = 40; // w-8 + gap
      const viewportItems = Math.ceil(container.clientHeight / itemHeight);
      const start = Math.max(0, Math.floor(scrollTop / itemHeight) - 5);
      const end = Math.min(entries.length, start + viewportItems + 10);
      setVisibleRange({ start, end });
    };
    handleScroll();
    container.addEventListener("scroll", handleScroll, { passive: true });
    return () => container.removeEventListener("scroll", handleScroll);
  }, [entries.length]);

  // Cleanup hover timeout
  useEffect(() => {
    return () => {
      if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    };
  }, []);

  const handleMouseEnter = useCallback((id: string) => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    hoverTimeoutRef.current = setTimeout(() => setHoveredId(id), 300);
  }, []);

  const handleMouseLeave = useCallback(() => {
    if (hoverTimeoutRef.current) clearTimeout(hoverTimeoutRef.current);
    setHoveredId(null);
  }, []);

  const handleKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (e.key === "ArrowDown") {
        e.preventDefault();
        setFocusIndex((prev) => Math.min(prev + 1, entries.length - 1));
      } else if (e.key === "ArrowUp") {
        e.preventDefault();
        setFocusIndex((prev) => Math.max(prev - 1, 0));
      } else if (e.key === "Enter" && focusIndex >= 0) {
        e.preventDefault();
        onOpenEntry(entries[focusIndex].id);
      }
    },
    [entries, focusIndex, onOpenEntry]
  );

  // Focus the active dot when focusIndex changes
  useEffect(() => {
    if (focusIndex < 0) return;
    const el = listRef.current?.querySelector(`[data-index="${focusIndex}"]`) as HTMLElement;
    el?.focus();
  }, [focusIndex]);

  const totalHeight = entries.length * 40;
  const visibleEntries = entries.slice(visibleRange.start, visibleRange.end);

  return (
    <div
      ref={listRef}
      role="listbox"
      aria-label="Diary entries"
      tabIndex={0}
      onKeyDown={handleKeyDown}
      className="flex-1 overflow-y-auto overflow-x-hidden outline-none py-1"
    >
      <div style={{ height: totalHeight, position: "relative" }}>
        {visibleEntries.map((entry, i) => {
          const realIndex = visibleRange.start + i;
          const isActive = entry.id === activeEntryId;
          const isFocused = realIndex === focusIndex;
          const isHovered = entry.id === hoveredId;
          const mood = entry.mood;
          const title = entry.title || new Date(entry.createdAt).toLocaleTimeString([], { hour: "2-digit", minute: "2-digit" });

          return (
            <div
              key={entry.id}
              style={{ position: "absolute", top: realIndex * 40, left: 0, right: 0 }}
              className="flex items-center justify-center h-10"
            >
              <motion.button
                layoutId={`mood-${entry.id}`}
                role="option"
                aria-selected={isActive}
                aria-label={`${mood ? mood : "entry"}: ${title}`}
                data-index={realIndex}
                tabIndex={isFocused ? 0 : -1}
                onClick={() => {
                  if (isActive) return;
                  onOpenEntry(entry.id);
                }}
                onMouseEnter={() => handleMouseEnter(entry.id)}
                onMouseLeave={handleMouseLeave}
                whileHover={{ scale: 1.15 }}
                whileTap={{ scale: 0.9 }}
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center flex-shrink-0 transition-all relative",
                  isActive && mood && `ring-2 ${MOOD_RING_COLOR[mood]}`,
                  isActive && !mood && "ring-2 ring-primary/30",
                  isFocused && "ring-2 ring-primary/50",
                  !isActive && "hover:bg-muted/30"
                )}
              >
                {mood ? (
                  <StickerRenderer emoji={MOOD_STICKER[mood]} size="xs" />
                ) : (
                  <Bookmark className="w-3.5 h-3.5 text-muted-foreground/50" />
                )}
              </motion.button>

              {/* Tooltip */}
              {isHovered && (
                <div
                  className={cn(
                    "absolute z-50 px-2 py-1 rounded-md bg-popover text-popover-foreground text-xs shadow-md border border-border/30 whitespace-nowrap pointer-events-none",
                    isRTL ? "right-12" : "left-12"
                  )}
                >
                  <span className="font-medium">{title.length > 24 ? title.slice(0, 24) + "..." : title}</span>
                  <span className="text-muted-foreground/60 ms-1.5">{getRelativeTimeShort(entry.createdAt)}</span>
                </div>
              )}
            </div>
          );
        })}
      </div>
    </div>
  );
});
