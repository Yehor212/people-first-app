import { motion } from "framer-motion";
import { AlertCircle, ArrowLeft, Loader2, Phone } from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
import type { PluginListenerHandle } from "@capacitor/core";
import { EntryGateBackdrop } from "@/components/EntryGateBackdrop";
import { EntryThemeSwitcher } from "@/components/EntryThemeSwitcher";
import { AuthProviderButton } from "@/components/auth/AuthProviderButton";
import { ZenFlowBrandMark } from "@/components/ZenFlowBrandMark";
import { resetEntryGateScroll } from "@/components/entryGateScroll";
import { useLanguage } from "@/contexts/LanguageContext";
import { shouldAnimate, zenMotion } from "@/lib/animationUtils";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import { clearAppAudioMediaSession, setAppAudioMediaSession } from "@/lib/audioMediaSession";
import { IS_DEV } from "@/lib/env";
import { logger } from "@/lib/logger";
import { isAndroid } from "@/lib/platform";
import { getEnabledAuthScreenProviders } from "@/lib/authProviders";
import { cn } from "@/lib/utils";
import { supabase } from "@/lib/supabaseClient";
import { useThemeStore } from "@/stores/themeStore";
import { AuthMeasuredBreathToggle } from "./AuthMeasuredBreathToggle";
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

const MEASURED_BREATH_AUDIO_SRC = getAppAudioAssetSrc("soft-air-veil");

const authProviderItemVariants = {
  hidden: { opacity: 0, y: 10, scale: 0.985 },
  visible: { opacity: 1, y: 0, scale: 1 },
};

