import { memo, useEffect, useMemo, useState } from "react";
import { ArrowRight, CheckCircle2, MoonStar, Sunrise, Sparkles } from "lucide-react";

import { cn } from "@/lib/utils";
import type { DayRitual, MoodType, RitualEnergy } from "@/types";

interface DailyRitualCardProps {
  tx: Record<string, string>;
  recommendedType: "opening" | "closing" | null;
  openingRitual?: DayRitual;
  closingRitual?: DayRitual;
  onSaveRitual: (
    type: DayRitual["type"],
    values: Partial<DayRitual>,
  ) => DayRitual;
  onOpenJournal?: () => void;
  compact?: boolean;
  className?: string;
}

const MOOD_ORDER: MoodType[] = ["terrible", "bad", "okay", "good", "great"];
const ENERGY_ORDER: RitualEnergy[] = [1, 2, 3, 4, 5];

function linesToText(lines: string[]): string {
  return lines.join("\n");
}

function textToLines(value: string): string[] {
  return value
    .split("\n")
    .map((line) => line.trim())
    .filter(Boolean)
    .slice(0, 3);
}

export const DailyRitualCard = memo(function DailyRitualCard({
  tx,
  recommendedType,
  openingRitual,
  closingRitual,
  onSaveRitual,
  onOpenJournal,
  compact = false,
  className,
}: DailyRitualCardProps) {
  const [selectedType, setSelectedType] = useState<"opening" | "closing">(
    recommendedType ?? (closingRitual ? "closing" : "opening"),
  );
  const activeRitual = selectedType === "opening" ? openingRitual : closingRitual;
  const [isEditing, setIsEditing] = useState(!activeRitual);
  const [mood, setMood] = useState<MoodType | undefined>(activeRitual?.mood);
  const [energy, setEnergy] = useState<RitualEnergy | undefined>(activeRitual?.energy);
  const [priorities, setPriorities] = useState(linesToText(activeRitual?.priorities ?? []));
  const [focusIntent, setFocusIntent] = useState(activeRitual?.focusIntent ?? "");
  const [habitIntent, setHabitIntent] = useState(activeRitual?.habitIntent ?? "");
  const [wins, setWins] = useState(linesToText(activeRitual?.wins ?? []));
  const [drains, setDrains] = useState(linesToText(activeRitual?.drains ?? []));
  const [carryForward, setCarryForward] = useState(activeRitual?.carryForward ?? "");
  const [gratitude, setGratitude] = useState(activeRitual?.gratitude ?? "");
  const [note, setNote] = useState(activeRitual?.note ?? "");
  const [justSaved, setJustSaved] = useState(false);

  useEffect(() => {
    if (recommendedType) {
      setSelectedType(recommendedType);
    }
  }, [recommendedType]);

  useEffect(() => {
    const ritual = selectedType === "opening" ? openingRitual : closingRitual;
    setIsEditing(!ritual);
    setMood(ritual?.mood);
    setEnergy(ritual?.energy);
    setPriorities(linesToText(ritual?.priorities ?? []));
    setFocusIntent(ritual?.focusIntent ?? "");
    setHabitIntent(ritual?.habitIntent ?? "");
    setWins(linesToText(ritual?.wins ?? []));
    setDrains(linesToText(ritual?.drains ?? []));
    setCarryForward(ritual?.carryForward ?? "");
    setGratitude(ritual?.gratitude ?? "");
    setNote(ritual?.note ?? "");
    setJustSaved(false);
  }, [closingRitual, openingRitual, selectedType]);

  const copy = tx;
  const title =
    selectedType === "opening"
      ? copy.reflectionMorningTitle || "Start your day with intention"
      : copy.reflectionEveningTitle || "Close your day with clarity";
  const subtitle =
    selectedType === "opening"
      ? copy.reflectionMorningSubtitle ||
        "Capture mood, priorities, and a realistic rhythm before the day pulls on you."
      : copy.reflectionEveningSubtitle ||
        "Name what moved, what drained you, and what deserves to follow you into tomorrow.";

  const summaryLines = useMemo(() => {
    if (!activeRitual) return [];
    return selectedType === "opening"
      ? activeRitual.priorities
          .concat(activeRitual.focusIntent ? [activeRitual.focusIntent] : [])
          .slice(0, 3)
      : activeRitual.wins
          .concat(activeRitual.carryForward ? [activeRitual.carryForward] : [])
          .slice(0, 3);
  }, [activeRitual, selectedType]);

  const handleSave = () => {
    onSaveRitual(selectedType, {
      mood,
      energy,
      priorities: textToLines(priorities),
      focusIntent,
      habitIntent,
      wins: textToLines(wins),
      drains: textToLines(drains),
      carryForward,
      gratitude,
      note,
    });
    setIsEditing(false);
    setJustSaved(true);
  };

  return (
    <section
      className={cn(
        "overflow-hidden rounded-[30px] border border-border/70 bg-card/88 shadow-sm backdrop-blur-xl",
        compact ? "p-4" : "p-5",
        className,
      )}
    >
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div className="flex items-center gap-3">
          <div className="flex h-12 w-12 items-center justify-center rounded-2xl bg-primary/10 text-primary">
            {selectedType === "opening" ? (
              <Sunrise className="h-5 w-5" aria-hidden="true" />
            ) : (
              <MoonStar className="h-5 w-5" aria-hidden="true" />
            )}
          </div>
          <div>
            <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {selectedType === "opening"
                ? copy.reflectionOpenDayCta || "Start your day"
                : copy.reflectionCloseDayCta || "Close your day"}
            </p>
            <h3 className="text-lg font-semibold tracking-tight text-foreground">
              {title}
            </h3>
          </div>
        </div>

        <div className="inline-flex rounded-full border border-border/70 bg-background/80 p-1">
          <button
            type="button"
            onClick={() => setSelectedType("opening")}
            className={cn(
              "min-h-[40px] rounded-full px-3 text-sm font-medium transition-colors",
              selectedType === "opening"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {copy.reflectionOpenDayCta || "Start"}
          </button>
          <button
            type="button"
            onClick={() => setSelectedType("closing")}
            className={cn(
              "min-h-[40px] rounded-full px-3 text-sm font-medium transition-colors",
              selectedType === "closing"
                ? "bg-primary text-primary-foreground"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            {copy.reflectionCloseDayCta || "Close"}
          </button>
        </div>
      </div>

      <p className="mt-3 max-w-2xl text-sm leading-6 text-muted-foreground">{subtitle}</p>

      {activeRitual && !isEditing ? (
        <div className="mt-4 rounded-[24px] border border-border/60 bg-background/72 p-4">
          <div className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
            <CheckCircle2 className="h-4 w-4 text-primary" aria-hidden="true" />
            <span>{copy.reflectionSavedRitual || "Saved for today"}</span>
            {activeRitual.energy ? (
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                {copy.reflectionEnergyLabel || "Energy"} {activeRitual.energy}/5
              </span>
            ) : null}
            {activeRitual.mood ? (
              <span className="rounded-full bg-muted px-2 py-1 text-xs text-foreground">
                {copy[
                  activeRitual.mood === "great"
                    ? "moodGreat"
                    : activeRitual.mood === "good"
                      ? "moodGood"
                      : activeRitual.mood === "bad"
                        ? "moodBad"
                        : activeRitual.mood === "terrible"
                          ? "moodTerrible"
                          : "moodOkay"
                ] || activeRitual.mood}
              </span>
            ) : null}
          </div>

          {summaryLines.length > 0 ? (
            <div className="mt-4 space-y-2">
              {summaryLines.map((line) => (
                <div
                  key={line}
                  className="rounded-2xl border border-border/50 bg-card/72 px-3 py-2 text-sm text-foreground"
                >
                  {line}
                </div>
              ))}
            </div>
          ) : null}

          <div className="mt-4 flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={() => setIsEditing(true)}
              className="inline-flex min-h-[44px] items-center rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
            >
              {copy.reflectionRefine || "Refine"}
            </button>
            {onOpenJournal ? (
              <button
                type="button"
                onClick={onOpenJournal}
                className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
              >
                <span>{copy.reflectionOpenJournal || "Open journal"}</span>
                <ArrowRight className="h-4 w-4" aria-hidden="true" />
              </button>
            ) : null}
          </div>
        </div>
      ) : (
        <div className="mt-5 space-y-4">
          <div className="grid gap-4 md:grid-cols-[1.1fr_0.9fr]">
            <div className="space-y-4 rounded-[24px] border border-border/60 bg-background/72 p-4">
              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {copy.reflectionMoodLabel || "Mood"}
                </p>
                <div className="mt-2 grid grid-cols-5 gap-2">
                  {MOOD_ORDER.map((value) => {
                    const label =
                      copy[
                        value === "great"
                          ? "moodGreat"
                          : value === "good"
                            ? "moodGood"
                            : value === "bad"
                              ? "moodBad"
                              : value === "terrible"
                                ? "moodTerrible"
                                : "moodOkay"
                      ] || value;
                    return (
                      <button
                        key={value}
                        type="button"
                        onClick={() => setMood(value)}
                        className={cn(
                          "min-h-[44px] rounded-2xl border px-2 py-2 text-xs font-medium transition-colors",
                          mood === value
                            ? "border-primary bg-primary/12 text-foreground"
                            : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
                        )}
                      >
                        {label}
                      </button>
                    );
                  })}
                </div>
              </div>

              <div>
                <p className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {copy.reflectionEnergyLabel || "Energy"}
                </p>
                <div className="mt-2 flex items-center gap-2">
                  {ENERGY_ORDER.map((value) => (
                    <button
                      key={value}
                      type="button"
                      onClick={() => setEnergy(value)}
                      className={cn(
                        "flex min-h-[44px] min-w-[44px] items-center justify-center rounded-2xl border text-sm font-semibold transition-colors",
                        energy === value
                          ? "border-primary bg-primary text-primary-foreground"
                          : "border-border/60 bg-card text-muted-foreground hover:text-foreground",
                      )}
                    >
                      {value}
                    </button>
                  ))}
                </div>
              </div>
            </div>

            <div className="space-y-4 rounded-[24px] border border-border/60 bg-background/72 p-4">
              <label className="block">
                <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                  {selectedType === "opening"
                    ? copy.reflectionPrioritiesLabel || "Top priorities"
                    : copy.reflectionWinsLabel || "What moved"}
                </span>
                <textarea
                  value={selectedType === "opening" ? priorities : wins}
                  onChange={(event) =>
                    selectedType === "opening"
                      ? setPriorities(event.target.value)
                      : setWins(event.target.value)
                  }
                  rows={3}
                  placeholder={
                    copy.reflectionOnePerLineHint ||
                    "One thought per line. Keep it short and real."
                  }
                  className="mt-2 min-h-[112px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                />
              </label>
            </div>
          </div>

          <div className="grid gap-4 md:grid-cols-2">
            {selectedType === "opening" ? (
              <>
                <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {copy.reflectionFocusIntentLabel || "Focus intention"}
                  </span>
                  <input
                    value={focusIntent}
                    onChange={(event) => setFocusIntent(event.target.value)}
                    placeholder={
                      copy.reflectionFocusIntentHint ||
                      "What kind of attention does today need?"
                    }
                    className="mt-2 min-h-[44px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </label>

                <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {copy.reflectionHabitIntentLabel || "Habit anchor"}
                  </span>
                  <input
                    value={habitIntent}
                    onChange={(event) => setHabitIntent(event.target.value)}
                    placeholder={
                      copy.reflectionHabitIntentHint ||
                      "What will make your habits realistic today?"
                    }
                    className="mt-2 min-h-[44px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </label>
              </>
            ) : (
              <>
                <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
                  <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                    {copy.reflectionDrainsLabel || "What drained you"}
                  </span>
                  <textarea
                    value={drains}
                    onChange={(event) => setDrains(event.target.value)}
                    rows={3}
                    placeholder={
                      copy.reflectionDrainsHint ||
                      "Name the frictions without judging them."
                    }
                    className="mt-2 min-h-[112px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                  />
                </label>

                <div className="grid gap-4">
                  <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
                    <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {copy.reflectionCarryForwardLabel || "Carry forward"}
                    </span>
                    <input
                      value={carryForward}
                      onChange={(event) => setCarryForward(event.target.value)}
                      placeholder={
                        copy.reflectionCarryForwardHint ||
                        "What should tomorrow inherit from today?"
                      }
                      className="mt-2 min-h-[44px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                    />
                  </label>

                  <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
                    <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
                      {copy.reflectionGratitudeLabel || "Gratitude"}
                    </span>
                    <input
                      value={gratitude}
                      onChange={(event) => setGratitude(event.target.value)}
                      placeholder={
                        copy.reflectionGratitudeHint ||
                        "What deserves a softer look tonight?"
                      }
                      className="mt-2 min-h-[44px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
                    />
                  </label>
                </div>
              </>
            )}
          </div>

          <label className="block rounded-[24px] border border-border/60 bg-background/72 p-4">
            <span className="text-xs uppercase tracking-[0.16em] text-muted-foreground">
              {copy.reflectionNoteLabel || "Note"}
            </span>
            <textarea
              value={note}
              onChange={(event) => setNote(event.target.value)}
              rows={compact ? 2 : 3}
              placeholder={
                copy.reflectionNoteHint || "Leave yourself one honest sentence."
              }
              className="mt-2 min-h-[96px] w-full rounded-2xl border border-border/60 bg-card px-4 py-3 text-sm text-foreground outline-none transition-colors placeholder:text-muted-foreground focus:border-primary/60"
            />
          </label>

          <div className="flex flex-wrap items-center gap-2">
            <button
              type="button"
              onClick={handleSave}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-4 py-2 text-sm font-medium text-primary-foreground transition-colors hover:bg-primary/90"
            >
              <Sparkles className="h-4 w-4" aria-hidden="true" />
              <span>
                {justSaved
                  ? copy.reflectionSavedRitual || "Saved for today"
                  : copy.reflectionSaveRitual || "Save ritual"}
              </span>
            </button>
            {activeRitual && (
              <button
                type="button"
                onClick={() => setIsEditing(false)}
                className="inline-flex min-h-[44px] items-center rounded-full border border-border/70 bg-card px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {copy.cancel || "Cancel"}
              </button>
            )}
            {onOpenJournal ? (
              <button
                type="button"
                onClick={onOpenJournal}
                className="inline-flex min-h-[44px] items-center rounded-full border border-border/70 bg-background/80 px-4 py-2 text-sm font-medium text-foreground transition-colors hover:bg-accent"
              >
                {copy.reflectionOpenJournal || "Open journal"}
              </button>
            ) : null}
          </div>
        </div>
      )}
    </section>
  );
});
