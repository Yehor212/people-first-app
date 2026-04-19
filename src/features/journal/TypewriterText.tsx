import { useState, useEffect, useRef, memo } from "react";
import { useReducedMotion } from "framer-motion";
import { useLanguage } from "@/contexts/LanguageContext";

const WRITING_PROMPTS_KEYS = [
  "diaryPrompt1", "diaryPrompt2", "diaryPrompt3", "diaryPrompt4", "diaryPrompt5",
  "diaryPrompt6", "diaryPrompt7", "diaryPrompt8", "diaryPrompt9", "diaryPrompt10",
];

const FALLBACK_PROMPTS = [
  "What made you smile today?",
  "What are you grateful for right now?",
  "How are you feeling in this moment?",
  "What challenged you today?",
  "Describe a small victory from today.",
  "What would you tell your future self?",
  "What did you learn today?",
  "What are you looking forward to?",
  "How did you take care of yourself today?",
  "What moment do you want to remember?",
];

type Phase = "typing" | "holding" | "erasing" | "pausing";

const TYPE_SPEED = 40;
const ERASE_SPEED = 20;
const HOLD_DURATION = 5000;
const PAUSE_DURATION = 1000;

interface TypewriterTextProps {
  className?: string;
  /** Returns the currently displayed prompt text */
  onPromptChange?: (text: string) => void;
}

export const TypewriterText = memo(function TypewriterText({ className, onPromptChange }: TypewriterTextProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();

  // Get localized prompts
  const prompts = WRITING_PROMPTS_KEYS.map((key, i) => ts[key] || FALLBACK_PROMPTS[i]);

  // Deterministic prompt order per day
  const today = new Date();
  const dayOfYear = Math.floor(
    (today.getTime() - new Date(today.getFullYear(), 0, 0).getTime()) / 86400000
  );
  const startIndex = dayOfYear % prompts.length;

  const [promptIndex, setPromptIndex] = useState(startIndex);
  const [charIndex, setCharIndex] = useState(0);
  const [phase, setPhase] = useState<Phase>("typing");
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const visibleRef = useRef(true);

  const currentPrompt = prompts[promptIndex % prompts.length];
  const displayText = currentPrompt.slice(0, charIndex);

  // Notify parent of current prompt
  useEffect(() => {
    onPromptChange?.(currentPrompt);
  }, [currentPrompt, onPromptChange]);

  // Page Visibility
  useEffect(() => {
    const handler = () => { visibleRef.current = !document.hidden; };
    document.addEventListener("visibilitychange", handler);
    return () => document.removeEventListener("visibilitychange", handler);
  }, []);

  // Reduced motion: static text, fade-swap every 8s
  useEffect(() => {
    if (!reducedMotion) return;
    setCharIndex(currentPrompt.length);
    const interval = setInterval(() => {
      setPromptIndex((prev) => (prev + 1) % prompts.length);
      setCharIndex(0);
      // Next tick set full length
      setTimeout(() => setCharIndex(prompts[(promptIndex + 1) % prompts.length].length), 50);
    }, 8000);
    return () => clearInterval(interval);
  }, [reducedMotion, prompts, promptIndex, currentPrompt.length]);

  // Typewriter state machine
  useEffect(() => {
    if (reducedMotion) return;
    if (!visibleRef.current) {
      timerRef.current = setTimeout(() => {
        // Re-trigger when visible
        setPhase((p) => p);
      }, 500);
      return () => { if (timerRef.current) clearTimeout(timerRef.current); };
    }

    switch (phase) {
      case "typing":
        if (charIndex < currentPrompt.length) {
          timerRef.current = setTimeout(() => setCharIndex((c) => c + 1), TYPE_SPEED);
        } else {
          setPhase("holding");
        }
        break;
      case "holding":
        timerRef.current = setTimeout(() => setPhase("erasing"), HOLD_DURATION);
        break;
      case "erasing":
        if (charIndex > 0) {
          timerRef.current = setTimeout(() => setCharIndex((c) => c - 1), ERASE_SPEED);
        } else {
          setPhase("pausing");
        }
        break;
      case "pausing":
        timerRef.current = setTimeout(() => {
          setPromptIndex((prev) => (prev + 1) % prompts.length);
          setPhase("typing");
        }, PAUSE_DURATION);
        break;
    }

    return () => { if (timerRef.current) clearTimeout(timerRef.current); };
  }, [phase, charIndex, currentPrompt.length, prompts.length, reducedMotion]);

  return (
    <p className={className}>
      <span className="text-muted-foreground/70">
        {reducedMotion ? currentPrompt : displayText}
      </span>
      {!reducedMotion && (phase === "typing" || phase === "holding" || phase === "erasing") && (
        <span className="motion-safe:animate-pulse text-primary/60">|</span>
      )}
    </p>
  );
});
