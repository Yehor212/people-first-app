import { runWithDataWriteBarrier } from "@/hooks/useIndexedDB";
import type { MoodEntry } from "@/types";
import { db } from "../db";

export const moodsRepo = db.moods;

export function persistMoodEntryBeforeTransition(
  entry: MoodEntry,
): Promise<MoodEntry> {
  return runWithDataWriteBarrier(
    async () => {
      await moodsRepo.put(entry);
      return entry;
    },
    { refreshFailure: "log" },
  );
}
