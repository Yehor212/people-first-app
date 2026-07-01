import { useCallback, useEffect, useState } from "react";
import {
  applyAudioComfortProfile,
  canPlayAmbientAsset,
  getAudioComfortSettings,
  setAudioComfortSettings,
  subscribeAudioComfortSettings,
  type AudioComfortProfileId,
  type AudioComfortSettings,
} from "@/lib/audioComfort";
import type { AppAudioAssetId } from "@/lib/appAudioAssets";

export function useAudioComfortSettings() {
  const [settings, setSettingsState] = useState<AudioComfortSettings>(() => getAudioComfortSettings());

  useEffect(() => subscribeAudioComfortSettings(setSettingsState), []);

  const updateSettings = useCallback((partial: Partial<AudioComfortSettings>) => {
    setSettingsState(setAudioComfortSettings(partial));
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
