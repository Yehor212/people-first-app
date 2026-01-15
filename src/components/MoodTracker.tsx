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
      "rounded-2xl p-6 animate-fade-in transition-all",
      isPrimaryCTA
        ? "bg-gradient-to-br from-primary/10 via-card to-accent/10 ring-2 ring-primary/30 zen-shadow-glow"
        : "bg-card zen-shadow-card"
    )}>
      {/* Primary CTA Header */}
      {isPrimaryCTA && (
        <div className="flex items-center gap-2 mb-3">
          <div className="flex items-center gap-1.5 px-3 py-1 bg-primary/20 rounded-full">
            <Sparkles className="w-4 h-4 text-primary animate-pulse" />
            <span className="text-xs font-semibold text-primary">{t.startHere || 'Start here'}</span>
          </div>
        </div>
      )}

      <h3 className={cn(
        "font-semibold text-foreground mb-4",
        isPrimaryCTA ? "text-xl" : "text-lg"
      )}>
        {t.howAreYouFeeling}
      </h3>

      <div className="flex justify-between mb-6">
        {moods.map((mood, index) => (
          <button
            key={mood.type}
            onClick={() => setSelectedMood(mood.type)}
            className={cn(
              "mood-btn flex flex-col items-center gap-2 p-3 rounded-xl transition-all",
              selectedMood === mood.type
                ? `${mood.color} bg-opacity-20 scale-110 zen-shadow-soft selected`
                : "hover:bg-secondary",
              isPrimaryCTA && !selectedMood && "animate-pulse-subtle"
            )}
            style={isPrimaryCTA && !selectedMood ? { animationDelay: `${index * 100}ms` } : undefined}
          >
            <span className={cn("transition-transform", isPrimaryCTA ? "text-4xl" : "text-3xl")}>
              {mood.emoji}
            </span>
            <span className="text-xs text-muted-foreground">{mood.label}</span>
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
