export type DayPhotonTone = "aqua" | "gold" | "mint" | "iris" | "rose";

export interface DayMoteMotion {
  delay: number;
  duration: number;
  id: number;
  opacity: number;
  size: number;
  x: number;
  y: number;
}

export interface DayPhotonMotion extends DayMoteMotion {
  drift: number;
  tone: DayPhotonTone;
}

export interface DaySunThreadMotion extends DayMoteMotion {
  length: number;
  tilt: number;
  width: number;
}

export const DAY_COSMIC_MOTES: readonly DayMoteMotion[] = Object.freeze(
  Array.from({ length: 35 }, (_, id) => ({
    id,
    x: (Math.sin(id * 1.9) * 0.5 + 0.5) * 100,
    y: (Math.cos(id * 2.3) * 0.5 + 0.5) * 100,
    size: 2 + (id % 3),
    duration: 12 + (id % 8) * 1.25,
    delay: -(id * 0.55),
    opacity: 0.45 + (id % 5) * 0.1,
  }))
);

const DAY_PHOTON_TONES: readonly DayPhotonTone[] = [
  "aqua",
  "gold",
  "mint",
  "iris",
  "rose",
];

export const DAY_COSMIC_PHOTONS: readonly DayPhotonMotion[] = Object.freeze(
  Array.from({ length: 78 }, (_, id) => ({
    id,
    x: (Math.sin(id * 2.17 + 0.4) * 0.5 + 0.5) * 104 - 2,
    y: (Math.cos(id * 2.71 + 1.2) * 0.5 + 0.5) * 104 - 2,
    size: 2.6 + (id % 6) * 0.92,
    duration: 5.4 + (id % 9) * 0.72,
    delay: -(id * 0.19),
    opacity: 0.66 + (id % 7) * 0.045,
    drift: 10 + (id % 5) * 4,
    tone: DAY_PHOTON_TONES[id % DAY_PHOTON_TONES.length],
  }))
);

export const DAY_COSMIC_SUN_THREADS: readonly DaySunThreadMotion[] = Object.freeze(
  Array.from({ length: 18 }, (_, id) => ({
    id,
    x: 3 + (Math.sin(id * 1.57 + 0.8) * 0.5 + 0.5) * 94,
    y: -18 + (Math.cos(id * 1.83 + 0.5) * 0.5 + 0.5) * 38,
    length: 42 + (id % 5) * 10,
    width: 1.4 + (id % 4) * 0.42,
    size: 0,
    opacity: 0.22 + (id % 6) * 0.045,
    duration: 10.5 + (id % 7) * 1.2,
    delay: -(id * 0.47),
    tilt: -18 + (id % 6) * 4.4,
  }))
);

export const ANDROID_DAY_MOTION_MODEL_LABEL =
  `large:4;photons:${DAY_COSMIC_PHOTONS.length};` +
  `motes:${DAY_COSMIC_MOTES.length};threads:${DAY_COSMIC_SUN_THREADS.length}`;
