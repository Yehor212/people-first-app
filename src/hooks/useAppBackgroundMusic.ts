import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  getAppBackgroundMusicEnabled,
  subscribeAppBackgroundMusicPreference,
  trySetAppBackgroundMusicEnabled,
} from "@/lib/appBackgroundMusicPreference";
import {
  registerAudioBackgroundPauseHandler,
  registerAudioForegroundResumeHandler,
} from "@/lib/audioLifecycle";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import {
  claimLongAudio,
  getActiveLongAudioOwner,
  subscribeLongAudioOwner,
} from "@/lib/audioPlaybackCoordinator";
import { logger } from "@/lib/logger";
import { requestRuntimeAudioCacheOnIntent } from "@/lib/runtimeAudioCache";

export type AppBackgroundMusicState =
  | "off"
  | "blocked"
  | "loading"
  | "playing"
  | "paused"
  | "error";

interface UseAppBackgroundMusicOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  canPlay: boolean;
  volume: number;
}

export interface AppBackgroundMusicControl {
  enabled: boolean;
  state: AppBackgroundMusicState;
  toggle: () => void;
  retry: () => void;
  handleMediaError: () => void;
}

const PLAYBACK_OWNER = "global-cloudlight" as const;
const AUTOPLAY_GESTURES = ["pointerdown", "touchstart", "touchend", "keydown"] as const;
const BACKGROUND_MUSIC_CONTROL_SELECTOR = "[data-app-background-music-control]";
type PlaybackStartIntent = "automatic" | "explicit";

function isDocumentHidden(): boolean {
  return typeof document !== "undefined" && document.hidden;
}

function clampVolume(value: number): number {
  if (!Number.isFinite(value)) return 0;
  return Math.min(1, Math.max(0, value));
}

function isAutoplayRejection(error: unknown): boolean {
  return (
    typeof error === "object" &&
    error !== null &&
    "name" in error &&
    error.name === "NotAllowedError"
  );
}

