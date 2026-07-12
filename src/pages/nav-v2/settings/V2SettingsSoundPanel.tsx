import { useCallback } from "react";
import { Bell, ListChecks, ListMusic, SlidersHorizontal, Vibrate, Volume2, VolumeX, Waves } from "lucide-react";
import { updateDopamineSettings } from "@/lib/dopamineSettings";
import { useDopamineSettings } from "@/hooks/useDopamineSettings";
import { useLanguage } from "@/contexts/LanguageContext";
import { playNotificationPreview, setAudioEnabled, setVolume } from "@/lib/audioManager";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { type AppAudioComfortTexture } from "@/lib/appAudioAssets";
import { AUDIO_COMFORT_PROFILES } from "@/lib/audioComfort";
import { isNative } from "@/lib/platform";
import {
  ActionButton,
  PanelFrame,
  SettingsChoiceButton,
  SettingsFieldHeader,
  SettingsInset,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";
import { V2SettingsDiaryAmbienceControl } from "./V2SettingsDiaryAmbienceControl";

export function SoundPanel() {
  const { t } = useLanguage();
  const audio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const dopamine = useDopamineSettings();
  const volumePercent = Math.round(audio.volume * 100);
  const canPreviewReminderCue = audio.canPlayFeedback && comfort.settings.reminderCuesEnabled;
  const visibleProfiles = AUDIO_COMFORT_PROFILES.filter((profile) => profile.id !== "rich");
  const savedProfile =
    comfort.settings.profile === "rich" ? "balanced" : comfort.settings.profile;
  const profileMatchesEffectiveSettings = (profile: (typeof visibleProfiles)[number]) =>
    comfort.settings.ambientEnabled === profile.settings.ambientEnabled &&
    comfort.settings.completionCuesEnabled === profile.settings.completionCuesEnabled &&
    comfort.settings.milestoneCuesEnabled === profile.settings.milestoneCuesEnabled &&
    comfort.settings.reminderCuesEnabled === profile.settings.reminderCuesEnabled &&
    comfort.settings.avoidedTextures.length === profile.settings.avoidedTextures.length &&
    profile.settings.avoidedTextures.every((texture) =>
      comfort.settings.avoidedTextures.includes(texture),
    );
  const activeProfile =
    visibleProfiles.find(
      (profile) => profile.id === savedProfile && profileMatchesEffectiveSettings(profile),
    )?.id ?? null;
  const textureItems: readonly { texture: AppAudioComfortTexture; label: string }[] = [
    { texture: "air", label: t.settingsSoundTextureAir },
    { texture: "water", label: t.settingsSoundTextureWater },
    { texture: "rain", label: t.settingsSoundTextureRain },
  ];
  const toggleAvoidedTexture = useCallback((texture: AppAudioComfortTexture) => {
    const current = comfort.settings.avoidedTextures;
    const next = current.includes(texture)
      ? current.filter((item) => item !== texture)
      : [...current, texture];
    comfort.updateSettings({ avoidedTextures: next });
  }, [comfort]);

  return (
    <PanelFrame
      icon={audio.canPlayFeedback ? Volume2 : VolumeX}
      title={t.settingsSoundTitle}
      description={t.settingsSoundDescription}
      testId="settings-v2-panel-sound"
    >
      <ToggleRow
        icon={audio.canPlayFeedback ? Volume2 : VolumeX}
        title={t.settingsSoundMaster}
        description={t.settingsSoundMasterDesc}
        checked={audio.canPlayFeedback}
        onCheckedChange={setAudioEnabled}
        testId="settings-v2-app-sound-toggle"
      />

      {isNative && (
        <ToggleRow
          icon={Vibrate}
          title={t.dopamineHaptics}
          description={t.dopamineHapticsDesc}
          checked={dopamine.haptics}
          onCheckedChange={(checked) => updateDopamineSettings({ haptics: checked })}
          testId="settings-v2-haptics-toggle"
        />
      )}

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
            className="settings-v2-range-control h-11 min-w-0 flex-1 cursor-pointer appearance-none disabled:cursor-not-allowed disabled:opacity-60"
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
        <div className="grid grid-cols-1 gap-2 sm:grid-cols-2">
          {visibleProfiles.map((profile) => {
            const isQuiet = profile.id === "quiet";
            return (
              <SettingsChoiceButton
                key={profile.id}
                selected={activeProfile === profile.id}
                onClick={() => comfort.applyProfile(profile.id)}
                presentation="stacked"
                selectedTone="solid"
                surface="card"
                testId={`settings-v2-audio-comfort-profile-${profile.id}`}
              >
                <span className="block text-sm">
                  {isQuiet ? t.settingsSoundProfileQuiet : t.settingsSoundProfileBalanced}
                </span>
                <span className="mt-1 block text-xs font-normal leading-snug opacity-80">
                  {isQuiet
                    ? t.settingsSoundProfileQuietDesc
                    : t.settingsSoundProfileBalancedDesc}
                </span>
              </SettingsChoiceButton>
            );
          })}
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

      <ActionButton
        icon={Bell}
        onClick={playNotificationPreview}
        disabled={!canPreviewReminderCue}
        testId="settings-v2-audio-preview"
      >
        {t.settingsSoundPreview}
      </ActionButton>

      <V2SettingsDiaryAmbienceControl />
    </PanelFrame>
  );
}
