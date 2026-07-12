import { motion } from "framer-motion";
import { AlertCircle } from "lucide-react";
import { useEffect, useRef } from "react";
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
import { useUserStartedAmbienceAudio } from "@/hooks/useUserStartedAmbienceAudio";
import { IS_DEV } from "@/lib/env";
import { isAndroid } from "@/lib/platform";
import { getEnabledAuthScreenProviders } from "@/lib/authProviders";
import { supabase } from "@/lib/supabaseClient";
import { useThemeStore } from "@/stores/themeStore";
import { AuthMeasuredBreathToggle } from "./AuthMeasuredBreathToggle";
import { AuthPhoneAuthPanel } from "./AuthPhoneAuthPanel";
import type { AuthScreenProps } from "./types";
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

export function AuthScreen({
  onComplete,
  webOAuthError,
  onClearError,
  suspendSessionCompletion = false,
  recoveryAction,
}: AuthScreenProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const animated = !isAndroid && shouldAnimate();
  const breathAudioRef = useRef<HTMLAudioElement | null>(null);
  const appAudioSettings = useAppAudioSettings();
  const audioComfort = useAudioComfortSettings();
  const canPlayBreathAudio =
    !appAudioSettings.muted && audioComfort.canPlayAmbientAsset("soft-air-veil");
  const breathAudioVolume = canPlayBreathAudio
    ? Math.max(0, Math.min(1, appAudioSettings.volume * 0.18))
    : 0;
  const mutedAudioLabel = t.settingsSoundSummaryOff || "Muted";
  const breathAudioUnavailableLabel = appAudioSettings.muted
    ? mutedAudioLabel
    : t.settingsSoundAmbientOff || t.soundOff;
  const breathAudioDisabledStatusLabel = appAudioSettings.muted ? mutedAudioLabel : t.soundOff;
  const breathAudioPlayback = useUserStartedAmbienceAudio({
    audioRef: breathAudioRef,
    canPlay: canPlayBreathAudio,
    volume: breathAudioVolume,
    mediaSessionTitle: t.authMeasuredBreathLabel,
    loggerScope: "[AuthScreen] Breath ambience",
  });

  const session = useAuthSession({
    onComplete,
    webOAuthError,
    onClearError,
    suspendSessionCompletion,
  });
  const handlers = useAuthHandlers(session, t as unknown as Record<string, string>);
  const socialProviders = getEnabledAuthScreenProviders();

  const breathAudioToggleLabel = !canPlayBreathAudio
    ? breathAudioUnavailableLabel
    : breathAudioPlayback.isPlaying
      ? t.authMeasuredBreathPause
      : breathAudioPlayback.isPending
        ? t.audioLoading
        : breathAudioPlayback.hasError
          ? t.audioRetry
          : t.authMeasuredBreathPlay;
  const breathAudioStatusLabel = !canPlayBreathAudio
    ? breathAudioDisabledStatusLabel
    : breathAudioPlayback.isPlaying
      ? t.soundOn
      : breathAudioPlayback.isPending
        ? t.audioLoading
        : breathAudioPlayback.hasError
          ? t.audioRetry
          : t.soundOff;

  useEffect(() => {
    resetEntryGateScroll("auth-screen");
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
        crossOrigin="anonymous"
        preload="none"
        loop
        playsInline
        onPlay={breathAudioPlayback.handleMediaPlay}
        onPause={breathAudioPlayback.handleMediaPause}
        onError={breathAudioPlayback.handleMediaError}
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
            isPlaying={breathAudioPlayback.isPlaying}
            isMuted={!canPlayBreathAudio}
            label={t.authMeasuredBreathLabel}
            statusLabel={breathAudioStatusLabel}
            toggleLabel={breathAudioToggleLabel}
            onToggle={breathAudioPlayback.toggle}
          />
        </div>

        <section
          className="entry-auth-panel entry-glass-panel rounded-3xl border border-border/50 p-3.5 shadow-2xl"
          aria-labelledby="auth-methods-title"
          aria-busy={session.isLoading}
          data-testid="auth-screen-panel"
        >
          <div className="mb-4">
            <h2 id="auth-methods-title" className="text-xl font-bold leading-tight text-foreground">
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
                  disabled={suspendSessionCompletion || session.isLoading || !supabase}
                  onClick={() => handlers.handleProviderSignIn(provider.id)}
                  size="large"
                  surface="glass"
                />
              </motion.div>
            ))}
          </motion.div>

          {!suspendSessionCompletion && (
            <AuthPhoneAuthPanel session={session} handlers={handlers} />
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
                {recoveryAction && (
                  <div className="mt-3 grid gap-2 sm:grid-cols-2">
                    <button
                      type="button"
                      onClick={recoveryAction.onConfirm}
                      className="min-h-[44px] rounded-xl border border-primary/35 bg-primary/10 px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {recoveryAction.confirmLabel}
                    </button>
                    <button
                      type="button"
                      onClick={recoveryAction.onCancel}
                      className="min-h-[44px] rounded-xl border border-border/70 px-3 py-2 text-sm font-semibold text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
                    >
                      {recoveryAction.cancelLabel}
                    </button>
                  </div>
                )}
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
          <p
            className="entry-gate-muted-copy mx-auto max-w-[22rem]"
            data-testid="auth-privacy-copy"
          >
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
