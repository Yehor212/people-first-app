import { useRef } from "react";
import { Loader2, Music2, Pause, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { useUserStartedAmbienceAudio } from "@/hooks/useUserStartedAmbienceAudio";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import {
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
} from "./components/V2SettingsControlPrimitives";

const DIARY_AMBIENCE_AUDIO_SRC = getAppAudioAssetSrc("diary-reflection-loop");

export function V2SettingsDiaryAmbienceControl() {
  const { t } = useLanguage();
  const audio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const diaryAmbienceAudioRef = useRef<HTMLAudioElement | null>(null);

  const canPlayDiaryAmbience =
    audio.canPlayFeedback && comfort.canPlayAmbientAsset("diary-reflection-loop");
  const diaryAmbienceVolume = canPlayDiaryAmbience
    ? Math.max(0, Math.min(1, audio.volume * 0.32))
    : 0;
  const mutedAudioLabel = t.settingsSoundSummaryOff || "Muted";
  const diaryAmbienceUnavailableLabel = !audio.canPlayFeedback
    ? mutedAudioLabel
    : !comfort.settings.ambientEnabled
      ? t.settingsSoundAmbientOff
      : t.settingsSoundDiaryRainOff;
  const diaryAmbienceDisabledStatusLabel = !audio.canPlayFeedback ? mutedAudioLabel : t.soundOff;
  const diaryAmbience = useUserStartedAmbienceAudio({
    audioRef: diaryAmbienceAudioRef,
    canPlay: canPlayDiaryAmbience,
    volume: diaryAmbienceVolume,
    mediaSessionTitle: t.diaryAmbienceLabel,
    loggerScope: "[V2SettingsSoundPanel] Diary ambience",
  });

  const diaryAmbienceToggleLabel = !canPlayDiaryAmbience
    ? diaryAmbienceUnavailableLabel
    : diaryAmbience.isPlaying
      ? t.diaryAmbiencePause
      : diaryAmbience.isPending
        ? t.audioLoading
        : diaryAmbience.hasError
          ? t.audioRetry
          : t.diaryAmbiencePlay;
  const diaryAmbienceStatusLabel = !canPlayDiaryAmbience
    ? diaryAmbienceDisabledStatusLabel
    : diaryAmbience.isPlaying
      ? t.soundOn
      : diaryAmbience.isPending
        ? t.audioLoading
        : diaryAmbience.hasError
          ? t.audioRetry
          : t.soundOff;
  const diaryAmbienceToggleAccessibleName =
    !canPlayDiaryAmbience || diaryAmbience.isPending || diaryAmbience.hasError
      ? t.diaryAmbienceLabel + ", " + diaryAmbienceToggleLabel
      : diaryAmbienceToggleLabel;
  const settingsStatusLabel = canPlayDiaryAmbience
    ? t.settingsSoundDiaryReady
    : diaryAmbienceUnavailableLabel;

  return (
    <SettingsInset testId="settings-v2-diary-ambience-control">
      <SettingsFieldHeader
        icon={Music2}
        title={t.settingsSoundAmbienceTitle}
        description={t.settingsSoundAmbienceNote}
      />
      {/* Ambient preview has no spoken content; it is always tap-started from Settings. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={diaryAmbienceAudioRef}
        aria-hidden="true"
        data-testid="settings-v2-diary-ambience-audio"
        src={DIARY_AMBIENCE_AUDIO_SRC}
        crossOrigin="anonymous"
        preload="none"
        loop
        playsInline
        onPlay={diaryAmbience.handleMediaPlay}
        onPause={diaryAmbience.handleMediaPause}
        onError={diaryAmbience.handleMediaError}
      />
      <button
        type="button"
        data-testid="settings-v2-diary-ambience-toggle"
        aria-label={diaryAmbienceToggleAccessibleName}
        aria-busy={diaryAmbience.isPending ? "true" : undefined}
        title={diaryAmbienceToggleAccessibleName}
        onClick={diaryAmbience.toggle}
        disabled={!canPlayDiaryAmbience}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-[8px] border border-[hsl(var(--settings-v2-border)/0.64)] bg-[hsl(var(--settings-v2-panel)/0.78)] px-4 py-3 text-sm font-semibold text-foreground shadow-[0_8px_18px_-16px_hsl(var(--settings-v2-shadow)/0.42)] motion-safe:transition-[opacity,transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none hover:bg-[hsl(var(--settings-v2-panel)/0.92)] focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {diaryAmbience.isPending ? (
          <Loader2 className="h-4 w-4 motion-safe:animate-spin" aria-hidden="true" />
        ) : diaryAmbience.isPlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{t.diaryAmbienceLabel}</span>
        <span className="rounded-full border border-[hsl(var(--border)/0.45)] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {diaryAmbienceStatusLabel}
        </span>
      </button>
      <SettingsStatus>{settingsStatusLabel}</SettingsStatus>
    </SettingsInset>
  );
}
