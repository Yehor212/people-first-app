import { act, renderHook } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";

import { useJournalVoice } from "../useJournalVoice";

type RecognitionResult = {
  0: { transcript: string };
  isFinal: boolean;
};

class SpeechRecognitionMock {
  static latest: SpeechRecognitionMock | null = null;

  continuous = false;
  interimResults = false;
  lang = "";
  onresult: ((event: { results: RecognitionResult[]; resultIndex: number }) => void) | null = null;
  onerror: ((event: { error: string }) => void) | null = null;
  onend: (() => void) | null = null;
  start = vi.fn();
  stop = vi.fn();
  abort = vi.fn();

  constructor() {
    SpeechRecognitionMock.latest = this;
  }
}

function result(transcript: string, isFinal = false): RecognitionResult {
  return { 0: { transcript }, isFinal };
}

describe("useJournalVoice", () => {
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
    SpeechRecognitionMock.latest = null;
  });

  it("replaces interim hypotheses instead of duplicating dictated text", () => {
    vi.stubGlobal("SpeechRecognition", SpeechRecognitionMock);
    const { result: hook } = renderHook(() => useJournalVoice("en"));

    act(() => hook.current.start());
    const recognition = SpeechRecognitionMock.latest!;

    act(() => {
      recognition.onresult?.({ results: [result("hello")], resultIndex: 0 });
    });
    expect(hook.current.transcript).toBe("hello");

    act(() => {
      recognition.onresult?.({ results: [result("hello world")], resultIndex: 0 });
    });
    expect(hook.current.transcript).toBe("hello world");

    act(() => {
      recognition.onresult?.({ results: [result("hello world", true)], resultIndex: 0 });
    });
    expect(hook.current.transcript).toBe("hello world");
  });

  it("starts the silence timeout even when recognition returns no result", () => {
    vi.useFakeTimers();
    vi.stubGlobal("SpeechRecognition", SpeechRecognitionMock);
    const { result: hook } = renderHook(() => useJournalVoice("uk"));

    act(() => hook.current.start());
    const recognition = SpeechRecognitionMock.latest!;
    expect(recognition.lang).toBe("uk-UA");

    act(() => {
      vi.advanceTimersByTime(60_000);
    });
    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });

  it("waits for final recognition results before resolving an explicit stop", async () => {
    vi.stubGlobal("SpeechRecognition", SpeechRecognitionMock);
    const { result: hook } = renderHook(() => useJournalVoice("en"));

    act(() => hook.current.start());
    const recognition = SpeechRecognitionMock.latest!;

    let stoppedTranscript: unknown;
    await act(async () => {
      const pendingStop = hook.current.stop();
      recognition.onresult?.({
        results: [result("the final private thought", true)],
        resultIndex: 0,
      });
      recognition.onend?.();
      stoppedTranscript = await pendingStop;
    });

    expect(stoppedTranscript).toBe("the final private thought");
  });

  it("aborts recognition when an explicit stop never reaches onend", async () => {
    vi.useFakeTimers();
    vi.stubGlobal("SpeechRecognition", SpeechRecognitionMock);
    const { result: hook } = renderHook(() => useJournalVoice("en"));

    act(() => hook.current.start());
    const recognition = SpeechRecognitionMock.latest!;

    let stoppedTranscript: string | undefined;
    await act(async () => {
      const pendingStop = hook.current.stop();
      await vi.advanceTimersByTimeAsync(1_500);
      stoppedTranscript = await pendingStop;
    });

    expect(recognition.abort).toHaveBeenCalledTimes(1);
    expect(stoppedTranscript).toBe("");
    expect(hook.current.isListening).toBe(false);
  });

  it("stops dictation when the app moves to the background", () => {
    vi.stubGlobal("SpeechRecognition", SpeechRecognitionMock);
    const { result: hook } = renderHook(() => useJournalVoice("en"));

    act(() => hook.current.start());
    const recognition = SpeechRecognitionMock.latest!;
    act(() => {
      window.dispatchEvent(new Event("pagehide"));
    });

    expect(recognition.stop).toHaveBeenCalledTimes(1);
  });
});
