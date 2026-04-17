/**
 * CinematicHeading — Phase 3-A.3 A+++ WOW-5 (character-staggered entrance).
 *
 * Splits the greeting into two segments (leading text + italic emphasis) and
 * staggers each character with a 50ms delay + 6px y-shift. The italic segment
 * animates the Fraunces `SOFT` axis from 0→50 over 800ms so the word literally
 * softens as it appears — only the emphasis span touches `font-variation-
 * settings`, keeping the rest of the heading on fast char fades.
 *
 * Gating:
 *   - useShouldAnimate() false → full text renders instantly, no animation.
 *   - One-shot on mount — no re-trigger on re-render (variants key = mount-id).
 *
 * Accessibility:
 *   - `aria-label` provides the full sentence as a single string for screen
 *     readers; visual <span>s carry `aria-hidden` so SRs don't read char-by-
 *     char gibberish.
 *   - Autofocus handled by parent (OrbPage) — we don't manage focus here.
 *
 * Law 8 (60fps): transform + opacity only; `font-variation-settings` animates
 *   on a single node, not per character.
 */

import { memo, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import "./CinematicHeading.css";

interface CinematicHeadingProps {
  /** Plain leading text, e.g. "Good morning, " */
  leadText: string;
  /** Italic emphasis segment, e.g. "Friend" */
  emphasis: string;
  /** Extra className for the outer <h1>. */
  className?: string;
  /** HTML id for aria-labelledby wiring. */
  id?: string;
  /** Forwarded ref via render prop pattern — we intentionally don't use a DOM
   *  ref here because parent OrbPage needs focus mgmt via its own ref. */
}

const charVariants = {
  hidden: { opacity: 0, y: 6 },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    transition: {
      delay: i * 0.05,
      duration: 0.4,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

const emphasisVariants = {
  hidden: { opacity: 0, y: 6, fontVariationSettings: '"SOFT" 0' },
  visible: (i: number) => ({
    opacity: 1,
    y: 0,
    fontVariationSettings: '"SOFT" 50',
    transition: {
      delay: i * 0.05,
      duration: 0.6,
      ease: [0.25, 0.1, 0.25, 1] as const,
    },
  }),
};

export const CinematicHeading = memo(function CinematicHeading({
  leadText,
  emphasis,
  className = "",
  id,
}: CinematicHeadingProps) {
  const shouldAnimate = useShouldAnimate();
  const prefersReduced = useReducedMotion();
  const animated = shouldAnimate && !prefersReduced;

  // Split into character arrays once — stable across re-renders.
  const leadChars = useMemo(() => Array.from(leadText), [leadText]);
  const emphasisChars = useMemo(() => Array.from(emphasis), [emphasis]);
  const leadCharsCount = leadChars.length;

  // Full aria text — screen readers get clean sentence, not char-by-char.
  const ariaLabel = `${leadText}${emphasis}`;

  if (!animated) {
    return (
      <h1
        id={id}
        className={className}
        aria-label={ariaLabel}
        data-testid="cinematic-heading"
        data-animated="false"
      >
        <span aria-hidden="true">{leadText}</span>
        <span
          aria-hidden="true"
          className="italic font-light cinematic-heading__soft-static"
        >
          {emphasis}
        </span>
      </h1>
    );
  }

  return (
    <h1
      id={id}
      className={className}
      aria-label={ariaLabel}
      data-testid="cinematic-heading"
      data-animated="true"
    >
      <span aria-hidden="true">
        {leadChars.map((ch, i) => (
          <motion.span
            key={`lead-${i}`}
            custom={i}
            variants={charVariants}
            initial="hidden"
            animate="visible"
            className="cinematic-heading__char"
          >
            {ch}
          </motion.span>
        ))}
      </span>
      <span aria-hidden="true" className="italic font-light">
        {emphasisChars.map((ch, i) => (
          <motion.span
            key={`emph-${i}`}
            custom={leadCharsCount + i}
            variants={emphasisVariants}
            initial="hidden"
            animate="visible"
            className="cinematic-heading__char"
          >
            {ch}
          </motion.span>
        ))}
      </span>
    </h1>
  );
});
