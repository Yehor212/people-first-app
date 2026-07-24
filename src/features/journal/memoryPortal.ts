import { safeJsonParse, storageGetRaw, storageSetRaw } from "@/lib/safeJson";
import type { MoodEntry, MoodType } from "@/types";
import type { JournalEntry } from "./types";
import { countWordsHtml } from "./types";

export type MemoryPortalAction = "write" | "voice" | "photo" | "gratitude" | "burn" | "focus";

export type MemoryPortalMotionIntensity = "quiet" | "alive" | "cinematic";

export interface MemoryPortalPreferences {
  motionIntensity: MemoryPortalMotionIntensity;
  actionOrder: MemoryPortalAction[];
  constellationVisible: boolean;
  updatedAt: number;
}

export interface MemoryPortalNode {
  id: string;
  entryId: string;
  date: string;
  title: string;
  x: number;
  y: number;
  size: "sm" | "md" | "lg";
  mood?: MoodType;
  hasMedia: boolean;
  hasAudio: boolean;
  wordCount: number;
  createdAt: number;
  isSelectedDay: boolean;
}

export type ZodiacSign =
  | "aries"
  | "taurus"
  | "gemini"
  | "cancer"
  | "leo"
  | "virgo"
  | "libra"
  | "scorpio"
  | "sagittarius"
  | "capricorn"
  | "aquarius"
  | "pisces";

export interface MemoryPortalMoodSignal {
  valence: number;
  hasMoodSignal: boolean;
  source: "mood" | "journal" | "none";
}

export const MEMORY_PORTAL_PREFERENCES_KEY = "zenflow:journal-memory-portal-preferences:v1";

export const MEMORY_PORTAL_ACTIONS: readonly MemoryPortalAction[] = [
  "write",
  "voice",
  "photo",
  "gratitude",
  "burn",
  "focus",
] as const;

export const MEMORY_PORTAL_ACTION_ICON_KEYS: Record<MemoryPortalAction, string> = {
  write: "penLine",
  voice: "mic",
  photo: "image",
  gratitude: "sprout",
  burn: "flame",
  focus: "target",
};

export const DEFAULT_MEMORY_PORTAL_PREFERENCES: MemoryPortalPreferences = {
  motionIntensity: "cinematic",
  actionOrder: [...MEMORY_PORTAL_ACTIONS],
  constellationVisible: true,
  updatedAt: 0,
};

export const MEMORY_PORTAL_MOOD_VALENCE: Record<MoodType, number> = {
  terrible: -0.88,
  bad: -0.48,
  okay: 0,
  good: 0.46,
  great: 0.86,
};

export const ZODIAC_CONSTELLATIONS: Record<ZodiacSign, readonly [number, number][]> = {
  aries: [
    [18, 58],
    [33, 42],
    [48, 36],
    [64, 45],
    [78, 32],
  ],
  taurus: [
    [18, 54],
    [34, 45],
    [50, 50],
    [64, 34],
    [80, 42],
    [56, 64],
  ],
  gemini: [
    [28, 28],
    [30, 50],
    [32, 72],
    [68, 28],
    [66, 50],
    [64, 72],
  ],
  cancer: [
    [20, 45],
    [36, 36],
    [52, 44],
    [68, 35],
    [80, 48],
    [58, 63],
  ],
  leo: [
    [18, 62],
    [35, 48],
    [48, 30],
    [63, 36],
    [74, 52],
    [57, 68],
  ],
  virgo: [
    [16, 44],
    [30, 38],
    [46, 46],
    [62, 40],
    [78, 50],
    [62, 66],
  ],
  libra: [
    [18, 60],
    [32, 42],
    [50, 36],
    [68, 42],
    [82, 60],
    [50, 67],
  ],
  scorpio: [
    [16, 40],
    [30, 48],
    [44, 42],
    [58, 52],
    [72, 46],
    [84, 62],
  ],
  sagittarius: [
    [18, 68],
    [36, 50],
    [54, 34],
    [76, 28],
    [58, 56],
    [72, 70],
  ],
  capricorn: [
    [18, 36],
    [34, 48],
    [50, 40],
    [66, 54],
    [80, 44],
    [60, 72],
  ],
  aquarius: [
    [18, 42],
    [34, 34],
    [50, 44],
    [66, 34],
    [82, 42],
    [50, 64],
  ],
  pisces: [
    [20, 30],
    [34, 46],
    [48, 62],
    [64, 46],
    [78, 30],
    [50, 44],
  ],
};

