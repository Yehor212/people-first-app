import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserDataStore } from "@/stores";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useNavigationV2 } from "@/hooks/useNavigationV2";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { getToday, generateId } from "@/lib/utils";
import type { MoodEntry, MoodType } from "@/types";

/**
 * Bucket a continuous valence in [-1, 1] into one of the 5 Apple-style
 * MoodType enums. Matches the reverse direction of MoodSliderV2's snap stops.
 */
function valenceToMood(v: number): MoodType {
  if (v < -0.75) return "terrible";
  if (v < -0.25) return "bad";
  if (v < 0.25) return "okay";
  if (v < 0.75) return "good";
  return "great";
}

export interface UseOrbMoodFlowReturn {
  // snapshot
  moods: MoodEntry[];
  userName: string;
  todayMoods: MoodEntry[];
  orbValence: number;
  auraHue: number;
  shouldAnimate: boolean;
  // draft
  draftValence: number | null;
  draftEmotion: string | null;
  sliderValue: MoodType | undefined;
  valenceChosen: boolean;
  confirmEnabled: boolean;
  firstRunEligible: boolean;
  // handlers
  handleSliderDraft: (valence: number) => void;
  handleSliderCommit: (valence: number) => void;
  handleEmotionToggle: (tag: string) => void;
  handleConfirm: () => void;
  handleSkip: () => void;
}

/**
 * useOrbMoodFlow — Phase 3-A.4c-ii-d-d state + handler orchestration.
 *
 * Updated for MoodSliderV2 split-state model (draft vs committed):
 *  - `handleSliderDraft(valence)` — fires from rAF-throttled drag; updates
 *    a local ref that OrbPage reads into the hero ValenceOrb shader uniform.
 *    Does NOT write to the store (Law 14 — avoid store thrash on every frame).
 *  - `handleSliderCommit(valence)` — fires once on pointerup / Space / Enter;
 *    writes the final valence to the mood draft store (valence + bucketed mood)
 *    and unlocks the emotion grid via `valenceChosen = true`.
 *
 * Extracted from OrbPage.tsx to keep the view file under the 400 LOC
 * god-component threshold. Owns:
 *  - Draft/valence/emotion state
 *  - Aura hue + idle oscillation
 *  - Confirm pipeline (persist → diary handoff → navigate)
 *  - Skip clearing
 */
export function useOrbMoodFlow(): UseOrbMoodFlowReturn {
  const shouldAnimate = useShouldAnimate();
  const { setActivePage } = useNavigationV2();

  const { moods, userName, setMoods } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      userName: s.userName,
      setMoods: s.setMoods,
    })),
  );

  const {
    draftValence,
    draftScope,
    draftSpecificTime,
    draftEmotion,
    setDraftValence,
    setDraftEmotion,
    isDraftComplete,
  } = useMoodEntryDraftStore(
    useShallow((s) => ({
      draftValence: s.valence,
      draftScope: s.scope,
      draftSpecificTime: s.specificTime,
      draftEmotion: s.emotion,
      setDraftValence: s.setValence,
      setDraftEmotion: s.setEmotion,
      isDraftComplete: s.isComplete,
    })),
  );

  const setPendingMoodContext = useDiaryDraftStore(
    (s) => s.setPendingMoodContext,
  );

  const todayMoods = useMemo(() => {
    const today = getToday();
    return moods.filter((m) => m.date === today);
  }, [moods]);

  const latestValence =
    todayMoods.length > 0 ? (todayMoods[todayMoods.length - 1].valence ?? 0) : 0;

  // Live-drag valence from the slider — overrides committed draft during a
  // gesture so the hero orb morphs in real time without store re-renders.
  const [liveDragValence, setLiveDragValence] = useState<number | null>(null);

  // Gentle idle oscillation when no entry + no draft — keeps hero alive.
  const [oscillatedValence, setOscillatedValence] = useState(0);
  useEffect(() => {
    if (todayMoods.length > 0) return;
    if (draftValence !== null) return;
    if (liveDragValence !== null) return;
    if (!shouldAnimate) return;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOscillatedValence(Math.sin(frame * 0.1) * 0.4);
    }, 200);
    return () => clearInterval(id);
  }, [todayMoods.length, shouldAnimate, draftValence, liveDragValence]);

  const orbValence =
    liveDragValence !== null
      ? liveDragValence
      : draftValence !== null
        ? draftValence
        : todayMoods.length > 0
          ? latestValence
          : oscillatedValence;

  const auraHue = useMemo(() => {
    if (orbValence < 0) return 40 + (250 - 40) * Math.min(1, -orbValence);
    return 40 - (40 - 32) * Math.min(1, orbValence);
  }, [orbValence]);

  // Clean draft on unmount (use getState to avoid churn from shallow selectors)
  useEffect(
    () => () => {
      useMoodEntryDraftStore.getState().reset();
    },
    [],
  );

  // sliderValue (MoodType) is derived from the committed draftValence — stays
  // in sync with the store so legacy consumers (MoodConfirmCta, tests) see
  // the bucketed label. Recomputed only when the committed value changes.
  const sliderValue = useMemo<MoodType | undefined>(() => {
    if (draftValence === null) return undefined;
    return valenceToMood(draftValence);
  }, [draftValence]);

  const handleSliderDraft = useCallback((valence: number) => {
    setLiveDragValence(valence);
  }, []);

  const handleSliderCommit = useCallback(
    (valence: number) => {
      setLiveDragValence(null);
      setDraftValence(valence);
    },
    [setDraftValence],
  );

  const handleEmotionToggle = useCallback(
    (tag: string) => {
      if (draftEmotion === tag) {
        setDraftEmotion(null);
      } else {
        setDraftEmotion(tag);
      }
    },
    [draftEmotion, setDraftEmotion],
  );

  const handleConfirm = useCallback(() => {
    if (draftValence === null || !draftEmotion) return;
    const now = Date.now();
    const bucketed = valenceToMood(draftValence);
    const entry: MoodEntry = {
      id: generateId(),
      mood: bucketed,
      valence: draftValence,
      logType: draftScope === "day" ? "overall" : "momentary",
      emotionTags: [draftEmotion],
      date: getToday(),
      timestamp: now,
      updatedAt: now,
    };
    setMoods((prev) => [...prev, entry]);
    setPendingMoodContext({
      valence: draftValence,
      scope: draftScope,
      specificTime: draftSpecificTime,
      emotion: draftEmotion,
      committedAt: now,
    });
    useMoodEntryDraftStore.getState().reset();
    setLiveDragValence(null);
    setActivePage("diary");
  }, [
    draftValence,
    draftEmotion,
    draftScope,
    draftSpecificTime,
    setMoods,
    setPendingMoodContext,
    setActivePage,
  ]);

  const handleSkip = useCallback(() => {
    useMoodEntryDraftStore.getState().reset();
    setLiveDragValence(null);
  }, []);

  return {
    moods,
    userName: userName || "Friend",
    todayMoods,
    orbValence,
    auraHue,
    shouldAnimate,
    draftValence,
    draftEmotion,
    sliderValue,
    valenceChosen: draftValence !== null,
    confirmEnabled: isDraftComplete(),
    firstRunEligible: moods.length === 0,
    handleSliderDraft,
    handleSliderCommit,
    handleEmotionToggle,
    handleConfirm,
    handleSkip,
  };
}
