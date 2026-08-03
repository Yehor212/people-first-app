import { useState, useEffect, useCallback, useRef } from "react";
import { isNative } from "@/lib/platform";
import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import type { JournalPassword, JournalVaultKeySetting } from "./types";
import { JOURNAL_PASSWORD_KEY, JOURNAL_VAULT_KEY_SETTING_KEY } from "./types";
import {
  generateJournalVaultKey,
  rewrapJournalVaultKey,
  unwrapJournalVaultKey,
  wrapJournalVaultKey,
} from "./journalVaultCrypto";
import {
  clearJournalContentSession,
  issueJournalReplaceAuthorization,
  notifyJournalProtectionRemoved,
  setJournalContentVaultKey,
  type JournalReplaceAuthorizationInvalidationReason,
} from "@/lib/journalContentSession";
import {
  encryptPlaintextJournalEntries,
  encryptPlaintextJournalMedia,
} from "./journalStorage";
import {
  encryptPlaintextJournalDrafts,
} from "./journalDraftStorage";
import {
  encryptPlaintextJournalHubContent,
} from "./journalHubStorage";
import { logger } from "@/lib/logger";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { syncSetting } from "@/storage/sync/syncSettings";
import { clearNativeJournalBiometricCredential } from "@/lib/journalBiometricCredentials";
import {
  activateJournalPasswordProtection,
  assertJournalSecurityBoundary,
  captureJournalSecurityBoundary,
  ensureJournalSecurityMigrationQueued,
  ensureJournalSecurityRemovalQueued,
  getJournalSecurityMigrationIntent,
  getJournalSecurityRemovalIntent,
  JOURNAL_SECURITY_MIGRATION_EVENT,
  runWithJournalSecurityBoundary,
  removeJournalPasswordProtectionAtomically,
} from "./journalSecurityMigration";
import {
  getJournalVaultKeyForWrite,
  JournalWriteLockedError,
} from "./journalWriteSecurity";
import {
  registerAccountBoundaryRuntimeReset,
  subscribeOriginAccountBoundaryGeneration,
} from "@/storage/accountBoundaryRuntime";
import {
  JournalRemovePasswordLockedError,
  JournalRemovePasswordPartialError,
} from "./journalSecurityErrors";

const BIOMETRIC_SETTINGS_KEY = SK.JOURNAL_BIOMETRIC;
const SECURITY_COOLDOWN_KEY = SK.JOURNAL_PASSWORD_COOLDOWN;

type JournalUnlockCooldown = {
  failedAttempts: number;
  cooldownUntil: number;
};

const PBKDF2_ITERATIONS = 600_000;
const _LEGACY_PBKDF2_ITERATIONS = 100_000; // For future transparent migration
const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes
interface RemoveJournalPasswordOptions {
  allowVerifiedEmptyDiary?: boolean;
}

export type JournalCloudProtectionPendingKind = "activation" | "removal" | "unknown" | null;
export const LOCK_TIMEOUT_OPTIONS = [
  { label: "Immediately", ms: 0 },
  { label: "1 minute", ms: 60_000 },
  { label: "5 minutes", ms: 300_000 },
  { label: "15 minutes", ms: 900_000 },
  { label: "30 minutes", ms: 1_800_000 },
] as const;
export const JOURNAL_AUTO_LOCK_CHANGE_EVENT = "zenflow:journal-auto-lock-change";

function getAutoLockMs(): number {
  const stored = safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null);
  return LOCK_TIMEOUT_OPTIONS.some((option) => option.ms === stored)
    ? (stored as (typeof LOCK_TIMEOUT_OPTIONS)[number]["ms"])
    : DEFAULT_AUTO_LOCK_MS;
}

export function setAutoLockMs(ms: number): boolean {
  if (!LOCK_TIMEOUT_OPTIONS.some((option) => option.ms === ms)) return false;
  if (!safeLocalStorageSet(SK.JOURNAL_LOCK_TIMEOUT, ms)) return false;
  window.dispatchEvent(new CustomEvent<number>(JOURNAL_AUTO_LOCK_CHANGE_EVENT, { detail: ms }));
  return true;
}
const COOLDOWN_STEPS = [
  { after: 3, seconds: 30 },
  { after: 5, seconds: 300 },
];

function normalizeCooldownState(value: unknown): JournalUnlockCooldown | null {
  if (!value || typeof value !== "object") return null;
  const candidate = value as Partial<JournalUnlockCooldown>;
  const attempts = Number(candidate.failedAttempts);
  const until = Number(candidate.cooldownUntil);
  if (!Number.isFinite(attempts) || !Number.isFinite(until)) return null;
  return {
    failedAttempts: Math.max(0, Math.floor(attempts)),
    cooldownUntil: Math.max(0, until),
  };
}

