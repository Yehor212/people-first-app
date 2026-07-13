import { beforeEach, describe, expect, it, vi } from "vitest";

import { getHapticsPreference } from "../hapticsPreference";
import {
  LEGACY_FEEDBACK_MIGRATION_COMPLETE,
  migrateLegacyFeedbackSettings,
} from "../legacyFeedbackMigration";
import { getMotionPreference } from "../motionPreference";
import { SK } from "../storageKeys";

describe("legacy Settings preference migration", () => {
  beforeEach(() => {
    localStorage.clear();
    vi.restoreAllMocks();
  });

  it("preserves reduced motion and native haptics, then removes the legacy source", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({
        intensity: "adhd",
        animations: false,
        sounds: false,
        haptics: true,
        confetti: false,
        streakFire: false,
        moodDrivenUI: false,
      }),
    );
    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: true, migrated: true });
    expect(getMotionPreference()).toEqual({ reduceMotion: true });
    expect(getHapticsPreference()).toEqual({ enabled: true });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).toBeNull();
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_MIGRATION)).toBe(
      LEGACY_FEEDBACK_MIGRATION_COMPLETE,
    );
  });

  it("does not turn a retired sound flag into a newer master mute choice", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: true, sounds: false, haptics: false }),
    );
    localStorage.setItem(SK.AUDIO_MUTED, "false");

    migrateLegacyFeedbackSettings();

    expect(localStorage.getItem(SK.AUDIO_MUTED)).toBe("false");
  });

  it("maps an explicit legacy animations-on choice to reduced-motion off", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: true, haptics: false }),
    );

    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: true, migrated: true });
    expect(getMotionPreference()).toEqual({ reduceMotion: false });
    expect(getHapticsPreference()).toEqual({ enabled: false });
  });

  it("is idempotent when cleanup must be retried and never overwrites newer choices", () => {
    localStorage.setItem(SK.LEGACY_FEEDBACK_MIGRATION, LEGACY_FEEDBACK_MIGRATION_COMPLETE);
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: false, haptics: true }),
    );
    localStorage.setItem(SK.REDUCE_MOTION, JSON.stringify({ reduceMotion: false }));
    localStorage.setItem(SK.HAPTICS_ENABLED, JSON.stringify({ enabled: false }));

    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: true, migrated: false });
    expect(getMotionPreference().reduceMotion).toBe(false);
    expect(getHapticsPreference().enabled).toBe(false);
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).toBeNull();
  });

  it("keeps the legacy source and rolls back destination writes when persistence fails", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: false, haptics: true }),
    );
    const originalSetItem = Storage.prototype.setItem;
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(function (
      this: Storage,
      key,
      value,
    ) {
      if (key === SK.HAPTICS_ENABLED) {
        throw new DOMException("full", "QuotaExceededError");
      }
      return originalSetItem.call(this, key, value);
    });

    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: false });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).not.toBeNull();
    expect(localStorage.getItem(SK.REDUCE_MOTION)).not.toBeNull();
    expect(localStorage.getItem(SK.HAPTICS_ENABLED)).toBeNull();
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_MIGRATION)).toBeNull();
  });

  it("cleans corrupt legacy JSON without inventing user preferences", () => {
    localStorage.setItem(SK.LEGACY_FEEDBACK_SETTINGS, "{broken");

    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: true, migrated: false });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).toBeNull();
    expect(localStorage.getItem(SK.REDUCE_MOTION)).toBeNull();
    expect(localStorage.getItem(SK.HAPTICS_ENABLED)).toBeNull();
  });

  it("retries legacy cleanup after the destination values and marker were saved", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: false, haptics: true }),
    );
    const originalRemoveItem = Storage.prototype.removeItem;
    const remove = vi.spyOn(Storage.prototype, "removeItem").mockImplementation(function (
      this: Storage,
      key,
    ) {
      if (key === SK.LEGACY_FEEDBACK_SETTINGS) {
        throw new DOMException("blocked", "SecurityError");
      }
      return originalRemoveItem.call(this, key);
    });

    expect(migrateLegacyFeedbackSettings()).toMatchObject({
      ok: false,
      cleanupPending: true,
    });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_MIGRATION)).toBe(
      LEGACY_FEEDBACK_MIGRATION_COMPLETE,
    );

    remove.mockRestore();
    expect(migrateLegacyFeedbackSettings()).toMatchObject({ ok: true, migrated: false });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).toBeNull();
    expect(getMotionPreference()).toEqual({ reduceMotion: true });
    expect(getHapticsPreference()).toEqual({ enabled: true });
  });

  it("fails closed when a purpose-named destination contains an invalid value", () => {
    localStorage.setItem(
      SK.LEGACY_FEEDBACK_SETTINGS,
      JSON.stringify({ animations: false, haptics: true }),
    );
    localStorage.setItem(SK.REDUCE_MOTION, JSON.stringify({ reduceMotion: "sometimes" }));

    expect(migrateLegacyFeedbackSettings()).toEqual({
      ok: false,
      migrated: false,
      reason: "invalid-motion-target",
    });
    expect(localStorage.getItem(SK.LEGACY_FEEDBACK_SETTINGS)).not.toBeNull();
  });
});
