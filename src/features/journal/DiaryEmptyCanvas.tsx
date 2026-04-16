import { memo, useState, useCallback } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { PenLine, Target } from "lucide-react";

import { useLanguage } from "@/contexts/LanguageContext";
import { TimeOfDayGradient } from "./TimeOfDayGradient";
import { TypewriterText } from "./TypewriterText";
import { ValenceOrb } from "@/components/state-of-mind/ValenceOrb";
import { ParticleBackground } from "@/components/stats/ParticleBackground";
import { springs as springPresets } from "@/config/animations";

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
  if (h >= 5 && h < 12) return "morning";
  if (h >= 12 && h < 17) return "afternoon";
  if (h >= 17 && h < 22) return "evening";
  return "night";
}

const TIME_GREETINGS: Record<string, Record<string, string>> = {
  morning: {
    en: "Good morning",
    uk: "\u0414\u043E\u0431\u0440\u043E\u0433\u043E \u0440\u0430\u043D\u043A\u0443",
    es: "Buenos d\u00EDas",
    de: "Guten Morgen",
    fr: "Bonjour",
    ja: "\u304A\u306F\u3088\u3046",
    ar: "\u0635\u0628\u0627\u062D \u0627\u0644\u062E\u064A\u0631",
    he: "\u05D1\u05D5\u05E7\u05E8 \u05D8\u05D5\u05D1",
  },
  afternoon: {
    en: "Good afternoon",
    uk: "\u0414\u043E\u0431\u0440\u0438\u0439 \u0434\u0435\u043D\u044C",
    es: "Buenas tardes",
    de: "Guten Tag",
    fr: "Bon apr\u00E8s-midi",
    ja: "\u3053\u3093\u306B\u3061\u306F",
    ar: "\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631",
    he: "\u05E6\u05D4\u05E8\u05D9\u05D9\u05DD \u05D8\u05D5\u05D1\u05D9\u05DD",
  },
  evening: {
    en: "Good evening",
    uk: "\u0414\u043E\u0431\u0440\u0438\u0439 \u0432\u0435\u0447\u0456\u0440",
    es: "Buenas noches",
    de: "Guten Abend",
    fr: "Bonsoir",
    ja: "\u3053\u3093\u3070\u3093\u306F",
    ar: "\u0645\u0633\u0627\u0621 \u0627\u0644\u062E\u064A\u0631",
    he: "\u05E2\u05E8\u05D1 \u05D8\u05D5\u05D1",
  },
  night: {
    en: "Still up?",
    uk: "\u0429\u0435 \u043D\u0435 \u0441\u043F\u0438\u0448?",
    es: "\u00BFA\u00FAn despierto?",
    de: "Noch wach?",
    fr: "Encore debout\u00A0?",
    ja: "\u307E\u3060\u8D77\u304D\u3066\u308B\uFF1F",
    ar: "\u0645\u0627 \u0632\u0644\u062A \u0645\u0633\u062A\u064A\u0642\u0638\u061F",
    he: "\u05E2\u05D3\u05D9\u05D9\u05DF \u05E2\u05E8\uFF1F",
  },
};

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
  const { t, language } = useLanguage();
  const ts = t as unknown as Record<string, string>;
  const reducedMotion = useReducedMotion();
  const lowEnd = isLowEndDevice();
  const [currentPrompt, setCurrentPrompt] = useState("");
  const period = getCurrentTimePeriod();
  const greeting = TIME_GREETINGS[period]?.[language] || TIME_GREETINGS[period]?.en || "Hello";

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

      {/* Layer 4: Time-aware greeting */}
      <motion.h2
        initial={reducedMotion ? false : { opacity: 0, y: 8 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.25, duration: 0.35 }}
        className="relative z-[1] text-lg font-semibold text-foreground/80 text-center"
      >
        {greeting}
      </motion.h2>

      {/* Layer 5: Typewriter text */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.35, duration: 0.4 }}
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

      {/* Layer 7: Context line + streak */}
      <motion.div
        initial={reducedMotion ? false : { opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.7, duration: 0.3 }}
        className="relative z-[1] flex items-center justify-center gap-3 text-xs text-muted-foreground/60"
      >
        {entriesThisWeek > 0 && (
          <span className="flex items-center gap-1">
            {"\u{1F4DD}"} {entriesThisWeek} {ts.diaryEntriesThisWeek || "this week"}
          </span>
        )}
        {streak > 0 && (
          <motion.span
            animate={reducedMotion ? undefined : { scale: [1, 1.1, 1] }}
            transition={{ duration: 2, repeat: Infinity, repeatDelay: 3 }}
            className="flex items-center gap-1 text-orange-500 font-semibold"
          >
            {"\u{1F525}"} {streak} {ts.diaryStreak || "streak"}
          </motion.span>
        )}
        {entriesThisWeek === 0 && streak === 0 && (
          <span>{ts.diaryStartFirstEntry || "Start your first entry this week"}</span>
        )}
      </motion.div>
    </div>
  );
});
