import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";
import {
  APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT,
  getAppBackgroundMusicEnabled,
  subscribeAppBackgroundMusicPreference,
  trySetAppBackgroundMusicEnabled,
} from "../appBackgroundMusicPreference";

describe("app background music preference", () => {
  beforeEach(() => {
    localStorage.clear();
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("defaults malformed or absent state to disabled", () => {
    expect(getAppBackgroundMusicEnabled()).toBe(false);

    localStorage.setItem("zenflow-app-background-music-enabled", JSON.stringify("yes"));
    expect(getAppBackgroundMusicEnabled()).toBe(false);
  });

  it("persists an explicit opt-in and exposes the durable value", () => {
    expect(trySetAppBackgroundMusicEnabled(true)).toEqual({ ok: true, enabled: true });
    expect(getAppBackgroundMusicEnabled()).toBe(true);
    expect(localStorage.getItem("zenflow-app-background-music-enabled")).toBe("true");
  });

  it("keeps the previous durable value when storage rejects the write", () => {
    expect(trySetAppBackgroundMusicEnabled(true)).toEqual({ ok: true, enabled: true });
    vi.spyOn(Storage.prototype, "setItem").mockImplementation(() => {
      throw new DOMException("blocked", "QuotaExceededError");
    });

    expect(trySetAppBackgroundMusicEnabled(false)).toEqual({ ok: false, enabled: true });
    expect(getAppBackgroundMusicEnabled()).toBe(true);
  });

  it("notifies subscribers only after a successful change", () => {
    const listener = vi.fn();
    const unsubscribe = subscribeAppBackgroundMusicPreference(listener);

    expect(trySetAppBackgroundMusicEnabled(true)).toEqual({ ok: true, enabled: true });
    expect(listener).toHaveBeenCalledWith(true);
    expect(listener).toHaveBeenCalledTimes(1);

    unsubscribe();
    window.dispatchEvent(
      new CustomEvent(APP_BACKGROUND_MUSIC_PREFERENCE_CHANGE_EVENT, { detail: false }),
    );
    expect(listener).toHaveBeenCalledTimes(1);
  });
});
