import { create } from 'zustand';
import { triggerXpPopup } from '@/components/XpPopup';
import { triggerSync } from '@/storage/cloudSync';

// Hook functions registered by bridge (from useGamification + useInnerWorld)
interface RegisteredHooks {
  awardXp: (activity: string) => void;
  earnTreats: (source: string, amount: number, reason?: string) => { earned: number };
  plantSeed: (activity: string, extra?: string) => unknown;
  waterPlants: (activity: string) => void;
}

type PopupType = Parameters<typeof triggerXpPopup>[1];

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

export const useGamificationStore = create<GamificationState & GamificationActions>((set, get) => ({
  _hooks: null,

  _registerHooks: (hooks) => set({ _hooks: hooks }),

  rewardUser: (activity, options) => {
    const hooks = get()._hooks;
    if (!hooks) {
      console.warn('[rewardUser] called before hooks registered');
      return { treatsEarned: 0 };
    }

    // 1. Award XP (legacy gamification)
    if (!options.skipXp) hooks.awardXp(activity);

    // 2. Earn treats (companion reward system)
    const treatResult = hooks.earnTreats(activity, options.treats, options.treatReason);

    // 3. Show treats popup
    if (!options.skipPopup) triggerXpPopup(treatResult.earned, activity as PopupType);

    // 4. Sync to cloud
    if (!options.skipSync) triggerSync();

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
