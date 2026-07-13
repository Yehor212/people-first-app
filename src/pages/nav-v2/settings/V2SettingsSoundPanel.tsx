import { useState } from "react";
import { AlertCircle, ListChecks, RotateCcw, Vibrate, Volume2, VolumeX, Waves } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { useHapticsPreference } from "@/hooks/useHapticsPreference";
import { setAudioEnabled, setVolume } from "@/lib/audioManager";
import { trySetHapticsEnabled } from "@/lib/hapticsPreference";
import { isNative } from "@/lib/platform";
import {
  PanelFrame,
  SettingsFieldHeader,
  SettingsInlineButton,
  SettingsInset,
  SettingsStatus,
  ToggleRow,
} from "./components/V2SettingsControlPrimitives";

export function SoundPanel() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const audio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const haptics = useHapticsPreference();
  const [saveError, setSaveError] = useState<string | null>(null);
  const volumePercent = Math.round(audio.volume * 100);
  const activitySoundsEnabled =
    comfort.settings.completionCuesEnabled ||
    comfort.settings.milestoneCuesEnabled ||
    comfort.settings.reminderCuesEnabled;
  const errorCopy =
    tx.settingsPreferenceSaveError ||
    "Could not save this change. Your previous setting is still active.";
  const legacyTextureLabels = comfort.settings.avoidedTextures.map((texture) => {
    if (texture === "air") return tx.settingsSoundTextureAir || "Air";
    if (texture === "water") return tx.settingsSoundTextureWater || "Water";
    if (texture === "rain") return tx.settingsSoundTextureRain || "Rain";
    return texture;
  });

  const reportSaved = (saved: boolean) => {
    setSaveError(saved ? null : errorCopy);
  };

  return (
    <PanelFrame
      icon={audio.canPlayFeedback ? Volume2 : VolumeX}
      title={t.settingsSoundTitle}
      description={
        tx.settingsSoundDescription || "Choose app sounds, background sounds, and volume."
      }
      testId="settings-v2-panel-sound"
    >
      <ToggleRow
        icon={audio.canPlayFeedback ? Volume2 : VolumeX}
        title={t.settingsSoundMaster}
        description={t.settingsSoundMasterDesc}
        checked={audio.canPlayFeedback}
        onCheckedChange={(checked) => reportSaved(setAudioEnabled(checked))}
        testId="settings-v2-app-sound-toggle"
      />

      {audio.canPlayFeedback ? (
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
              onChange={(event) => reportSaved(setVolume(Number(event.target.value)))}
              aria-label={t.settingsSoundVolume}
              aria-valuetext={`${volumePercent}%`}
              className="settings-v2-range-control h-11 min-w-0 flex-1 cursor-pointer appearance-none"
            />
            <span
              className="w-12 shrink-0 text-end text-sm font-semibold tabular-nums text-foreground"
              data-testid="settings-v2-audio-volume-value"
            >
              {volumePercent}%
            </span>
          </div>
        </SettingsInset>
      ) : null}

      <ToggleRow
        icon={Waves}
        title={tx.settingsSoundBackgroundTitle || t.settingsSoundAmbientToggle}
        description={tx.settingsSoundBackgroundDescription || t.settingsSoundAmbientToggleDesc}
        checked={comfort.settings.ambientEnabled}
        onCheckedChange={(checked) =>
          reportSaved(comfort.updateSettings({ ambientEnabled: checked }))
        }
        testId="settings-v2-audio-ambient-toggle"
        disabled={!audio.canPlayFeedback}
      />

      {legacyTextureLabels.length > 0 ? (
        <SettingsInset testId="settings-v2-audio-legacy-recovery">
          <SettingsFieldHeader
            icon={RotateCcw}
            title={tx.settingsSoundRestoreTitle || "Some background sounds are still off"}
            description={
              tx.settingsSoundRestoreDescription ||
              "A previous sound choice is keeping these sounds off."
            }
          />
          <p className="text-sm font-semibold text-foreground">
            {legacyTextureLabels.join(" · ")}
          </p>
          <SettingsInlineButton
            icon={RotateCcw}
            onClick={() => reportSaved(comfort.updateSettings({ avoidedTextures: [] }))}
          >
            {tx.settingsSoundRestoreAction || "Turn them back on"}
          </SettingsInlineButton>
        </SettingsInset>
      ) : null}

      <ToggleRow
        icon={ListChecks}
        title={tx.settingsSoundActivityTitle || t.settingsSoundCompletionCues}
        description={
          tx.settingsSoundActivityDescription ||
          "Play quiet feedback for completed activities, timers, and meaningful milestones."
        }
        checked={activitySoundsEnabled}
        onCheckedChange={(checked) =>
          reportSaved(
            comfort.updateSettings({
              completionCuesEnabled: checked,
              milestoneCuesEnabled: checked,
              reminderCuesEnabled: checked,
            }),
          )
        }
        testId="settings-v2-audio-activity-toggle"
        disabled={!audio.canPlayFeedback}
      />

      {!audio.canPlayFeedback ? (
        <div data-testid="settings-v2-audio-master-note">
          <SettingsStatus>
            {tx.settingsSoundMasterDisabledHint ||
              "Turn on App sound to change background and activity sounds."}
          </SettingsStatus>
        </div>
      ) : null}

      {isNative ? (
        <ToggleRow
          icon={Vibrate}
          title={tx.settingsVibration || "Vibration"}
          description={
            tx.settingsVibrationDescription ||
            "Brief vibration for taps and confirmations, when supported."
          }
          checked={haptics.enabled}
          onCheckedChange={(checked) =>
            reportSaved(trySetHapticsEnabled(checked).ok)
          }
          testId="settings-v2-haptics-toggle"
        />
      ) : null}

      {saveError ? (
        <div
          role="alert"
          className="flex items-start gap-2 rounded-[8px] border border-destructive/25 bg-destructive/10 p-3 text-sm text-destructive"
        >
          <AlertCircle className="mt-0.5 h-4 w-4 shrink-0" aria-hidden="true" />
          <span>{saveError}</span>
        </div>
      ) : null}
    </PanelFrame>
  );
}
