/**
 * Theme Store — Phase 0-C (Paper Theme Core)
 *
 * Zustand store for the new paper/ink/oled theme family, opt-in via the
 * `data-theme` attribute on <html>. This store is ORTHOGONAL to the existing
 * src/components/ThemeToggle.tsx useTheme() hook which continues to drive the
 * legacy `.dark` classList family for unmigrated components (Phase 2 will
 * deprecate that path).
 *
 * Design decisions:
 *  - Four values: 'paper' | 'ink' | 'oled' | 'auto'
 *  - 'auto' resolves to 'ink' on prefers-color-scheme: dark, else 'paper'
 *  - Default is 'auto' until Phase 2 default-flip — safe reversible preview
 *  - Persist via Zustand persist middleware (localStorage key 'zenflow:theme-v0c')
 *  - Side effect: on theme change, write document.documentElement.dataset.theme
 *  - Listens to OS prefers-color-scheme only when theme === 'auto'
 *
 * Cross-platform safety (Law 10):
 *  - Guarded with typeof window !== 'undefined' for SSR/test envs
 *  - document.documentElement.dataset is standard DOM, works in jsdom
 *
 * State Integrity (Law 14):
 *  - Single source of truth — no duplicate theme keys elsewhere
 *  - appliedTheme always derived, never written directly
 *
 * Usage:
 *   import { useThemeStore } from '@/stores/themeStore';
 *   const theme = useThemeStore((s) => s.theme);
 *   const setTheme = useThemeStore((s) => s.setTheme);
 *
 * Not yet wired to main app — Phase 2 will surface in Settings Panel + flip
 * default to 'paper'.
 */

import { create } from 'zustand';
import { persist, createJSONStorage } from 'zustand/middleware';
import {
  safeJsonParse,
  storageGetRaw,
  storageSetRaw,
  storageRemove,
} from '@/lib/safeJson';
import {
  DEFAULT_THEME_CUSTOMIZATION,
  applyThemeCustomizationToDOM,
  normalizeThemeCustomization,
  type ThemeCustomization,
} from './themeCustomization';

export type ThemePreference = 'paper' | 'ink' | 'oled' | 'auto';
export type AppliedTheme = 'paper' | 'ink' | 'oled';

export interface ThemeStore {
  /** User-selected preference — may be 'auto' */
  theme: ThemePreference;
  /** Resolved value that is actually active on the DOM — never 'auto' */
  appliedTheme: AppliedTheme;
  /** Safe local visual customization layered on the resolved theme. */
  themeCustomization: ThemeCustomization;
  /** Previous committed customization, used for one-step undo. */
  previousThemeCustomization: ThemeCustomization | null;
  /** Set the user preference (and immediately apply to DOM). */
  setTheme: (theme: ThemePreference) => void;
  /** Apply and persist a validated customization. */
  setThemeCustomization: (customization: ThemeCustomization) => void;
  /** Preview a validated customization without persisting it. */
  previewThemeCustomization: (customization: ThemeCustomization) => void;
  /** Return DOM preview to the currently persisted customization. */
  cancelThemeCustomizationPreview: () => void;
  /** Reset customization to the ZenFlow default. */
  resetThemeCustomization: () => void;
  /** Restore the previous committed customization when available. */
  undoThemeCustomization: () => void;
  /** Internal — re-evaluate applied theme from current preference + OS state. */
  _resolve: () => void;
}

const STORAGE_KEY = 'zenflow:theme-v0c';

interface PersistedThemePayload {
  state?: {
    theme?: ThemePreference;
    themeCustomization?: unknown;
  };
}

function isThemePreference(value: unknown): value is ThemePreference {
  return value === 'paper' || value === 'ink' || value === 'oled' || value === 'auto';
}

function readPersistedThemePayload(): PersistedThemePayload | null {
  if (typeof window === 'undefined') return null;
  return safeJsonParse<PersistedThemePayload | null>(storageGetRaw(STORAGE_KEY, ''), null);
}

function readInitialThemePreference(payload: PersistedThemePayload | null): ThemePreference {
  const theme = payload?.state?.theme;
  return isThemePreference(theme) ? theme : 'auto';
}

function readInitialThemeCustomization(
  payload: PersistedThemePayload | null,
): ThemeCustomization {
  return normalizeThemeCustomization(payload?.state?.themeCustomization);
}

/** Pure: resolve user preference to an applied theme, consulting the OS
 *  prefers-color-scheme media query for 'auto'. Guarded for environments
 *  without window.matchMedia (Node, partial jsdom mocks) — falls back to
 *  'paper' to avoid init-time crashes. */
