import { beforeEach, describe, expect, it, vi } from "vitest";
import { ENTRY } from "@/types";
import { makeTestHabit } from "@/test/habitFixtures";
import { db } from "@/storage/db";
import { commitHabitEntry, commitHabitToggle } from "@/storage/habitCompletionCommit";
import {
  getAdState,
  initializeAds,
  refreshAdPrivacyOptionsStatus,
  showAdPrivacyOptions,
  showRewardedAd,
} from "@/lib/adController";

describe("commitHabitToggle", () => {
  beforeEach(async () => {
    await db.open();
    await db.habits.clear();
  });

  it("returns only after one durable completion is present in Dexie", async () => {
    const habit = makeTestHabit({ id: "habit-t175", entries: {} });
    await db.habits.put(habit);

    const committed = await commitHabitToggle("habit-t175", "2026-08-20", "quickTap");

    expect(committed.nextValue).toBe(ENTRY.YES_MANUAL);
    expect((await db.habits.get("habit-t175"))?.entries["2026-08-20"]?.value).toBe(
      ENTRY.YES_MANUAL
    );
  });

  it("durably writes a numerical completion before returning it to a publisher", async () => {
    const habit = makeTestHabit({
      id: "habit-t175-numerical",
      habitType: "numerical",
      entries: {},
    });
    await db.habits.put(habit);

    const committed = await commitHabitEntry(
      "habit-t175-numerical",
      "2026-08-20",
      2500,
      "exactInput"
    );

    expect(committed.entries["2026-08-20"]?.value).toBe(2500);
    expect((await db.habits.get("habit-t175-numerical"))?.entries["2026-08-20"]?.value).toBe(2500);
  });

  it("keeps one durable completion across late Ads-OFF calls and a database restart", async () => {
    const habitId = "t180-synthetic-habit";
    const date = "2026-08-21";
    const network = vi.spyOn(globalThis, "fetch").mockRejectedValue(new Error("T180_SYNTHETIC_NETWORK_ERROR"));
    let durableWrites = 0;
    const onUpdating = () => {
      durableWrites += 1;
    };
    db.habits.hook("updating", onUpdating);

    try {
      await db.habits.put(makeTestHabit({ id: habitId, entries: {} }));
      const committed = await commitHabitToggle(habitId, date, "quickTap");
      expect(committed.nextValue).toBe(ENTRY.YES_MANUAL);

      await expect(initializeAds()).resolves.toBe(false);
      await expect(refreshAdPrivacyOptionsStatus()).resolves.toMatchObject({ error: "ads_off" });
      await expect(showAdPrivacyOptions()).resolves.toMatchObject({ error: "ads_off" });
      await expect(showRewardedAd({ zone: "optional_rewards" })).resolves.toEqual({
        success: false,
        rewarded: false,
        error: "ads_off",
      });
      await expect(showRewardedAd({ zone: "optional_rewards" })).resolves.toEqual({
        success: false,
        rewarded: false,
        error: "ads_off",
      });

      db.close();
      await db.open();

      const stored = await db.habits.get(habitId);
      expect(stored?.entries[date]?.value).toBe(ENTRY.YES_MANUAL);
      expect(durableWrites).toBe(1);
      expect(network).not.toHaveBeenCalled();
      expect(getAdState()).toMatchObject({
        canRequestAds: false,
        rewardedReady: false,
        sessionAdCount: 0,
      });
    } finally {
      db.habits.hook("updating").unsubscribe(onUpdating);
      network.mockRestore();
    }
  });
});
