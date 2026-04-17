import { memo, useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { Bloom } from "@/lib/motion";
import { staggerDelay } from "@/lib/motion/choreography";
import { useLanguage } from "@/contexts/LanguageContext";
import { useUserDataStore } from "@/stores";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { MoodSlider } from "@/features/journal";
import { StateOfMindModal } from "@/components/state-of-mind/StateOfMindModal";
import { getToday, generateId } from "@/lib/utils";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { haptics } from "@/lib/haptics";
import type { MoodEntry, MoodType } from "@/types";

/**
 * OrbPage — Phase 3-A.1 primary mindfulness surface.
 *
 * Composition (top → bottom, staggered entrance):
 *   1. Time-based greeting (font-display Fraunces, Law 22 sacred moment)
 *   2. ValenceOrb — the hero. Tap opens State of Mind modal for rich entry.
 *   3. MoodSlider — 5-detent quick entry.
 *
 * Design notes:
 *   - Greeting reuses i18n keys `goodMorning/goodAfternoon/goodEvening` from HomeTab
 *     (no new keys — stays orthogonal to V1 and avoids i18n regression).
 *   - ValenceOrb gets latest valence from today's moods (or 0 when empty).
 *   - Bloom staggers: background 0ms, greeting 80ms (chrome), orb 140ms (primary),
 *     slider 220ms (secondary).
 *   - Reduced motion: `useShouldAnimate()` gates Bloom — static frames still render.
 *   - a11y: main landmark + autofocused h1 so screen readers announce the page.
 */

function pickGreetingKey(): "goodMorning" | "goodAfternoon" | "goodEvening" {
  const hour = new Date().getHours();
  if (hour < 12) return "goodMorning";
  if (hour < 18) return "goodAfternoon";
  return "goodEvening";
}

export const OrbPage = memo(function OrbPage() {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const h1Ref = useRef<HTMLHeadingElement>(null);
  const shouldAnimate = useShouldAnimate();

  const { moods, userName, setMoods } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      userName: s.userName,
      setMoods: s.setMoods,
    })),
  );

  // Today's moods — drives orb valence + mood block subtext
  const todayMoods = useMemo(() => {
    const today = getToday();
    return moods.filter((m) => m.date === today);
  }, [moods]);

  const latestValence =
    todayMoods.length > 0 ? todayMoods[todayMoods.length - 1].valence ?? 0 : 0;

  // Orb idles with gentle oscillation when there's no entry yet — same pattern
  // as HomeTab's MiniOrbPreview but full-size. Avoids dead-looking hero.
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

  // Move focus to heading on mount so screen readers announce route change.
  useEffect(() => {
    h1Ref.current?.focus();
  }, []);

  const greetingKey = pickGreetingKey();
  const greetingText = tx[greetingKey] || "Hello";
  const displayName = userName || "Friend";

  const handleOrbTap = useCallback(() => {
    void haptics.tabChanged();
    setShowStateOfMind(true);
  }, []);

  // MoodSlider -> persist as MoodEntry. Slim write path (no gamification reward)
  // mirrors HomeTab's handleQuickMood shape but keeps OrbPage store-orthogonal.
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
        className="mx-auto max-w-3xl px-4 py-10 md:px-6 md:py-16 outline-none"
        aria-labelledby="orb-page-heading"
        data-testid="orb-page"
      >
        {/* Greeting — chrome stage (80ms stagger) */}
        <Bloom key="orb-greeting" transition={staggerDelay("chrome")}>
          <h1
            ref={h1Ref}
            id="orb-page-heading"
            tabIndex={-1}
            className="font-display text-3xl md:text-4xl font-semibold tracking-tight text-foreground outline-none"
          >
            {greetingText}, {displayName}
          </h1>
          <p className="mt-2 text-sm text-muted-foreground font-body">
            {tx.navV2OrbSubhead || tx.somLogFeeling || "How are you feeling?"}
          </p>
        </Bloom>

        {/* ValenceOrb — primary stage (140ms), tap to open State of Mind */}
        <Bloom key="orb-hero" transition={staggerDelay("primary")}>
          <div className="mt-10 flex items-center justify-center">
            <button
              type="button"
              onClick={handleOrbTap}
              aria-label={tx.somLogFeeling || "Log how you feel"}
              data-testid="orb-page-hero"
              className="rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-4 focus-visible:ring-offset-background transition-transform duration-200 active:scale-[0.98]"
            >
              <ValenceOrb valence={orbValence} size={240} />
            </button>
          </div>
        </Bloom>

        {/* MoodSlider — secondary stage (220ms) */}
        <Bloom key="orb-slider" transition={staggerDelay("secondary")}>
          <div
            className="mx-auto mt-10 max-w-md"
            data-testid="orb-page-slider"
          >
            <MoodSlider value={sliderValue} onChange={handleSliderChange} />
          </div>
        </Bloom>
      </main>

      <StateOfMindModal
        isOpen={showStateOfMind}
        onClose={() => setShowStateOfMind(false)}
        onSave={handleModalSave}
      />
    </Bloom>
  );
});
