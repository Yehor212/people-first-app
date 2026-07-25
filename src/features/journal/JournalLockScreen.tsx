import { useState, useEffect, useRef } from "react";
import { Lock, Eye, EyeOff, AlertTriangle, Fingerprint } from "lucide-react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { formatJournalDuration } from "./journalDateUtils";

/** Constant-time string comparison to prevent timing attacks (CWE-208) */
function timingSafeEqual(a: string, b: string): boolean {
  const lenMatch = a.length === b.length;
  const target = lenMatch ? b : a;
  let mismatch = lenMatch ? 0 : 1;
  for (let i = 0; i < a.length; i++) {
    mismatch |= a.charCodeAt(i) ^ target.charCodeAt(i);
  }
  return mismatch === 0;
}

interface JournalLockScreenProps {
  mode: "setup" | "unlock" | "change";
  cooldownRemaining: number;
  failedAttempts: number;
  onUnlock: (password: string) => Promise<boolean>;
  onSetPassword: (password: string) => Promise<void>;
  onChangePassword?: (oldPw: string, newPw: string) => Promise<boolean>;
  onForgotPassword?: () => void;
  onBiometricUnlock?: () => Promise<boolean>;
  biometricAvailable?: boolean;
  emailLockRemovalAvailable?: boolean;
}

