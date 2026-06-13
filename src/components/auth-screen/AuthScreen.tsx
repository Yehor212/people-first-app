import { motion } from "framer-motion";
import {
  AlertCircle,
  ArrowLeft,
  Loader2,
  LockKeyhole,
  Phone,
} from "lucide-react";
import { useEffect } from "react";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { ZenFlowBrandMark } from "@/components/ZenFlowBrandMark";
import { resetEntryGateScroll } from "@/components/entryGateScroll";
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldAnimate, zenMotion } from "@/lib/animationUtils";
import { IS_DEV } from "@/lib/env";
import { getEnabledAuthScreenProviders } from "@/lib/authProviders";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useThemeStore } from "@/stores/themeStore";
import type { AuthScreenProps } from "./types";
import { SHOW_PHONE_AUTH } from "./types";
import { useAuthHandlers } from "./useAuthHandlers";
import { useAuthSession } from "./useAuthSession";

import "../EntryGate.css";

const authShellVariants = {
  hidden: { opacity: 0, y: 10 },
  visible: { opacity: 1, y: 0 },
};

const authProviderListVariants = {
  hidden: {},
  visible: {
    transition: {
      staggerChildren: 0.045,
      delayChildren: 0.08,
    },
  },
};

const authProviderItemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export function AuthScreen({ onComplete, webOAuthError, onClearError }: AuthScreenProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const animated = shouldAnimate();

  const session = useAuthSession({ onComplete, webOAuthError, onClearError });
  const handlers = useAuthHandlers(session, t as unknown as Record<string, string>);
  const socialProviders = getEnabledAuthScreenProviders();

  useEffect(() => {
    resetEntryGateScroll("auth-screen");
  }, []);

  return (
    <main
      className="entry-gate-screen relative isolate flex items-start justify-center overflow-x-hidden overflow-y-auto text-foreground"
      aria-labelledby="auth-title"
      data-testid="auth-screen"
      data-entry-theme={appliedTheme}
    >
      <div aria-hidden="true" className="entry-gate-aurora" />

      <motion.section
        className="relative z-10 flex w-full max-w-lg flex-col gap-4"
        initial={animated ? "hidden" : false}
        animate="visible"
        variants={authShellVariants}
        transition={zenMotion.gentle}
      >
        <header className="text-center">
          <ZenFlowBrandMark
            className="mx-auto mb-3 h-16 w-16 rounded-2xl"
            testId="zenflow-auth-logo"
          />
          <h1
            id="auth-title"
            className="mx-auto max-w-xs text-3xl font-bold leading-none text-foreground"
          >
            {t.authWelcomeTitle}
          </h1>
          <p
            id="auth-subtitle"
            className="mx-auto mt-2 max-w-md text-sm leading-6 text-muted-foreground"
          >
            {t.authWelcomeSubtitle}
          </p>
        </header>

        <section
          className="entry-glass-panel rounded-3xl border border-border/50 p-3.5 shadow-2xl"
          aria-labelledby="auth-methods-title"
          aria-busy={session.isLoading}
          data-testid="auth-screen-panel"
        >
          <div className="mb-4 flex items-start justify-between gap-3">
            <div>
              <h2
                id="auth-methods-title"
                className="text-lg font-semibold text-foreground"
              >
                {t.authContinueWith}
              </h2>
            </div>
            <div
              className="grid h-10 w-10 shrink-0 place-items-center rounded-full border border-primary/20 bg-primary/10 text-primary"
              aria-hidden="true"
            >
              <LockKeyhole className="h-5 w-5" />
            </div>
          </div>

          <motion.div
            className="space-y-2.5"
            variants={authProviderListVariants}
            initial={animated ? "hidden" : false}
            animate="visible"
          >
            {socialProviders.map((provider) => (
              <motion.div
                key={provider.id}
                variants={authProviderItemVariants}
                transition={{ duration: 0.24, ease: [0.25, 0.1, 0.25, 1] }}
              >
                <AuthProviderButton
                  provider={provider}
                  label={ts[provider.labelKey] || provider.fallbackLabel}
                  loadingLabel={ts[provider.loadingLabelKey] || provider.fallbackLoadingLabel}
                  isLoading={session.loadingProvider === provider.id}
                  disabled={session.isLoading || !supabase}
                  onClick={() => handlers.handleProviderSignIn(provider.id)}
                  size="large"
                  surface="glass"
                />
              </motion.div>
            ))}
          </motion.div>

          {SHOW_PHONE_AUTH && session.phoneStep === "idle" && (
            <button
              type="button"
              onClick={handlers.handlePhoneStart}
              disabled={session.isLoading || !supabase}
              className="entry-action-tile btn-press mt-2.5 flex min-h-[56px] w-full items-center justify-center gap-3 rounded-2xl border border-primary/30 bg-primary/20 px-4 py-4 text-lg font-semibold text-foreground shadow-lg transition-all hover:bg-primary/25 disabled:cursor-not-allowed disabled:opacity-50"
            >
              <Phone className="w-5 h-5" aria-hidden="true" />
              {t.continueWithPhone || "Continue with Phone"}
            </button>
          )}

          {SHOW_PHONE_AUTH && session.phoneStep === "input" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={handlers.handlePhoneBack}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
                  aria-label={t.ariaBack}
                >
                  <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
                </button>
                <span className="text-sm font-medium text-foreground">
                  {t.authEnterPhone || "Enter your phone number"}
                </span>
              </div>
              <input
                type="tel"
                value={session.phoneNumber}
                onChange={(e) => {
                  session.setPhoneNumber(e.target.value);
                  session.setError(null);
                }}
                placeholder="+1234567890"
                autoFocus
                autoComplete="tel"
                aria-label={ts.phoneNumberLabel || "Phone number"}
                aria-describedby={session.error ? "auth-error" : undefined}
                className={cn(
                  "entry-action-tile w-full rounded-xl border border-border/50 bg-muted/50 px-4 py-3.5 text-base text-foreground placeholder:text-muted-foreground/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  session.error && "input-error"
                )}
              />
              <button
                type="button"
                onClick={() => void handlers.handleSendOtp()}
                disabled={session.loadingProvider === "phone" || !session.phoneNumber.trim()}
                className="btn-press flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  t.authSendCode || "Send code"
                )}
              </button>
            </div>
          )}

          {SHOW_PHONE_AUTH && session.phoneStep === "otp" && (
            <div className="space-y-3">
              <div className="flex items-center gap-2 mb-1">
                <button
                  type="button"
                  onClick={() => session.setPhoneStep("input")}
                  className="flex min-h-[44px] min-w-[44px] items-center justify-center rounded-lg p-1.5 text-muted-foreground hover:bg-muted/50"
                  aria-label={t.ariaBack}
                >
                  <ArrowLeft className="w-4 h-4 rtl:scale-x-[-1]" />
                </button>
                <span className="text-sm text-muted-foreground">
                  {(t.authCodeSentTo || "Code sent to {phone}").replace(
                    "{phone}",
                    session.phoneNumber
                  )}
                </span>
              </div>
              <input
                type="text"
                inputMode="numeric"
                maxLength={6}
                value={session.otpCode}
                onChange={(e) => {
                  session.setOtpCode(e.target.value.replace(/\D/g, "").slice(0, 6));
                  session.setError(null);
                }}
                placeholder="000000"
                autoFocus
                aria-label={ts.otpCodeLabel || "Verification code"}
                aria-describedby={session.error ? "auth-error" : undefined}
                className={cn(
                  "entry-action-tile w-full rounded-xl border border-border/50 bg-muted/50 px-4 py-3.5 text-center font-mono text-2xl tracking-normal text-foreground placeholder:text-muted-foreground/60 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/30",
                  session.error && "input-error"
                )}
              />
              <button
                type="button"
                onClick={() => void handlers.handleVerifyOtp()}
                disabled={session.loadingProvider === "phone" || session.otpCode.length !== 6}
                className="btn-press flex min-h-[54px] w-full items-center justify-center gap-3 rounded-2xl bg-primary px-4 py-4 text-lg font-semibold text-primary-foreground shadow-lg transition-all hover:bg-primary/90 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {session.loadingProvider === "phone" ? (
                  <Loader2 className="w-5 h-5 animate-spin" aria-hidden="true" />
                ) : (
                  t.authVerify || "Verify"
                )}
              </button>
            </div>
          )}

          {!supabase && (
            <div
              role="alert"
              className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3"
            >
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <p className="text-sm text-destructive">{t.authNotConfiguredMessage}</p>
            </div>
          )}

          {session.error && (
            <div
              id="auth-error"
              role="alert"
              aria-live="polite"
              className="mt-3 flex items-start gap-2 rounded-xl border border-destructive/20 bg-destructive/10 p-3"
            >
              <AlertCircle
                className="w-5 h-5 text-destructive mt-0.5 flex-shrink-0"
                aria-hidden="true"
              />
              <div className="flex-1">
                <p className="text-sm text-destructive whitespace-pre-wrap">{session.error}</p>
                {IS_DEV && session.debugInfo && (
                  <p className="text-xs text-muted-foreground mt-2">{session.debugInfo}</p>
                )}
                  {IS_DEV && (
                    <button
                      type="button"
                      onClick={handlers.exportDebugInfo}
                      aria-label={t.authExportDebugInfo}
                      className="text-xs text-primary underline mt-2"
                  >
                    {t.authExportDebugInfo}
                  </button>
                )}
              </div>
            </div>
          )}
        </section>

        <div className="space-y-2 px-2 text-center text-xs leading-5 text-muted-foreground">
          <p className="mx-auto max-w-[22rem]">{t.authPrivacyNote}</p>

          <div className="flex flex-col items-center text-muted-foreground/75">
            <span>{t.legalAgreePrefix}</span>
            <span className="flex flex-wrap items-center justify-center gap-x-2">
              <a
                href="https://yehor212.github.io/people-first-app/privacy.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center underline hover:text-foreground motion-safe:transition-colors"
              >
                {t.privacyPolicy}
              </a>
              <span>{t.legalAnd}</span>
              <a
                href="https://yehor212.github.io/people-first-app/terms.html"
                target="_blank"
                rel="noopener noreferrer"
                className="inline-flex min-h-[44px] items-center underline hover:text-foreground motion-safe:transition-colors"
              >
                {t.termsOfService}
              </a>
            </span>
          </div>
        </div>
      </motion.section>
    </main>
  );
}

export { AuthScreen as GoogleAuthScreen };
