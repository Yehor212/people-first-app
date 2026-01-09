import { useState } from 'react';
import { GratitudeEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { Sparkles, Plus } from 'lucide-react';

interface GratitudeJournalProps {
  entries: GratitudeEntry[];
  onAddEntry: (entry: GratitudeEntry) => void;
}

export function GratitudeJournal({ entries, onAddEntry }: GratitudeJournalProps) {
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
    <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
      <div className="flex items-center justify-between mb-4">
        <div className="flex items-center gap-2">
          <Sparkles className="w-5 h-5 text-accent" />
          <h3 className="text-lg font-semibold text-foreground">Благодарность</h3>
        </div>
        <span className="text-sm text-muted-foreground">
          {todayEntries.length} сегодня
        </span>
      </div>

      {!isExpanded ? (
        <button
          onClick={() => setIsExpanded(true)}
          className="w-full p-4 border-2 border-dashed border-border rounded-xl text-muted-foreground hover:border-primary hover:text-primary transition-colors flex items-center justify-center gap-2"
        >
          <Plus className="w-5 h-5" />
          <span>За что вы благодарны сегодня?</span>
        </button>
      ) : (
        <div className="animate-scale-in">
          <textarea
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Я благодарен за..."
            className="w-full p-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-accent/30 transition-all"
            rows={3}
            autoFocus
          />
          <div className="flex gap-2 mt-3">
            <button
              onClick={() => setIsExpanded(false)}
              className="flex-1 py-2 bg-secondary text-secondary-foreground rounded-xl hover:bg-muted transition-colors"
            >
              Отмена
            </button>
            <button
              onClick={handleSubmit}
              disabled={!text.trim()}
              className="flex-1 py-2 zen-gradient-warm text-primary-foreground font-medium rounded-xl disabled:opacity-50 transition-opacity"
            >
              Сохранить
            </button>
          </div>
        </div>
      )}

      {recentEntries.length > 0 && (
        <div className="mt-4 space-y-2">
          <p className="text-sm text-muted-foreground">Недавние записи:</p>
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
