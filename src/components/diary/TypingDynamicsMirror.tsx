import { memo, useMemo } from "react";

import { MiniValenceOrb } from "@/components/state-of-mind/MiniValenceOrb";
import { cn } from "@/lib/utils";
import type { TypingDynamics } from "@/hooks/useTypingDynamics";

interface TypingDynamicsMirrorProps {
  /** Current typing dynamics from useTypingDynamics hook. */
  dynamics: TypingDynamics;
}

function clampUnit(value: number): number {
  return Number.isFinite(value) ? Math.max(0, Math.min(1, value)) : 0;
}

function mapDynamicsToValence(dynamics: TypingDynamics): number {
  if (!dynamics.isTyping && dynamics.isPaused) {
    return 0;
  }

  const tempo = clampUnit(dynamics.wpm / 60);
  const rhythm = clampUnit(dynamics.rhythmRegularity);
  const editingPressure = clampUnit(dynamics.backspaceRate / 0.3);

  const flow = rhythm * 0.55 + tempo * 0.25 + (1 - editingPressure) * 0.2;
  const strain = editingPressure * 0.65 + (1 - rhythm) * 0.35;

  return Math.max(-0.667, Math.min(0.667, flow * 0.8 - strain * 0.75));
}

/**
 * 24px typing indicator rendered through the canonical orb family.
 *
 * Older builds had a separate mini WebGL shader here. That created a second
 * visual language for "orbs". Keep typing dynamics as an input signal, but
 * route the actual rendering through MiniValenceOrb -> ValenceOrb so every
 * visible orb shares the same glass material, superformula presets, and motion.
 */
export const TypingDynamicsMirror = memo(function TypingDynamicsMirror({
  dynamics,
}: TypingDynamicsMirrorProps) {
  const valence = useMemo(() => mapDynamicsToValence(dynamics), [dynamics]);

  return (
    <span
      aria-hidden="true"
      className="pointer-events-none inline-flex h-6 w-6 shrink-0 items-center justify-center"
      data-testid="typing-dynamics-mirror"
    >
      <MiniValenceOrb
        valence={valence}
        hasEntry
        size="xs"
        chrome="none"
        transitionProfile="v1-soft"
        containerClassName="h-6 w-6"
        orbClassName={cn(
          "scale-[0.28] transition-[filter,opacity] duration-500",
          dynamics.isTyping ? "opacity-100 brightness-[1.06]" : "opacity-70 brightness-95",
        )}
      />
    </span>
  );
});
