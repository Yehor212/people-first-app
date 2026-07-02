import { useCallback, useState } from "react";
import { Bell, ListChecks, ListMusic, MessageSquare, MonitorSmartphone, SlidersHorizontal, Volume2, VolumeX, Waves } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { playNotification, setMuted, setVolume } from "@/lib/audioManager";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { APP_AUDIO_ACTION_EVENTS, APP_AUDIO_ASSETS, APP_AUDIO_FEEDBACK_EVENTS, type AppAudioComfortTexture } from "@/lib/appAudioAssets";
import {
  AUDIO_COMFORT_PROFILES,
  getVolumeBucket,
  recordAudioComfortFeedback,
  type AudioComfortFeedbackChoice,
} from "@/lib/audioComfort";
import { getAppAudioPlatform } from "@/lib/platform";
import {
  ActionButton,
  PanelFrame,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import { V2SettingsDiaryAmbienceControl } from "./V2SettingsDiaryAmbienceControl";

export function SoundPanel() {
  const { t } = useLanguage();
  const audio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const [lastFeedbackChoice, setLastFeedbackChoice] = useState<AudioComfortFeedbackChoice | null>(null);
  const volumePercent = Math.round(audio.volume * 100);
  const focusAssetCount = APP_AUDIO_ASSETS.filter((asset) => asset.family === "focus").length;
  const canPreviewReminderCue = !audio.muted && comfort.settings.reminderCuesEnabled;
  const actionSoundItems = [
    {
      key: "mood",
      label: t.settingsSoundActionMapMood,
      detail: "1",
    },
    {
      key: "habit",
      label: t.settingsSoundActionMapHabit,
      detail: "1",
    },
    {
      key: "journal",
      label: t.settingsSoundActionMapJournal,
      detail: "1",
    },
    {
      key: "focus",
      label: t.settingsSoundActionMapFocus,
      detail: "1",
    },
    {
      key: "breathing",
      label: t.settingsSoundActionMapBreathing,
      detail: "1",
    },
    {
      key: "milestones",
      label: t.settingsSoundActionMapMilestones,
      detail: String(APP_AUDIO_ACTION_EVENTS.filter((event) => event.soundType === "milestone" || event.soundType === "streak").length),
    },
  ];

  const soundMapItems = [
    {
      key: "auth",
      label: t.settingsSoundMapAuth,
      detail: "1",
    },
    {
      key: "orb",
      label: t.settingsSoundMapOrb,
      detail: "1",
    },
    {
      key: "diary",
      label: t.settingsSoundMapDiary,
      detail: "1",
    },
    {
      key: "focus",
      label: t.settingsSoundMapFocus,
      detail: String(focusAssetCount),
    },
    {
      key: "feedback",
      label: t.settingsSoundMapFeedback,
      detail: String(APP_AUDIO_FEEDBACK_EVENTS.length),
    },
  ];  const textureItems: readonly { texture: AppAudioComfortTexture; label: string }[] = [
    { texture: "air", label: t.settingsSoundTextureAir },
    { texture: "water", label: t.settingsSoundTextureWater },
    { texture: "rain", label: t.settingsSoundTextureRain },
  ];  const feedbackChoiceItems: readonly { choice: AudioComfortFeedbackChoice; label: string }[] = [
    { choice: "comfortable", label: t.settingsSoundFeedbackComfortable },
    { choice: "too_loud", label: t.settingsSoundFeedbackTooLoud },
    { choice: "distracting", label: t.settingsSoundFeedbackDistracting },
    { choice: "prefer_silent", label: t.settingsSoundFeedbackPreferSilent },
    { choice: "did_not_play", label: t.settingsSoundFeedbackDidNotPlay },
  ];

  const toggleAvoidedTexture = useCallback((texture: AppAudioComfortTexture) => {
    const current = comfort.settings.avoidedTextures;
    const next = current.includes(texture)
      ? current.filter((item) => item !== texture)
      : [...current, texture];
    comfort.updateSettings({ avoidedTextures: next });
  }, [comfort]);

  const submitComfortFeedback = useCallback((choice: AudioComfortFeedbackChoice) => {
    recordAudioComfortFeedback({
      choice,
      surface: "settings",
      platform: getAppAudioPlatform(),
      volumeBucket: getVolumeBucket(audio.volume, audio.muted),
      muted: audio.muted,
      ambientEnabled: comfort.settings.ambientEnabled,
    });
    setLastFeedbackChoice(choice);
  }, [audio.muted, audio.volume, comfort.settings.ambientEnabled]);

  return (
    <PanelFrame
      icon={audio.muted ? VolumeX : Volume2}
      title={t.settingsSoundTitle}
      description={t.settingsSoundDescription}
      testId="settings-v2-panel-sound"
    >
      <ToggleRow
        icon={audio.muted ? VolumeX : Volume2}
        title={t.settingsSoundMaster}
        description={t.settingsSoundMasterDesc}
        checked={!audio.muted}
        onCheckedChange={(checked) => setMuted(!checked)}
        testId="settings-v2-app-sound-toggle"
      />

      <SettingsInset testId="settings-v2-audio-volume-card">
        <SettingsFieldHeader
          htmlFor="settings-v2-audio-volume"
          icon={Volume2}
          title={t.settingsSoundVolume}
          description={t.settingsSoundVolumeDesc}
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
            aria-label={t.settingsSoundVolume}
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

      <SettingsInset testId="settings-v2-sensory-comfort-card">
        <SettingsFieldHeader
          icon={SlidersHorizontal}
          title={t.settingsSoundComfortTitle}
          description={t.settingsSoundComfortDescription}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-3">
          {AUDIO_COMFORT_PROFILES.map((profile) => (
            <SettingsChoiceButton
              key={profile.id}
              selected={comfort.settings.profile === profile.id}
              onClick={() => comfort.applyProfile(profile.id)}
              presentation="compact"
              selectedTone="solid"
              surface="card"
              testId={`settings-v2-audio-comfort-profile-${profile.id}`}
            >
              <span className="block text-sm">
                {profile.id === "quiet" ? t.settingsSoundProfileQuiet : profile.id === "rich" ? t.settingsSoundProfileRich : t.settingsSoundProfileBalanced}
              </span>
              <span className="mt-1 block text-xs font-normal leading-snug opacity-80">
                {profile.id === "quiet" ? t.settingsSoundProfileQuietDesc : profile.id === "rich" ? t.settingsSoundProfileRichDesc : t.settingsSoundProfileBalancedDesc}
              </span>
            </SettingsChoiceButton>
          ))}
        </div>
      </SettingsInset>

      <ToggleRow
        icon={Waves}
        title={t.settingsSoundAmbientToggle}
        description={t.settingsSoundAmbientToggleDesc}
        checked={comfort.settings.ambientEnabled}
        onCheckedChange={(checked) => comfort.updateSettings({ ambientEnabled: checked })}
        testId="settings-v2-audio-ambient-toggle"
      />

      <ToggleRow
        icon={ListChecks}
        title={t.settingsSoundCompletionCues}
        description={t.settingsSoundCompletionCuesDesc}
        checked={comfort.settings.completionCuesEnabled}
        onCheckedChange={(checked) => comfort.updateSettings({ completionCuesEnabled: checked })}
        testId="settings-v2-audio-completion-toggle"
      />

      <ToggleRow
        icon={Bell}
        title={t.settingsSoundReminderCues}
        description={t.settingsSoundReminderCuesDesc}
        checked={comfort.settings.reminderCuesEnabled}
        onCheckedChange={(checked) => comfort.updateSettings({ reminderCuesEnabled: checked })}
        testId="settings-v2-audio-reminder-toggle"
      />

      <ToggleRow
        icon={ListMusic}
        title={t.settingsSoundMilestoneCues}
        description={t.settingsSoundMilestoneCuesDesc}
        checked={comfort.settings.milestoneCuesEnabled}
        onCheckedChange={(checked) => comfort.updateSettings({ milestoneCuesEnabled: checked })}
        testId="settings-v2-audio-milestone-toggle"
      />

      <SettingsInset testId="settings-v2-audio-texture-card">
        <SettingsFieldHeader
          icon={Waves}
          title={t.settingsSoundTextureTitle}
          description={t.settingsSoundTextureDescription}
        />
        <div className="grid grid-cols-2 gap-2 sm:grid-cols-4">
          {textureItems.map((item) => {
            const avoided = comfort.settings.avoidedTextures.includes(item.texture);
            return (
              <SettingsChoiceButton
                key={item.texture}
                selected={!avoided}
                onClick={() => toggleAvoidedTexture(item.texture)}
                presentation="compact"
                selectedTone="subtle"
                surface="card"
                testId={`settings-v2-audio-texture-${item.texture}`}
              >
                <span className="block">{item.label}</span>
                <span className="mt-1 block text-xs font-normal opacity-80">
                  {avoided ? t.soundOff : t.soundOn}
                </span>
              </SettingsChoiceButton>
            );
          })}
        </div>
      </SettingsInset>

      <SettingsInset testId="settings-v2-audio-feedback-card">
        <SettingsFieldHeader
          icon={MessageSquare}
          title={t.settingsSoundFeedbackTitle}
          description={t.settingsSoundFeedbackDescription}
        />
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {feedbackChoiceItems.map((item) => (
            <SettingsChoiceButton
              key={item.choice}
              selected={lastFeedbackChoice === item.choice}
              onClick={() => submitComfortFeedback(item.choice)}
              presentation="compact"
              selectedTone="subtle"
              surface="card"
              testId={`settings-v2-audio-feedback-${item.choice}`}
            >
              {item.label}
            </SettingsChoiceButton>
          ))}
        </div>
      </SettingsInset>

      <ActionButton
        icon={Bell}
        onClick={playNotification}
        disabled={!canPreviewReminderCue}
        testId="settings-v2-audio-preview"
      >
        {t.settingsSoundPreview}
      </ActionButton>

      <SettingsInset testId="settings-v2-sound-map-card">
        <SettingsFieldHeader
          icon={ListMusic}
          title={t.settingsSoundMapTitle}
          description={t.settingsSoundMapDescription}
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
          title={t.settingsSoundActionMapTitle}
          description={t.settingsSoundActionMapDescription}
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
          title={t.settingsSoundCrossPlatformTitle}
          description={t.settingsSoundMapDescription}
        />
        <SettingsStatus>
          {t.settingsSoundCrossPlatformNote}
        </SettingsStatus>
      </SettingsInset>

      <V2SettingsDiaryAmbienceControl />
    </PanelFrame>
  );
}
