import type { MoodType, MoodEntry } from "@/types";
import { Card } from "@/components/ui/card";
import { ChevronDown, Plus, Edit3 } from "lucide-react";
import { AnimatedMoodEmoji } from "@/components/AnimatedMoodEmoji";
import { MoodChangedToast, ConfirmDialog } from "@/components/Celebrations";
import { cn } from "@/lib/utils";
import type { Language } from "@/i18n/translations";
import { getLocale } from "@/lib/timeUtils";
import type { TimeOfDay, ConfirmChangePayload } from "./types";
import { TIME_ICONS, getTimeOfDayFromTimestamp } from "./types";

interface MoodWithLabel {
  type: MoodType;
  emoji: string;
  label: string;
  color: string;
}

interface MoodCompactViewProps {
  todayEntries: MoodEntry[];
  entryByTime: Partial<Record<TimeOfDay, MoodEntry>>;
  currentTimeOfDay: TimeOfDay;
  canAddForCurrentTime: boolean;
  moods: MoodWithLabel[];
  timeLabels: Record<TimeOfDay, string>;
  language: string;
  t: Record<string, string>;
  isExpanded: boolean;
  onToggleExpanded: () => void;
  // Edit state
  editingEntryId: string | null;
  editingMood: MoodType | null;
  editingNote: string;
  setEditingNote: (note: string) => void;
  confirmChange: ConfirmChangePayload | null;
  handleStartEdit: (entry: MoodEntry) => void;
  handleEditMoodSelect: (entry: MoodEntry, mood: MoodType) => void;
  handleSaveEdit: (entry: MoodEntry) => void;
  confirmMoodChange: () => void;
  cancelMoodChange: () => void;
  cancelEdit: () => void;
  // Feedback state
  showMoodChangedToast: boolean;
  changedMoodEmoji: string;
  // Actions
  onShowAddNew: () => void;
  onExpandAndEdit: (entry: MoodEntry) => void;
  onUpdateEntry?: (entryId: string, mood: MoodType, note?: string) => void;
}

