export { useAppStore, type TabType, type InitializationState } from './appStore';
export { useUIStore, selectAnyModalOpen, getModalToggle, getFocusControls, setFocusControls } from './uiStore';
export { useGamificationStore, type RewardOptions, type RewardResult } from './gamificationStore';
export { useHydrateGamification } from './useHydrateGamification';
export { useUserDataStore, type UserDataState } from './userDataStore';
export { useHydrateUserData } from './useHydrateUserData';
// Note: Phase 0-C themeStore is NOT re-exported here to keep it out of the
// main-bundle re-export surface until Phase 2 when it is wired into the app.
// Import directly: `import { useThemeStore } from '@/stores/themeStore';`