async function persistUnlockCooldown(failedAttempts: number, cooldownUntil: number): Promise<void> {
  try {
    if (failedAttempts > 0 || cooldownUntil > Date.now()) {
      await db.settings.put({
        key: SECURITY_COOLDOWN_KEY,
        value: { failedAttempts, cooldownUntil },
      });
      return;
    }
    await db.settings.delete(SECURITY_COOLDOWN_KEY);
  } catch (err) {
    logger.warn("[Journal]", "Password cooldown persistence failed:", err);
  }
}

function normalizeVaultKeySetting(value: unknown): JournalVaultKeySetting | null {
  if (!value || typeof value !== "object") return null;

  const candidate = value as Partial<JournalVaultKeySetting>;
  const createdAt = Number(candidate.createdAt);
  const updatedAt = Number(candidate.updatedAt);

  if (typeof candidate.wrappedKey !== "string" || candidate.wrappedKey.length === 0) return null;
  if (!Number.isFinite(createdAt) || !Number.isFinite(updatedAt)) return null;

  return {
    wrappedKey: candidate.wrappedKey,
    createdAt,
    updatedAt,
  };
}

async function createWrappedVaultKey(password: string): Promise<{
  vaultKey: string;
  setting: JournalVaultKeySetting;
}> {
  const now = Date.now();
  const vaultKey = generateJournalVaultKey();
  const wrappedKey = await wrapJournalVaultKey(vaultKey, password);

  return {
    vaultKey,
    setting: { wrappedKey, createdAt: now, updatedAt: now },
  };
}

async function createPasswordData(password: string, createdAt = Date.now()): Promise<JournalPassword> {
  const salt = crypto.getRandomValues(new Uint8Array(16));
  const hash = await deriveKey(password, salt.buffer);
  return {
    hash,
    salt: arrayBufferToBase64(salt.buffer),
    iterations: PBKDF2_ITERATIONS,
    createdAt,
  };
}

async function syncVaultKeySetting(
  vaultSetting: JournalVaultKeySetting,
  expectedOwnerUserId: string | null
): Promise<void> {
  if (!isCloudSyncEnabled() || !expectedOwnerUserId) return;
  try {
    await syncSetting(JOURNAL_VAULT_KEY_SETTING_KEY, vaultSetting, expectedOwnerUserId);
  } catch (err) {
    logger.warn("[Journal]", "Journal vault key sync failed:", err);
  }
}

async function writePasswordAndVaultKey(
  passwordData: JournalPassword,
  vaultSetting: JournalVaultKeySetting
): Promise<JournalVaultKeySetting> {
  const persist = async (): Promise<JournalVaultKeySetting> => {
    const revisionRecord = await db.settings.get(SK.JOURNAL_VAULT_REVISION);
    const previousRevision = Number(revisionRecord?.value);
    const nextRevision = Math.max(
      Number.isSafeInteger(previousRevision) ? previousRevision + 1 : 0,
      Math.max(0, Math.trunc(vaultSetting.updatedAt))
    );
    const persistedVaultSetting = { ...vaultSetting, updatedAt: nextRevision };
    await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: passwordData });
    await db.settings.put({
      key: JOURNAL_VAULT_KEY_SETTING_KEY,
      value: persistedVaultSetting,
    });
    await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: nextRevision });
    return persistedVaultSetting;
  };

  if (typeof db.transaction === "function") {
    return db.transaction("rw", db.settings, persist);
  }
  return persist();
}

async function writeVaultKeyWithMonotonicRevision(
  vaultSetting: JournalVaultKeySetting
): Promise<JournalVaultKeySetting> {
  const revisionRecord = await db.settings.get(SK.JOURNAL_VAULT_REVISION);
  const previousRevision = Number(revisionRecord?.value);
  const nextRevision = Math.max(
    Number.isSafeInteger(previousRevision) ? previousRevision + 1 : 0,
    Math.max(0, Math.trunc(vaultSetting.updatedAt))
  );
  const persistedVaultSetting = { ...vaultSetting, updatedAt: nextRevision };
  await db.settings.put({ key: JOURNAL_VAULT_KEY_SETTING_KEY, value: persistedVaultSetting });
  await db.settings.put({ key: SK.JOURNAL_VAULT_REVISION, value: nextRevision });
  return persistedVaultSetting;
}

function vaultRevisionMatchesMarker(
  vaultSetting: JournalVaultKeySetting | null,
  markerValue: unknown
): boolean {
  if (!vaultSetting) return true;
  const marker = Number(markerValue);
  return !Number.isSafeInteger(marker) || marker === vaultSetting.updatedAt;
}

async function prepareVaultKey(
  password: string,
  existing: JournalVaultKeySetting | null
): Promise<{
  vaultKey: string;
  vaultSetting: JournalVaultKeySetting;
  needsPersistence: boolean;
}> {
  if (existing) {
    return {
      vaultKey: await unwrapJournalVaultKey(existing.wrappedKey, password),
      vaultSetting: existing,
      needsPersistence: false,
    };
  }

  const { vaultKey, setting: vaultSetting } = await createWrappedVaultKey(password);
  return { vaultKey, vaultSetting, needsPersistence: true };
}

