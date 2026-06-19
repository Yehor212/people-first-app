import { BASE_URL } from "@/lib/env";

export const APP_AUDIO_PLATFORMS = ["web", "pwa", "android", "ios", "desktop"] as const;

export type AppAudioPlatform = (typeof APP_AUDIO_PLATFORMS)[number];
export type AppAudioFamily = "entry" | "orb" | "diary" | "focus";
export type AppAudioFeedbackSoundType = "success" | "complete" | "streak" | "levelUp" | "notification";
export type AppAudioRewardActivity = "mood" | "habit" | "focus" | "gratitude" | "journal" | "breathing";

export interface AppAudioAsset {
  id: string;
  family: AppAudioFamily;
  publicPath: string;
  src: string;
  fallbackLabel: string;
  labelKey?: string;
  startsOnUserGesture: boolean;
  respectsMasterVolume: boolean;
  platforms: readonly AppAudioPlatform[];
}

export interface AppAudioFeedbackEvent {
  id: AppAudioFeedbackSoundType;
  fallbackLabel: string;
  respectsMasterVolume: boolean;
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
    | "levelUp"
    | "notification";
  fallbackLabel: string;
  soundType: AppAudioFeedbackSoundType;
  rationale: string;
  startsOnUserGesture: boolean;
  respectsMasterVolume: boolean;
  platforms: readonly AppAudioPlatform[];
}

const allPlatforms = APP_AUDIO_PLATFORMS;

function makeAsset(
  id: string,
  family: AppAudioFamily,
  publicPath: string,
  fallbackLabel: string,
  labelKey?: string,
): AppAudioAsset {
  return {
    id,
    family,
    publicPath,
    src: BASE_URL + publicPath,
    fallbackLabel,
    labelKey,
    startsOnUserGesture: true,
    respectsMasterVolume: true,
    platforms: allPlatforms,
  };
}

function makeActionEvent(
  id: AppAudioActionEvent["id"],
  fallbackLabel: string,
  soundType: AppAudioFeedbackSoundType,
  rationale: string,
): AppAudioActionEvent {
  return {
    id,
    fallbackLabel,
    soundType,
    rationale,
    startsOnUserGesture: true,
    respectsMasterVolume: true,
    platforms: allPlatforms,
  };
}

export const APP_AUDIO_ASSETS = [
  makeAsset("measured-breath", "entry", "sounds/measured-breath.mp3", "Measured breath", "authMeasuredBreathLabel"),
  makeAsset("orb-ambience", "orb", "sounds/polished-stone-and-paper.mp3", "Orb ambience", "orbAmbienceLabel"),
  makeAsset("diary-reflection-loop", "diary", "sounds/v2-diary-reflection-loop.mp3", "Diary ambience", "diaryAmbienceLabel"),
  makeAsset("focus-underwater", "focus", "sounds/mixkit-underwater-transmitter-hum-2135.mp3", "Underwater hum"),
  makeAsset("focus-thunderstorm", "focus", "sounds/mixkit-calm-thunderstorm-in-the-jungle-2415.mp3", "Jungle thunderstorm"),
  makeAsset("focus-ocean", "focus", "sounds/mixkit-small-waves-harbor-rocks-1208.mp3", "Waves on rocks"),
  makeAsset("focus-river", "focus", "sounds/mixkit-wildlife-environment-in-a-river-2456.mp3", "River wildlife"),
  makeAsset("focus-cafe", "focus", "sounds/cafe-noise-32940.mp3", "Cafe ambience"),
  makeAsset("focus-fireplace", "focus", "sounds/fireplace-fx-56636.mp3", "Fireplace crackling"),
] as const satisfies readonly AppAudioAsset[];

export type AppAudioAssetId = (typeof APP_AUDIO_ASSETS)[number]["id"];

export const APP_AUDIO_FEEDBACK_EVENTS: readonly AppAudioFeedbackEvent[] = [
  { id: "success", fallbackLabel: "Success chime", respectsMasterVolume: true, platforms: allPlatforms },
  { id: "complete", fallbackLabel: "Completion chime", respectsMasterVolume: true, platforms: allPlatforms },
  { id: "streak", fallbackLabel: "Streak milestone", respectsMasterVolume: true, platforms: allPlatforms },
  { id: "levelUp", fallbackLabel: "Level up fanfare", respectsMasterVolume: true, platforms: allPlatforms },
  { id: "notification", fallbackLabel: "Notification ping", respectsMasterVolume: true, platforms: allPlatforms },
];

export const APP_AUDIO_ACTION_EVENTS: readonly AppAudioActionEvent[] = [
  makeActionEvent("moodSaved", "Mood saved", "success", "A quiet confirmation after emotional check-in."),
  makeActionEvent("habitCompleted", "Habit completed", "complete", "Primary completion cue for a finished habit."),
  makeActionEvent("journalSaved", "Journal saved", "success", "Confirms a private entry was saved."),
  makeActionEvent("focusCompleted", "Focus completed", "complete", "Marks the end of an intentional focus session."),
  makeActionEvent("gratitudeSaved", "Gratitude saved", "success", "Acknowledges a gratitude entry without celebration overload."),
  makeActionEvent("breathingCompleted", "Breathing completed", "success", "A soft finish cue for breathing practice."),
  makeActionEvent("achievementUnlocked", "Achievement unlocked", "levelUp", "Reserved for rare unlocks."),
  makeActionEvent("streakMilestone", "Streak milestone", "streak", "Reserved for meaningful streak thresholds."),
  makeActionEvent("levelUp", "Level up", "levelUp", "Reserved for XP level transitions."),
  makeActionEvent("notification", "Notification ping", "notification", "A short opt-in reminder preview."),
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

export function getAppAudioAssetsByFamily(family: AppAudioFamily): AppAudioAsset[] {
  return APP_AUDIO_ASSETS.filter((asset) => asset.family === family);
}

export function getAppAudioRewardSoundType(activity: AppAudioRewardActivity): AppAudioFeedbackSoundType {
  return APP_AUDIO_REWARD_SOUND_BY_ACTIVITY[activity];
}
