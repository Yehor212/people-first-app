import { useEffect, useState } from "react";
import {
  getAudioSettings,
  initAudioManager,
  subscribeAudioSettings,
  type AudioSettingsSnapshot,
} from "@/lib/audioManager";

export function useAppAudioSettings(): AudioSettingsSnapshot {
  const [settings, setSettings] = useState<AudioSettingsSnapshot>(() => getAudioSettings());

  useEffect(() => {
    initAudioManager();
    setSettings(getAudioSettings());
    return subscribeAudioSettings(setSettings);
  }, []);

  return settings;
}