async function encryptExistingPlaintextJournalData(vaultKey: string): Promise<void> {
  await encryptPlaintextJournalEntries(vaultKey);
  await encryptPlaintextJournalDrafts(vaultKey);
  await encryptPlaintextJournalHubContent(vaultKey);
  await encryptPlaintextJournalMedia(vaultKey);
}

function journalPasswordMatches(value: unknown, expected: JournalPassword | null): boolean {
  if (!expected) return value == null;
  if (!value || typeof value !== "object") return false;
  const candidate = value as Partial<JournalPassword>;
  return (
    candidate.hash === expected.hash &&
    candidate.salt === expected.salt &&
    candidate.iterations === expected.iterations &&
    candidate.createdAt === expected.createdAt
  );
}

function journalVaultSettingMatches(
  value: unknown,
  expected: JournalVaultKeySetting | null
): boolean {
  const candidate = normalizeVaultKeySetting(value);
  if (!expected) return candidate === null;
  return Boolean(
    candidate &&
      candidate.wrappedKey === expected.wrappedKey &&
      candidate.createdAt === expected.createdAt &&
      candidate.updatedAt === expected.updatedAt
  );
}

async function assertJournalProtectionRecordsUnchanged(
  expectedPassword: JournalPassword | null,
  expectedVault: JournalVaultKeySetting | null
): Promise<void> {
  const [passwordEntry, vaultEntry] = await Promise.all([
    db.settings.get(JOURNAL_PASSWORD_KEY),
    db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
  ]);
  if (
    !journalPasswordMatches(passwordEntry?.value, expectedPassword) ||
    !journalVaultSettingMatches(vaultEntry?.value, expectedVault)
  ) {
    throw new Error("Diary protection changed during the operation");
  }
}

function clearJournalVaultSession(
  reason: JournalReplaceAuthorizationInvalidationReason = "manual-lock"
): void {
  clearJournalContentSession(reason);
}

function arrayBufferToBase64(buf: ArrayBuffer): string {
  const bytes = new Uint8Array(buf);
  let binary = "";
  for (let i = 0; i < bytes.length; i++) binary += String.fromCharCode(bytes[i]);
  return btoa(binary);
}

function base64ToArrayBuffer(b64: string): ArrayBuffer {
  const binary = atob(b64);
  const buf = new Uint8Array(binary.length);
  for (let i = 0; i < binary.length; i++) buf[i] = binary.charCodeAt(i);
  return buf.buffer;
}

async function deriveKey(
  password: string,
  salt: ArrayBuffer,
  iterations = PBKDF2_ITERATIONS
): Promise<string> {
  const enc = new TextEncoder();
  const keyMaterial = await crypto.subtle.importKey("raw", enc.encode(password), "PBKDF2", false, [
    "deriveBits",
  ]);
  const bits = await crypto.subtle.deriveBits(
    { name: "PBKDF2", salt, iterations, hash: "SHA-256" },
    keyMaterial,
    256
  );
  return arrayBufferToBase64(bits);
}

