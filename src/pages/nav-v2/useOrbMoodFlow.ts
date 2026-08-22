import { useCallback, useMemo, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useGamificationStore, useUserDataStore } from "@/stores";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { commitMoodEntry } from "@/hooks/useMoodHandlers";
import { generateId, getToday } from "@/lib/utils";
import type { MoodEntry, MoodType } from "@/types";
import type { NavV2Page } from "@/hooks/useNavigationV2";

function valenceToMood(v: number): MoodType {
  if (v < -0.75) return "terrible";
  if (v < -0.25) return "bad";
  if (v < 0.25) return "okay";
  if (v < 0.75) return "good";
  return "great";
}

export const ORB_LISTENING_VALENCE = -0.143;

export type OrbFlowStep = "orb-select" | "refine-for-diary";

export interface UseOrbMoodFlowReturn {
  userName: string;
  orbValence: number;
  auraHue: number;
  shouldAnimate: boolean;
  step: OrbFlowStep;
  draftValence: number | null;
  resolvedValence: number;
  draftMood: MoodType;
  draftScope: "now" | "day" | "specific";
  draftSpecificTime: string | null;
  draftEmotion: string | null;
  draftNote: string;
  canProceedFromSelect: boolean;
  canOpenDiary: boolean;
  firstRunEligible: boolean;
  handleSliderCommit: (valence: number) => void;
  handleEmotionToggle: (tag: string) => void;
  handleNoteChange: (note: string) => void;
  handleNextStep: () => void;
  handleBackStep: () => void;
  handleSaveMood: () => void;
  handleOpenDiary: () => void;
}

interface UseOrbMoodFlowOptions {
  navigateToPage?: (page: NavV2Page) => void;
  onAddMood?: (entry: MoodEntry) => void;
}

export function useOrbMoodFlow(
  options: UseOrbMoodFlowOptions = {},
): UseOrbMoodFlowReturn {
  const shouldAnimate = useShouldAnimate();
  const navigateToPage = options.navigateToPage;
  const onAddMood = options.onAddMood;
  const [step, setStep] = useState<OrbFlowStep>("orb-select");

  const { moods, userName } = useUserDataStore(
    useShallow((s) => ({
      moods: s.moods,
      userName: s.userName,
    })),
  );

  const {
    draftValence,
    draftScope,
    draftSpecificTime,
    draftEmotion,
    draftNote,
    setDraftValence,
    setDraftEmotion,
    setDraftNote,
  } = useMoodEntryDraftStore(
    useShallow((s) => ({
      draftValence: s.valence,
      draftScope: s.scope,
      draftSpecificTime: s.specificTime,
      draftEmotion: s.emotion,
      draftNote: s.note,
      setDraftValence: s.setValence,
      setDraftEmotion: s.setEmotion,
      setDraftNote: s.setNote,
    })),
  );

  const setPendingMoodContext = useDiaryDraftStore(
    (s) => s.setPendingMoodContext,
  );

  const resolvedValence = draftValence ?? 0;
  const draftMood = useMemo(() => valenceToMood(resolvedValence), [resolvedValence]);

  const orbValence = draftValence ?? ORB_LISTENING_VALENCE;

  const auraHue = useMemo(() => {
    if (orbValence < 0) return 40 + (250 - 40) * Math.min(1, -orbValence);
    return 40 - (40 - 32) * Math.min(1, orbValence);
  }, [orbValence]);

  const canProceedFromSelect =
    draftScope !== "specific" || Boolean(draftSpecificTime);

  const canOpenDiary =
    step === "refine-for-diary" &&
    (draftScope !== "specific" || Boolean(draftSpecificTime));

  const handleSliderCommit = useCallback(
    (valence: number) => {
      setDraftValence(valence);
    },
    [setDraftValence],
  );

  const handleEmotionToggle = useCallback(
    (tag: string) => {
      setDraftEmotion(draftEmotion === tag ? null : tag);
    },
    [draftEmotion, setDraftEmotion],
  );

  const handleNoteChange = useCallback(
    (note: string) => {
      setDraftNote(note);
    },
    [setDraftNote],
  );

  const handleNextStep = useCallback(() => {
    if (!canProceedFromSelect) return;
    if (draftValence === null) {
      setDraftValence(0);
    }
    setStep("refine-for-diary");
  }, [canProceedFromSelect, draftValence, setDraftValence]);

  const handleBackStep = useCallback(() => {
    setStep("orb-select");
  }, []);

  const commitDraftMood = useCallback(() => {
    if (!canOpenDiary) return;

    const now = Date.now();
    const mood = valenceToMood(draftValence ?? 0);
    const note = draftNote.trim();
    const entry: MoodEntry = {
      id: generateId(),
      mood,
      valence: draftValence ?? 0,
      logType: draftScope === "day" ? "overall" : "momentary",
      emotionTags: draftEmotion ? [draftEmotion] : [],
      date: getToday(),
      timestamp: now,
      updatedAt: now,
    };

    if (onAddMood) {
      onAddMood(entry);
    } else {
      void commitMoodEntry(entry, {
        setMoods: useUserDataStore.getState()._publishDurableMoods,
        rewardUser: useGamificationStore.getState().rewardUser,
        updateChallengeProgress: () => undefined,
      });
    }

    return {
      mood,
      note,
      committedAt: now,
    };
  }, [
    canOpenDiary,
    draftEmotion,
    draftNote,
    draftScope,
    draftValence,
    onAddMood,
  ]);

  const resetFlow = useCallback(() => {
    useMoodEntryDraftStore.getState().reset();
    setStep("orb-select");
  }, []);

  const handleSaveMood = useCallback(() => {
    if (!commitDraftMood()) return;
    resetFlow();
  }, [commitDraftMood, resetFlow]);

  const handleOpenDiary = useCallback(() => {
    const committedMood = commitDraftMood();
    if (!committedMood) return;

    setPendingMoodContext({
      valence: draftValence ?? 0,
      mood: committedMood.mood,
      scope: draftScope,
      specificTime: draftSpecificTime,
      emotion: draftEmotion,
      note: committedMood.note || null,
      committedAt: committedMood.committedAt,
    });

    resetFlow();
    navigateToPage?.("diary");
  }, [
    commitDraftMood,
    draftEmotion,
    draftScope,
    draftSpecificTime,
    draftValence,
    navigateToPage,
    resetFlow,
    setPendingMoodContext,
  ]);

  return {
    userName: userName || "Friend",
    orbValence,
    auraHue,
    shouldAnimate,
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
    firstRunEligible: moods.length === 0,
    handleSliderCommit,
    handleEmotionToggle,
    handleNoteChange,
    handleNextStep,
    handleBackStep,
    handleSaveMood,
    handleOpenDiary,
  };
}
