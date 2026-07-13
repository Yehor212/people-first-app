import type {
  BackgroundIntensity,
  DiaryBgPattern,
  DiaryFontName,
  DiaryThemeName,
  JournalEntry,
  PaperColor,
  PaperTexture,
  ParticleSpeed,
} from "./types";
import {
  DIARY_BG_PATTERN_NAMES,
  DIARY_FONT_NAMES,
  DIARY_THEME_NAMES,
  PAPER_TEXTURE_NAMES,
} from "./types";

export type JournalEntryStyleFields = Pick<
  JournalEntry,
  | "theme"
  | "font"
  | "inkColor"
  | "paperTexture"
  | "bgPattern"
  | "paperColor"
  | "bgIntensity"
  | "particleSpeed"
  | "fontSize"
>;

const PAPER_COLOR_NAMES = ["white", "dark", "milky"] as const satisfies readonly PaperColor[];
const BG_INTENSITY_NAMES = ["full", "dim", "off"] as const satisfies readonly BackgroundIntensity[];
const PARTICLE_SPEED_NAMES = ["off", "slow", "drift"] as const satisfies readonly ParticleSpeed[];
const FONT_SIZE_NAMES = ["small", "medium", "large"] as const satisfies readonly NonNullable<
  JournalEntry["fontSize"]
>[];

function optionalEnum<T extends string>(value: unknown, allowed: readonly T[]): T | undefined {
  return typeof value === "string" && allowed.includes(value as T) ? (value as T) : undefined;
}

function optionalInkColor(value: unknown): string | undefined {
  if (typeof value !== "string") return undefined;
  const trimmed = value.trim();
  return /^#(?:[0-9a-fA-F]{3}|[0-9a-fA-F]{4}|[0-9a-fA-F]{6}|[0-9a-fA-F]{8})$/.test(trimmed)
    ? trimmed
    : undefined;
}

function compactStyleFields(fields: JournalEntryStyleFields): JournalEntryStyleFields {
  return Object.fromEntries(
    Object.entries(fields).filter(([, value]) => value !== undefined)
  );
}

export function normalizeJournalStyleFields(source: unknown): JournalEntryStyleFields {
  if (!source || typeof source !== "object") return {};
  const raw = source as Record<string, unknown>;

  return compactStyleFields({
    theme: optionalEnum<DiaryThemeName>(raw.theme, DIARY_THEME_NAMES),
    font: optionalEnum<DiaryFontName>(raw.font, DIARY_FONT_NAMES),
    inkColor: optionalInkColor(raw.inkColor),
    paperTexture: optionalEnum<PaperTexture>(raw.paperTexture, PAPER_TEXTURE_NAMES),
    bgPattern: optionalEnum<DiaryBgPattern>(raw.bgPattern, DIARY_BG_PATTERN_NAMES),
    paperColor: optionalEnum<PaperColor>(raw.paperColor, PAPER_COLOR_NAMES),
    bgIntensity: optionalEnum<BackgroundIntensity>(raw.bgIntensity, BG_INTENSITY_NAMES),
    particleSpeed: optionalEnum<ParticleSpeed>(raw.particleSpeed, PARTICLE_SPEED_NAMES),
    fontSize: optionalEnum<NonNullable<JournalEntry["fontSize"]>>(raw.fontSize, FONT_SIZE_NAMES),
  });
}

export function normalizeJournalStyleFieldsFromCloud(source: unknown): JournalEntryStyleFields {
  if (!source || typeof source !== "object") return {};
  const raw = source as Record<string, unknown>;

  return normalizeJournalStyleFields({
    theme: raw.theme,
    font: raw.font,
    inkColor: raw.ink_color,
    paperTexture: raw.paper_texture,
    bgPattern: raw.bg_pattern,
    paperColor: raw.paper_color,
    bgIntensity: raw.bg_intensity,
    particleSpeed: raw.particle_speed,
    fontSize: raw.font_size,
  });
}

export function journalStyleFieldsToCloud(entry: JournalEntry) {
  const style = normalizeJournalStyleFields(entry);
  return {
    theme: style.theme || null,
    font: style.font || null,
    ink_color: style.inkColor || null,
    paper_texture: style.paperTexture || null,
    bg_pattern: style.bgPattern || null,
    paper_color: style.paperColor || null,
    bg_intensity: style.bgIntensity || null,
    particle_speed: style.particleSpeed || null,
    font_size: style.fontSize || null,
  };
}
