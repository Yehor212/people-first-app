/**
 * MoodTracker — mood entry orchestrator
 * Decomposed from the original 712-line monolith (TD-20).
 * This file: ~180L, 4 useState, delegates state to 3 custom hooks.
 */

import { useState, useMemo, useRef } from 'react';
import type { MoodType, MoodEntry } from '@/types';
import { getToday, generateId } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { triggerFlyingEmoji } from '@/components/FlyingMoodEmoji';

import type { MoodTrackerProps } from './types';
import { MOOD_CONFIGS, getTimeOfDayFromTimestamp, validateNote } from './types';
import { useDateTimeTracking } from './useDateTimeTracking';
import { useMoodEdit } from './useMoodEdit';
import { useMoodFeedback } from './useMoodFeedback';
import { MoodCompactView } from './MoodCompactView';
import { MoodInputView } from './MoodInputView';

export function MoodTracker({ entries, onAddEntry, onUpdateEntry, isPrimaryCTA = false }: MoodTrackerProps) {
  const { t, language } = useLanguage();

  // --- Orchestrator-owned state (4 useState) ---
  const [selectedMood, setSelectedMood] = useState<MoodType | null>(null);
  const [note, setNote] = useState('');
  const [showAddNew, setShowAddNew] = useState(false);
  const [isExpanded, setIsExpanded] = useState(false);

  const moodButtonRefs = useRef<Record<MoodType, HTMLButtonElement | null>>({
    great: null, good: null, okay: null, bad: null, terrible: null,
  });

  // --- Hooks ---
  const dateTime = useDateTimeTracking();
  const feedback = useMoodFeedback();
  const edit = useMoodEdit({
    onUpdateEntry,
    moods: MOOD_CONFIGS,
    onEditConfirmed: (emoji: string) => feedback.triggerToast(emoji),
  });

  // Resolve translated labels
  const tRecord = t as unknown as Record<string, string>;

  const moods = useMemo(() =>
    MOOD_CONFIGS.map(m => ({ ...m, label: tRecord[m.labelKey] || m.labelKey })),
    [tRecord],
  );

  const timeLabels = useMemo(() => ({
    morning: tRecord.morning || 'Morning',
    afternoon: tRecord.afternoon || 'Afternoon',
    evening: tRecord.evening || 'Evening',
  }), [tRecord]);

  // Derived data
  const todayEntries = useMemo(() =>
    entries
      .filter(e => e.date === dateTime.today)
      .sort((a, b) => a.timestamp - b.timestamp),
    [entries, dateTime.today],
  );

  const entryByTime = useMemo(() => {
    const result: Partial<Record<'morning' | 'afternoon' | 'evening', MoodEntry>> = {};
    todayEntries.forEach(entry => {
      const tod = getTimeOfDayFromTimestamp(entry.timestamp);
      result[tod] = entry;
    });
    return result;
  }, [todayEntries]);

  const canAddForCurrentTime = !entryByTime[dateTime.currentTimeOfDay];
  const hasAnyEntryToday = todayEntries.length > 0;

  // --- Submit handler ---
  const handleSubmit = () => {
    if (!selectedMood) return;

    const sanitizedNote = validateNote(note);
    if (sanitizedNote === null) return; // invalid

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
      date: dateTime.today,
      timestamp: Date.now(),
    };

    // Show celebration
    feedback.triggerCelebration({
      mood: selectedMood,
      note: sanitizedNote,
      timeOfDay: dateTime.currentTimeOfDay,
    });

    onAddEntry(entry);
    setSelectedMood(null);
    setNote('');
    setShowAddNew(false);
  };

  const throttledSubmit = useThrottledCallback(handleSubmit, 1000);

  // --- Branching render ---
  if (hasAnyEntryToday && !canAddForCurrentTime && !showAddNew) {
    return (
      <MoodCompactView
        todayEntries={todayEntries}
        entryByTime={entryByTime}
        currentTimeOfDay={dateTime.currentTimeOfDay}
        canAddForCurrentTime={canAddForCurrentTime}
        moods={moods}
        timeLabels={timeLabels}
        language={language}
        t={tRecord}
        isExpanded={isExpanded}
        onToggleExpanded={() => setIsExpanded(prev => !prev)}
        editingEntryId={edit.editingEntryId}
        editingMood={edit.editingMood}
        editingNote={edit.editingNote}
        setEditingNote={edit.setEditingNote}
        confirmChange={edit.confirmChange}
        handleStartEdit={edit.handleStartEdit}
        handleEditMoodSelect={edit.handleEditMoodSelect}
        handleSaveEdit={edit.handleSaveEdit}
        confirmMoodChange={edit.confirmMoodChange}
        cancelMoodChange={edit.cancelMoodChange}
        cancelEdit={edit.cancelEdit}
        showMoodChangedToast={feedback.showMoodChangedToast}
        changedMoodEmoji={feedback.changedMoodEmoji}
        onShowAddNew={() => setShowAddNew(true)}
        onExpandAndEdit={(entry: MoodEntry) => {
          edit.handleStartEdit(entry);
          setIsExpanded(true);
        }}
        onUpdateEntry={onUpdateEntry}
      />
    );
  }

  return (
    <MoodInputView
      moods={moods}
      timeLabels={timeLabels}
      currentTimeOfDay={dateTime.currentTimeOfDay}
      isPrimaryCTA={isPrimaryCTA}
      hasAnyEntryToday={hasAnyEntryToday}
      t={tRecord}
      selectedMood={selectedMood}
      onSelectMood={setSelectedMood}
      note={note}
      onNoteChange={setNote}
      onSubmit={throttledSubmit}
      showAddNew={showAddNew}
      onBack={() => setShowAddNew(false)}
      moodButtonRefs={moodButtonRefs}
      showCelebration={feedback.showCelebration}
      celebrationData={feedback.celebrationData}
      onCelebrationComplete={feedback.dismissCelebration}
    />
  );
}
