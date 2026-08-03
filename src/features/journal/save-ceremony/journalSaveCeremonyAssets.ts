import dayReducedUrl from "@/assets/journal/save-ceremony/atelier-v12-3-day-reduced.svg?url";
import dayTgsUrl from "@/assets/journal/save-ceremony/atelier-v12-3-day.tgs?url";
import nightReducedUrl from "@/assets/journal/save-ceremony/atelier-v12-3-night-reduced.svg?url";
import nightTgsUrl from "@/assets/journal/save-ceremony/atelier-v12-3-night.tgs?url";

import type { JournalSaveCeremonyVariant } from "./journalSaveCeremonyContract";

export const JOURNAL_SAVE_CEREMONY_ASSETS: Record<
  JournalSaveCeremonyVariant,
  { tgs: string; reduced: string }
> = {
  night: {
    tgs: nightTgsUrl,
    reduced: nightReducedUrl,
  },
  day: {
    tgs: dayTgsUrl,
    reduced: dayReducedUrl,
  },
};