export function useAppBackgroundMusic({
  audioRef,
  canPlay,
  volume,
}: UseAppBackgroundMusicOptions): AppBackgroundMusicControl {
  const [enabled, setEnabled] = useState(() => getAppBackgroundMusicEnabled());
  const [state, setState] = useState<AppBackgroundMusicState>(() =>
    getAppBackgroundMusicEnabled() && !canPlay ? "paused" : "off"
  );
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const canPlayRef = useRef(canPlay);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeAttemptRef = useRef<number | null>(null);
  const releaseOwnershipRef = useRef<(() => void) | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const allowOwnerReleaseResumeRef = useRef(true);
  const foregroundRef = useRef(!isDocumentHidden());

  enabledRef.current = enabled;
  canPlayRef.current = canPlay;

  const transition = useCallback((nextState: AppBackgroundMusicState) => {
    stateRef.current = nextState;
    if (mountedRef.current) setState(nextState);
  }, []);

  const clearGestureRetry = useCallback(() => {
    gestureCleanupRef.current?.();
    gestureCleanupRef.current = null;
  }, []);

  const releaseOwnership = useCallback(() => {
    const release = releaseOwnershipRef.current;
    if (!release) return;

    const releasesActiveGlobalOwner = getActiveLongAudioOwner() === PLAYBACK_OWNER;
    if (releasesActiveGlobalOwner) allowOwnerReleaseResumeRef.current = false;
    releaseOwnershipRef.current = null;
    release();
    if (releasesActiveGlobalOwner) {
      queueMicrotask(() => {
        allowOwnerReleaseResumeRef.current = true;
      });
    }
  }, []);

  const pausePlayback = useCallback(
    (nextState: AppBackgroundMusicState) => {
      requestIdRef.current += 1;
      activeAttemptRef.current = null;
      clearGestureRetry();
      transition(nextState);
      audioRef.current?.pause();
      releaseOwnership();
      clearAppAudioMediaSession();
    },
    [audioRef, clearGestureRetry, releaseOwnership, transition]
  );

  const startPlayback = useCallback(async (
    intent: PlaybackStartIntent = "automatic",
  ): Promise<void> => {
    const audio = audioRef.current;
    if (!audio || !enabledRef.current) {
      transition("off");
      return;
    }
    if (intent === "explicit") {
      void requestRuntimeAudioCacheOnIntent("sounds/cloudlight-evening-loop.mp3").catch(
        (error) => logger.warn("[AppBackgroundMusic] Intent cache request failed:", error),
      );
    }
    if (!foregroundRef.current || isDocumentHidden()) {
      pausePlayback("paused");
      return;
    }
    if (!canPlayRef.current) {
      pausePlayback("paused");
      return;
    }
    if (activeAttemptRef.current !== null) return;
    if (stateRef.current === "playing" && releaseOwnershipRef.current) return;

    const activeOwner = getActiveLongAudioOwner();
    if (
      intent === "automatic" &&
      activeOwner &&
      (activeOwner !== PLAYBACK_OWNER || !releaseOwnershipRef.current)
    ) {
      transition("paused");
      return;
    }

    clearGestureRetry();
    audio.volume = clampVolume(volume);

    if (!releaseOwnershipRef.current) {
      releaseOwnershipRef.current = claimLongAudio(PLAYBACK_OWNER, () => {
        pausePlayback(enabledRef.current ? "paused" : "off");
      });
    }

    const requestId = ++requestIdRef.current;
    activeAttemptRef.current = requestId;
    transition("loading");

    try {
      await Promise.resolve(audio.play());
      if (
        requestIdRef.current !== requestId ||
        !enabledRef.current ||
        !foregroundRef.current ||
        !canPlayRef.current ||
        getActiveLongAudioOwner() !== PLAYBACK_OWNER
      ) {
        audio.pause();
        return;
      }

      activeAttemptRef.current = null;
      transition("playing");
      setAppAudioMediaSession({
        title: "Cloudlight Evening",
        artist: "ZenFlow",
        onPlay: () => {
          void startPlayback("explicit");
        },
        onPause: () => pausePlayback(enabledRef.current ? "paused" : "off"),
        onStop: () => pausePlayback(enabledRef.current ? "paused" : "off"),
      });
    } catch (error) {
      if (requestIdRef.current !== requestId) return;

      activeAttemptRef.current = null;
      clearAppAudioMediaSession();
      if (isAutoplayRejection(error)) {
        transition("blocked");
        releaseOwnership();

        let active = true;
        const retryFromGesture = (event: Event) => {
          if (!active) return;
          if (
            event.target instanceof Element &&
            event.target.closest(BACKGROUND_MUSIC_CONTROL_SELECTOR)
          ) {
            return;
          }
          clearGestureRetry();
          void startPlayback("explicit");
        };
        gestureCleanupRef.current = () => {
          if (!active) return;
          active = false;
          for (const eventName of AUTOPLAY_GESTURES) {
            document.removeEventListener(eventName, retryFromGesture, true);
          }
        };
        for (const eventName of AUTOPLAY_GESTURES) {
          document.addEventListener(eventName, retryFromGesture, {
            capture: true,
            passive: true,
          });
        }
        return;
      }

      transition("error");
      releaseOwnership();
      logger.warn("[AppBackgroundMusic] Playback failed:", error);
    }
  }, [audioRef, clearGestureRetry, pausePlayback, releaseOwnership, transition, volume]);

  const applyEnabled = useCallback(
    (nextEnabled: boolean, intent: PlaybackStartIntent = "automatic") => {
      enabledRef.current = nextEnabled;
      setEnabled(nextEnabled);
      if (!nextEnabled) {
        pausePlayback("off");
        return;
      }
      if (!canPlayRef.current) {
        pausePlayback("paused");
        return;
      }
      void startPlayback(intent);
    },
    [pausePlayback, startPlayback]
  );

  const toggle = useCallback(() => {
    const result = trySetAppBackgroundMusicEnabled(!enabledRef.current);
    if (!result.ok) {
      logger.warn("[AppBackgroundMusic] Failed to persist the playback preference");
      return;
    }
    applyEnabled(result.enabled, "explicit");
  }, [applyEnabled]);

  const retry = useCallback(() => {
    if (!enabledRef.current) return;
    if (stateRef.current === "error" && activeAttemptRef.current === null) {
      try {
        audioRef.current?.load();
      } catch (error) {
        logger.warn("[AppBackgroundMusic] Media reload failed:", error);
      }
    }
    void startPlayback("explicit");
  }, [audioRef, startPlayback]);

  const handleMediaError = useCallback(() => {
    if (!enabledRef.current) return;
    pausePlayback("error");
  }, [pausePlayback]);

  useEffect(() => {
    mountedRef.current = true;
    const audio = audioRef.current;
    return () => {
      mountedRef.current = false;
      requestIdRef.current += 1;
      activeAttemptRef.current = null;
      clearGestureRetry();
      if (stateRef.current === "loading" || stateRef.current === "playing") {
        audio?.pause();
      }
      releaseOwnership();
      clearAppAudioMediaSession();
    };
  }, [audioRef, clearGestureRetry, releaseOwnership]);

  useEffect(
    () => subscribeAppBackgroundMusicPreference((nextEnabled) => applyEnabled(nextEnabled)),
    [applyEnabled]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = clampVolume(volume);

    if (!enabledRef.current) return;
    if (!canPlay) {
      pausePlayback("paused");
      return;
    }
    void startPlayback();
  }, [audioRef, canPlay, pausePlayback, startPlayback, volume]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      foregroundRef.current = !isDocumentHidden();
      if (isDocumentHidden()) {
        pausePlayback(enabledRef.current ? "paused" : "off");
      }
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [pausePlayback]);

  useEffect(() => {
    const unregisterPause = registerAudioBackgroundPauseHandler(() => {
      foregroundRef.current = false;
      pausePlayback(enabledRef.current ? "paused" : "off");
    });
    const unregisterResume = registerAudioForegroundResumeHandler(() => {
      foregroundRef.current = true;
      return startPlayback();
    });
    return () => {
      unregisterPause();
      unregisterResume();
    };
  }, [pausePlayback, startPlayback]);

  useEffect(
    () =>
      subscribeLongAudioOwner((ownerId) => {
        if (
          ownerId !== null ||
          !allowOwnerReleaseResumeRef.current ||
          !enabledRef.current ||
          !foregroundRef.current ||
          isDocumentHidden() ||
          !canPlayRef.current ||
          stateRef.current !== "paused"
        ) {
          return;
        }

        queueMicrotask(() => {
          if (
            mountedRef.current &&
            allowOwnerReleaseResumeRef.current &&
            foregroundRef.current &&
            !isDocumentHidden() &&
            getActiveLongAudioOwner() === null
          ) {
            void startPlayback();
          }
        });
      }),
    [startPlayback]
  );

  return { enabled, state, toggle, retry, handleMediaError };
}
