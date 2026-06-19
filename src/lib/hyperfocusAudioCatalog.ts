import type { AppAudioAssetId } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const HYPERFOCUS_AUDIO_FAMILY_IDS = [
  "underwater",
  "thunderstorm",
  "ocean",
  "river",
  "cafe",
  "fireplace",
] as const;

export const HYPERFOCUS_AUDIO_LEVEL_IDS = ["soft", "deep", "intense"] as const;

export type HyperfocusAudioFamilyId = (typeof HYPERFOCUS_AUDIO_FAMILY_IDS)[number];
export type HyperfocusAudioLevelId = (typeof HYPERFOCUS_AUDIO_LEVEL_IDS)[number];
export type HyperfocusAudioVariantId = `${HyperfocusAudioFamilyId}:${HyperfocusAudioLevelId}`;

export interface HyperfocusAudioLevel {
  id: HyperfocusAudioLevelId;
  label: string;
  labelKey: string;
  variantId: HyperfocusAudioVariantId;
  fileName: string;
  runtimePublicPath: string | null;
  generated: boolean;
}

export interface HyperfocusAudioFamily {
  id: HyperfocusAudioFamilyId;
  legacyId: HyperfocusAudioFamilyId;
  legacyAssetId: AppAudioAssetId;
  labelKey: string;
  levels: readonly [HyperfocusAudioLevel, HyperfocusAudioLevel, HyperfocusAudioLevel];
}

export interface HyperfocusAudioVariant extends Omit<HyperfocusAudioLevel, "id"> {
  id: HyperfocusAudioVariantId;
  familyId: HyperfocusAudioFamilyId;
  levelId: HyperfocusAudioLevelId;
  legacyId: HyperfocusAudioFamilyId;
  legacyAssetId: AppAudioAssetId;
}

export interface HyperfocusAudioVariantRef {
  familyId: HyperfocusAudioFamilyId;
  levelId: HyperfocusAudioLevelId;
}

const familyIds = new Set<string>(HYPERFOCUS_AUDIO_FAMILY_IDS);
const levelIds = new Set<string>(HYPERFOCUS_AUDIO_LEVEL_IDS);

const familyLabelKeyParts: Record<HyperfocusAudioFamilyId, string> = {
  underwater: "Underwater",
  thunderstorm: "Thunderstorm",
  ocean: "Ocean",
  river: "River",
  cafe: "Cafe",
  fireplace: "Fireplace",
};

const levelLabelKeyParts: Record<HyperfocusAudioLevelId, string> = {
  soft: "Soft",
  deep: "Deep",
  intense: "Intense",
};

function getHyperfocusLevelLabelKey(
  familyId: HyperfocusAudioFamilyId,
  levelId: HyperfocusAudioLevelId,
): string {
  return `hyperfocusSound${familyLabelKeyParts[familyId]}${levelLabelKeyParts[levelId]}`;
}

function makeVariantId(
  familyId: HyperfocusAudioFamilyId,
  levelId: HyperfocusAudioLevelId,
): HyperfocusAudioVariantId {
  return `${familyId}:${levelId}`;
}

function makeLevel(
  familyId: HyperfocusAudioFamilyId,
  levelId: HyperfocusAudioLevelId,
  label: string,
): HyperfocusAudioLevel {
  const variantId = makeVariantId(familyId, levelId);
  const generatedAsset = HYPERFOCUS_GENERATED_AUDIO_MANIFEST[variantId];

  return {
    id: levelId,
    label,
    labelKey: getHyperfocusLevelLabelKey(familyId, levelId),
    variantId,
    fileName: `hyperfocus-${familyId}-${levelId}.mp3`,
    runtimePublicPath: generatedAsset?.publicPath ?? null,
    generated: Boolean(generatedAsset),
  };
}

