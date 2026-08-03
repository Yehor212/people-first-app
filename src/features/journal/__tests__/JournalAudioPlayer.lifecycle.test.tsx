import { act, fireEvent, render, screen } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const generator = vi.hoisted(() => ({
  getStatus: vi.fn(() => ({ state: "idle", soundId: null, isUnlocked: false })),
  pause: vi.fn(),
  resumeDirect: vi.fn(),
}));

vi.mock("@/lib/ambientSounds", () => ({
  armAudioUnlockAfterResume: vi.fn(),
  getAmbientSoundGenerator: () => generator,
}));

vi.mock("@/lib/audioManager", () => ({
  resumeOnInteraction: vi.fn(() => Promise.resolve()),
  suspendContext: vi.fn(() => Promise.resolve()),
}));

vi.mock("@/lib/logger", () => ({
  logger: { log: vi.fn(), warn: vi.fn(), error: vi.fn() },
}));

vi.mock("@/contexts/LanguageContext", () => ({
  useLanguage: () => ({
    t: {
      play: "Play recording",
      pause: "Pause recording",
      progress: "Playback progress",
      journalAudioRecordingLabel: "Audio recording {number}, {duration}",
      journalAudioPlay: "Play {label}",
      journalAudioPause: "Pause {label}",
      journalAudioProgress: "{label} playback progress",
      journalAudioPlaybackError: "This recording could not be played.",
      journalAudioRetry: "Try {label} again",
      journalAudioLoading: "Loading {label}",
    },
  }),
}));

import { JournalAudioPlayer } from "../JournalAudioPlayer";
import { pauseAllAudio, resumeAllAudio } from "@/lib/audioLifecycle";

describe("JournalAudioPlayer lifecycle", () => {
  let audio: HTMLAudioElement;
  let play: ReturnType<typeof vi.fn>;
  let pause: ReturnType<typeof vi.fn>;

  beforeEach(() => {
    play = vi.fn(() => Promise.resolve());
    pause = vi.fn();

    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(src: string) {
        audio = document.createElement("audio");
        audio.src = src;
        Object.defineProperty(audio, "play", { configurable: true, value: play });
        Object.defineProperty(audio, "pause", { configurable: true, value: pause });
        return audio;
      }),
    );
  });

  afterEach(() => {
    vi.unstubAllGlobals();
  });

  it("stops private playback on the shared background lifecycle and never auto-resumes it", async () => {
    const view = render(
      <JournalAudioPlayer src="data:audio/webm;base64,private" duration={12} />,
    );

    act(() => {
      audio.dispatchEvent(new Event("loadeddata"));
    });
    const progress = screen.getByRole("slider", {
      name: "Audio recording 1, 0:12 playback progress",
    });
    expect(progress).toHaveAttribute("min", "0");
    expect(progress).toHaveAttribute("max", "12");
    expect(progress).toHaveValue("0");
    fireEvent.click(screen.getByRole("button", { name: "Play Audio recording 1, 0:12" }));
    act(() => {
      audio.dispatchEvent(new Event("play"));
    });
    expect(play).toHaveBeenCalledTimes(1);

    act(() => pauseAllAudio());
    expect(pause).toHaveBeenCalledTimes(1);

    await act(async () => resumeAllAudio());
    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });
    expect(play).toHaveBeenCalledTimes(1);

    view.unmount();
    pause.mockClear();
    act(() => pauseAllAudio());
    expect(pause).not.toHaveBeenCalled();
  });

  it("reports loading and lets keyboard or pointer users seek within a recording", () => {
    render(<JournalAudioPlayer src="data:audio/webm;base64,private" duration={12} />);

    expect(
      screen.getByRole("button", { name: "Loading Audio recording 1, 0:12" }),
    ).toHaveAttribute("aria-busy", "true");

    act(() => {
      audio.dispatchEvent(new Event("loadeddata"));
    });
    const seek = screen.getByRole("slider", {
      name: "Audio recording 1, 0:12 playback progress",
    });
    fireEvent.change(seek, { target: { value: "6" } });

    expect(audio.currentTime).toBe(6);
    expect(seek).toHaveValue("6");
  });

  it("shows a recoverable error when private audio cannot be decoded", () => {
    render(<JournalAudioPlayer src="data:audio/webm;base64,broken" duration={12} />);

    act(() => {
      audio.dispatchEvent(new Event("error"));
    });

    expect(screen.getByRole("alert")).toHaveTextContent("This recording could not be played.");
    fireEvent.click(
      screen.getByRole("button", { name: "Try Audio recording 1, 0:12 again" }),
    );
    expect(Audio).toHaveBeenCalledTimes(2);
  });

  it("reports a rejected play request instead of leaving a silent button", async () => {
    play.mockRejectedValueOnce(new DOMException("Unsupported codec", "NotSupportedError"));
    render(<JournalAudioPlayer src="data:audio/webm;base64,broken" duration={12} />);

    act(() => {
      audio.dispatchEvent(new Event("loadeddata"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Play Audio recording 1, 0:12" }));

    expect(await screen.findByRole("alert")).toHaveTextContent(
      "This recording could not be played.",
    );
  });

  it("pauses the previous private recording before another one starts", () => {
    const players: Array<{
      audio: HTMLAudioElement;
      pause: ReturnType<typeof vi.fn>;
      play: ReturnType<typeof vi.fn>;
    }> = [];
    vi.stubGlobal(
      "Audio",
      vi.fn(function AudioMock(src: string) {
        const element = document.createElement("audio");
        element.src = src;
        const player = {
          audio: element,
          pause: vi.fn(),
          play: vi.fn(() => Promise.resolve()),
        };
        Object.defineProperty(element, "play", { configurable: true, value: player.play });
        Object.defineProperty(element, "pause", { configurable: true, value: player.pause });
        players.push(player);
        return element;
      }),
    );

    render(
      <>
        <JournalAudioPlayer src="data:audio/webm;base64,first" duration={12} index={1} />
        <JournalAudioPlayer src="data:audio/webm;base64,second" duration={8} index={2} />
      </>,
    );
    act(() => {
      players.forEach(({ audio }) => audio.dispatchEvent(new Event("loadeddata")));
    });

    fireEvent.click(screen.getByRole("button", { name: "Play Audio recording 1, 0:12" }));
    act(() => {
      players[0].audio.dispatchEvent(new Event("play"));
    });
    fireEvent.click(screen.getByRole("button", { name: "Play Audio recording 2, 0:08" }));

    expect(players[0].pause).toHaveBeenCalledTimes(1);
    expect(players[1].play).toHaveBeenCalledTimes(1);
  });

  it("keeps progress bounded and uses journal paper colors", () => {
    render(<JournalAudioPlayer src="data:audio/webm;base64,private" duration={12} />);

    act(() => {
      audio.dispatchEvent(new Event("loadeddata"));
      Object.defineProperty(audio, "currentTime", { configurable: true, value: 20 });
      audio.dispatchEvent(new Event("timeupdate"));
    });

    const progress = screen.getByRole("slider", {
      name: "Audio recording 1, 0:12 playback progress",
    });
    expect(progress).toHaveValue("12");
    expect(progress.parentElement?.parentElement?.parentElement).toHaveClass(
      "text-[var(--journal-paper-text,var(--diary-text,hsl(var(--foreground))))]",
    );
    expect(progress).toHaveClass("h-12");
    expect(progress).toHaveStyle({
      accentColor: "var(--journal-paper-text, var(--diary-text, hsl(var(--foreground))))",
    });
  });
});