function isMemoryPortalAction(value: unknown): value is MemoryPortalAction {
  return typeof value === "string" && MEMORY_PORTAL_ACTIONS.includes(value as MemoryPortalAction);
}

function normalizeActionOrder(value: unknown): MemoryPortalAction[] {
  if (!Array.isArray(value)) return [...DEFAULT_MEMORY_PORTAL_PREFERENCES.actionOrder];

  const next = value.filter(isMemoryPortalAction);
  for (const action of MEMORY_PORTAL_ACTIONS) {
    if (!next.includes(action)) next.push(action);
  }
  return next;
}

export function loadMemoryPortalPreferences(): MemoryPortalPreferences {
  const raw = storageGetRaw(MEMORY_PORTAL_PREFERENCES_KEY, "");
  const parsed = safeJsonParse<Partial<MemoryPortalPreferences>>(raw, {});
  const motionIntensity: MemoryPortalMotionIntensity =
    parsed.motionIntensity === "quiet" ||
    parsed.motionIntensity === "alive" ||
    parsed.motionIntensity === "cinematic"
      ? parsed.motionIntensity
      : DEFAULT_MEMORY_PORTAL_PREFERENCES.motionIntensity;

  return {
    motionIntensity,
    actionOrder: normalizeActionOrder(parsed.actionOrder),
    constellationVisible:
      typeof parsed.constellationVisible === "boolean"
        ? parsed.constellationVisible
        : DEFAULT_MEMORY_PORTAL_PREFERENCES.constellationVisible,
    updatedAt:
      typeof parsed.updatedAt === "number" && Number.isFinite(parsed.updatedAt) ? parsed.updatedAt : 0,
  };
}

export function saveMemoryPortalPreferences(
  preferences: Partial<MemoryPortalPreferences>
): MemoryPortalPreferences {
  const current = loadMemoryPortalPreferences();
  const next: MemoryPortalPreferences = {
    ...current,
    ...preferences,
    actionOrder: normalizeActionOrder(preferences.actionOrder ?? current.actionOrder),
    updatedAt: Date.now(),
  };
  storageSetRaw(MEMORY_PORTAL_PREFERENCES_KEY, JSON.stringify(next));
  return next;
}

export function stripJournalText(content: string): string {
  return content
    .replace(/<[^>]*>/g, " ")
    .replace(/&nbsp;/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

export function countJournalWords(content: string): number {
  return countWordsHtml(content);
}

function clampValence(value: number): number {
  return Math.max(-1, Math.min(1, value));
}

function averageValence(values: number[]): number {
  if (values.length === 0) return 0;
  return clampValence(values.reduce((sum, value) => sum + value, 0) / values.length);
}

function moodEntryValence(entry: MoodEntry): number {
  return typeof entry.valence === "number" && Number.isFinite(entry.valence)
    ? clampValence(entry.valence)
    : MEMORY_PORTAL_MOOD_VALENCE[entry.mood];
}

export function getMemoryPortalMoodSignal(
  entries: JournalEntry[],
  moods: MoodEntry[] | null | undefined,
  selectedDate: string | null | undefined
): MemoryPortalMoodSignal {
  if (!selectedDate) {
    return { valence: 0, hasMoodSignal: false, source: "none" };
  }

  const dayMoodValues = (moods ?? [])
    .filter((entry) => entry.date === selectedDate)
    .map(moodEntryValence);

  if (dayMoodValues.length > 0) {
    return {
      valence: averageValence(dayMoodValues),
      hasMoodSignal: true,
      source: "mood",
    };
  }

  const journalMoodValues = entries
    .filter((entry) => entry.date === selectedDate && entry.mood)
    .map((entry) => MEMORY_PORTAL_MOOD_VALENCE[entry.mood!]);

  if (journalMoodValues.length > 0) {
    return {
      valence: averageValence(journalMoodValues),
      hasMoodSignal: true,
      source: "journal",
    };
  }

  return { valence: 0, hasMoodSignal: false, source: "none" };
}

export function getZodiacSignForBirthDate(birthDate: string | null | undefined): ZodiacSign | null {
  const normalized = birthDate?.trim().replace(/^"|"$/g, "");
  if (!normalized) return null;

  const isoMatch = /^(\d{4})-(\d{2})-(\d{2})/.exec(normalized);
  let month: number;
  let day: number;
  if (isoMatch) {
    month = Number(isoMatch[2]);
    day = Number(isoMatch[3]);
  } else {
    const parsed = new Date(normalized);
    if (Number.isNaN(parsed.getTime())) return null;
    month = parsed.getUTCMonth() + 1;
    day = parsed.getUTCDate();
  }

  if (!Number.isInteger(month) || !Number.isInteger(day) || month < 1 || month > 12 || day < 1 || day > 31) {
    return null;
  }

  const value = month * 100 + day;
  if (value >= 321 && value <= 419) return "aries";
  if (value >= 420 && value <= 520) return "taurus";
  if (value >= 521 && value <= 620) return "gemini";
  if (value >= 621 && value <= 722) return "cancer";
  if (value >= 723 && value <= 822) return "leo";
  if (value >= 823 && value <= 922) return "virgo";
  if (value >= 923 && value <= 1022) return "libra";
  if (value >= 1023 && value <= 1121) return "scorpio";
  if (value >= 1122 && value <= 1221) return "sagittarius";
  if (value >= 1222 || value <= 119) return "capricorn";
  if (value >= 120 && value <= 218) return "aquarius";
  return "pisces";
}

function hashString(value: string): number {
  let hash = 2166136261;
  for (let i = 0; i < value.length; i += 1) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 16777619);
  }
  return hash >>> 0;
}

