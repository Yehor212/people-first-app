import { getToday } from "@/lib/utils";
import type { Habit } from "@/types";

function parseDate(dateStr: string): Date {
  const [year, month, day] = dateStr.split("-").map(Number);
  return new Date(year, month - 1, day);
}

function formatDate(date: Date): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, "0");
  const day = String(date.getDate()).padStart(2, "0");
  return `${year}-${month}-${day}`;
}

function diffDays(from: string, to: string): number {
  const msPerDay = 86400000;
  return Math.round((parseDate(to).getTime() - parseDate(from).getTime()) / msPerDay);
}

export function calculateHabitEndDate(startDate: string, durationDays: number): string {
  const safeDuration = Math.max(1, Math.round(durationDays));
  const end = parseDate(startDate);
  end.setDate(end.getDate() + safeDuration - 1);
  return formatDate(end);
}

export function getHabitPlanState(
  habit: Pick<Habit, "durationDays" | "startDate" | "endDate">,
  today: string = getToday(),
) {
  if (!habit.durationDays || habit.durationDays < 1) return null;

  const startDate = habit.startDate || today;
  const endDate = habit.endDate || calculateHabitEndDate(startDate, habit.durationDays);
  const elapsedDays = Math.max(0, Math.min(habit.durationDays, diffDays(startDate, today) + 1));
  const remainingDays = endDate >= today ? diffDays(today, endDate) + 1 : 0;

  return {
    durationDays: habit.durationDays,
    startDate,
    endDate,
    elapsedDays,
    remainingDays,
    isComplete: remainingDays === 0,
  };
}
