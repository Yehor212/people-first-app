import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { Music2, Pause, Play } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import { logger } from "@/lib/logger";
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
  const [isDiaryAmbiencePlaying, setIsDiaryAmbiencePlaying] = useState(false);
  const [diaryAmbienceError, setDiaryAmbienceError] = useState(false);

  const diaryAmbienceVolume = Math.max(0, Math.min(1, audio.volume * 0.32));
  const canPlayDiaryAmbience =
    !audio.muted && comfort.canPlayAmbientAsset("diary-reflection-loop");
  const diaryAmbienceToggleLabel = isDiaryAmbiencePlaying
    ? t.diaryAmbiencePause
    : diaryAmbienceError
      ? t.audioRetry
      : t.diaryAmbiencePlay;

  const stopDiaryAmbience = useCallback(() => {
    const audioElement = diaryAmbienceAudioRef.current;
    if (!audioElement) return;

    audioElement.pause();
    clearAppAudioMediaSession();
    setIsDiaryAmbiencePlaying(false);
    setDiaryAmbienceError(false);
  }, []);

  const toggleDiaryAmbience = useCallback(() => {
    const audioElement = diaryAmbienceAudioRef.current;
    if (!audioElement) return;

    if (isDiaryAmbiencePlaying) {
      stopDiaryAmbience();
      return;
    }

    if (!canPlayDiaryAmbience) {
      stopDiaryAmbience();
      return;
    }

    audioElement.volume = diaryAmbienceVolume;
    setDiaryAmbienceError(false);
    setIsDiaryAmbiencePlaying(true);
    void audioElement.play().then(() => {
      setAppAudioMediaSession({
        title: t.diaryAmbienceLabel,
        onPause: stopDiaryAmbience,
        onStop: stopDiaryAmbience,
      });
    }).catch((error) => {
      setIsDiaryAmbiencePlaying(false);
      setDiaryAmbienceError(true);
      clearAppAudioMediaSession();
      logger.warn("[V2SettingsSoundPanel]", "Diary ambience preview failed:", error);
    });
  }, [canPlayDiaryAmbience, diaryAmbienceVolume, isDiaryAmbiencePlaying, stopDiaryAmbience, t.diaryAmbienceLabel]);

  useEffect(() => {
    const audioElement = diaryAmbienceAudioRef.current;
    if (!audioElement) return;

    audioElement.volume = diaryAmbienceVolume;
    if (!canPlayDiaryAmbience && isDiaryAmbiencePlaying) stopDiaryAmbience();
  }, [canPlayDiaryAmbience, diaryAmbienceVolume, isDiaryAmbiencePlaying, stopDiaryAmbience]);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.hidden) stopDiaryAmbience();
    };
    const stopOnPageHide = () => stopDiaryAmbience();
    let cancelled = false;
    let pauseListener: PluginListenerHandle | null = null;

    document.addEventListener("visibilitychange", stopOnHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("pause", stopDiaryAmbience))
      .then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        pauseListener = listener;
      })
      .catch((error) => {
        logger.warn("[V2SettingsSoundPanel]", "Failed to register diary ambience pause listener:", error);
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", stopOnHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
      if (pauseListener) void pauseListener.remove();
    };
  }, [stopDiaryAmbience]);

  useEffect(() => {
    const audioElement = diaryAmbienceAudioRef.current;

    return () => {
      if (!audioElement) return;
      if (!audioElement.paused) audioElement.pause();
      audioElement.removeAttribute("src");
    };
  }, []);

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
        preload="none"
        loop
        playsInline
        onPlay={() => {
          setIsDiaryAmbiencePlaying(true);
          setDiaryAmbienceError(false);
        }}
        onPause={() => {
          setIsDiaryAmbiencePlaying(false);
          clearAppAudioMediaSession();
        }}
        onError={() => {
          setIsDiaryAmbiencePlaying(false);
          setDiaryAmbienceError(true);
          clearAppAudioMediaSession();
        }}
      />
      <button
        type="button"
        data-testid="settings-v2-diary-ambience-toggle"
        aria-label={diaryAmbienceToggleLabel}
        aria-pressed={isDiaryAmbiencePlaying}
        title={diaryAmbienceToggleLabel}
        onClick={toggleDiaryAmbience}
        disabled={!canPlayDiaryAmbience}
        className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--secondary)/0.72)] px-4 py-3 text-sm font-semibold text-secondary-foreground motion-safe:transition-[opacity,transform,background-color] hover:-translate-y-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
      >
        {isDiaryAmbiencePlaying ? (
          <Pause className="h-4 w-4" aria-hidden="true" />
        ) : (
          <Play className="h-4 w-4" aria-hidden="true" />
        )}
        <span>{t.diaryAmbienceLabel}</span>
        <span className="rounded-full border border-[hsl(var(--border)/0.45)] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
          {isDiaryAmbiencePlaying
            ? t.soundOn
            : diaryAmbienceError
              ? t.audioRetry
              : t.soundOff}
        </span>
      </button>
      <SettingsStatus>
        {!comfort.settings.ambientEnabled
          ? t.settingsSoundAmbientOff
          : audio.feedbackSoundsEnabled
            ? t.settingsSoundFeedbackOn
            : t.settingsSoundFeedbackOff}
      </SettingsStatus>
    </SettingsInset>
  );
}
