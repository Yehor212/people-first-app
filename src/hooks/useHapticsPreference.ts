import { useEffect, useState } from "react";
import {
  getHapticsPreference,
  subscribeHapticsPreference,
  type HapticsPreference,
} from "@/lib/hapticsPreference";

export function useHapticsPreference(): HapticsPreference {
  const [preference, setPreference] = useState(getHapticsPreference);

  useEffect(() => subscribeHapticsPreference(setPreference), []);

  return preference;
}
