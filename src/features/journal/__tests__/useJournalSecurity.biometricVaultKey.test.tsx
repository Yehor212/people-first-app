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
type BiometricAuthMockResult = { success: boolean; error?: string; secret?: string };
const biometricTestValues = vi.hoisted(() => ({
  vaultKey: ["vault", "key", "1"].join("-"),
}));
const biometricMocks = vi.hoisted(() => ({
  isAvailable: vi.fn(() => Promise.resolve({ available: true, type: "face" })),
  enroll: vi.fn((): Promise<BiometricAuthMockResult> => Promise.resolve({ success: true })),
  unenroll: vi.fn((): Promise<BiometricAuthMockResult> => Promise.resolve({ success: true })),
  authenticate: vi.fn((): Promise<BiometricAuthMockResult> =>
    Promise.resolve({ success: true, secret: biometricTestValues.vaultKey }),
  ),
}));
const syncMocks = vi.hoisted(() => ({
  isCloudSyncEnabled: vi.fn(() => true),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSettingFromCloud: vi.fn(() => Promise.resolve()),
}));
const vaultCryptoMocks = vi.hoisted(() => ({
  generateJournalVaultKey: vi.fn(() => biometricTestValues.vaultKey),
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

vi.mock("@/lib/platform", () => ({
  isNative: true,
}));

vi.mock("@capacitor/app", () => ({
  App: {
    addListener: vi.fn(() => Promise.resolve({ remove: vi.fn() })),
  },
}));

vi.mock("@/plugins/BiometricPlugin", () => ({
  default: biometricMocks,
}));

vi.mock("@/lib/logger", () => ({
  logger: {
    log: vi.fn(),
    warn: vi.fn(),
  },
}));

vi.mock("@/lib/cloudSyncSettings", () => ({
  isCloudSyncEnabled: syncMocks.isCloudSyncEnabled,
}));

vi.mock("@/storage/sync/syncSettings", () => ({
  syncSetting: syncMocks.syncSetting,
  deleteSettingFromCloud: syncMocks.deleteSettingFromCloud,
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

import { useJournalSecurity } from "../useJournalSecurity";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity iOS biometric vault key lifecycle", () => {
  beforeEach(() => {
    settingsStore.clear();
    vi.clearAllMocks();
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

  it("stores the session vault key in native biometric enrollment and restores it on biometric unlock", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    expect(hook.result.current.vaultKey).toBe(biometricTestValues.vaultKey);

    await act(async () => {
      await hook.result.current.setBiometricEnabled(true);
    });

    expect(biometricMocks.enroll).toHaveBeenCalledWith({
      reason: "Enable biometric diary unlock",
      secret: biometricTestValues.vaultKey,
    });
    expect(hook.result.current.biometricEnabled).toBe(true);

    await act(async () => {
      hook.result.current.lock();
    });
    expect(hook.result.current.isUnlocked).toBe(false);
    expect(hook.result.current.vaultKey).toBeNull();

    await act(async () => {
      await expect(hook.result.current.unlockWithBiometric()).resolves.toBe(true);
    });

    expect(biometricMocks.authenticate).toHaveBeenCalledWith({ reason: "Unlock your journal" });
    expect(hook.result.current.isUnlocked).toBe(true);
    expect(hook.result.current.vaultKey).toBe(biometricTestValues.vaultKey);
  });

  it("does not unlock when native biometric succeeds without returning a vault key", async () => {
    biometricMocks.authenticate.mockResolvedValueOnce({ success: true });
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await hook.result.current.setBiometricEnabled(true);
    });
    await act(async () => {
      hook.result.current.lock();
    });

    await act(async () => {
      await expect(hook.result.current.unlockWithBiometric()).resolves.toBe(false);
    });

    expect(hook.result.current.isUnlocked).toBe(false);
    expect(hook.result.current.vaultKey).toBeNull();
  });

  it("reports biometric enrollment failure without enabling biometric unlock", async () => {
    biometricMocks.enroll.mockResolvedValueOnce({ success: false });
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(true)).resolves.toBe(false);
    });

    expect(hook.result.current.biometricEnabled).toBe(false);
    expect(settingsStore.get("journal_biometric")?.value).toBe(false);
  });

  it("does not mark biometric unlock disabled when native unenroll reports failure", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(true)).resolves.toBe(true);
    });
    biometricMocks.unenroll.mockResolvedValueOnce({
      success: false,
      error: "Keychain item could not be deleted",
    });

    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(false)).resolves.toBe(false);
    });

    expect(hook.result.current.biometricEnabled).toBe(true);
    expect(settingsStore.get("journal_biometric")?.value).toBe(true);
  });

  it("does not leave biometric unlock marked enabled after native cleanup succeeds but password removal fails", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(true)).resolves.toBe(true);
    });

    syncMocks.deleteSettingFromCloud.mockRejectedValueOnce(new Error("cloud delete failed"));

    await act(async () => {
      await expect(hook.result.current.removePassword()).rejects.toThrow("cloud delete failed");
    });

    expect(biometricMocks.unenroll).toHaveBeenCalledTimes(1);
    expect(journalStorageMocks.decryptEncryptedJournalEntries).not.toHaveBeenCalled();
    expect(journalStorageMocks.decryptEncryptedJournalMedia).not.toHaveBeenCalled();
    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
    expect(hook.result.current.hasPassword).toBe(true);
    expect(hook.result.current.biometricEnabled).toBe(false);
    expect(settingsStore.get("journal_biometric")?.value).toBe(false);
  });

  it("does not remove native biometric credentials when locked encrypted content blocks password removal", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(true)).resolves.toBe(true);
    });
    await act(async () => {
      hook.result.current.lock();
    });

    vi.clearAllMocks();
    journalStorageMocks.hasEncryptedJournalContent.mockResolvedValueOnce(true);

    await act(async () => {
      await expect(hook.result.current.removePassword()).rejects.toThrow(
        "Unlock your diary before removing password protection.",
      );
    });

    expect(biometricMocks.unenroll).not.toHaveBeenCalled();
    expect(journalStorageMocks.decryptEncryptedJournalEntries).not.toHaveBeenCalled();
    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
    expect(hook.result.current.hasPassword).toBe(true);
    expect(hook.result.current.biometricEnabled).toBe(true);
  });
});