function clampPercent(value: number): number {
  return Math.max(8, Math.min(92, value));
}

function deriveNodeTitle(entry: JournalEntry): string {
  const title = entry.title.trim();
  if (title) return title;

  const text = stripJournalText(entry.content);
  if (!text) return entry.date;
  return text.length > 38 ? `${text.slice(0, 38).trimEnd()}...` : text;
}

function deriveNodeSize(entry: JournalEntry, wordCount: number, isSelectedDay: boolean): MemoryPortalNode["size"] {
  if (isSelectedDay || entry.photoIds.length > 0 || wordCount >= 220) return "lg";
  if ((entry.audioIds?.length ?? 0) > 0 || wordCount >= 80) return "md";
  return "sm";
}

export function buildMemoryPortalNodes(
  entries: JournalEntry[],
  selectedDate: string | null | undefined,
  limit = 18
): MemoryPortalNode[] {
  const selected = selectedDate ?? null;
  return [...entries]
    .sort((a, b) => {
      const selectedWeight =
        Number(Boolean(selected && b.date === selected)) - Number(Boolean(selected && a.date === selected));
      if (selectedWeight !== 0) return selectedWeight;
      return b.createdAt - a.createdAt;
    })
    .slice(0, limit)
    .map((entry, index) => {
      const seed = hashString(`${entry.id}:${entry.date}:${entry.createdAt}`);
      const isSelectedDay = Boolean(selected && entry.date === selected);
      const wordCount = countJournalWords(entry.content);
      const xBase = 12 + (seed % 76);
      const yBase = 14 + ((seed >>> 8) % 68);
      const orbitPull = isSelectedDay ? 4 + (index % 3) * 2 : 0;
      return {
        id: `memory-node-${entry.id}`,
        entryId: entry.id,
        date: entry.date,
        title: deriveNodeTitle(entry),
        x: clampPercent(xBase + (index % 2 === 0 ? orbitPull : -orbitPull)),
        y: clampPercent(yBase + (index % 2 === 0 ? -orbitPull : orbitPull)),
        size: deriveNodeSize(entry, wordCount, isSelectedDay),
        mood: entry.mood,
        hasMedia: entry.photoIds.length > 0,
        hasAudio: (entry.audioIds?.length ?? 0) > 0,
        wordCount,
        createdAt: entry.createdAt,
        isSelectedDay,
      };
    });
}

export function getEntriesForPortalDate(entries: JournalEntry[], date: string | null | undefined): JournalEntry[] {
  if (!date) return [];
  return entries.filter((entry) => entry.date === date).sort((a, b) => b.createdAt - a.createdAt);
}