function resolvePreference(pref: ThemePreference): AppliedTheme {
  if (pref === 'paper' || pref === 'ink' || pref === 'oled') return pref;
  // 'auto'
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') {
    return 'paper';
  }
  const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
  return prefersDark ? 'ink' : 'paper';
}

/** Side effect: write `data-theme` attribute on the <html> element. Safe to
 *  call in tests — no-op when `document` unavailable. */
function applyToDOM(applied: AppliedTheme, customization: ThemeCustomization): void {
  if (typeof document === 'undefined') return;
  document.documentElement.dataset.theme = applied;
  applyThemeCustomizationToDOM(applied, customization);
}

const initialPayload = readPersistedThemePayload();
const initialTheme = readInitialThemePreference(initialPayload);
const initialCustomization = readInitialThemeCustomization(initialPayload);
const initialAppliedTheme = resolvePreference(initialTheme);
applyToDOM(initialAppliedTheme, initialCustomization);

export const useThemeStore = create<ThemeStore>()(
  persist(
    (set, get) => ({
      theme: initialTheme,
      appliedTheme: initialAppliedTheme,
      themeCustomization: initialCustomization,
      previousThemeCustomization: null,
      setTheme: (theme) => {
        const applied = resolvePreference(theme);
        applyToDOM(applied, get().themeCustomization);
        set({ theme, appliedTheme: applied });
      },
      setThemeCustomization: (customization) => {
        const nextCustomization = normalizeThemeCustomization(customization);
        const previousThemeCustomization = get().themeCustomization;
        applyToDOM(get().appliedTheme, nextCustomization);
        set({ themeCustomization: nextCustomization, previousThemeCustomization });
      },
      previewThemeCustomization: (customization) => {
        applyThemeCustomizationToDOM(
          get().appliedTheme,
          normalizeThemeCustomization(customization),
        );
      },
      cancelThemeCustomizationPreview: () => {
        applyThemeCustomizationToDOM(get().appliedTheme, get().themeCustomization);
      },
      resetThemeCustomization: () => {
        const previousThemeCustomization = get().themeCustomization;
        const themeCustomization = { ...DEFAULT_THEME_CUSTOMIZATION };
        applyToDOM(get().appliedTheme, themeCustomization);
        set({ themeCustomization, previousThemeCustomization });
      },
      undoThemeCustomization: () => {
        const previous = get().previousThemeCustomization;
        if (!previous) return;
        const current = get().themeCustomization;
        applyToDOM(get().appliedTheme, previous);
        set({ themeCustomization: previous, previousThemeCustomization: current });
      },
      _resolve: () => {
        const applied = resolvePreference(get().theme);
        applyToDOM(applied, get().themeCustomization);
        if (applied !== get().appliedTheme) {
          set({ appliedTheme: applied });
        }
      },
    }),
    {
      name: STORAGE_KEY,
      // Route through safe storage accessors (no direct localStorage per
      // project rules — see .claude/rules/* and no-restricted-globals lint).
      storage: createJSONStorage(() => ({
        getItem: (key) => storageGetRaw(key, ''),
        setItem: (key, value) => storageSetRaw(key, value),
        removeItem: (key) => storageRemove(key),
      })),
      // Persist the user preference and local-only customization; appliedTheme re-derives.
      partialize: (state) => ({
        theme: state.theme,
        themeCustomization: state.themeCustomization,
      }),
      onRehydrateStorage: () => (state) => {
        if (!state) return;
        const theme = isThemePreference(state.theme) ? state.theme : 'auto';
        const applied = resolvePreference(theme);
        const themeCustomization = normalizeThemeCustomization(state.themeCustomization);
        applyToDOM(applied, themeCustomization);
        state.theme = theme;
        state.appliedTheme = applied;
        state.themeCustomization = themeCustomization;
        state.previousThemeCustomization = null;
      },
    },
  ),
);

/** Bind the OS prefers-color-scheme listener. Returns an unsubscribe. Idempotent
 *  — call once from app bootstrap (e.g. main.tsx) to pick up live OS changes
 *  when theme === 'auto'. */
export function bindPrefersColorSchemeListener(): () => void {
  if (typeof window === 'undefined' || typeof window.matchMedia !== 'function') return () => {};
  const mql = window.matchMedia('(prefers-color-scheme: dark)');
  const handler = () => {
    if (useThemeStore.getState().theme === 'auto') {
      useThemeStore.getState()._resolve();
    }
  };
  if (typeof mql.addEventListener === 'function') {
    mql.addEventListener('change', handler);
    return () => mql.removeEventListener('change', handler);
  }
  if (typeof mql.addListener === 'function') {
    mql.addListener(handler);
    return () => mql.removeListener(handler);
  }
  return () => {};
}