export function MoodCompactView({
  todayEntries,
  entryByTime,
  currentTimeOfDay,
  canAddForCurrentTime,
  moods,
  timeLabels,
  language,
  t,
  isExpanded,
  onToggleExpanded,
  editingEntryId,
  editingMood,
  editingNote,
  setEditingNote,
  confirmChange,
  handleStartEdit,
  handleEditMoodSelect,
  handleSaveEdit,
  confirmMoodChange,
  cancelMoodChange,
  cancelEdit,
  showMoodChangedToast,
  changedMoodEmoji,
  onShowAddNew,
  onExpandAndEdit,
  onUpdateEntry,
}: MoodCompactViewProps) {
  const latestEntry = todayEntries[todayEntries.length - 1];
  const latestMood = moods.find((m) => m.type === latestEntry.mood);
  const latestTimeOfDay = getTimeOfDayFromTimestamp(latestEntry.timestamp);
  const LatestTimeIcon = TIME_ICONS[latestTimeOfDay];

  return (
    <Card elevation="raised" className="p-5 animate-fade-in">
      {/* Header with expand toggle */}
      <div
        role="button"
        tabIndex={0}
        className="flex items-center justify-between cursor-pointer"
        onClick={onToggleExpanded}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            onToggleExpanded();
          }
        }}
      >
        <h3 className="text-lg font-semibold text-foreground">{t.moodToday || "Today's Mood"}</h3>
        <ChevronDown
          className={cn(
            "w-5 h-5 text-muted-foreground transition-transform",
            isExpanded && "rotate-180"
          )}
        />
      </div>

      {/* Latest mood summary */}
      <div className="flex items-center gap-4 mt-4">
        <div
          className={cn(
            "w-14 h-14 rounded-full flex items-center justify-center",
            latestMood?.color,
            "bg-opacity-20"
          )}
        >
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

        {canAddForCurrentTime && (
          <button
            onClick={(e) => {
              e.stopPropagation();
              onShowAddNew();
            }}
            className="flex items-center gap-1.5 px-3 py-2 bg-primary/10 hover:bg-primary/20 text-primary rounded-xl transition-colors"
          >
            <Plus className="w-4 h-4" />
            <span className="text-sm font-medium">{t.updateMood || "Update"}</span>
          </button>
        )}
      </div>

      {/* Expanded view - show all entries for today */}
      {isExpanded && todayEntries.length > 0 && (
        <div className="mt-4 pt-4 border-t border-border space-y-3 animate-fade-in">
          <p className="text-xs text-muted-foreground uppercase tracking-wide">
            {t.moodHistory || "Today's history"}
          </p>
          {todayEntries.map((entry) => {
            const entryMood = moods.find((m) => m.type === entry.mood);
            const tod = getTimeOfDayFromTimestamp(entry.timestamp);
            const TimeIcon = TIME_ICONS[tod];
            const time = new Date(entry.timestamp).toLocaleTimeString(
              getLocale(language as Language),
              { hour: "2-digit", minute: "2-digit" }
            );
            const isEditing = editingEntryId === entry.id;

            return (
              <div
                key={entry.id}
                className={cn(
                  "p-2 bg-secondary/50 rounded-xl transition-all",
                  isEditing && "ring-2 ring-primary/50 bg-secondary"
                )}
              >
                {!isEditing ? (
                  <div className="flex items-center gap-3">
                    <div
                      className={cn(
                        "w-10 h-10 rounded-full flex items-center justify-center",
                        entryMood?.color,
                        "bg-opacity-20"
                      )}
                    >
                      {entryMood && <AnimatedMoodEmoji mood={entryMood.type} size="md" />}
                    </div>
                    <div className="flex-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <TimeIcon className="w-3.5 h-3.5 text-muted-foreground" />
                        <span className="text-sm font-medium text-foreground">
                          {timeLabels[tod]}
                        </span>
                        <span className="text-xs text-muted-foreground">{time}</span>
                      </div>
                      {entry.note && (
                        <p className="text-xs text-muted-foreground truncate">{entry.note}</p>
                      )}
                    </div>
                    {onUpdateEntry && (
                      <button
                        onClick={(e) => {
                          e.stopPropagation();
                          handleStartEdit(entry);
                        }}
                        className="p-2 min-w-[44px] min-h-[44px] inline-flex items-center justify-center hover:bg-primary/10 rounded-lg transition-colors group"
                        title={t.editMood || "Edit mood"}
                        aria-label={t.editMood || "Edit mood"}
                      >
                        <Edit3 className="w-4 h-4 text-muted-foreground group-hover:text-primary transition-colors" />
                      </button>
                    )}
                  </div>
                ) : (
                  <div className="animate-fade-in space-y-3">
                    <div className="flex items-center gap-2">
                      <TimeIcon className="w-3.5 h-3.5 text-primary" />
                      <span className="text-sm font-medium text-primary">
                        {t.editMood || "Edit entry"}
                      </span>
                      <button
                        onClick={cancelEdit}
                        className="ms-auto text-xs text-muted-foreground hover:text-foreground min-h-[44px] flex items-center"
                      >
                        {t.cancel || "Cancel"}
                      </button>
                    </div>

                    <div className="flex justify-between gap-1">
                      {moods.map((mood) => (
                        <button
                          key={mood.type}
                          onClick={() => handleEditMoodSelect(entry, mood.type)}
                          aria-label={mood.label}
                          className={cn(
                            "flex-1 p-2 min-h-[44px] inline-flex items-center justify-center rounded-lg transition-all",
                            editingMood === mood.type
                              ? `${mood.color} bg-opacity-30 scale-105`
                              : "hover:bg-secondary hover:scale-105"
                          )}
                        >
                          <span className="text-xl">{mood.emoji}</span>
                        </button>
                      ))}
                    </div>

                    <textarea
                      value={editingNote}
                      onChange={(e) => setEditingNote(e.target.value)}
                      placeholder={t.addNote || "Add a note..."}
                      aria-label={t.addNote || "Add a note"}
                      className="w-full p-2 bg-background/50 rounded-lg text-sm text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-1 focus:ring-primary/30"
                      rows={2}
                    />

                    <button
                      onClick={() => handleSaveEdit(entry)}
                      className="w-full py-2 bg-primary/20 hover:bg-primary/30 text-primary rounded-lg text-sm font-medium transition-colors"
                    >
                      {t.save || "Save"}
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
        {(["morning", "afternoon", "evening"] as TimeOfDay[]).map((tod) => {
          const TimeIcon = TIME_ICONS[tod];
          const hasEntry = !!entryByTime[tod];
          const isCurrent = tod === currentTimeOfDay;
          const entryMood = hasEntry ? moods.find((m) => m.type === entryByTime[tod]?.mood) : null;
          const entry = entryByTime[tod];
          const canEdit = hasEntry && onUpdateEntry;

          return (
            <button
              key={tod}
              onClick={(e) => {
                e.stopPropagation();
                if (canEdit && entry) {
                  onExpandAndEdit(entry);
                } else if (!hasEntry && isCurrent) {
                  onShowAddNew();
                }
              }}
              disabled={!hasEntry && !isCurrent}
              className={cn(
                "flex flex-col items-center gap-1 min-w-[44px] min-h-[44px] justify-center transition-all",
                !hasEntry && !isCurrent && "opacity-40",
                (canEdit || (!hasEntry && isCurrent)) && "hover:scale-110 cursor-pointer"
              )}
            >
              <div
                className={cn(
                  "w-8 h-8 rounded-full flex items-center justify-center transition-all",
                  hasEntry ? `${entryMood?.color} bg-opacity-20` : "bg-secondary",
                  isCurrent && !hasEntry && "ring-2 ring-primary/30 ring-offset-1",
                  canEdit && "hover:ring-2 hover:ring-primary/50"
                )}
              >
                {hasEntry && entryMood ? (
                  <AnimatedMoodEmoji mood={entryMood.type} size="sm" />
                ) : (
                  <TimeIcon
                    className={cn("w-4 h-4", isCurrent ? "text-primary" : "text-muted-foreground")}
                  />
                )}
              </div>
              <span
                className={cn(
                  "text-xs",
                  isCurrent ? "text-primary font-medium" : "text-muted-foreground"
                )}
              >
                {timeLabels[tod]}
              </span>
            </button>
          );
        })}
      </div>

      {/* Confirmation Dialog */}
      {confirmChange && (
        <ConfirmDialog
          title={t.changeMoodConfirmTitle || "Change mood?"}
          message={t.changeMoodConfirmMessage || "Are you sure you want to change your mood?"}
          confirmText={t.confirm || "Change"}
          cancelText={t.cancel || "Cancel"}
          onConfirm={confirmMoodChange}
          onCancel={cancelMoodChange}
        />
      )}

      {/* Mood Changed Toast */}
      {showMoodChangedToast && (
        <MoodChangedToast emoji={changedMoodEmoji} message={t.moodChanged || "Mood updated!"} />
      )}
    </Card>
  );
}
