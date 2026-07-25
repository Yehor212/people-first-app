import { memo, useEffect, useMemo } from "react";
import { motion, useReducedMotion } from "framer-motion";
import { springs } from "@/config/animations";
import { hapticSuccess } from "@/lib/haptics";
import { formatLocalizedCount } from "./journalWordCount";
import { getTranslations } from "@/i18n";
import type { Language, TranslationStrings } from "@/i18n/types";

interface StreakCelebrationProps {
  streak: number;
  onDone: () => void;
  language?: Language;
  translations?: TranslationStrings;
}

const PARTICLE_COLORS = [
  "hsl(var(--primary))",
  "hsl(var(--accent))",
  "hsl(var(--warning))",
];

interface ParticleConfig {
  x: number;
  y: number;
  rotation: number;
  scale: number;
  color: string;
  duration: number;
  isCircle: boolean;
}

function generateParticles(): ParticleConfig[] {
  return Array.from({ length: 30 }, (_, i) => ({
    x: Math.random() * 100,
    y: -20,
    rotation: 360 + Math.random() * 360,
    scale: 0.5 + Math.random(),
    color: PARTICLE_COLORS[i % 3],
    duration: 2 + Math.random() * 2,
    isCircle: i % 2 === 0,
  }));
}

const bounceSpring = { type: "spring" as const, stiffness: 400, damping: 15 };

export const StreakCelebration = memo(function StreakCelebration({
  streak,
  onDone,
  language = "en",
  translations,
}: StreakCelebrationProps) {
  const ts = translations ?? getTranslations(language);
  const reducedMotion = useReducedMotion();
  const particles = useMemo(generateParticles, []);
  const message = streak >= 30
    ? ts.shareAchievement30
    : streak >= 14
      ? ts.shareAchievement14
      : ts.shareAchievement7;
  const streakLabel = formatLocalizedCount(
    streak,
    language,
    ts,
    "journalStreakCount",
    ts.journalDayStreak,
  );
  const label = `${streakLabel}. ${message}`;

  useEffect(() => {
    void hapticSuccess();
    const timer = setTimeout(onDone, 3000);
    return () => clearTimeout(timer);
  }, [onDone]);

  return (
    <div
      className="fixed inset-0 z-[100] flex items-center justify-center bg-black/40 backdrop-blur-sm [-webkit-backdrop-filter:blur(4px)]"
      role="alert"
      aria-live="assertive"
      aria-label={label}
      onClick={onDone}
    >
      {/* Confetti particles */}
      {!reducedMotion &&
        particles.map((p, i) => (
          <motion.div
            key={i}
            className={p.isCircle ? "rounded-full" : ""}
            style={{
              position: "absolute",
              left: `${p.x}%`,
              width: p.isCircle ? 6 : 4,
              height: p.isCircle ? 6 : 8,
              backgroundColor: p.color,
            }}
            initial={{ y: "-20px", opacity: 1, rotate: 0, scale: p.scale }}
            animate={{
              y: "110vh",
              opacity: [1, 1, 0],
              rotate: p.rotation,
              scale: p.scale,
            }}
            transition={{ duration: p.duration, ease: "linear" }}
          />
        ))}

      {/* Streak number */}
      <motion.div
        className="flex flex-col items-center gap-3"
        initial={reducedMotion ? undefined : { scale: 0, rotate: -15 }}
        animate={
          reducedMotion
            ? undefined
            : { scale: [0, 1.5, 1], rotate: 0 }
        }
        transition={reducedMotion ? undefined : bounceSpring}
      >
        <motion.span
          className="text-7xl font-display font-semibold tracking-tight tabular-nums text-foreground drop-shadow-lg"
          aria-hidden="true"
        >
          <motion.span
            animate={
              reducedMotion
                ? undefined
                : { scale: [1, 1.2, 1] }
            }
            transition={
              reducedMotion
                ? undefined
                : { ...springs.playful, repeat: Infinity, repeatDelay: 0.8 }
            }
            className="inline-block"
          >
            {"\uD83D\uDD25"}
          </motion.span>{" "}
          {streak}
        </motion.span>

        {/* Congratulation text */}
        <motion.p
          className="text-lg font-medium text-muted-foreground"
          initial={reducedMotion ? undefined : { opacity: 0, y: 10 }}
          animate={reducedMotion ? undefined : { opacity: 1, y: 0 }}
          transition={reducedMotion ? undefined : { delay: 0.5, ...springs.smooth }}
        >
          {message}
        </motion.p>
      </motion.div>
    </div>
  );
});
