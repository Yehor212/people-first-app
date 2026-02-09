import { useState } from 'react';
import { X } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';

const STICKER_CATEGORIES = [
  { key: 'emotions', label: '\u{1F60A}', stickers: ['\u{1F60A}', '\u{1F602}', '\u{1F970}', '\u{1F60E}', '\u{1F929}', '\u{1F973}', '\u{1F60C}', '\u{1F622}', '\u{1F624}', '\u{1F914}', '\u{1F634}', '\u{1FAE0}', '\u{1F4AA}', '\u{1F64F}', '\u2764\uFE0F', '\u{1F496}'] },
  { key: 'nature', label: '\u{1F33F}', stickers: ['\u{1F338}', '\u{1F33A}', '\u{1F33B}', '\u{1F337}', '\u{1F340}', '\u{1F33F}', '\u{1F332}', '\u{1F30A}', '\u2B50', '\u{1F319}', '\u2600\uFE0F', '\u{1F308}', '\u{1F98B}', '\u{1F41D}', '\u{1F30D}', '\u{1F525}'] },
  { key: 'activities', label: '\u{1F3AF}', stickers: ['\u{1F3AF}', '\u{1F4DA}', '\u{1F3A8}', '\u{1F3B5}', '\u{1F3C3}', '\u{1F9D8}', '\u{1F4BB}', '\u2708\uFE0F', '\u{1F3AE}', '\u{1F3E0}', '\u{1F3AC}', '\u{1F4DD}', '\u{1F9E0}', '\u{1F4A1}', '\u{1F3C6}', '\u{1F389}'] },
  { key: 'food', label: '\u{1F355}', stickers: ['\u2615', '\u{1F355}', '\u{1F34E}', '\u{1F957}', '\u{1F370}', '\u{1F35C}', '\u{1F9C3}', '\u{1F363}', '\u{1F950}', '\u{1FAD6}', '\u{1F353}', '\u{1F951}', '\u{1F36B}', '\u{1F9C1}', '\u{1F37F}', '\u{1F32E}'] },
  { key: 'symbols', label: '\u2728', stickers: ['\u2728', '\u{1F4AB}', '\u{1F31F}', '\u26A1', '\u{1F380}', '\u{1F3F7}\uFE0F', '\u{1F4CC}', '\u{1F511}', '\u{1F381}', '\u{1F48E}', '\u{1FA84}', '\u{1F54A}\uFE0F', '\u{1F90D}', '\u{1F5A4}', '\u{1F49C}', '\u{1F499}'] },
];

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
        <div className="flex gap-1 px-3 py-2 border-b border-border/10">
          {STICKER_CATEGORIES.map((cat, i) => (
            <button
              key={cat.key}
              onClick={() => setActiveCategory(i)}
              className={cn(
                'px-3 py-1.5 rounded-full text-sm transition-colors min-h-[36px]',
                activeCategory === i ? 'bg-primary/15 text-primary' : 'text-muted-foreground hover:bg-muted/50',
              )}
            >
              {cat.label}
            </button>
          ))}
        </div>

        {/* Grid — 6 columns for larger touch targets */}
        <div className="flex-1 overflow-y-auto p-3">
          {recents.length > 0 && activeCategory === 0 && (
            <div className="mb-3">
              <span className="text-[10px] text-muted-foreground uppercase tracking-wider">Recent</span>
              <div className="grid grid-cols-6 gap-1 mt-1">
                {recents.map((s, i) => (
                  <button
                    key={`r-${i}`}
                    onClick={() => handleSelect(s)}
                    className="text-xl p-2 rounded-lg hover:bg-muted/50 active:scale-90 transition-transform min-h-[44px] flex items-center justify-center"
                  >
                    {s}
                  </button>
                ))}
              </div>
            </div>
          )}

          <div className="grid grid-cols-6 gap-1">
            {STICKER_CATEGORIES[activeCategory].stickers.map((s, i) => (
              <button
                key={i}
                onClick={() => handleSelect(s)}
                className="text-xl p-2 rounded-lg hover:bg-muted/50 active:scale-90 transition-transform min-h-[44px] flex items-center justify-center"
              >
                {s}
              </button>
            ))}
          </div>
        </div>
      </div>
    </>
  );
}
