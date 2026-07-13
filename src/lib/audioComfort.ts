import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import { SK } from "@/lib/storageKeys";
import {
  APP_AUDIO_ASSETS,
  getAppAudioAsset,
  type AppAudioAssetId,
  type AppAudioComfortTexture,
  type AppAudioFamily,
  type AppAudioPlatform,
} from "@/lib/appAudioAssets";

export type AudioComfortProfileId = "quiet" | "balanced" | "rich";
export type AudioComfortFeedbackSoundType = "success" | "complete" | "streak" | "milestone" | "levelUp" | "notification";
export type AudioComfortSurface = "auth" | "orb" | "diary" | "focus" | "settings" | "notification";
export type AudioVolumeBucket = "muted" | "low" | "medium" | "high";
export type AudioTelemetryName =
  | "audio_play_intent"
  | "audio_play_success"
  | "audio_play_blocked"
  | "audio_stop"
  | "audio_muted"
  | "audio_error"
  | "audio_feedback_submitted";
export type AudioTelemetryOutcome = "intent" | "success" | "blocked" | "stopped" | "muted" | "error" | "submitted";

export interface AudioComfortSettings {
  profile: AudioComfortProfileId;
  ambientEnabled: boolean;
  completionCuesEnabled: boolean;
  milestoneCuesEnabled: boolean;
  reminderCuesEnabled: boolean;
  avoidedTextures: AppAudioComfortTexture[];
}

export interface AudioComfortProfile {
  id: AudioComfortProfileId;
  label: string;
  description: string;
  settings: AudioComfortSettings;
}

export interface AudioTelemetryEvent {
  name: AudioTelemetryName;
  surface: AudioComfortSurface;
  assetFamily: AppAudioFamily | "feedback";
  platform: AppAudioPlatform;
  outcome: AudioTelemetryOutcome;
  muted: boolean;
  volumeBucket: AudioVolumeBucket;
  errorCode?: string;
}

export interface AudioSupportSnapshot {
  schemaVersion: number;
  surface: AudioComfortSurface;
  platform: AppAudioPlatform;
  muted: boolean;
  volumeBucket: AudioVolumeBucket;
  profile: AudioComfortProfileId;
  ambientEnabled: boolean;
  completionCuesEnabled: boolean;
  milestoneCuesEnabled: boolean;
  reminderCuesEnabled: boolean;
  avoidedTextures: AppAudioComfortTexture[];
  audioContextState?: string;
  unlockState?: "unlocked" | "locked" | "unknown";
  lastErrorCode?: string;
}

const DEFAULT_AUDIO_COMFORT: AudioComfortSettings = {
  profile: "balanced",
  ambientEnabled: true,
  completionCuesEnabled: true,
  milestoneCuesEnabled: true,
  reminderCuesEnabled: true,
  avoidedTextures: [],
};

export const AUDIO_COMFORT_PROFILES: readonly AudioComfortProfile[] = [
  {
    id: "quiet",
    label: "Quiet",
    description: "No passive ambience; Hyperfocus sounds only when explicitly selected.",
    settings: {
      profile: "quiet",
      ambientEnabled: false,
      completionCuesEnabled: true,
      milestoneCuesEnabled: false,
      reminderCuesEnabled: false,
      avoidedTextures: [],
    },
  },
  {
    id: "balanced",
    label: "Balanced",
    description: "Gentle ambience and meaningful cues.",
    settings: DEFAULT_AUDIO_COMFORT,
  },
  {
    id: "rich",
    label: "Rich",
    description: "Full ambience and cues where supported.",
    settings: {
      profile: "rich",
      ambientEnabled: true,
      completionCuesEnabled: true,
      milestoneCuesEnabled: true,
      reminderCuesEnabled: true,
      avoidedTextures: [],
    },
  },
] as const;

export const AUDIO_EVENT_TAXONOMY: readonly AudioTelemetryName[] = [
  "audio_play_intent",
  "audio_play_success",
  "audio_play_blocked",
  "audio_stop",
  "audio_muted",
  "audio_error",
  "audio_feedback_submitted",
] as const;

