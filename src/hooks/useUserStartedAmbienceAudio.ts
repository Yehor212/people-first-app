import { useCallback, useEffect, useRef, useState } from "react";
import type { RefObject } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import { logger } from "@/lib/logger";

export type UserStartedAmbiencePlaybackState = "idle" | "pending" | "playing" | "error";

const PLAYBACK_START_TIMEOUT_MS = 10_000;

interface UseUserStartedAmbienceAudioOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  canPlay: boolean;
  volume: number;
  mediaSessionTitle: string;
  loggerScope:
    | "[AuthScreen] Breath ambience"
    | "[JournalSettings] Diary ambience"
    | "[OrbPage] Ambience";
}

export function useUserStartedAmbienceAudio({
  audioRef,
  canPlay,
  volume,
  mediaSessionTitle,
  loggerScope: _loggerScope,
}: UseUserStartedAmbienceAudioOptions) {
  const [playbackState, setPlaybackState] = useState<UserStartedAmbiencePlaybackState>("idle");
  const playAttemptRef = useRef(0);
  const mountedRef = useRef(true);
  const shouldPauseRef = useRef(false);
  const mediaElementErroredRef = useRef(false);
  const lastAudioRef = useRef<HTMLAudioElement | null>(null);
  const pendingPlaybackTimeoutRef = useRef<number | null>(null);

  const setMountedPlaybackState = useCallback((state: UserStartedAmbiencePlaybackState) => {
    if (mountedRef.current) setPlaybackState(state);
  }, []);

  const getAudio = useCallback(() => {
    const audio = audioRef.current ?? lastAudioRef.current;
    if (audio) lastAudioRef.current = audio;
    return audio;
  }, [audioRef]);

  const clearPendingPlaybackTimeout = useCallback(() => {
    if (pendingPlaybackTimeoutRef.current === null) return;
    window.clearTimeout(pendingPlaybackTimeoutRef.current);
    pendingPlaybackTimeoutRef.current = null;
  }, []);

  const stop = useCallback(() => {
    clearPendingPlaybackTimeout();
    playAttemptRef.current += 1;
    const audio = getAudio();
    if (audio && shouldPauseRef.current) audio.pause();
    shouldPauseRef.current = false;
    mediaElementErroredRef.current = false;
    clearAppAudioMediaSession();
    setMountedPlaybackState("idle");
  }, [clearPendingPlaybackTimeout, getAudio, setMountedPlaybackState]);

  const fail = useCallback(
    (error?: unknown) => {
      clearPendingPlaybackTimeout();
      playAttemptRef.current += 1;
      const audio = getAudio();
      if (audio && shouldPauseRef.current) audio.pause();
      shouldPauseRef.current = false;
      mediaElementErroredRef.current = false;
      clearAppAudioMediaSession();
      if (error) logger.warn("[Audio] Playback failed:", error);
      setMountedPlaybackState("error");
    },
    [clearPendingPlaybackTimeout, getAudio, setMountedPlaybackState]
  );

  const toggle = useCallback(() => {
    const audio = getAudio();
    if (!audio) return;

    if (playbackState === "playing" || playbackState === "pending") {
      stop();
      return;
    }

    if (!canPlay) {
      stop();
      return;
    }

    const attempt = playAttemptRef.current + 1;
    playAttemptRef.current = attempt;
    audio.volume = Math.max(0, Math.min(1, volume));
    if (mediaElementErroredRef.current) {
      mediaElementErroredRef.current = false;
      audio.load();
    }
    shouldPauseRef.current = true;
    setMountedPlaybackState("pending");
    clearPendingPlaybackTimeout();
    pendingPlaybackTimeoutRef.current = window.setTimeout(() => {
      if (!mountedRef.current || playAttemptRef.current !== attempt) return;
      fail(new Error("Playback start timed out"));
    }, PLAYBACK_START_TIMEOUT_MS);

    void audio
      .play()
      .then(() => {
        if (!mountedRef.current || playAttemptRef.current !== attempt) return;
        clearPendingPlaybackTimeout();
        mediaElementErroredRef.current = false;
        setPlaybackState("playing");
        setAppAudioMediaSession({
          title: mediaSessionTitle,
          onPause: stop,
          onStop: stop,
        });
      })
      .catch((error) => {
        if (!mountedRef.current || playAttemptRef.current !== attempt) return;
        clearPendingPlaybackTimeout();
        shouldPauseRef.current = false;
        mediaElementErroredRef.current = false;
        clearAppAudioMediaSession();
        logger.warn("[Audio] Playback failed:", error);
        setPlaybackState("error");
      });
  }, [
    canPlay,
    clearPendingPlaybackTimeout,
    fail,
    getAudio,
    mediaSessionTitle,
    playbackState,
    setMountedPlaybackState,
    stop,
    volume,
  ]);

  const handleMediaPlay = useCallback(() => {
    if (!canPlay || !mountedRef.current || !shouldPauseRef.current) return;
    if (playbackState !== "playing") return;
    mediaElementErroredRef.current = false;
    setAppAudioMediaSession({
      title: mediaSessionTitle,
      onPause: stop,
      onStop: stop,
    });
  }, [canPlay, mediaSessionTitle, playbackState, stop]);

  const handleMediaPause = useCallback(() => {
    if (!mountedRef.current) return;

    const audio = getAudio();
    setPlaybackState((current) => {
      if (current === "pending" || current === "error") return current;
      if (current === "playing" && audio && !audio.paused) return current;

      shouldPauseRef.current = false;
      clearAppAudioMediaSession();
      return "idle";
    });
  }, [getAudio]);

  const handleMediaError = useCallback(() => {
    if (!mountedRef.current) return;
    mediaElementErroredRef.current = true;
    if (!canPlay || !shouldPauseRef.current) return;
    fail();
    mediaElementErroredRef.current = true;
  }, [canPlay, fail]);

  useEffect(() => {
    const audio = getAudio();
    if (!audio) return;

    audio.volume = Math.max(0, Math.min(1, volume));
    if (!canPlay && (playbackState === "playing" || playbackState === "pending")) {
      stop();
    }
  }, [canPlay, getAudio, playbackState, stop, volume]);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.hidden) stop();
    };
    const stopOnPageHide = () => stop();
    let cancelled = false;
    let pauseListener: PluginListenerHandle | null = null;

    document.addEventListener("visibilitychange", stopOnHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("pause", stop))
      .then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        pauseListener = listener;
      })
      .catch((error) => {
        logger.warn("[Audio] Failed to register ambience pause listener:", error);
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", stopOnHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
      if (pauseListener) void pauseListener.remove();
    };
  }, [stop]);

  useEffect(() => {
    mountedRef.current = true;

    return () => {
      mountedRef.current = false;
      clearPendingPlaybackTimeout();
      playAttemptRef.current += 1;
      const audio = getAudio();
      if (audio && shouldPauseRef.current) audio.pause();
      shouldPauseRef.current = false;
      clearAppAudioMediaSession();
    };
  }, [clearPendingPlaybackTimeout, getAudio]);

  return {
    playbackState,
    isPlaying: playbackState === "playing",
    isPending: playbackState === "pending",
    hasError: playbackState === "error",
    toggle,
    stop,
    handleMediaPlay,
    handleMediaPause,
    handleMediaError,
  };
}
