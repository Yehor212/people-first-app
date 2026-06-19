import { create } from "zustand";
import { logger } from "@/lib/logger";
import { getAppAudioRewardSoundType, type AppAudioFeedbackSoundType } from "@/lib/appAudioAssets";
import { playSound } from "@/lib/audioManager";
import type { XpAction } from "@/lib/gamification";
import type { TreatSource, MoodType } from "@/types";

type PopupType =
  | "mood"
  | "habit"
  | "focus"
  | "gratitude"
  | "breathing"
  | "streak"
  | "bonus"
  | "mindful";

type PlantActivity = "mood" | "habit" | "focus" | "gratitude" | "journal" | "breathing" | "rest";

/** Activities that can be rewarded via rewardUser — intersection of XpAction, TreatSource, PlantActivity, PopupType */
export type RewardActivity = "mood" | "habit" | "focus" | "gratitude" | "journal" | "breathing";

// Hook functions registered by bridge (from useGamification + useInnerWorld)
// showPopup + sync registered via bridge to eliminate inverted deps (C2: store→component, C3: store→storage)
interface RegisteredHooks {
  awardXp: (action: XpAction) => void;
  earnTreats: (
    source: TreatSource,
    baseAmount: number,
    description?: string
  ) => { earned: number; bonus: number; multiplier: number; newBalance: number };
  plantSeed: (sourceActivity: PlantActivity, mood?: MoodType) => null;
  waterPlants: (sourceActivity: PlantActivity) => void;
  showPopup: (amount: number, type: PopupType) => void;
  sync: () => void;
}

export interface RewardOptions {
  treats: number;
  treatReason: string;
  haptic?: () => Promise<void>;
  seedExtra?: MoodType;
  skipXp?: boolean;
  skipPopup?: boolean;
  skipGarden?: boolean;
  skipSync?: boolean;
  sound?: AppAudioFeedbackSoundType | null;
}

export interface RewardResult {
  treatsEarned: number;
}

interface GamificationState {
  _hooks: RegisteredHooks | null;
}

interface GamificationActions {
  _registerHooks: (hooks: RegisteredHooks) => void;
  rewardUser: (activity: RewardActivity, options: RewardOptions) => RewardResult;
}

export const useGamificationStore = create<GamificationState & GamificationActions>((set, get) => ({
  _hooks: null,

  _registerHooks: (hooks) => set({ _hooks: hooks }),

  rewardUser: (activity, options) => {
    const hooks = get()._hooks;
    if (!hooks) {
      logger.warn("[rewardUser] called before hooks registered");
      return { treatsEarned: 0 };
    }

    // 1. Award XP (legacy gamification)
    if (!options.skipXp) hooks.awardXp(activity);

    // 2. Earn treats (companion reward system)
    const treatResult = hooks.earnTreats(activity, options.treats, options.treatReason);

    // 3. Show treats popup (via bridge — no direct component import)
    if (!options.skipPopup) hooks.showPopup(treatResult.earned, activity as PopupType);

    // 4. Sync to cloud (via bridge — no direct storage import)
    if (!options.skipSync) hooks.sync();

    // 5. Haptic feedback
    if (options.haptic) void options.haptic();

    // 6. Short action sound feedback
    const sound = options.sound === undefined ? getAppAudioRewardSoundType(activity) : options.sound;
    if (sound) playSound(sound);

    // 7. Inner World: plant + water
    if (!options.skipGarden) {
      hooks.plantSeed(activity, options.seedExtra);
      hooks.waterPlants(activity);
    }

    return { treatsEarned: treatResult.earned };
  },
}));
