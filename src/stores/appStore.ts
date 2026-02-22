import { create } from 'zustand';

export type TabType = 'home' | 'garden' | 'stats' | 'achievements' | 'settings';

export interface InitializationState {
  isInitializing: boolean;
  error: string | null;
  wasUpdated: boolean;
}

interface AppState {
  // Navigation
  activeTab: TabType;
  settingsOpenSection: string | undefined;

  // App lifecycle
  initializationState: InitializationState;
  loadingFadeOut: boolean;
  currentDate: string; // YYYY-MM-DD

  // Auth
  authBypassFlag: boolean;
  isProcessingWebOAuth: boolean;
  webOAuthError: string | null;
  hasValidSession: boolean | null; // null = checking

  // Gate bypass flags (synchronous — survive until page refresh)
  tutorialBypassFlag: boolean;
  onboardingBypassFlag: boolean;
}

interface AppActions {
  setActiveTab: (tab: TabType) => void;
  setSettingsOpenSection: (section: string | undefined) => void;
  setInitializationState: (state: InitializationState) => void;
  setLoadingFadeOut: (value: boolean) => void;
  setCurrentDate: (date: string) => void;
  setAuthBypassFlag: (value: boolean) => void;
  setIsProcessingWebOAuth: (value: boolean) => void;
  setWebOAuthError: (error: string | null) => void;
  setHasValidSession: (value: boolean | null) => void;
  setTutorialBypassFlag: (value: boolean) => void;
  setOnboardingBypassFlag: (value: boolean) => void;
  resetAuthState: () => void;
}

export const useAppStore = create<AppState & AppActions>((set) => ({
  // Initial values matching Index.tsx
  activeTab: 'home',
  settingsOpenSection: undefined,
  initializationState: {
    isInitializing: true,
    error: null,
    wasUpdated: false,
  },
  loadingFadeOut: false,
  currentDate: '',
  authBypassFlag: false,
  tutorialBypassFlag: false,
  onboardingBypassFlag: false,
  isProcessingWebOAuth: false,
  webOAuthError: null,
  hasValidSession: null,

  // Actions
  setActiveTab: (tab) => set((state) => ({
    activeTab: tab,
    // Clear settings section when leaving settings tab (was separate useEffect)
    settingsOpenSection: tab !== 'settings' ? undefined : state.settingsOpenSection,
  })),
  setSettingsOpenSection: (section) => set({ settingsOpenSection: section }),
  setInitializationState: (initializationState) => set({ initializationState }),
  setLoadingFadeOut: (loadingFadeOut) => set({ loadingFadeOut }),
  setCurrentDate: (currentDate) => set({ currentDate }),
  setAuthBypassFlag: (authBypassFlag) => set({ authBypassFlag }),
  setIsProcessingWebOAuth: (isProcessingWebOAuth) => set({ isProcessingWebOAuth }),
  setWebOAuthError: (webOAuthError) => set({ webOAuthError }),
  setHasValidSession: (hasValidSession) => set({ hasValidSession }),
  setTutorialBypassFlag: (tutorialBypassFlag) => set({ tutorialBypassFlag }),
  setOnboardingBypassFlag: (onboardingBypassFlag) => set({ onboardingBypassFlag }),
  resetAuthState: () => set({
    hasValidSession: false,
    authBypassFlag: false,
  }),
}));
