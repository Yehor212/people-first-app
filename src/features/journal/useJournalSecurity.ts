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
import { setJournalContentVaultKey } from "./journalContentSession";
import {
  decryptEncryptedJournalEntries,
  decryptEncryptedJournalMedia,
  encryptPlaintextJournalEntries,
  encryptPlaintextJournalMedia,
  hasEncryptedJournalContent,
  hasEncryptedJournalMedia,
} from "./journalStorage";
import { logger } from "@/lib/logger";
import { isCloudSyncEnabled } from "@/lib/cloudSyncSettings";
import { deleteSettingFromCloud, syncSetting } from "@/storage/sync/syncSettings";

const BIOMETRIC_SETTINGS_KEY = SK.JOURNAL_BIOMETRIC;
const SECURITY_COOLDOWN_KEY = SK.JOURNAL_PASSWORD_COOLDOWN;

type JournalUnlockCooldown = {
  failedAttempts: number;
  cooldownUntil: number;
};

const PBKDF2_ITERATIONS = 600_000;
const _LEGACY_PBKDF2_ITERATIONS = 100_000; // For future transparent migration
const DEFAULT_AUTO_LOCK_MS = 5 * 60 * 1000; // 5 minutes
export const LOCK_TIMEOUT_OPTIONS = [
  { label: "Immediately", ms: 0 },
  { label: "1 minute", ms: 60_000 },
  { label: "5 minutes", ms: 300_000 },
  { label: "15 minutes", ms: 900_000 },
  { label: "30 minutes", ms: 1_800_000 },
] as const;
function getAutoLockMs(): number {
  const stored = safeLocalStorageGet<number | null>(SK.JOURNAL_LOCK_TIMEOUT, null);
  return stored !== null ? stored : DEFAULT_AUTO_LOCK_MS;
}

export function setAutoLockMs(ms: number): void {
  safeLocalStorageSet(SK.JOURNAL_LOCK_TIMEOUT, ms);
}
const COOLDOWN_STEPS = [
  { after: 3, seconds: 30 },
  { after: 5, seconds: 300 },
];

async function unenrollNativeBiometrics(): Promise<boolean> {
  if (!isNative) return false;
  const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
  const result = await BiometricAuth.unenroll();
  if (!result?.success) {
    throw new Error(result?.error || "Biometric credential cleanup failed.");
  }
  return true;
}

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

async function syncVaultKeySetting(vaultSetting: JournalVaultKeySetting): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  try {
    await syncSetting(JOURNAL_VAULT_KEY_SETTING_KEY, vaultSetting);
  } catch (err) {
    logger.warn("[Journal]", "Journal vault key sync failed:", err);
  }
}

async function deleteSyncedVaultKeySetting(): Promise<void> {
  if (!isCloudSyncEnabled()) return;
  await deleteSettingFromCloud(JOURNAL_VAULT_KEY_SETTING_KEY);
}

async function restoreSyncedVaultKeySetting(vaultSetting: JournalVaultKeySetting | null): Promise<void> {
  if (!vaultSetting || !isCloudSyncEnabled()) return;
  await syncSetting(JOURNAL_VAULT_KEY_SETTING_KEY, vaultSetting);
}

async function writePasswordAndVaultKey(
  passwordData: JournalPassword,
  vaultSetting: JournalVaultKeySetting,
): Promise<void> {
  if (typeof db.transaction === "function") {
    await db.transaction("rw", db.settings, async () => {
      await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: passwordData });
      await db.settings.put({ key: JOURNAL_VAULT_KEY_SETTING_KEY, value: vaultSetting });
    });
    return;
  }

  await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: passwordData });
  await db.settings.put({ key: JOURNAL_VAULT_KEY_SETTING_KEY, value: vaultSetting });
}

async function deletePasswordAndVaultKey(): Promise<void> {
  if (typeof db.transaction === "function") {
    await db.transaction("rw", db.settings, async () => {
      await db.settings.delete(JOURNAL_PASSWORD_KEY);
      await db.settings.delete(JOURNAL_VAULT_KEY_SETTING_KEY);
    });
    return;
  }

  await db.settings.delete(JOURNAL_PASSWORD_KEY);
  await db.settings.delete(JOURNAL_VAULT_KEY_SETTING_KEY);
}

async function restorePasswordAndVaultKey(
  passwordData: JournalPassword | null,
  vaultSetting: JournalVaultKeySetting | null,
): Promise<void> {
  if (!passwordData || !vaultSetting) return;
  await writePasswordAndVaultKey(passwordData, vaultSetting);
}

async function loadOrCreateVaultKey(password: string): Promise<string> {
  const entry = await db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY);
  const existing = normalizeVaultKeySetting(entry?.value);

  if (existing) {
    return unwrapJournalVaultKey(existing.wrappedKey, password);
  }

  const { vaultKey, setting } = await createWrappedVaultKey(password);
  await db.settings.put({ key: JOURNAL_VAULT_KEY_SETTING_KEY, value: setting });
  await syncVaultKeySetting(setting);
  return vaultKey;
}

