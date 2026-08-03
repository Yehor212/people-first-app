import type { JournalEntryPrefill, JournalEntrySuggestion } from "@/features/journal/types";
import { generateInsights, type InsightTranslations } from "@/lib/insightsEngine";
import { isHabitCompletedOnDate } from "@/lib/habits";
import { formatDate, getToday } from "@/lib/utils";
import type {
  DayRitual,
  FocusSession,
  GratitudeEntry,
  Habit,
  Insight,
  MoodEntry,
  MoodType,
  ReflectionInsightCard,
  ReflectionInsightImpact,
} from "@/types";

const MORNING_RITUAL_CUTOFF_HOUR = 16;

const MOOD_LABEL_KEYS: Record<MoodType, string> = {
  great: "moodGreat",
  good: "moodGood",
  okay: "moodOkay",
  bad: "moodBad",
  terrible: "moodTerrible",
};

function average(values: number[]): number {
  if (values.length === 0) return 0;
  return values.reduce((sum, value) => sum + value, 0) / values.length;
}

function escapeHtml(value: string): string {
  return value.replace(/[&<>"']/g, (char) => {
    switch (char) {
      case "&":
        return "&amp;";
      case "<":
        return "&lt;";
      case ">":
        return "&gt;";
      case "\"":
        return "&quot;";
      case "'":
        return "&#39;";
      default:
        return char;
    }
  });
}

function normalizeLines(lines: string[]): string[] {
  return lines.map((line) => line.trim()).filter(Boolean).slice(0, 3);
}

function buildListBlock(lines: string[]): string {
  if (lines.length === 0) return "";
  return `<ul>${lines.map((line) => `<li>${escapeHtml(line)}</li>`).join("")}</ul>`;
}

function moodScore(entry: MoodEntry): number {
  if (typeof entry.valence === "number") {
    return ((entry.valence + 1) / 2) * 4 + 1;
  }
  switch (entry.mood) {
    case "great":
      return 5;
    case "good":
      return 4;
    case "okay":
      return 3;
    case "bad":
      return 2;
    case "terrible":
      return 1;
    default:
      return 3;
  }
}

function getMoodLabel(mood: MoodType | undefined, tx: Record<string, string>): string {
  if (!mood) return tx.howAreYouFeeling || "How are you feeling?";
  return tx[MOOD_LABEL_KEYS[mood]] || mood;
}

function titleCase(value: string | null | undefined): string {
  if (!value) return "";
  return value.charAt(0).toUpperCase() + value.slice(1);
}

function shiftDateString(date: string, days: number): string {
  const value = new Date(`${date}T12:00:00`);
  value.setDate(value.getDate() + days);
  return formatDate(value);
}

function impactFromConfidence(confidence: number): ReflectionInsightImpact {
  if (confidence >= 0.8) return "high";
  if (confidence >= 0.6) return "medium";
  return "low";
}

function createInsightTranslations(tx: Record<string, string>): InsightTranslations {
  return {
    morning: tx.insightMorning || "in the morning",
    afternoon: tx.insightAfternoon || "in the afternoon",
    evening: tx.insightEvening || "in the evening",
    habitImprovesMood:
      tx.insightHabitImprovesMood || "{habit} appears with higher recorded mood",
    habitImprovesMoodDesc:
      tx.insightHabitImprovesMoodDesc ||
      'Across {sampleDays} recorded days with "{habit}", average mood was {avgMoodWith}/5, compared with {avgMoodWithout}/5 across {comparisonDays} other recorded days. This is an association, not proof that the habit caused the change.',
    focusBestLabel:
      tx.insightFocusBestLabel || 'You focus best on "{label}" tasks',
    focusBestLabelDesc:
      tx.insightFocusBestLabelDesc ||
      'Your average focus time for "{label}" is {minutes} minutes, higher than other activities.',
    peakFocusTime:
      tx.insightPeakFocusTime || "Your peak focus time is {timeOfDay}",
    peakFocusTimeDesc:
      tx.insightPeakFocusTimeDesc ||
      "You achieve your best focus around {time}, with an average of {minutes} minutes.",
    bestTimeForHabit:
      tx.insightBestTimeForHabit || "Best time for {habit}: {time}",
    bestTimeForHabitDesc:
      tx.insightBestTimeForHabitDesc ||
      'You\'re {percent}% more likely to complete "{habit}" {time} compared to {worstTime} ({worstPercent}%).',
    tagBoostsMood:
      tx.insightTagBoostsMood || '"{tag}" appears with higher recorded mood',
    tagBoostsMoodDesc:
      tx.insightTagBoostsMoodDesc ||
      'Across {occurrences} recorded entries tagged "{tag}", average mood was {avgMoodWith}/5, compared with {avgMoodWithout}/5 across {untaggedEntries} untagged entries. This is an association, not proof that the tag caused the change.',
  };
}

