import { describe, expect, it } from "vitest";
import { loadLanguage } from "../translations";
import type { Language } from "../types";

const LANGUAGES: readonly Language[] = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const PLAIN_STATS_KEYS = [
  "identityMappingHint",
  "identityVotePreview",
  "identityVoteFor",
  "identityVoteCast",
  "identityVotePending",
  "habitStatsProofCounted",
  "habitStatsNoProof",
  "habitStatsPace",
  "habitStatsNeedsToday",
  "habitStatsProof",
  "habitStatsLowData",
  "habitStatsDataGrowing",
  "habitStatsRecentProof",
  "navV2HabitsAddCue",
  "navV2HabitsIdentityIntentions",
] as const;

describe("habit stats plain-language copy", () => {
  it("keeps the habit detail metrics defined in every supported language", async () => {
    for (const language of LANGUAGES) {
      const translations = await loadLanguage(language);
      for (const key of PLAIN_STATS_KEYS) {
        expect(translations[key], `${language}.${key}`).toBeTruthy();
      }
      expect(
        translations.navV2HabitsIdentityIntentions.split("|"),
        `${language}.navV2HabitsIdentityIntentions`,
      ).toHaveLength(31);
    }
  });

  it("uses plain metric labels for the English and Ukrainian habit detail cards", async () => {
    const en = await loadLanguage("en");
    const uk = await loadLanguage("uk");

    expect(en.habitStatsPace).toBe("Completion");
    expect(en.habitStatsProof).toBe("Check-ins");
    expect(en.habitStatsRecentProof).toBe("Recent check-ins");
    expect(en.identityVotePreview).toBe(
      "After saving, the card shows this purpose; each completion becomes a small step.",
    );
    expect(en.identityVoteFor).toBe("Step toward {identity}");
    expect(en.identityVotePending).toBe("ready to mark");
    expect(en.navV2HabitsAddCue).toBe("Cue • action • check-in");
    expect(en.navV2HabitsIdentityIntentions.split("|")).toHaveLength(31);
    expect(uk.habitStatsPace).toBe("Виконання");
    expect(uk.habitStatsProof).toBe("Відмітки");
    expect(uk.habitStatsRecentProof).toBe("Останні відмітки");
    expect(uk.identityVotePreview).toBe(
      "Після збереження картка покаже цей сенс; кожне виконання стане маленьким кроком.",
    );
    expect(uk.identityVoteFor).toBe("Крок до {identity}");
    expect(uk.identityVotePending).toBe("можна відмітити");
    expect(uk.navV2HabitsAddCue).toBe("Сигнал • дія • відмітка");
    expect(uk.navV2HabitsIdentityIntentions.split("|")).toHaveLength(31);
    expect(uk.navV2HabitsIdentityIntentions).not.toContain("тим, хто робить крок без шуму");
    expect(uk.navV2HabitsIdentityIntentions.split("|")[3]).toBe(
      "людиною, яка збирає день по краплі дії",
    );
    expect(uk.navV2HabitsIdentityIntentions.split("|")[4]).toBe(
      "людиною, яка не зникає з власного життя",
    );
  });
});
