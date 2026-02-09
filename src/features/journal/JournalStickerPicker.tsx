import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { STICKER_CATEGORIES } from './stickerUtils';
import { StickerRenderer } from './StickerRenderer';

interface JournalStickerPickerProps {
  onSelect: (sticker: string) => void;
  onClose: () => void;
}

export function JournalStickerPicker({ onSelect, onClose }: JournalStickerPickerProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [activeCategory, setActiveCategory] = useState(0);

  const [recents] = useState<string[]>(() => {
    try {
      return JSON.parse(localStorage.getItem('journal-recent-stickers') || '[]');
    } catch { return []; }
  });

  const handleSelect = (sticker: string) => {
    onSelect(sticker);
    try {
      const prev = JSON.parse(localStorage.getItem('journal-recent-stickers') || '[]') as string[];
      const updated = [sticker, ...prev.filter(s => s !== sticker)].slice(0, 16);
      localStorage.setItem('journal-recent-stickers', JSON.stringify(updated));
    } catch { /* ignore */ }
  };

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-[64] bg-black/30 animate-fade-in" onClick={onClose} />

      <div
        className={cn(
          'fixed bottom-0 left-0 right-0 z-[65]',
          'bg-card/95 backdrop-blur-xl border-t border-border/40',
          'rounded-t-2xl shadow-lg animate-slide-up',
          'max-h-[50vh] flex flex-col',
          'pb-[env(safe-area-inset-bottom)]',
        )}
      >
        {/* Handle bar */}
        <div className="flex justify-center pt-2 pb-1">
          <div className="w-10 h-1 rounded-full bg-muted-foreground/20" />
        </div>

        {/* Header */}
        <div className="flex items-center justify-between px-4 py-2 border-b border-border/20">
          <span className="text-sm font-semibold text-foreground">
            {ts.journalStickerAdd || 'Add Sticker'}
          </span>
          <button onClick={onClose} className="p-2 rounded-lg hover:bg-muted/50 min-w-[44px] min-h-[44px] flex items-center justify-center">
            <X className="w-4 h-4 text-muted-foreground" />
          </button>
        </div>

        {/* Category tabs */}
        <div className="flex gap-0.5 px-2 py-1.5 border-b border-border/10">
          {STICKER_CATEGORIES.map((cat, i) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(i)}
              className={cn(
                'flex-1 py-1 rounded-lg text-sm transition-colors min-h-[40px] flex flex-col items-center justify-center gap-0.5',
                activeCategory === i ? 'bg-primary/15' : 'hover:bg-muted/50',
              )}
            >
              <StickerRenderer emoji={cat.icon} size="sm" />
              <span className={cn(
                'text-[8px] truncate max-w-[52px]',
                activeCategory === i ? 'text-primary/80' : 'text-muted-foreground/50',
              )}>
                {ts[cat.labelKey] || cat.key}
              </span>
            </button>
          ))}
        </div>

        {/* Grid — 5 columns for image stickers */}
        <div className="flex-1 overflow-y-auto p-3">
          {recents.length > 0 && activeCategory === 0 && (
            <div className="mb-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">
                {ts.journalStickerRecent || 'Recent'}
              </span>
              <div className="grid grid-cols-5 gap-1.5 mt-1">
                {recents.map((s, i) => (
                  <button
                    key={`r-${i}`}
                    onClick={() => handleSelect(s)}
                    className="p-2 rounded-xl hover:bg-muted/50 active:scale-90 transition-transform min-h-[48px] flex items-center justify-center"
                  >
                    <StickerRenderer emoji={s} size="lg" />
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-5 gap-1.5">
            {STICKER_CATEGORIES[activeCategory].stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSelect(s)}
                className="p-2 rounded-xl hover:bg-muted/50 active:scale-90 transition-transform min-h-[48px] flex items-center justify-center"
              >
                <StickerRenderer emoji={s} size="lg" />
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
