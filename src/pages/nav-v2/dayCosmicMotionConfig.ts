import type { CSSProperties } from "react";

type SettingsMotionTiming = { duration: 18 | 24 | 30; delay: number };

export type PhotonStyle = CSSProperties & {
  "--photon-x": string;
  "--photon-y": string;
  "--photon-size": string;
  "--photon-opacity": number;
  "--photon-delay": string;
  "--photon-duration": string;
  "--photon-drift": string;
  "--settings-motion-delay"?: string;
  "--settings-motion-duration"?: string;
};

export type SunThreadStyle = CSSProperties & {
  "--thread-x": string;
  "--thread-y": string;
  "--thread-length": string;
  "--thread-opacity": number;
  "--thread-delay": string;
  "--thread-duration": string;
  "--thread-tilt": string;
  "--thread-width": string;
  "--settings-motion-delay"?: string;
  "--settings-motion-duration"?: string;
};

export type MoteStyle = CSSProperties & {
  "--mote-opacity": number;
  "--settings-motion-delay"?: string;
  "--settings-motion-duration"?: string;
};

export const SETTINGS_PHOTON_MOTION: ReadonlyMap<number, SettingsMotionTiming> = new Map([
  [45, { duration: 18, delay: 0 }],
  [33, { duration: 18, delay: -2 }],
  [12, { duration: 18, delay: -4 }],
  [57, { duration: 18, delay: -6 }],
  [36, { duration: 18, delay: -8 }],
  [21, { duration: 18, delay: -10 }],
  [48, { duration: 18, delay: -12 }],
  [0, { duration: 18, delay: -14 }],
  [9, { duration: 18, delay: -16 }],
]);

export const SETTINGS_MOTE_MOTION: ReadonlyMap<number, SettingsMotionTiming> = new Map([
  [12, { duration: 24, delay: 0 }],
  [21, { duration: 24, delay: -6 }],
  [3, { duration: 24, delay: -12 }],
  [27, { duration: 24, delay: -18 }],
]);

export const SETTINGS_THREAD_MOTION: ReadonlyMap<number, SettingsMotionTiming> = new Map([
  [3, { duration: 30, delay: 0 }],
  [0, { duration: 30, delay: -15 }],
]);
