import { memo, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PenLine, Target } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { TimeOfDayGradient } from "./TimeOfDayGradient";
import { TypewriterText } from "./TypewriterText";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { ParticleBackground } from "@/components/stats/ParticleBackground";
import { springPresets } from "@/config/animations";

/** Detect low-end device: skip orb if < 4GB RAM or no WebGL */
function isLowEndDevice(): boolean {
  if (typeof navigator === "undefined") return false;
  const mem = (navigator as Navigator & { deviceMemory?: number }).deviceMemory;
  if (mem && mem < 4) return true;
  try {
    const canvas = document.createElement("canvas");
    return !canvas.getContext("webgl") && !canvas.getContext("webgl2");
  } catch {
    return true;
  }
}

const TIME_PARTICLE_COLOR: Record<string, "gold" | "primary" | "accent" | "purple"> = {
  morning: "gold",
  afternoon: "primary",
  evening: "accent",
  night: "purple",
};

function getCurrentTimePeriod(): string {
  const h = new Date().getHours();
  if (h >= 6 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 21) return "evening";
  return "night";
}

interface DiaryEmptyCanvasProps {
  onNewEntry: () => void;
  onNewEntryWithPrompt: (prompt: string) => void;
  streak: number;
  entriesThisWeek: number;
}

export const DiaryEmptyCanvas = memo(function DiaryEmptyCanvas({
  onNewEntry,
  onNewEntryWithPrompt,
  streak,
  entriesThisWeek,
}: DiaryEmptyCanvasProps) {
  const { t } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const lowEnd = isLowEndDevice();
  const [currentPrompt, setCurrentPrompt] = useState("");
  const period = getCurrentTimePeriod();

  const handlePromptChange = useCallback((text: string) => {
    setCurrentPrompt(text);
  }, []);

  return (
    <div className="flex-1 flex flex-col items-center justify-center gap-6 select-none relative overflow-hidden">
      {/* Layer 1: Time-of-day gradient */}
      <TimeOfDayGradient />

      {/* Layer 2: Ambient particles */}
      {!reducedMotion && (
        <ParticleBackground
          count={lowEnd ? 5 : 15}
          color={TIME_PARTICLE_COLOR[period] || "primary"}
          className="absolute inset-0"
          active
        />
      )}

      {/* Layer 3: ValenceOrb (skip on low-end or reduced motion) */}
      {!reducedMotion && !lowEnd && (
        <motion.div
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
          transition={{ type: "spring", stiffness: 200, damping: 20, delay: 0.2 }}
          className="relative z-[1]"
        >
          <ValenceOrb valence={0} size={64} />
        </motion.div>
      )}

      {/* Layer 4: Typewriter text */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3, duration: 0.4 }}
        className="relative z-[1] text-center px-8"
      >
        <TypewriterText
          className="text-lg font-light italic min-h-[2em]"
          onPromptChange={handlePromptChange}
        />
      </motion.div>

      {/* Layer 5: CTA pills */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.5, duration: 0.3 }}
        className="relative z-[1] flex items-center gap-3"
      >
        <motion.button
          whileHover={reducedMotion ? undefined : { y: -2, boxShadow: "0 4px 20px rgba(var(--primary-rgb), 0.15)" }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={springPresets.snappy}
          onClick={onNewEntry}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-primary/10 text-primary text-sm font-medium hover:bg-primary/15 transition-colors min-h-[44px]"
          aria-label={ts.journalNewEntry || "Write"}
        >
          <PenLine className="w-4 h-4" />
          {ts.journalNewEntry || "Write"}
        </motion.button>

        <motion.button
          whileHover={reducedMotion ? undefined : { y: -2, boxShadow: "0 4px 20px rgba(var(--primary-rgb), 0.10)" }}
          whileTap={reducedMotion ? undefined : { scale: 0.97 }}
          transition={springPresets.snappy}
          onClick={() => onNewEntryWithPrompt(currentPrompt)}
          className="flex items-center gap-2 px-4 py-2.5 rounded-full bg-muted/50 text-muted-foreground text-sm font-medium hover:bg-muted/70 transition-colors min-h-[44px]"
          aria-label={ts.journalPrompt || "Prompt"}
        >
          <Target className="w-4 h-4" />
          {ts.journalPrompt || "Prompt"}
        </motion.button>
      </motion.div>

      {/* Layer 6: Context line */}
      <motion.p
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        className="relative z-[1] text-xs text-muted-foreground/50 text-center"
      >
        {entriesThisWeek > 0 ? (
          <>
            {entriesThisWeek} {ts.diaryEntriesThisWeek || "entries this week"}
            {streak > 0 && (
              <span> · {streak} {"\u{1F525}"} {ts.diaryStreak || "streak"}</span>
            )}
          </>
        ) : (
          <span>{ts.diaryStartFirstEntry || "Start your first entry this week"}</span>
        )}
      </motion.p>
    </div>
  );
});
