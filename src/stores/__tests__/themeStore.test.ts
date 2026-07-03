/**
 * themeStore — Phase 0-C tests
 *
 * Covers: preference → appliedTheme resolution, auto-mode OS fallback,
 * data-theme DOM side effect, persistence key, onRehydrate hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { DEFAULT_THEME_CUSTOMIZATION } from '../themeCustomization';

// Reset module state between tests because Zustand stores are module-level.
async function loadStore(prefersDark = false) {
  vi.resetModules();
  const mql = {
    matches: prefersDark,
    addEventListener: vi.fn(),
    removeEventListener: vi.fn(),
  };
  Object.defineProperty(window, 'matchMedia', {
    value: vi.fn(() => mql),
    configurable: true,
    writable: true,
  });
  const mod = await import('../themeStore');
  return { mod, mql };
}

describe('themeStore', () => {
  beforeEach(() => {
    // Clear data-theme and localStorage
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  afterEach(() => {
    delete document.documentElement.dataset.theme;
    localStorage.clear();
  });

  it('defaults to auto preference with paper applied on light OS', async () => {
    const { mod } = await loadStore(false);
    const state = mod.useThemeStore.getState();
    expect(state.theme).toBe('auto');
    expect(state.appliedTheme).toBe('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');
  });

  it('auto preference resolves to ink on dark-preferring OS', async () => {
    const { mod } = await loadStore(true);
    const state = mod.useThemeStore.getState();
    expect(state.appliedTheme).toBe('ink');
    expect(document.documentElement.dataset.theme).toBe('ink');
  });

  it('applies the persisted preference before the first explicit toggle', async () => {
    localStorage.setItem(
      'zenflow:theme-v0c',
      JSON.stringify({ state: { theme: 'ink' }, version: 0 }),
    );
    const { mod } = await loadStore(false);
    const state = mod.useThemeStore.getState();
    expect(state.theme).toBe('ink');
    expect(state.appliedTheme).toBe('ink');
    expect(document.documentElement.dataset.theme).toBe('ink');
  });

  it('setTheme writes data-theme attribute on <html>', async () => {
    const { mod } = await loadStore(false);
    mod.useThemeStore.getState().setTheme('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');
    mod.useThemeStore.getState().setTheme('oled');
    expect(document.documentElement.dataset.theme).toBe('oled');
  });

  it('setTheme updates both theme and appliedTheme', async () => {
    const { mod } = await loadStore(false);
    mod.useThemeStore.getState().setTheme('ink');
    const s = mod.useThemeStore.getState();
    expect(s.theme).toBe('ink');
    expect(s.appliedTheme).toBe('ink');
  });

  it('setTheme("auto") re-resolves against current OS preference', async () => {
    const { mod } = await loadStore(true);
    mod.useThemeStore.getState().setTheme('paper');
    expect(mod.useThemeStore.getState().appliedTheme).toBe('paper');
    mod.useThemeStore.getState().setTheme('auto');
    expect(mod.useThemeStore.getState().appliedTheme).toBe('ink');
  });


  it('normalizes corrupted persisted theme preference on hydrate', async () => {
    localStorage.setItem(
      'zenflow:theme-v0c',
      JSON.stringify({
        state: {
          theme: 'laser-party',
          themeCustomization: {
            paletteId: 'morningHearth',
            accentFamily: 'clay',
            intensity: 'balanced',
          },
        },
        version: 0,
      }),
    );

    const { mod } = await loadStore(false);
    const state = mod.useThemeStore.getState();

    expect(state.theme).toBe('auto');
    expect(state.appliedTheme).toBe('paper');
    expect(document.documentElement.dataset.theme).toBe('paper');
  });

  it('normalizes corrupted persisted theme customization on hydrate', async () => {
    localStorage.setItem(
      'zenflow:theme-v0c',
      JSON.stringify({
        state: {
          theme: 'paper',
          themeCustomization: {
            paletteId: 'raw-neon',
            accentFamily: 'unsafe-css',
            intensity: 99,
          },
        },
        version: 0,
      }),
    );

    const { mod } = await loadStore(false);

    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(document.documentElement.dataset.themeStyle).toBe('zenflow');
  });

  it('previews, applies, resets, and undoes safe theme customization', async () => {
    const { mod } = await loadStore(false);
    const nextCustomization = {
      ...DEFAULT_THEME_CUSTOMIZATION,
      paletteId: 'morningHearth' as const,
      accentFamily: 'clay' as const,
      intensity: 'vivid' as const,
      warmth: 'warm' as const,
      depth: 'cozy' as const,
    };

    mod.useThemeStore.getState().previewThemeCustomization(nextCustomization);

    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(document.documentElement.dataset.themeStyle).toBe('morningHearth');

    mod.useThemeStore.getState().setThemeCustomization(nextCustomization);

    expect(mod.useThemeStore.getState().themeCustomization).toEqual(nextCustomization);
    expect(document.documentElement.dataset.themeStyle).toBe('morningHearth');

    mod.useThemeStore.getState().resetThemeCustomization();

    expect(mod.useThemeStore.getState().themeCustomization).toEqual(DEFAULT_THEME_CUSTOMIZATION);
    expect(document.documentElement.dataset.themeStyle).toBe('zenflow');

    mod.useThemeStore.getState().undoThemeCustomization();

    expect(mod.useThemeStore.getState().themeCustomization).toEqual(nextCustomization);
    expect(document.documentElement.dataset.themeStyle).toBe('morningHearth');

    mod.useThemeStore.getState().cancelThemeCustomizationPreview();
    expect(document.documentElement.dataset.themeStyle).toBe('morningHearth');
  });

  it('bindPrefersColorSchemeListener returns an unsubscribe', async () => {
    const { mod, mql } = await loadStore(false);
    const off = mod.bindPrefersColorSchemeListener();
    expect(mql.addEventListener).toHaveBeenCalledWith('change', expect.any(Function));
    off();
    expect(mql.removeEventListener).toHaveBeenCalled();
  });

  it('bindPrefersColorSchemeListener is no-op in non-window env', async () => {
    // Can't fully remove window in jsdom, but the function must not throw.
    const { mod } = await loadStore(false);
    const off = mod.bindPrefersColorSchemeListener();
    expect(typeof off).toBe('function');
    off();
  });
});
