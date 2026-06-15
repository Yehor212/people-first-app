import { renderHook, act } from "@testing-library/react";
import { afterEach, describe, expect, it, vi } from "vitest";
import { useAudioRecorder } from "../useAudioRecorder";

describe("useAudioRecorder", () => {
  afterEach(() => {
    vi.unstubAllGlobals();
    vi.restoreAllMocks();
  });

  it("rejects start when microphone permission is denied", async () => {
    const denied = new DOMException("Denied", "NotAllowedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockRejectedValue(denied) },
    });
    vi.stubGlobal("MediaRecorder", class {
      static isTypeSupported() {
        return true;
      }
    });

    const { result } = renderHook(() => useAudioRecorder());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.start();
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(denied);
    expect(result.current.error).toBe("Microphone access denied");
    expect(result.current.isRecording).toBe(false);
  });

  it("stops the opened stream if MediaRecorder setup fails", async () => {
    const stop = vi.fn();
    const stream = {
      getTracks: () => [{ stop }],
    };
    const setupError = new DOMException("Unsupported", "NotSupportedError");
    Object.defineProperty(navigator, "mediaDevices", {
      configurable: true,
      value: { getUserMedia: vi.fn().mockResolvedValue(stream) },
    });
    vi.stubGlobal(
      "MediaRecorder",
      class {
        static isTypeSupported() {
          return true;
        }

        constructor() {
          throw setupError;
        }
      },
    );

    const { result } = renderHook(() => useAudioRecorder());

    let caught: unknown;
    await act(async () => {
      try {
        await result.current.start();
      } catch (err) {
        caught = err;
      }
    });

    expect(caught).toBe(setupError);
    expect(stop).toHaveBeenCalledTimes(1);
    expect(result.current.isRecording).toBe(false);
  });
});