export function AuthScreen({ onComplete, webOAuthError, onClearError }: AuthScreenProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const animated = !isAndroid && shouldAnimate();
  const breathAudioRef = useRef<HTMLAudioElement | null>(null);
  const [isBreathAudioPlaying, setIsBreathAudioPlaying] = useState(false);
  const appAudioSettings = useAppAudioSettings();
  const audioComfort = useAudioComfortSettings();
  const canPlayBreathAudio = !appAudioSettings.muted && audioComfort.canPlayAmbientAsset("soft-air-veil");

  const session = useAuthSession({ onComplete, webOAuthError, onClearError });
  const handlers = useAuthHandlers(session, t as unknown as Record<string, string>);
  const socialProviders = getEnabledAuthScreenProviders();

  const breathAudioToggleLabel = isBreathAudioPlaying
    ? t.authMeasuredBreathPause
    : t.authMeasuredBreathPlay;
  const breathAudioStatusLabel = isBreathAudioPlaying && canPlayBreathAudio ? t.soundOn : t.soundOff;

  const stopBreathAudio = useCallback(() => {
    const audio = breathAudioRef.current;
    if (!audio) return;
    audio.pause();
    clearAppAudioMediaSession();
    setIsBreathAudioPlaying(false);
  }, []);

  const handleBreathAudioToggle = useCallback(() => {
    const audio = breathAudioRef.current;
    if (!audio) return;

    if (isBreathAudioPlaying) {
      stopBreathAudio();
      return;
    }

    if (!canPlayBreathAudio) {
      stopBreathAudio();
      return;
    }

    audio.volume = Math.max(0, Math.min(1, appAudioSettings.volume * 0.18));
    setIsBreathAudioPlaying(true);
    void audio.play().then(() => {
      setAppAudioMediaSession({
        title: t.authMeasuredBreathLabel,
        onPause: stopBreathAudio,
        onStop: stopBreathAudio,
      });
    }).catch((error) => {
      logger.warn("[AuthScreen] Breath ambience failed:", error);
      stopBreathAudio();
    });
  }, [appAudioSettings.volume, canPlayBreathAudio, isBreathAudioPlaying, stopBreathAudio, t.authMeasuredBreathLabel]);

  useEffect(() => {
    resetEntryGateScroll("auth-screen");
  }, []);

  useEffect(() => {
    if (canPlayBreathAudio) return;
    stopBreathAudio();
  }, [canPlayBreathAudio, stopBreathAudio]);

  useEffect(() => {
    const stopOnHidden = () => {
      if (document.hidden) stopBreathAudio();
    };
    const stopOnPageHide = () => stopBreathAudio();
    let cancelled = false;
    let pauseListener: PluginListenerHandle | null = null;

    document.addEventListener("visibilitychange", stopOnHidden);
    window.addEventListener("pagehide", stopOnPageHide);
    void import("@capacitor/app")
      .then(({ App }) => App.addListener("pause", stopBreathAudio))
      .then((listener) => {
        if (cancelled) {
          void listener.remove();
          return;
        }
        pauseListener = listener;
      })
      .catch((error) => {
        logger.warn("[AuthScreen] Failed to register audio pause listener:", error);
      });

    return () => {
      cancelled = true;
      document.removeEventListener("visibilitychange", stopOnHidden);
      window.removeEventListener("pagehide", stopOnPageHide);
      if (pauseListener) void pauseListener.remove();
    };
  }, [stopBreathAudio]);

  useEffect(() => {
    const audio = breathAudioRef.current;

    return () => {
      if (!audio) return;
      audio.pause();
      clearAppAudioMediaSession();
      audio.removeAttribute("src");
    };
  }, []);

  return (
    <main
      className="entry-gate-screen relative isolate flex items-start justify-center overflow-x-hidden overflow-y-auto text-foreground md:items-center"
      aria-labelledby="auth-title"
      data-testid="auth-screen"
      data-entry-theme={appliedTheme}
    >
      <EntryGateBackdrop animated={animated} />
      {/* Ambient sign-in music has no spoken content; the adjacent button provides control. */}
      {/* eslint-disable-next-line jsx-a11y/media-has-caption */}
      <audio
        ref={breathAudioRef}
        aria-hidden="true"
        data-testid="auth-measured-breath-audio"
        src={MEASURED_BREATH_AUDIO_SRC}
        preload="none"
        loop
        playsInline
        onPlay={() => setIsBreathAudioPlaying(true)}
        onPause={() => {
          setIsBreathAudioPlaying(false);
          clearAppAudioMediaSession();
        }}
      />

      <motion.section
        className="entry-gate-content relative z-10 flex w-full max-w-lg flex-col gap-4 md:max-w-2xl md:gap-5 lg:max-w-3xl"
        initial={animated ? "hidden" : false}
        animate="visible"
        variants={authShellVariants}
        transition={zenMotion.gentle}
      >
        <header className="text-center">
          <ZenFlowBrandMark
            className="mx-auto mb-3 h-[72px] w-[72px] rounded-[1.35rem]"
            testId="zenflow-auth-logo"
          />
          <h1
            id="auth-title"
            className="entry-gate-title mx-auto max-w-xs text-4xl font-black leading-none text-foreground sm:text-5xl md:max-w-xl md:text-6xl"
          >
            {t.authWelcomeTitle}
          </h1>
        </header>

        <div className="space-y-2">
          <EntryThemeSwitcher />
          <AuthMeasuredBreathToggle
            isPlaying={isBreathAudioPlaying}
            isMuted={!canPlayBreathAudio}
            label={t.authMeasuredBreathLabel}
            statusLabel={breathAudioStatusLabel}
            toggleLabel={breathAudioToggleLabel}
            onToggle={handleBreathAudioToggle}
          />
        </div>

        <section
          className="entry-auth-panel entry-glass-panel rounded-3xl border border-border/50 p-3.5 shadow-2xl"
          aria-labelledby="auth-methods-title"
          aria-busy={session.isLoading}
          data-testid="auth-screen-panel"
        >
          <div className="mb-4">
            <h2
              id="auth-methods-title"
              className="text-xl font-bold leading-tight text-foreground"
            >
              {t.authContinueWith}
            </h2>
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

        <div className="entry-auth-footer space-y-2 px-2 text-center text-xs leading-5">
          <p className="entry-gate-muted-copy mx-auto max-w-[22rem]" data-testid="auth-privacy-copy">
            {t.authPrivacyNote}
          </p>

          <div
            className="entry-gate-muted-copy flex flex-col items-center"
            data-testid="auth-legal-copy"
          >
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
