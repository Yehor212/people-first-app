import { act, fireEvent, render, screen, waitFor } from "@testing-library/react";
import { beforeEach, describe, expect, it, vi } from "vitest";
import { useRef } from "react";
import { useUserStartedAmbienceAudio } from "../useUserStartedAmbienceAudio";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}));

vi.mock("@/lib/audioMediaSession", () => ({
  clearAppAudioMediaSession: vi.fn(),
  setAppAudioMediaSession: vi.fn(),
}));

const media = vi.hoisted(() => ({
  load: vi.fn(),
  play: vi.fn(() => Promise.resolve()),
  pause: vi.fn(),
}));

function createDeferred<T = void>() {
  let resolve!: (value: T | PromiseLike<T>) => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<T>((promiseResolve, promiseReject) => {
    resolve = promiseResolve;
    reject = promiseReject;
  });

  return { promise, resolve, reject };
}

function Harness({ canPlay = true }: { canPlay?: boolean }) {
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const ambience = useUserStartedAmbienceAudio({
    audioRef,
    canPlay,
    volume: 0.36,
    mediaSessionTitle: "Gentle water",
    loggerScope: "[test] ambience",
  });

  return (
    <>
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        data-testid="audio"
        ref={audioRef}
        onPlay={ambience.handleMediaPlay}
        onPause={ambience.handleMediaPause}
        onError={ambience.handleMediaError}
      />
      <button
        type="button"
        data-testid="toggle"
        aria-pressed={ambience.isPlaying}
        onClick={ambience.toggle}
      >
        {ambience.playbackState}
      </button>
    </>
  );
}

describe("useUserStartedAmbienceAudio", () => {
  beforeEach(() => {
    media.play.mockReset();
    media.play.mockResolvedValue(undefined);
    media.pause.mockReset();
    media.load.mockReset();
    vi.mocked(clearAppAudioMediaSession).mockClear();
    vi.mocked(setAppAudioMediaSession).mockClear();
    Object.defineProperty(window.HTMLMediaElement.prototype, "play", {
      configurable: true,
      value: media.play,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "pause", {
      configurable: true,
      value: media.pause,
    });
    Object.defineProperty(window.HTMLMediaElement.prototype, "load", {
      configurable: true,
      value: media.load,
    });
  });

  it("ignores stale native play events after a pending attempt is stopped", async () => {
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("pending");

    fireEvent.click(toggle);
    expect(media.pause).toHaveBeenCalledTimes(1);
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("idle");

    fireEvent.play(audio);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("idle");
    expect(setAppAudioMediaSession).not.toHaveBeenCalled();

    playback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("idle"));
    expect(setAppAudioMediaSession).not.toHaveBeenCalled();
  });

  it("ignores stale native play events from a stopped attempt while a newer attempt is pending", async () => {
    const firstPlayback = createDeferred();
    const secondPlayback = createDeferred();
    media.play.mockReturnValueOnce(firstPlayback.promise).mockReturnValueOnce(secondPlayback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("pending");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("idle");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("pending");

    fireEvent.play(audio);

    expect(toggle).toHaveTextContent("pending");
    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(setAppAudioMediaSession).not.toHaveBeenCalled();

    firstPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("pending"));

    secondPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
    expect(setAppAudioMediaSession).toHaveBeenCalledTimes(1);
  });

  it("waits for the current play promise before accepting a native play event", async () => {
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    fireEvent.play(audio);

    expect(toggle).toHaveAttribute("aria-pressed", "false");
    expect(toggle).toHaveTextContent("pending");
    expect(setAppAudioMediaSession).not.toHaveBeenCalled();

    playback.resolve();

    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
    expect(toggle).toHaveAttribute("aria-pressed", "true");
    expect(setAppAudioMediaSession).toHaveBeenCalledWith(
      expect.objectContaining({ title: "Gentle water" })
    );
  });

  it("fails a pending play attempt that never settles so the control cannot hang on loading", async () => {
    vi.useFakeTimers();
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    try {
      render(<Harness />);

      const toggle = screen.getByTestId("toggle");
      fireEvent.click(toggle);

      expect(toggle).toHaveTextContent("pending");

      await act(async () => {
        await vi.advanceTimersByTimeAsync(10_000);
      });

      expect(toggle).toHaveTextContent("error");
      expect(toggle).toHaveAttribute("aria-pressed", "false");
      expect(clearAppAudioMediaSession).toHaveBeenCalled();
    } finally {
      vi.useRealTimers();
    }
  });

  it("reloads the media element before retrying after a real element error", async () => {
    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));

    fireEvent.error(audio);
    await waitFor(() => expect(toggle).toHaveTextContent("error"));

    media.load.mockClear();
    media.play.mockClear();

    fireEvent.click(toggle);

    expect(media.load).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
  });

  it("ignores stale media errors after stop but reloads on the next user start", async () => {
    const playback = createDeferred();
    media.play.mockReturnValueOnce(playback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("pending");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("idle");

    fireEvent.error(audio);

    expect(toggle).toHaveTextContent("idle");
    expect(toggle).toHaveAttribute("aria-pressed", "false");

    media.load.mockClear();
    media.play.mockClear();
    media.play.mockResolvedValueOnce(undefined);

    fireEvent.click(toggle);

    expect(media.load).toHaveBeenCalledTimes(1);
    expect(media.play).toHaveBeenCalledTimes(1);
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
  });

  it("keeps a restarted pending attempt when a stale pause event arrives from the previous stop", async () => {
    const firstPlayback = createDeferred();
    const secondPlayback = createDeferred();
    media.play.mockReturnValueOnce(firstPlayback.promise).mockReturnValueOnce(secondPlayback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    firstPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("idle");

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("pending");

    fireEvent.pause(audio);

    expect(toggle).toHaveTextContent("pending");
    expect(clearAppAudioMediaSession).toHaveBeenCalledTimes(1);

    secondPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
  });

  it("keeps a restarted playing attempt when a stale pause event arrives while media is not paused", async () => {
    const firstPlayback = createDeferred();
    const secondPlayback = createDeferred();
    media.play.mockReturnValueOnce(firstPlayback.promise).mockReturnValueOnce(secondPlayback.promise);

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    firstPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("idle");

    fireEvent.click(toggle);
    secondPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));

    Object.defineProperty(audio, "paused", { configurable: true, value: false });

    fireEvent.pause(audio);

    expect(toggle).toHaveTextContent("playing");
    expect(clearAppAudioMediaSession).toHaveBeenCalledTimes(1);
  });

  it("keeps a retry pending when reload emits a pause event before playback settles", async () => {
    const retryPlayback = createDeferred();

    render(<Harness />);

    const toggle = screen.getByTestId("toggle");
    const audio = screen.getByTestId("audio");

    fireEvent.click(toggle);
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));

    fireEvent.error(audio);
    await waitFor(() => expect(toggle).toHaveTextContent("error"));

    media.play.mockReturnValueOnce(retryPlayback.promise);

    fireEvent.click(toggle);
    expect(toggle).toHaveTextContent("pending");
    expect(media.load).toHaveBeenCalledTimes(1);

    fireEvent.pause(audio);

    expect(toggle).toHaveTextContent("pending");

    retryPlayback.resolve();
    await waitFor(() => expect(toggle).toHaveTextContent("playing"));
  });
});
