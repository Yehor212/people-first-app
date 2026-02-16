import { useState, useCallback } from 'react';
import type { MoodType, MoodEntry } from '@/types';
import type { ConfirmChangePayload, MoodConfig } from './types';
import { validateNote } from './types';

interface UseMoodEditOptions {
  onUpdateEntry?: (entryId: string, mood: MoodType, note?: string) => void;
  onEditConfirmed?: (emoji: string) => void;
  moods: MoodConfig[];
}

interface UseMoodEditReturn {
  editingEntryId: string | null;
  editingMood: MoodType | null;
  editingNote: string;
  setEditingNote: (note: string) => void;
  confirmChange: ConfirmChangePayload | null;
  handleStartEdit: (entry: MoodEntry) => void;
  handleEditMoodSelect: (entry: MoodEntry, newMood: MoodType) => void;
  handleSaveEdit: (entry: MoodEntry) => void;
  confirmMoodChange: () => void;
  cancelMoodChange: () => void;
  cancelEdit: () => void;
}

export function useMoodEdit({ onUpdateEntry, onEditConfirmed, moods }: UseMoodEditOptions): UseMoodEditReturn {
  const [editingEntryId, setEditingEntryId] = useState<string | null>(null);
  const [editingMood, setEditingMood] = useState<MoodType | null>(null);
  const [editingNote, setEditingNote] = useState('');
  const [confirmChange, setConfirmChange] = useState<ConfirmChangePayload | null>(null);

  const handleStartEdit = useCallback((entry: MoodEntry) => {
    setEditingEntryId(entry.id);
    setEditingMood(entry.mood);
    setEditingNote(entry.note || '');
  }, []);

  const handleEditMoodSelect = useCallback((_entry: MoodEntry, newMood: MoodType) => {
    setEditingMood(newMood);
  }, []);

  const handleSaveEdit = useCallback((entry: MoodEntry) => {
    const moodChanged = editingMood && editingMood !== entry.mood;
    const noteChanged = editingNote !== (entry.note || '');

    if (!moodChanged && !noteChanged) {
      setEditingEntryId(null);
      setEditingMood(null);
      setEditingNote('');
      return;
    }

    const sanitizedNote = validateNote(editingNote);
    if (sanitizedNote === null) return; // invalid

    setConfirmChange({
      entryId: entry.id,
      newMood: editingMood || entry.mood,
      oldMood: entry.mood,
      newNote: sanitizedNote,
    });
  }, [editingMood, editingNote]);

  const confirmMoodChange = useCallback(() => {
    if (!confirmChange || !onUpdateEntry) return;

    const { entryId, newMood, newNote } = confirmChange;
    onUpdateEntry(entryId, newMood, newNote);

    const newMoodData = moods.find(m => m.type === newMood);
    if (onEditConfirmed) {
      onEditConfirmed(newMoodData?.emoji || '');
    }

    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
    setEditingNote('');
  }, [confirmChange, onUpdateEntry, onEditConfirmed, moods]);

  const cancelMoodChange = useCallback(() => {
    setConfirmChange(null);
    setEditingEntryId(null);
    setEditingMood(null);
    setEditingNote('');
  }, []);

  const cancelEdit = useCallback(() => {
    setEditingEntryId(null);
    setEditingMood(null);
    setEditingNote('');
  }, []);

  return {
    editingEntryId, editingMood, editingNote, setEditingNote,
    confirmChange,
    handleStartEdit, handleEditMoodSelect, handleSaveEdit,
    confirmMoodChange, cancelMoodChange, cancelEdit,
  };
}
