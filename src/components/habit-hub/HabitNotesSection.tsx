/**
 * HabitNotesSection — Per-date notes viewer/editor for a habit.
 * Shows recent notes, allows adding/editing today's note.
 * Reads notes from entries[date].notes (new model).
 * Deep Space aesthetic.
 */

import { useState, useCallback, useMemo } from 'react';
import { MessageSquarePlus, ChevronDown } from 'lucide-react';
import { cn, getToday } from '@/lib/utils';
import { getEntryNote, getDatesWithNotes } from '@/lib/habits';
import { useLanguage } from '@/contexts/LanguageContext';
import type { Habit } from '@/types';

interface HabitNotesSectionProps {
  habit: Habit;
  onUpdate: (habit: Habit) => void;
}

const MAX_VISIBLE = 5;

export function HabitNotesSection({ habit, onUpdate }: HabitNotesSectionProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const today = getToday();

  const todayNote = getEntryNote(habit, today) ?? '';
  const [isEditing, setIsEditing] = useState(false);
  const [noteText, setNoteText] = useState(todayNote);
  const [showAll, setShowAll] = useState(false);

  const sortedNotes = useMemo(() => getDatesWithNotes(habit), [habit]);

  const visibleNotes = showAll ? sortedNotes : sortedNotes.slice(0, MAX_VISIBLE);

  const handleSave = useCallback(() => {
    const trimmed = noteText.trim();
    const entries = { ...habit.entries };

    if (entries[today]) {
      if (trimmed) {
        entries[today] = { ...entries[today], notes: trimmed };
      } else {
        const { notes: _, ...rest } = entries[today];
        entries[today] = rest;
      }
    } else if (trimmed) {
      entries[today] = { value: -1, notes: trimmed };
    }

    onUpdate({ ...habit, entries });
    setIsEditing(false);
  }, [habit, noteText, today, onUpdate]);

  const handleCancel = useCallback(() => {
    setNoteText(getEntryNote(habit, today) ?? '');
    setIsEditing(false);
  }, [habit, today]);

  const todayHasNote = !!todayNote;

  return (
    <div>
      <div className="flex items-center justify-between mb-2">
        <label className="text-xs font-medium text-slate-500">
          {ts.habitNotes || 'Notes'}
        </label>
        {!isEditing && (
          <button
            onClick={() => { setNoteText(getEntryNote(habit, today) ?? ''); setIsEditing(true); }}
            className="flex items-center gap-1 text-[10px] text-violet-400 hover:text-violet-300 transition-colors"
          >
            <MessageSquarePlus className="w-3 h-3" />
            {todayHasNote ? (ts.editNote || 'Edit') : (ts.addNote || 'Add note')}
          </button>
        )}
      </div>

      {/* Inline editor */}
      {isEditing && (
        <div className="mb-3 space-y-2">
          <textarea
            value={noteText}
            onChange={(e) => setNoteText(e.target.value)}
            placeholder={ts.notePrompt || 'How did it go today?'}
            autoFocus
            rows={2}
            className={cn(
              'w-full px-3 py-2 rounded-xl text-sm text-slate-100 resize-none',
              'bg-white/[0.05] border border-white/[0.08]',
              'placeholder:text-slate-600',
              'focus:outline-none focus:ring-2 focus:ring-violet-500/50',
            )}
          />
          <div className="flex gap-2">
            <button
              onClick={handleCancel}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs text-slate-400 bg-white/[0.05] border border-white/[0.08]"
            >
              {ts.cancel || 'Cancel'}
            </button>
            <button
              onClick={handleSave}
              className="flex-1 px-3 py-1.5 rounded-lg text-xs text-white bg-violet-600 hover:bg-violet-500"
            >
              {ts.save || 'Save'}
            </button>
          </div>
        </div>
      )}

      {/* Notes list */}
      {sortedNotes.length > 0 ? (
        <div className="space-y-1.5">
          {visibleNotes.map(({ date, notes }) => (
            <div
              key={date}
              className={cn(
                'px-3 py-2 rounded-xl text-xs',
                'bg-white/[0.02] border border-white/[0.04]',
              )}
            >
              <span className="text-slate-500 tabular-nums">{date}</span>
              <p className="text-slate-300 mt-0.5 leading-relaxed">{notes}</p>
            </div>
          ))}

          {sortedNotes.length > MAX_VISIBLE && !showAll && (
            <button
              onClick={() => setShowAll(true)}
              className="flex items-center gap-1 text-[10px] text-slate-500 hover:text-slate-400 mx-auto"
            >
              <ChevronDown className="w-3 h-3" />
              {ts.showAll || `Show all (${sortedNotes.length})`}
            </button>
          )}
        </div>
      ) : !isEditing ? (
        <p className="text-[10px] text-slate-600 text-center py-2">
          {ts.noNotes || 'No notes yet'}
        </p>
      ) : null}
    </div>
  );
}
