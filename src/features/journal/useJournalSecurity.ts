import { useState, useEffect, useCallback, useRef } from "react";
import { isNative } from "@/lib/platform";
import { db } from "@/storage/db";
import { SK } from "@/lib/storageKeys";
import { safeLocalStorageGet, safeLocalStorageSet } from "@/lib/safeJson";
import type { JournalPassword } from "./types";
import { JOURNAL_PASSWORD_KEY } from "./types";
import { logger } from "@/lib/logger";

const BIOMETRIC_SETTINGS_KEY = "journal_biometric";

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
  const [failedAttempts, setFailedAttempts] = useState(0);
  const [cooldownUntil, setCooldownUntil] = useState(0);
  const [biometricAvailable, setBiometricAvailable] = useState(false);
  const [biometricEnabled, setBiometricEnabledState] = useState(false);
  const unlockedAtRef = useRef(0);
  const autoLockTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Load password state + biometric
  useEffect(() => {
    db.settings
      .get(JOURNAL_PASSWORD_KEY)
      .then((entry) => {
        setHasPassword(!!entry?.value);
      })
      .catch((err) => {
        logger.warn("[Journal]", "Password check failed:", err);
        setHasPassword(false);
      });

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
      if (document.hidden && isUnlocked) {
        setIsUnlocked(false);
        unlockedAtRef.current = 0;
      }
    };
    document.addEventListener("visibilitychange", handleVisibility);
    return () => document.removeEventListener("visibilitychange", handleVisibility);
  }, [isUnlocked]);

  // Set password
  const setPassword = useCallback(
    async (password: string) => {
      const salt = crypto.getRandomValues(new Uint8Array(16));
      const hash = await deriveKey(password, salt.buffer);
      const data: JournalPassword = {
        hash,
        salt: arrayBufferToBase64(salt.buffer),
        iterations: PBKDF2_ITERATIONS,
        createdAt: Date.now(),
      };
      await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: data });
      setHasPassword(true);
      setIsUnlocked(true);
      unlockedAtRef.current = Date.now();
      resetAutoLock();
    },
    [resetAutoLock]
  );

  // Unlock with password
  const unlock = useCallback(
    async (password: string): Promise<boolean> => {
      if (Date.now() < cooldownUntil) return false;

      const entry = await db.settings.get(JOURNAL_PASSWORD_KEY);
      if (!entry?.value) return false;
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
          logger.info("[Journal]", "Password hash migrated to current iterations");
        }
        setIsUnlocked(true);
        setFailedAttempts(0);
        setCooldownUntil(0);
        unlockedAtRef.current = Date.now();
        resetAutoLock();
        return true;
      }

      const newAttempts = failedAttempts + 1;
      setFailedAttempts(newAttempts);
      for (const step of COOLDOWN_STEPS) {
        if (newAttempts >= step.after) {
          setCooldownUntil(Date.now() + step.seconds * 1000);
        }
      }
      return false;
    },
    [failedAttempts, cooldownUntil, resetAutoLock]
  );

  // Change password atomically (verify old, then write new in single put)
  const changePassword = useCallback(
    async (oldPw: string, newPw: string): Promise<boolean> => {
      const entry = await db.settings.get(JOURNAL_PASSWORD_KEY);
      if (!entry?.value) return false;
      const stored = entry.value as JournalPassword;
      const oldSalt = base64ToArrayBuffer(stored.salt);
      const storedIterations = stored.iterations || _LEGACY_PBKDF2_ITERATIONS;
      const oldHash = await deriveKey(oldPw, oldSalt, storedIterations);
      if (oldHash !== stored.hash) return false;

      // Old password verified — atomic write with fresh salt
      const newSalt = crypto.getRandomValues(new Uint8Array(16));
      const newHash = await deriveKey(newPw, newSalt.buffer);
      const newData: JournalPassword = {
        hash: newHash,
        salt: arrayBufferToBase64(newSalt.buffer),
        iterations: PBKDF2_ITERATIONS,
        createdAt: Date.now(),
      };
      await db.settings.put({ key: JOURNAL_PASSWORD_KEY, value: newData });
      resetAutoLock();
      return true;
    },
    [resetAutoLock]
  );

  // Remove password (entries stay, lock removed)
  const removePassword = useCallback(async () => {
    await db.settings.delete(JOURNAL_PASSWORD_KEY);
    setHasPassword(false);
    setIsUnlocked(false);
    setFailedAttempts(0);
    setCooldownUntil(0);
  }, []);

  // Manual lock
  const lock = useCallback(() => {
    setIsUnlocked(false);
    unlockedAtRef.current = 0;
  }, []);

  // Touch to reset auto-lock timer
  const touch = useCallback(() => {
    if (isUnlocked) resetAutoLock();
  }, [isUnlocked, resetAutoLock]);

  // Biometric unlock
  const unlockWithBiometric = useCallback(async (): Promise<boolean> => {
    if (!biometricAvailable || !biometricEnabled) return false;
    try {
      const { default: BiometricAuth } = await import("@/plugins/BiometricPlugin");
      const result = await BiometricAuth.authenticate({ reason: "Unlock your journal" });
      if (result.success) {
        setIsUnlocked(true);
        setFailedAttempts(0);
        setCooldownUntil(0);
        unlockedAtRef.current = Date.now();
        resetAutoLock();
        return true;
      }
    } catch {
      // Biometric failed — fall back to password
    }
    return false;
  }, [biometricAvailable, biometricEnabled, resetAutoLock]);

  const setBiometricEnabled = useCallback(async (value: boolean) => {
    setBiometricEnabledState(value);
    await db.settings.put({ key: BIOMETRIC_SETTINGS_KEY, value });
  }, []);

  // Cooldown remaining in seconds
  const cooldownRemaining =
    cooldownUntil > Date.now() ? Math.ceil((cooldownUntil - Date.now()) / 1000) : 0;

  return {
    hasPassword,
    isUnlocked,
    isLocked: hasPassword === true && !isUnlocked,
    loading: hasPassword === null,
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
