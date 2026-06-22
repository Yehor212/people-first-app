import { useCallback, useEffect, useRef, useState } from "react";
import { Bell, ListChecks, ListMusic, MonitorSmartphone, Music2, Pause, Play, Volume2, VolumeX } from "lucide-react";
import type { PluginListenerHandle } from "@capacitor/core";
import { useLanguage } from "@/contexts/LanguageContext";
import { playNotification, setMuted, setVolume } from "@/lib/audioManager";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { APP_AUDIO_ACTION_EVENTS, APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS, getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import { logger } from "@/lib/logger";
import {
  ActionButton,
  PanelFrame,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

const DIARY_AMBIENCE_AUDIO_SRC = getAppAudioAssetSrc("diary-reflection-loop");

export function SoundPanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const audio = useAppAudioSettings();
  const diaryAmbienceAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isDiaryAmbiencePlaying, setIsDiaryAmbiencePlaying] = useState(false);
  const [diaryAmbienceError, setDiaryAmbienceError] = useState(false);
  const volumePercent = Math.round(audio.volume * 100);
  const focusAssetCount = APP_AUDIO_ASSETS.filter((asset) => asset.family === "focus").length;
  const diaryAmbienceVolume = Math.max(0, Math.min(1, audio.volume * 0.32));
  const diaryAmbienceToggleLabel = isDiaryAmbiencePlaying
    ? tx.diaryAmbiencePause || "Pause diary ambience"
    : diaryAmbienceError
      ? tx.audioRetry || "Retry"
      : tx.diaryAmbiencePlay || "Play diary ambience";
  const actionSoundItems = [
    {
      key: "mood",
      label: tx.settingsSoundActionMapMood || "Mood saved",
      detail: "1",
    },
    {
      key: "habit",
      label: tx.settingsSoundActionMapHabit || "Habit completed",
      detail: "1",
    },
    {
      key: "journal",
      label: tx.settingsSoundActionMapJournal || "Journal saved",
      detail: "1",
    },
    {
      key: "focus",
      label: tx.settingsSoundActionMapFocus || "Focus completed",
      detail: "1",
    },
    {
      key: "breathing",
      label: tx.settingsSoundActionMapBreathing || "Breathing completed",
      detail: "1",
    },
    {
      key: "milestones",
      label: tx.settingsSoundActionMapMilestones || "Achievements and streak milestones",
      detail: String(APP_AUDIO_ACTION_EVENTS.filter((event) => event.soundType === "levelUp" || event.soundType === "streak").length),
    },
  ];

  const soundMapItems = [
    {
      key: "auth",
      label: tx.settingsSoundMapAuth || "Sign-in measured breath",
      detail: "1",
    },
    {
      key: "orb",
      label: tx.settingsSoundMapOrb || "Orb ambience",
      detail: "1",
    },
    {
      key: "diary",
      label: tx.settingsSoundMapDiary || "Diary ambience",
      detail: "1",
    },
    {
      key: "focus",
      label: tx.settingsSoundMapFocus || "Focus ambient library",
      detail: String(focusAssetCount),
    },
    {
      key: "feedback",
      label: tx.settingsSoundMapFeedback || "Completion and reminder chimes",
      detail: String(APP_AUDIO_FEEDBACK_EVENTS.length),
    },
  ];

  const stopDiaryAmbience = useCallback(() => {
    const audioElement = diaryAmbienceAudioRef.current;
    if (!audioElement) return;

    audioElement.pause();
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

    if (audio.muted) {
      stopDiaryAmbience();
      return;
    }

    audioElement.volume = diaryAmbienceVolume;
    setDiaryAmbienceError(false);
    setIsDiaryAmbiencePlaying(true);
    void audioElement.play().catch((error) => {
      setIsDiaryAmbiencePlaying(false);
      setDiaryAmbienceError(true);
      logger.warn("[V2SettingsSoundPanel]", "Diary ambience preview failed:", error);
    });
  }, [audio.muted, diaryAmbienceVolume, isDiaryAmbiencePlaying, stopDiaryAmbience]);

  useEffect(() => {
    const audioElement = diaryAmbienceAudioRef.current;
    if (!audioElement) return;

    audioElement.volume = diaryAmbienceVolume;
    if (audio.muted && isDiaryAmbiencePlaying) stopDiaryAmbience();
  }, [audio.muted, diaryAmbienceVolume, isDiaryAmbiencePlaying, stopDiaryAmbience]);

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
    <PanelFrame
      icon={audio.muted ? VolumeX : Volume2}
      title={tx.settingsSoundTitle || "Sound"}
      description={tx.settingsSoundDescription || "App ambience and feedback volume."}
      testId="settings-v2-panel-sound"
    >
      <ToggleRow
        icon={audio.muted ? VolumeX : Volume2}
        title={tx.settingsSoundMaster || "App sound"}
        description={
          tx.settingsSoundMasterDesc ||
          "Controls success chimes, orb ambience, and diary ambience."
        }
        checked={!audio.muted}
        onCheckedChange={(checked) => setMuted(!checked)}
        testId="settings-v2-app-sound-toggle"
      />

      <SettingsInset testId="settings-v2-audio-volume-card">
        <SettingsFieldHeader
          htmlFor="settings-v2-audio-volume"
          icon={Volume2}
          title={tx.settingsSoundVolume || "Volume"}
          description={tx.settingsSoundVolumeDesc || "Sets the default level for app audio."}
        />
        <div className="flex min-h-[44px] items-center gap-3">
          <input
            id="settings-v2-audio-volume"
            data-testid="settings-v2-audio-volume"
            type="range"
            min={0}
            max={1}
            step={0.05}
            value={audio.volume}
            onChange={(event) => setVolume(Number(event.target.value))}
            aria-label={tx.settingsSoundVolume || "Volume"}
            className="h-2 min-w-0 flex-1 cursor-pointer appearance-none rounded-full bg-muted accent-primary disabled:cursor-not-allowed disabled:opacity-60"
          />
          <span
            className="w-12 shrink-0 text-end text-sm font-semibold tabular-nums text-foreground"
            data-testid="settings-v2-audio-volume-value"
          >
            {volumePercent}%
          </span>
        </div>
      </SettingsInset>

      <ActionButton
        icon={Bell}
        onClick={playNotification}
        disabled={audio.muted}
        testId="settings-v2-audio-preview"
      >
        {tx.settingsSoundPreview || "Preview sound"}
      </ActionButton>

      <SettingsInset testId="settings-v2-sound-map-card">
        <SettingsFieldHeader
          icon={ListMusic}
          title={tx.settingsSoundMapTitle || "Where sound appears"}
          description={
            tx.settingsSoundMapDescription ||
            "All app audio is local, tap-started, and shared across web, mobile, and desktop."
          }
        />
        <div className="grid gap-2">
          {soundMapItems.map((item) => (
            <div
              key={item.key}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border)/0.45)] bg-[hsl(var(--card)/0.42)] px-3 py-2"
            >
              <span className="min-w-0 text-sm font-medium text-foreground">{item.label}</span>
              <span className="shrink-0 rounded-full border border-[hsl(var(--border)/0.45)] px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </SettingsInset>

      <SettingsInset testId="settings-v2-action-sound-map-card">
        <SettingsFieldHeader
          icon={ListChecks}
          title={tx.settingsSoundActionMapTitle || "Action feedback map"}
          description={
            tx.settingsSoundActionMapDescription ||
            "Short sounds are reserved for meaningful completions and rare milestones."
          }
        />
        <div className="grid gap-2">
          {actionSoundItems.map((item) => (
            <div
              key={item.key}
              className="flex min-h-[44px] items-center justify-between gap-3 rounded-xl border border-[hsl(var(--border)/0.45)] bg-[hsl(var(--card)/0.42)] px-3 py-2"
            >
              <span className="min-w-0 text-sm font-medium text-foreground">{item.label}</span>
              <span className="shrink-0 rounded-full border border-[hsl(var(--border)/0.45)] px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground">
                {item.detail}
              </span>
            </div>
          ))}
        </div>
      </SettingsInset>

      <SettingsInset testId="settings-v2-sound-platform-card">
        <SettingsFieldHeader
          icon={MonitorSmartphone}
          title={tx.settingsSoundCrossPlatformTitle || "Cross-platform readiness"}
          description={
            tx.settingsSoundMapDescription ||
            "All app audio is local, tap-started, and shared across web, mobile, and desktop."
          }
        />
        <SettingsStatus>
          {tx.settingsSoundCrossPlatformNote || "Ready on Web, PWA, Android, iOS, and Desktop."}
        </SettingsStatus>
      </SettingsInset>

      <SettingsInset testId="settings-v2-diary-ambience-control">
        <SettingsFieldHeader
          icon={Music2}
          title={tx.settingsSoundAmbienceTitle || "Ambient tracks"}
          description={
            tx.settingsSoundAmbienceNote ||
            "Orb ambience starts from Orb. Diary sound is managed here so it never covers your writing."
          }
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
          onPause={() => setIsDiaryAmbiencePlaying(false)}
          onError={() => {
            setIsDiaryAmbiencePlaying(false);
            setDiaryAmbienceError(true);
          }}
        />
        <button
          type="button"
          data-testid="settings-v2-diary-ambience-toggle"
          aria-label={diaryAmbienceToggleLabel}
          aria-pressed={isDiaryAmbiencePlaying}
          title={diaryAmbienceToggleLabel}
          onClick={toggleDiaryAmbience}
          disabled={audio.muted}
          className="flex min-h-[48px] w-full items-center justify-center gap-2 rounded-2xl border border-[hsl(var(--border)/0.55)] bg-[hsl(var(--secondary)/0.72)] px-4 py-3 text-sm font-semibold text-secondary-foreground motion-safe:transition-[opacity,transform,background-color] hover:-translate-y-0.5 hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
        >
          {isDiaryAmbiencePlaying ? (
            <Pause className="h-4 w-4" aria-hidden="true" />
          ) : (
            <Play className="h-4 w-4" aria-hidden="true" />
          )}
          <span>{tx.diaryAmbienceLabel || "Diary ambience"}</span>
          <span className="rounded-full border border-[hsl(var(--border)/0.45)] px-2 py-0.5 text-xs font-semibold text-muted-foreground">
            {isDiaryAmbiencePlaying
              ? tx.soundOn || "On"
              : diaryAmbienceError
                ? tx.audioRetry || "Retry"
                : tx.soundOff || "Off"}
          </span>
        </button>
        <SettingsStatus>
          {audio.feedbackSoundsEnabled
            ? tx.settingsSoundFeedbackOn || "Feedback sounds follow this volume."
            : tx.settingsSoundFeedbackOff || "Feedback sounds are disabled in Feedback style."}
        </SettingsStatus>
      </SettingsInset>
    </PanelFrame>
  );
}
