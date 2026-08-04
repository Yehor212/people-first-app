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
  runBoundary: vi.fn(<T>(_: unknown, operation: () => Promise<T>) => operation()),
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

vi.mock("@/lib/platform", () => ({
  isNative: false,
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

import { db } from "@/storage/db";
import { useJournalSecurity } from "../useJournalSecurity";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity cooldown persistence", () => {
  beforeEach(() => {
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

  it("persists wrong-password cooldown across a fresh hook mount", async () => {
    const first = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      await first.result.current.setPassword("correct horse battery staple");
    });

    for (let attempt = 0; attempt < 3; attempt += 1) {
      await act(async () => {
        await expect(first.result.current.unlock("wrong password")).resolves.toBe(false);
      });
    }

    expect(settingsStore.get("journal_password_cooldown")?.value).toEqual({
      failedAttempts: 3,
      cooldownUntil: 1_781_580_030_000,
    });
    expect(first.result.current.cooldownRemaining).toBe(30);

    first.unmount();
    const second = renderHook(() => useJournalSecurity());

    await waitFor(() => {
      expect(second.result.current.failedAttempts).toBe(3);
      expect(second.result.current.cooldownRemaining).toBe(30);
    });
  });

  it("keeps unlock blocked until persisted cooldown finishes loading", async () => {
    const saltBytes = new Uint8Array([1, 2, 3, 4]);
    const saltText = bytesToString(saltBytes);
    const salt = btoa(saltText);
    const encodedHash = new TextEncoder().encode(
      `${"correct horse battery staple"}:${saltText}:600000`,
    );
    settingsStore.set("journal_password", {
      key: "journal_password",
      value: {
        hash: btoa(bytesToString(encodedHash)),
        salt,
        iterations: 600_000,
        createdAt: Date.now(),
      },
    });

    let resolveCooldown!: (entry: { key: string; value: unknown }) => void;
    const cooldownPromise = new Promise<{ key: string; value: unknown }>((resolve) => {
      resolveCooldown = resolve;
    });

    vi.mocked(db.settings.get).mockImplementation(((key: string) => {
      if (key === "journal_password_cooldown") return cooldownPromise;
      return Promise.resolve(settingsStore.get(key));
    }) as never);

    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.hasPassword).toBe(true));
    expect(hook.result.current.loading).toBe(true);

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(false);
    });
    expect(hook.result.current.isUnlocked).toBe(false);

    await act(async () => {
      resolveCooldown({
        key: "journal_password_cooldown",
        value: {
          failedAttempts: 3,
          cooldownUntil: 1_781_580_030_000,
        },
      });
      await cooldownPromise;
    });

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.cooldownRemaining).toBe(30);

    await act(async () => {
      await expect(hook.result.current.unlock("correct horse battery staple")).resolves.toBe(false);
    });
    expect(hook.result.current.isUnlocked).toBe(false);
  });

  it("fails closed and supports retry when persisted security state cannot be read", async () => {
    vi.mocked(db.settings.get).mockRejectedValue(new DOMException("Database unavailable", "UnknownError"));

    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loadError).toBe(true));
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.hasPassword).toBeNull();
    expect(hook.result.current.isLocked).toBe(true);
    expect(hook.result.current.isUnlocked).toBe(false);

    vi.mocked(db.settings.get).mockImplementation(
      ((key: string) => Promise.resolve(settingsStore.get(key))) as never,
    );
    await act(async () => {
      await hook.result.current.retryLoad();
    });

    await waitFor(() => expect(hook.result.current.loadError).toBe(false));
    expect(hook.result.current.loading).toBe(false);
    expect(hook.result.current.hasPassword).toBe(false);
    expect(hook.result.current.isLocked).toBe(false);
  });
});