function buildInsightId(insight: Insight): string {
  switch (insight.metadata.type) {
    case "mood-habit-correlation":
      return `generated-habit-${insight.metadata.habitId}`;
    case "focus-pattern":
      return `generated-focus-${insight.metadata.bestLabel || "general"}-${insight.metadata.bestTime || "time"}`;
    case "habit-timing":
      return `generated-habit-timing-${insight.metadata.habitId}`;
    case "mood-tag":
      return `generated-tag-${insight.metadata.tag}`;
    case "energy-pattern":
      return `generated-energy-${insight.id}`;
    default:
      return `generated-${insight.id}`;
  }
}

function convertInsightToReflectionCard(
  insight: Insight,
  tx: Record<string, string>,
): ReflectionInsightCard {
  const confidence = Math.max(0, Math.min(1, insight.confidence / 100));
  const base = {
    id: buildInsightId(insight),
    source:
      insight.metadata.type === "focus-pattern"
        ? ("focus-pattern" as const)
        : insight.metadata.type === "mood-tag"
          ? ("mood-pattern" as const)
          : ("behavior-pattern" as const),
    title: insight.title,
    summary: insight.description,
    confidence,
    impact: impactFromConfidence(confidence),
    status: "new" as const,
    createdAt: insight.createdAt,
    updatedAt: Date.now(),
  };

  switch (insight.metadata.type) {
    case "mood-habit-correlation":
      return {
        ...base,
        experiment:
          tx.reflectionInsightHabitExperiment ||
          `Repeat ${insight.metadata.habitName} for the next 3 days and notice your mood.`,
        evidence: [
          {
            label:
              tx.reflectionEvidenceWithHabit || "Average mood with habit",
            detail: `${insight.metadata.avgMoodWith.toFixed(1)}/5`,
          },
          {
            label:
              tx.reflectionEvidenceWithoutHabit || "Average mood without habit",
            detail: `${insight.metadata.avgMoodWithout.toFixed(1)}/5`,
          },
          {
            label: tx.reflectionEvidenceSample || "Sample",
            detail: `${insight.metadata.sampleDays} ${tx.days || "days"}`,
          },
        ],
      };
    case "focus-pattern":
      return {
        ...base,
        experiment:
          tx.reflectionInsightFocusExperiment ||
          `Protect a focus block around ${insight.metadata.bestTime || "your best window"} this week.`,
        evidence: [
          {
            label: tx.reflectionEvidenceBestWindow || "Best window",
            detail: insight.metadata.bestTime || tx.insightMorning || "Morning",
          },
          {
            label: tx.reflectionEvidenceBestLabel || "Best session type",
            detail: insight.metadata.bestLabel || (tx.focusToday || "Focus"),
          },
          {
            label: tx.reflectionEvidenceAverageDuration || "Average duration",
            detail: `${Math.round(insight.metadata.avgDuration)} ${tx.minutes || "min"}`,
          },
        ],
      };
    case "habit-timing":
      return {
        ...base,
        experiment:
          tx.reflectionInsightTimingExperiment ||
          `Protect this habit in its strongest time window for the next week.`,
        evidence: [
          {
            label: tx.reflectionEvidenceBestWindow || "Best window",
            detail: insight.metadata.bestTime,
          },
          {
            label: tx.reflectionEvidenceSuccessRate || "Success rate",
            detail: `${Math.round(insight.metadata.bestTimeRate)}%`,
          },
          {
            label: tx.reflectionEvidenceSample || "Sample",
            detail: `${insight.metadata.morningCount + insight.metadata.afternoonCount + insight.metadata.eveningCount} ${tx.entries || "entries"}`,
          },
        ],
      };
    case "mood-tag":
      return {
        ...base,
        experiment:
          tx.reflectionInsightMoodExperiment ||
          `Lean into "${insight.metadata.tag}" deliberately and see whether the pattern holds.`,
        evidence: [
          {
            label: tx.reflectionEvidenceTag || "Tag",
            detail: insight.metadata.tag,
          },
          {
            label: tx.reflectionEvidenceImprovement || "Mood lift",
            detail: `${Math.round(insight.metadata.improvement)}%`,
          },
          {
            label: tx.reflectionEvidenceSample || "Sample",
            detail: `${insight.metadata.occurrences} ${tx.entries || "entries"}`,
          },
        ],
      };
    case "energy-pattern":
    default:
      return {
        ...base,
        experiment:
          tx.reflectionInsightGenericExperiment ||
          "Repeat the stronger pattern this week and check if it still holds.",
        evidence: [
          {
            label: tx.reflectionEvidenceSample || "Sample",
            detail: `${insight.dataPoints} ${tx.entries || "entries"}`,
          },
        ],
      };
  }
}

