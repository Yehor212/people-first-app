import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useThemeStore } from "@/stores/themeStore";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { EmotionTagGrid } from "@/components/state-of-mind/EmotionTagGrid";
import { isSensitiveTag } from "@/components/state-of-mind/emotionTags";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { haptics } from "@/lib/haptics";
import { CosmicBgAdapter } from "./CosmicBgAdapter";
import { useCosmicParallax } from "./useCosmicParallax";
import { ShootingStar } from "./ShootingStar";
import { CinematicHeading } from "./CinematicHeading";
import { MoodScopeSelector } from "./MoodScopeSelector";
import { ValenceSlider } from "@/components/state-of-mind/ValenceSlider";
import { MoodConfirmCta } from "./MoodConfirmCta";
import { MoodFirstRunHint } from "./MoodFirstRunHint";
import { useOrbMoodFlow } from "./useOrbMoodFlow";
import { useUserDataStore } from "@/stores";
import type { MoodEntry } from "@/types";

/**
 * OrbPage — Phase 3-A.2 cosmic cinematic mindfulness surface with
 * Phase 3-A.4b complete mood entry flow (scope + emotion + confirm + auto-flow).
 *
 * Visual: CosmicBgAdapter + ShootingStar + glass chips over the cosmic
 * aesthetic. Paper theme swaps to warm day variant via orb-day-scope class.
 *
 * Flow orchestration lives in useOrbMoodFlow() — this file is presentational.
 */

function pickGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

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

export const OrbPage = memo(function OrbPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const parallaxRef = useCosmicParallax<HTMLDivElement>();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  const setMoods = useUserDataStore((s) => s.setMoods);

  const scopeClass =
    appliedTheme === "paper" ? "orb-day-scope" : "dark orb-cosmic-scope";

  const {
    userName,
    orbValence,
    auraHue,
    shouldAnimate,
    draftValence,
    draftEmotion,
    valenceChosen,
    confirmEnabled,
    firstRunEligible,
    handleSliderDraft,
    handleSliderCommit,
    handleEmotionToggle,
    handleConfirm,
    handleSkip,
  } = useOrbMoodFlow();

  const [showStateOfMind, setShowStateOfMind] = useState(false);

  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const greetingKey = pickGreetingKey();
  const greetingText = tx[greetingKey] || "Hello";
  const whisperKey = useMemo(() => pickWhisperKey(), []);
  const whisperText = tx[whisperKey] || "How's your heart today?";

  const auraRef = useRef<HTMLDivElement>(null);
  const handleOrbTap = useCallback(() => {
    void haptics.tabChanged();
    const node = auraRef.current;
    if (node && shouldAnimate) {
      node.setAttribute("data-orb-pulse", "true");
      setTimeout(() => node.removeAttribute("data-orb-pulse"), 650);
    }
    setShowStateOfMind(true);
  }, [shouldAnimate]);

  const handleModalSave = useCallback(
    (entry: MoodEntry) => {
      const stamped = { ...entry, updatedAt: entry.updatedAt || Date.now() };
      setMoods((prev) => [...prev, stamped]);
      setShowStateOfMind(false);
    },
    [setMoods],
  );

  return (
    <Bloom key="orb-page" transition={staggerDelay("primary")}>
      <main
        id="main-content-v2"
        role="main"
        tabIndex={-1}
        className={`${scopeClass} relative min-h-screen overflow-hidden outline-none`}
        aria-labelledby="orb-page-heading"
        data-testid="orb-page"
      >
        <CosmicBgAdapter />

        <div
          ref={parallaxRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          data-testid="cosmic-orb-flourish-layer"
        >
          <ShootingStar />
        </div>

        <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
          <Bloom key="orb-greeting" transition={staggerDelay("chrome")}>
            <div ref={h1Ref} tabIndex={-1} className="outline-none">
              <CinematicHeading
                id="orb-page-heading"
                leadText={`${greetingText}, `}
                emphasis={userName === "Friend" ? (tx.defaultUserName || "Friend") : userName}
                className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-foreground text-center outline-none"
              />
            </div>
          </Bloom>

          <Bloom key="orb-hero" transition={staggerDelay("primary")}>
            <div className="mt-12 md:mt-16 flex items-center justify-center">
              <div
                className="relative orb-page-rim-glow"
                data-orb-breathing={shouldAnimate ? "true" : "false"}
                style={{ "--orb-aura-hue": auraHue } as React.CSSProperties}
              >
                <div
                  ref={auraRef}
                  className="orb-aura"
                  data-testid="orb-aura"
                  data-aura-hue={auraHue}
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={handleOrbTap}
                  aria-label={tx.somLogFeeling || "Log how you feel"}
                  data-testid="orb-page-hero"
                  className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background transition-transform duration-200 active:scale-[0.98]"
                >
                  <div className="block md:hidden">
                    <ValenceOrb valence={orbValence} size={280} />
                  </div>
                  <div className="hidden md:block">
                    <ValenceOrb valence={orbValence} size={360} />
                  </div>
                </button>
              </div>
            </div>
          </Bloom>

          <Bloom key="orb-whisper" transition={staggerDelay("secondary")}>
            <p
              data-testid="orb-page-whisper"
              data-whisper-key={whisperKey}
              className="mt-10 md:mt-12 text-center font-serif italic text-lg md:text-xl text-muted-foreground tracking-wide"
            >
              {whisperText}
            </p>
          </Bloom>

          <Bloom key="orb-scope" transition={staggerDelay("secondary")}>
            <div className="mt-6 md:mt-8" data-testid="orb-page-scope">
              <MoodScopeSelector />
            </div>
          </Bloom>

          <Bloom key="orb-picker" transition={staggerDelay("cta")}>
            <div
              className="mx-auto mt-6 md:mt-8"
              data-testid="orb-page-picker"
            >
              <ValenceSlider
                value={draftValence ?? 0}
                onChange={(v) => {
                  handleSliderDraft(v);
                  handleSliderCommit(v);
                }}
              />
            </div>
          </Bloom>

          {valenceChosen && draftValence !== null && (
            <Bloom key="orb-emotion" transition={staggerDelay("cta")}>
              <div
                className="mx-auto mt-8 max-w-xl px-2"
                data-testid="orb-page-emotion-spectrum"
              >
                <EmotionTagGrid
                  valence={draftValence}
                  selected={draftEmotion ? [draftEmotion] : []}
                  onToggle={handleEmotionToggle}
                  expandable
                />
              </div>
            </Bloom>
          )}

          {valenceChosen && (
            <div data-testid="orb-page-confirm">
              <MoodConfirmCta
                enabled={confirmEnabled}
                onConfirm={handleConfirm}
                onSkip={handleSkip}
              />
              {draftEmotion && isSensitiveTag(draftEmotion) && (
                <div className="mt-3 flex justify-center">
                  <a
                    href="/support"
                    data-testid="mood-support-link"
                    className={[
                      "text-xs transition-colors",
                      appliedTheme === "paper"
                        ? "text-warm-brown-ink/50 hover:text-primary"
                        : "text-white/50 hover:text-primary",
                    ].join(" ")}
                    onClick={(e) => {
                      // Future: route to /support. For now, soft intent signal only.
                      e.preventDefault();
                    }}
                  >
                    {tx.moodSupportLink || "Need support?"}
                  </a>
                </div>
              )}
            </div>
          )}
        </div>
      </main>

      <StateOfMindModal
        isOpen={showStateOfMind}
        onClose={() => setShowStateOfMind(false)}
        onSave={handleModalSave}
      />

      <MoodFirstRunHint eligible={firstRunEligible} />
    </Bloom>
  );
});
