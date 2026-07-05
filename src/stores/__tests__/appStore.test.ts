import { describe, it, expect, beforeEach } from 'vitest';
import { useAppStore } from '@/stores/appStore';
import type { TabType, InitializationState } from '@/stores/appStore';

const initialState = useAppStore.getState();

beforeEach(() => {
  useAppStore.setState(initialState, true);
});

// ─── Initial State ───────────────────────────────────────────

describe('appStore initial state', () => {
  it('activeTab defaults to "home"', () => {
    expect(useAppStore.getState().activeTab).toBe('home');
  });

  it('settingsOpenSection defaults to undefined', () => {
    expect(useAppStore.getState().settingsOpenSection).toBeUndefined();
  });

  it('initializationState defaults to isInitializing=true, error=null, wasUpdated=false', () => {
    expect(useAppStore.getState().initializationState).toEqual({
      isInitializing: true,
      error: null,
      wasUpdated: false,
    });
  });

  it('loadingFadeOut defaults to false', () => {
    expect(useAppStore.getState().loadingFadeOut).toBe(false);
  });

  it('currentDate defaults to empty string', () => {
    expect(useAppStore.getState().currentDate).toBe('');
  });

  it('authBypassFlag defaults to false', () => {
    expect(useAppStore.getState().authBypassFlag).toBe(false);
  });

  it('isProcessingWebOAuth defaults to false', () => {
    expect(useAppStore.getState().isProcessingWebOAuth).toBe(false);
  });

  it('webOAuthError defaults to null', () => {
    expect(useAppStore.getState().webOAuthError).toBeNull();
  });

  it('hasValidSession defaults to null', () => {
    expect(useAppStore.getState().hasValidSession).toBeNull();
  });
});

// ─── setActiveTab ────────────────────────────────────────────

describe('setActiveTab', () => {
  const allTabs: TabType[] = ['home', 'garden', 'stats', 'achievements', 'settings', 'mindmap'];

  it.each(allTabs)('sets activeTab to "%s"', (tab) => {
    useAppStore.getState().setActiveTab(tab);
    expect(useAppStore.getState().activeTab).toBe(tab);
  });

  it('clears settingsOpenSection when switching away from settings', () => {
    // First go to settings and open a section
    useAppStore.getState().setActiveTab('settings');
    useAppStore.getState().setSettingsOpenSection('account');
    expect(useAppStore.getState().settingsOpenSection).toBe('account');

    // Switch to home — should clear
    useAppStore.getState().setActiveTab('home');
    expect(useAppStore.getState().settingsOpenSection).toBeUndefined();
  });

  it('preserves settingsOpenSection when staying on settings', () => {
    useAppStore.getState().setActiveTab('settings');
    useAppStore.getState().setSettingsOpenSection('account');
    expect(useAppStore.getState().settingsOpenSection).toBe('account');

    // Set tab to settings again — should preserve
    useAppStore.getState().setActiveTab('settings');
    expect(useAppStore.getState().settingsOpenSection).toBe('account');
  });

  it('clears settingsOpenSection when switching from settings to garden', () => {
    useAppStore.getState().setActiveTab('settings');
    useAppStore.getState().setSettingsOpenSection('notifications');

    useAppStore.getState().setActiveTab('garden');
    expect(useAppStore.getState().settingsOpenSection).toBeUndefined();
  });

  it('clears settingsOpenSection when switching from settings to mindmap', () => {
    useAppStore.getState().setActiveTab('settings');
    useAppStore.getState().setSettingsOpenSection('data');

    useAppStore.getState().setActiveTab('mindmap');
    expect(useAppStore.getState().settingsOpenSection).toBeUndefined();
  });
});

// ─── setSettingsOpenSection ──────────────────────────────────

describe('setSettingsOpenSection', () => {
  it('sets a section string', () => {
    useAppStore.getState().setSettingsOpenSection('data');
    expect(useAppStore.getState().settingsOpenSection).toBe('data');
  });

  it('clears section to undefined', () => {
    useAppStore.getState().setSettingsOpenSection('data');
    useAppStore.getState().setSettingsOpenSection(undefined);
    expect(useAppStore.getState().settingsOpenSection).toBeUndefined();
  });
});

// ─── setInitializationState ──────────────────────────────────

describe('setInitializationState', () => {
  it('sets the full initialization state object', () => {
    const newState: InitializationState = {
      isInitializing: false,
      error: 'Something went wrong',
      wasUpdated: true,
    };
    useAppStore.getState().setInitializationState(newState);
    expect(useAppStore.getState().initializationState).toEqual(newState);
  });

  it('can reset initialization to defaults', () => {
    useAppStore.getState().setInitializationState({
      isInitializing: false,
      error: null,
      wasUpdated: false,
    });
    expect(useAppStore.getState().initializationState.isInitializing).toBe(false);
  });
});

// ─── setLoadingFadeOut ───────────────────────────────────────