export const AUDIO_ROLLOUT_FLAGS = [
  "audio.all.enabled",
  "audio.kill_switch",
  "audio.ambient.auth",
  "audio.ambient.orb",
  "audio.ambient.diary",
  "audio.feedback.completion",
  "audio.feedback.milestone",
  "audio.feedback.notification",
  "audio.hyperfocus.family.rain",
] as const;

export const AUDIO_COMFORT_CHANGE_EVENT = "zenflow-audio-comfort-change";
export const AUDIO_SUPPORT_SNAPSHOT_SCHEMA_VERSION = 1;
const FEEDBACK_BUDGET_WINDOW_MS = 30 * 60 * 1_000;
const FEEDBACK_BUDGET_LIMIT: Record<AudioComfortFeedbackSoundType, number> = {
  success: 8,
  complete: 8,
  streak: 3,
  milestone: 3,
  levelUp: 3,
  notification: 4,
};

let cueHistory = new Map<AudioComfortFeedbackSoundType, number[]>();

function isOneOf<T extends string>(value: unknown, allowed: readonly T[]): value is T {
  return typeof value === "string" && (allowed as readonly string[]).includes(value);
}

function isTexture(value: unknown): value is AppAudioComfortTexture {
  return isOneOf(value, ["air", "water", "rain", "forest", "fire", "river", "wind"] as const);
}

function sanitizeErrorCode(value: unknown): string | undefined {
  return typeof value === "string" ? value.replace(/[^A-Z0-9_:-]/gi, "").slice(0, 48) || undefined : undefined;
}

function sanitizeAudioContextState(value: unknown): string | undefined {
  return isOneOf(value, ["running", "suspended", "closed", "interrupted", "unknown"] as const) ? value : undefined;
}

function normalizeSettings(value: Partial<AudioComfortSettings> | null | undefined): AudioComfortSettings {
  const merged = { ...DEFAULT_AUDIO_COMFORT, ...(value ?? {}) };
  const profile = AUDIO_COMFORT_PROFILES.some((item) => item.id === merged.profile) ? merged.profile : "balanced";
  const avoidedTextures = Array.isArray(merged.avoidedTextures)
    ? Array.from(new Set(merged.avoidedTextures.filter(isTexture)))
    : [];

  return {
    profile,
    ambientEnabled: merged.ambientEnabled === true,
    completionCuesEnabled: merged.completionCuesEnabled !== false,
    milestoneCuesEnabled: merged.milestoneCuesEnabled !== false,
    reminderCuesEnabled: merged.reminderCuesEnabled !== false,
    avoidedTextures,
  };
}

function emitAudioComfortChange(settings: AudioComfortSettings): void {
  if (typeof window === "undefined") return;
  window.dispatchEvent(new CustomEvent<AudioComfortSettings>(AUDIO_COMFORT_CHANGE_EVENT, { detail: settings }));
}

export function getAudioComfortSettings(): AudioComfortSettings {
  return normalizeSettings(safeLocalStorageGet<Partial<AudioComfortSettings> | null>(SK.AUDIO_COMFORT, null));
}

export type AudioComfortWriteResult =
  | { ok: true; settings: AudioComfortSettings }
  | { ok: false; settings: AudioComfortSettings };

export function trySetAudioComfortSettings(
  partial: Partial<AudioComfortSettings>,
): AudioComfortWriteResult {
  const current = getAudioComfortSettings();
  const next = normalizeSettings({ ...current, ...partial });
  if (!safeLocalStorageSet(SK.AUDIO_COMFORT, next)) {
    return { ok: false, settings: current };
  }
  emitAudioComfortChange(next);
  return { ok: true, settings: next };
}

export function setAudioComfortSettings(partial: Partial<AudioComfortSettings>): AudioComfortSettings {
  return trySetAudioComfortSettings(partial).settings;
}

export function applyAudioComfortProfile(profileId: AudioComfortProfileId): AudioComfortSettings {
  const profile = AUDIO_COMFORT_PROFILES.find((item) => item.id === profileId) ?? AUDIO_COMFORT_PROFILES[1];
  const next = normalizeSettings(profile.settings);
  safeLocalStorageSet(SK.AUDIO_COMFORT, next);
  emitAudioComfortChange(next);
  return next;
}

