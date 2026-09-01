import { useCallback, useMemo, useRef, useState } from "react";
import { useShallow } from "zustand/react/shallow";

import { useGamificationStore, useUserDataStore } from "@/stores";
import { useMoodEntryDraftStore } from "@/stores/moodEntryDraftStore";
import { useDiaryDraftStore } from "@/stores/diaryDraftStore";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { isDataWriteBarrierPostCommitError } from "@/hooks/useIndexedDB";
import { commitMoodEntry } from "@/hooks/useMoodHandlers";
import { logger } from "@/lib/logger";
import { generateId, getToday } from "@/lib/utils";
import { persistMoodEntryBeforeTransition } from "@/storage/repositories/moodsRepo";
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
  isSavingMood: boolean;
  moodSaveFailed: boolean;
  handleSliderCommit: (valence: number) => void;
  handleEmotionToggle: (tag: string) => void;
  handleNoteChange: (note: string) => void;
  handleNextStep: () => void;
  handleBackStep: () => void;
  handleSaveMood: () => Promise<void>;
  handleOpenDiary: () => Promise<void>;
  handleSkip: () => void;
}

interface UseOrbMoodFlowOptions {
  navigateToPage?: (page: NavV2Page) => void;
  onAddMood?: (entry: MoodEntry) => void | Promise<void>;
}

export function useOrbMoodFlow(options: UseOrbMoodFlowOptions = {}): UseOrbMoodFlowReturn {
  const shouldAnimate = useShouldAnimate();
  const navigateToPage = options.navigateToPage;
  const onAddMood = options.onAddMood;
  const [step, setStep] = useState<OrbFlowStep>("orb-select");
  const [isSavingMood, setIsSavingMood] = useState(false);
  const [moodSaveFailed, setMoodSaveFailed] = useState(false);
  const saveInFlightRef = useRef(false);

  const userName = useUserDataStore((s) => s.userName);

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
    }))
  );

  const setPendingMoodContext = useDiaryDraftStore((s) => s.setPendingMoodContext);

  const resolvedValence = draftValence ?? 0;
  const draftMood = useMemo(() => valenceToMood(resolvedValence), [resolvedValence]);

  const orbValence = draftValence ?? ORB_LISTENING_VALENCE;

  const auraHue = useMemo(() => {
    if (orbValence < 0) return 40 + (250 - 40) * Math.min(1, -orbValence);
    return 40 - (40 - 32) * Math.min(1, orbValence);
  }, [orbValence]);

  const canProceedFromSelect = draftScope !== "specific" || Boolean(draftSpecificTime);

  const canOpenDiary =
    step === "refine-for-diary" &&
    (draftScope !== "specific" || Boolean(draftSpecificTime));

  const handleSliderCommit = useCallback(
    (valence: number) => {
      setDraftValence(valence);
    },
    [setDraftValence]
  );

  const handleEmotionToggle = useCallback(
    (tag: string) => {
      setDraftEmotion(draftEmotion === tag ? null : tag);
    },
    [draftEmotion, setDraftEmotion]
  );

  const handleNoteChange = useCallback(
    (note: string) => {
      setDraftNote(note);
    },
    [setDraftNote]
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

  const commitCurrentMood = useCallback(async (prepareDiaryHandoff: boolean) => {
    if (!canOpenDiary || saveInFlightRef.current) return false;

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

    saveInFlightRef.current = true;
    setIsSavingMood(true);
    setMoodSaveFailed(false);
    let durableEntry = entry;
    try {
      try {
        await persistMoodEntryBeforeTransition(entry);
      } catch (error) {
        if (
          isDataWriteBarrierPostCommitError<MoodEntry>(error) &&
          error.committedValue.id === entry.id
        ) {
          durableEntry = error.committedValue;
          logger.warn(
            "[OrbPage] Mood persisted; mounted-state finalization remains incomplete:",
            error.issueKinds,
          );
        } else {
          logger.error("[OrbPage] Mood persistence failed before transition:", error);
          setMoodSaveFailed(true);
          return false;
        }
      }

      try {
        if (onAddMood) {
          await onAddMood(durableEntry);
        } else {
          await commitMoodEntry(durableEntry, {
            setMoods: useUserDataStore.getState()._publishDurableMoods,
            rewardUser: useGamificationStore.getState().rewardUser,
            updateChallengeProgress: () => undefined,
          });
        }
      } catch (error) {
        logger.error("[OrbPage] Mood post-commit side effect failed:", error);
      }

      if (prepareDiaryHandoff) {
        setPendingMoodContext({
          valence: draftValence ?? 0,
          mood,
          scope: draftScope,
          specificTime: draftSpecificTime,
          emotion: draftEmotion,
          note: note || null,
          committedAt: now,
        });
      }

      useMoodEntryDraftStore.getState().reset();
      setStep("orb-select");
      return true;
    } finally {
      saveInFlightRef.current = false;
      setIsSavingMood(false);
    }
  }, [
    canOpenDiary,
    draftEmotion,
    draftNote,
    draftScope,
    draftSpecificTime,
    draftValence,
    onAddMood,
    setPendingMoodContext,
  ]);

  const handleSaveMood = useCallback(async () => {
    await commitCurrentMood(false);
  }, [commitCurrentMood]);

  const handleOpenDiary = useCallback(async () => {
    if (!(await commitCurrentMood(true))) return;
    navigateToPage?.("diary");
  }, [commitCurrentMood, navigateToPage]);

  const handleSkip = useCallback(() => {
    useMoodEntryDraftStore.getState().reset();
    setStep("orb-select");
  }, []);

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
    isSavingMood,
    moodSaveFailed,
    handleSliderCommit,
    handleEmotionToggle,
    handleNoteChange,
    handleNextStep,
    handleBackStep,
    handleSaveMood,
    handleOpenDiary,
    handleSkip,
  };
}