describe('setLoadingFadeOut', () => {
  it('sets to true', () => {
    useAppStore.getState().setLoadingFadeOut(true);
    expect(useAppStore.getState().loadingFadeOut).toBe(true);
  });

  it('sets back to false', () => {
    useAppStore.getState().setLoadingFadeOut(true);
    useAppStore.getState().setLoadingFadeOut(false);
    expect(useAppStore.getState().loadingFadeOut).toBe(false);
  });
});

// ─── setCurrentDate ──────────────────────────────────────────

describe('setCurrentDate', () => {
  it('sets a date string', () => {
    useAppStore.getState().setCurrentDate('2026-02-17');
    expect(useAppStore.getState().currentDate).toBe('2026-02-17');
  });
});

// ─── Auth setters ────────────────────────────────────────────

describe('setAuthBypassFlag', () => {
  it('sets to true', () => {
    useAppStore.getState().setAuthBypassFlag(true);
    expect(useAppStore.getState().authBypassFlag).toBe(true);
  });

  it('sets to false', () => {
    useAppStore.getState().setAuthBypassFlag(true);
    useAppStore.getState().setAuthBypassFlag(false);
    expect(useAppStore.getState().authBypassFlag).toBe(false);
  });
});

describe('setIsProcessingWebOAuth', () => {
  it('sets to true', () => {
    useAppStore.getState().setIsProcessingWebOAuth(true);
    expect(useAppStore.getState().isProcessingWebOAuth).toBe(true);
  });

  it('sets to false', () => {
    useAppStore.getState().setIsProcessingWebOAuth(true);
    useAppStore.getState().setIsProcessingWebOAuth(false);
    expect(useAppStore.getState().isProcessingWebOAuth).toBe(false);
  });
});

describe('setWebOAuthError', () => {
  it('sets an error string', () => {
    useAppStore.getState().setWebOAuthError('OAuth failed');
    expect(useAppStore.getState().webOAuthError).toBe('OAuth failed');
  });

  it('clears error to null', () => {
    useAppStore.getState().setWebOAuthError('OAuth failed');
    useAppStore.getState().setWebOAuthError(null);
    expect(useAppStore.getState().webOAuthError).toBeNull();
  });
});

describe('setHasValidSession', () => {
  it('sets to true', () => {
    useAppStore.getState().setHasValidSession(true);
    expect(useAppStore.getState().hasValidSession).toBe(true);
  });

  it('sets to false', () => {
    useAppStore.getState().setHasValidSession(false);
    expect(useAppStore.getState().hasValidSession).toBe(false);
  });

  it('sets to null (checking state)', () => {
    useAppStore.getState().setHasValidSession(true);
    useAppStore.getState().setHasValidSession(null);
    expect(useAppStore.getState().hasValidSession).toBeNull();
  });
});

// ─── Gate bypass flags ──────────────────────────────────────

describe('setOnboardingBypassFlag', () => {
  it('defaults to false', () => {
    expect(useAppStore.getState().onboardingBypassFlag).toBe(false);
  });

  it('sets to true', () => {
    useAppStore.getState().setOnboardingBypassFlag(true);
    expect(useAppStore.getState().onboardingBypassFlag).toBe(true);
  });

  it('sets back to false', () => {
    useAppStore.getState().setOnboardingBypassFlag(true);
    useAppStore.getState().setOnboardingBypassFlag(false);
    expect(useAppStore.getState().onboardingBypassFlag).toBe(false);
  });
});

// ─── resetAuthState ──────────────────────────────────────────

describe('resetAuthState', () => {
  it('sets hasValidSession to false and authBypassFlag to false', () => {
    useAppStore.getState().setHasValidSession(true);
    useAppStore.getState().setAuthBypassFlag(true);

    useAppStore.getState().resetAuthState();

    expect(useAppStore.getState().hasValidSession).toBe(false);
    expect(useAppStore.getState().authBypassFlag).toBe(false);
  });

  it('preserves other state fields', () => {
    useAppStore.getState().setActiveTab('garden');
    useAppStore.getState().setCurrentDate('2026-01-01');
    useAppStore.getState().setIsProcessingWebOAuth(true);

    useAppStore.getState().resetAuthState();

    expect(useAppStore.getState().activeTab).toBe('garden');
    expect(useAppStore.getState().currentDate).toBe('2026-01-01');
    expect(useAppStore.getState().isProcessingWebOAuth).toBe(true);
  });

  it('does not affect the onboarding bypass flag', () => {
    useAppStore.getState().setOnboardingBypassFlag(true);

    useAppStore.getState().resetAuthState();

    expect(useAppStore.getState().onboardingBypassFlag).toBe(true);
  });

  it('does not affect webOAuthError', () => {
    useAppStore.getState().setWebOAuthError('some error');

    useAppStore.getState().resetAuthState();

    expect(useAppStore.getState().webOAuthError).toBe('some error');
  });
});
