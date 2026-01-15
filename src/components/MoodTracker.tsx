import { useState } from 'react';
import { MoodType, MoodEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles } from 'lucide-react';

interface MoodTrackerProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
  isPrimaryCTA?: boolean;
}

export function MoodTracker({ entries, onAddEntry, isPrimaryCTA = false }: MoodTrackerProps) {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');

  const moods: { type: MoodType; emoji: string; label: string; color: string }[] = [
    { type: 'great', emoji: '😄', label: t.great, color: 'bg-mood-great' },
    { type: 'good', emoji: '🙂', label: t.good, color: 'bg-mood-good' },
    { type: 'okay', emoji: '😐', label: t.okay, color: 'bg-mood-okay' },
    { type: 'bad', emoji: '😔', label: t.bad, color: 'bg-mood-bad' },
    { type: 'terrible', emoji: '😢', label: t.terrible, color: 'bg-mood-terrible' },
  ];

  const today = getToday();
  const todayEntry = entries.find(e => e.date === today);

  const handleSubmit = () => {
    if (!selectedMood) return;

    const entry: MoodEntry = {
      id: generateId(),
      mood: selectedMood,
      note: note.trim() || undefined,
      date: today,
      timestamp: Date.now(),
    };

    onAddEntry(entry);
    setSelectedMood(null);
    setNote('');
  };

  if (todayEntry) {
    const currentMood = moods.find(m => m.type === todayEntry.mood);
    return (
      <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
        <h3 className="text-lg font-semibold text-foreground mb-4">{t.moodToday}</h3>
        <div className="flex items-center gap-4">
          <div className={cn(
            "w-16 h-16 rounded-full flex items-center justify-center text-3xl",
            currentMood?.color, "bg-opacity-20"
          )}>
            {currentMood?.emoji}
          </div>
          <div>
            <p className="font-medium text-foreground">{currentMood?.label}</p>
            {todayEntry.note && (
              <p className="text-sm text-muted-foreground mt-1">{todayEntry.note}</p>
            )}
          </div>
        </div>
      </div>
    );
  }

  return (
    <div className={cn(
      "rounded-2xl p-6 animate-fade-in transition-all relative overflow-hidden",
      isPrimaryCTA
        ? "bg-gradient-to-br from-primary/15 via-card to-accent/15 ring-2 ring-primary/40 shadow-lg shadow-primary/20"
        : "bg-card zen-shadow-card"
    )}>
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 animate-pulse" />
      )}

      {/* Primary CTA Header - More prominent */}
      {isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/25 rounded-full border border-primary/30 animate-glow-pulse">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-primary">{t.startHere || 'Start here'}</span>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
      )}

      <h3 className={cn(
        "font-semibold text-foreground mb-4 relative",
        isPrimaryCTA ? "text-xl text-center" : "text-lg"
      )}>
        {t.howAreYouFeeling}
      </h3>

      <div className={cn(
        "flex justify-between mb-6 relative",
        isPrimaryCTA && "bg-card/50 rounded-2xl p-3 -mx-2"
      )}>
        {moods.map((mood, index) => (
          <button
            key={mood.type}
            onClick={() => setSelectedMood(mood.type)}
            className={cn(
              "mood-btn flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
              selectedMood === mood.type
                ? `${mood.color} bg-opacity-20 scale-110 zen-shadow-soft selected ring-2 ring-primary/50`
                : "hover:bg-secondary/80 hover:scale-105",
              isPrimaryCTA && !selectedMood && "animate-bounce-gentle"
            )}
            style={isPrimaryCTA && !selectedMood ? { animationDelay: `${index * 150}ms` } : undefined}
          >
            <span className={cn(
              "transition-transform drop-shadow-sm",
              isPrimaryCTA ? "text-4xl" : "text-3xl",
              isPrimaryCTA && !selectedMood && "hover:scale-125"
            )}>
              {mood.emoji}
            </span>
            <span className={cn(
              "text-xs font-medium",
              selectedMood === mood.type ? "text-foreground" : "text-muted-foreground"
            )}>{mood.label}</span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="animate-slide-up">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.addNote}
            className="w-full p-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            rows={3}
          />
          <button
            onClick={handleSubmit}
            className={cn(
              "btn-press mt-4 w-full py-4 zen-gradient text-primary-foreground font-bold rounded-xl transition-all",
              "hover:opacity-90 hover:scale-[1.02] active:scale-[0.98]",
              "zen-shadow-soft hover:zen-shadow-glow",
              isPrimaryCTA && "text-lg"
            )}
          >
            {t.saveMood}
          </button>
        </div>
      )}

      {/* Hint for Primary CTA */}
      {isPrimaryCTA && !selectedMood && (
        <p className="text-center text-sm text-muted-foreground mt-2 animate-fade-in">
          {t.tapToStart || 'Tap an emoji to start your day'}
        </p>
      )}
    </div>
  );
}
