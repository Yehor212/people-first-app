import { beforeEach, describe, expect, it, vi } from "vitest";

let mockStorage: Record<string, unknown> = {};

vi.mock("../safeJson", () => ({
  safeLocalStorageGet: vi.fn((key: string, fallback: unknown) => mockStorage[key] ?? fallback),
  safeLocalStorageSet: vi.fn((key: string, value: unknown) => {
    mockStorage[key] = value;
    return true;
  }),
}));

vi.mock("../storageKeys", () => ({
  SK: {
    AUDIO_COMFORT: "zenflow_audio_comfort",
    AUDIO_COMFORT_FEEDBACK: "zenflow_audio_comfort_feedback",
  },
}));

import {
  AUDIO_COMFORT_PROFILES,
  AUDIO_EVENT_TAXONOMY,
  AUDIO_ROLLOUT_FLAGS,
  applyAudioComfortProfile,
  buildAudioTelemetryEvent,
  canPlayAmbientAsset,
  canPlayFeedbackSound,
  consumeAudioFeedbackBudget,
  getAudioComfortSettings,
  getAudioSupportSnapshot,
  recordAudioComfortFeedback,
  resetAudioComfortRuntimeForTests,
  setAudioComfortSettings,
} from "../audioComfort";

describe("audioComfort", () => {
  beforeEach(() => {
    mockStorage = {};
    resetAudioComfortRuntimeForTests();
  });

  it("defaults to balanced sensory comfort without silent policy drift", () => {
    expect(getAudioComfortSettings()).toMatchObject({
      profile: "balanced",
      ambientEnabled: true,
      completionCuesEnabled: true,
      milestoneCuesEnabled: true,
      reminderCuesEnabled: true,
      hapticsEnabled: false,
      avoidedTextures: [],
    });
  });

  it("applies quiet, balanced, and rich profiles as explicit presets", () => {
    expect(AUDIO_COMFORT_PROFILES.map((profile) => profile.id)).toEqual(["quiet", "balanced", "rich"]);
    expect(AUDIO_COMFORT_PROFILES[0].description).toContain("Hyperfocus sounds only when explicitly selected");

    applyAudioComfortProfile("quiet");
    expect(getAudioComfortSettings()).toMatchObject({
      profile: "quiet",
      ambientEnabled: false,
      completionCuesEnabled: true,
      milestoneCuesEnabled: false,
      reminderCuesEnabled: false,
    });

    applyAudioComfortProfile("rich");
    expect(getAudioComfortSettings()).toMatchObject({
      profile: "rich",
      ambientEnabled: true,
      completionCuesEnabled: true,
      milestoneCuesEnabled: true,
      reminderCuesEnabled: true,
      hapticsEnabled: false,
    });
  });

  it("lets users block ambient textures without turning off all completion cues", () => {
    setAudioComfortSettings({ ambientEnabled: true, avoidedTextures: ["water", "rain"] });

    expect(canPlayAmbientAsset("orb-ambience")).toBe(false);
    expect(canPlayAmbientAsset("diary-reflection-loop")).toBe(false);
    expect(canPlayAmbientAsset("soft-air-veil")).toBe(true);
    expect(canPlayFeedbackSound("complete")).toBe(true);
  });

  it("separates completion, milestone, and reminder cues", () => {
    setAudioComfortSettings({
      completionCuesEnabled: false,
      milestoneCuesEnabled: false,
      reminderCuesEnabled: true,
    });

    expect(canPlayFeedbackSound("success")).toBe(false);
    expect(canPlayFeedbackSound("complete")).toBe(false);
    expect(canPlayFeedbackSound("streak")).toBe(false);
    expect(canPlayFeedbackSound("milestone")).toBe(false);
    expect(canPlayFeedbackSound("notification")).toBe(true);
  });

  it("enforces a fatigue budget for repeated cues in long sessions", () => {
    for (let index = 0; index < 8; index += 1) {
      expect(consumeAudioFeedbackBudget("complete", 1_000)).toBe(true);
    }

    expect(consumeAudioFeedbackBudget("complete", 1_000)).toBe(false);
    expect(consumeAudioFeedbackBudget("complete", 31 * 60 * 1_000)).toBe(true);
  });

  it("stores structured audio comfort feedback without raw text, mood, journal, or user identifiers", () => {
    const entry = recordAudioComfortFeedback({
      choice: "too_loud",
      surface: "settings",
      platform: "web",
      volumeBucket: "medium",
      muted: false,
      ambientEnabled: true,
    });

    expect(entry).toEqual({
      choice: "too_loud",
      surface: "settings",
      platform: "web",
      volumeBucket: "medium",
      muted: false,
      ambientEnabled: true,
      createdAt: expect.any(String),
    });
    expect(JSON.stringify(mockStorage)).not.toMatch(/journal|mood|user|email|text/i);
  });


  it("normalizes tainted stored comfort feedback before appending a new entry", () => {
    mockStorage.zenflow_audio_comfort_feedback = [
      {
        choice: "comfortable",
        surface: "settings",
        platform: "web",
        volumeBucket: "low",
        muted: false,
        ambientEnabled: true,
        createdAt: "2026-06-30T00:00:00.000Z",
        email: "private@example.test",
        rawText: "do not keep",
      },
      { choice: "too_loud", surface: "settings", createdAt: "bad" },
    ];

    recordAudioComfortFeedback({
      choice: "did_not_play",
      surface: "settings",
      platform: "desktop",
      volumeBucket: "muted",
      muted: true,
      ambientEnabled: false,
    });

    expect(mockStorage.zenflow_audio_comfort_feedback).toHaveLength(2);
    expect(mockStorage.zenflow_audio_comfort_feedback).toEqual([
      {
        choice: "comfortable",
        surface: "settings",
        platform: "web",
        volumeBucket: "low",
        muted: false,
        ambientEnabled: true,
        createdAt: "2026-06-30T00:00:00.000Z",
      },
      {
        choice: "did_not_play",
        surface: "settings",
        platform: "desktop",
        volumeBucket: "muted",
        muted: true,
        ambientEnabled: false,
        createdAt: expect.any(String),
      },
    ]);
    expect(JSON.stringify(mockStorage.zenflow_audio_comfort_feedback)).not.toMatch(/email|rawText|private/i);
  });

  it("recovers from wrong-shaped stored comfort feedback", () => {
    mockStorage.zenflow_audio_comfort_feedback = { broken: true };

    expect(() => recordAudioComfortFeedback({
      choice: "comfortable",
      surface: "settings",
      platform: "pwa",
      volumeBucket: "medium",
      muted: false,
      ambientEnabled: true,
    })).not.toThrow();

    expect(mockStorage.zenflow_audio_comfort_feedback).toEqual([
      expect.objectContaining({ choice: "comfortable", platform: "pwa" }),
    ]);
  });

  it("sanitizes support snapshots before they can be attached to support evidence", () => {
    const snapshot = getAudioSupportSnapshot({
      surface: "orb",
      platform: "desktop",
      muted: false,
      volume: 0.5,
      audioContextState: "running<script>",
      unlockState: "unlocked",
      lastErrorCode: "NOT_ALLOWED<script>alert(1)</script>",
    });

    expect(snapshot).toMatchObject({
      schemaVersion: 1,
      surface: "orb",
      platform: "desktop",
      volumeBucket: "medium",
      audioContextState: undefined,
      unlockState: "unlocked",
      lastErrorCode: "NOT_ALLOWEDscriptalert1script",
    });
  });

  it("keeps a master audio rollout kill switch in the release flag registry", () => {
    expect(AUDIO_ROLLOUT_FLAGS).toContain("audio.all.enabled");
    expect(AUDIO_ROLLOUT_FLAGS).toContain("audio.kill_switch");
  });

  it("builds a privacy-safe audio event taxonomy", () => {
    expect(AUDIO_EVENT_TAXONOMY).toEqual([
      "audio_play_intent",
      "audio_play_success",
      "audio_play_blocked",
      "audio_stop",
      "audio_muted",
      "audio_error",
      "audio_feedback_submitted",
    ]);

    expect(
      buildAudioTelemetryEvent({
        name: "audio_play_blocked",
        surface: "orb",
        assetFamily: "orb",
        platform: "pwa",
        outcome: "blocked",
        muted: false,
        volumeBucket: "low",
        errorCode: "NOT_ALLOWED",
      }),
    ).toEqual({
      name: "audio_play_blocked",
      surface: "orb",
      assetFamily: "orb",
      platform: "pwa",
      outcome: "blocked",
      muted: false,
      volumeBucket: "low",
      errorCode: "NOT_ALLOWED",
    });
  });
});
