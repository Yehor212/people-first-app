import { useCallback, useEffect, useRef, useState, type RefObject } from "react";
import {
  getAppBackgroundMusicEnabled,
  getAppBackgroundMusicCursor,
  subscribeAppBackgroundMusicPreference,
  trySetAppBackgroundMusicEnabled,
  trySetAppBackgroundMusicCursor,
} from "@/lib/appBackgroundMusicPreference";
import {
  APP_BACKGROUND_MUSIC_COLLECTION,
  getAppAudioAsset,
  getNextBackgroundMusicAsset,
  type AppBackgroundMusicAssetId,
} from "@/lib/appAudioAssets";
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
  | "fading"
  | "paused"
  | "recovering"
  | "error";

interface UseAppBackgroundMusicOptions {
  audioRef: RefObject<HTMLAudioElement | null>;
  canPlay: boolean;
  canPlayMaster?: (id: AppBackgroundMusicAssetId) => boolean;
  canPlayMasterRevision?: string;
  volume: number;
}

export interface AppBackgroundMusicControl {
  enabled: boolean;
  state: AppBackgroundMusicState;
  activeMasterId: AppBackgroundMusicAssetId;
  toggle: () => void;
  retry: () => void;
  handleMediaError: () => void;
  handleMediaEnded: () => void;
  handleMediaTimeUpdate: () => void;
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
  canPlayMaster,
  canPlayMasterRevision,
  volume,
}: UseAppBackgroundMusicOptions): AppBackgroundMusicControl {
  const [enabled, setEnabled] = useState(() => getAppBackgroundMusicEnabled());
  const [activeMasterId, setActiveMasterId] = useState<AppBackgroundMusicAssetId>(
    () => getAppBackgroundMusicCursor(),
  );
  const [state, setState] = useState<AppBackgroundMusicState>(() =>
    getAppBackgroundMusicEnabled() && !canPlay ? "paused" : "off"
  );
  const mountedRef = useRef(true);
  const enabledRef = useRef(enabled);
  const activeMasterIdRef = useRef(activeMasterId);
  const canPlayRef = useRef(canPlay);
  const canPlayMasterRef = useRef(canPlayMaster);
  const stateRef = useRef(state);
  const requestIdRef = useRef(0);
  const activeAttemptRef = useRef<number | null>(null);
  const releaseOwnershipRef = useRef<(() => void) | null>(null);
  const gestureCleanupRef = useRef<(() => void) | null>(null);
  const allowOwnerReleaseResumeRef = useRef(true);
  const foregroundRef = useRef(!isDocumentHidden());
  const pendingTrackStartRef = useRef(false);
  const failedMasterIdsRef = useRef(new Set<AppBackgroundMusicAssetId>());

  enabledRef.current = enabled;
  canPlayRef.current = canPlay;
  canPlayMasterRef.current = canPlayMaster;

  const canPlayActiveMaster = useCallback(
    () =>
      canPlayRef.current &&
      (canPlayMasterRef.current?.(activeMasterIdRef.current) ?? true),
    [],
  );

  const cacheCurrentAndNext = useCallback(() => {
    const current = getAppAudioAsset(activeMasterIdRef.current);
    const next = getNextBackgroundMusicAsset(activeMasterIdRef.current);
    for (const asset of [current, next]) {
      if (!asset) continue;
      void requestRuntimeAudioCacheOnIntent(asset.publicPath).catch((error) =>
        logger.warn("[AppBackgroundMusic] Intent cache request failed:", error),
      );
    }
  }, []);

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
      cacheCurrentAndNext();
    }
    if (!foregroundRef.current || isDocumentHidden()) {
      pausePlayback("paused");
      return;
    }
    if (!canPlayActiveMaster()) {
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
        !canPlayActiveMaster() ||
        getActiveLongAudioOwner() !== PLAYBACK_OWNER
      ) {
        audio.pause();
        return;
      }

      activeAttemptRef.current = null;
      transition("playing");
      setAppAudioMediaSession({
        title: getAppAudioAsset(activeMasterIdRef.current)?.fallbackLabel ?? "ZenFlow",
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
  }, [audioRef, cacheCurrentAndNext, canPlayActiveMaster, clearGestureRetry, pausePlayback, releaseOwnership, transition, volume]);

  const applyEnabled = useCallback(
    (nextEnabled: boolean, intent: PlaybackStartIntent = "automatic") => {
      enabledRef.current = nextEnabled;
      setEnabled(nextEnabled);
      if (!nextEnabled) {
        pausePlayback("off");
        return;
      }
      if (!canPlayActiveMaster()) {
        pausePlayback("paused");
        return;
      }
      void startPlayback(intent);
    },
    [canPlayActiveMaster, pausePlayback, startPlayback]
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
    failedMasterIdsRef.current.clear();
    if (stateRef.current === "error" && activeAttemptRef.current === null) {
      try {
        audioRef.current?.load();
      } catch (error) {
        logger.warn("[AppBackgroundMusic] Media reload failed:", error);
      }
    }
    void startPlayback("explicit");
  }, [audioRef, startPlayback]);

  const advanceToNextMaster = useCallback((nextState: "loading" | "recovering") => {
    if (!enabledRef.current || !canPlayActiveMaster() || !foregroundRef.current) {
      pausePlayback(enabledRef.current ? "paused" : "off");
      return;
    }
    const next = getNextBackgroundMusicAsset(activeMasterIdRef.current);
    const persisted = trySetAppBackgroundMusicCursor(next.id);
    if (!persisted.ok) {
      pausePlayback("error");
      logger.warn("[AppBackgroundMusic] Failed to persist the collection cursor");
      return;
    }
    requestIdRef.current += 1;
    activeAttemptRef.current = null;
    activeMasterIdRef.current = persisted.cursor;
    pendingTrackStartRef.current = true;
    transition(nextState);
    setActiveMasterId(persisted.cursor);
  }, [canPlayActiveMaster, pausePlayback, transition]);

  const handleMediaError = useCallback(() => {
    if (!enabledRef.current) return;
    failedMasterIdsRef.current.add(activeMasterIdRef.current);
    if (failedMasterIdsRef.current.size >= APP_BACKGROUND_MUSIC_COLLECTION.length) {
      pausePlayback("error");
      return;
    }
    advanceToNextMaster("recovering");
  }, [advanceToNextMaster, pausePlayback]);

  const handleMediaEnded = useCallback(() => {
    failedMasterIdsRef.current.clear();
    advanceToNextMaster("loading");
  }, [advanceToNextMaster]);

  const handleMediaTimeUpdate = useCallback(() => {
    const audio = audioRef.current;
    if (!audio || stateRef.current !== "playing") return;
    if (!Number.isFinite(audio.duration) || !Number.isFinite(audio.currentTime)) return;
    const remaining = audio.duration - audio.currentTime;
    if (remaining <= 0 || remaining > 0.6) return;
    transition("fading");
    audio.volume = clampVolume(volume * (remaining / 0.6));
  }, [audioRef, transition, volume]);

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

  useEffect(() => {
    if (!pendingTrackStartRef.current) return;
    pendingTrackStartRef.current = false;
    const audio = audioRef.current;
    if (!audio) {
      transition("error");
      return;
    }
    audio.volume = clampVolume(volume);
    try {
      audio.load();
    } catch (error) {
      logger.warn("[AppBackgroundMusic] Next media load failed:", error);
    }
    cacheCurrentAndNext();
    void startPlayback();
  }, [activeMasterId, audioRef, cacheCurrentAndNext, startPlayback, transition, volume]);

  useEffect(
    () => subscribeAppBackgroundMusicPreference((nextEnabled) => applyEnabled(nextEnabled)),
    [applyEnabled]
  );

  useEffect(() => {
    const audio = audioRef.current;
    if (audio) audio.volume = clampVolume(volume);

    if (!enabledRef.current) return;
    if (!canPlayActiveMaster()) {
      pausePlayback("paused");
      return;
    }
    void startPlayback();
  }, [activeMasterId, audioRef, canPlay, canPlayMasterRevision, canPlayActiveMaster, pausePlayback, startPlayback, volume]);

  useEffect(() => {
    const handleVisibilityChange = () => {
      foregroundRef.current = !isDocumentHidden();
      if (isDocumentHidden()) {
        pausePlayback(enabledRef.current ? "paused" : "off");
        return;
      }
      if (enabledRef.current && canPlayActiveMaster()) void startPlayback();
    };
    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [canPlayActiveMaster, pausePlayback, startPlayback]);

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
          !canPlayActiveMaster() ||
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
    [canPlayActiveMaster, startPlayback]
  );

  return {
    enabled,
    state,
    activeMasterId,
    toggle,
    retry,
    handleMediaError,
    handleMediaEnded,
    handleMediaTimeUpdate,
  };
}
