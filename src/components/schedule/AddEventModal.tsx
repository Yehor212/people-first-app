import { useState } from 'react';
import { motion } from 'framer-motion';
import { X, Check, Sparkles } from 'lucide-react';
import { ScheduleEvent } from '@/types';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';
import { parseLocalDate, getToday, formatDate } from '@/lib/utils';
import { safeParseInt } from '@/lib/validation';
import { ParticleBackground } from '@/components/stats';
import { EVENT_PRESETS, getEventColor, getEventGradient, HOURS } from './constants';

// Premium Add Event Modal
export function AddEventModal({
  selectedDate: initialDate,
  allDates,
  onClose,
  onAdd,
}: {
  selectedDate: string;
  allDates: string[];
  onClose: () => void;
  onAdd: (event: Omit<ScheduleEvent, 'id'>) => void;
}) {
  const { t, language } = useLanguage();
  const [selectedPreset, setSelectedPreset] = useState(EVENT_PRESETS[0]);
  const [eventDate, setEventDate] = useState(initialDate);
  const [time, setTime] = useState({ startHour: 9, startMinute: 0, endHour: 10, endMinute: 0 });
  const [customTitle, setCustomTitle] = useState('');
  const [note, setNote] = useState('');

  const formatDateOption = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    const today = getToday();
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return formatDate(d);
    })();

    if (dateStr === today) return t.today || 'Today';
    if (dateStr === tomorrow) return t.tomorrow || 'Tomorrow';

    return date.toLocaleDateString(language, { weekday: 'short', day: 'numeric', month: 'short' });
  };

  const handleAdd = () => {
    const title = customTitle || (t[selectedPreset.labelKey as keyof typeof t]) || selectedPreset.id;
    let finalEndHour = time.endHour;
    let finalEndMinute = time.endMinute;
    const startTotal = time.startHour * 60 + time.startMinute;
    const endTotal = time.endHour * 60 + time.endMinute;
    if (endTotal <= startTotal) {
      finalEndHour = Math.min(time.startHour + 1, 23);
      finalEndMinute = time.startHour >= 23 ? 59 : time.startMinute;
    }
    onAdd({
      title,
      startHour: time.startHour,
      startMinute: time.startMinute,
      endHour: finalEndHour,
      endMinute: finalEndMinute,
      colorVar: selectedPreset.colorVar,
      color: getEventColor(selectedPreset.colorVar),
      emoji: selectedPreset.emoji,
      date: eventDate,
      note: note.trim() || undefined,
    });
  };

  return (
    <motion.div
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
      className="fixed inset-0 flex items-end sm:items-center justify-center p-4"
      style={{ zIndex: 'var(--z-overlay)', marginBottom: 'var(--nav-height)' }}
      initial={{ opacity: 0 }}
      animate={{ opacity: 1 }}
      exit={{ opacity: 0 }}
    >
      {/* Backdrop */}
      <motion.div
        className="absolute inset-0 bg-black/60 backdrop-blur-sm"
        onClick={onClose}
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        exit={{ opacity: 0 }}
      />

      {/* Modal content */}
      <motion.div
        className="relative w-full max-w-sm rounded-3xl overflow-hidden max-h-[90dvh] overflow-y-auto"
        style={{ paddingBottom: 'calc(var(--nav-height) + var(--safe-bottom))' }}
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
      >
        {/* Cosmic background - Theme-aware */}
        <div className="absolute inset-0 bg-gradient-to-br from-slate-50 via-violet-50 to-indigo-50 dark:bg-none" />
        <div
          className="absolute inset-0 hidden dark:block"
          style={{
            background: `linear-gradient(135deg,
              #0f0f23 0%,
              #1a1a3e 50%,
              #2d1b4e 100%)`,
          }}
        />

        <ParticleBackground count={10} color="purple" />

        {/* Content */}
        <div className="relative z-10 p-5">
          <div className="flex items-center justify-between mb-4">
            <h3 id="add-event-title" className="text-lg font-bold text-slate-800 dark:text-white flex items-center gap-2">
              <Sparkles className="w-5 h-5 text-purple-600 dark:text-purple-400" />
              {t.scheduleAddEvent || 'Add Event'}
            </h3>
            <motion.button
              onClick={onClose}
              whileHover={{ scale: 1.1 }}
              whileTap={{ scale: 0.9 }}
              className="p-2 hover:bg-secondary rounded-xl transition-colors"
              aria-label={t.close || 'Close'}
            >
              <X className="w-5 h-5 text-slate-600 dark:text-white/80" />
            </motion.button>
          </div>

          {/* Date picker */}
          <div className="mb-4">
            <label className="text-xs text-slate-600 dark:text-white/60 mb-1 block">{t.scheduleDate || 'Date'}</label>
            <select
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full p-3 bg-secondary backdrop-blur-sm rounded-xl text-sm text-slate-800 dark:text-white border border-border focus:border-primary/50 focus:outline-none"
            >
              {allDates.map((date) => (
                <option key={date} value={date} className="bg-white dark:bg-slate-900 text-foreground">{formatDateOption(date)}</option>
              ))}
            </select>
          </div>

          {/* Event type presets - 3D cards */}
          <div className="grid grid-cols-3 gap-2 mb-4" role="group" aria-label={t.scheduleEventType || 'Event type'}>
            {EVENT_PRESETS.map((preset) => {
              const label = (t[preset.labelKey as keyof typeof t]) || preset.id;
              const isSelected = selectedPreset.id === preset.id;
              const gradient = getEventGradient(preset.colorVar);

              return (
                <motion.button
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset)}
                  whileHover={{ scale: 1.05, rotateY: 5 }}
                  whileTap={{ scale: 0.95 }}
                  aria-pressed={isSelected}
                  aria-label={label}
                  className={cn(
                    "p-3 rounded-xl flex flex-col items-center gap-1 transition-all",
                    "backdrop-blur-sm border",
                    isSelected
                      ? `bg-gradient-to-br ${gradient} border-white/30 shadow-lg`
                      : "bg-muted border-border hover:bg-secondary"
                  )}
                >
                  <motion.span
                    className="text-2xl"
                    animate={isSelected ? { scale: [1, 1.2, 1] } : {}}
                    transition={{ duration: 0.5 }}
                    style={isSelected ? { filter: 'drop-shadow(0 0 8px rgba(255, 255, 255, 0.5))' } : {}}
                  >
                    {preset.emoji}
                  </motion.span>
                  <span className="text-xs text-slate-600 dark:text-white/80">{label}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Custom title */}
          <input
            type="text"
            value={customTitle}
            onChange={(e) => setCustomTitle(e.target.value)}
            placeholder={t.scheduleCustomTitle || 'Custom title (optional)'}
            className="w-full p-3 bg-secondary backdrop-blur-sm rounded-xl text-sm text-slate-800 dark:text-white border border-border focus:border-primary/50 focus:outline-none mb-4 placeholder:text-slate-400 dark:placeholder:text-white/40"
            onFocus={(e) => { const el = e.target; setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
          />

          {/* Time pickers */}
          <div className="flex items-center gap-3 mb-4">
            <div className="flex-1">
              <label className="text-xs text-slate-600 dark:text-white/60 mb-1 block">{t.scheduleStart || 'Start'}</label>
              <div className="flex gap-1">
                <select
                  value={time.startHour}
                  onChange={(e) => setTime(prev => ({ ...prev, startHour: safeParseInt(e.target.value, 9, 0, 23) }))}
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-slate-900 text-foreground">{h.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={time.startMinute}
                  onChange={(e) => setTime(prev => ({ ...prev, startMinute: safeParseInt(e.target.value, 0, 0, 59) }))}
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m} className="bg-white dark:bg-slate-900 text-foreground">{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
            <div className="flex-1">
              <label className="text-xs text-slate-600 dark:text-white/60 mb-1 block">{t.scheduleEnd || 'End'}</label>
              <div className="flex gap-1">
                <select
                  value={time.endHour}
                  onChange={(e) => setTime(prev => ({ ...prev, endHour: safeParseInt(e.target.value, 10, 0, 23) }))}
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                >
                  {HOURS.map((h) => (
                    <option key={h} value={h} className="bg-white dark:bg-slate-900 text-foreground">{h.toString().padStart(2, '0')}</option>
                  ))}
                </select>
                <select
                  value={time.endMinute}
                  onChange={(e) => setTime(prev => ({ ...prev, endMinute: safeParseInt(e.target.value, 0, 0, 59) }))}
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option key={m} value={m} className="bg-white dark:bg-slate-900 text-foreground">{m.toString().padStart(2, '0')}</option>
                  ))}
                </select>
              </div>
            </div>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label className="text-xs text-slate-600 dark:text-white/60 mb-1 block">{t.scheduleNote || 'Note (optional)'}</label>
            <textarea
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.scheduleNotePlaceholder || 'Add details or reminders...'}
              className="w-full p-3 bg-secondary backdrop-blur-sm rounded-xl text-sm text-slate-800 dark:text-white border border-border focus:border-primary/50 focus:outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-white/40"
              rows={2}
              onFocus={(e) => { const el = e.target; setTimeout(() => el.scrollIntoView({ behavior: 'smooth', block: 'center' }), 300); }}
            />
          </div>

          {/* Add button */}
          <motion.button
            onClick={handleAdd}
            whileHover={{ scale: 1.02 }}
            whileTap={{ scale: 0.98 }}
            className="w-full py-4 bg-gradient-to-r from-primary to-accent text-white rounded-xl font-bold flex items-center justify-center gap-2 shadow-lg shadow-primary/30"
          >
            <Check className="w-5 h-5" />
            {t.addToMyWorld}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );
}
