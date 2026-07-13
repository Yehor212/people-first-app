import { useCallback, useEffect, useState } from "react";
import {
  applyAudioComfortProfile,
  canPlayAmbientAsset,
  getAudioComfortSettings,
  subscribeAudioComfortSettings,
  trySetAudioComfortSettings,
  type AudioComfortProfileId,
  type AudioComfortSettings,
} from "@/lib/audioComfort";
import type { AppAudioAssetId } from "@/lib/appAudioAssets";

export function useAudioComfortSettings() {
  const [settings, setSettingsState] = useState<AudioComfortSettings>(() => getAudioComfortSettings());

  useEffect(() => subscribeAudioComfortSettings(setSettingsState), []);

  const updateSettings = useCallback((partial: Partial<AudioComfortSettings>) => {
    const result = trySetAudioComfortSettings(partial);
    if (result.ok) setSettingsState(result.settings);
    return result.ok;
  }, []);

  const applyProfile = useCallback((profile: AudioComfortProfileId) => {
    setSettingsState(applyAudioComfortProfile(profile));
  }, []);

  const canPlayAsset = useCallback((assetId: AppAudioAssetId) => canPlayAmbientAsset(assetId), []);

  return {
    settings,
    updateSettings,
    applyProfile,
    canPlayAmbientAsset: canPlayAsset,
  };
}
