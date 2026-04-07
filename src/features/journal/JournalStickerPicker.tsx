import { useState, useMemo } from "react";
import { X, Search, Settings2 } from "lucide-react";
import { AnimatePresence, motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { STICKER_CATEGORIES, MOOD_STICKER_SUGGESTIONS, searchStickers } from "./stickerUtils";
import { StickerRenderer } from "./StickerRenderer";
import { JournalStickerPackManager } from "./JournalStickerPackManager";
import { useStickerPacks } from "./useStickerPacks";
import type { MoodType } from "@/types";

interface JournalStickerPickerProps {
  onSelect: (sticker: string) => void;
  onClose: () => void;
  mood?: MoodType;
}

export function JournalStickerPicker({ onSelect, onClose, mood }: JournalStickerPickerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  useBackHandler(true, onClose);
  useModalA11y(true, onClose);
  useScrollLock(true);

  const { prefs, enabledCategories, enabledCount, togglePack, isNew, markSeen } = useStickerPacks();

  // -1 = suggested (mood), 0+ = index in enabledCategories
  const [activeCategory, setActiveCategory] = useState(mood ? -1 : 0);
  const [searchQuery, setSearchQuery] = useState("");
  const [showPackManager, setShowPackManager] = useState(false);

  const [recents] = useState<string[]>(() => {
    return safeLocalStorageGet<string[]>(SK.JOURNAL_RECENT_STICKERS, []);
  });

  const searchResults = useMemo(() => {
    if (!searchQuery.trim()) return [];
    return searchStickers(searchQuery);
  }, [searchQuery]);

  const handleSelect = (sticker: string) => {
    onSelect(sticker);
    const prev = safeLocalStorageGet<string[]>(SK.JOURNAL_RECENT_STICKERS, []);
    const updated = [sticker, ...prev.filter((s) => s !== sticker)].slice(0, 16);
    safeLocalStorageSet(SK.JOURNAL_RECENT_STICKERS, updated);
  };

  // Ensure activeCategory is within bounds when packs change
  const safeActiveCategory = activeCategory >= enabledCategories.length ? 0 : activeCategory;

  const stickerButton =
    "p-1.5 rounded-xl hover:bg-muted/50 active:scale-90 transition-transform min-h-[44px] flex items-center justify-center";

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[64] bg-black/30 animate-fade-in" onClick={onClose} />

      <div
        role="dialog"
        aria-modal="true"
        className={cn(
          "fixed bottom-0 inset-x-0 z-[65] pb-safe",
          "bg-card/95 backdrop-blur-xl border-t border-border/40",
          "rounded-t-2xl shadow-lg animate-slide-up",
          "max-h-[55dvh] flex flex-col",
          "pb-[env(safe-area-inset-bottom)]"
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
          <span className="text-sm font-semibold text-foreground">
            {ts.journalStickerAdd || "Add Sticker"}
          </span>
          <div className="flex items-center gap-1">
            <button
              onClick={() => setShowPackManager(true)}
              className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={ts.journalStickerPacks || "Sticker Packs"}
            >
              <Settings2 className="w-4 h-4 text-muted-foreground" />
            </button>
            <button
              onClick={onClose}
              className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              aria-label={ts.close || "Close"}
            >
              <X className="w-4 h-4 text-muted-foreground" />
            </button>
          </div>
        </div>

        {/* Search bar */}
        <div className="px-3 py-1.5">
          <div className="relative">
            <Search className="absolute start-2.5 top-1/2 -translate-y-1/2 w-3.5 h-3.5 text-muted-foreground/50 pointer-events-none" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder={ts.journalStickerSearch || "Search stickers..."}
              aria-label={t.ariaSearchStickers}
              className="w-full ps-8 pe-8 py-2 rounded-lg bg-muted/30 border border-border/20 text-sm text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-1 focus-visible:ring-primary/30 min-h-[44px]"
            />
            {searchQuery && (
              <button
                onClick={() => setSearchQuery("")}
                aria-label={t.ariaClearSearch}
                className="absolute end-2 top-1/2 -translate-y-1/2 p-1 rounded-full hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center"
              >
                <X className="w-3 h-3 text-muted-foreground/50" />
              </button>
            )}
          </div>
        </div>

        {/* Category tabs — scrollable */}
        {!searchQuery && (
          <div className="flex gap-0.5 px-2 py-1.5 border-b border-border/10 overflow-x-auto scrollbar-hide snap-x snap-mandatory">
            {/* Suggested tab (only when mood set) */}
            {mood && (
              <button
                onClick={() => setActiveCategory(-1)}
                className={cn(
                  "snap-start flex-shrink-0 px-2.5 py-1 rounded-lg text-sm transition-colors min-h-[40px] flex flex-col items-center justify-center gap-0.5",
                  safeActiveCategory === -1 && activeCategory === -1
                    ? "bg-primary/15"
                    : "hover:bg-muted/50"
                )}
              >
                <span className="text-base">{"\u2728"}</span>
                <span
                  className={cn(
                    "text-[10px] truncate max-w-[52px]",
                    activeCategory === -1 ? "text-primary/80" : "text-muted-foreground/50"
                  )}
                >
                  {ts.journalStickerSuggested || "Suggested"}
                </span>
              </button>
            )}
            {enabledCategories.map((cat, i) => (
              <button
                key={cat.key}
                onClick={() => setActiveCategory(i)}
                className={cn(
                  "snap-start flex-shrink-0 px-2.5 py-1 rounded-lg text-sm transition-colors min-h-[40px] flex flex-col items-center justify-center gap-0.5",
                  safeActiveCategory === i && activeCategory >= 0
                    ? "bg-primary/15"
                    : "hover:bg-muted/50"
                )}
              >
                <StickerRenderer emoji={cat.icon} size="sm" />
                <span
                  className={cn(
                    "text-[10px] truncate max-w-[52px]",
                    safeActiveCategory === i && activeCategory >= 0
                      ? "text-primary/80"
                      : "text-muted-foreground/50"
                  )}
                >
                  {ts[cat.labelKey] || cat.key}
                </span>
              </button>
            ))}
          </div>
        )}

        {/* Grid content */}
        <div className="flex-1 overflow-y-auto p-3">
          <AnimatePresence mode="wait">
            {/* Search results */}
            {searchQuery ? (
              <motion.div
                key="search"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {searchResults.length > 0 ? (
                  <div className="grid grid-cols-6 gap-1.5">
                    {searchResults.map((r, i) => (
                      <div key={`sr-${i}`} className="relative">
                        <button onClick={() => handleSelect(r.emoji)} className={stickerButton}>
                          <StickerRenderer emoji={r.emoji} size="lg" />
                        </button>
                        {/* Show pack hint for disabled packs */}
                        {!prefs.enabled[r.packKey] && (
                          <span className="absolute -bottom-0.5 inset-x-0 text-center text-[8px] text-muted-foreground/60 truncate">
                            {ts[
                              STICKER_CATEGORIES.find((c) => c.key === r.packKey)?.labelKey || ""
                            ] || r.packKey}
                          </span>
                        )}
                      </div>
                    ))}
                  </div>
                ) : (
                  <p className="text-center text-xs text-muted-foreground/50 py-8">
                    {ts.journalStickerNoResults || "No stickers found"}
                  </p>
                )}
              </motion.div>
            ) : activeCategory === -1 && mood ? (
              /* Mood suggestions */
              <motion.div
                key="suggested"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                <div className="grid grid-cols-6 gap-1.5">
                  {MOOD_STICKER_SUGGESTIONS[mood].map((s, i) => (
                    <button
                      key={`sug-${i}`}
                      onClick={() => handleSelect(s)}
                      className={stickerButton}
                    >
                      <StickerRenderer emoji={s} size="lg" />
                    </button>
                  ))}
                </div>
              </motion.div>
            ) : enabledCategories.length === 0 ? (
              /* Empty state */
              <motion.div
                key="empty"
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                className="text-center py-8"
              >
                <p className="text-xs text-muted-foreground/50 mb-3">
                  {ts.journalStickerPackEnable || "Enable at least one sticker pack"}
                </p>
                <button
                  onClick={() => setShowPackManager(true)}
                  className="text-xs text-primary font-medium px-4 py-2 rounded-lg bg-primary/10 min-h-[44px]"
                >
                  {ts.journalStickerPacks || "Sticker Packs"}
                </button>
              </motion.div>
            ) : (
              /* Regular category grid */
              <motion.div
                key={`cat-${safeActiveCategory}`}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                exit={{ opacity: 0 }}
                transition={{ duration: 0.15 }}
              >
                {/* Recents — only on first category */}
                {recents.length > 0 && safeActiveCategory === 0 && (
                  <div className="mb-3">
                    <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                      {ts.journalStickerRecent || "Recent"}
                    </span>
                    <div className="grid grid-cols-6 gap-1.5 mt-1">
                      {recents.map((s, i) => (
                        <button
                          key={`r-${i}`}
                          onClick={() => handleSelect(s)}
                          className={stickerButton}
                        >
                          <StickerRenderer emoji={s} size="lg" />
                        </button>
                      ))}
                    </div>
                  </div>
                )}

                <div className="grid grid-cols-6 gap-1.5">
                  {enabledCategories[safeActiveCategory]?.stickers.map((s, i) => (
                    <button key={i} onClick={() => handleSelect(s)} className={stickerButton}>
                      <StickerRenderer emoji={s} size="lg" />
                    </button>
                  ))}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>
      </div>

      {/* Pack Manager overlay */}
      {showPackManager && (
        <JournalStickerPackManager
          prefs={prefs}
          onToggle={(key) => {
            togglePack(key);
            markSeen(key);
          }}
          isNew={isNew}
          enabledCount={enabledCount}
          onClose={() => setShowPackManager(false)}
        />
      )}
    </>
  );
}
