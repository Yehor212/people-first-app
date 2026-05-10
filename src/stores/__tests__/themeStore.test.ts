/**
 * themeStore — Phase 0-C tests
 *
 * Covers: preference → appliedTheme resolution, auto-mode OS fallback,
 * data-theme DOM side effect, persistence key, onRehydrate hook.
 */

import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';

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
