import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsStore = new Map<string, { key: string; value: unknown }>();
const journalStorageMocks = vi.hoisted(() => ({
  decryptEncryptedJournalEntries: vi.fn(() => Promise.resolve(0)),
  decryptEncryptedJournalMedia: vi.fn(() => Promise.resolve(0)),
  encryptPlaintextJournalEntries: vi.fn(() => Promise.resolve(0)),
  encryptPlaintextJournalMedia: vi.fn(() => Promise.resolve(0)),
  hasEncryptedJournalContent: vi.fn(() => Promise.resolve(false)),
  hasEncryptedJournalMedia: vi.fn(() => Promise.resolve(false)),
}));
const migrationMocks = vi.hoisted(() => ({
  activate: vi.fn(),
  captureBoundary: vi.fn(() =>
    Promise.resolve({ generation: 1, sessionOwnerUserId: "account-a", localOwnerUserId: "account-a" })
  ),
  assertBoundary: vi.fn(() => Promise.resolve()),
  runBoundary: vi.fn(<T,>(_: unknown, operation: () => Promise<T>) => operation()),
  ensureQueued: vi.fn(() => Promise.resolve(false)),
  ensureRemovalQueued: vi.fn(() => Promise.resolve(false)),
  getIntent: vi.fn(() => Promise.resolve(null)),
  getRemovalIntent: vi.fn(() => Promise.resolve(null)),
  removeAtomic: vi.fn(() => Promise.resolve({ cloudMigrationPending: false })),
  recordNativeCleanup: vi.fn(() => Promise.resolve()),
}));
const vaultCryptoMocks = vi.hoisted(() => ({
  generateJournalVaultKey: vi.fn(() => "vault-key-test"),
  wrapJournalVaultKey: vi.fn((vaultKey: string, password: string) =>
    Promise.resolve(`wrapped:${password}:${vaultKey}`),
  ),
  unwrapJournalVaultKey: vi.fn((wrappedKey: string, password: string) => {
    const prefix = `wrapped:${password}:`;
    if (!wrappedKey.startsWith(prefix)) return Promise.reject(new Error("Failed to unwrap journal vault key"));
    return Promise.resolve(wrappedKey.slice(prefix.length));
  }),
  rewrapJournalVaultKey: vi.fn(async (wrappedKey: string, oldPassword: string, newPassword: string) => {
    const prefix = `wrapped:${oldPassword}:`;
    if (!wrappedKey.startsWith(prefix)) throw new Error("Failed to unwrap journal vault key");
    return `wrapped:${newPassword}:${wrappedKey.slice(prefix.length)}`;
  }),
}));
const nativeListeners = vi.hoisted(() => new Map<string, (payload?: { isActive?: boolean }) => void>());

vi.mock("@/lib/platform", () => ({
  isNative: true,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn((event: string, callback: (payload?: { isActive?: boolean }) => void) => {
      nativeListeners.set(event, callback);
      return Promise.resolve({ remove: vi.fn() });
    }),
  },
}));

vi.mock("@/plugins/BiometricPlugin", () => ({
  default: {
    isAvailable: vi.fn(() => Promise.resolve({ available: false })),
    unenroll: vi.fn(() => Promise.resolve({ success: true })),
  },
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/storage/db", () => ({
  db: {
    settings: {
      get: vi.fn((key: string) => Promise.resolve(settingsStore.get(key))),
      put: vi.fn((entry: { key: string; value: unknown }) => {
        settingsStore.set(entry.key, entry);
        return Promise.resolve(entry.key);
      }),
      delete: vi.fn((key: string) => {
        settingsStore.delete(key);
        return Promise.resolve();
      }),
    },
  },
}));

vi.mock("../journalVaultCrypto", () => vaultCryptoMocks);
vi.mock("../journalStorage", () => journalStorageMocks);
vi.mock("../journalDraftStorage", () => ({
  decryptEncryptedJournalDrafts: vi.fn(() => Promise.resolve(0)),
  encryptPlaintextJournalDrafts: vi.fn(() => Promise.resolve(0)),
  hasEncryptedJournalDrafts: vi.fn(() => Promise.resolve(false)),
}));
vi.mock("../journalHubStorage", () => ({
  decryptEncryptedJournalHubContent: vi.fn(() => Promise.resolve(0)),
  encryptPlaintextJournalHubContent: vi.fn(() => Promise.resolve(0)),
  hasEncryptedJournalHubContent: vi.fn(() => Promise.resolve(false)),
}));
vi.mock("../journalSecurityMigration", () => ({
  activateJournalPasswordProtection: migrationMocks.activate,
  assertJournalSecurityBoundary: migrationMocks.assertBoundary,
  captureJournalSecurityBoundary: migrationMocks.captureBoundary,
  ensureJournalSecurityMigrationQueued: migrationMocks.ensureQueued,
  ensureJournalSecurityRemovalQueued: migrationMocks.ensureRemovalQueued,
  getJournalSecurityMigrationIntent: migrationMocks.getIntent,
  getJournalSecurityRemovalIntent: migrationMocks.getRemovalIntent,
  normalizeJournalDataForActiveVault: vi.fn(() =>
    Promise.resolve({
      changedCount: 0,
      unboundMediaCount: 0,
      cloudMigrationPending: false,
    }),
  ),
  removeJournalPasswordProtectionAtomically: migrationMocks.removeAtomic,
  recordJournalSecurityRemovalNativeCleanup: migrationMocks.recordNativeCleanup,
  runWithJournalSecurityBoundary: migrationMocks.runBoundary,
  JOURNAL_SECURITY_MIGRATION_EVENT: "zenflow:journal-security-migration-updated",
}));

