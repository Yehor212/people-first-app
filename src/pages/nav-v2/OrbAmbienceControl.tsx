import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Volume2, VolumeX } from "lucide-react";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import { logger } from "@/lib/logger";

interface OrbAmbienceControlProps {
  audioSrc: string;
  tx: Record<string, string>;
}

export function OrbAmbienceControl({ audioSrc, tx }: OrbAmbienceControlProps) {
  const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);
  const ambiencePlaybackAttemptedRef = useRef(false);
  const [isAmbiencePlaying, setIsAmbiencePlaying] = useState(false);
  const [ambienceAudioError, setAmbienceAudioError] = useState(false);

  const appAudioSettings = useAppAudioSettings();
  const audioComfort = useAudioComfortSettings();
  const canPlayOrbAmbience =
    !appAudioSettings.muted && audioComfort.canPlayAmbientAsset("orb-ambience");
  const ambienceVolume = canPlayOrbAmbience
    ? Math.max(0, Math.min(1, appAudioSettings.volume * 0.36))
    : 0;
  const ambienceToggleLabel = isAmbiencePlaying
    ? tx.orbAmbiencePause || "Pause orb ambience"
    : ambienceAudioError
      ? tx.audioRetry || "Retry"
      : tx.orbAmbiencePlay || "Play orb ambience";

  const stopAmbienceAudio = useCallback(() => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;
    audio.pause();
    clearAppAudioMediaSession();
    ambiencePlaybackAttemptedRef.current = false;
    setIsAmbiencePlaying(false);
    setAmbienceAudioError(false);
  }, []);

  const handleAmbienceToggle = useCallback(() => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;

    if (isAmbiencePlaying) {
      stopAmbienceAudio();
      return;
    }

    if (!canPlayOrbAmbience) {
      stopAmbienceAudio();
      return;
    }

    audio.volume = ambienceVolume;
    setAmbienceAudioError(false);
    setIsAmbiencePlaying(true);
    ambiencePlaybackAttemptedRef.current = true;
    void audio.play().then(() => {
      setAppAudioMediaSession({
        title: tx.orbAmbienceLabel || "Orb ambience",
        onPause: stopAmbienceAudio,
        onStop: stopAmbienceAudio,
      });
    }).catch((error) => {
      logger.warn("[OrbPage] Ambience playback failed:", error);
      ambiencePlaybackAttemptedRef.current = false;
      clearAppAudioMediaSession();
      setIsAmbiencePlaying(false);
      setAmbienceAudioError(true);
    });
  }, [ambienceVolume, canPlayOrbAmbience, isAmbiencePlaying, stopAmbienceAudio, tx.orbAmbienceLabel]);

  useEffect(() => {
    const audio = ambienceAudioRef.current;
    if (!audio) return;

    audio.volume = ambienceVolume;

    if (!canPlayOrbAmbience && isAmbiencePlaying) {
      stopAmbienceAudio();
    }
  }, [ambienceVolume, canPlayOrbAmbience, isAmbiencePlaying, stopAmbienceAudio]);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.hidden) stopAmbienceAudio();
    };
    const stopOnPageHide = () => stopAmbienceAudio();
    let cancelled = false;
    let pauseListener: PluginListenerHandle | null = null;

    document.addEventListener("visibilitychange", stopOnHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("pause", stopAmbienceAudio))
      .then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        pauseListener = listener;
      })
      .catch((error) => {
        logger.warn("[OrbPage] Failed to register ambience pause listener:", error);
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", stopOnHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
      if (pauseListener) void pauseListener.remove();
    };
  }, [stopAmbienceAudio]);

  useEffect(() => {
    const audio = ambienceAudioRef.current;

    return () => {
      if (!audio) return;
      if (ambiencePlaybackAttemptedRef.current) {
        audio.pause();
        clearAppAudioMediaSession();
        ambiencePlaybackAttemptedRef.current = false;
      }
      audio.removeAttribute("src");
    };
  }, []);

  return (
    <>
      {/* Ambient orb music has no spoken content; the adjacent button provides control. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ambienceAudioRef}
        aria-hidden="true"
        data-testid="orb-page-ambience-audio"
        src={audioSrc}
        preload="none"
        loop
        playsInline
        onPlay={() => {
          setIsAmbiencePlaying(true);
          setAmbienceAudioError(false);
        }}
        onPause={() => {
          setIsAmbiencePlaying(false);
          clearAppAudioMediaSession();
        }}
        onError={() => {
          setIsAmbiencePlaying(false);
          setAmbienceAudioError(true);
          clearAppAudioMediaSession();
        }}
      />

      <div className="pointer-events-auto absolute end-4 top-[calc(var(--safe-top)+0.75rem)] z-30 md:end-6 md:top-[calc(var(--safe-top)+1rem)]">
        <button
          type="button"
          data-testid="orb-page-ambience-toggle"
          aria-label={ambienceToggleLabel}
          aria-pressed={isAmbiencePlaying}
          title={ambienceToggleLabel}
          onClick={handleAmbienceToggle}
          disabled={!canPlayOrbAmbience}
          className="inline-flex min-h-[44px] max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xl transition-all hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-55 md:px-4 md:text-sm"
        >
          {isAmbiencePlaying ? (
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="hidden max-w-[9rem] truncate sm:inline">
            {tx.orbAmbienceLabel || "Orb ambience"}
          </span>
          <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
            {isAmbiencePlaying
              ? tx.soundOn || "On"
              : ambienceAudioError
                ? tx.audioRetry || "Retry"
                : tx.soundOff || "Off"}
          </span>
        </button>
      </div>
    </>
  );
}
