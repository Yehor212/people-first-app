import { BASE_URL } from "@/lib/env";

export const APP_AUDIO_PLATFORMS = ["web", "pwa", "android", "ios", "desktop"] as const;

export type AppAudioPlatform = (typeof APP_AUDIO_PLATFORMS)[number];
export type AppAudioFamily = "entry" | "orb" | "diary" | "focus";
export type AppAudioComfortTexture = "air" | "water" | "rain" | "forest" | "fire" | "river" | "wind";
export type AppAudioOfflineStrategy = "runtime-cache";
export type AppAudioFeedbackSoundType = "success" | "complete" | "streak" | "milestone" | "notification";
export type AppAudioRewardActivity = "mood" | "habit" | "focus" | "gratitude" | "journal" | "breathing";
export type AppAudioActionTrigger = "completion" | "milestone" | "preview";
export type AppAudioNonAudioFeedback = "visual+haptic" | "visual" | "visual+haptic-disabled";

export interface AppAudioAsset {
  id: string;
  family: AppAudioFamily;
  publicPath: string;
  src: string;
  fallbackLabel: string;
  labelKey?: string;
  startsOnUserGesture: boolean;
  respectsMasterVolume: boolean;
  comfortTexture: AppAudioComfortTexture;
  offlineStrategy: AppAudioOfflineStrategy;
  warmCacheOnStartup: boolean;
  platforms: readonly AppAudioPlatform[];
}

export interface AppAudioFeedbackEvent {
  id: AppAudioFeedbackSoundType;
  fallbackLabel: string;
  publicPath: string;
  src: string;
  startsOnUserGesture: boolean;
  respectsMasterVolume: boolean;
  offlineStrategy: AppAudioOfflineStrategy;
  platforms: readonly AppAudioPlatform[];
}

export interface AppAudioActionEvent {
  id:
    | "moodSaved"
    | "habitCompleted"
    | "journalSaved"
    | "focusCompleted"
    | "gratitudeSaved"
    | "breathingCompleted"
    | "achievementUnlocked"
    | "streakMilestone"
    | "majorProgressMilestone"
    | "notification";
  fallbackLabel: string;
  soundType: AppAudioFeedbackSoundType;
  rationale: string;
  allowedTrigger: AppAudioActionTrigger;
  nonAudioFeedback: AppAudioNonAudioFeedback;
  startsOnUserGesture: boolean;
  respectsMasterVolume: boolean;
  platforms: readonly AppAudioPlatform[];
}

export interface AppAudioForbiddenAction {
  id: "routineTap" | "tabChange" | "pickerMovement" | "drawerOpen" | "validationError";
  soundType: null;
  reason: string;
  fallbackFeedback: AppAudioNonAudioFeedback;
  platforms: readonly AppAudioPlatform[];
}

const allPlatforms = APP_AUDIO_PLATFORMS;

export function resolveAppAudioAssetSrc(publicPath: string, baseUrl = BASE_URL): string {
  const normalizedPath = publicPath.replace(/^\/+/, "");
  if (!baseUrl || baseUrl === "/") return "/" + normalizedPath;
  if (baseUrl === "." || baseUrl === "./") return "/" + normalizedPath;
  return (baseUrl.endsWith("/") ? baseUrl : baseUrl + "/") + normalizedPath;
}

function makeAsset(
  id: string,
  family: AppAudioFamily,
  publicPath: string,
  fallbackLabel: string,
  comfortTexture: AppAudioComfortTexture,
  labelKey?: string,
  warmCacheOnStartup = true,
): AppAudioAsset {
  return {
    id,
    family,
    publicPath,
    src: resolveAppAudioAssetSrc(publicPath),
    fallbackLabel,
    labelKey,
    startsOnUserGesture: true,
    respectsMasterVolume: true,
    comfortTexture,
    offlineStrategy: "runtime-cache",
    warmCacheOnStartup,
    platforms: allPlatforms,
  };
}

function makeActionEvent(
  id: AppAudioActionEvent["id"],
  fallbackLabel: string,
  soundType: AppAudioFeedbackSoundType,
  rationale: string,
  allowedTrigger: AppAudioActionTrigger = "completion",
  nonAudioFeedback: AppAudioNonAudioFeedback = "visual+haptic",
): AppAudioActionEvent {
  return {
    id,
    fallbackLabel,
    soundType,
    rationale,
    allowedTrigger,
    nonAudioFeedback,
    startsOnUserGesture: true,
    respectsMasterVolume: true,
    platforms: allPlatforms,
  };
}

function makeFeedbackEvent(
  id: AppAudioFeedbackSoundType,
  fallbackLabel: string,
): AppAudioFeedbackEvent {
  const publicPath = `sounds/feedback/feedback-${id}.mp3`;
  return {
    id,
    fallbackLabel,
    publicPath,
    src: resolveAppAudioAssetSrc(publicPath),
    startsOnUserGesture: true,
    respectsMasterVolume: true,
    offlineStrategy: "runtime-cache",
    platforms: allPlatforms,
  };
}

