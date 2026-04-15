import { useEffect, useRef } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { shouldAnimate } from "@/lib/animationUtils";
import { GreatEmoji } from "./GreatEmoji";
import { GoodEmoji } from "./GoodEmoji";
import { OkayEmoji } from "./OkayEmoji";
import { BadEmoji } from "./BadEmoji";
import { TerribleEmoji } from "./TerribleEmoji";

interface AnimatedMoodEmojiProps {
  mood: "great" | "good" | "okay" | "bad" | "terrible";
  size?: "sm" | "md" | "lg" | "xl";
  isSelected?: boolean;
  /** True when any mood is selected (used to dim unselected emojis) */
  hasSelection?: boolean;
  className?: string;
}

const sizeClasses = {
  sm: "w-8 h-8",
  md: "w-10 h-10",
  lg: "w-12 h-12",
  xl: "w-16 h-16",
};

const emojiComponents = {
  great: GreatEmoji,
  good: GoodEmoji,
  okay: OkayEmoji,
  bad: BadEmoji,
  terrible: TerribleEmoji,
};

/** Spring bounce config — underdamped (damping 12) overshoots to ~1.3 before settling at 1.1 */
const springBounce = { type: "spring" as const, stiffness: 400, damping: 12, mass: 0.8 };

/** Deselection fade config — 200ms easeOut */
const deselectTransition = { duration: 0.2, ease: "easeOut" as const };

function getAnimateProps(isSelected: boolean, hasSelection: boolean) {
  if (isSelected) {
    return { animate: { scale: 1.1, opacity: 1 }, transition: springBounce };
  }
  if (hasSelection) {
    return { animate: { scale: 1, opacity: 0.6 }, transition: deselectTransition };
  }
  return { animate: { scale: 1, opacity: 1 }, transition: deselectTransition };
}

export function AnimatedMoodEmoji({
  mood,
  size = "lg",
  isSelected,
  hasSelection,
  className,
}: AnimatedMoodEmojiProps) {
  const sizeClass = sizeClasses[size];
  const wrapperRef = useRef<HTMLDivElement>(null);
  const animate = shouldAnimate();

  // Pause/unpause SVG SMIL animations based on Dopamine Settings
  useEffect(() => {
    if (!wrapperRef.current) return;
    const svg = wrapperRef.current.querySelector("svg");
    if (!svg) return;
    if (animate) {
      svg.unpauseAnimations();
    } else {
      svg.pauseAnimations();
    }
  }, [animate]);

  const EmojiComponent = emojiComponents[mood];
  const selected = isSelected ?? false;
  const selectionActive = hasSelection ?? selected;

  // When animations are disabled, render static div with instant state
  if (!animate) {
    return (
      <div
        ref={wrapperRef}
        className={cn(className)}
        style={{
          transform: selected ? "scale(1.1)" : "scale(1)",
          opacity: !selected && selectionActive ? 0.6 : 1,
        }}
      >
        <EmojiComponent size={sizeClass} isSelected={isSelected} />
      </div>
    );
  }

  const { animate: animateProps, transition } = getAnimateProps(selected, selectionActive);

  return (
    <motion.div
      ref={wrapperRef}
      className={cn(className)}
      animate={animateProps}
      transition={transition}
    >
      <EmojiComponent size={sizeClass} isSelected={isSelected} />
    </motion.div>
  );
}
