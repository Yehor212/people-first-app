import { memo } from "react";

import type { MoodType } from "@/types";

import { MiniValenceOrb } from "./MiniValenceOrb";

type CompactOrbSize = "xs" | "sm" | "md" | "lg";

interface CompactValenceOrbProps {
  valence?: number | null;
  mood?: MoodType | null;
  hasEntry?: boolean;
  size?: CompactOrbSize;
  className?: string;
}

function moodToValence(mood: MoodType | null | undefined): number {
  switch (mood) {
    case "great":
      return 0.9;
    case "good":
      return 0.55;
    case "bad":
      return -0.55;
    case "terrible":
      return -0.9;
    case "okay":
    default:
      return 0;
  }
}

function normalizeSize(size: CompactOrbSize): "sm" | "md" | "lg" {
  if (size === "xs" || size === "sm") return "sm";
  if (size === "lg") return "lg";
  return "md";
}

/**
 * @deprecated Prefer MiniValenceOrb with the canonical `size` + `chrome` API.
 * This wrapper exists only to keep older call sites stable while the compact
 * orb family converges on a single visual language.
 */
export const CompactValenceOrb = memo(function CompactValenceOrb({
  valence,
  mood,
  hasEntry = true,
  size = "md",
  className,
}: CompactValenceOrbProps) {
  const resolvedValence = typeof valence === "number" ? valence : moodToValence(mood);

  return (
    <MiniValenceOrb
      valence={resolvedValence}
      hasEntry={hasEntry}
      size={normalizeSize(size)}
      chrome="badge"
      containerClassName={className}
    />
  );
});
