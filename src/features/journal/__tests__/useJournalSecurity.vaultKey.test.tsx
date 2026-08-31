import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsStore = new Map<string, { key: string; value: unknown }>();
const ownerState = vi.hoisted<{ current: string | null }>(() => ({ current: "account-a" }));
const journalStorageMocks = vi.hoisted(() => ({
  decryptEncryptedJournalEntries: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  decryptEncryptedJournalMedia: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  encryptPlaintextJournalEntries: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  encryptPlaintextJournalMedia: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  hasEncryptedJournalContent: vi.fn(() => Promise.resolve(false)),
  hasEncryptedJournalMedia: vi.fn(() => Promise.resolve(false)),
}));
const draftStorageMocks = vi.hoisted(() => ({
  decryptEncryptedJournalDrafts: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  encryptPlaintextJournalDrafts: vi.fn(() => Promise.resolve(0)),
  hasEncryptedJournalDrafts: vi.fn(() => Promise.resolve(false)),
}));
const hubStorageMocks = vi.hoisted(() => ({
  decryptEncryptedJournalHubContent: vi.fn((_vaultKey: string) => Promise.resolve(0)),
  encryptPlaintextJournalHubContent: vi.fn(() => Promise.resolve(0)),
  hasEncryptedJournalHubContent: vi.fn(() => Promise.resolve(false)),
}));
const accountBoundaryRuntimeMocks = vi.hoisted(() => ({
  runtimeResets: new Set<() => void>(),
  generationListeners: new Set<(generation: string) => void>(),
}));
const syncMocks = vi.hoisted(() => ({
  isCloudSyncEnabled: vi.fn(() => true),
  syncSetting: vi.fn(
    (_key: string, _value: unknown, _expectedOwnerUserId?: string, _options?: unknown) =>
      Promise.resolve(),
  ),
  deleteSettingFromCloud: vi.fn(
    (_key: string, _expectedOwnerUserId?: string, _options?: unknown) => Promise.resolve(),
  ),
}));
const migrationMocks = vi.hoisted(() => ({
  activate: vi.fn(),
  captureBoundary: vi.fn<
    () => Promise<{
      generation: number;
      sessionOwnerUserId: string | null;
      localOwnerUserId: string | null;
    }>
  >(() =>
    Promise.resolve({
      generation: 1,
      sessionOwnerUserId: "account-a",
      localOwnerUserId: "account-a",
    }),
  ),
  assertBoundary: vi.fn(),
  runBoundary: vi.fn(),
  ensureQueued: vi.fn(() => Promise.resolve(false)),
  ensureRemovalQueued: vi.fn(() => Promise.resolve(false)),
  getIntent: vi.fn(() => Promise.resolve(null)),
  getRemovalIntent: vi.fn(() => Promise.resolve(null)),
  normalizeActiveVault: vi.fn(),
  removeAtomic: vi.fn(),
  recordNativeCleanup: vi.fn(() => Promise.resolve()),
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

vi.mock("@/storage/accountBoundaryRuntime", async (importOriginal) => {
  const actual = await importOriginal<typeof import("@/storage/accountBoundaryRuntime")>();
  return {
    ...actual,
    registerAccountBoundaryRuntimeReset: vi.fn((reset: () => void) => {
      accountBoundaryRuntimeMocks.runtimeResets.add(reset);
      return () => accountBoundaryRuntimeMocks.runtimeResets.delete(reset);
    }),
    subscribeOriginAccountBoundaryGeneration: vi.fn(
      (listener: (generation: string) => void) => {
        accountBoundaryRuntimeMocks.generationListeners.add(listener);
        return () => accountBoundaryRuntimeMocks.generationListeners.delete(listener);
      },
    ),
  };
});

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
vi.mock("../journalDraftStorage", () => draftStorageMocks);
vi.mock("../journalHubStorage", () => hubStorageMocks);
vi.mock("../journalSecurityMigration", () => ({
  activateJournalPasswordProtection: migrationMocks.activate,
  assertJournalSecurityBoundary: migrationMocks.assertBoundary,
  captureJournalSecurityBoundary: migrationMocks.captureBoundary,
  ensureJournalSecurityMigrationQueued: migrationMocks.ensureQueued,
  ensureJournalSecurityRemovalQueued: migrationMocks.ensureRemovalQueued,
  getJournalSecurityMigrationIntent: migrationMocks.getIntent,
  getJournalSecurityRemovalIntent: migrationMocks.getRemovalIntent,
  normalizeJournalDataForActiveVault: migrationMocks.normalizeActiveVault,
  removeJournalPasswordProtectionAtomically: migrationMocks.removeAtomic,
  recordJournalSecurityRemovalNativeCleanup: migrationMocks.recordNativeCleanup,
  runWithJournalSecurityBoundary: migrationMocks.runBoundary,
  JOURNAL_SECURITY_MIGRATION_EVENT: "zenflow:journal-security-migration-updated",
}));

import { useJournalSecurity } from "../useJournalSecurity";
import { runWithJournalSecurityWriteLock } from "../journalSecurityWriteLock";
import { clearJournalContentSession } from "@/lib/journalContentSession";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity vault key lifecycle", () => {
  beforeEach(() => {
    settingsStore.clear();
    vi.clearAllMocks();
    journalStorageMocks.hasEncryptedJournalContent.mockReset().mockResolvedValue(false);
    journalStorageMocks.hasEncryptedJournalMedia.mockReset().mockResolvedValue(false);
    draftStorageMocks.hasEncryptedJournalDrafts.mockReset().mockResolvedValue(false);
    hubStorageMocks.hasEncryptedJournalHubContent.mockReset().mockResolvedValue(false);
    accountBoundaryRuntimeMocks.runtimeResets.clear();
    accountBoundaryRuntimeMocks.generationListeners.clear();
    ownerState.current = "account-a";
    migrationMocks.ensureQueued.mockResolvedValue(false);
    migrationMocks.ensureRemovalQueued.mockResolvedValue(false);
    migrationMocks.getIntent.mockResolvedValue(null);
    migrationMocks.getRemovalIntent.mockResolvedValue(null);
    migrationMocks.normalizeActiveVault.mockResolvedValue({
      changedCount: 0,
      unboundMediaCount: 0,
      cloudMigrationPending: false,
    });
    migrationMocks.captureBoundary.mockImplementation(() =>
      Promise.resolve({
        generation: 1,
        sessionOwnerUserId: ownerState.current,
        localOwnerUserId: ownerState.current,
      })
    );
    migrationMocks.assertBoundary.mockImplementation(
      async (boundary: { sessionOwnerUserId: string | null; localOwnerUserId: string | null }) => {
        if (
          boundary.sessionOwnerUserId !== ownerState.current ||
          boundary.localOwnerUserId !== ownerState.current
        ) {
          throw new Error("Account boundary changed during diary protection");
        }
      }
    );
    migrationMocks.runBoundary.mockImplementation(
      async <T,>(
        boundary: { sessionOwnerUserId: string | null; localOwnerUserId: string | null },
        operation: () => Promise<T>
      ): Promise<T> => {
        await migrationMocks.assertBoundary(boundary);
        const result = await runWithJournalSecurityWriteLock(operation);
        await migrationMocks.assertBoundary(boundary);
        return result;
      }
    );
    migrationMocks.removeAtomic.mockImplementation(
      async (
        activeVaultKey: string | null,
        boundary: { sessionOwnerUserId: string | null; localOwnerUserId: string | null }
      ) => {
        await migrationMocks.assertBoundary(boundary);
        return runWithJournalSecurityWriteLock(async () => {
          if (!activeVaultKey) {
            const encrypted = await Promise.all([
              journalStorageMocks.hasEncryptedJournalContent(),
              journalStorageMocks.hasEncryptedJournalMedia(),
              draftStorageMocks.hasEncryptedJournalDrafts(),
              hubStorageMocks.hasEncryptedJournalHubContent(),
            ]);
            if (encrypted.some(Boolean)) {
              throw new Error("Unlock your diary before removing password protection.");
            }
          } else {
            await journalStorageMocks.decryptEncryptedJournalEntries(activeVaultKey);
            await draftStorageMocks.decryptEncryptedJournalDrafts(activeVaultKey);
            await hubStorageMocks.decryptEncryptedJournalHubContent(activeVaultKey);
            await journalStorageMocks.decryptEncryptedJournalMedia(activeVaultKey);
          }
          settingsStore.delete("journal_password");
          settingsStore.delete("journal_vault_key");
          settingsStore.delete("journal_biometric");
          settingsStore.delete("journal_password_cooldown");
          await migrationMocks.assertBoundary(boundary);
          return {
            cloudMigrationPending: Boolean(
              syncMocks.isCloudSyncEnabled() && boundary.sessionOwnerUserId
            ),
          };
        });
      }
    );
    migrationMocks.ensureRemovalQueued.mockImplementation(async () => {
      if (!ownerState.current) return false;
      await syncMocks.deleteSettingFromCloud("journal_vault_key", ownerState.current);
      return true;
    });
    migrationMocks.activate.mockImplementation(async (
      {
        passwordData,
        vaultSetting,
        vaultKey,
      }: {
        passwordData: unknown;
        vaultSetting: { updatedAt: number };
        vaultKey: string;
      },
      boundary: { sessionOwnerUserId: string | null },
    ) => {
      const previousRevision = Number(
        settingsStore.get("journal_vault_revision_v1")?.value,
      );
      const vaultRevision = Math.max(
        vaultSetting.updatedAt,
        Number.isSafeInteger(previousRevision) ? previousRevision + 1 : 0,
      );
      const persistedVaultSetting = {
        ...vaultSetting,
        updatedAt: vaultRevision,
      };
      settingsStore.set("journal_password", { key: "journal_password", value: passwordData });
      settingsStore.set("journal_vault_key", {
        key: "journal_vault_key",
        value: persistedVaultSetting,
      });
      settingsStore.set("journal_vault_revision_v1", {
        key: "journal_vault_revision_v1",
        value: vaultRevision,
      });
      await syncMocks.syncSetting(
        "journal_vault_key",
        persistedVaultSetting,
        boundary.sessionOwnerUserId ?? undefined,
      );
      await journalStorageMocks.encryptPlaintextJournalEntries(vaultKey);
      await journalStorageMocks.encryptPlaintextJournalMedia(vaultKey);
      return { cloudMigrationPending: false, vaultRevision };
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

  it("drops the unlocked vault key and reloads protection for the new account", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    expect(hook.result.current.isUnlocked).toBe(true);
    expect(hook.result.current.vaultKey).toBe("vault-key-1");

    settingsStore.clear();

    act(() => {
      for (const listener of accountBoundaryRuntimeMocks.generationListeners) {
        listener("account-b-generation");
      }
    });

    expect(hook.result.current.isUnlocked).toBe(false);
    expect(hook.result.current.vaultKey).toBeNull();
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    expect(hook.result.current.hasPassword).toBe(false);
  });

  afterEach(() => {
    clearJournalContentSession("sign-out");
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
    }, "account-a");
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
    expect(journalStorageMocks.encryptPlaintextJournalEntries).toHaveBeenCalledWith("vault-key-1");
    expect(journalStorageMocks.encryptPlaintextJournalMedia).toHaveBeenCalledWith("vault-key-1");
  });

  it("captures the account boundary before slow password crypto and rejects activation after A to B switch", async () => {
    const boundaryA = {
      generation: 7,
      sessionOwnerUserId: "account-a",
      localOwnerUserId: "account-a",
    };
    migrationMocks.captureBoundary.mockResolvedValueOnce(boundaryA);
    let currentOwner = "account-a";
    let releaseCrypto!: () => void;
    const cryptoGate = new Promise<void>((resolve) => {
      releaseCrypto = resolve;
    });
    let markCryptoStarted!: () => void;
    const cryptoStarted = new Promise<void>((resolve) => {
      markCryptoStarted = resolve;
    });
    const deriveBits = crypto.subtle.deriveBits as ReturnType<typeof vi.fn>;
    deriveBits.mockImplementationOnce(
      async (algorithm: { salt: ArrayBuffer; iterations: number }, key: { password: string }) => {
        markCryptoStarted();
        await cryptoGate;
        const salt = bytesToString(new Uint8Array(algorithm.salt));
        return new TextEncoder().encode(`${key.password}:${salt}:${algorithm.iterations}`).buffer;
      }
    );
    migrationMocks.activate.mockImplementationOnce(
      async (_input: unknown, boundary: typeof boundaryA) => {
        if (boundary.sessionOwnerUserId !== currentOwner) {
          throw new Error("Account boundary changed during diary protection");
        }
        return { cloudMigrationPending: false };
      }
    );
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    let activationError: unknown;
    const activation = hook.result.current
      .setPassword("slow protected password")
      .catch((error: unknown) => {
        activationError = error;
      });
    await cryptoStarted;
    currentOwner = "account-b";
    releaseCrypto();
    await activation;

    expect(activationError).toMatchObject({
      message: "Account boundary changed during diary protection",
    });
    expect(migrationMocks.captureBoundary).toHaveBeenCalledTimes(1);
    expect(migrationMocks.captureBoundary.mock.invocationCallOrder[0]).toBeLessThan(
      deriveBits.mock.invocationCallOrder[0]
    );
    expect(migrationMocks.activate).toHaveBeenCalledWith(
      expect.objectContaining({ vaultKey: "vault-key-1" }),
      boundaryA
    );
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
  });

  it("does not re-enqueue a migration that is already queued when progress events arrive", async () => {
    migrationMocks.getIntent.mockResolvedValue({ status: "queued" } as never);
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.cloudProtectionPending).toBe(true));
    window.dispatchEvent(new CustomEvent("zenflow:journal-security-migration-updated"));
    await Promise.resolve();

    expect(migrationMocks.ensureQueued).not.toHaveBeenCalled();
  });

  it("requeues an enqueue-failed migration once and then observes queued progress", async () => {
    const failedIntent = { status: "enqueue-failed" };
    const queuedIntent = { status: "queued" };
    migrationMocks.getIntent.mockResolvedValueOnce(failedIntent as never);
    migrationMocks.ensureQueued.mockImplementationOnce(async () => {
      migrationMocks.getIntent.mockResolvedValue(queuedIntent as never);
      window.dispatchEvent(new CustomEvent("zenflow:journal-security-migration-updated"));
      return true;
    });
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.cloudProtectionPending).toBe(true));
    await waitFor(() => expect(migrationMocks.ensureQueued).toHaveBeenCalledTimes(1));
    await Promise.resolve();

    expect(migrationMocks.ensureQueued).toHaveBeenCalledTimes(1);
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

  it("fails closed when the durable vault revision marker is malformed", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
      hook.result.current.lock();
    });
    settingsStore.set("journal_vault_revision_v1", {
      key: "journal_vault_revision_v1",
      value: "malformed",
    });
    migrationMocks.normalizeActiveVault.mockClear();

    await act(async () => {
      await expect(
        hook.result.current.unlock("correct horse battery staple"),
      ).resolves.toBe(false);
    });

    expect(migrationMocks.normalizeActiveVault).not.toHaveBeenCalled();
    expect(hook.result.current.isUnlocked).toBe(false);
  });

  it("does not unlock or encrypt account B after password verification started for account A", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
      hook.result.current.lock();
    });
    migrationMocks.captureBoundary.mockClear();
    journalStorageMocks.encryptPlaintextJournalEntries.mockClear();
    journalStorageMocks.encryptPlaintextJournalMedia.mockClear();

    let markHashStarted!: () => void;
    const hashStarted = new Promise<void>((resolve) => {
      markHashStarted = resolve;
    });
    let releaseHash!: () => void;
    const hashGate = new Promise<void>((resolve) => {
      releaseHash = resolve;
    });
    const deriveBits = crypto.subtle.deriveBits as ReturnType<typeof vi.fn>;
    deriveBits.mockImplementationOnce(
      async (algorithm: { salt: ArrayBuffer; iterations: number }, key: { password: string }) => {
        markHashStarted();
        await hashGate;
        const salt = bytesToString(new Uint8Array(algorithm.salt));
        return new TextEncoder().encode(`${key.password}:${salt}:${algorithm.iterations}`).buffer;
      }
    );

    const unlockPromise = hook.result.current.unlock("correct horse battery staple");
    await hashStarted;
    ownerState.current = "account-b";
    releaseHash();
    let unlocked: boolean | undefined;
    await act(async () => {
      unlocked = await unlockPromise;
    });

    expect(unlocked).toBe(false);
    expect(migrationMocks.captureBoundary).toHaveBeenCalledTimes(1);
    expect(journalStorageMocks.encryptPlaintextJournalEntries).not.toHaveBeenCalled();
    expect(journalStorageMocks.encryptPlaintextJournalMedia).not.toHaveBeenCalled();
    expect(hook.result.current.vaultKey).toBeNull();
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
      updatedAt: 1_781_580_000_001,
    });
    expect(syncMocks.syncSetting).toHaveBeenCalledWith("journal_vault_key", {
      wrappedKey: "wrapped:legacy password:vault-key-1",
      createdAt: 1_781_580_000_000,
      updatedAt: 1_781_580_000_001,
    }, "account-a");
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
    expect(migrationMocks.normalizeActiveVault).toHaveBeenCalledWith(
      "vault-key-1",
      1_781_580_000_000,
      expect.objectContaining({ sessionOwnerUserId: "account-a" }),
    );
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
  });

  it("keeps an owner-bound durable retry when password rewrap reaches local storage but cloud sync fails", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("old password");
    });
    syncMocks.syncSetting.mockRejectedValueOnce(new Error("temporary cloud failure"));

    await act(async () => {
      await expect(
        hook.result.current.changePassword("old password", "new password")
      ).resolves.toBe(true);
    });

    expect(settingsStore.get("journal_vault_sync_pending_v1")?.value).toMatchObject({
      version: 1,
      ownerUserId: "account-a",
      expectedVaultSetting: {
        wrappedKey: "wrapped:old password:vault-key-1",
        updatedAt: 1_781_580_000_000,
      },
      vaultSetting: {
        wrappedKey: "wrapped:new password:vault-key-1",
        wrapperRevision: 1,
        updatedAt: 1_781_580_000_000,
      },
    });
    expect(hook.result.current.cloudProtectionPending).toBe(true);
    expect(hook.result.current.cloudProtectionPendingKind).toBe("vault-sync");
  });

  it("does not clear a password rewrap intent without an acknowledged remote commit", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("old password");
    });
    syncMocks.syncSetting.mockImplementationOnce(
      async (_key, _value, _owner, options) => {
        if ((options as { requireRemoteCommit?: boolean } | undefined)?.requireRemoteCommit) {
          throw new Error("remote commit unavailable");
        }
      },
    );

    await act(async () => {
      await expect(
        hook.result.current.changePassword("old password", "new password"),
      ).resolves.toBe(true);
    });

    expect(syncMocks.syncSetting).toHaveBeenLastCalledWith(
      "journal_vault_key",
      expect.objectContaining({ wrappedKey: "wrapped:new password:vault-key-1" }),
      "account-a",
      {
        requireRemoteCommit: true,
        journalVaultExpectedValue: expect.objectContaining({
          wrappedKey: "wrapped:old password:vault-key-1",
          updatedAt: 1_781_580_000_000,
        }),
      },
    );
    expect(settingsStore.has("journal_vault_sync_pending_v1")).toBe(true);
    expect(hook.result.current.cloudProtectionPendingKind).toBe("vault-sync");
  });

  it("retries a pending password rewrap when connectivity returns", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("old password");
    });
    syncMocks.syncSetting.mockRejectedValueOnce(new Error("temporary cloud failure"));

    await act(async () => {
      await expect(
        hook.result.current.changePassword("old password", "new password")
      ).resolves.toBe(true);
    });
    syncMocks.syncSetting.mockClear();

    act(() => {
      window.dispatchEvent(new Event("online"));
    });

    await waitFor(() => {
      expect(settingsStore.has("journal_vault_sync_pending_v1")).toBe(false);
      expect(hook.result.current.cloudProtectionPending).toBe(false);
      expect(hook.result.current.cloudProtectionPendingKind).toBeNull();
    });
    expect(syncMocks.syncSetting).toHaveBeenCalledWith(
      "journal_vault_key",
      expect.objectContaining({
        wrappedKey: "wrapped:new password:vault-key-1",
        updatedAt: 1_781_580_000_000,
      }),
      "account-a",
      expect.objectContaining({
        requireRemoteCommit: true,
        journalVaultExpectedValue: expect.objectContaining({
          wrappedKey: "wrapped:old password:vault-key-1",
        }),
      }),
    );
  });

  it("resumes a pending password rewrap after the security hook restarts", async () => {
    const first = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      await first.result.current.setPassword("old password");
    });
    syncMocks.syncSetting.mockRejectedValueOnce(new Error("temporary cloud failure"));
    await act(async () => {
      await expect(
        first.result.current.changePassword("old password", "new password")
      ).resolves.toBe(true);
    });
    expect(settingsStore.has("journal_vault_sync_pending_v1")).toBe(true);
    first.unmount();
    syncMocks.syncSetting.mockClear();

    const restarted = renderHook(() => useJournalSecurity());
    await waitFor(() => {
      expect(settingsStore.has("journal_vault_sync_pending_v1")).toBe(false);
      expect(restarted.result.current.cloudProtectionPending).toBe(false);
      expect(restarted.result.current.cloudProtectionPendingKind).toBeNull();
    });
    expect(syncMocks.syncSetting).toHaveBeenCalledWith(
      "journal_vault_key",
      expect.objectContaining({
        wrappedKey: "wrapped:new password:vault-key-1",
        updatedAt: 1_781_580_000_000,
      }),
      "account-a",
      expect.objectContaining({
        requireRemoteCommit: true,
        journalVaultExpectedValue: expect.objectContaining({
          wrappedKey: "wrapped:old password:vault-key-1",
        }),
      }),
    );
  });

  it("serializes an older pending wrapper retry before a newer password rewrap", async () => {
    const first = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(first.result.current.loading).toBe(false));
    await act(async () => {
      await first.result.current.setPassword("old password");
    });
    syncMocks.syncSetting.mockRejectedValueOnce(new Error("temporary cloud failure"));
    await act(async () => {
      await expect(
        first.result.current.changePassword("old password", "pending password"),
      ).resolves.toBe(true);
    });
    expect(settingsStore.get("journal_vault_sync_pending_v1")?.value).toMatchObject({
      vaultSetting: { wrappedKey: "wrapped:pending password:vault-key-1" },
    });
    first.unmount();

    let markRetryStarted!: () => void;
    const retryStarted = new Promise<void>((resolve) => {
      markRetryStarted = resolve;
    });
    let releaseRetry!: () => void;
    const retryGate = new Promise<void>((resolve) => {
      releaseRetry = resolve;
    });
    let markNewWrapperStarted!: () => void;
    const newWrapperStarted = new Promise<void>((resolve) => {
      markNewWrapperStarted = resolve;
    });
    let remoteWrappedKey: string | null = null;
    syncMocks.syncSetting.mockReset().mockImplementation(async (_key, value) => {
      const wrappedKey = (value as { wrappedKey: string }).wrappedKey;
      if (wrappedKey === "wrapped:pending password:vault-key-1") {
        markRetryStarted();
        await retryGate;
      } else if (wrappedKey === "wrapped:final password:vault-key-1") {
        markNewWrapperStarted();
      }
      remoteWrappedKey = wrappedKey;
    });

    const restarted = renderHook(() => useJournalSecurity());
    await retryStarted;
    const changePromise = restarted.result.current.changePassword(
      "pending password",
      "final password",
    );
    const interleaving = await Promise.race([
      newWrapperStarted.then(() => "new-wrapper-started" as const),
      new Promise<"blocked">((resolve) => setTimeout(() => resolve("blocked"), 100)),
    ]);

    releaseRetry();
    await act(async () => {
      await expect(changePromise).resolves.toBe(true);
    });

    expect(interleaving).toBe("blocked");
    expect(remoteWrappedKey).toBe("wrapped:final password:vault-key-1");
    expect(settingsStore.has("journal_vault_sync_pending_v1")).toBe(false);
  });

  it("never infers a newly signed-in cloud owner for an operation captured local-only", async () => {
    ownerState.current = null;
    syncMocks.isCloudSyncEnabled.mockReturnValue(false);
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("local-only password");
    });

    syncMocks.isCloudSyncEnabled.mockReturnValue(true);
    syncMocks.syncSetting.mockClear();
    await act(async () => {
      await expect(
        hook.result.current.changePassword("local-only password", "new local-only password")
      ).resolves.toBe(true);
    });
    expect(syncMocks.syncSetting).not.toHaveBeenCalled();

    syncMocks.deleteSettingFromCloud.mockClear();
    await act(async () => {
      await hook.result.current.removePassword();
    });
    expect(syncMocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });

  it("does not change account B diary settings after account A password rewrap has started", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("old password");
    });
    const originalPassword = settingsStore.get("journal_password")?.value;
    const originalVault = settingsStore.get("journal_vault_key")?.value;
    migrationMocks.captureBoundary.mockClear();

    let markRewrapStarted!: () => void;
    const rewrapStarted = new Promise<void>((resolve) => {
      markRewrapStarted = resolve;
    });
    let releaseRewrap!: () => void;
    const rewrapGate = new Promise<void>((resolve) => {
      releaseRewrap = resolve;
    });
    vaultCryptoMocks.rewrapJournalVaultKey.mockImplementationOnce(async () => {
      markRewrapStarted();
      await rewrapGate;
      return "wrapped:new password:vault-key-1";
    });

    const changePromise = hook.result.current.changePassword("old password", "new password");
    await rewrapStarted;
    ownerState.current = "account-b";
    releaseRewrap();
    let changed: boolean | undefined;
    await act(async () => {
      changed = await changePromise;
    });

    expect(changed).toBe(false);
    expect(migrationMocks.captureBoundary).toHaveBeenCalledTimes(1);
    expect(settingsStore.get("journal_password")?.value).toEqual(originalPassword);
    expect(settingsStore.get("journal_vault_key")?.value).toEqual(originalVault);
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
    expect(migrationMocks.normalizeActiveVault).toHaveBeenCalledWith(
      "vault-key-remote",
      1_781_580_000_000,
      expect.objectContaining({ sessionOwnerUserId: "account-a" }),
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
    expect(draftStorageMocks.decryptEncryptedJournalDrafts).toHaveBeenCalledWith("vault-key-1");
    expect(hubStorageMocks.decryptEncryptedJournalHubContent).toHaveBeenCalledWith("vault-key-1");
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
    expect(syncMocks.deleteSettingFromCloud).toHaveBeenCalledWith(
      "journal_vault_key",
      "account-a"
    );
    expect(hook.result.current.vaultKey).toBeNull();
  });

  it("waits for an in-flight protected write and leaves no ciphertext after removing protection", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    let persistedContent = "plaintext";
    let releaseWrite!: () => void;
    const writeGate = new Promise<void>((resolve) => {
      releaseWrite = resolve;
    });
    let markWriteStarted!: () => void;
    const writeStarted = new Promise<void>((resolve) => {
      markWriteStarted = resolve;
    });
    const protectedWrite = runWithJournalSecurityWriteLock(async () => {
      markWriteStarted();
      await writeGate;
      persistedContent = "encrypted-after-write";
    });
    await writeStarted;
    let markRemovalMigrationStarted!: () => void;
    const removalMigrationStarted = new Promise<void>((resolve) => {
      markRemovalMigrationStarted = resolve;
    });
    journalStorageMocks.decryptEncryptedJournalEntries.mockImplementationOnce(async () => {
      markRemovalMigrationStarted();
      if (persistedContent.startsWith("encrypted")) persistedContent = "plaintext-after-removal";
      return 1;
    });

    let removalError: unknown;
    await act(async () => {
      const removal = hook.result.current.removePassword();
      await Promise.race([
        removalMigrationStarted,
        new Promise<void>((resolve) => setTimeout(resolve, 10)),
      ]);
      releaseWrite();
      try {
        await Promise.all([protectedWrite, removal]);
      } catch (error) {
        removalError = error;
      }
    });

    expect(removalError).toBeUndefined();
    expect(persistedContent).toBe("plaintext-after-removal");
  });

  it("keeps durable local removal and never retargets its remote completion to account B", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    const originalPassword = settingsStore.get("journal_password")?.value;
    const originalVault = settingsStore.get("journal_vault_key")?.value;
    migrationMocks.captureBoundary.mockClear();

    let markCloudDeleteStarted!: () => void;
    const cloudDeleteStarted = new Promise<void>((resolve) => {
      markCloudDeleteStarted = resolve;
    });
    let releaseCloudDelete!: () => void;
    const cloudDeleteGate = new Promise<void>((resolve) => {
      releaseCloudDelete = resolve;
    });
    syncMocks.deleteSettingFromCloud.mockImplementationOnce(async () => {
      markCloudDeleteStarted();
      await cloudDeleteGate;
    });

    const removalPromise = hook.result.current.removePassword();
    await cloudDeleteStarted;
    ownerState.current = "account-b";
    releaseCloudDelete();
    let removalError: unknown;
    await act(async () => {
      try {
        await removalPromise;
      } catch (error) {
        removalError = error;
      }
    });

    expect(removalError).toBeUndefined();
    expect(migrationMocks.captureBoundary).toHaveBeenCalledTimes(1);
    expect(originalPassword).toBeDefined();
    expect(originalVault).toBeDefined();
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
    expect(syncMocks.deleteSettingFromCloud).toHaveBeenCalledWith(
      "journal_vault_key",
      "account-a"
    );
    expect(syncMocks.deleteSettingFromCloud).not.toHaveBeenCalledWith(
      "journal_vault_key",
      "account-b"
    );
  });

  it("blocks password removal when an encrypted draft exists in a locked tab", async () => {
    settingsStore.set("journal_password", {
      key: "journal_password",
      value: { hash: "hash", salt: "salt", iterations: 600_000, createdAt: 1 },
    });
    settingsStore.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 1 },
    });
    draftStorageMocks.hasEncryptedJournalDrafts.mockResolvedValueOnce(true);
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await expect(hook.result.current.removePassword()).resolves.toEqual({
        status: "blocked",
        blocker: "unlock-required",
        recoveryAction: "unlock",
      });
    });

    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
    expect(syncMocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });

  it("removes only a verified empty locked diary without requiring the lost vault key", async () => {
    settingsStore.set("journal_password", {
      key: "journal_password",
      value: { hash: "hash", salt: "salt", iterations: 600_000, createdAt: 1 },
    });
    settingsStore.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 1 },
    });
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await expect(
        hook.result.current.removePassword({ allowVerifiedEmptyDiary: true })
      ).resolves.toEqual({
        status: "removed-cleanup-pending",
        pending: ["cloud"],
      });
    });

    expect(migrationMocks.removeAtomic).toHaveBeenCalledWith(
      null,
      expect.objectContaining({ sessionOwnerUserId: "account-a" }),
    );
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
  });

  it("blocks password removal when encrypted Space content exists in a locked tab", async () => {
    settingsStore.set("journal_password", {
      key: "journal_password",
      value: { hash: "hash", salt: "salt", iterations: 600_000, createdAt: 1 },
    });
    settingsStore.set("journal_vault_key", {
      key: "journal_vault_key",
      value: { wrappedKey: "wrapped", createdAt: 1, updatedAt: 1 },
    });
    hubStorageMocks.hasEncryptedJournalHubContent.mockResolvedValueOnce(true);
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));

    await act(async () => {
      await expect(hook.result.current.removePassword()).resolves.toEqual({
        status: "blocked",
        blocker: "unlock-required",
        recoveryAction: "unlock",
      });
    });

    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
    expect(syncMocks.deleteSettingFromCloud).not.toHaveBeenCalled();
  });

  it("keeps local removal complete and marks cloud completion pending when remote deletion fails", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    syncMocks.deleteSettingFromCloud.mockRejectedValueOnce(new Error("cloud delete failed"));

    await act(async () => {
      await expect(hook.result.current.removePassword()).resolves.toEqual({
        status: "removed-cleanup-pending",
        pending: ["cloud"],
      });
    });

    expect(journalStorageMocks.decryptEncryptedJournalEntries).toHaveBeenCalledWith("vault-key-1");
    expect(journalStorageMocks.decryptEncryptedJournalMedia).toHaveBeenCalledWith("vault-key-1");
    expect(settingsStore.has("journal_password")).toBe(false);
    expect(settingsStore.has("journal_vault_key")).toBe(false);
    expect(hook.result.current.hasPassword).toBe(false);
    expect(hook.result.current.vaultKey).toBeNull();
    expect(hook.result.current.cloudProtectionPending).toBe(true);
  });

  it("does not start remote deletion when atomic local decryption preparation fails", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    const wrappedVaultSetting = settingsStore.get("journal_vault_key")?.value;
    syncMocks.syncSetting.mockClear();
    journalStorageMocks.decryptEncryptedJournalEntries.mockRejectedValueOnce(
      new Error("decrypt failed"),
    );

    await act(async () => {
      await expect(hook.result.current.removePassword()).rejects.toThrow("decrypt failed");
    });

    expect(wrappedVaultSetting).toBeDefined();
    expect(syncMocks.deleteSettingFromCloud).not.toHaveBeenCalled();
    expect(syncMocks.syncSetting).not.toHaveBeenCalled();
    expect(journalStorageMocks.decryptEncryptedJournalMedia).not.toHaveBeenCalled();
    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
    expect(hook.result.current.hasPassword).toBe(true);
    expect(hook.result.current.vaultKey).toBe("vault-key-1");
  });

  it("does not run compensating re-encryption when atomic removal preparation fails", async () => {
    const hook = renderHook(() => useJournalSecurity());
    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });

    let draftContent = "encrypted-draft";
    draftStorageMocks.decryptEncryptedJournalDrafts.mockResolvedValueOnce(1);
    draftStorageMocks.encryptPlaintextJournalDrafts.mockImplementationOnce(async () => {
      draftContent = "encrypted-draft";
      return 1;
    });
    journalStorageMocks.decryptEncryptedJournalMedia.mockRejectedValueOnce(
      new Error("media decrypt failed")
    );

    await act(async () => {
      await expect(hook.result.current.removePassword()).rejects.toThrow("media decrypt failed");
    });

    expect(draftStorageMocks.decryptEncryptedJournalDrafts).toHaveBeenCalledWith("vault-key-1");
    expect(draftStorageMocks.encryptPlaintextJournalDrafts).not.toHaveBeenCalled();
    expect(hubStorageMocks.encryptPlaintextJournalHubContent).not.toHaveBeenCalled();
    expect(draftContent).toBe("encrypted-draft");
    expect(settingsStore.has("journal_password")).toBe(true);
    expect(settingsStore.has("journal_vault_key")).toBe(true);
  });
});