export const APP_AUDIO_ASSETS = [
  makeAsset("soft-air-veil", "entry", "sounds/soft-air-veil.mp3", "Soft air", "air", "authMeasuredBreathLabel"),
  makeAsset(
    "cloudlight-evening-loop",
    "entry",
    "sounds/cloudlight-evening-loop.mp3",
    "Cloudlight Evening",
    "air",
    undefined,
    false,
  ),
  makeAsset("lantern-air", "entry", "sounds/music/lantern-air.mp3", "Lantern Air", "air", undefined, false),
  makeAsset("rain-on-paper", "entry", "sounds/music/rain-on-paper.mp3", "Rain On Paper", "rain", undefined, false),
  makeAsset("indigo-dusk", "entry", "sounds/music/indigo-dusk.mp3", "Indigo Dusk", "air", undefined, false),
  makeAsset("quiet-courtyard", "entry", "sounds/music/quiet-courtyard.mp3", "Quiet Courtyard", "air", undefined, false),
  makeAsset("moonlit-water", "entry", "sounds/music/moonlit-water.mp3", "Moonlit Water", "water", undefined, false),
  makeAsset("cedar-mist", "entry", "sounds/music/cedar-mist.mp3", "Cedar Mist", "forest", undefined, false),
  makeAsset("glass-bell-dawn", "entry", "sounds/music/glass-bell-dawn.mp3", "Glass Bell Dawn", "air", undefined, false),
  makeAsset("moss-garden", "entry", "sounds/music/moss-garden.mp3", "Moss Garden", "forest", undefined, false),
  makeAsset("after-rain", "entry", "sounds/music/after-rain.mp3", "After Rain", "rain", undefined, false),
  makeAsset("orb-ambience", "orb", "sounds/gentle-water-bed.mp3", "Gentle water", "water", "orbAmbienceLabel"),
  makeAsset("diary-reflection-loop", "diary", "sounds/soft-rain-veil.mp3", "Soft rain", "rain", "diaryAmbienceLabel"),
  makeAsset("focus-forest", "focus", "sounds/hyperfocus/hyperfocus-forest-deep.mp3", "Forest birds ambience", "forest"),
  makeAsset("focus-rain", "focus", "sounds/hyperfocus/hyperfocus-rain-deep.mp3", "Rain ambience", "rain"),
  makeAsset("focus-ocean", "focus", "sounds/hyperfocus/hyperfocus-ocean-deep.mp3", "Ocean ambience", "water"),
  makeAsset("focus-fireplace", "focus", "sounds/hyperfocus/hyperfocus-fireplace-deep.mp3", "Fireplace ambience", "fire"),
  makeAsset("focus-river", "focus", "sounds/hyperfocus/hyperfocus-river-deep.mp3", "River ambience", "river"),
  makeAsset("focus-wind", "focus", "sounds/hyperfocus/hyperfocus-wind-deep.mp3", "Wind ambience", "wind"),
] as const satisfies readonly AppAudioAsset[];

export type AppAudioAssetId = (typeof APP_AUDIO_ASSETS)[number]["id"];

export const APP_BACKGROUND_MUSIC_ASSET_IDS = [
  "cloudlight-evening-loop",
  "lantern-air",
  "rain-on-paper",
  "indigo-dusk",
  "quiet-courtyard",
  "moonlit-water",
  "cedar-mist",
  "glass-bell-dawn",
  "moss-garden",
  "after-rain",
] as const satisfies readonly AppAudioAssetId[];

export type AppBackgroundMusicAssetId = (typeof APP_BACKGROUND_MUSIC_ASSET_IDS)[number];

const backgroundMusicIdSet = new Set<string>(APP_BACKGROUND_MUSIC_ASSET_IDS);

export const APP_BACKGROUND_MUSIC_COLLECTION: readonly AppAudioAsset[] = Object.freeze(
  APP_BACKGROUND_MUSIC_ASSET_IDS.map((id) => {
    const asset = APP_AUDIO_ASSETS.find((candidate) => candidate.id === id);
    if (!asset) throw new Error("Missing background music asset: " + id);
    return asset;
  }),
);

export function normalizeBackgroundMusicAssetId(value: unknown): AppBackgroundMusicAssetId {
  return typeof value === "string" && backgroundMusicIdSet.has(value)
    ? (value as AppBackgroundMusicAssetId)
    : APP_BACKGROUND_MUSIC_ASSET_IDS[0];
}

export function getNextBackgroundMusicAsset(id: unknown): AppAudioAsset {
  const normalized = normalizeBackgroundMusicAssetId(id);
  const index = APP_BACKGROUND_MUSIC_ASSET_IDS.indexOf(normalized);
  return APP_BACKGROUND_MUSIC_COLLECTION[(index + 1) % APP_BACKGROUND_MUSIC_COLLECTION.length];
}