function buildRitualSuggestion(
  ritual: DayRitual,
  tx: Record<string, string>,
): JournalEntrySuggestion {
  const isOpening = ritual.type === "opening";
  const preview = isOpening
    ? ritual.priorities.join(" • ") || ritual.focusIntent || ritual.habitIntent || ritual.note || ""
    : ritual.wins.join(" • ") || ritual.gratitude || ritual.carryForward || ritual.note || "";

  return {
    id: `ritual-${ritual.id}`,
    source: isOpening ? "ritual-opening" : "ritual-closing",
    mood: ritual.mood,
    scope: "day",
    committedAt: ritual.updatedAt,
    note: preview || null,
    contextLabel: isOpening
      ? tx.reflectionOpenDayCta || "Start your day"
      : tx.reflectionCloseDayCta || "Close your day",
    prefill: buildRitualPrefill(ritual, tx),
  };
}

function buildMoodSuggestion(
  mood: MoodEntry,
  tx: Record<string, string>,
): JournalEntrySuggestion {
  const emotion = mood.emotionTags?.[0] || mood.emotion?.primary || null;
  const title = emotion ? titleCase(emotion) : getMoodLabel(mood.mood, tx);
  const note = mood.note?.trim() || null;
  const content = [
    `<p><strong>${escapeHtml(tx.reflectionSuggestionMood || "From today’s check-in")}</strong></p>`,
    note ? `<p>${escapeHtml(note)}</p>` : "",
  ]
    .filter(Boolean)
    .join("");

  return {
    id: `mood-${mood.id}`,
    source: "mood",
    mood: mood.mood,
    emotion,
    scope: mood.logType === "overall" ? "day" : "now",
    committedAt: mood.timestamp,
    note,
    contextLabel: tx.reflectionSuggestionMood || "From today’s check-in",
    prefill: {
      title,
      content,
      mood: mood.mood,
      tags: emotion ? [emotion] : [],
      date: mood.date,
    },
  };
}

