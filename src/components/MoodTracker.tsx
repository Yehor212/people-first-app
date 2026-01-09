import { useState } from 'react';
import { MoodType, MoodEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';

const moods: { type: MoodType; emoji: string; label: string; color: string }[] = [
  { type: 'great', emoji: '😄', label: 'Отлично', color: 'bg-mood-great' },
  { type: 'good', emoji: '🙂', label: 'Хорошо', color: 'bg-mood-good' },
  { type: 'okay', emoji: '😐', label: 'Нормально', color: 'bg-mood-okay' },
  { type: 'bad', emoji: '😔', label: 'Плохо', color: 'bg-mood-bad' },
  { type: 'terrible', emoji: '😢', label: 'Ужасно', color: 'bg-mood-terrible' },
];

interface MoodTrackerProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
}

export function MoodTracker({ entries, onAddEntry }: MoodTrackerProps) {
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  
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
        <h3 className="text-lg font-semibold text-foreground mb-4">Настроение сегодня</h3>
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
    <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
      <h3 className="text-lg font-semibold text-foreground mb-4">Как вы себя чувствуете?</h3>
      
      <div className="flex justify-between mb-6">
        {moods.map((mood) => (
          <button
            key={mood.type}
            onClick={() => setSelectedMood(mood.type)}
            className={cn(
              "flex flex-col items-center gap-2 p-3 rounded-xl transition-all duration-200",
              selectedMood === mood.type 
                ? `${mood.color} bg-opacity-20 scale-110 zen-shadow-soft` 
                : "hover:bg-secondary"
            )}
          >
            <span className="text-3xl">{mood.emoji}</span>
            <span className="text-xs text-muted-foreground">{mood.label}</span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="animate-slide-up">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder="Добавьте заметку (необязательно)..."
            className="w-full p-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            rows={3}
          />
          <button
            onClick={handleSubmit}
            className="mt-4 w-full py-3 zen-gradient text-primary-foreground font-semibold rounded-xl hover:opacity-90 transition-opacity zen-shadow-soft"
          >
            Сохранить настроение
          </button>
        </div>
      )}
    </div>
  );
}
