import { describe, expect, it } from "vitest";
import {
  JOURNAL_AUDIO_MAX_BYTES,
  assertValidJournalAudio,
  inspectJournalAudioDataUrl,
} from "../journalAudioValidation";

describe("journalAudioValidation", () => {
  it("accepts a supported data URL when its declared and expected MIME types match", () => {
    expect(
      inspectJournalAudioDataUrl(
        "data:audio/webm;base64,YXVkaW8=",
        "audio/webm;codecs=opus",
      ),
    ).toEqual({ byteLength: 5, mimeType: "audio/webm" });
  });

  it("accepts the parameterized Opus data URL emitted by Chromium MediaRecorder", () => {
    expect(
      inspectJournalAudioDataUrl(
        "data:audio/webm;codecs=opus;base64,YXVkaW8=",
        "audio/webm",
      ),
    ).toEqual({ byteLength: 5, mimeType: "audio/webm" });
  });

  it("rejects spoofed, mismatched, and malformed audio data URLs", () => {
    expect(
      inspectJournalAudioDataUrl("data:text/html;base64,PHNjcmlwdD4=", "audio/webm"),
    ).toBeNull();
    expect(
      inspectJournalAudioDataUrl("data:audio/mp4;base64,YXVkaW8=", "audio/webm"),
    ).toBeNull();
    expect(
      inspectJournalAudioDataUrl("data:audio/webm;base64,%%%", "audio/webm"),
    ).toBeNull();
  });

  it("rejects oversized or overlong recordings before persistence", () => {
    const oversizedPayload = "A".repeat(Math.ceil((JOURNAL_AUDIO_MAX_BYTES * 4) / 3) + 8);
    expect(() =>
      assertValidJournalAudio(
        `data:audio/webm;base64,${oversizedPayload}`,
        10,
        "audio/webm",
      ),
    ).toThrow("too large");
    expect(() =>
      assertValidJournalAudio(
        "data:audio/webm;base64,YXVkaW8=",
        301,
        "audio/webm",
      ),
    ).toThrow("duration");
  });
});