function buildFocusSuggestion(
  session: FocusSession,
  tx: Record<string, string>,
): JournalEntrySuggestion {
  const label = session.label?.trim();
  const title = tx.reflectionSuggestionFocus || "What helped you focus?";
  const preview = label
    ? `${label} • ${session.duration} ${tx.minutes || "min"}`
    : `${session.duration} ${tx.minutes || "min"}`;

  return {
    id: `focus-${session.id}`,
    source: "focus",
    scope: "day",
    committedAt: session.completedAt,
    note: preview,
    contextLabel: tx.reflectionSuggestionFocus || "What helped you focus?",
    prefill: {
      title,
      content: [
        `<p><strong>${escapeHtml(tx.reflectionSuggestionFocus || "What helped you focus?")}</strong></p>`,
        label ? `<p>${escapeHtml(label)}</p>` : "",
        `<p>${escapeHtml(`${session.duration} ${tx.minutes || "min"}`)}</p>`,
      ]
        .filter(Boolean)
        .join(""),
      date: session.date,
    },
  };
}

function buildHabitSuggestion(
  habitNames: string[],
  date: string,
  tx: Record<string, string>,
): JournalEntrySuggestion {
  const title =
    tx.reflectionSuggestionHabitComplete || "All your habits landed today";
  const preview = habitNames.join(" • ");
  return {
    id: `habit-${date}`,
    source: "habit",
    scope: "day",
    committedAt: Date.now(),
    note: preview,
    contextLabel: title,
    prefill: {
      title,
      content: [
        `<p><strong>${escapeHtml(title)}</strong></p>`,
        buildListBlock(habitNames),
      ]
        .filter(Boolean)
        .join(""),
      date,
      tags: ["habits"],
    },
  };
}

export function buildRitualPrefill(
  ritual: DayRitual,
  tx: Record<string, string>,
): JournalEntryPrefill {
  const title =
    ritual.type === "opening"
      ? tx.reflectionOpenDayCta || "Start your day"
      : tx.reflectionCloseDayCta || "Close your day";
  const sections: string[] = [
    `<p><strong>${escapeHtml(title)}</strong></p>`,
  ];

  if (ritual.priorities.length > 0) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionPrioritiesLabel || "Top priorities")}</strong></p>`,
      buildListBlock(ritual.priorities),
    );
  }
  if (ritual.focusIntent?.trim()) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionFocusIntentLabel || "Focus intention")}</strong></p>`,
      `<p>${escapeHtml(ritual.focusIntent.trim())}</p>`,
    );
  }
  if (ritual.habitIntent?.trim()) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionHabitIntentLabel || "Habit anchor")}</strong></p>`,
      `<p>${escapeHtml(ritual.habitIntent.trim())}</p>`,
    );
  }
  if (ritual.wins.length > 0) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionWinsLabel || "What moved")}</strong></p>`,
      buildListBlock(ritual.wins),
    );
  }
  if (ritual.drains.length > 0) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionDrainsLabel || "What drained you")}</strong></p>`,
      buildListBlock(ritual.drains),
    );
  }
  if (ritual.gratitude?.trim()) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionGratitudeLabel || "Gratitude")}</strong></p>`,
      `<p>${escapeHtml(ritual.gratitude.trim())}</p>`,
    );
  }
  if (ritual.carryForward?.trim()) {
    sections.push(
      `<p><strong>${escapeHtml(tx.reflectionCarryForwardLabel || "Carry forward")}</strong></p>`,
      `<p>${escapeHtml(ritual.carryForward.trim())}</p>`,
    );
  }
  if (ritual.note?.trim()) {
    sections.push(`<p>${escapeHtml(ritual.note.trim())}</p>`);
  }

  return {
    title,
    content: sections.filter(Boolean).join(""),
    mood: ritual.mood,
    date: ritual.date,
  };
}

