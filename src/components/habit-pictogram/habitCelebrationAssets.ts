import diaryDayTgsUrl from "@/assets/journal/save-ceremony/atelier-v12-3-day.tgs?url";
import diaryDayPosterUrl from "@/assets/journal/save-ceremony/atelier-v12-3-day-first-frame.svg?url";
import drinkWaterTgsUrl from "@/assets/habit-icons/v2/drink-water/completion.tgs?url";
import drinkWaterPosterUrl from "@/assets/habit-icons/v2/drink-water/completion-first-frame.svg?url";
import journalNightTgsUrl from "@/assets/habit-icons/v2/journal/completion-night.tgs?url";
import journalNightPosterUrl from "@/assets/habit-icons/v2/journal/completion-night-first-frame.svg?url";
import meditateTgsUrl from "@/assets/habit-icons/v2/meditate/completion.tgs?url";
import meditatePosterUrl from "@/assets/habit-icons/v2/meditate/completion-first-frame.svg?url";
import quitSmokingTgsUrl from "@/assets/habit-icons/v2/quit-smoking/completion.tgs?url";
import quitSmokingPosterUrl from "@/assets/habit-icons/v2/quit-smoking/completion-first-frame.svg?url";
import tidyRoomTgsUrl from "@/assets/habit-icons/v2/tidy-room/completion.tgs?url";
import tidyRoomPosterUrl from "@/assets/habit-icons/v2/tidy-room/completion-first-frame.svg?url";
import walkDistanceTgsUrl from "@/assets/habit-icons/v2/walk-distance/completion.tgs?url";
import walkDistancePosterUrl from "@/assets/habit-icons/v2/walk-distance/completion-first-frame.svg?url";
import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";

export type HabitCelebrationVariant = "day" | "night";

export interface HabitCelebrationAsset {
  day: string;
  night: string;
  poster: {
    day: string;
    night: string;
  };
  durationMs: 3000;
  source: "user-supplied-tgs" | "theme-paired-journal-tgs";
  sha256: {
    day: string;
    night: string;
  };
  posterSha256: {
    day: string;
    night: string;
  };
}

const singleVariant = (
  tgs: string,
  poster: string,
  sha256: string,
  posterSha256: string,
): HabitCelebrationAsset => ({
  day: tgs,
  night: tgs,
  poster: { day: poster, night: poster },
  durationMs: 3000,
  source: "user-supplied-tgs",
  sha256: { day: sha256, night: sha256 },
  posterSha256: { day: posterSha256, night: posterSha256 },
});

const HABIT_CELEBRATION_ASSETS = new Map<
  V2HabitPictogramId,
  HabitCelebrationAsset
>([
  [
    "drink-water",
    singleVariant(
      drinkWaterTgsUrl,
      drinkWaterPosterUrl,
      "5fde1c49da6cbc405fdd28237254fc6acb07d79a39e7ba38ad31c768f9a4ac38",
      "cbe3f30f1e3c55052a1be72c787b4697b903f21ef285e54aa901a0254e937ce2",
    ),
  ],
  [
    "walk-distance",
    singleVariant(
      walkDistanceTgsUrl,
      walkDistancePosterUrl,
      "5376a1b4e4ab900174fab284a300e3413db6ae10254d4992ec8c9920f2aa997f",
      "d30f50a1ff72ad695b1c5d1f55c9b05320a4e5758ac11a262a3a65966e78c83a",
    ),
  ],
  [
    "meditate",
    singleVariant(
      meditateTgsUrl,
      meditatePosterUrl,
      "647952aeb200b76027cd8185e3780f6fc501e42cbe0323ea91395abca3d814f1",
      "9e8ac70f6008781f2601fc5b4e0b353573ddf0eb7cbdd2e4645765fa3ab56c74",
    ),
  ],
  [
    "tidy-room",
    singleVariant(
      tidyRoomTgsUrl,
      tidyRoomPosterUrl,
      "f308f68449d1964d16866cdefc6ddd55935e13288f53fd064d10f81cf9bd5f1a",
      "fabfc6411fd603df24ad594b8fc5b84b6a7fbd6c4be50306bf6b3d920df76356",
    ),
  ],
  [
    "quit-smoking",
    singleVariant(
      quitSmokingTgsUrl,
      quitSmokingPosterUrl,
      "1cd1405cb69ea8ed1a821d7d5c2f7545400377d99d395f8f577858cc1585ca20",
      "4c67da2d5d13cc87923399c2455ebdbe11b5421145dfd4323f589faa16b9f640",
    ),
  ],
  [
    "journal",
    {
      day: diaryDayTgsUrl,
      night: journalNightTgsUrl,
      poster: {
        day: diaryDayPosterUrl,
        night: journalNightPosterUrl,
      },
      durationMs: 3000,
      source: "theme-paired-journal-tgs",
      sha256: {
        day: "a55c998596f8210664d51f8eb51eb40a090dbc4dc76d8ea7109cdd30098d1170",
        night: "e83a865aa23eb9296b8958d3cee3939fd6561bdb21b2b13caa0424390c2a3475",
      },
      posterSha256: {
        day: "a19eef5891ab135cc8ca22f3d2ac6f0a2da6aacf7a0e04576e5e220ef3fd9f6f",
        night: "bde248d650a0b33103dbf3bb6d3a26037bdb81bfd61ea168b5965dcdb475d07d",
      },
    },
  ],
]);

export const APPROVED_HABIT_CELEBRATION_IDS = new Set<V2HabitPictogramId>(
  HABIT_CELEBRATION_ASSETS.keys(),
);

export function getHabitCelebrationAsset(
  id: V2HabitPictogramId,
): HabitCelebrationAsset | undefined {
  return HABIT_CELEBRATION_ASSETS.get(id);
}

export function getHabitCelebrationAssetUrl(
  id: V2HabitPictogramId,
  variant: HabitCelebrationVariant,
): string | undefined {
  return HABIT_CELEBRATION_ASSETS.get(id)?.[variant];
}

export function getHabitCelebrationPosterUrl(
  id: V2HabitPictogramId,
  variant: HabitCelebrationVariant,
): string | undefined {
  return HABIT_CELEBRATION_ASSETS.get(id)?.poster[variant];
}