export function subscribeAudioComfortSettings(listener: (settings: AudioComfortSettings) => void): () => void {
  if (typeof window === "undefined") return () => undefined;

  const handleChange = (event: Event) => {
    const detail = event instanceof CustomEvent ? event.detail : null;
    listener(normalizeSettings(detail));
  };
  const handleStorage = (event: StorageEvent) => {
    if (event.key === SK.AUDIO_COMFORT) listener(getAudioComfortSettings());
  };

  window.addEventListener(AUDIO_COMFORT_CHANGE_EVENT, handleChange);
  window.addEventListener("storage", handleStorage);
  return () => {
    window.removeEventListener(AUDIO_COMFORT_CHANGE_EVENT, handleChange);
    window.removeEventListener("storage", handleStorage);
  };
}

export function canPlayAmbientAsset(assetId: AppAudioAssetId): boolean {
  const asset = getAppAudioAsset(assetId);
  if (!asset) return false;
  if (asset.family === "focus") return true;

  const settings = getAudioComfortSettings();
  if (!settings.ambientEnabled) return false;
  return !settings.avoidedTextures.includes(asset.comfortTexture);
}

export function canPlayFeedbackSound(type: AudioComfortFeedbackSoundType): boolean {
  const settings = getAudioComfortSettings();
  if (type === "notification") return settings.reminderCuesEnabled;
  if (type === "streak" || type === "milestone" || type === "levelUp") return settings.milestoneCuesEnabled;
  return settings.completionCuesEnabled;
}

export function consumeAudioFeedbackBudget(type: AudioComfortFeedbackSoundType, now = Date.now()): boolean {
  const windowStart = now - FEEDBACK_BUDGET_WINDOW_MS;
  const recent = (cueHistory.get(type) ?? []).filter((timestamp) => timestamp > windowStart);
  if (recent.length >= FEEDBACK_BUDGET_LIMIT[type]) {
    cueHistory.set(type, recent);
    return false;
  }
  recent.push(now);
  cueHistory.set(type, recent);
  return true;
}

export function getVolumeBucket(volume: number, muted = false): AudioVolumeBucket {
  if (muted || volume <= 0) return "muted";
  if (volume < 0.34) return "low";
  if (volume < 0.74) return "medium";
  return "high";
}

export function buildAudioTelemetryEvent(event: AudioTelemetryEvent): AudioTelemetryEvent {
  const normalizedErrorCode = sanitizeErrorCode(event.errorCode);
  return {
    name: event.name,
    surface: event.surface,
    assetFamily: event.assetFamily,
    platform: event.platform,
    outcome: event.outcome,
    muted: event.muted,
    volumeBucket: event.volumeBucket,
    ...(normalizedErrorCode ? { errorCode: normalizedErrorCode } : {}),
  };
}

export function getAudioSupportSnapshot(input: {
  surface: AudioComfortSurface;
  platform: AppAudioPlatform;
  muted: boolean;
  volume: number;
  audioContextState?: string;
  unlockState?: "unlocked" | "locked" | "unknown";
  lastErrorCode?: string;
}): AudioSupportSnapshot {
  const settings = getAudioComfortSettings();
  return {
    schemaVersion: AUDIO_SUPPORT_SNAPSHOT_SCHEMA_VERSION,
    surface: input.surface,
    platform: input.platform,
    muted: input.muted,
    volumeBucket: getVolumeBucket(input.volume, input.muted),
    profile: settings.profile,
    ambientEnabled: settings.ambientEnabled,
    completionCuesEnabled: settings.completionCuesEnabled,
    milestoneCuesEnabled: settings.milestoneCuesEnabled,
    reminderCuesEnabled: settings.reminderCuesEnabled,
    avoidedTextures: settings.avoidedTextures,
    audioContextState: sanitizeAudioContextState(input.audioContextState),
    unlockState: isOneOf(input.unlockState, ["unlocked", "locked", "unknown"] as const) ? input.unlockState : "unknown",
    lastErrorCode: sanitizeErrorCode(input.lastErrorCode),
  };
}

export function getAudioAssetsBlockedByComfort(): AppAudioAssetId[] {
  return APP_AUDIO_ASSETS.filter((asset) => asset.family !== "focus" && !canPlayAmbientAsset(asset.id)).map((asset) => asset.id);
}

export function resetAudioComfortRuntimeForTests(): void {
  cueHistory = new Map<AudioComfortFeedbackSoundType, number[]>();
}
