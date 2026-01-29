import { useState, useMemo, useRef, useEffect, useCallback } from 'react';
import { MoodType, MoodEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { logger } from '@/lib/logger';
import { useLanguage } from '@/contexts/LanguageContext';
import { getLocale } from '@/lib/timeUtils';
import { moodNoteSchema, sanitizeString } from '@/lib/validation';
import { Sparkles, Sun, Cloud, Moon, Plus, ChevronDown, Edit3 } from 'lucide-react';
import { MoodChangedToast, ConfirmDialog } from './Celebrations';
import { AnimatedMoodEmoji } from './AnimatedMoodEmoji';
import { MoodSelectionCelebration } from './MoodSelectionCelebration';
import { triggerFlyingEmoji } from './FlyingMoodEmoji';

interface MoodTrackerProps {
  entries: MoodEntry[];
  onAddEntry: (entry: MoodEntry) => void;
  onUpdateEntry?: (entryId: string, mood: MoodType, note?: string) => void;
  isPrimaryCTA?: boolean;
}

type TimeOfDay = 'morning' | 'afternoon' | 'evening';

// Get current time of day based on user's local time
// Morning: 00:00-11:59, Afternoon: 12:00-17:59, Evening: 18:00-23:59
function getCurrentTimeOfDay(): TimeOfDay {
  const hour = new Date().getHours();
  if (hour >= 0 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

// Get time of day from timestamp
// Morning: 00:00-11:59, Afternoon: 12:00-17:59, Evening: 18:00-23:59
function getTimeOfDayFromTimestamp(timestamp: number): TimeOfDay {
  const hour = new Date(timestamp).getHours();
  if (hour >= 0 && hour < 12) return 'morning';
  if (hour >= 12 && hour < 18) return 'afternoon';
  return 'evening';
}

export function MoodTracker({ entries, onAddEntry, onUpdateEntry, isPrimaryCTA = false }: MoodTrackerProps) {
  const { t, language } = useLanguage();
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  const [isExpanded, setIsExpanded] = useState(false);
  const [showAddNew, setShowAddNew] = useState(false);

  // Edit mode state
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingMood, setEditingMood] = useState<MoodType | null>(null);
  const [editingNote, setEditingNote] = useState<string>('');
  const [showMoodChangedToast, setShowMoodChangedToast] = useState(false);
  const [changedMoodEmoji, setChangedMoodEmoji] = useState<string>('');
  const [confirmChange, setConfirmChange] = useState<{
    entryId: string;
    newMood: MoodType;
    oldMood: MoodType;
    newNote?: string;
  } | null>(null);

  // Celebration state
  const [showCelebration, setShowCelebration] = useState(false);
  const [celebrationData, setCelebrationData] = useState<{
    mood: MoodType;
    note?: string;
    timeOfDay: 'morning' | 'afternoon' | 'evening';
  } | null>(null);

  // P0 Fix: Track mounted state to prevent memory leaks
  const mountedRef = useRef(true);
  const toastTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  useEffect(() => {
    mountedRef.current = true;
    return () => {
      mountedRef.current = false;
      if (toastTimeoutRef.current) {
        clearTimeout(toastTimeoutRef.current);
      }
    };
  }, []);

  // Ref to track selected mood button for flying animation
  const moodButtonRefs = useRef<Record<MoodType, HTMLButtonElement | null>>({
    great: null,
    good: null,
    okay: null,
    bad: null,
    terrible: null,
  });

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

  // Track current date with state to detect midnight changes
  const [today, setToday] = useState(getToday());
  const [currentTimeOfDay, setCurrentTimeOfDay] = useState(getCurrentTimeOfDay());

  // Check for date/time changes (midnight reset for mood selection)
  useEffect(() => {
    const checkDateChange = () => {
      const newDate = getToday();
      const newTimeOfDay = getCurrentTimeOfDay();

      // Always update if different - compare fresh values, not closure
      setToday(prev => {
        if (prev !== newDate) {
          logger.log('[MoodTracker] Date changed:', prev, '->', newDate);
          return newDate;
        }
        return prev;
      });

      setCurrentTimeOfDay(prev => {
        if (prev !== newTimeOfDay) {
          return newTimeOfDay;
        }
        return prev;
      });
    };

    // IMPORTANT: Check immediately on mount/effect run
    checkDateChange();

    // Check every minute
    const interval = setInterval(checkDateChange, 60000);

    // Check on window focus (when user returns to app)
    const handleFocus = () => checkDateChange();
    window.addEventListener('focus', handleFocus);

    // Check on visibility change (when tab becomes visible)
    const handleVisibility = () => {
      if (document.visibilityState === 'visible') {
        checkDateChange();
      }
    };
    document.addEventListener('visibilitychange', handleVisibility);

    return () => {
      clearInterval(interval);
      window.removeEventListener('focus', handleFocus);
      document.removeEventListener('visibilitychange', handleVisibility);
    };
  }, []); // Empty deps - effect runs once on mount, interval handles updates

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

    // Validate and sanitize note to prevent XSS
    let sanitizedNote: string | undefined;
    const trimmedNote = note.trim();
    if (trimmedNote) {
      const validationResult = moodNoteSchema.safeParse(trimmedNote);
      if (!validationResult.success) {
        logger.warn('[MoodTracker] Invalid note:', validationResult.error.message);
        return;
      }
      sanitizedNote = sanitizeString(validationResult.data);
    }

    // Trigger flying emoji animation
    const moodData = moods.find(m => m.type === selectedMood);
    const buttonRef = moodButtonRefs.current[selectedMood];
    if (moodData && buttonRef) {
      const rect = buttonRef.getBoundingClientRect();
      triggerFlyingEmoji(moodData.emoji, {
        x: rect.left + rect.width / 2,
        y: rect.top + rect.height / 2,
      });
    }

    const entry: MoodEntry = {
      id: generateId(),
      mood: selectedMood,
      note: sanitizedNote,
      date: today,
      timestamp: Date.now(),
    };

    // Show celebration first
    setCelebrationData({
      mood: selectedMood,
      note: sanitizedNote,
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
  const handleStartEdit = useCallback((entry: MoodEntry) => {
    setEditingEntryId(entry.id);
    setEditingMood(entry.mood);
    setEditingNote(entry.note || '');
  }, []);

  // Handle selecting a new mood during edit
  const handleEditMoodSelect = useCallback((_entry: MoodEntry, newMood: MoodType) => {
    setEditingMood(newMood);
  }, []);

  // Handle saving the edit (mood + note)
  const handleSaveEdit = (entry: MoodEntry) => {
    const moodChanged = editingMood && editingMood !== entry.mood;
    const noteChanged = editingNote !== (entry.note || '');

    if (!moodChanged && !noteChanged) {
      // Nothing changed, just close
      setEditingEntryId(null);
      setEditingMood(null);
      setEditingNote('');
      return;
    }

    // Validate and sanitize note to prevent XSS
    let sanitizedNote: string | undefined;
    const trimmedNote = editingNote.trim();
    if (trimmedNote) {
      const validationResult = moodNoteSchema.safeParse(trimmedNote);
      if (!validationResult.success) {
        logger.warn('[MoodTracker] Invalid edit note:', validationResult.error.message);
        return;
      }
      sanitizedNote = sanitizeString(validationResult.data);
    }

    // Show confirmation dialog
    setConfirmChange({
      entryId: entry.id,
      newMood: editingMood || entry.mood,
      oldMood: entry.mood,
      newNote: sanitizedNote,
    });
  };

  // Confirm and apply mood change
  const confirmMoodChange = useCallback(() => {
    if (!confirmChange || !onUpdateEntry) return;

    const { entryId, newMood, newNote } = confirmChange;

    onUpdateEntry(entryId, newMood, newNote);

    // Show success toast
    const newMoodData = moods.find(m => m.type === newMood);
    setChangedMoodEmoji(newMoodData?.emoji || '');
    setShowMoodChangedToast(true);
    // P0 Fix: Store timeout ref and check mounted before state update
    toastTimeoutRef.current = setTimeout(() => {
      if (mountedRef.current) {
        setShowMoodChangedToast(false);
      }
    }, 2500);

    // Reset state
    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
    setEditingNote('');
  }, [confirmChange, onUpdateEntry, moods]);

  // Cancel mood change
  const cancelMoodChange = useCallback(() => {
    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
    setEditingNote('');
  }, []);

  // Show full input view (mood icons) when current time period has no entry
  // This ensures fresh mood selection at start of each time period (morning/afternoon/evening)
  // Compact view only when current period is already recorded
  if (hasAnyEntryToday && !canAddForCurrentTime && !showAddNew) {
    const latestEntry = todayEntries[todayEntries.length - 1];
    const latestMood = moods.find(m => m.type === latestEntry.mood);
    const latestTimeOfDay = getTimeOfDayFromTimestamp(latestEntry.timestamp);
    const LatestTimeIcon = timeIcons[latestTimeOfDay];

    return (
      <div className="bg-card rounded-2xl p-5 zen-shadow-card animate-fade-in">
        {/* Header with expand toggle */}
        <div
          role="button"
          tabIndex={0}
          className="flex items-center justify-between cursor-pointer"
          onClick={() => setIsExpanded(!isExpanded)}
          onKeyDown={(e) => { if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); setIsExpanded(!isExpanded); } }}
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
            "w-14 h-14 rounded-full flex items-center justify-center",
            latestMood?.color, "bg-opacity-20"
          )}>
            {latestMood && <AnimatedMoodEmoji mood={latestMood.type} size="lg" />}
          </div>
          <div className="flex-1 min-w-0">
            <div className="flex items-center gap-2">
              <LatestTimeIcon className="w-4 h-4 text-muted-foreground" />
              <p className="font-medium text-foreground truncate">{latestMood?.label}</p>
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
              const time = new Date(entry.timestamp).toLocaleTimeString(getLocale(language), { hour: '2-digit', minute: '2-digit' });
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
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        entryMood?.color, "bg-opacity-20"
                      )}>
                        {entryMood && <AnimatedMoodEmoji mood={entryMood.type} size="md" />}
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
                    <div className="animate-fade-in space-y-3">
                      <div className="flex items-center gap-2">
                        <TimeIcon className="w-3.5 h-3.5 text-primary" />
                        <span className="text-sm font-medium text-primary">{t.editMood || 'Edit entry'}</span>
                        <button
                          onClick={() => {
                            setEditingEntryId(null);
                            setEditingMood(null);
                            setEditingNote('');
                          }}
                          className="ml-auto text-xs text-muted-foreground hover:text-foreground"
                        >
                          {t.cancel || 'Cancel'}
                        </button>
                      </div>

                      {/* Mood selection */}
                      <div className="flex justify-between gap-1">
                        {moods.map((mood) => (
                          <button
                            key={mood.type}
                            onClick={() => handleEditMoodSelect(entry, mood.type)}
                            className={cn(
                              "flex-1 p-2 rounded-lg transition-all",
                              editingMood === mood.type
                                ? `${mood.color} bg-opacity-30 scale-105`
                                : "hover:bg-secondary hover:scale-105"
                            )}
                          >
                            <span className="text-xl">{mood.emoji}</span>
                          </button>
                        ))}
                      </div>

                      {/* Note input */}
                      <textarea
                        value={editingNote}
                        onChange={(e) => setEditingNote(e.target.value)}
                        placeholder={t.addNote || 'Add a note...'}
                        className="w-full p-2 bg-background/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                        rows={2}
                      />

                      {/* Save button */}
                      <button
                        onClick={() => handleSaveEdit(entry)}
                        className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
                      >
                        {t.save || 'Save'}
                      </button>
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
                  {hasEntry && entryMood ? (
                    <AnimatedMoodEmoji mood={entryMood.type} size="sm" />
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

      {/* Current time indicator - always show which time period we're recording for */}
      {!isPrimaryCTA && (
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

      <div
        role="radiogroup"
        aria-label={t.selectMood || 'Select your mood'}
        className={cn(
          "flex justify-center gap-2 sm:gap-4 mb-6 relative flex-wrap",
          isPrimaryCTA && "bg-card/50 rounded-2xl p-3 -mx-2"
        )}
      >
        {moods.map((mood, index) => (
          <button
            key={mood.type}
            ref={(el) => { moodButtonRefs.current[mood.type] = el; }}
            onClick={() => setSelectedMood(mood.type)}
            role="radio"
            aria-checked={selectedMood === mood.type}
            aria-label={mood.label}
            tabIndex={selectedMood === mood.type || (!selectedMood && index === 0) ? 0 : -1}
            className={cn(
              "mood-btn flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl transition-all relative min-w-[56px] min-h-[56px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
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
            aria-label={t.addNote || 'Add a note about your mood'}
            className="w-full p-4 bg-secondary rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 transition-all"
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
