import { create } from 'zustand';
import type { Habit } from '@/types';
import type { FeatureId } from '@/lib/onboardingFlow';
import type { ChallengeInvite } from '@/lib/friendChallenge';
import type { UpdateState } from '@/lib/appUpdateManager';

export type ModalName =
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

  // Focus mini-player bridge (synced from useFocusTimer on state transitions)
  focusEndTime: number | null;
  focusIsRunning: boolean;
  focusIsBreak: boolean;
  focusLabel: string;
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
  setFocusTimerBridge: (state: { endTime: number | null; isRunning: boolean; isBreak: boolean; label: string }) => void;
  clearFocusTimerBridge: () => void;
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
  focusEndTime: null,
  focusIsRunning: false,
  focusIsBreak: false,
  focusLabel: '',

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
  setFocusTimerBridge: ({ endTime, isRunning, isBreak, label }) => set({
    focusEndTime: endTime,
    focusIsRunning: isRunning,
    focusIsBreak: isBreak,
    focusLabel: label,
  }),
  clearFocusTimerBridge: () => set({
    focusEndTime: null,
    focusIsRunning: false,
    focusIsBreak: false,
    focusLabel: '',
    currentFocusMinutes: undefined,
  }),
}));

// Focus control callbacks — module-level refs (non-reactive, no Zustand re-renders)
let _focusControls: { toggle: () => void; reset: () => void } | null = null;
export const getFocusControls = () => _focusControls;
export const setFocusControls = (c: typeof _focusControls) => { _focusControls = c; };

/**
 * Creates a stable toggle function for a modal: (value: boolean) => void.
 * Replaces 11 useCallback wrappers in Index.tsx.
 * Usage: const setShowWeeklyReport = useModalToggle('showWeeklyReport');
 */
const modalToggleCache = new Map<ModalName, (value: boolean) => void>();
export function getModalToggle(name: ModalName): (value: boolean) => void {
  let fn = modalToggleCache.get(name);
  if (!fn) {
    fn = (value: boolean) => {
      if (value) {
        useUIStore.getState().openModal(name);
      } else {
        useUIStore.getState().closeModal(name);
      }
    };
    modalToggleCache.set(name, fn);
  }
  return fn;
}

// Derived selector: any modal open (for scroll lock, etc.)
export const selectAnyModalOpen = (state: UIState): boolean =>
  state.showWeeklyReport || state.showWidgetSettings || state.showChallenges ||
  state.showChallengeModal || state.showTimeHelper || state.showTasksPanel ||
  state.showQuestsPanel || state.showFriendsPanel || state.showWelcomeOverlay ||
  state.showWelcomeBack || state.showMindfulMoment;
