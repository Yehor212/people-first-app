import { create } from 'zustand';
import type { Habit } from '@/types';
import type { FeatureId } from '@/lib/onboardingFlow';
import type { ChallengeInvite } from '@/lib/friendChallenge';
import type { UpdateState } from '@/lib/appUpdateManager';

type ModalName =
  | 'showWeeklyReport' | 'showWidgetSettings' | 'showChallenges'
  | 'showChallengeModal' | 'showTimeHelper' | 'showTasksPanel'
  | 'showQuestsPanel' | 'showFriendsPanel' | 'showWelcomeOverlay'
  | 'showWelcomeBack' | 'showMindfulMoment';

interface UIState {
  // Modal booleans
  showWeeklyReport: boolean;
  showWidgetSettings: boolean;
  showChallenges: boolean;
  showChallengeModal: boolean;
  showTimeHelper: boolean;
  showTasksPanel: boolean;
  showQuestsPanel: boolean;
  showFriendsPanel: boolean;
  showWelcomeOverlay: boolean;
  showWelcomeBack: boolean;
  showMindfulMoment: boolean;

  // Modal data
  challengeInvite: ChallengeInvite | undefined;
  challengeHabit: Habit | undefined;
  welcomeBackData: {
    daysAway: number;
    streakBroken: boolean;
    currentStreak: number;
    topHabits: Array<{ habit: Habit; successRate: number }>;
  } | null;

  // Celebrations/FX
  confettiBurst: { x: number; y: number } | null;
  featureToUnlock: FeatureId | null;

  // App update
  updateState: UpdateState | null;

  // Relay
  journalPromptText: string | undefined;

  // Focus timer (real-time minutes, UI-only)
  currentFocusMinutes: number | undefined;
}

interface UIActions {
  openModal: (name: ModalName) => void;
  closeModal: (name: ModalName) => void;
  closeAllModals: () => void;
  tryCloseTopModal: () => boolean;

  setConfettiBurst: (pos: { x: number; y: number } | null) => void;
  setFeatureToUnlock: (feature: FeatureId | null) => void;
  setUpdateState: (state: UpdateState | null) => void;
  setChallengeInvite: (invite: ChallengeInvite | undefined) => void;
  setChallengeHabit: (habit: Habit | undefined) => void;
  setWelcomeBackData: (data: UIState['welcomeBackData']) => void;
  setJournalPromptText: (text: string | undefined) => void;
  setCurrentFocusMinutes: (minutes: number | undefined) => void;
}

// Priority order for Android back button (matches original Index.tsx logic)
const MODAL_CLOSE_PRIORITY: ModalName[] = [
  'showFriendsPanel', 'showTasksPanel', 'showQuestsPanel',
  'showChallenges', 'showChallengeModal', 'showWidgetSettings',
  'showWeeklyReport', 'showTimeHelper', 'showMindfulMoment',
  'showWelcomeBack', 'showWelcomeOverlay',
];

const MODAL_DEFAULTS: Record<ModalName, boolean> = {
  showWeeklyReport: false,
  showWidgetSettings: false,
  showChallenges: false,
  showChallengeModal: false,
  showTimeHelper: false,
  showTasksPanel: false,
  showQuestsPanel: false,
  showFriendsPanel: false,
  showWelcomeOverlay: false,
  showWelcomeBack: false,
  showMindfulMoment: false,
};

export const useUIStore = create<UIState & UIActions>((set, get) => ({
  ...MODAL_DEFAULTS,

  challengeInvite: undefined,
  challengeHabit: undefined,
  welcomeBackData: null,
  confettiBurst: null,
  featureToUnlock: null,
  updateState: null,
  journalPromptText: undefined,
  currentFocusMinutes: undefined,

  openModal: (name) => set({ [name]: true }),
  closeModal: (name) => set({ [name]: false }),
  closeAllModals: () => set({ ...MODAL_DEFAULTS }),

  tryCloseTopModal: () => {
    const state = get();
    for (const key of MODAL_CLOSE_PRIORITY) {
      if (state[key]) {
        set({ [key]: false });
        return true;
      }
    }
    return false;
  },

  setConfettiBurst: (confettiBurst) => set({ confettiBurst }),
  setFeatureToUnlock: (featureToUnlock) => set({ featureToUnlock }),
  setUpdateState: (updateState) => set({ updateState }),
  setChallengeInvite: (challengeInvite) => set({ challengeInvite }),
  setChallengeHabit: (challengeHabit) => set({ challengeHabit }),
  setWelcomeBackData: (welcomeBackData) => set({ welcomeBackData }),
  setJournalPromptText: (journalPromptText) => set({ journalPromptText }),
  setCurrentFocusMinutes: (currentFocusMinutes) => set({ currentFocusMinutes }),
}));

// Derived selector: any modal open (for scroll lock, etc.)
export const selectAnyModalOpen = (state: UIState): boolean =>
  state.showWeeklyReport || state.showWidgetSettings || state.showChallenges ||
  state.showChallengeModal || state.showTimeHelper || state.showTasksPanel ||
  state.showQuestsPanel || state.showFriendsPanel || state.showWelcomeOverlay ||
  state.showWelcomeBack || state.showMindfulMoment;
