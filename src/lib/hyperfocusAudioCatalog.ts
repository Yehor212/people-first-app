import type { AppAudioAssetId } from "@/lib/appAudioAssets";
import { HYPERFOCUS_GENERATED_AUDIO_MANIFEST } from "@/lib/hyperfocusGeneratedAudioManifest";

export const HYPERFOCUS_AUDIO_FAMILY_IDS = [
  "forest",
  "rain",
  "ocean",
  "fireplace",
  "river",
  "wind",
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

const HYPERFOCUS_LEGACY_FAMILY_ALIASES: Record<string, HyperfocusAudioFamilyId> = {
  cafe: "forest",
  underwater: "ocean",
  thunderstorm: "rain",
};

const familyIds = new Set<string>(HYPERFOCUS_AUDIO_FAMILY_IDS);
const levelIds = new Set<string>(HYPERFOCUS_AUDIO_LEVEL_IDS);

const familyLabelKeyParts: Record<HyperfocusAudioFamilyId, string> = {
  forest: "Forest",
  rain: "Rain",
  ocean: "Ocean",
  fireplace: "Fireplace",
  river: "River",
  wind: "Wind",
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
    id: "forest",
    legacyId: "forest",
    legacyAssetId: "focus-forest",
    labelKey: "hyperfocusSoundForest",
    levels: makeLevels("forest", ["Canopy Breeze", "Bird Canopy", "Forest Night"]),
  },
  {
    id: "rain",
    legacyId: "rain",
    legacyAssetId: "focus-rain",
    labelKey: "hyperfocusSoundRain",
    levels: makeLevels("rain", ["Light Rain", "Rain Bed", "Heavy Rain"]),
  },
  {
    id: "ocean",
    legacyId: "ocean",
    legacyAssetId: "focus-ocean",
    labelKey: "hyperfocusSoundOcean",
    levels: makeLevels("ocean", ["Shoreline", "Rock Pools", "Heavy Surf"]),
  },
  {
    id: "fireplace",
    legacyId: "fireplace",
    legacyAssetId: "focus-fireplace",
    labelKey: "hyperfocusSoundFireplace",
    levels: makeLevels("fireplace", ["Embers", "Hearth", "Bonfire"]),
  },
  {
    id: "river",
    legacyId: "river",
    legacyAssetId: "focus-river",
    labelKey: "hyperfocusSoundRiver",
    levels: makeLevels("river", ["Brook", "Forest River", "Whitewater"]),
  },
  {
    id: "wind",
    legacyId: "wind",
    legacyAssetId: "focus-wind",
    labelKey: "hyperfocusSoundWind",
    levels: makeLevels("wind", ["Soft Wind", "Wind Bed", "Mountain Wind"]),
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
  const familyAlias = HYPERFOCUS_LEGACY_FAMILY_ALIASES[id];
  if (familyAlias) {
    return { familyId: familyAlias, levelId: "deep" };
  }

  if (isHyperfocusAudioFamilyId(id)) {
    return { familyId: id, levelId: "deep" };
  }

  const [familyId, levelId, extra] = id.split(":");
  const aliasedFamilyId = HYPERFOCUS_LEGACY_FAMILY_ALIASES[familyId] ?? familyId;
  if (extra !== undefined || !isHyperfocusAudioFamilyId(aliasedFamilyId) || !isHyperfocusAudioLevelId(levelId)) {
    return null;
  }

  return { familyId: aliasedFamilyId, levelId };
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
