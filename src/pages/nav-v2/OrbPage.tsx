import {
  memo,
  useCallback,
  useEffect,
  useLayoutEffect,
  useMemo,
  useRef,
  useState,
} from "react";
import { ArrowLeft, RefreshCw } from "lucide-react";
import { motion, AnimatePresence } from "framer-motion";
import { Bloom, easings } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import { CANONICAL_ORB_ANIMATION_SPEED } from "@/components/state-of-mind/ValenceOrb";
import { PremiumLoader } from "@/components/PremiumLoader";
import { SplashScreen } from "@/components/SplashScreen";
import { registerModalCloseCallback } from "@/lib/androidBackHandler";
import { OrbAmbienceControl } from "./OrbAmbienceControl";
import { CosmicBgAdapter } from "./CosmicBgAdapter";
import { useCosmicParallax } from "./useCosmicParallax";
import { ShootingStar } from "./ShootingStar";
import { MoodFirstRunHint } from "./MoodFirstRunHint";
import { OrbDayFlourish } from "./OrbDayFlourish";
import { OrbRefineStep, OrbSelectStep } from "./OrbPageSteps";
import { useOrbMoodFlow } from "./useOrbMoodFlow";
import type { NavV2Page } from "@/hooks/useNavigationV2";
import type { MoodEntry } from "@/types";

const BASE_VALENCE_ORB_SIZE = 280;
const ORB_AMBIENCE_AUDIO_SRC = getAppAudioAssetSrc("orb-ambience");

type OrbVisualStatus = "pending" | "ready" | "failed";

function isColdOrbNavigation(): boolean {
  if (typeof window === "undefined") return true;
  const navigationEntry = window.performance
    ?.getEntriesByType?.("navigation")
    .at(0);

  return navigationEntry?.type === "reload" || window.history.state?.navV2Page !== "orb";
}

/**
 * OrbPage — Phase 3-A.2 cosmic cinematic mindfulness surface with
 * Phase 3-A.4b mood-to-journal flow (scope + optional details + diary handoff).
 *
 * Visual: CosmicBgAdapter + ShootingStar + glass chips over the cosmic
 * aesthetic. Paper theme swaps to aurora day variant via orb-day-scope class.
 *
 * Flow orchestration lives in useOrbMoodFlow() — this file is presentational.
 */

const WHISPER_KEYS = [
  "orbWhisper1",
  "orbWhisper2",
  "orbWhisper3",
  "orbWhisper4",
  "orbWhisper5",
] as const;

function pickWhisperKey(date = new Date()): (typeof WHISPER_KEYS)[number] {
  return WHISPER_KEYS[date.getDate() % WHISPER_KEYS.length];
}

interface OrbPageProps {
  navigateToPage?: (page: NavV2Page) => void;
  onAddMood?: (entry: MoodEntry) => void;
}

