import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { cn } from "@/lib/utils";
import { haptics } from "@/lib/haptics";
import { getAppAudioAssetSrc } from "@/lib/appAudioAssets";
import { CANONICAL_ORB_ANIMATION_SPEED } from "@/components/state-of-mind/ValenceOrb";
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

/**
 * OrbPage — Phase 3-A.2 cosmic cinematic mindfulness surface with
 * Phase 3-A.4b complete mood entry flow (scope + emotion + confirm + auto-flow).
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
    handleOpenDiary,
  } = useOrbMoodFlow({ navigateToPage, onAddMood });
  const shouldRunAmbientMotion = useShouldAnimate({ respectRuntimePerformance: false });
  const shouldRunDecorativeMotion = useShouldAnimate();

  useEffect(() => {
    mainRef.current?.focus({ preventScroll: true });
  }, []);

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
    // below (slider -> emotion grid -> confirm CTA), so the CTA advances
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
    ? "flex flex-1 min-h-0 flex-col justify-center overflow-y-auto overflow-x-hidden px-1 pb-24 pt-12 md:pb-28 md:pt-10"
    : isDenseSelectStep
      ? "flex flex-1 min-h-0 flex-col justify-center overflow-y-auto overflow-x-hidden px-1 pb-24 pt-12 md:pb-28 md:pt-8"
      : isShortViewport
        ? "flex flex-1 min-h-0 flex-col justify-center overflow-y-auto overflow-x-hidden px-1 pb-24 pt-8 md:pb-28"
        : "flex flex-1 min-h-0 flex-col justify-center overflow-y-auto overflow-x-hidden px-1 pb-24 md:pb-28";

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
            {shouldRunDecorativeMotion ? (
              isPaperTheme ? (
                <OrbDayFlourish />
              ) : (
                <ShootingStar />
              )
            ) : null}
          </div>

          <div
            className={cn(
              "relative z-10 mx-auto flex h-[var(--app-viewport-height)] w-full min-w-0 max-w-3xl flex-col overflow-x-hidden px-4 pb-[calc(var(--safe-bottom)+1rem)] md:px-6 md:pb-[calc(var(--safe-bottom)+1.5rem)]",
              pageChromePaddingClass
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
                handleBackStep={handleBackStep}
                handleOpenDiary={handleOpenDiary}
              />
            )}
          </div>
        </main>
      </Bloom>

      <OrbAmbienceControl audioSrc={ORB_AMBIENCE_AUDIO_SRC} tx={tx} />

      <MoodFirstRunHint eligible={firstRunEligible} />
    </>
  );
});