import { setAutoLockMs, useJournalSecurity } from "../useJournalSecurity";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity native pause lock", () => {
  beforeEach(() => {
    localStorage.clear();
    nativeListeners.clear();
    settingsStore.clear();
    vi.clearAllMocks();
    migrationMocks.getIntent.mockResolvedValue(null);
    migrationMocks.ensureQueued.mockResolvedValue(false);
    migrationMocks.activate.mockImplementation(async ({ passwordData, vaultSetting }: {
      passwordData: unknown;
      vaultSetting: unknown;
    }) => {
      settingsStore.set("journal_password", { key: "journal_password", value: passwordData });
      settingsStore.set("journal_vault_key", { key: "journal_vault_key", value: vaultSetting });
      return { cloudMigrationPending: false };
    });
    vi.spyOn(Date, "now").mockReturnValue(1_781_580_000_000);

    Object.defineProperty(globalThis, "crypto", {
      configurable: true,
      value: {
        getRandomValues: vi.fn((buffer: Uint8Array) => {
          buffer.fill(7);
          return buffer;
        }),
        subtle: {
          importKey: vi.fn((_format, keyData: ArrayBuffer) =>
            Promise.resolve({ password: bytesToString(new Uint8Array(keyData)) }),
          ),
          deriveBits: vi.fn(
            (algorithm: { salt: ArrayBuffer; iterations: number }, key: { password: string }) => {
              const salt = bytesToString(new Uint8Array(algorithm.salt));
              const encoded = new TextEncoder().encode(`${key.password}:${salt}:${algorithm.iterations}`);
              return Promise.resolve(encoded.buffer);
            },
          ),
        },
      },
    });
  });

  afterEach(() => {
    vi.restoreAllMocks();
  });

  it("locks an unlocked diary when iOS sends native pause or inactive appStateChange", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    expect(hook.result.current.isUnlocked).toBe(true);
    await waitFor(() => expect(nativeListeners.get("pause")).toBeTypeOf("function"));

    await act(async () => {
      nativeListeners.get("pause")?.();
    });

    expect(hook.result.current.isUnlocked).toBe(false);

    await act(async () => {
      await hook.result.current.unlock("correct horse battery staple");
    });
    expect(hook.result.current.isUnlocked).toBe(true);
    await waitFor(() => expect(nativeListeners.get("appStateChange")).toBeTypeOf("function"));

    await act(async () => {
      nativeListeners.get("appStateChange")?.({ isActive: false });
    });

    expect(hook.result.current.isUnlocked).toBe(false);
  });

  it("replaces the active auto-lock timer after a durable timeout change", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    expect(hook.result.current.isUnlocked).toBe(true);
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 300_000)).toBe(true);

    await act(async () => {
      expect(setAutoLockMs(1_800_000)).toBe(true);
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 1_800_000)).toBe(true);
  });

  it("adopts a validated auto-lock timeout from another tab", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    localStorage.setItem("zenflow-journal-lock-timeout", JSON.stringify(60_000));
    act(() => {
      window.dispatchEvent(
        new StorageEvent("storage", {
          key: "zenflow-journal-lock-timeout",
          newValue: JSON.stringify(60_000),
        }),
      );
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 60_000)).toBe(true);
  });

  it.each(["zenflow-journal-lock-timeout", null])(
    "returns to the five-minute default when another tab clears %s",
    async (key) => {
      localStorage.setItem("zenflow-journal-lock-timeout", JSON.stringify(1_800_000));
      const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
      const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
      const hook = renderHook(() => useJournalSecurity());

      await waitFor(() => expect(hook.result.current.loading).toBe(false));
      await act(async () => {
        await hook.result.current.setPassword("correct horse battery staple");
      });
      localStorage.removeItem("zenflow-journal-lock-timeout");

      act(() => {
        window.dispatchEvent(new StorageEvent("storage", { key, newValue: null }));
      });

      expect(clearTimeoutSpy).toHaveBeenCalled();
      expect(setTimeoutSpy.mock.calls.some(([, delay]) => delay === 300_000)).toBe(true);
    },
  );

  it("resets the active auto-lock timer after meaningful user activity", async () => {
    const setTimeoutSpy = vi.spyOn(globalThis, "setTimeout");
    const clearTimeoutSpy = vi.spyOn(globalThis, "clearTimeout");
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    const scheduledBeforeActivity = setTimeoutSpy.mock.calls.filter(
      ([, delay]) => delay === 300_000,
    ).length;

    act(() => {
      document.dispatchEvent(new Event("pointerdown"));
    });

    expect(clearTimeoutSpy).toHaveBeenCalled();
    expect(
      setTimeoutSpy.mock.calls.filter(([, delay]) => delay === 300_000).length,
    ).toBeGreaterThan(scheduledBeforeActivity);
  });
});
