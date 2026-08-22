import { BookOpen, CalendarCheck2, Smile, Timer, type LucideIcon } from "lucide-react";

import type { AutomationPreference, AutomationRuleId } from "./types";

export const DEFAULT_CONNECTED_RECORD_RULES: AutomationRuleId[] = [
  "mood.note-to-journal.v1",
  "journal.mood-to-checkin.v1",
];

export const EDITABLE_CONNECTED_RECORD_RULES: ReadonlyArray<{
  id: AutomationRuleId;
  titleKey: string;
  icon: LucideIcon;
}> = [
  { id: "mood.note-to-journal.v1", titleKey: "connectedRecordsRuleMoodJournal", icon: Smile },
  { id: "journal.mood-to-checkin.v1", titleKey: "connectedRecordsRuleJournalMood", icon: BookOpen },
  { id: "focus.to-mapped-habit.v1", titleKey: "connectedRecordsRuleFocusHabit", icon: Timer },
  {
    id: "habit.to-planning.v1",
    titleKey: "connectedRecordsRuleHabitPlanning",
    icon: CalendarCheck2,
  },
];

export function initialConnectedRecordRuleIds(
  preference: AutomationPreference,
): AutomationRuleId[] {
  const supported = preference.enabledRuleIds.filter((ruleId) =>
    EDITABLE_CONNECTED_RECORD_RULES.some((rule) => rule.id === ruleId),
  );
  return supported.length > 0 ? supported : DEFAULT_CONNECTED_RECORD_RULES;
}
