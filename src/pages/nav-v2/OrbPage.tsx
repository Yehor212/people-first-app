import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserDataStore } from "@/stores";
import { useThemeStore } from "@/stores/themeStore";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { MoodSlider } from "@/features/journal";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { getToday, generateId } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { haptics } from "@/lib/haptics";
import { CosmicBgAdapter } from "./CosmicBgAdapter";
import { useCosmicParallax } from "./useCosmicParallax";
import { ShootingStar } from "./ShootingStar";
import { CinematicHeading } from "./CinematicHeading";
import type { MoodEntry, MoodType } from "@/types";

/**
 * OrbPage — Phase 3-A.2 cinematic mindfulness surface.
 *
 * WOW factor mandate:
 *   - Cosmic backdrop (theme-aware stars + nebula) fills full page, z-0.
 *   - Orb hero enlarged (320px desktop / 256px mobile) with ambient rim glow.
 *   - Greeting in Fraunces display at 3xl/5xl — literary companion tone.
 *   - Whisper subtitle in Fraunces italic — rotates daily through 5 prompts.
 *   - MoodSlider shown WITHOUT emoji row — track + thumb only, minimal.
 *
 * Composition (top → bottom, staggered entrance):
 *   1. CosmicBgAdapter + ShootingStar flourish (z-0, no stagger — paints first frame)
 *   2. Greeting — chrome stage (80ms)
 *   3. ValenceOrb hero — primary stage (140ms) + ambient rim glow
 *   4. Whisper subtitle — secondary stage (220ms)
 *   5. MoodSlider (no emojis) — cta stage (360ms)
 *
 * Stagger uses the existing `stages` ladder — we remap roles:
 *   greeting → chrome, orb → primary, subtitle → secondary, slider → cta.
 *
 * Reduced motion: useShouldAnimate() gates the oscillation + nebula pulse.
 *   Static frames still render (cosmic bg, orb, greeting, slider all visible).
 *
 * a11y: <main> landmark + autofocused h1 + aria-labelledby. Whisper has no
 *   aria-live — rotation is date-deterministic, not per-interaction.
 */

function pickGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

