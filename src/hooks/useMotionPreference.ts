import { useMemo, useSyncExternalStore } from "react";
import {
  DEFAULT_MOTION_PREFERENCE,
  getMotionPreference,
  subscribeMotionPreference,
  type MotionPreference,
} from "@/lib/motionPreference";

const subscribeToMotionPreference = (onStoreChange: () => void) =>
  subscribeMotionPreference(() => onStoreChange());

const getReduceMotionSnapshot = () => getMotionPreference().reduceMotion;
const getServerReduceMotionSnapshot = () => DEFAULT_MOTION_PREFERENCE.reduceMotion;

export function useMotionPreference(): MotionPreference {
  const reduceMotion = useSyncExternalStore(
    subscribeToMotionPreference,
    getReduceMotionSnapshot,
    getServerReduceMotionSnapshot
  );

  return useMemo(() => ({ reduceMotion }), [reduceMotion]);
}