export function getRecommendedRitualType(
  openingRitual: DayRitual | undefined,
  closingRitual: DayRitual | undefined,
  now = new Date(),
): "opening" | "closing" | null {
  if (!openingRitual && now.getHours() < MORNING_RITUAL_CUTOFF_HOUR) {
    return "opening";
  }
  if (!closingRitual && now.getHours() >= MORNING_RITUAL_CUTOFF_HOUR) {
    return "closing";
  }
  if (!openingRitual) return "opening";
  if (!closingRitual) return "closing";
  return null;
}

export function upsertDayRitual(
  rituals: DayRitual[],
  nextRitual: DayRitual,
): DayRitual[] {
  const next = rituals.filter((ritual) => ritual.id !== nextRitual.id);
  next.push(nextRitual);
  next.sort((a, b) => a.updatedAt - b.updatedAt);
  return next;
}

export function buildJournalSuggestions(args: {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  rituals: DayRitual[];
  tx: Record<string, string>;
  excludeSources?: JournalEntrySuggestion["source"][];
  now?: Date;
}): JournalEntrySuggestion[] {
  const {
    moods,
    habits,
    focusSessions,
    gratitudeEntries,
    rituals,
    tx,
    excludeSources = [],
    now = new Date(),
  } = args;
  const today = getToday();
  const suggestions: Array<JournalEntrySuggestion & { priority: number }> = [];

  const todayRituals = rituals.filter((ritual) => ritual.date === today);
  const opening = todayRituals.find((ritual) => ritual.type === "opening");
  const closing = todayRituals.find((ritual) => ritual.type === "closing");
  if (opening) suggestions.push({ ...buildRitualSuggestion(opening, tx), priority: 100 });
  if (closing) suggestions.push({ ...buildRitualSuggestion(closing, tx), priority: 99 });

  const latestMood = [...moods]
    .filter((entry) => entry.date === today)
    .sort((a, b) => b.timestamp - a.timestamp)[0];
  if (latestMood) {
    suggestions.push({ ...buildMoodSuggestion(latestMood, tx), priority: 96 });
  }

  const latestFocus = [...focusSessions]
    .filter((session) => session.date === today && session.status !== "aborted")
    .sort((a, b) => b.completedAt - a.completedAt)[0];
  if (latestFocus) {
    suggestions.push({ ...buildFocusSuggestion(latestFocus, tx), priority: 92 });
  }

  const activeHabits = habits.filter((habit) => !habit.isArchived);
  const completedHabitNames = activeHabits
    .filter((habit) => isHabitCompletedOnDate(habit, today))
    .map((habit) => habit.name);
  if (activeHabits.length > 0 && completedHabitNames.length === activeHabits.length) {
    suggestions.push({
      ...buildHabitSuggestion(completedHabitNames, today, tx),
      priority: 88,
    });
  }

  if (gratitudeEntries.filter((entry) => entry.date === today).length === 0 && now.getHours() >= 18) {
    suggestions.push({
      id: `weekly-review-${today}`,
      source: "weekly-review",
      scope: "day",
      committedAt: now.getTime(),
      note: tx.reflectionSuggestionEvening || "Capture what mattered before the day fades.",
      contextLabel: tx.reflectionSuggestionEvening || "Capture what mattered before the day fades.",
      prefill: {
        title: tx.reflectionSuggestionEvening || "Capture what mattered before the day fades.",
        content: `<p>${escapeHtml(
          tx.reflectionSuggestionEvening || "Capture what mattered before the day fades.",
        )}</p>`,
        date: today,
      },
      priority: 70,
    });
  }

  const seen = new Set<string>();
  return suggestions
    .filter((suggestion) => !excludeSources.includes(suggestion.source))
    .filter((suggestion) => {
      const key = suggestion.id || `${suggestion.source}-${suggestion.committedAt || today}`;
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    })
    .sort((a, b) => b.priority - a.priority)
    .slice(0, 3)
    .map(({ priority: _priority, ...suggestion }) => suggestion);
}

