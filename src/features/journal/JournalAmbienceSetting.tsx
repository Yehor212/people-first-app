import { useRef } from "react";
import { Loader2, Music2, Pause, Play } from "lucide-react";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { useUserStartedAmbienceAudio } from "@/hooks/useUserStartedAmbienceAudio";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";

const DIARY_AMBIENCE_AUDIO_SRC = getAppAudioAssetSrc("diary-reflection-loop");

export function JournalAmbienceSetting({ tx }: { tx: Record<string, string> }) {
  const audio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const audioRef = useRef<HTMLAudioElement | null>(null);
  const canPlay =
    audio.canPlayFeedback && comfort.canPlayAmbientAsset("diary-reflection-loop");
  const volume = canPlay ? Math.max(0, Math.min(1, audio.volume * 0.32)) : 0;
  const ambience = useUserStartedAmbienceAudio({
    audioRef,
    canPlay,
    volume,
    mediaSessionTitle: tx.diaryAmbienceLabel || "Writing sound",
    loggerScope: "[JournalSettings] Diary ambience",
  });
  const unavailable = !audio.canPlayFeedback
    ? tx.settingsSoundSummaryOff || "Sound is off."
    : !comfort.settings.ambientEnabled
      ? tx.settingsSoundAmbientOff || "Background sounds are off."
      : tx.settingsSoundDiaryRainOff || "Rain is turned off under Background sounds.";
  const actionLabel = !canPlay
    ? `${tx.diaryAmbienceLabel || "Writing sound"}, ${unavailable}`
    : ambience.isPending
      ? `${tx.diaryAmbienceLabel || "Writing sound"}, ${tx.audioLoading || "Loading…"}`
      : ambience.hasError
        ? `${tx.diaryAmbienceLabel || "Writing sound"}, ${tx.audioRetry || "Try again"}`
        : ambience.isPlaying
          ? tx.diaryAmbiencePause || "Pause writing sound"
          : tx.diaryAmbiencePlay || "Play writing sound";

  return (
    <section
      className="rounded-[28px] border border-border/60 bg-card/70 p-5 shadow-sm backdrop-blur-sm"
      data-testid="journal-settings-ambience-control"
    >
      <div className="flex items-start gap-4">
        <span className="flex h-12 w-12 shrink-0 items-center justify-center rounded-2xl bg-primary/10 text-primary">
          <Music2 className="h-5 w-5" aria-hidden="true" />
        </span>
        <span className="min-w-0 flex-1">
          <span className="block text-base font-semibold text-foreground">
            {tx.settingsSoundAmbienceTitle || "Writing sound"}
          </span>
          <span className="mt-1 block text-sm leading-6 text-muted-foreground">
            {tx.settingsSoundAmbienceNote ||
              "Play soft rain while you write. It starts only when you press play."}
          </span>
        </span>
      </div>

      {/* The loop has no speech and starts only from this explicit control. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={audioRef}
        aria-hidden="true"
        data-testid="journal-settings-ambience-audio"
        src={DIARY_AMBIENCE_AUDIO_SRC}
        crossOrigin="anonymous"
        preload="none"
        loop
        playsInline
        onPlay={ambience.handleMediaPlay}
        onPause={ambience.handleMediaPause}
        onError={ambience.handleMediaError}
      />

      <button
        type="button"
        data-testid="journal-settings-ambience-toggle"
        aria-label={actionLabel}
        aria-pressed={ambience.isPlaying}
        aria-busy={ambience.isPending ? "true" : undefined}
        onClick={ambience.toggle}
        disabled={!canPlay}
        className="mt-5 inline-flex min-h-[44px] w-full items-center justify-center gap-2 rounded-2xl border border-border/70 bg-background/80 px-4 py-2.5 text-sm font-medium text-foreground transition-colors hover:bg-accent disabled:cursor-not-allowed disabled:opacity-50"
      >
        {ambience.isPending ? (
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : ambience.isPlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        <span>
          {ambience.isPlaying
            ? tx.diaryAmbiencePause || "Pause writing sound"
            : tx.diaryAmbiencePlay || "Play writing sound"}
        </span>
      </button>
      {!canPlay ? <p role="status" className="mt-3 text-sm text-muted-foreground">{unavailable}</p> : null}
    </section>
  );
}
