import { useState } from 'react';
import { GratitudeEntry } from '@/types';
import { getToday, generateId, cn } from '@/lib/utils';
import { Sparkles, Plus, Zap } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface GratitudeJournalProps {
  entries: GratitudeEntry[];
  onAddEntry: (entry: GratitudeEntry) => void;
  isPrimaryCTA?: boolean;
}

export function GratitudeJournal({ entries, onAddEntry, isPrimaryCTA = false }: GratitudeJournalProps) {
  const { t } = useLanguage();
  const [text, setText] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  
  const today = getToday();
  const todayEntries = entries.filter(e => e.date === today);
  const recentEntries = entries.slice(-5).reverse();

  const handleSubmit = () => {
    if (!text.trim()) return;
    
    const entry: GratitudeEntry = {
      id: generateId(),
      text: text.trim(),
      date: today,
      timestamp: Date.now(),
    };
    
    onAddEntry(entry);
    setText('');
    setIsExpanded(false);
  };

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-pink-500/15 via-card to-rose-500/15 ring-2 ring-pink-500/40 shadow-lg shadow-pink-500/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-pink-500/5 via-transparent to-rose-500/5 animate-pulse" />
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-pink-500/25 rounded-full border border-pink-500/30">
            <Zap className="w-4 h-4 text-pink-500" />
            <span className="text-sm font-bold text-pink-600 dark:text-pink-400">{t.startHere}</span>
          </div>
        </div>
      )}

      <div className="flex items-center justify-between mb-4 relative">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className={cn(
            "font-semibold text-foreground",
            isPrimaryCTA ? "text-xl" : "text-lg"
          )}>{t.gratitude}</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {todayEntries.length} {t.today}
        </span>
      </div>

      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>{t.whatAreYouGratefulFor}</span>
        </button>
      ) : (
        <div className="animate-scale-in">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={t.iAmGratefulFor}
            className="w-full p-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-xl hover:bg-muted transition-colors"
            >
              {t.cancel}
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex-1 py-2 zen-gradient-warm text-primary-foreground font-medium rounded-xl disabled:opacity-50 transition-opacity"
            >
              {t.save}
            </button>
          </div>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">{t.recentEntries}:</p>
          {recentEntries.map((entry) => (
            <div
              key={entry.id}
              className="p-3 bg-secondary/50 rounded-lg text-sm text-foreground"
            >
              ✨ {entry.text}
            </div>
          ))}
        </div>
      )}
    </div>
  );
}