function buildOpeningFocusInsight(
  rituals: DayRitual[],
  focusSessions: FocusSession[],
  tx: Record<string, string>,
): ReflectionInsightCard | null {
  const openingDates = new Set(
    rituals.filter((ritual) => ritual.type === "opening").map((ritual) => ritual.date),
  );
  if (openingDates.size < 3) return null;

  const focusByDate = new Map<string, number[]>();
  for (const session of focusSessions) {
    if (session.status === "aborted") continue;
    const list = focusByDate.get(session.date) ?? [];
    list.push(session.duration);
    focusByDate.set(session.date, list);
  }

  const ritualDayAverages = [...openingDates]
    .map((date) => average(focusByDate.get(date) ?? []))
    .filter((value) => value > 0);
  const otherDayAverages = [...focusByDate.entries()]
    .filter(([date]) => !openingDates.has(date))
    .map(([, values]) => average(values))
    .filter((value) => value > 0);

  if (ritualDayAverages.length < 3 || otherDayAverages.length < 2) return null;

  const withRitual = average(ritualDayAverages);
  const withoutRitual = average(otherDayAverages);
  const delta = withRitual - withoutRitual;
  if (delta < 5) return null;

  const confidence = Math.min(0.95, 0.58 + ritualDayAverages.length * 0.06);
  return {
    id: "ritual-opening-focus-anchor",
    source: "ritual-pattern",
    title:
      tx.reflectionInsightMorningAnchorTitle || "Morning check-ins anchor your focus",
    summary:
      (tx.reflectionInsightMorningAnchorBody || "On days that begin with an opening ritual, your focus sessions run {delta} minutes longer.")
        .replace("{delta}", Math.round(delta).toString()),
    experiment:
      tx.reflectionInsightMorningExperiment ||
      "Keep your opening ritual before the first focus block for the next 5 days.",
    confidence,
    impact: impactFromConfidence(confidence),
    evidence: [
      {
        label: tx.reflectionEvidenceRitualDays || "Ritual days",
        detail: `${Math.round(withRitual)} ${tx.minutes || "min"} avg`,
      },
      {
        label: tx.reflectionEvidenceOtherDays || "Other days",
        detail: `${Math.round(withoutRitual)} ${tx.minutes || "min"} avg`,
      },
      {
        label: tx.reflectionEvidenceSample || "Sample",
        detail: `${ritualDayAverages.length} ${tx.days || "days"}`,
      },
    ],
    status: "new",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

function buildClosingMoodInsight(
  rituals: DayRitual[],
  moods: MoodEntry[],
  tx: Record<string, string>,
): ReflectionInsightCard | null {
  const closingDates = new Set(
    rituals.filter((ritual) => ritual.type === "closing").map((ritual) => ritual.date),
  );
  if (closingDates.size < 3) return null;

  const moodByDate = new Map<string, number[]>();
  for (const mood of moods) {
    const list = moodByDate.get(mood.date) ?? [];
    list.push(moodScore(mood));
    moodByDate.set(mood.date, list);
  }

  const nextDayWithClosing = [...closingDates]
    .map((date) => average(moodByDate.get(shiftDateString(date, 1)) ?? []))
    .filter((value) => value > 0);
  const nextDayWithoutClosing = [...moodByDate.entries()]
    .filter(([date]) => !closingDates.has(shiftDateString(date, -1)))
    .map(([, values]) => average(values))
    .filter((value) => value > 0);

  if (nextDayWithClosing.length < 3 || nextDayWithoutClosing.length < 3) return null;

  const withClosing = average(nextDayWithClosing);
  const withoutClosing = average(nextDayWithoutClosing);
  const delta = withClosing - withoutClosing;
  if (delta < 0.3) return null;

  const confidence = Math.min(0.92, 0.55 + nextDayWithClosing.length * 0.05);
  return {
    id: "ritual-closing-mood-lift",
    source: "ritual-pattern",
    title:
      tx.reflectionInsightClosingLiftTitle || "Evening closure carries into tomorrow",
    summary:
      (tx.reflectionInsightClosingLiftBody || "The morning after a closing ritual, your mood averages {delta} points higher.")
        .replace("{delta}", delta.toFixed(1)),
    experiment:
      tx.reflectionInsightClosingExperiment ||
      "Try a 60-second closing ritual before bed for the next week.",
    confidence,
    impact: impactFromConfidence(confidence),
    evidence: [
      {
        label: tx.reflectionEvidenceRitualDays || "Ritual days",
        detail: `${withClosing.toFixed(1)}/5`,
      },
      {
        label: tx.reflectionEvidenceOtherDays || "Other days",
        detail: `${withoutClosing.toFixed(1)}/5`,
      },
      {
        label: tx.reflectionEvidenceSample || "Sample",
        detail: `${nextDayWithClosing.length} ${tx.days || "days"}`,
      },
    ],
    status: "new",
    createdAt: Date.now(),
    updatedAt: Date.now(),
  };
}

export function buildReflectionInsights(args: {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  rituals: DayRitual[];
  tx: Record<string, string>;
}): ReflectionInsightCard[] {
  const { moods, habits, focusSessions, rituals, tx } = args;
  const translatedInsights = generateInsights(
    moods,
    habits,
    focusSessions,
    createInsightTranslations(tx),
  )
    .filter(
      (insight) =>
        insight.type !== "mood-habit-correlation" &&
        insight.type !== "mood-tag",
    )
    .slice(0, 2)
    .map((insight) => convertInsightToReflectionCard(insight, tx));

  const ritualInsights = [
    buildOpeningFocusInsight(rituals, focusSessions, tx),
    buildClosingMoodInsight(rituals, moods, tx),
  ].filter(Boolean) as ReflectionInsightCard[];

  return [...ritualInsights, ...translatedInsights]
    .sort((a, b) => b.confidence - a.confidence)
    .slice(0, 4);
}

export function mergeReflectionInsights(
  existing: ReflectionInsightCard[],
  generated: ReflectionInsightCard[],
): ReflectionInsightCard[] {
  const existingMap = new Map(existing.map((insight) => [insight.id, insight]));
  const merged: ReflectionInsightCard[] = generated.map((candidate) => {
    const prior = existingMap.get(candidate.id);
    return prior
      ? {
          ...candidate,
          status: prior.status,
          createdAt: prior.createdAt,
          updatedAt: candidate.updatedAt,
        }
      : candidate;
  });

  for (const prior of existing) {
    if (generated.some((candidate) => candidate.id === prior.id)) continue;
    if (prior.status === "saved" || prior.status === "testing" || prior.status === "learned") {
      merged.push(prior);
    }
  }

  return merged.sort((a, b) => b.confidence - a.confidence);
}

export function getTodayRitualSnapshot(rituals: DayRitual[]): {
  opening: DayRitual | undefined;
  closing: DayRitual | undefined;
} {
  const today = getToday();
  return {
    opening: rituals.find((ritual) => ritual.date === today && ritual.type === "opening"),
    closing: rituals.find((ritual) => ritual.date === today && ritual.type === "closing"),
  };
}

export function createDayRitualDraft(
  type: DayRitual["type"],
  values: Partial<DayRitual>,
  existing?: DayRitual,
): DayRitual {
  const now = Date.now();
  const date = getToday();
  return {
    id: `${type}-${date}`,
    type,
    date,
    timestamp: existing?.timestamp ?? now,
    updatedAt: now,
    mood: values.mood,
    energy: values.energy,
    priorities: normalizeLines(values.priorities ?? []),
    focusIntent: values.focusIntent?.trim(),
    habitIntent: values.habitIntent?.trim(),
    wins: normalizeLines(values.wins ?? []),
    drains: normalizeLines(values.drains ?? []),
    carryForward: values.carryForward?.trim(),
    gratitude: values.gratitude?.trim(),
    note: values.note?.trim(),
  };
}
