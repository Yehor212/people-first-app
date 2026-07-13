import { useEffect, useState } from "react";
import {
  getMotionPreference,
  subscribeMotionPreference,
  type MotionPreference,
} from "@/lib/motionPreference";

export function useMotionPreference(): MotionPreference {
  const [preference, setPreference] = useState(getMotionPreference);

  useEffect(() => subscribeMotionPreference(setPreference), []);

  return preference;
}
