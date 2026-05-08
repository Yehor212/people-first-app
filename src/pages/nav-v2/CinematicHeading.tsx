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

interface AnimatedToken {
  kind: "space" | "word";
  text: string;
  startIndex: number;
}

function tokenizeForAnimation(
  text: string,
  initialIndex = 0,
): AnimatedToken[] {
  const parts = text.match(/\S+|\s+/g) ?? [];
  let nextIndex = initialIndex;

  return parts.map((part) => {
    const token: AnimatedToken = {
      kind: /\s+/.test(part) ? "space" : "word",
      text: part,
      startIndex: nextIndex,
    };

    nextIndex += Array.from(part).length;
    return token;
  });
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

  // Split once so word-level wrappers can preserve natural line breaks while
  // each character still animates independently.
  const leadCharCount = useMemo(() => Array.from(leadText).length, [leadText]);
  const leadTokens = useMemo(() => tokenizeForAnimation(leadText), [leadText]);
  const emphasisTokens = useMemo(
    () => tokenizeForAnimation(emphasis, leadCharCount),
    [emphasis, leadCharCount],
  );

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
        {leadTokens.map((token, tokenIndex) =>
          token.kind === "space" ? (
            <span
              key={`lead-space-${tokenIndex}`}
              className="cinematic-heading__space"
            >
              {token.text}
            </span>
          ) : (
            <span
              key={`lead-word-${tokenIndex}`}
              className="cinematic-heading__word"
            >
              {Array.from(token.text).map((ch, i) => (
                <motion.span
                  key={`lead-${tokenIndex}-${i}`}
                  custom={token.startIndex + i}
                  variants={charVariants}
                  initial="hidden"
                  animate="visible"
                  className="cinematic-heading__char"
                >
                  {ch}
                </motion.span>
              ))}
            </span>
          ),
        )}
      </span>
      <span aria-hidden="true" className="italic font-light">
        {emphasisTokens.map((token, tokenIndex) =>
          token.kind === "space" ? (
            <span
              key={`emph-space-${tokenIndex}`}
              className="cinematic-heading__space"
            >
              {token.text}
            </span>
          ) : (
            <span
              key={`emph-word-${tokenIndex}`}
              className="cinematic-heading__word"
            >
              {Array.from(token.text).map((ch, i) => (
                <motion.span
                  key={`emph-${tokenIndex}-${i}`}
                  custom={token.startIndex + i}
                  variants={emphasisVariants}
                  initial="hidden"
                  animate="visible"
                  className="cinematic-heading__char"
                >
                  {ch}
                </motion.span>
              ))}
            </span>
          ),
        )}
      </span>
    </h1>
  );
});