function makeLevels(
  familyId: HyperfocusAudioFamilyId,
  labels: readonly [string, string, string],
): readonly [HyperfocusAudioLevel, HyperfocusAudioLevel, HyperfocusAudioLevel] {
  return [
    makeLevel(familyId, "soft", labels[0]),
    makeLevel(familyId, "deep", labels[1]),
    makeLevel(familyId, "intense", labels[2]),
  ];
}

export const HYPERFOCUS_AUDIO_FAMILIES = [
  {
    id: "underwater",
    legacyId: "underwater",
    legacyAssetId: "focus-underwater",
    labelKey: "hyperfocusSoundOcean",
    levels: makeLevels("underwater", ["Shallow Drift", "Deep Current", "Abyss Focus"]),
  },
  {
    id: "thunderstorm",
    legacyId: "thunderstorm",
    legacyAssetId: "focus-thunderstorm",
    labelKey: "hyperfocusSoundRain",
    levels: makeLevels("thunderstorm", ["Distant Rain", "Steady Storm", "Monsoon Wall"]),
  },
  {
    id: "ocean",
    legacyId: "ocean",
    legacyAssetId: "focus-ocean",
    labelKey: "hyperfocusSoundOcean",
    levels: makeLevels("ocean", ["Shoreline", "Rock Pools", "Heavy Surf"]),
  },
  {
    id: "river",
    legacyId: "river",
    legacyAssetId: "focus-river",
    labelKey: "hyperfocusSoundForest",
    levels: makeLevels("river", ["Brook", "Forest River", "Whitewater"]),
  },
  {
    id: "cafe",
    legacyId: "cafe",
    legacyAssetId: "focus-cafe",
    labelKey: "hyperfocusSoundCoffee",
    levels: makeLevels("cafe", ["Quiet Corner", "Work Cafe", "Busy Rush"]),
  },
  {
    id: "fireplace",
    legacyId: "fireplace",
    legacyAssetId: "focus-fireplace",
    labelKey: "hyperfocusSoundFireplace",
    levels: makeLevels("fireplace", ["Embers", "Hearth", "Bonfire"]),
  },
] as const satisfies readonly HyperfocusAudioFamily[];

export function isHyperfocusAudioFamilyId(value: string): value is HyperfocusAudioFamilyId {
  return familyIds.has(value);
}

export function isHyperfocusAudioLevelId(value: string): value is HyperfocusAudioLevelId {
  return levelIds.has(value);
}

export function getHyperfocusAudioFamily(familyId: HyperfocusAudioFamilyId): HyperfocusAudioFamily | undefined {
  return HYPERFOCUS_AUDIO_FAMILIES.find((family) => family.id === familyId);
}

export function getHyperfocusVariantId(
  familyId: HyperfocusAudioFamilyId,
  levelId: HyperfocusAudioLevelId,
): HyperfocusAudioVariantId {
  return makeVariantId(familyId, levelId);
}

export function parseHyperfocusVariantId(id: string): HyperfocusAudioVariantRef | null {
  if (isHyperfocusAudioFamilyId(id)) {
    return { familyId: id, levelId: "deep" };
  }

  const [familyId, levelId, extra] = id.split(":");
  if (extra !== undefined || !isHyperfocusAudioFamilyId(familyId) || !isHyperfocusAudioLevelId(levelId)) {
    return null;
  }

  return { familyId, levelId };
}

export function getHyperfocusAudioVariant(id: string): HyperfocusAudioVariant | undefined {
  const parsed = parseHyperfocusVariantId(id);
  if (!parsed) return undefined;

  const family = getHyperfocusAudioFamily(parsed.familyId);
  const level = family?.levels.find((candidate) => candidate.id === parsed.levelId);
  if (!family || !level) return undefined;

  return {
    ...level,
    id: level.variantId,
    familyId: family.id,
    levelId: level.id,
    legacyId: family.legacyId,
    legacyAssetId: family.legacyAssetId,
  };
}


export function normalizeHyperfocusSoundId(id: string): string {
  return getHyperfocusAudioVariant(id)?.id ?? id;
}
