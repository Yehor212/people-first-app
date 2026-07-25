import { act, renderHook, waitFor } from "@testing-library/react";
import { afterEach, beforeEach, describe, expect, it, vi } from "vitest";

const settingsStore = new Map<string, { key: string; value: unknown }>();
const ownerState = vi.hoisted(() => ({ current: "account-a" }));
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
  assertBoundary: vi.fn(),
  runBoundary: vi.fn(),
  ensureQueued: vi.fn(() => Promise.resolve(false)),
  ensureRemovalQueued: vi.fn(() => Promise.resolve(false)),
  getIntent: vi.fn(() => Promise.resolve(null)),
  getRemovalIntent: vi.fn(() => Promise.resolve(null)),
  removeAtomic: vi.fn(() => Promise.resolve({ cloudMigrationPending: false })),
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
  removeJournalPasswordProtectionAtomically: migrationMocks.removeAtomic,
  runWithJournalSecurityBoundary: migrationMocks.runBoundary,
  JOURNAL_SECURITY_MIGRATION_EVENT: "zenflow:journal-security-migration-updated",
}));

import { useJournalSecurity } from "../useJournalSecurity";
import { JournalRemovePasswordPartialError } from "../journalSecurityErrors";

function bytesToString(bytes: Uint8Array): string {
  return Array.from(bytes, (byte) => String.fromCharCode(byte)).join("");
}

describe("useJournalSecurity iOS biometric vault key lifecycle", () => {
  beforeEach(() => {
    settingsStore.clear();
    vi.clearAllMocks();
    ownerState.current = "account-a";
    migrationMocks.getIntent.mockResolvedValue(null);
    migrationMocks.ensureQueued.mockResolvedValue(false);
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
        const result = await operation();
        await migrationMocks.assertBoundary(boundary);
        return result;
      }
    );
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

  it("does not biometric-unlock or encrypt account B after authentication started for account A", async () => {
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
    migrationMocks.captureBoundary.mockClear();
    journalStorageMocks.encryptPlaintextJournalEntries.mockClear();
    journalStorageMocks.encryptPlaintextJournalMedia.mockClear();

    let markAuthenticationStarted!: () => void;
    const authenticationStarted = new Promise<void>((resolve) => {
      markAuthenticationStarted = resolve;
    });
    let releaseAuthentication!: () => void;
    const authenticationGate = new Promise<void>((resolve) => {
      releaseAuthentication = resolve;
    });
    biometricMocks.authenticate.mockImplementationOnce(async () => {
      markAuthenticationStarted();
      await authenticationGate;
      return { success: true, secret: biometricTestValues.vaultKey };
    });

    const unlockPromise = hook.result.current.unlockWithBiometric();
    await authenticationStarted;
    ownerState.current = "account-b";
    releaseAuthentication();
    let unlocked: boolean | undefined;
    await act(async () => {
      unlocked = await unlockPromise;
    });

    expect(unlocked).toBe(false);
    expect(migrationMocks.captureBoundary).toHaveBeenCalledTimes(1);
    expect(journalStorageMocks.encryptPlaintextJournalEntries).not.toHaveBeenCalled();
    expect(journalStorageMocks.encryptPlaintextJournalMedia).not.toHaveBeenCalled();
    expect(hook.result.current.vaultKey).toBeNull();
    expect(hook.result.current.isUnlocked).toBe(false);
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

  it("does not leave biometric unlock marked enabled after native cleanup succeeds but atomic removal fails", async () => {
    const hook = renderHook(() => useJournalSecurity());

    await waitFor(() => expect(hook.result.current.loading).toBe(false));
    await waitFor(() => expect(hook.result.current.biometricAvailable).toBe(true));

    await act(async () => {
      await hook.result.current.setPassword("correct horse battery staple");
    });
    await act(async () => {
      await expect(hook.result.current.setBiometricEnabled(true)).resolves.toBe(true);
    });

    migrationMocks.removeAtomic.mockRejectedValueOnce(new Error("atomic removal failed"));

    await act(async () => {
      await expect(hook.result.current.removePassword()).rejects.toBeInstanceOf(
        JournalRemovePasswordPartialError,
      );
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
