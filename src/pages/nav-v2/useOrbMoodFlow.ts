import { useCallback, useEffect, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";
import { useUserDataStore } from "@/stores";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useNavigationV2 } from "@/hooks/useNavigationV2";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { getToday, generateId } from "@/lib/utils";
import type { MoodEntry, MoodType } from "@/types";

/** MoodType ↔ valence mapping used by the slider/draft bridge. */
const MOOD_TO_VALENCE: Record<MoodType, number> = {
  terrible: -1,
  bad: -0.5,
  okay: 0,
  good: 0.5,
  great: 1,
};

export interface UseOrbMoodFlowReturn {
  // snapshot
  moods: ReturnType<typeof useUserDataStore>["moods"];
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
  handleSliderChange: (mood: MoodType) => void;
  handleEmotionToggle: (tag: string) => void;
  handleConfirm: () => void;
  handleSkip: () => void;
}

/**
 * useOrbMoodFlow — Phase 3-A.4b state + handler orchestration.
 *
 * Extracted from OrbPage.tsx to keep the view file under the 400 LOC
 * god-component threshold. Owns:
 *  - Draft/valence/emotion state
 *  - Aura hue + idle oscillation
 *  - Confirm pipeline (persist → diary handoff → navigate)
 *  - Skip clearing
 *
 * Returns a flat object; OrbPage destructures and wires to JSX.
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

  // Gentle idle oscillation when no entry + no draft — keeps hero alive.
  const [oscillatedValence, setOscillatedValence] = useState(0);
  useEffect(() => {
    if (todayMoods.length > 0) return;
    if (draftValence !== null) return;
    if (!shouldAnimate) return;
    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOscillatedValence(Math.sin(frame * 0.1) * 0.4);
    }, 200);
    return () => clearInterval(id);
  }, [todayMoods.length, shouldAnimate, draftValence]);

  const orbValence =
    draftValence !== null
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

  const [sliderValue, setSliderValue] = useState<MoodType | undefined>(
    undefined,
  );

  const handleSliderChange = useCallback(
    (mood: MoodType) => {
      setSliderValue(mood);
      setDraftValence(MOOD_TO_VALENCE[mood]);
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
    const entry: MoodEntry = {
      id: generateId(),
      mood: sliderValue ?? "okay",
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
    setSliderValue(undefined);
    setActivePage("diary");
  }, [
    draftValence,
    draftEmotion,
    draftScope,
    draftSpecificTime,
    sliderValue,
    setMoods,
    setPendingMoodContext,
    setActivePage,
  ]);

  const handleSkip = useCallback(() => {
    useMoodEntryDraftStore.getState().reset();
    setSliderValue(undefined);
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
    handleSliderChange,
    handleEmotionToggle,
    handleConfirm,
    handleSkip,
  };
}