export function JournalLockScreen({
  mode,
  cooldownRemaining,
  failedAttempts: _failedAttempts,
  onUnlock,
  onSetPassword,
  onChangePassword,
  onForgotPassword,
  onBiometricUnlock,
  biometricAvailable,
  emailLockRemovalAvailable = true,
}: JournalLockScreenProps) {
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const [password, setPassword] = useState("");
  const [confirm, setConfirm] = useState("");
  const [currentPassword, setCurrentPassword] = useState("");
  const [showPassword, setShowPassword] = useState(false);
  const [error, setError] = useState("");
  const [shake, setShake] = useState(false);
  const [wrongGlow, setWrongGlow] = useState(false);
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [step, setStep] = useState<"current" | "enter" | "confirm">(
    mode === "change" ? "current" : "enter"
  );
  const inputRef = useRef<HTMLInputElement | null>(null);
  const submitInFlightRef = useRef(false);
  const shakeTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const glowTimeoutRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const passwordAutoComplete = mode === "unlock" || step === "current" ? "current-password" : "new-password";
  const passwordInputLabel =
    step === "current"
      ? ts.journalPasswordOldEnter || "Current password"
      : step === "confirm"
        ? ts.journalPasswordConfirm || "Confirm password"
        : mode === "change"
          ? ts.journalPasswordNewEnter || "New password"
          : ts.journalPasswordEnter || "Enter password";
  useEffect(() => {
    return () => {
      if (shakeTimeoutRef.current) clearTimeout(shakeTimeoutRef.current);
      if (glowTimeoutRef.current) clearTimeout(glowTimeoutRef.current);
    };
  }, []);

  // Cooldown timer display
  const [countdown, setCountdown] = useState(cooldownRemaining);
  const passwordErrorId = "lock-password-error";
  const passwordCooldownId = "lock-password-cooldown";
  const passwordDescriptionId = [error ? passwordErrorId : null, countdown > 0 ? passwordCooldownId : null]
    .filter(Boolean)
    .join(" ") || undefined;
  useEffect(() => {
    setCountdown(cooldownRemaining);
    if (cooldownRemaining <= 0) return;
    const iv = setInterval(() => setCountdown((c) => Math.max(0, c - 1)), 1000);
    return () => clearInterval(iv);
  }, [cooldownRemaining]);

  useEffect(() => {
    inputRef.current?.focus();
  }, [step]);

  const triggerShake = () => {
    setShake(true);
    setWrongGlow(true);
    shakeTimeoutRef.current = setTimeout(() => setShake(false), 500);
    glowTimeoutRef.current = setTimeout(() => setWrongGlow(false), 1000);
  };

  const beginSubmit = () => {
    if (submitInFlightRef.current) return false;
    submitInFlightRef.current = true;
    setIsSubmitting(true);
    return true;
  };

  const finishSubmit = () => {
    submitInFlightRef.current = false;
    setIsSubmitting(false);
  };

  const handleBiometricUnlock = async () => {
    if (!onBiometricUnlock || !beginSubmit()) return;
    try {
      const ok = await onBiometricUnlock();
      if (!ok) {
        setError(ts.journalBiometricFailed || "Biometric unlock failed. Try again.");
        triggerShake();
      }
    } finally {
      finishSubmit();
    }
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (countdown > 0 || submitInFlightRef.current) return;

    if (mode === "change") {
      if (step === "current") {
        if (!currentPassword) return;
        setStep("enter");
        setError("");
        return;
      }
      if (step === "enter") {
        if (password.length < 1) {
          setError(ts.journalPasswordRequired || "Enter a password");
          triggerShake();
          return;
        }
        setStep("confirm");
        setError("");
        return;
      }
      if (!timingSafeEqual(password, confirm)) {
        setError(ts.journalPasswordMismatch || "Passwords do not match");
        setConfirm("");
        triggerShake();
        return;
      }
      if (!beginSubmit()) return;
      try {
        const ok = await onChangePassword?.(currentPassword, password);
        if (!ok) {
          setError(ts.journalPasswordOldWrong || "Current password is incorrect");
          setStep("current");
          setCurrentPassword("");
          setPassword("");
          setConfirm("");
          triggerShake();
        }
      } finally {
        finishSubmit();
      }
      return;
    }

    if (mode === "setup") {
      if (step === "enter") {
        if (password.length < 1) {
          setError(ts.journalPasswordRequired || "Enter a password");
          triggerShake();
          return;
        }
        setStep("confirm");
        setError("");
        return;
      }
      if (!timingSafeEqual(password, confirm)) {
        setError(ts.journalPasswordMismatch || "Passwords do not match");
        setConfirm("");
        triggerShake();
        return;
      }
      if (!beginSubmit()) return;
      try {
        await onSetPassword(password);
      } finally {
        finishSubmit();
      }
    } else {
      if (!beginSubmit()) return;
      try {
        const ok = await onUnlock(password);
        if (!ok) {
          setError(ts.journalPasswordWrong || "Wrong password");
          setPassword("");
          triggerShake();
        }
      } finally {
        finishSubmit();
      }
    }
  };

  return (
    <div className="flex-1 flex items-center justify-center px-4 py-4 pb-[max(1rem,var(--safe-bottom))] relative overflow-hidden">
      {/* Background gradient */}
      <div className="absolute inset-0 bg-gradient-to-b from-primary/5 via-transparent to-primary/3 pointer-events-none" />

      {/* Floating ambient particles */}
      {[
        { x: "12%", y: "18%", size: 7, idx: 0 },
        { x: "78%", y: "25%", size: 9, idx: 1 },
        { x: "85%", y: "60%", size: 6, idx: 2 },
        { x: "20%", y: "72%", size: 8, idx: 3 },
        { x: "55%", y: "85%", size: 5, idx: 4 },
      ].map((p) => (
        <div
          key={p.idx}
          className={cn(
            "absolute rounded-full bg-primary/20 blur-[1px]",
            `animate-particle-float-${(p.idx % 5) + 1}`
          )}
          style={{ left: p.x, top: p.y, width: p.size, height: p.size }}
        />
      ))}

      <motion.div
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ type: "spring", stiffness: 300, damping: 25 }}
        className={cn(
          "w-full max-w-sm rounded-2xl p-6 relative z-10",
          "bg-card/60 backdrop-blur-3xl",
          "border border-white/10 dark:border-white/5",
          "shadow-[0_8px_40px_rgba(0,0,0,0.08),inset_0_1px_0_rgba(255,255,255,0.06)]",
          shake && "motion-safe:animate-[shake_0.5s_ease-in-out]"
        )}
      >
        {/* Lock icon with sway + glow animation */}
        <div className="flex justify-center mb-4">
          <motion.div
            animate={{ rotate: [0, -3, 3, 0] }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
            className="w-16 h-16 rounded-full flex items-center justify-center bg-gradient-to-br from-primary/20 to-primary/5"
          >
            <Lock className="w-8 h-8 text-primary" aria-hidden="true" />
          </motion.div>
        </div>

        <h2 className="text-lg font-bold text-center text-foreground mb-1">
          {mode === "change"
            ? ts.journalPasswordChange || "Change Password"
            : mode === "setup"
              ? ts.journalPasswordSetup || "Set Diary Password"
              : ts.journalLocked || "Diary Locked"}
        </h2>

        {mode === "change" && step === "current" && (
          <p className="text-xs text-muted-foreground text-center mb-4 px-2">
            {ts.journalPasswordOldEnter || "Enter your current password"}
          </p>
        )}

        {mode === "change" && step === "enter" && (
          <p className="text-xs text-muted-foreground text-center mb-4 px-2">
            {ts.journalPasswordNewEnter || "Enter your new password"}
          </p>
        )}

        {mode === "change" && step === "confirm" && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            {ts.journalPasswordConfirm || "Confirm your new password"}
          </p>
        )}

        {mode === "setup" && step === "enter" && (
          <p className="text-xs text-muted-foreground text-center mb-4 px-2">
            {emailLockRemovalAvailable
              ? ts.journalLockHint ||
                "This password encrypts diary writing and attachments on this device. Keep it safe; ZenFlow cannot reveal it, and email verification cannot decrypt protected entries."
              : ts.journalLockHintLocalOnly ||
                "This password encrypts your diary on this device. Keep it somewhere safe; ZenFlow cannot reveal or recover it."}
          </p>
        )}

        {mode === "setup" && step === "confirm" && (
          <p className="text-xs text-muted-foreground text-center mb-4">
            {ts.journalPasswordConfirm || "Confirm your password"}
          </p>
        )}

        <form onSubmit={handleSubmit} className="space-y-3">
          <input
            type="text"
            name="username"
            autoComplete="username"
            value="zenflow-diary-lock"
            readOnly
            aria-hidden="true"
            tabIndex={-1}
            className="sr-only"
          />
          <div className="relative">
            <input
              ref={inputRef}
              type={showPassword ? "text" : "password"}
              value={step === "current" ? currentPassword : step === "confirm" ? confirm : password}
              onChange={(e) => {
                setError("");
                if (step === "current") setCurrentPassword(e.target.value);
                else if (step === "confirm") setConfirm(e.target.value);
                else setPassword(e.target.value);
              }}
              placeholder={passwordInputLabel}
              className={cn(
                "w-full px-4 py-3 pe-14 rounded-xl text-sm",
                "bg-background/80 border border-border/50",
                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40",
                "focus:shadow-[0_0_20px_rgba(var(--primary-rgb,99,102,241),0.15)]",
                "placeholder:text-muted-foreground/50",
                "motion-safe:transition-shadow motion-safe:duration-300",
                wrongGlow && "ring-2 ring-destructive/50 shadow-[0_0_20px_rgba(239,68,68,0.2)]"
              )}
              inputMode="text"
              autoComplete={passwordAutoComplete}
              disabled={countdown > 0 || isSubmitting}
              aria-label={passwordInputLabel}
              aria-describedby={passwordDescriptionId}
            />
            <button
              type="button"
              onClick={() => setShowPassword(!showPassword)}
              disabled={isSubmitting}
              aria-label={
                showPassword
                  ? ts.journalPasswordHide || "Hide password"
                  : ts.journalPasswordShow || "Show password"
              }
              className="absolute end-1 top-1/2 -translate-y-1/2 p-2 min-w-[44px] min-h-[44px] flex items-center justify-center text-muted-foreground rounded-lg hover:bg-muted/50"
            >
              {showPassword ? <EyeOff className="w-4 h-4" aria-hidden="true" /> : <Eye className="w-4 h-4" aria-hidden="true" />}
            </button>
          </div>

          {error && (
            <motion.p
              id={passwordErrorId}
              role="alert"
              initial={{ opacity: 0, y: -5 }}
              animate={{ opacity: 1, y: 0 }}
              className="text-xs text-destructive text-center flex items-center justify-center gap-1"
            >
              <AlertTriangle className="w-3 h-3" aria-hidden="true" /> {error}
            </motion.p>
          )}

          {countdown > 0 && (
            <p id={passwordCooldownId} role="status" aria-live="polite" className="text-xs text-orange-500 text-center">
              {formatJournalDuration(
                ts.journalPasswordCooldown || "Too many attempts. Wait {duration}.",
                countdown,
                language,
              )}
            </p>
          )}

          <button
            type="submit"
            disabled={
              countdown > 0 ||
              isSubmitting ||
              (step === "current" ? !currentPassword : step === "confirm" ? !confirm : !password)
            }
            className={cn(
              "w-full py-3 rounded-xl text-sm font-semibold",
              "bg-gradient-to-r from-primary to-primary/90",
              "text-primary-foreground",
              "shadow-[0_2px_15px_rgba(var(--primary-rgb,99,102,241),0.25)]",
              "disabled:opacity-40 disabled:shadow-none",
              "active:scale-[0.98] motion-safe:transition-all motion-safe:duration-150"
            )}
          >
            {mode === "change"
              ? step === "current"
                ? ts.journalNext || "Next"
                : step === "enter"
                  ? ts.journalNext || "Next"
                  : ts.journalPasswordChangeConfirm || "Change Password"
              : mode === "setup"
                ? step === "enter"
                  ? ts.journalNext || "Next"
                  : ts.journalSave || "Save"
                : ts.journalUnlock || "Unlock"}
          </button>
        </form>

        {/* Biometric unlock button */}
        {mode === "unlock" && biometricAvailable && onBiometricUnlock && (
          <button
            onClick={() => {
              void handleBiometricUnlock();
            }}
            disabled={isSubmitting || countdown > 0}
            className="w-full mt-3 py-2.5 flex items-center justify-center gap-2 rounded-xl bg-muted/50 text-foreground text-sm font-medium min-h-[44px] hover:bg-muted/70 motion-safe:transition-colors"
          >
            <Fingerprint className="w-5 h-5 text-primary" aria-hidden="true" />
            {ts.journalBiometricUnlock || "Unlock with biometrics"}
          </button>
        )}

        {mode === "unlock" && onForgotPassword && emailLockRemovalAvailable && (
          <button
            onClick={onForgotPassword}
            className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors text-center min-h-[44px]"
          >
            {ts.journalPasswordForgot || "Can't open the lock?"}
          </button>
        )}

        {mode === "unlock" && onForgotPassword && !emailLockRemovalAvailable && (
          <p className="mt-3 rounded-xl bg-muted/45 px-3 py-2 text-center text-xs leading-relaxed text-muted-foreground">
            {ts.journalResetDesktopUnavailable ||
              "Email verification can remove the lock in the web or mobile app, but it cannot decrypt protected entries. On desktop, use the diary password."}
          </p>
        )}

        {((mode === "setup" && step === "confirm") ||
          (mode === "change" && step !== "current")) && (
          <button
            onClick={() => {
              if (step === "confirm") {
                setStep("enter");
                setConfirm("");
              } else if (mode === "change" && step === "enter") {
                setStep("current");
                setPassword("");
              }
              setError("");
            }}
            className="w-full mt-3 py-2 text-xs text-muted-foreground hover:text-foreground motion-safe:transition-colors text-center min-h-[44px]"
          >
            {ts.journalBack || "Back"}
          </button>
        )}
      </motion.div>
    </div>
  );
}
