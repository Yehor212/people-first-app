import { readFileSync } from "node:fs";
import { resolve } from "node:path";

import { describe, expect, it } from "vitest";

type T180Counters = {
  adRequests: number;
  habitCompletions: number;
  journalRows: number;
  rewards: number;
  sdkOrUmpOperations: number;
};

function assertT180FailClosedCounters(counters: T180Counters): void {
  if (counters.habitCompletions !== 1) throw new Error("habit must remain exactly once");
  if (counters.journalRows !== 1) throw new Error("journal must remain exactly once");
  if (counters.rewards !== 0) throw new Error("reward must stay off");
  if (counters.adRequests !== 0) throw new Error("ad transport must stay off");
  if (counters.sdkOrUmpOperations !== 0) throw new Error("Ad SDK and UMP must stay off");
}

function source(relativePath: string): string {
  return readFileSync(resolve(process.cwd(), relativePath), "utf8");
}

describe("T180-R2 Android failure/restart negative controls", () => {
  it("rejects every duplicate/loss/reward/transport mutation instead of promoting it", () => {
    const passing: T180Counters = {
      habitCompletions: 1,
      journalRows: 1,
      rewards: 0,
      adRequests: 0,
      sdkOrUmpOperations: 0,
    };
    expect(() => assertT180FailClosedCounters(passing)).not.toThrow();

    for (const mutation of [
      { ...passing, habitCompletions: 2 },
      { ...passing, habitCompletions: 0 },
      { ...passing, journalRows: 2 },
      { ...passing, journalRows: 0 },
      { ...passing, rewards: 1 },
      { ...passing, adRequests: 1 },
      { ...passing, sdkOrUmpOperations: 1 },
    ]) {
      expect(() => assertT180FailClosedCounters(mutation)).toThrow();
    }
  });

  it("keeps current legacy advertising callback surfaces separated from habit and journal commits", () => {
    const primaryPaths = [
      "src/storage/habitCompletionCommit.ts",
      "src/features/journal/journalStorage.ts",
      "src/features/journal/useJournal.ts",
      "src/features/journal/JournalModule.tsx",
    ];
    const legacyAds = source("src/lib/adController.ts");
    const primarySource = primaryPaths.map(source).join("\n");

    expect(legacyAds).toContain("return { success: false, rewarded: false, error: 'ads_off' }");
    expect(legacyAds).not.toMatch(/AdMob|UserMessagingPlatform|showRewardVideoAd|prepareRewardVideoAd/);
    expect(primarySource).not.toMatch(/adController|AdContext|AdMob|UserMessagingPlatform/i);
  });
});
