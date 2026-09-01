import { formatDate } from "@/lib/utils";

export function resolveInitialPlanningDate(
  search: string | undefined,
  now: Date = new Date(),
): string | undefined {
  if (!search) return undefined;

  const value = new URLSearchParams(search).get("planningDate");
  if (!value) return undefined;
  if (value === "tomorrow") {
    const tomorrow = new Date(now);
    tomorrow.setDate(tomorrow.getDate() + 1);
    return formatDate(tomorrow);
  }
  return /^\d{4}-\d{2}-\d{2}$/.test(value) ? value : undefined;
}

export function alignPlanningNow(today: string, now: Date = new Date()): Date {
  if (formatDate(now) === today) return now;

  const aligned = new Date(now);
  const [year, month, day] = today.split("-").map(Number);
  if (Number.isFinite(year) && Number.isFinite(month) && Number.isFinite(day)) {
    aligned.setFullYear(year, month - 1, day);
  }
  return aligned;
}
