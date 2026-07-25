import { memo } from "react";

import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import type { MoodType } from "@/types";
import { getDiaryMoodValence } from "./journalAura";

interface DiaryMiniOrbProps {
  mood?: MoodType | null;
  size?: "micro" | "calendar" | "compact" | "hero";
  className?: string;
}

export const DiaryMiniOrb = memo(function DiaryMiniOrb({
  mood,
  size = "compact",
  className,
}: DiaryMiniOrbProps) {
  const valence = getDiaryMoodValence(mood) ?? 0;

  const orbSize =
    size === "hero" ? "md" : size === "compact" ? "sm" : "xs";

  return (
    <MiniValenceOrb
      valence={valence}
      hasEntry={true}
      size={orbSize}
      chrome="badge"
      renderer="auto"
      containerClassName={className}
    />
  );
});
