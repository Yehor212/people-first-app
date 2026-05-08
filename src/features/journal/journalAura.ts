import type { MoodType } from "@/types";
import { valenceToColor, valenceToHSL } from "@/components/state-of-mind/colorUtils";

const DIARY_MOOD_VALENCE: Record<MoodType, number> = {
  great: 0.9,
  good: 0.55,
  okay: 0,
  bad: -0.55,
  terrible: -0.9,
};

export interface JournalAura {
  hsl: string;
  color: (alpha: number) => string;
}

function alpha(alphaValue: number): string {
  return Number(Math.max(0, Math.min(1, alphaValue)).toFixed(3)).toString();
}

export function getDiaryMoodValence(mood?: MoodType | null): number | null {
  if (!mood) return null;
  return DIARY_MOOD_VALENCE[mood] ?? null;
}

export function getDiaryAura(mood?: MoodType | null): JournalAura | null {
  const valence = getDiaryMoodValence(mood);
  if (valence === null) return null;

  const { h, s, l } = valenceToHSL(valence);
  const hsl = `${Math.round(h)} ${Math.round(s)}% ${Math.round(l)}%`;

  return {
    hsl,
    color: (opacity: number) => valenceToColor(valence, Number(alpha(opacity))),
  };
}