export const OrbPage = memo(function OrbPage({ navigateToPage, onAddMood }: OrbPageProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const mainRef = useRef<HTMLElement>(null);
  const errorRef = useRef<HTMLDivElement>(null);
  const visualAttemptRef = useRef(0);
  const failedVisualAttemptRef = useRef<number | null>(null);
  const readySignalAttemptRef = useRef<number | null>(null);
  const revealFrameRef = useRef<number | null>(null);
  const [visualAttempt, setVisualAttempt] = useState(0);
  const [visualStatus, setVisualStatus] = useState<OrbVisualStatus>("pending");
  const [coldLoading, setColdLoading] = useState(isColdOrbNavigation);
  const parallaxRef = useCosmicParallax<HTMLDivElement>();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const [viewport, setViewport] = useState(() => ({
    width: typeof window === "undefined" ? 1280 : window.innerWidth,
    height: typeof window === "undefined" ? 900 : window.innerHeight,
  }));
  const isPaperTheme = appliedTheme === "paper";
  const scopeClass = isPaperTheme ? "orb-day-scope" : "dark orb-cosmic-scope";

  const {
    orbValence,
    auraHue,
    step,
    draftValence,
    resolvedValence,
    draftMood,
    draftScope,
    draftSpecificTime,
    draftEmotion,
    draftNote,
    canProceedFromSelect,
    canOpenDiary,
    firstRunEligible,
    handleSliderCommit,
    handleEmotionToggle,
    handleNoteChange,
    handleNextStep,
    handleBackStep,
    handleSaveMood,
    handleOpenDiary,
  } = useOrbMoodFlow({ navigateToPage, onAddMood });
  const shouldRunAmbientMotion = useShouldAnimate({ respectRuntimePerformance: false });
  const shouldRunDecorativeMotion = useShouldAnimate();
  const visualReady = visualStatus === "ready";

  useEffect(() => {
    const main = mainRef.current;
    if (!main) return;
    if (visualReady) {
      main.removeAttribute("inert");
      main.focus({ preventScroll: true });
      return;
    }
    main.setAttribute("inert", "");
  }, [visualReady]);

  useEffect(() => {
    if (visualStatus === "failed") {
      errorRef.current?.focus({ preventScroll: true });
    }
  }, [visualStatus]);

  const scheduleVisibleReveal = useCallback((attempt: number) => {
    if (
      attempt !== visualAttemptRef.current ||
      readySignalAttemptRef.current !== attempt ||
      document.hidden
    ) {
      return;
    }
    if (revealFrameRef.current !== null) {
      window.cancelAnimationFrame(revealFrameRef.current);
    }
    revealFrameRef.current = window.requestAnimationFrame(() => {
      revealFrameRef.current = null;
      if (
        attempt !== visualAttemptRef.current ||
        readySignalAttemptRef.current !== attempt ||
        document.hidden
      ) {
        return;
      }
      setVisualStatus("ready");
    });
  }, []);

  useEffect(() => {
    const resumeReveal = () => {
      const attempt = readySignalAttemptRef.current;
      if (attempt !== null) scheduleVisibleReveal(attempt);
    };
    document.addEventListener("visibilitychange", resumeReveal);
    window.addEventListener("pageshow", resumeReveal);
    return () => {
      document.removeEventListener("visibilitychange", resumeReveal);
      window.removeEventListener("pageshow", resumeReveal);
      if (revealFrameRef.current !== null) {
        window.cancelAnimationFrame(revealFrameRef.current);
        revealFrameRef.current = null;
      }
      readySignalAttemptRef.current = null;
    };
  }, [scheduleVisibleReveal]);

  const handleOrbVisualReady = useCallback(() => {
    if (
      visualAttempt !== visualAttemptRef.current ||
      failedVisualAttemptRef.current === visualAttempt
    ) return;
    readySignalAttemptRef.current = visualAttempt;
    scheduleVisibleReveal(visualAttempt);
  }, [scheduleVisibleReveal, visualAttempt]);

  const handleOrbVisualError = useCallback(() => {
    if (visualAttempt !== visualAttemptRef.current) return;
    failedVisualAttemptRef.current = visualAttempt;
    readySignalAttemptRef.current = null;
    if (revealFrameRef.current !== null) {
      window.cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
    }
    setVisualStatus("failed");
  }, [visualAttempt]);

  const beginNewVisualAttempt = useCallback(() => {
    if (revealFrameRef.current !== null) {
      window.cancelAnimationFrame(revealFrameRef.current);
      revealFrameRef.current = null;
    }
    readySignalAttemptRef.current = null;
    failedVisualAttemptRef.current = null;
    const nextAttempt = visualAttemptRef.current + 1;
    visualAttemptRef.current = nextAttempt;
    setColdLoading(false);
    setVisualStatus("pending");
    setVisualAttempt(nextAttempt);
  }, []);

  const handleBackToSelect = useCallback(() => {
    beginNewVisualAttempt();
    handleBackStep();
  }, [beginNewVisualAttempt, handleBackStep]);

  const handleErrorBack = useCallback(() => {
    if (navigateToPage) {
      navigateToPage("habits");
      return;
    }
    if (
      typeof window !== "undefined" &&
      window.history.state?.navV2Page === "orb" &&
      window.history.length > 1
    ) {
      window.history.back();
    }
  }, [navigateToPage]);

  useEffect(() => registerModalCloseCallback(() => {
    if (visualStatus === "failed") {
      handleErrorBack();
      return true;
    }
    if (step !== "orb-select") {
      handleBackToSelect();
      return true;
    }
    return false;
  }), [handleBackToSelect, handleErrorBack, step, visualStatus]);

  useEffect(() => {
    if (typeof window === "undefined") return;

    const syncViewport = () =>
      setViewport({ width: window.innerWidth, height: window.innerHeight });

    syncViewport();
    window.addEventListener("resize", syncViewport);
    return () => window.removeEventListener("resize", syncViewport);
  }, []);

  const whisperKey = useMemo(() => pickWhisperKey(), []);
  const whisperText = tx[whisperKey] || "How's your heart today?";

  const auraRef = useRef<HTMLDivElement>(null);
  const handleOrbTap = useCallback(() => {
    // Orb tap plays pulse-aura animation only. Mood entry flow is inline
    // below (slider -> optional details -> diary handoff), so the CTA advances
    // the local flow instead of opening a second mood modal.
    void haptics.tabChanged();
    const node = auraRef.current;
    if (node && shouldRunAmbientMotion) {
      node.setAttribute("data-orb-pulse", "true");
      setTimeout(() => node.removeAttribute("data-orb-pulse"), 650);
    }
  }, [shouldRunAmbientMotion]);

  const moodLabel = useMemo(() => {
    const moodKey =
      draftMood === "great"
        ? "moodGreat"
        : draftMood === "good"
          ? "moodGood"
          : draftMood === "bad"
            ? "moodBad"
            : draftMood === "terrible"
              ? "moodTerrible"
              : "moodOkay";
    return tx[moodKey] || draftMood;
  }, [draftMood, tx]);

  const scopeLabel = useMemo(() => {
    if (draftScope === "day") return tx.orbScopeDay || "For the whole day";
    if (draftScope === "specific") {
      return draftSpecificTime
        ? `${tx.orbScopeSpecific || "At a specific time"} - ${draftSpecificTime}`
        : tx.orbScopeSpecific || "At a specific time";
    }
    return tx.orbScopeNow || "In this moment";
  }, [draftScope, draftSpecificTime, tx]);

  const isDesktopViewport = viewport.width >= 768;
  const isShortViewport = viewport.height < 820;
  const isUltraDenseSelectStep =
    step === "orb-select" &&
    draftScope === "specific" &&
    isDesktopViewport &&
    viewport.height < 820;
  const isDenseSelectStep =
    step === "orb-select" &&
    (viewport.height < 860 || (draftScope === "specific" && viewport.height < 940));
  const heroOrbSize = useMemo(() => {
    if (!isDenseSelectStep && !isUltraDenseSelectStep) {
      return BASE_VALENCE_ORB_SIZE;
    }

    const denseMin = isUltraDenseSelectStep ? 220 : isDesktopViewport ? 260 : 240;
    const denseScale = isUltraDenseSelectStep ? 0.3 : isDesktopViewport ? 0.34 : 0.32;
    return Math.round(
      Math.max(denseMin, Math.min(BASE_VALENCE_ORB_SIZE, viewport.height * denseScale))
    );
  }, [isDenseSelectStep, isDesktopViewport, isUltraDenseSelectStep, viewport.height]);
  const heroOrbGenerationRef = useRef({
    size: heroOrbSize,
    attempt: visualAttemptRef.current,
  });

  useLayoutEffect(() => {
    if (step !== "orb-select") return;

    const previousGeneration = heroOrbGenerationRef.current;
    if (previousGeneration.size !== heroOrbSize) {
      if (previousGeneration.attempt === visualAttemptRef.current) {
        beginNewVisualAttempt();
      }
      heroOrbGenerationRef.current = {
        size: heroOrbSize,
        attempt: visualAttemptRef.current,
      };
      return;
    }

    previousGeneration.attempt = visualAttemptRef.current;
  }, [beginNewVisualAttempt, heroOrbSize, step, visualAttempt]);

  const contentGapClass = isUltraDenseSelectStep
    ? "gap-1.5 md:gap-2"
    : isDenseSelectStep
      ? "gap-2.5 md:gap-3"
      : isShortViewport
        ? "gap-3 md:gap-4"
        : "gap-6 md:gap-7";
  const pageChromePaddingClass = isUltraDenseSelectStep
    ? "pt-[calc(var(--safe-top)+0.75rem)]"
    : isDenseSelectStep
      ? "pt-[calc(var(--safe-top)+0.75rem)]"
      : isShortViewport
        ? "pt-[calc(var(--safe-top)+1rem)]"
        : "pt-[calc(var(--safe-top)+1.25rem)]";
  const selectContentLayoutClass = isUltraDenseSelectStep
    ? "flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 pb-3 pt-12 md:pb-4 md:pt-10"
    : isDenseSelectStep
      ? "flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 pb-3 pt-12 md:pb-4 md:pt-8"
      : isShortViewport
        ? "flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 pb-3 pt-8 md:pb-4"
        : "flex flex-1 min-h-0 flex-col overflow-y-auto overflow-x-hidden px-1 pb-3 md:pb-4";

  return (
    <>
      <Bloom key="orb-page" transition={staggerDelay("primary")}>
        <main
          ref={mainRef}
          id="main-content-v2"
          role="main"
          tabIndex={-1}
          className={cn(
            scopeClass,
            "v2-fullscreen-page v2-readable-page v2-readable-page--ambient relative min-h-[var(--app-viewport-height)] overflow-hidden outline-none"
          )}
          aria-labelledby="orb-page-heading"
          aria-hidden={visualReady ? undefined : true}
          data-orb-visual-status={visualStatus}
          data-testid="orb-page"
          data-v2-readable-page="orb"
        >
          <h1 id="orb-page-heading" className="sr-only">
            {tx.somLogFeeling || tx.navV2Orb || "Log how you feel"}
          </h1>

          <CosmicBgAdapter />

          <div
            ref={parallaxRef}
            aria-hidden="true"
            className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
            data-testid="cosmic-orb-flourish-layer"
          >
            {visualReady && shouldRunDecorativeMotion ? (
              isPaperTheme ? (
                <OrbDayFlourish />
              ) : (
                <ShootingStar />
              )
            ) : null}
          </div>

          <div
            data-testid="orb-page-runtime-content"
            className={cn(
              "relative z-10 mx-auto flex h-[var(--app-viewport-height)] w-full min-w-0 max-w-3xl flex-col overflow-x-hidden px-3 pb-[calc(var(--safe-bottom)+1rem)] md:px-6 md:pb-[calc(var(--safe-bottom)+1.5rem)]",
              pageChromePaddingClass,
              visualReady ? "opacity-100" : "pointer-events-none opacity-0"
            )}
          >
            {step === "orb-select" ? (
              <OrbSelectStep
                tx={tx}
                selectContentLayoutClass={selectContentLayoutClass}
                contentGapClass={contentGapClass}
                shouldAnimate={shouldRunAmbientMotion}
                auraHue={auraHue}
                auraRef={auraRef}
                showOrbAura={false}
                handleOrbTap={handleOrbTap}
                orbValence={orbValence}
                heroOrbSize={heroOrbSize}
                orbAnimationSpeed={CANONICAL_ORB_ANIMATION_SPEED}
                orbAttempt={visualAttempt}
                onOrbVisualReady={handleOrbVisualReady}
                onOrbVisualError={handleOrbVisualError}
                draftScope={draftScope}
                draftValence={draftValence}
                isDenseSelectStep={isDenseSelectStep}
                isUltraDenseSelectStep={isUltraDenseSelectStep}
                isShortViewport={isShortViewport}
                whisperKey={whisperKey}
                whisperText={whisperText}
                canProceedFromSelect={canProceedFromSelect}
                handleSliderCommit={handleSliderCommit}
                handleNextStep={handleNextStep}
              />
            ) : (
              <OrbRefineStep
                tx={tx}
                contentGapClass={contentGapClass}
                resolvedValence={resolvedValence}
                scopeLabel={scopeLabel}
                moodLabel={moodLabel}
                draftEmotion={draftEmotion}
                draftNote={draftNote}
                canOpenDiary={canOpenDiary}
                handleEmotionToggle={handleEmotionToggle}
                handleNoteChange={handleNoteChange}
                handleBackStep={handleBackToSelect}
                handleSaveMood={handleSaveMood}
                handleOpenDiary={handleOpenDiary}
              />
            )}
          </div>
        </main>
      </Bloom>

      {visualStatus === "pending" ? (
        coldLoading ? (
          <SplashScreen
            loadingFadeOut={false}
            subtitle={tx.initializingApp || tx.loading || ""}
            instant
          />
        ) : (
          <AnimatePresence>
            <motion.div
              key="orb-page-loading"
              className={cn(
                scopeClass,
                "fixed inset-0 z-40 flex items-center justify-center bg-background"
              )}
              data-testid="orb-page-loading"
              exit={
                shouldRunDecorativeMotion
                  ? { opacity: 0, transition: { duration: 0.3, ease: easings.standardAccelerate } }
                  : undefined
              }
            >
              <PremiumLoader
                size="lg"
                label={tx.initializingApp || tx.loading || "Loading"}
              />
            </motion.div>
          </AnimatePresence>
        )
      ) : null}

      {visualStatus === "failed" ? (
        <div
          ref={errorRef}
          role="alert"
          aria-live="assertive"
          tabIndex={-1}
          className={cn(
            scopeClass,
            "fixed inset-0 z-[60] flex flex-col items-center justify-center gap-6 bg-background px-6 text-center outline-none"
          )}
          data-testid="orb-page-render-error"
        >
          <p className="max-w-md text-base font-medium text-foreground">
            {tx.orbPreparationError || "We couldn't open your mood check-in. Try again."}
          </p>
          <div className="flex flex-wrap items-center justify-center gap-3">
            <button
              type="button"
              onClick={handleErrorBack}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full border border-border/60 px-5 py-2.5 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary"
              data-testid="orb-page-error-back"
            >
              <ArrowLeft className="h-4 w-4 rtl:scale-x-[-1]" aria-hidden="true" />
              <span>{tx.back || "Back"}</span>
            </button>
            <button
              type="button"
              onClick={beginNewVisualAttempt}
              className="inline-flex min-h-[44px] items-center gap-2 rounded-full bg-primary px-5 py-2.5 text-sm font-medium text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2"
              data-testid="orb-page-retry"
            >
              <RefreshCw className="h-4 w-4" aria-hidden="true" />
              <span>{tx.tryAgain || "Try again"}</span>
            </button>
          </div>
        </div>
      ) : null}

      {visualReady ? <OrbAmbienceControl audioSrc={ORB_AMBIENCE_AUDIO_SRC} tx={tx} /> : null}

      {visualReady ? <MoodFirstRunHint eligible={firstRunEligible} /> : null}
    </>
  );
});
