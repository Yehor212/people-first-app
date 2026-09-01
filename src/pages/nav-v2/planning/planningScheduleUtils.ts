import { formatDate } from "@/lib/utils";
import type { FocusSession, ScheduleEvent } from "@/types";

export function createScheduleEventId(): string {
  if (typeof crypto !== "undefined" && "randomUUID" in crypto) {
    return crypto.randomUUID();
  }
  return `schedule-${Date.now()}-${Math.random().toString(36).slice(2, 10)}`;
}

export function sortScheduleEventsByTime(events: ScheduleEvent[]): ScheduleEvent[] {
  return [...events].sort((a, b) => {
    const aStart = a.startHour * 60 + a.startMinute;
    const bStart = b.startHour * 60 + b.startMinute;
    return aStart - bStart;
  });
}

export function isManualScheduleEvent(event: ScheduleEvent | undefined): event is ScheduleEvent {
  if (!event) return false;
  const manualSource = !event.source || event.source === "manual";
  return manualSource && event.isEditable !== false;
}

export function getLatestCompletedFocusSession(
  focusSessions: readonly FocusSession[]
): FocusSession | null {
  let latest: FocusSession | null = null;

  for (const session of focusSessions) {
    if (session.status === "aborted") continue;
    if (!latest || session.completedAt > latest.completedAt) {
      latest = session;
    }
  }

  return latest;
}

function getTomorrowDate(): string {
  const date = new Date();
  date.setDate(date.getDate() + 1);
  return formatDate(date);
}

export function getInitialScheduleDate(): string | undefined {
  if (typeof window === "undefined") return undefined;

  const value = new URLSearchParams(window.location.search).get("planningDate");
  if (!value) return undefined;
  if (value === "tomorrow") return getTomorrowDate();
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return value;
  return undefined;
}
