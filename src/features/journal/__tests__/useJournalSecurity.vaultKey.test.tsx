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
const syncMocks = vi.hoisted(() => ({
  isCloudSyncEnabled: vi.fn(() => true),
  syncSetting: vi.fn(() => Promise.resolve()),
  deleteSettingFromCloud: vi.fn(() => Promise.resolve()),
}));

const vaultCryptoMocks = vi.hoisted(() => ({
  generateJournalVaultKey: vi.fn(() => "vault-key-1"),
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
  isNative: false,
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

describe("useJournalSecurity vault key lifecycle", () => {
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
              const encoded = new TextEncoder().encode(
                `${key.password}:${salt}:${algorithm.iterations}`,
              );
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

  it("creates and keeps a session-only vault key when setting a diary password", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    expect(vaultCryptoMocks.generateJournalVaultKey).toHaveBeenCalledTimes(1);
    expect(vaultCryptoMocks.wrapJournalVaultKey).toHaveBeenCalledWith(
      "vault-key-1",
      "correct horse battery staple",
    );
    expect(settingsStore.get("journal_vault_key")?.value).toEqual({
      wrappedKey: "wrapped:correct horse battery staple:vault-key-1",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    });
    expect(syncMocks.syncSetting).toHaveBeenCalledWith("journal_vault_key", {
      wrappedKey: "wrapped:correct horse battery staple:vault-key-1",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    });
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
    expect(journalStorageMocks.encryptPlaintextJournalEntries).toHaveBeenCalledWith("vault-key-1");
    expect(journalStorageMocks.encryptPlaintextJournalMedia).toHaveBeenCalledWith("vault-key-1");
  });

  it("clears the session vault key on lock and restores it only after password unlock", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      hook.result.current.lock();
    });
    expect(hook.result.current.vaultKey).toBeNull();

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(true);
    });

    expect(vaultCryptoMocks.unwrapJournalVaultKey).toHaveBeenCalledWith(
      "wrapped:correct horse battery staple:vault-key-1",
      "correct horse battery staple",
    );
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
  });

  it("syncs a vault key created during unlock for legacy password-only diaries", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("legacy password");
    });
    settingsStore.delete("journal_vault_key");
    syncMocks.syncSetting.mockClear();

    await act(async () => {
      hook.result.current.lock();
    });
    await act(async () => {
      await expect(hook.result.current.unlock("legacy password")).resolves.toBe(true);
    });

    expect(settingsStore.get("journal_vault_key")?.value).toEqual({
      wrappedKey: "wrapped:legacy password:vault-key-1",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    });
    expect(syncMocks.syncSetting).toHaveBeenCalledWith("journal_vault_key", {
      wrappedKey: "wrapped:legacy password:vault-key-1",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_000,
    });
  });

  it("rewraps the same vault key when the diary password changes", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("old password");
    });
    await act(async () => {
      await expect(hook.result.current.changePassword("old password", "new password")).resolves.toBe(true);
    });

    expect(vaultCryptoMocks.rewrapJournalVaultKey).toHaveBeenCalledWith(
      "wrapped:old password:vault-key-1",
      "old password",
      "new password",
    );
    expect(settingsStore.get("journal_vault_key")?.value).toMatchObject({
      wrappedKey: "wrapped:new password:vault-key-1",
      updatedAt: 1_781_580_000_000,
    });
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
  });

  it("treats a synced wrapped vault key as a locked diary on a new device", async () => {
    settingsStore.set("journal_vault_key", {
      key: "journal_vault_key",
      value: {
        wrappedKey: "wrapped:correct horse battery staple:vault-key-remote",
        createdAt: 1_781_580_000_000,
        updatedAt: 1_781_580_000_000,
      },
    });
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.hasPassword).toBe(true);
    expect(hook.result.current.isLocked).toBe(true);

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(true);
    });

    expect(vaultCryptoMocks.unwrapJournalVaultKey).toHaveBeenCalledWith(
      "wrapped:correct horse battery staple:vault-key-remote",
      "correct horse battery staple",
    );
    expect(settingsStore.get("journal_password")?.value).toMatchObject({
      iterations: 600_000,
      createdAt: 1_781_580_000_000,
    });
    expect(hook.result.current.vaultKey).toBe("vault-key-remote");
  });

  it("removes the wrapped vault key when diary password protection is removed", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await hook.result.current.removePassword();
    });

    expect(journalStorageMocks.decryptEncryptedJournalEntries).toHaveBeenCalledWith("vault-key-1");
    expect(journalStorageMocks.decryptEncryptedJournalMedia).toHaveBeenCalledWith("vault-key-1");
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
    expect(syncMocks.deleteSettingFromCloud).toHaveBeenCalledWith("journal_vault_key");
    expect(hook.result.current.vaultKey).toBeNull();
  });
});