export const APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS = [
  "soft-air-veil",
  "cloudlight-evening-loop",
  "lantern-air",
  "rain-on-paper",
  "indigo-dusk",
  "quiet-courtyard",
  "moonlit-water",
  "cedar-mist",
  "glass-bell-dawn",
  "moss-garden",
  "after-rain",
  "orb-ambience",
  "diary-reflection-loop",
] as const satisfies readonly AppAudioAssetId[];

export const APP_AUDIO_FEEDBACK_EVENTS: readonly AppAudioFeedbackEvent[] = [
  makeFeedbackEvent("success", "Soft confirmation"),
  makeFeedbackEvent("complete", "Soft completion"),
  makeFeedbackEvent("streak", "Soft streak cue"),
  makeFeedbackEvent("milestone", "Soft milestone cue"),
  makeFeedbackEvent("notification", "Soft reminder cue"),
];

export const APP_AUDIO_ACTION_EVENTS: readonly AppAudioActionEvent[] = [
  makeActionEvent("moodSaved", "Mood saved", "success", "A quiet completion confirmation after emotional check-in."),
  makeActionEvent("habitCompleted", "Habit completed", "complete", "Primary completion cue for a finished habit."),
  makeActionEvent("journalSaved", "Journal saved", "success", "Completion confirmation that a private entry was saved."),
  makeActionEvent("focusCompleted", "Focus completed", "complete", "Completion cue for an intentional focus session."),
  makeActionEvent("gratitudeSaved", "Gratitude saved", "success", "Completion cue for a gratitude entry without celebration overload."),
  makeActionEvent("breathingCompleted", "Breathing completed", "success", "Soft completion cue for breathing practice."),
  makeActionEvent("achievementUnlocked", "Achievement unlocked", "milestone", "Reserved for rare achievement milestones.", "milestone"),
  makeActionEvent("streakMilestone", "Streak milestone", "streak", "Reserved for meaningful streak thresholds.", "milestone"),
  makeActionEvent(
    "majorProgressMilestone",
    "Major progress milestone",
    "milestone",
    "Reserved for rare progress milestones and does not introduce current V2 XP behavior.",
    "milestone",
  ),
  makeActionEvent("notification", "Soft reminder cue", "notification", "A short opt-in reminder preview.", "preview", "visual"),
];

export const APP_AUDIO_FORBIDDEN_ACTIONS: readonly AppAudioForbiddenAction[] = [
  {
    id: "routineTap",
    soundType: null,
    reason: "Routine presses should rely on visual and haptic response so the app stays calm during repeated use.",
    fallbackFeedback: "visual+haptic",
    platforms: allPlatforms,
  },
  {
    id: "tabChange",
    soundType: null,
    reason: "Navigation changes are frequent and must not create repeated audio clutter.",
    fallbackFeedback: "visual+haptic",
    platforms: allPlatforms,
  },
  {
    id: "pickerMovement",
    soundType: null,
    reason: "Slider and picker movement can fire many times per second, so sound remains silent.",
    fallbackFeedback: "visual+haptic",
    platforms: allPlatforms,
  },
  {
    id: "drawerOpen",
    soundType: null,
    reason: "Opening panels and drawers should be readable through motion, state, and focus management.",
    fallbackFeedback: "visual",
    platforms: allPlatforms,
  },
  {
    id: "validationError",
    soundType: null,
    reason: "Errors need visible, screen-reader-friendly messaging rather than startling audio.",
    fallbackFeedback: "visual+haptic-disabled",
    platforms: allPlatforms,
  },
];

export const APP_AUDIO_REWARD_SOUND_BY_ACTIVITY: Record<AppAudioRewardActivity, AppAudioFeedbackSoundType> = {
  mood: "success",
  habit: "complete",
  focus: "complete",
  gratitude: "success",
  journal: "success",
  breathing: "success",
};

export function getAppAudioAsset(id: AppAudioAssetId): AppAudioAsset | undefined {
  return APP_AUDIO_ASSETS.find((asset) => asset.id === id);
}

export function getAppAudioAssetSrc(id: AppAudioAssetId): string {
  const asset = getAppAudioAsset(id);
  if (!asset) throw new Error("Unknown app audio asset: " + id);
  return asset.src;
}

export function getAppAudioFeedbackEvent(
  id: AppAudioFeedbackSoundType,
): AppAudioFeedbackEvent | undefined {
  return APP_AUDIO_FEEDBACK_EVENTS.find((event) => event.id === id);
}

export function getAppAudioFeedbackEventSrc(
  id: AppAudioFeedbackSoundType,
  baseUrl = BASE_URL,
): string {
  const event = getAppAudioFeedbackEvent(id);
  if (!event) throw new Error("Unknown app audio feedback event: " + id);
  return resolveAppAudioAssetSrc(event.publicPath, baseUrl);
}

export function getAppAudioAssetsByFamily(family: AppAudioFamily): AppAudioAsset[] {
  return APP_AUDIO_ASSETS.filter((asset) => asset.family === family);
}

export function getAppAudioRewardSoundType(activity: AppAudioRewardActivity): AppAudioFeedbackSoundType {
  return APP_AUDIO_REWARD_SOUND_BY_ACTIVITY[activity];
}
