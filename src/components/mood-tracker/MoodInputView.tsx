import type { MoodType } from "@/types";
import { hapticTap } from "@/lib/haptics";
import { Sparkles } from "lucide-react";
import { AnimatedMoodEmoji } from "@/components/AnimatedMoodEmoji";
import { MoodSelectionCelebration } from "@/components/MoodSelectionCelebration";
import { cn } from "@/lib/utils";
import type { TimeOfDay, CelebrationData } from "./types";
import { TIME_ICONS } from "./types";

interface MoodWithLabel {
  type: MoodType;
  emoji: string;
  label: string;
  color: string;
}

interface MoodInputViewProps {
  moods: MoodWithLabel[];
  timeLabels: Record<TimeOfDay, string>;
  currentTimeOfDay: TimeOfDay;
  isPrimaryCTA: boolean;
  hasAnyEntryToday: boolean;
  t: Record<string, string>;
  selectedMood: MoodType | null;
  onSelectMood: (mood: MoodType) => void;
  note: string;
  onNoteChange: (note: string) => void;
  onSubmit: () => void;
  showAddNew: boolean;
  onBack: () => void;
  moodButtonRefs: React.MutableRefObject<Record<MoodType, HTMLButtonElement | null>>;
  showCelebration: boolean;
  celebrationData: CelebrationData | null;
  onCelebrationComplete: () => void;
}

export function MoodInputView({
  moods,
  timeLabels,
  currentTimeOfDay,
  isPrimaryCTA,
  hasAnyEntryToday,
  t,
  selectedMood,
  onSelectMood,
  note,
  onNoteChange,
  onSubmit,
  showAddNew,
  onBack,
  moodButtonRefs,
  showCelebration,
  celebrationData,
  onCelebrationComplete,
}: MoodInputViewProps) {
  const CurrentTimeIcon = TIME_ICONS[currentTimeOfDay];

  return (
    <div
      className={cn(
        "rounded-2xl p-6 motion-safe:animate-fade-in motion-safe:transition-all relative overflow-hidden",
        isPrimaryCTA
          ? "bg-gradient-to-br from-primary/15 via-card to-accent/15 ring-2 ring-primary/40 shadow-lg shadow-primary/20"
          : "bg-card zen-shadow-card"
      )}
    >
      {/* Animated background glow for CTA */}
      {isPrimaryCTA && (
        <div className="absolute inset-0 bg-gradient-to-r from-primary/5 via-transparent to-accent/5 motion-safe:animate-pulse" />
      )}

      {/* Back button if adding new entry */}
      {showAddNew && hasAnyEntryToday && (
        <button
          onClick={onBack}
          className="relative text-sm text-muted-foreground hover:text-foreground mb-3 flex items-center gap-1"
        >
          ← {t.back || "Back"}
        </button>
      )}

      {/* Primary CTA Header */}
      {isPrimaryCTA && !showAddNew && (
        <div className="relative flex items-center justify-center gap-2 mb-4">
          <div className="flex items-center gap-2 px-4 py-2 bg-primary/25 rounded-full border border-primary/30">
            <Sparkles className="w-5 h-5 text-primary" />
            <span className="text-sm font-bold text-primary">{t.startHere || "Start here"}</span>
            <Sparkles className="w-5 h-5 text-primary" />
          </div>
        </div>
      )}

      {/* Current time indicator */}
      {!isPrimaryCTA && (
        <div className="relative flex items-center justify-center gap-2 mb-3">
          <div className="flex items-center gap-2 px-3 py-1.5 bg-secondary rounded-full">
            <CurrentTimeIcon className="w-4 h-4 text-primary" />
            <span className="text-xs font-medium text-foreground">
              {timeLabels[currentTimeOfDay]}
            </span>
          </div>
        </div>
      )}

      <h3
        className={cn(
          "font-semibold text-foreground mb-4 relative",
          isPrimaryCTA ? "text-xl text-center" : "text-lg text-center"
        )}
      >
        {showAddNew ? t.howAreYouNow || "How are you now?" : t.howAreYouFeeling}
      </h3>

      <div
        role="radiogroup"
        aria-label={t.selectMood || "Select your mood"}
        className={cn(
          "flex justify-center gap-2 sm:gap-4 mb-6 relative flex-wrap",
          isPrimaryCTA && "bg-card/50 rounded-2xl p-3 -mx-2"
        )}
      >
        {moods.map((mood, index) => (
          <button
            key={mood.type}
            ref={(el) => {
              moodButtonRefs.current[mood.type] = el;
            }}
            onPointerDown={() => void hapticTap()}
            onClick={() => onSelectMood(mood.type)}
            role="radio"
            aria-checked={selectedMood === mood.type}
            aria-label={mood.label}
            tabIndex={selectedMood === mood.type || (!selectedMood && index === 0) ? 0 : -1}
            className={cn(
              "mood-btn flex flex-col items-center gap-1 p-2 sm:p-3 rounded-xl motion-safe:transition-all relative min-w-[56px] min-h-[56px]",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
              selectedMood === mood.type
                ? `${mood.color} bg-opacity-20 zen-shadow-soft selected ring-2 ring-primary/50`
                : "hover:bg-secondary/80 hover:scale-105"
            )}
            style={
              isPrimaryCTA && !selectedMood ? { animationDelay: `${index * 150}ms` } : undefined
            }
          >
            <AnimatedMoodEmoji
              mood={mood.type}
              size={isPrimaryCTA ? "xl" : "lg"}
              isSelected={selectedMood === mood.type}
              hasSelection={!!selectedMood}
            />
            <span
              className={cn(
                "text-xs font-medium",
                selectedMood === mood.type ? "text-foreground" : "text-muted-foreground"
              )}
            >
              {mood.label}
            </span>
          </button>
        ))}
      </div>

      {selectedMood && (
        <div className="motion-safe:animate-slide-up relative">
          <textarea
            value={note}
            onChange={(e) => onNoteChange(e.target.value)}
            placeholder={t.addNote}
            aria-label={t.addNote || "Add a note about your mood"}
            className="w-full p-4 bg-secondary rounded-lg text-foreground placeholder:text-muted-foreground resize-none focus:outline-none focus:ring-2 focus:ring-primary/30 motion-safe:transition-all"
            rows={2}
            onFocus={(e) => {
              const el = e.target;
              setTimeout(() => el.scrollIntoView({ behavior: "smooth", block: "center" }), 300);
            }}
          />
          <button
            onClick={onSubmit}
            className={cn(
              "btn-press mt-4 w-full py-4 zen-gradient text-primary-foreground font-bold rounded-xl motion-safe:transition-all",
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
        <p className="text-center text-sm text-muted-foreground mt-2 motion-safe:animate-fade-in relative">
          {t.tapToStart || "Tap an emoji to start your day"}
        </p>
      )}

      {/* Mood Selection Celebration */}
      {showCelebration && celebrationData && (
        <MoodSelectionCelebration
          mood={celebrationData.mood}
          note={celebrationData.note}
          timeOfDay={celebrationData.timeOfDay}
          xpGained={5}
          onComplete={onCelebrationComplete}
        />
      )}
    </div>
  );
}
