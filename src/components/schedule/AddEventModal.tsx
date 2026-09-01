import { useState, useCallback } from "react";
import { createPortal } from "react-dom";
import { motion } from "framer-motion";
import { X, Check } from "lucide-react";
import { ScheduleEvent } from "@/types";
import { useLanguage } from "@/contexts/LanguageContext";
import { cn } from "@/lib/utils";
import { shouldAnimate, zenTap } from "@/lib/animationUtils";
import { parseLocalDate, getToday, formatDate } from "@/lib/utils";
import { safeParseInt } from "@/lib/validation";
import { useModalA11y } from "@/hooks/useModalA11y";
import { EVENT_PRESETS, getEventColor, HOURS } from "./constants";
import { formatScheduleNumericPart } from "./scheduleFormatting";

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
  onAdd: (event: Omit<ScheduleEvent, "id">) => void;
}) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const { modalRef, handleKeyDown } = useModalA11y(true, onClose);
  const [selectedPreset, setSelectedPreset] = useState(EVENT_PRESETS[0]);
  const [eventDate, setEventDate] = useState(initialDate);
  const [time, setTime] = useState({
    startHour: 9,
    startMinute: 0,
    endHour: 10,
    endMinute: 0,
  });
  const [customTitle, setCustomTitle] = useState("");
  const [note, setNote] = useState("");
  const [isSaving, setIsSaving] = useState(false);

  const formatDateOption = (dateStr: string): string => {
    const date = parseLocalDate(dateStr);
    const today = getToday();
    const tomorrow = (() => {
      const d = new Date();
      d.setDate(d.getDate() + 1);
      return formatDate(d);
    })();

    if (dateStr === today) return t.today || "Today";
    if (dateStr === tomorrow) return t.tomorrow || "Tomorrow";

    return date.toLocaleDateString(language, {
      weekday: "short",
      day: "numeric",
      month: "short",
    });
  };

  const handleAdd = useCallback(() => {
    if (isSaving) return;
    setIsSaving(true);
    try {
      const title =
        customTitle ||
        (t as unknown as Record<string, string>)[selectedPreset.labelKey] ||
        selectedPreset.id;
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
    } catch {
      setIsSaving(false);
    }
  }, [isSaving, customTitle, t, selectedPreset, time, onAdd, eventDate, note]);

  const modal = (
    <motion.div
      ref={modalRef}
      onKeyDown={handleKeyDown}
      role="dialog"
      aria-modal="true"
      aria-labelledby="add-event-title"
      className="fixed inset-0 z-[var(--z-modal)] flex items-end justify-center ps-[max(1rem,var(--safe-inline-start))] pe-[max(1rem,var(--safe-inline-end))] pb-[max(1rem,var(--safe-bottom))] pt-[max(1rem,var(--safe-top))] sm:items-center"
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
        className="relative max-h-[calc(100dvh-var(--safe-top)-var(--safe-bottom)-2rem)] w-full max-w-sm overflow-y-auto overscroll-contain rounded-3xl border border-border/60 bg-card text-card-foreground shadow-xl"
        initial={{ opacity: 0, scale: 0.9, y: 50 }}
        animate={{ opacity: 1, scale: 1, y: 0 }}
        exit={{ opacity: 0, scale: 0.9, y: 50 }}
      >
        <div className="p-5">
          <div className="flex items-center justify-between mb-4">
            <h3
              id="add-event-title"
              className="min-w-0 break-words text-lg font-bold text-foreground"
            >
              {t.scheduleAddEvent || "Add Event"}
            </h3>
            <motion.button
              type="button"
              onClick={onClose}
              whileTap={zenTap.icon}
              className="p-2 hover:bg-secondary rounded-xl motion-safe:transition-colors"
              aria-label={t.close || "Close"}
            >
              <X className="w-5 h-5 text-slate-600 dark:text-white/80" aria-hidden="true" />
            </motion.button>
          </div>

          {/* Date picker */}
          <div className="mb-4">
            <label htmlFor="schedule-event-date" className="mb-1 block text-xs text-muted-foreground">
              {t.scheduleDate || "Date"}
            </label>
            <select
              id="schedule-event-date"
              value={eventDate}
              onChange={(e) => setEventDate(e.target.value)}
              className="w-full p-3 bg-secondary backdrop-blur-sm rounded-xl text-sm text-slate-800 dark:text-white border border-border focus:border-primary/50 focus:outline-none"
              aria-label={t.scheduleDate || "Select date"}
            >
              {allDates.map((date) => (
                <option
                  key={date}
                  value={date}
                  className="bg-white dark:bg-slate-900 text-foreground"
                >
                  {formatDateOption(date)}
                </option>
              ))}
            </select>
          </div>

          {/* Event type presets - 3D cards */}
          <div
            className="mb-4 grid grid-cols-2 gap-2 min-[420px]:grid-cols-3"
            role="group"
            aria-label={t.scheduleEventType || "Event type"}
          >
            {EVENT_PRESETS.map((preset) => {
              const label = ts[preset.labelKey] || preset.id;
              const isSelected = selectedPreset.id === preset.id;
              const eventColor = getEventColor(preset.colorVar);

              return (
                <motion.button
                  type="button"
                  key={preset.id}
                  onClick={() => setSelectedPreset(preset)}
                  whileTap={zenTap.button}
                  aria-pressed={isSelected}
                  aria-label={label}
                  className={cn(
                    "h-auto min-h-[52px] min-w-0 whitespace-normal p-3 rounded-xl flex flex-col items-center gap-1 border motion-safe:transition-colors",
                    isSelected
                      ? "border-primary bg-primary/10 text-foreground"
                      : "bg-muted border-border hover:bg-secondary"
                  )}
                  style={{ borderInlineStartColor: eventColor }}
                >
                  <span aria-hidden="true" className="shrink-0 text-2xl">
                    {preset.emoji}
                  </span>
                  <span className="break-words text-center text-xs text-muted-foreground">
                    {label}
                  </span>
                </motion.button>
              );
            })}
          </div>

          {/* Custom title */}
          <div className="mb-4">
            <label htmlFor="schedule-event-title" className="mb-1 block text-xs text-muted-foreground">
              {t.scheduleCustomTitle || "Custom title (optional)"}
            </label>
            <input
              id="schedule-event-title"
              type="text"
              dir="auto"
              value={customTitle}
              onChange={(e) => setCustomTitle(e.target.value)}
              placeholder={t.scheduleCustomTitle || "Custom title (optional)"}
              className="min-h-11 w-full rounded-xl border border-border bg-background p-3 text-sm text-foreground placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              onFocus={(e) => {
                const el = e.target;
                setTimeout(() => el.scrollIntoView({ behavior: shouldAnimate() ? "smooth" : "auto", block: "center" }), 300);
              }}
            />
          </div>

          {/* Time pickers */}
          <div className="flex items-center gap-3 mb-4">
            <fieldset className="min-w-0 flex-1">
              <legend className="mb-1 block text-xs text-muted-foreground">
                {t.scheduleStart || "Start"}
              </legend>
              <div className="flex gap-1">
                <select
                  value={time.startHour}
                  onChange={(e) =>
                    setTime((prev) => ({
                      ...prev,
                      startHour: safeParseInt(e.target.value, 9, 0, 23),
                    }))
                  }
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                  aria-label={t.ariaSelectStartHour}
                >
                  {HOURS.map((h) => (
                    <option
                      key={h}
                      value={h}
                      className="bg-white dark:bg-slate-900 text-foreground"
                    >
                      {formatScheduleNumericPart(language, h)}
                    </option>
                  ))}
                </select>
                <select
                  value={time.startMinute}
                  onChange={(e) =>
                    setTime((prev) => ({
                      ...prev,
                      startMinute: safeParseInt(e.target.value, 0, 0, 59),
                    }))
                  }
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                  aria-label={t.ariaSelectStartMinute}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option
                      key={m}
                      value={m}
                      className="bg-white dark:bg-slate-900 text-foreground"
                    >
                      {formatScheduleNumericPart(language, m)}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
            <fieldset className="min-w-0 flex-1">
              <legend className="mb-1 block text-xs text-muted-foreground">
                {t.scheduleEnd || "End"}
              </legend>
              <div className="flex gap-1">
                <select
                  value={time.endHour}
                  onChange={(e) =>
                    setTime((prev) => ({
                      ...prev,
                      endHour: safeParseInt(e.target.value, 10, 0, 23),
                    }))
                  }
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                  aria-label={t.ariaSelectEndHour}
                >
                  {HOURS.map((h) => (
                    <option
                      key={h}
                      value={h}
                      className="bg-white dark:bg-slate-900 text-foreground"
                    >
                      {formatScheduleNumericPart(language, h)}
                    </option>
                  ))}
                </select>
                <select
                  value={time.endMinute}
                  onChange={(e) =>
                    setTime((prev) => ({
                      ...prev,
                      endMinute: safeParseInt(e.target.value, 0, 0, 59),
                    }))
                  }
                  className="flex-1 p-2 bg-secondary backdrop-blur-sm rounded-lg text-sm text-slate-800 dark:text-white border border-border"
                  aria-label={t.ariaSelectEndMinute}
                >
                  {[0, 15, 30, 45].map((m) => (
                    <option
                      key={m}
                      value={m}
                      className="bg-white dark:bg-slate-900 text-foreground"
                    >
                      {formatScheduleNumericPart(language, m)}
                    </option>
                  ))}
                </select>
              </div>
            </fieldset>
          </div>

          {/* Note */}
          <div className="mb-4">
            <label htmlFor="schedule-event-note" className="mb-1 block text-xs text-muted-foreground">
              {t.scheduleNote || "Note (optional)"}
            </label>
            <textarea
              id="schedule-event-note"
              dir="auto"
              value={note}
              onChange={(e) => setNote(e.target.value)}
              placeholder={t.scheduleNotePlaceholder || "Add details or reminders..."}
              className="w-full p-3 bg-secondary backdrop-blur-sm rounded-xl text-sm text-slate-800 dark:text-white border border-border focus:border-primary/50 focus:outline-none resize-none placeholder:text-slate-400 dark:placeholder:text-white/60"
              rows={2}
              onFocus={(e) => {
                const el = e.target;
                setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
              }}
            />
          </div>

          {/* Add button */}
          <motion.button
            type="button"
            onClick={handleAdd}
            disabled={isSaving}
            whileTap={zenTap.card}
            className={cn(
              "flex w-full items-center justify-center gap-2 rounded-xl bg-primary py-4 font-bold text-primary-foreground",
              isSaving && "opacity-50"
            )}
          >
            <Check className="w-5 h-5" aria-hidden="true" />
            {t.addToMyWorld}
          </motion.button>
        </div>
      </motion.div>
    </motion.div>
  );

  return typeof document === "undefined" ? modal : createPortal(modal, document.body);
}
