import { useEffect, useState } from "react";
import { safeJsonParse } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  DEFAULT_DOPAMINE_SETTINGS,
  readDopamineSettings,
  type DopamineSettings,
} from "@/lib/dopamineSettings";

export function useDopamineSettings(): DopamineSettings {
  const [settings, setSettings] = useState<DopamineSettings>(readDopamineSettings);

  useEffect(() => {
    const handleStorageChange = (event: StorageEvent) => {
      if (event.key !== SK.DOPAMINE_SETTINGS || !event.newValue) return;
      const parsed = safeJsonParse(event.newValue, DEFAULT_DOPAMINE_SETTINGS);
      setSettings({ ...DEFAULT_DOPAMINE_SETTINGS, ...parsed });
    };
    const handleCustomChange = (event: CustomEvent<DopamineSettings>) => {
      setSettings(event.detail);
    };

    window.addEventListener("storage", handleStorageChange);
    window.addEventListener(
      "dopamine-settings-change",
      handleCustomChange as EventListener,
    );
    return () => {
      window.removeEventListener("storage", handleStorageChange);
      window.removeEventListener(
        "dopamine-settings-change",
        handleCustomChange as EventListener,
      );
    };
  }, []);

  return settings;
}
