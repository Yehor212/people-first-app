import { create } from "zustand";
import { logger } from "@/lib/logger";

type PopupType =
  | "mood"
  | "habit"
  | "focus"
  | "gratitude"
  | "breathing"
  | "streak"
  | "bonus"
  | "mindful";

// Hook functions registered by bridge (from useGamification + useInnerWorld)
// showPopup + sync registered via bridge to eliminate inverted deps (C2: store→component, C3: store→storage)
interface RegisteredHooks {
  awardXp: (activity: string) => void;
  earnTreats: (
    source: string,
    amount: number,
    reason?: string,
  ) => { earned: number };
  plantSeed: (activity: string, extra?: string) => unknown;
  waterPlants: (activity: string) => void;
  showPopup: (amount: number, type: PopupType) => void;
  sync: () => void;
}

export interface RewardOptions {
  treats: number;
  treatReason: string;
  haptic?: () => Promise<void>;
  seedExtra?: string;
  skipXp?: boolean;
  skipPopup?: boolean;
  skipGarden?: boolean;
  skipSync?: boolean;
}

export interface RewardResult {
  treatsEarned: number;
}

interface GamificationState {
  _hooks: RegisteredHooks | null;
}

interface GamificationActions {
  _registerHooks: (hooks: RegisteredHooks) => void;
  rewardUser: (activity: string, options: RewardOptions) => RewardResult;
}

export const useGamificationStore = create<
  GamificationState & GamificationActions
>((set, get) => ({
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
    const treatResult = hooks.earnTreats(
      activity,
      options.treats,
      options.treatReason,
    );

    // 3. Show treats popup (via bridge — no direct component import)
    if (!options.skipPopup)
      hooks.showPopup(treatResult.earned, activity as PopupType);

    // 4. Sync to cloud (via bridge — no direct storage import)
    if (!options.skipSync) hooks.sync();

    // 5. Haptic feedback
    if (options.haptic) void options.haptic();

    // 6. Inner World: plant + water
    if (!options.skipGarden) {
      hooks.plantSeed(activity, options.seedExtra);
      hooks.waterPlants(activity);
    }

    return { treatsEarned: treatResult.earned };
  },
}));
