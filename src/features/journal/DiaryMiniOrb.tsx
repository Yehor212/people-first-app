import { memo } from "react";

import { TypingDynamicsMirror } from "@/components/diary/TypingDynamicsMirror";
import type { MoodType } from "@/types";
import type { TypingDynamics } from "@/hooks/useTypingDynamics";

import { StickerRenderer } from "./StickerRenderer";
import { cn } from "@/lib/utils";

interface DiaryMiniOrbProps {
  mood?: MoodType | null;
  size?: "compact" | "hero";
  className?: string;
}

const MOOD_EMOJI: Record<MoodType, string> = {
  great: "\u{1F604}",
  good: "\u{1F642}",
  okay: "\u{1F610}",
  bad: "\u{1F614}",
  terrible: "\u{1F622}",
};

const NEUTRAL_DYNAMICS: TypingDynamics = {
  wpm: 10,
  rhythmRegularity: 0.86,
  backspaceRate: 0.04,
  isPaused: true,
  isTyping: false,
};

export const DiaryMiniOrb = memo(function DiaryMiniOrb({
  mood,
  size = "compact",
  className,
}: DiaryMiniOrbProps) {
  const isHero = size === "hero";

  return (
    <div
      className={cn(
        "relative isolate inline-flex shrink-0 items-center justify-center rounded-full border border-border/60 bg-card/85 backdrop-blur-md",
        isHero ? "h-14 w-14" : "h-11 w-11",
        className,
      )}
      aria-hidden="true"
    >
      <div className="absolute inset-0 rounded-full bg-primary/12 blur-lg" />
      <div className="absolute inset-[3px] rounded-full border border-primary/15" />

      <div className="relative z-[1] flex items-center justify-center">
        {mood ? (
          <StickerRenderer emoji={MOOD_EMOJI[mood]} size={isHero ? "sm" : "xs"} />
        ) : (
          <TypingDynamicsMirror dynamics={NEUTRAL_DYNAMICS} />
        )}
      </div>
    </div>
  );
});
