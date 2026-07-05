import { useRef } from "react";
import { Loader2, Volume2, VolumeX } from "lucide-react";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { useUserStartedAmbienceAudio } from "@/hooks/useUserStartedAmbienceAudio";
import "./OrbAmbienceControl.css";

interface OrbAmbienceControlProps {
  audioSrc: string;
  tx: Record<string, string>;
}

export function OrbAmbienceControl({ audioSrc, tx }: OrbAmbienceControlProps) {
  const ambienceAudioRef = useRef<HTMLAudioElement | null>(null);
  const appAudioSettings = useAppAudioSettings();
  const audioComfort = useAudioComfortSettings();
  const canPlayOrbAmbience =
    !appAudioSettings.muted && audioComfort.canPlayAmbientAsset("orb-ambience");
  const ambienceVolume = canPlayOrbAmbience
    ? Math.max(0, Math.min(1, appAudioSettings.volume * 0.36))
    : 0;
  const ambienceBaseLabel = tx.orbAmbienceLabel || "Orb ambience";
  const audioLoadingLabel = tx.audioLoading || "Loading...";
  const mutedLabel = tx.settingsSoundSummaryOff || "Muted";
  const ambienceUnavailableLabel = appAudioSettings.muted
    ? mutedLabel
    : tx.settingsSoundAmbientOff || "Ambient sound is off in Sound comfort.";
  const disabledStatusLabel = appAudioSettings.muted ? mutedLabel : tx.soundOff || "Off";

  const ambiencePlayback = useUserStartedAmbienceAudio({
    audioRef: ambienceAudioRef,
    canPlay: canPlayOrbAmbience,
    volume: ambienceVolume,
    mediaSessionTitle: ambienceBaseLabel,
    loggerScope: "[OrbPage] Ambience",
  });

  const ambienceToggleLabel = !canPlayOrbAmbience
    ? ambienceUnavailableLabel
    : ambiencePlayback.isPlaying
      ? tx.orbAmbiencePause || "Pause orb ambience"
      : ambiencePlayback.isPending
        ? `${ambienceBaseLabel} ${audioLoadingLabel}`
        : ambiencePlayback.hasError
          ? tx.audioRetry || "Retry"
          : tx.orbAmbiencePlay || "Play orb ambience";
  const ambienceStatusLabel = !canPlayOrbAmbience
    ? disabledStatusLabel
    : ambiencePlayback.isPlaying
      ? tx.soundOn || "On"
      : ambiencePlayback.isPending
        ? audioLoadingLabel
        : ambiencePlayback.hasError
          ? tx.audioRetry || "Retry"
          : tx.soundOff || "Off";

  return (
    <>
      {/* Ambient orb music has no spoken content; the adjacent button provides control. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={ambienceAudioRef}
        aria-hidden="true"
        data-testid="orb-page-ambience-audio"
        src={audioSrc}
        crossOrigin="anonymous"
        preload="none"
        loop
        playsInline
        onPlay={ambiencePlayback.handleMediaPlay}
        onPause={ambiencePlayback.handleMediaPause}
        onError={ambiencePlayback.handleMediaError}
      />

      <div className="orb-ambience-focus-control pointer-events-auto">
        <button
          type="button"
          data-testid="orb-page-ambience-toggle"
          aria-label={ambienceToggleLabel}
          aria-pressed={ambiencePlayback.isPlaying}
          title={ambienceToggleLabel}
          onClick={ambiencePlayback.toggle}
          disabled={!canPlayOrbAmbience}
          className="inline-flex min-h-[44px] max-w-[calc(100vw-2rem)] items-center gap-2 rounded-full border border-border/50 bg-background/40 px-3 py-2 text-xs font-semibold text-foreground shadow-lg backdrop-blur-xl transition-all hover:bg-background/55 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/50 disabled:cursor-not-allowed disabled:opacity-55 md:px-4 md:text-sm"
        >
          {ambiencePlayback.isPlaying ? (
            <Volume2 className="h-4 w-4 text-primary" aria-hidden="true" />
          ) : ambiencePlayback.isPending ? (
            <Loader2 className="h-4 w-4 animate-spin text-primary" aria-hidden="true" />
          ) : (
            <VolumeX className="h-4 w-4 text-muted-foreground" aria-hidden="true" />
          )}
          <span className="hidden max-w-[9rem] truncate sm:inline">
            {ambienceBaseLabel}
          </span>
          <span className="rounded-full border border-border/50 px-2 py-0.5 text-[0.68rem] font-medium text-muted-foreground">
            {ambienceStatusLabel}
          </span>
        </button>
      </div>
    </>
  );
}
