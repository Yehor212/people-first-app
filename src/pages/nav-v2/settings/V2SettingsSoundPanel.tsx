import { Bell, ListChecks, ListMusic, MonitorSmartphone, Music2, Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { playNotification, setMuted, setVolume } from "@/lib/audioManager";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { APP_AUDIO_ACTION_EVENTS, APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS } from "@/lib/appAudioAssets";
import {
  ActionButton,
  PanelFrame,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

export function SoundPanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const audio = useAppAudioSettings();
  const volumePercent = Math.round(audio.volume * 100);
  const focusAssetCount = APP_AUDIO_ASSETS.filter((asset) => asset.family === "focus").length;
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

      <SettingsInset>
        <SettingsFieldHeader
          icon={Music2}
          title={tx.settingsSoundAmbienceTitle || "Ambient tracks"}
          description={
            tx.settingsSoundAmbienceNote ||
            "Orb and diary ambience still start only after you tap their own buttons."
          }
        />
        <SettingsStatus>
          {audio.feedbackSoundsEnabled
            ? tx.settingsSoundFeedbackOn || "Feedback sounds follow this volume."
            : tx.settingsSoundFeedbackOff || "Feedback sounds are disabled in Feedback style."}
        </SettingsStatus>
      </SettingsInset>
    </PanelFrame>
  );
}
