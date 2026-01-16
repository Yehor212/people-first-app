import { useState, useMemo } from 'react';
import { MoodType, MoodEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Sparkles, Sun, Cloud, Moon, Plus, ChevronDown, Edit3 } from 'lucide-react';
import { MoodChangedToast, ConfirmDialog } from './Celebrations';
import { AnimatedMoodEmoji } from './AnimatedMoodEmoji';
import { MoodSelectionCelebration } from './MoodSelectionCelebration';

interface MoodTrackerProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
  onUpdateEntry?: (entryId: string, mood: MoodType, note?: string) => void;
  isPrimaryCTA?: boolean;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// Get current time of day
function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

// Get time of day from timestamp
function getTimeOfDayFromTimestamp(timestamp: number): TimeOfDay {
  const hour = new Date(timestamp).getHours();
  if (hour >= 5 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function MoodTracker({ entries, onAddEntry, onUpdateEntry, isPrimaryCTA = false }: MoodTrackerProps) {
  const { t } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);

  // Edit mode state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingMood, setEditingMood] = useState<MoodType | null>(null);
  const [showMoodChangedToast, setShowMoodChangedToast] = useState(false);
  const [changedMoodEmoji, setChangedMoodEmoji] = useState<string>('');
  const [confirmChange, setConfirmChange] = useState<{
    entryId: string;
    newMood: MoodType;
    oldMood: MoodType;
  } | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    mood: MoodType;
    note?: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
  } | null>(null);

  const moods: { type: MoodType; emoji: string; label: string; color: string }[] = [
    { type: 'great', emoji: '😄', label: t.great, color: 'bg-mood-great' },
    { type: 'good', emoji: '🙂', label: t.good, color: 'bg-mood-good' },
    { type: 'okay', emoji: '😐', label: t.okay, color: 'bg-mood-okay' },
    { type: 'bad', emoji: '😔', label: t.bad, color: 'bg-mood-bad' },
    { type: 'terrible', emoji: '😢', label: t.terrible, color: 'bg-mood-terrible' },
  ];

  const timeIcons = {
    morning: Sun,
    afternoon: Cloud,
    evening: Moon,
  };

  const timeLabels = {
    morning: t.morning || 'Morning',
    afternoon: t.afternoon || 'Afternoon',
    evening: t.evening || 'Evening',
  };

  const today = getToday();
  const currentTimeOfDay = getCurrentTimeOfDay();

  // Get all entries for today, sorted by time
  const todayEntries = useMemo(() => {
    return entries
      .filter(e => e.date === today)
      .sort((a, b) => a.timestamp - b.timestamp);
  }, [entries, today]);

  // Check which time periods already have entries
  const entryByTime = useMemo(() => {
    const result: Partial<Record<TimeOfDay, MoodEntry>> = {};
    todayEntries.forEach(entry => {
      const tod = getTimeOfDayFromTimestamp(entry.timestamp);
      // Keep the latest entry for each time period
      result[tod] = entry;
    });
    return result;
  }, [todayEntries]);

  // Can add new entry if current time period doesn't have one
  const canAddForCurrentTime = !entryByTime[currentTimeOfDay];
  const hasAnyEntryToday = todayEntries.length > 0;

  const handleSubmit = () => {
    if (!selectedMood) return;

    const entry: MoodEntry = {
      id: generateId(),
      mood: selectedMood,
      note: note.trim() || undefined,
      date: today,
      timestamp: Date.now(),
    };

    // Show celebration first
    setCelebrationData({
      mood: selectedMood,
      note: note.trim() || undefined,
      timeOfDay: currentTimeOfDay,
    });
    setShowCelebration(true);

    // Save entry
    onAddEntry(entry);
    setSelectedMood(null);
    setNote('');
    setShowAddNew(false);
  };

  // Handle starting edit mode for an entry
  const handleStartEdit = (entry: MoodEntry) => {
    setEditingEntryId(entry.id);
    setEditingMood(entry.mood);
  };

  // Handle selecting a new mood during edit
  const handleEditMoodSelect = (entry: MoodEntry, newMood: MoodType) => {
    if (newMood === entry.mood) {
      // Same mood selected, cancel edit
      setEditingEntryId(null);
      setEditingMood(null);
      return;
    }
    // Show confirmation dialog (misclick protection)
    setConfirmChange({
      entryId: entry.id,
      newMood,
      oldMood: entry.mood,
    });
  };

  // Confirm and apply mood change
  const confirmMoodChange = () => {
    if (!confirmChange || !onUpdateEntry) return;

    const { entryId, newMood } = confirmChange;
    const entry = todayEntries.find(e => e.id === entryId);

    onUpdateEntry(entryId, newMood, entry?.note);

    // Show success toast
    const newMoodData = moods.find(m => m.type === newMood);
    setChangedMoodEmoji(newMoodData?.emoji || '');
    setShowMoodChangedToast(true);
    setTimeout(() => setShowMoodChangedToast(false), 2500);

    // Reset state
    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
  };

  // Cancel mood change
  const cancelMoodChange = () => {
    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
  };

  // Compact view showing today's mood entries
  if (hasAnyEntryToday && !showAddNew) {
    const latestEntry = todayEntries[todayEntries.length - 1];
    const latestMood = moods.find(m => m.type === latestEntry.mood);
    const latestTimeOfDay = getTimeOfDayFromTimestamp(latestEntry.timestamp);
    const LatestTimeIcon = timeIcons[latestTimeOfDay];

    return (
      <div className="bg-card rounded-2xl p-5 zen-shadow-card animate-fade-in">
        {/* Header with expand toggle */}
        <div
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
        >
          <h3 className="text-lg font-semibold text-foreground">{t.moodToday || "Today's Mood"}</h3>
          <ChevronDown className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )} />
        </div>

        {/* Latest mood summary */}
        <div className="flex items-center gap-4 mt-4">
          <div className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center text-2xl",
            latestMood?.color, "bg-opacity-20"
          )}>
            {latestMood?.emoji}
          </div>
          <div className="flex-1">
            <div className="flex items-center gap-2">
              <LatestTimeIcon className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium text-foreground">{latestMood?.label}</p>
            </div>
            {latestEntry.note && (
              <p className="text-sm text-muted-foreground mt-1 line-clamp-1">{latestEntry.note}</p>
            )}
          </div>

          {/* Add new button - only if current time period doesn't have entry */}
          {canAddForCurrentTime && (
            <button
              onClick={(e) => {
                e.stopPropagation();
                setShowAddNew(true);
              }}
              className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors"
            >
              <Plus className="w-4 h-4" />
              <span className="text-sm font-medium">{t.updateMood || 'Update'}</span>
            </button>
          )}
        </div>

        {/* Expanded view - show all entries for today */}
        {isExpanded && todayEntries.length > 0 && (
          <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
            <p className="text-xs text-muted-foreground uppercase tracking-wide">
              {t.moodHistory || 'Today\'s history'}
            </p>
            {todayEntries.map((entry) => {
              const entryMood = moods.find(m => m.type === entry.mood);
              const tod = getTimeOfDayFromTimestamp(entry.timestamp);
              const TimeIcon = timeIcons[tod];
              const time = new Date(entry.timestamp).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
              const isEditing = editingEntryId === entry.id;

              return (
                <div key={entry.id} className={cn(
                  "p-2 bg-secondary/50 rounded-xl transition-all",
                  isEditing && "ring-2 ring-primary/50 bg-secondary"
                )}>
                  {/* Normal view */}
                  {!isEditing ? (
                    <div className="flex items-center gap-3">
                      <div className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center text-xl",
                        entryMood?.color, "bg-opacity-20"
                      )}>
                        {entryMood?.emoji}
                      </div>
                      <div className="flex-1 min-w-0">
                        <div className="flex items-center gap-2">
                          <TimeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                          <span className="text-sm font-medium text-foreground">{timeLabels[tod]}</span>
                          <span className="text-xs text-muted-foreground">{time}</span>
                        </div>
                        {entry.note && (
                          <p className="text-xs text-muted-foreground truncate">{entry.note}</p>
                        )}
                      </div>
                      {/* Edit button - only for today's entries */}
                      {onUpdateEntry && (
                        <button
                          onClick={(e) => {
                            e.stopPropagation();
                            handleStartEdit(entry);
                          }}
                          className="p-2 hover:bg-primary/10 rounded-lg transition-colors group"
                          title={t.editMood || 'Edit mood'}
                        >
                          <Edit3 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                        </button>
                      )}
                    </div>
                  ) : (
                    /* Edit mode view */
                    <div className="animate-fade-in">
                      <div className="flex items-center gap-2 mb-3">
                        <TimeIcon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-medium text-primary">{t.changeMood || 'Change mood'}</span>
                        <button
                          onClick={() => {
                            setEditingEntryId(null);
                            setEditingMood(null);
                          }}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t.cancel || 'Cancel'}
                        </button>
                      </div>
                      <div className="flex justify-between gap-1">
                        {moods.map((mood) => (
                          <button
                            key={mood.type}
                            onClick={() => handleEditMoodSelect(entry, mood.type)}
                            className={cn(
                              "flex-1 p-2 rounded-lg transition-all",
                              editingMood === mood.type || entry.mood === mood.type
                                ? `${mood.color} bg-opacity-30 scale-105`
                                : "hover:bg-secondary hover:scale-105"
                            )}
                          >
                            <span className="text-xl">{mood.emoji}</span>
                          </button>
                        ))}
                      </div>
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        )}

        {/* Timeline dots showing which parts of day are recorded */}
        <div className="flex items-center justify-center gap-6 mt-4 pt-3 border-t border-border/50">
          {(['morning', 'afternoon', 'evening'] as TimeOfDay[]).map((tod) => {
            const TimeIcon = timeIcons[tod];
            const hasEntry = !!entryByTime[tod];
            const isCurrent = tod === currentTimeOfDay;
            const entryMood = hasEntry ? moods.find(m => m.type === entryByTime[tod]?.mood) : null;
            const entry = entryByTime[tod];
            const canEdit = hasEntry && onUpdateEntry;

            return (
              <button
                key={tod}
                onClick={(e) => {
                  e.stopPropagation();
                  if (canEdit && entry) {
                    handleStartEdit(entry);
                    setIsExpanded(true); // Expand to show edit UI
                  } else if (!hasEntry && isCurrent) {
                    setShowAddNew(true);
                  }
                }}
                disabled={!hasEntry && !isCurrent}
                className={cn(
                  "flex flex-col items-center gap-1 transition-all",
                  !hasEntry && !isCurrent && "opacity-40",
                  (canEdit || (!hasEntry && isCurrent)) && "hover:scale-110 cursor-pointer"
                )}
              >
                <div className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  hasEntry ? `${entryMood?.color} bg-opacity-20` : "bg-secondary",
                  isCurrent && !hasEntry && "ring-2 ring-primary/30 ring-offset-1",
                  canEdit && "hover:ring-2 hover:ring-primary/50"
                )}>
                  {hasEntry ? (
                    <span className="text-lg">{entryMood?.emoji}</span>
                  ) : (
                    <TimeIcon className={cn("w-4 h-4", isCurrent ? "text-primary" : "text-muted-foreground")} />
                  )}
                </div>
                <span className={cn(
                  "text-[10px]",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}>
                  {timeLabels[tod]}
                </span>
              </button>
            );
          })}
        </div>

        {/* Confirmation Dialog */}
        {confirmChange && (
          <ConfirmDialog
            title={t.changeMoodConfirmTitle || 'Change mood?'}
            message={t.changeMoodConfirmMessage || 'Are you sure you want to change your mood?'}
            confirmText={t.confirm || 'Change'}
            cancelText={t.cancel || 'Cancel'}
            onConfirm={confirmMoodChange}
            onCancel={cancelMoodChange}
          />
        )}

        {/* Mood Changed Toast */}
        {showMoodChangedToast && (
          <MoodChangedToast
            emoji={changedMoodEmoji}
            message={t.moodChanged || 'Mood updated!'}
          />
        )}
      </div>
    );
  }

  // Full input view (for first entry or adding new)
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

      {/* Back button if adding new entry */}
      {showAddNew && hasAnyEntryToday && (
        <button
          onClick={() => setShowAddNew(false)}
          className="relative text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
        >
          ← {t.back || 'Back'}
        </button>
      )}

      {/* Primary CTA Header - More prominent */}
      {isPrimaryCTA && !showAddNew && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/25 rounded-full border border-primary/30 animate-glow-pulse">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-primary">{t.startHere || 'Start here'}</span>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
      )}

      {/* Current time indicator */}
      {showAddNew && (
        <div className="relative flex items-center justify-center gap-2 mb-3">
          {(() => {
            const CurrentTimeIcon = timeIcons[currentTimeOfDay];
            return (
              <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
                <CurrentTimeIcon className="w-4 h-4 text-primary" />
                <span className="text-xs font-medium text-foreground">{timeLabels[currentTimeOfDay]}</span>
              </div>
            );
          })()}
        </div>
      )}

      <h3 className={cn(
        "font-semibold text-foreground mb-4 relative",
        isPrimaryCTA ? "text-xl text-center" : "text-lg text-center"
      )}>
        {showAddNew ? (t.howAreYouNow || 'How are you now?') : t.howAreYouFeeling}
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
              "mood-btn flex flex-col items-center gap-2 p-3 rounded-xl transition-all relative",
              selectedMood === mood.type
                ? `${mood.color} bg-opacity-20 scale-110 zen-shadow-soft selected ring-2 ring-primary/50`
                : "hover:bg-secondary/80 hover:scale-105"
            )}
            style={isPrimaryCTA && !selectedMood ? { animationDelay: `${index * 150}ms` } : undefined}
          >
            <AnimatedMoodEmoji
              mood={mood.type}
              size={isPrimaryCTA ? "xl" : "lg"}
              isSelected={selectedMood === mood.type}
            />
            <span className={cn(
              "text-xs font-medium",
              selectedMood === mood.type ? "text-foreground" : "text-muted-foreground"
            )}>{mood.label}</span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="animate-slide-up relative">
          <textarea
            value={note}
            onChange={(e) => setNote(e.target.value)}
            placeholder={t.addNote}
            className="w-full p-4 bg-secondary rounded-xl text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
            rows={2}
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
        <p className="text-center text-sm text-muted-foreground mt-2 animate-fade-in relative">
          {t.tapToStart || 'Tap an emoji to start your day'}
        </p>
      )}

      {/* Mood Selection Celebration */}
      {showCelebration && celebrationData && (
        <MoodSelectionCelebration
          mood={celebrationData.mood}
          note={celebrationData.note}
          timeOfDay={celebrationData.timeOfDay}
          xpGained={5}
          onComplete={() => {
            setShowCelebration(false);
            setCelebrationData(null);
          }}
        />
      )}
    </div>
  );
}
