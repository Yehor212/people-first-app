import type { V2HabitPictogramId } from "@/lib/v2HabitPictograms";

export type HabitIconMotionState = "idle" | "press" | "complete" | "disabled" | "reduced";
export type HabitIconRenderer = "lottie" | "still";

export interface HabitIconQualityMetrics {
  frames: number;
  frameRate: number;
  layers: number;
  shapeRecords: number;
  animatedChannels: number;
  gradients: number;
  trimPaths: number;
  paths: number;
  strokes: number;
}

export interface HabitIconAssetEntry {
  id: V2HabitPictogramId;
  label: string;
  source: string;
  license: "MIT" | "Original" | string;
  reduced: string;
  lottie?: string;
  referenceVariant?: string;
  reviewStatus?: string;
  productionRights?: string;
  originalCandidate?: string;
  coverLogoPolicy?: string;
  idle: {
    renderer: HabitIconRenderer;
    name: string;
    durationMs: number;
    bytes: number;
  };
  quality: HabitIconQualityMetrics;
  states: HabitIconMotionState[];
}

const STATIC_HABIT_IDS: readonly V2HabitPictogramId[] = [
  "drink-water",
  "walk-distance",
  "exercise",
  "meditate",
  "sleep",
  "stretch",
  "healthy-food",
  "vitamins",
  "brush-teeth",
  "sunlight",
  "touch-grass",
  "protein",
  "journal",
  "gratitude",
  "breathwork",
  "phone-break",
  "deep-work",
  "tidy-room",
  "quit-smoking",
  "quit-drinking",
  "focus",
];

const ZERO_QUALITY: HabitIconQualityMetrics = {
  frames: 0,
  frameRate: 0,
  layers: 0,
  shapeRecords: 0,
  animatedChannels: 0,
  gradients: 0,
  trimPaths: 0,
  paths: 0,
  strokes: 0,
};

const MOTION_STATES: HabitIconMotionState[] = ["idle", "press", "complete", "disabled", "reduced"];

function toAssetLabel(id: V2HabitPictogramId): string {
  const spaced = id.replace(/-/g, " ");
  return spaced.charAt(0).toUpperCase() + spaced.slice(1);
}

function makeStaticAsset(id: V2HabitPictogramId): HabitIconAssetEntry {
  return {
    id,
    label: toAssetLabel(id),
    source: "zenflow-static-reduced-awaiting-lottie-approval/" + id,
    license: "Original",
    reduced: id + "/reduced.svg",
    idle: {
      renderer: "still",
      name: "v2hp-locked-static-" + id + "-awaiting-lottie-approval",
      durationMs: 0,
      bytes: 0,
    },
    quality: ZERO_QUALITY,
    states: MOTION_STATES,
  };
}

const DRINK_WATER_APPROVED_ASSET: HabitIconAssetEntry = {
  id: "drink-water",
  label: "Drink water",
  source: "zenflow-original-approved-lottie/drink-water-v29-continuous-entry",
  license: "Original",
  reduced: "drink-water/reduced.svg",
  lottie: "drink-water/idle.lottie.json",
  reviewStatus: "approved-production-user-confirmed-water-v29",
  productionRights: "Original ZenFlow vector animation",
  idle: {
    renderer: "lottie",
    name: "v2hp-drink-water-continuous-entry-v29-approved",
    durationMs: 2983,
    bytes: 8493455,
  },
  quality: {
    frames: 179,
    frameRate: 60,
    layers: 263,
    shapeRecords: 1851,
    animatedChannels: 3328,
    gradients: 34,
    trimPaths: 295,
    paths: 356,
    strokes: 420,
  },
  states: MOTION_STATES,
};

const WALK_DISTANCE_APPROVED_ASSET: HabitIconAssetEntry = {
  id: "walk-distance",
  label: "Walk distance",
  source: "zenflow-original-approved-lottie/walk-distance-v12-hero-runner",
  license: "Original",
  reduced: "walk-distance/reduced.svg",
  lottie: "walk-distance/idle.lottie.json",
  reviewStatus: "approved-production-hero-runner-v12",
  productionRights: "Original ZenFlow vector animation",
  idle: {
    renderer: "lottie",
    name: "v2hp-walk-distance-hero-runner-v12-final-candidate",
    durationMs: 2983,
    bytes: 3071319,
  },
  quality: {
    frames: 179,
    frameRate: 60,
    layers: 191,
    shapeRecords: 1343,
    animatedChannels: 838,
    gradients: 61,
    trimPaths: 59,
    paths: 149,
    strokes: 233,
  },
  states: MOTION_STATES,
};

const READ_APPROVED_ASSET: HabitIconAssetEntry = {
  id: "read",
  label: "Read",
  source: "user-confirmed-reference-derived-production/read",
  license: "User-confirmed rights",
  reduced: "read/reduced.svg",
  lottie: "read/idle.lottie.json",
  referenceVariant: "read/reference-derived.lottie.json",
  reviewStatus: "approved-production-user-confirmed-no-logo",
  productionRights: "CONFIRMED_BY_USER_2026-06-22",
  originalCandidate: "read/original-v91.lottie.json",
  coverLogoPolicy: "removed-after-visual-rejection",
  idle: {
    renderer: "lottie",
    name: "v2hp-read-page-turn-reference-quality-approved-no-logo",
    durationMs: 2983,
    bytes: 485816,
  },
  quality: {
    frames: 179,
    frameRate: 60,
    layers: 48,
    shapeRecords: 1315,
    animatedChannels: 784,
    gradients: 22,
    trimPaths: 29,
    paths: 312,
    strokes: 291,
  },
  states: MOTION_STATES,
};

export const APPROVED_HABIT_LOTTIE_IDS = new Set<string>(["drink-water", "walk-distance", "read"]);
export const REVIEW_CANDIDATE_HABIT_LOTTIE_IDS = new Set<string>();
export const REJECTED_HABIT_LOTTIE_IDS = new Set<string>([
  "read-original-v91",
  "walk-distance-kinetic-soles-v1",
]);
export const V2_HABIT_ICON_ASSETS = [
  DRINK_WATER_APPROVED_ASSET,
  WALK_DISTANCE_APPROVED_ASSET,
  makeStaticAsset("exercise"),
  READ_APPROVED_ASSET,
  ...STATIC_HABIT_IDS.slice(3).map(makeStaticAsset),
] as readonly HabitIconAssetEntry[];

const ASSETS_BY_ID = new Map<V2HabitPictogramId, HabitIconAssetEntry>(
  V2_HABIT_ICON_ASSETS.map((asset) => [asset.id, asset])
);

export function isHabitLottieApproved(id: V2HabitPictogramId): boolean {
  return APPROVED_HABIT_LOTTIE_IDS.has(id);
}

export function isHabitLottieReviewCandidate(id: V2HabitPictogramId): boolean {
  return REVIEW_CANDIDATE_HABIT_LOTTIE_IDS.has(id);
}

export function isHabitLottieRejected(id: V2HabitPictogramId): boolean {
  return REJECTED_HABIT_LOTTIE_IDS.has(id);
}

export function getHabitIconAsset(id: V2HabitPictogramId): HabitIconAssetEntry {
  const asset = ASSETS_BY_ID.get(id);
  if (!asset) {
    return ASSETS_BY_ID.get("drink-water") ?? V2_HABIT_ICON_ASSETS[0];
  }
  return asset;
}