export function useJournalSecurity() {
  const [hasPassword, setHasPassword] = useState<boolean | null>(null); // null = loading
  const [isUnlocked, setIsUnlocked] = useState(false);
  const [vaultKey, setVaultKey] = useState<string | null>(null);
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [cooldownLoaded, setCooldownLoaded] = useState(false);
  const [securityLoadFailed, setSecurityLoadFailed] = useState(false);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const [cloudProtectionPending, setCloudProtectionPending] = useState(false);
  const [cloudProtectionPendingKind, setCloudProtectionPendingKind] =
    useState<JournalCloudProtectionPendingKind>(null);
  const unlockedAtRef = useRef(0);
  const unlockInFlightRef = useRef(false);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const securityLoadGenerationRef = useRef(0);

  const lockNow = useCallback(() => {
    if (!isUnlocked) {
      clearJournalVaultSession("background");
      setVaultKey(null);
      return;
    }
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
    setIsUnlocked(false);
    clearJournalVaultSession("background");
    setVaultKey(null);
    unlockedAtRef.current = 0;
  }, [isUnlocked]);

  const resetForAccountBoundary = useCallback(() => {
    securityLoadGenerationRef.current += 1;
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
    unlockInFlightRef.current = false;
    unlockedAtRef.current = 0;
    clearJournalVaultSession("sign-out");
    setHasPassword(null);
    setIsUnlocked(false);
    setVaultKey(null);
    setFailedAttempts(0);
    setCooldownUntil(0);
    setCooldownLoaded(false);
    setSecurityLoadFailed(false);
    setBiometricAvailable(false);
    setBiometricEnabledState(false);
    setCloudProtectionPending(false);
    setCloudProtectionPendingKind(null);
  }, []);

  const loadSecurityState = useCallback(async () => {
    const loadGeneration = securityLoadGenerationRef.current + 1;
    securityLoadGenerationRef.current = loadGeneration;
    const isCurrentLoad = () => securityLoadGenerationRef.current === loadGeneration;

    setHasPassword(null);
    setCooldownLoaded(false);
    setSecurityLoadFailed(false);

    const loadPassword = Promise.all([
      db.settings.get(JOURNAL_PASSWORD_KEY),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
    ])
      .then(([passwordEntry, vaultEntry]) => {
        if (!isCurrentLoad()) return;
        setHasPassword(Boolean(passwordEntry?.value || normalizeVaultKeySetting(vaultEntry?.value)));
      })
      .catch((err) => {
        logger.warn("[Journal]", "Password check failed", {
          name: err instanceof Error ? err.name : "UnknownError",
        });
        if (isCurrentLoad()) setSecurityLoadFailed(true);
      });

    const loadCooldown = db.settings
      .get(SECURITY_COOLDOWN_KEY)
      .then((entry) => {
        if (!isCurrentLoad()) return;
        setCooldownLoaded(true);
        const cooldown = normalizeCooldownState(entry?.value);
        if (!cooldown) {
          setFailedAttempts(0);
          setCooldownUntil(0);
          return;
        }
        setFailedAttempts(cooldown.failedAttempts);
        setCooldownUntil(cooldown.cooldownUntil > Date.now() ? cooldown.cooldownUntil : 0);
      })
      .catch((err) => {
        logger.warn("[Journal]", "Password cooldown load failed", {
          name: err instanceof Error ? err.name : "UnknownError",
        });
        if (isCurrentLoad()) setSecurityLoadFailed(true);
      });

    const loadBiometricSetting = db.settings
      .get(BIOMETRIC_SETTINGS_KEY)
      .then((entry) => {
        if (isCurrentLoad()) setBiometricEnabledState(Boolean(entry?.value));
      })
      .catch((err) => logger.warn("[Journal]", "Biometric setting load failed:", err));

    const loadBiometricAvailability = isNative
      ? import("@/plugins/BiometricPlugin")
          .then(({ default: BiometricAuth }) => BiometricAuth.isAvailable())
          .then((result) => {
            if (isCurrentLoad()) setBiometricAvailable(result.available);
          })
          .catch((err) => {
            logger.warn("[Journal]", "Biometric check failed:", err);
            if (isCurrentLoad()) setBiometricAvailable(false);
          })
      : Promise.resolve();

    await Promise.all([
      loadPassword,
      loadCooldown,
      loadBiometricSetting,
      loadBiometricAvailability,
    ]);
  }, []);

  useEffect(() => {
    const unregisterRuntimeReset = registerAccountBoundaryRuntimeReset(resetForAccountBoundary);
    const unsubscribeGeneration = subscribeOriginAccountBoundaryGeneration(() => {
      resetForAccountBoundary();
      void loadSecurityState();
    });
    return () => {
      unsubscribeGeneration();
      unregisterRuntimeReset();
    };
  }, [loadSecurityState, resetForAccountBoundary]);

  // Load password state + biometric
  useEffect(() => {
    void loadSecurityState();
    return () => {
      securityLoadGenerationRef.current += 1;
    };
  }, [loadSecurityState]);

  useEffect(() => {
    let active = true;
    const refreshMigrationState = async () => {
      try {
        const [intent, removalIntent] = await Promise.all([
          getJournalSecurityMigrationIntent(),
          getJournalSecurityRemovalIntent(),
        ]);
        if (active) {
          setCloudProtectionPending(Boolean(intent || removalIntent));
          setCloudProtectionPendingKind(
            removalIntent ? "removal" : intent ? "activation" : null,
          );
        }
        if (intent && (intent.status === "pending" || intent.status === "enqueue-failed")) {
          await ensureJournalSecurityMigrationQueued(intent);
        }
        if (
          removalIntent &&
          (removalIntent.status === "pending" || removalIntent.status === "enqueue-failed")
        ) {
          await ensureJournalSecurityRemovalQueued(removalIntent);
        }
      } catch (error) {
        logger.warn("[Journal]", "Diary protection migration remains pending:", error);
        if (active) {
          setCloudProtectionPending(true);
          setCloudProtectionPendingKind("unknown");
        }
      }
    };
    const handleMigrationUpdate = () => {
      void refreshMigrationState();
    };
    void refreshMigrationState();
    window.addEventListener(JOURNAL_SECURITY_MIGRATION_EVENT, handleMigrationUpdate);
    return () => {
      active = false;
      window.removeEventListener(JOURNAL_SECURITY_MIGRATION_EVENT, handleMigrationUpdate);
    };
  }, []);

  // Auto-lock timer (reads configurable timeout from localStorage)
  const resetAutoLock = useCallback(() => {
    if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    if (!isUnlocked) return;
    const timeoutMs = getAutoLockMs();
    if (timeoutMs === 0) return; // "Immediately" — lock via visibility change only
    // ROOT-CAUSE: setTimeout is the standard idle-lock pattern (Bitwarden/1Password use same approach)
    autoLockTimerRef.current = setTimeout(() => {
      setIsUnlocked(false);
      clearJournalVaultSession("background");
      setVaultKey(null);
      unlockedAtRef.current = 0;
    }, timeoutMs);
  }, [isUnlocked]);

  useEffect(() => {
    resetAutoLock();
    return () => {
      if (autoLockTimerRef.current) clearTimeout(autoLockTimerRef.current);
    };
  }, [resetAutoLock]);

  useEffect(() => {
    const handleAutoLockChange = () => resetAutoLock();
    const handleStorage = (event: StorageEvent) => {
      if (event.key !== SK.JOURNAL_LOCK_TIMEOUT && event.key !== null) return;
      if (event.newValue === null) {
        resetAutoLock();
        return;
      }
      try {
        const nextTimeout = JSON.parse(event.newValue) as unknown;
        if (!LOCK_TIMEOUT_OPTIONS.some((option) => option.ms === nextTimeout)) return;
        resetAutoLock();
      } catch {
        // Ignore malformed cross-tab values; the current validated timeout stays active.
      }
    };
    window.addEventListener(JOURNAL_AUTO_LOCK_CHANGE_EVENT, handleAutoLockChange);
    window.addEventListener("storage", handleStorage);
    return () => {
      window.removeEventListener(JOURNAL_AUTO_LOCK_CHANGE_EVENT, handleAutoLockChange);
      window.removeEventListener("storage", handleStorage);
    };
  }, [resetAutoLock]);

  useEffect(() => {
    if (!isUnlocked) return undefined;
    const handleActivity = () => resetAutoLock();
    document.addEventListener("pointerdown", handleActivity, { passive: true });
    document.addEventListener("keydown", handleActivity);
    document.addEventListener("touchstart", handleActivity, { passive: true });
    return () => {
      document.removeEventListener("pointerdown", handleActivity);
      document.removeEventListener("keydown", handleActivity);
      document.removeEventListener("touchstart", handleActivity);
    };
  }, [isUnlocked, resetAutoLock]);

  // Lock on visibility change (app background)
  useEffect(() => {
    const handleVisibility = () => {
      if (document.hidden) lockNow();
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [lockNow]);

  useEffect(() => {
    if (!isNative || !isUnlocked) return undefined;

    let cancelled = false;
    const removers: Array<() => void> = [];

    void import("@capacitor/app")
      .then(async ({ App }) => {
        const pauseListener = await App.addListener("pause", lockNow);
        const stateListener = await App.addListener("appStateChange", (state: { isActive?: boolean }) => {
          if (state?.isActive === false) lockNow();
        });
        const removeAll = () => {
          void pauseListener.remove();
          void stateListener.remove();
        };
        if (cancelled) removeAll();
        else removers.push(removeAll);
      })
      .catch((err) => logger.warn("[Journal]", "Native lock listener unavailable:", err));

    return () => {
      cancelled = true;
      removers.forEach((remove) => remove());
    };
  }, [isUnlocked, lockNow]);

  // Set password
  const setPassword = useCallback(
    async (password: string) => {
      const boundary = await captureJournalSecurityBoundary();
      const data = await createPasswordData(password);
      const { vaultKey: nextVaultKey, setting: vaultSetting } = await createWrappedVaultKey(password);
      const activation = await activateJournalPasswordProtection(
        {
          passwordData: data,
          vaultSetting,
          vaultKey: nextVaultKey,
        },
        boundary
      );
      await persistUnlockCooldown(0, 0);
      const vaultRevision = activation.vaultRevision ?? vaultSetting.updatedAt;
      setJournalContentVaultKey(nextVaultKey, vaultRevision);
      issueJournalReplaceAuthorization(vaultRevision);
      setCloudProtectionPending(activation.cloudMigrationPending);
      setCloudProtectionPendingKind(activation.cloudMigrationPending ? "activation" : null);
      setHasPassword(true);
      setIsUnlocked(true);
      setVaultKey(nextVaultKey);
      setFailedAttempts(0);
      setCooldownUntil(0);
      unlockedAtRef.current = Date.now();
      resetAutoLock();
    },
    [resetAutoLock]
  );

  // Unlock with password
  const unlock = useCallback(
    async (password: string): Promise<boolean> => {
      if (!cooldownLoaded || Date.now() < cooldownUntil || unlockInFlightRef.current) return false;
      unlockInFlightRef.current = true;

      try {
        const boundary = await captureJournalSecurityBoundary();
        const [entry, vaultEntry, revisionEntry] = await Promise.all([
          db.settings.get(JOURNAL_PASSWORD_KEY),
          db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
          db.settings.get(SK.JOURNAL_VAULT_REVISION),
        ]);
        const storedPassword = (entry?.value as JournalPassword | undefined) ?? null;
        const syncedVaultSetting = normalizeVaultKeySetting(vaultEntry?.value);
        if (!vaultRevisionMatchesMarker(syncedVaultSetting, revisionEntry?.value)) return false;
        const recordFailedUnlock = async () => {
          const newAttempts = failedAttempts + 1;
          const currentTime = Date.now();
          let nextCooldownUntil = 0;
          for (const step of COOLDOWN_STEPS) {
            if (newAttempts >= step.after) {
              nextCooldownUntil = currentTime + step.seconds * 1000;
            }
          }
          await runWithJournalSecurityBoundary(boundary, async () => {
            await assertJournalProtectionRecordsUnchanged(storedPassword, syncedVaultSetting);
            await persistUnlockCooldown(newAttempts, nextCooldownUntil);
          });
          setFailedAttempts(newAttempts);
          setCooldownUntil(nextCooldownUntil);
        };

        if (!storedPassword) {
          if (!syncedVaultSetting) return false;
          try {
            const unlockedVaultKey = await unwrapJournalVaultKey(syncedVaultSetting.wrappedKey, password);
            const restoredPassword = await createPasswordData(password);
            await runWithJournalSecurityBoundary(boundary, async () => {
              await assertJournalProtectionRecordsUnchanged(null, syncedVaultSetting);
              await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: restoredPassword });
              if (!Number.isSafeInteger(Number(revisionEntry?.value))) {
                await db.settings.put({
                  key: SK.JOURNAL_VAULT_REVISION,
                  value: syncedVaultSetting.updatedAt,
                });
              }
              await encryptExistingPlaintextJournalData(unlockedVaultKey);
              await persistUnlockCooldown(0, 0);
            });
            setJournalContentVaultKey(unlockedVaultKey, syncedVaultSetting.updatedAt);
            issueJournalReplaceAuthorization(syncedVaultSetting.updatedAt);
            setHasPassword(true);
            setIsUnlocked(true);
            setVaultKey(unlockedVaultKey);
            setFailedAttempts(0);
            setCooldownUntil(0);
            unlockedAtRef.current = Date.now();
            resetAutoLock();
            return true;
          } catch (err) {
            logger.warn("[Journal]", "Synced journal vault key unlock failed:", err);
            try {
              await recordFailedUnlock();
            } catch (boundaryError) {
              logger.warn("[Journal]", "Diary unlock account boundary changed:", boundaryError);
            }
            return false;
          }
        }

        const salt = base64ToArrayBuffer(storedPassword.salt);

        // Use stored iteration count (supports legacy 100K + current 600K)
        const iterationCount = storedPassword.iterations || _LEGACY_PBKDF2_ITERATIONS; // gitleaks:allow - numeric PBKDF2 metadata
        const hash = await deriveKey(password, salt, iterationCount);

        if (hash === storedPassword.hash) {
          // Transparent migration: re-hash with current iterations if needed
          let migratedPassword: JournalPassword | null = null;
          if (iterationCount < PBKDF2_ITERATIONS) {
            const newSalt = crypto.getRandomValues(new Uint8Array(16));
            const newHash = await deriveKey(password, newSalt.buffer, PBKDF2_ITERATIONS);
            migratedPassword = {
              hash: newHash,
              salt: arrayBufferToBase64(newSalt.buffer),
              iterations: PBKDF2_ITERATIONS,
              createdAt: storedPassword.createdAt,
            };
          }

          let preparedVault: Awaited<ReturnType<typeof prepareVaultKey>>;
          try {
            preparedVault = await prepareVaultKey(password, syncedVaultSetting);
          } catch (err) {
            logger.warn("[Journal]", "Journal vault key unlock failed:", err);
            return false;
          }

          await runWithJournalSecurityBoundary(boundary, async () => {
            await assertJournalProtectionRecordsUnchanged(storedPassword, syncedVaultSetting);
            if (migratedPassword) {
              await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: migratedPassword });
            }
            if (preparedVault.needsPersistence) {
              preparedVault.vaultSetting = await writeVaultKeyWithMonotonicRevision(
                preparedVault.vaultSetting
              );
              await syncVaultKeySetting(
                preparedVault.vaultSetting,
                boundary.sessionOwnerUserId
              );
            } else if (!Number.isSafeInteger(Number(revisionEntry?.value))) {
              await db.settings.put({
                key: SK.JOURNAL_VAULT_REVISION,
                value: preparedVault.vaultSetting.updatedAt,
              });
            }
            await encryptExistingPlaintextJournalData(preparedVault.vaultKey);
            await persistUnlockCooldown(0, 0);
          });
          if (migratedPassword) {
            logger.log("[Journal]", "Password hash migrated to current iterations");
          }
          setJournalContentVaultKey(
            preparedVault.vaultKey,
            preparedVault.vaultSetting.updatedAt
          );
          issueJournalReplaceAuthorization(preparedVault.vaultSetting.updatedAt);
          setIsUnlocked(true);
          setVaultKey(preparedVault.vaultKey);
          setFailedAttempts(0);
          setCooldownUntil(0);
          unlockedAtRef.current = Date.now();
          resetAutoLock();
          return true;
        }

        await recordFailedUnlock();
        return false;
      } catch (err) {
        logger.warn("[Journal]", "Journal unlock failed:", err);
        return false;
      } finally {
        unlockInFlightRef.current = false;
      }
    },
    [failedAttempts, cooldownUntil, cooldownLoaded, resetAutoLock]
  );

  // Change password atomically where Dexie transactions are available.
  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      try {
        const boundary = await captureJournalSecurityBoundary();
        if (await getJournalSecurityMigrationIntent()) {
          logger.warn("[Journal]", "Wait for diary protection migration before changing password");
          return false;
        }
        const entry = await db.settings.get(JOURNAL_PASSWORD_KEY);
        if (!entry?.value) return false;
        const stored = entry.value as JournalPassword;
        const oldSalt = base64ToArrayBuffer(stored.salt);
        const iterationCount = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
        const oldHash = await deriveKey(oldPw, oldSalt, iterationCount);
        if (oldHash !== stored.hash) return false;

        const [vaultEntry, revisionEntry] = await Promise.all([
          db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
          db.settings.get(SK.JOURNAL_VAULT_REVISION),
        ]);
        const existingVaultSetting = normalizeVaultKeySetting(vaultEntry?.value);
        if (!vaultRevisionMatchesMarker(existingVaultSetting, revisionEntry?.value)) return false;
        let nextVaultKey: string;
        let nextVaultSetting: JournalVaultKeySetting;

        if (existingVaultSetting) {
          nextVaultKey = await unwrapJournalVaultKey(existingVaultSetting.wrappedKey, oldPw);
          const wrappedKey = await rewrapJournalVaultKey(existingVaultSetting.wrappedKey, oldPw, newPw);
          nextVaultSetting = {
            wrappedKey,
            createdAt: existingVaultSetting.createdAt,
            updatedAt: Date.now(),
          };
        } else {
          const created = await createWrappedVaultKey(newPw);
          nextVaultKey = created.vaultKey;
          nextVaultSetting = created.setting;
        }

        const newSalt = crypto.getRandomValues(new Uint8Array(16));
        const newHash = await deriveKey(newPw, newSalt.buffer);
        const newData: JournalPassword = {
          hash: newHash,
          salt: arrayBufferToBase64(newSalt.buffer),
          iterations: PBKDF2_ITERATIONS,
          createdAt: Date.now(),
        };

        await runWithJournalSecurityBoundary(boundary, async () => {
          if (await getJournalSecurityMigrationIntent()) {
            throw new Error("Diary protection migration changed during password update");
          }
          await assertJournalProtectionRecordsUnchanged(stored, existingVaultSetting);
          nextVaultSetting = await writePasswordAndVaultKey(newData, nextVaultSetting);
          await syncVaultKeySetting(nextVaultSetting, boundary.sessionOwnerUserId);
        });
        setJournalContentVaultKey(nextVaultKey, nextVaultSetting.updatedAt);
        issueJournalReplaceAuthorization(nextVaultSetting.updatedAt);
        setVaultKey(nextVaultKey);
        resetAutoLock();
        return true;
      } catch (err) {
        logger.warn("[Journal]", "Journal password change failed:", err);
        return false;
      }
    },
    [resetAutoLock]
  );

  // Remove password (entries stay, lock removed)
  const removePassword = useCallback(
    async (options: RemoveJournalPasswordOptions = {}) => {
      const boundary = await captureJournalSecurityBoundary();
      let nativeBiometricsRemoved = false;
      try {
        let activeVaultKey: string | null;
        try {
          activeVaultKey = await runWithJournalSecurityBoundary(boundary, () =>
            getJournalVaultKeyForWrite()
          );
        } catch (error) {
          if (error instanceof JournalWriteLockedError) {
            if (!options.allowVerifiedEmptyDiary) {
              throw new JournalRemovePasswordLockedError();
            }
            activeVaultKey = null;
          } else {
            throw error;
          }
        }
        nativeBiometricsRemoved =
          (await clearNativeJournalBiometricCredential()) === "removed";
        await assertJournalSecurityBoundary(boundary);
        const removal = await removeJournalPasswordProtectionAtomically(
          activeVaultKey ?? vaultKey,
          boundary
        );

        setHasPassword(false);
        setIsUnlocked(false);
        notifyJournalProtectionRemoved();
        setVaultKey(null);
        setBiometricEnabledState(false);
        setFailedAttempts(0);
        setCooldownUntil(0);
        setCloudProtectionPending(removal.cloudMigrationPending);
        setCloudProtectionPendingKind(removal.cloudMigrationPending ? "removal" : null);
        if (removal.cloudMigrationPending) {
          try {
            await ensureJournalSecurityRemovalQueued();
          } catch (queueError) {
            logger.warn(
              "[Journal]",
              "Diary protection removal remains pending for online completion:",
              queueError
            );
          }
        }
      } catch (err) {
        if (nativeBiometricsRemoved) {
          try {
            await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
          } catch (persistError) {
            logger.warn("[Journal]", "Biometric cleanup state persistence failed:", persistError);
          }
          setBiometricEnabledState(false);
        }
        throw nativeBiometricsRemoved ? new JournalRemovePasswordPartialError(err) : err;
      }
    },
    [vaultKey]
  );

  // Manual lock
  const lock = useCallback(() => {
    setIsUnlocked(false);
    clearJournalVaultSession();
    setVaultKey(null);
    unlockedAtRef.current = 0;
  }, []);

  // Touch to reset auto-lock timer
  const touch = useCallback(() => {
    if (isUnlocked) resetAutoLock();
  }, [isUnlocked, resetAutoLock]);

  // Biometric unlock
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!cooldownLoaded || !biometricAvailable || !biometricEnabled) return false;
    try {
      const boundary = await captureJournalSecurityBoundary();
      const [passwordEntry, vaultEntry, revisionEntry] = await Promise.all([
        db.settings.get(JOURNAL_PASSWORD_KEY),
        db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
        db.settings.get(SK.JOURNAL_VAULT_REVISION),
      ]);
      const expectedPassword =
        (passwordEntry?.value as JournalPassword | undefined) ?? null;
      const vaultSetting = normalizeVaultKeySetting(vaultEntry?.value);
      if (!vaultSetting || !vaultRevisionMatchesMarker(vaultSetting, revisionEntry?.value)) {
        return false;
      }
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.authenticate({ reason: "Unlock your journal" });
      if (!result.success || !result.secret) {
        if (result.success) logger.warn("[Journal]", "Biometric unlock returned no journal vault key");
        return false;
      }

      await runWithJournalSecurityBoundary(boundary, async () => {
        await assertJournalProtectionRecordsUnchanged(expectedPassword, vaultSetting);
        await encryptExistingPlaintextJournalData(result.secret!);
        await persistUnlockCooldown(0, 0);
      });
      setJournalContentVaultKey(result.secret, vaultSetting.updatedAt);
      issueJournalReplaceAuthorization(vaultSetting.updatedAt);
      setIsUnlocked(true);
      setVaultKey(result.secret);
      setFailedAttempts(0);
      setCooldownUntil(0);
      unlockedAtRef.current = Date.now();
      resetAutoLock();
      return true;
    } catch (err) {
      logger.warn("[Journal]", "Biometric unlock failed:", err);
    }
    return false;
  }, [biometricAvailable, biometricEnabled, cooldownLoaded, resetAutoLock]);

  const setBiometricEnabled = useCallback(async (value: boolean): Promise<boolean> => {
    if (!value) {
      try {
        await clearNativeJournalBiometricCredential();
        setBiometricEnabledState(false);
        await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
        return true;
      } catch (err) {
        logger.warn("[Journal]", "Biometric unenrollment failed:", err);
        return false;
      }
    }

    if (!biometricAvailable || !hasPassword || !vaultKey) {
      if (hasPassword && !vaultKey) {
        logger.warn("[Journal]", "Cannot enable biometric unlock without an unlocked journal vault key");
      }
      setBiometricEnabledState(false);
      await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
      return false;
    }

    try {
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.enroll({
        reason: "Enable biometric diary unlock",
        secret: vaultKey,
      });
      if (!result.success) {
        setBiometricEnabledState(false);
        await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
        return false;
      }

      setBiometricEnabledState(true);
      await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: true });
      return true;
    } catch (err) {
      logger.warn("[Journal]", "Biometric enrollment failed:", err);
      setBiometricEnabledState(false);
      await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
      return false;
    }
  }, [biometricAvailable, hasPassword, vaultKey]);

  // Cooldown remaining in seconds
  const cooldownRemaining =
    cooldownUntil > Date.now() ? Math.ceil((cooldownUntil - Date.now()) / 1000) : 0;

  return {
    hasPassword,
    isUnlocked,
    isLocked: securityLoadFailed || (hasPassword === true && !isUnlocked),
    loading: !securityLoadFailed && (hasPassword === null || !cooldownLoaded),
    loadError: securityLoadFailed,
    vaultKey,
    failedAttempts,
    cooldownRemaining,
    biometricAvailable,
    biometricEnabled,
    cloudProtectionPending,
    cloudProtectionPendingKind,
    setPassword,
    changePassword,
    unlock,
    unlockWithBiometric,
    setBiometricEnabled,
    removePassword,
    lock,
    touch,
    retryLoad: loadSecurityState,
  };
}