/** Whisper prompts cycle daily — deterministic by date-of-month so every
 * device in the same day sees the same prompt. No randomness per mount. */
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
  const shouldAnimate = useShouldAnimate();
  const parallaxRef = useCosmicParallax<HTMLDivElement>();
  const appliedTheme = useThemeStore((s) => s.appliedTheme);

  // Phase 3-A.4a-day: scope class switches between cosmic dark (ink/oled) and
  // warm paper variant. Paper scope flips Tailwind foreground tokens so greeting
  // + whisper resolve to warm brown-ink (≥4.5:1 contrast on all 5 palettes).
  const scopeClass =
    appliedTheme === "paper" ? "orb-day-scope" : "dark orb-cosmic-scope";

  const { moods, userName, setMoods } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      userName: s.userName,
      setMoods: s.setMoods,
    })),
  );

  // Today's moods — drives orb valence
  const todayMoods = useMemo(() => {
    const today = getToday();
    return moods.filter((m) => m.date === today);
  }, [moods]);

  const latestValence =
    todayMoods.length > 0 ? todayMoods[todayMoods.length - 1].valence ?? 0 : 0;

  // Gentle idle oscillation when no entry yet — keeps hero alive.
  const [oscillatedValence, setOscillatedValence] = useState(0);
  useEffect(() => {
    if (todayMoods.length > 0) return;
    if (!shouldAnimate) return;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOscillatedValence(Math.sin(frame * 0.1) * 0.4);
    }, 200);
    return () => clearInterval(id);
  }, [todayMoods.length, shouldAnimate]);

  const orbValence = todayMoods.length > 0 ? latestValence : oscillatedValence;

  const [showStateOfMind, setShowStateOfMind] = useState(false);

  // Move focus to heading on mount for screen readers.
  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const greetingKey = pickGreetingKey();
  const greetingText = tx[greetingKey] || "Hello";
  const displayName = userName || "Friend";

  // Date-deterministic whisper — memoised so tests can freeze time.
  const whisperKey = useMemo(() => pickWhisperKey(), []);
  const whisperText = tx[whisperKey] || "How's your heart today?";

  // WOW-4: reactive aura pulse — one-shot class toggle (CSS owns the keyframe).
  const auraRef = useRef<HTMLDivElement>(null);
  const handleOrbTap = useCallback(() => {
    void haptics.tabChanged();
    // Trigger one-shot pulse by flipping data-orb-pulse, clear after 650ms.
    const node = auraRef.current;
    if (node && shouldAnimate) {
      node.setAttribute("data-orb-pulse", "true");
      setTimeout(() => node.removeAttribute("data-orb-pulse"), 650);
    }
    setShowStateOfMind(true);
  }, [shouldAnimate]);

  // WOW-4: mood-derived aura hue (indigo when sad, cream neutral, amber when happy).
  const auraHue = useMemo(() => {
    // orbValence ranges roughly [-1, 1]. Map:
    //   -1 → 250 (indigo), 0 → 40 (cream), +1 → 32 (amber).
    if (orbValence < 0) return 40 + (250 - 40) * Math.min(1, -orbValence);
    return 40 - (40 - 32) * Math.min(1, orbValence);
  }, [orbValence]);

  // MoodSlider → MoodEntry. Slim write path (no gamification reward).
  const [sliderValue, setSliderValue] = useState<MoodType | undefined>(undefined);
  const handleSliderChange = useCallback(
    (mood: MoodType) => {
      setSliderValue(mood);
      const now = Date.now();
      const entry: MoodEntry = {
        id: generateId(),
        mood,
        date: getToday(),
        timestamp: now,
        updatedAt: now,
      };
      setMoods((prev) => [...prev, entry]);
    },
    [setMoods],
  );

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
        {/* Cosmic backdrop — reuses proven focus-timer CosmicBackground visual
           * layers via CosmicBgAdapter (Phase 3-A.4a). Paints behind everything,
           * pointer-events: none. */}
        <CosmicBgAdapter />

        {/* Parallax + cinematic flourishes layer (Phase 3-A.3 WOW-1/WOW-3) —
           * sits atop cosmic backdrop, under content. Parallax ref writes
           * CSS --parallax-x/y consumed by inner ShootingStar for drift. */}
        <div
          ref={parallaxRef}
          aria-hidden="true"
          className="pointer-events-none absolute inset-0 z-0 overflow-hidden"
          data-testid="cosmic-orb-flourish-layer"
        >
          <ShootingStar />
        </div>

        {/* Content layer — sits above cosmic background */}
        <div className="relative z-10 mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16">
          {/* Greeting — chrome stage (80ms), literary display type.
             * WOW-5: CinematicHeading splits into leading text + italic emphasis
             * and staggers characters with 50ms delay + SOFT axis animation
             * on the emphasis word. Falls back to static text when reduced-motion. */}
          <Bloom key="orb-greeting" transition={staggerDelay("chrome")}>
            <div ref={h1Ref} tabIndex={-1} className="outline-none">
              <CinematicHeading
                id="orb-page-heading"
                leadText={`${greetingText}, `}
                emphasis={displayName}
                className="font-display text-3xl md:text-5xl font-semibold tracking-tight text-foreground text-center outline-none"
              />
            </div>
          </Bloom>

          {/* ValenceOrb hero — primary stage (140ms), enlarged + reactive aura.
             * WOW-4: `.orb-aura` ring behind the orb breathes at 4s cadence,
             * colour derives from mood valence (indigo→cream→amber), and tap
             * triggers a one-shot pulse via data-orb-pulse. */}
          <Bloom key="orb-hero" transition={staggerDelay("primary")}>
            <div className="mt-12 md:mt-16 flex items-center justify-center">
              <div
                className="relative orb-page-rim-glow"
                data-orb-breathing={shouldAnimate ? "true" : "false"}
                style={{ "--orb-aura-hue": auraHue } as React.CSSProperties}
              >
                {/* Breathing aura — painted behind the orb button */}
                <div
                  ref={auraRef}
                  className="orb-aura"
                  data-testid="orb-aura"
                  aria-hidden="true"
                />
                <button
                  type="button"
                  onClick={handleOrbTap}
                  aria-label={tx.somLogFeeling || "Log how you feel"}
                  data-testid="orb-page-hero"
                  className="relative rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background transition-transform duration-200 active:scale-[0.98]"
                >
                  {/* Mobile: 256px, Desktop: 320px — mobile sized via CSS wrapper */}
                  <div className="block md:hidden">
                    <ValenceOrb valence={orbValence} size={256} />
                  </div>
                  <div className="hidden md:block">
                    <ValenceOrb valence={orbValence} size={320} />
                  </div>
                </button>
              </div>
            </div>
          </Bloom>

          {/* Whisper subtitle — secondary stage (220ms), italic Fraunces ethereal */}
          <Bloom key="orb-whisper" transition={staggerDelay("secondary")}>
            <p
              data-testid="orb-page-whisper"
              data-whisper-key={whisperKey}
              className="mt-10 md:mt-12 text-center font-serif italic text-lg md:text-xl text-muted-foreground tracking-wide"
            >
              {whisperText}
            </p>
          </Bloom>

          {/* MoodSlider — cta stage (360ms), NO emojis, minimal track + thumb */}
          <Bloom key="orb-slider" transition={staggerDelay("cta")}>
            <div
              className="mx-auto mt-8 md:mt-10 max-w-md"
              data-testid="orb-page-slider"
            >
              <MoodSlider
                value={sliderValue}
                onChange={handleSliderChange}
                showEmojis={false}
              />
            </div>
          </Bloom>
        </div>
      </main>

      <StateOfMindModal
        isOpen={showStateOfMind}
        onClose={() => setShowStateOfMind(false)}
        onSave={handleModalSave}
      />
    </Bloom>
  );
});