async function encryptExistingPlaintextEntries(vaultKey: string): Promise<void> {
  setJournalContentVaultKey(vaultKey);
  await encryptPlaintextJournalEntries(vaultKey);
  await encryptPlaintextJournalMedia(vaultKey);
}

function clearJournalVaultSession(): void {
  setJournalContentVaultKey(null);
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
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const unlockedAtRef = useRef(0);
  const unlockInFlightRef = useRef(false);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  const lockNow = useCallback(() => {
    if (!isUnlocked) {
      clearJournalVaultSession();
      setVaultKey(null);
      return;
    }
    if (autoLockTimerRef.current) {
      clearTimeout(autoLockTimerRef.current);
      autoLockTimerRef.current = null;
    }
    setIsUnlocked(false);
    clearJournalVaultSession();
    setVaultKey(null);
    unlockedAtRef.current = 0;
  }, [isUnlocked]);

  // Load password state + biometric
  useEffect(() => {
    Promise.all([
      db.settings.get(JOURNAL_PASSWORD_KEY),
      db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
    ])
      .then(([passwordEntry, vaultEntry]) => {
        setHasPassword(Boolean(passwordEntry?.value || normalizeVaultKeySetting(vaultEntry?.value)));
      })
      .catch((err) => {
        logger.warn("[Journal]", "Password check failed:", err);
        setHasPassword(false);
      });

    db.settings
      .get(SECURITY_COOLDOWN_KEY)
      .then((entry) => {
        const cooldown = normalizeCooldownState(entry?.value);
        if (!cooldown) return;
        setFailedAttempts(cooldown.failedAttempts);
        setCooldownUntil(cooldown.cooldownUntil > Date.now() ? cooldown.cooldownUntil : 0);
      })
      .catch((err) => logger.warn("[Journal]", "Password cooldown load failed:", err))
      .finally(() => setCooldownLoaded(true));

    // Check biometric availability
    if (isNative) {
      import("@/plugins/BiometricPlugin")
        .then(({ default: BiometricAuth }) => {
          BiometricAuth.isAvailable()
            .then((result) => {
              setBiometricAvailable(result.available);
            })
            .catch((err) => {
              logger.warn("[Journal]", "Biometric check failed:", err);
              setBiometricAvailable(false);
            });
        })
        .catch((err) => {
          logger.warn("[Journal]", "Biometric plugin load failed:", err);
          setBiometricAvailable(false);
        });
    }

    // Load biometric setting
    db.settings
      .get(BIOMETRIC_SETTINGS_KEY)
      .then((entry) => {
        if (entry?.value) setBiometricEnabledState(true);
      })
      .catch((err) => logger.warn("[Journal]", "Biometric setting load failed:", err));
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
      clearJournalVaultSession();
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
      const data = await createPasswordData(password);
      const { vaultKey: nextVaultKey, setting: vaultSetting } = await createWrappedVaultKey(password);
      await writePasswordAndVaultKey(data, vaultSetting);
      await syncVaultKeySetting(vaultSetting);
      await encryptExistingPlaintextEntries(nextVaultKey);
      await persistUnlockCooldown(0, 0);
      setJournalContentVaultKey(nextVaultKey);
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

      const recordFailedUnlock = async () => {
        const newAttempts = failedAttempts + 1;
        const now = Date.now();
        let nextCooldownUntil = 0;
        for (const step of COOLDOWN_STEPS) {
          if (newAttempts >= step.after) {
            nextCooldownUntil = now + step.seconds * 1000;
          }
        }
        setFailedAttempts(newAttempts);
        setCooldownUntil(nextCooldownUntil);
        await persistUnlockCooldown(newAttempts, nextCooldownUntil);
      };

      try {
        const [entry, vaultEntry] = await Promise.all([
          db.settings.get(JOURNAL_PASSWORD_KEY),
          db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY),
        ]);
        const syncedVaultSetting = normalizeVaultKeySetting(vaultEntry?.value);

        if (!entry?.value) {
          if (!syncedVaultSetting) return false;
          try {
            const unlockedVaultKey = await unwrapJournalVaultKey(syncedVaultSetting.wrappedKey, password);
            await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: await createPasswordData(password) });
            await encryptExistingPlaintextEntries(unlockedVaultKey);
            await persistUnlockCooldown(0, 0);
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
            await recordFailedUnlock();
            return false;
          }
        }

        const stored = entry.value as JournalPassword;
        const salt = base64ToArrayBuffer(stored.salt);

        // Use stored iteration count (supports legacy 100K + current 600K)
        const storedIterations = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
        const hash = await deriveKey(password, salt, storedIterations);

        if (hash === stored.hash) {
          // Transparent migration: re-hash with current iterations if needed
          if (storedIterations < PBKDF2_ITERATIONS) {
            const newSalt = crypto.getRandomValues(new Uint8Array(16));
            const newHash = await deriveKey(password, newSalt.buffer, PBKDF2_ITERATIONS);
            const migrated: JournalPassword = {
              hash: newHash,
              salt: arrayBufferToBase64(newSalt.buffer),
              iterations: PBKDF2_ITERATIONS,
              createdAt: stored.createdAt,
            };
            await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: migrated });
            logger.log("[Journal]", "Password hash migrated to current iterations");
          }
          let unlockedVaultKey: string;
          try {
            unlockedVaultKey = await loadOrCreateVaultKey(password);
          } catch (err) {
            logger.warn("[Journal]", "Journal vault key unlock failed:", err);
            return false;
          }

          await encryptExistingPlaintextEntries(unlockedVaultKey);
          await persistUnlockCooldown(0, 0);
          setIsUnlocked(true);
          setVaultKey(unlockedVaultKey);
          setFailedAttempts(0);
          setCooldownUntil(0);
          unlockedAtRef.current = Date.now();
          resetAutoLock();
          return true;
        }

        await recordFailedUnlock();
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
        const entry = await db.settings.get(JOURNAL_PASSWORD_KEY);
        if (!entry?.value) return false;
        const stored = entry.value as JournalPassword;
        const oldSalt = base64ToArrayBuffer(stored.salt);
        const storedIterations = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
        const oldHash = await deriveKey(oldPw, oldSalt, storedIterations);
        if (oldHash !== stored.hash) return false;

        const vaultEntry = await db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY);
        const existingVaultSetting = normalizeVaultKeySetting(vaultEntry?.value);
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

        await writePasswordAndVaultKey(newData, nextVaultSetting);
        await syncVaultKeySetting(nextVaultSetting);
        setJournalContentVaultKey(nextVaultKey);
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
  const removePassword = useCallback(async () => {
    let nativeBiometricsRemoved = false;
    let passwordDataForRestore: JournalPassword | null = null;
    let vaultSettingForRestore: JournalVaultKeySetting | null = null;

    try {
      if (!vaultKey && ((await hasEncryptedJournalContent()) || (await hasEncryptedJournalMedia()))) {
        logger.warn("[Journal]", "Cannot remove diary password while encrypted content is locked");
        throw new Error("Unlock your diary before removing password protection.");
      }

      const passwordEntry = await db.settings.get(JOURNAL_PASSWORD_KEY);
      const vaultEntry = await db.settings.get(JOURNAL_VAULT_KEY_SETTING_KEY);
      passwordDataForRestore = (passwordEntry?.value as JournalPassword | undefined) ?? null;
      vaultSettingForRestore = normalizeVaultKeySetting(vaultEntry?.value);

      nativeBiometricsRemoved = await unenrollNativeBiometrics();

      await deleteSyncedVaultKeySetting();

      try {
        await deletePasswordAndVaultKey();
      } catch (localDeleteError) {
        try {
          await restoreSyncedVaultKeySetting(vaultSettingForRestore);
        } catch (restoreError) {
          logger.warn("[Journal]", "Journal vault key restore after failed local password removal failed:", restoreError);
        }
        throw localDeleteError;
      }

      if (vaultKey) {
        try {
          await decryptEncryptedJournalEntries(vaultKey);
          await decryptEncryptedJournalMedia(vaultKey);
        } catch (decryptError) {
          try {
            await encryptPlaintextJournalEntries(vaultKey);
            await encryptPlaintextJournalMedia(vaultKey);
            await restorePasswordAndVaultKey(passwordDataForRestore, vaultSettingForRestore);
            await restoreSyncedVaultKeySetting(vaultSettingForRestore);
          } catch (restoreError) {
            logger.warn("[Journal]", "Journal lock restore after failed password removal failed:", restoreError);
          }
          throw decryptError;
        }
      }

      await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
      await persistUnlockCooldown(0, 0);
      setHasPassword(false);
      setIsUnlocked(false);
      clearJournalVaultSession();
      setVaultKey(null);
      setBiometricEnabledState(false);
      setFailedAttempts(0);
      setCooldownUntil(0);
    } catch (err) {
      if (nativeBiometricsRemoved) {
        try {
          await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value: false });
        } catch (persistError) {
          logger.warn("[Journal]", "Biometric cleanup state persistence failed:", persistError);
        }
        setBiometricEnabledState(false);
      }
      throw err;
    }
  }, [vaultKey]);

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
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.authenticate({ reason: "Unlock your journal" });
      if (!result.success || !result.secret) {
        if (result.success) logger.warn("[Journal]", "Biometric unlock returned no journal vault key");
        return false;
      }

      await encryptExistingPlaintextEntries(result.secret);
      await persistUnlockCooldown(0, 0);
      setJournalContentVaultKey(result.secret);
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
        await unenrollNativeBiometrics();
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
    isLocked: hasPassword === true && !isUnlocked,
    loading: hasPassword === null || !cooldownLoaded,
    vaultKey,
    failedAttempts,
    cooldownRemaining,
    biometricAvailable,
    biometricEnabled,
    setPassword,
    changePassword,
    unlock,
    unlockWithBiometric,
    setBiometricEnabled,
    removePassword,
    lock,
    touch,
  };
}
