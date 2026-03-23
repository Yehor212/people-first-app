import { useState, useEffect, useMemo } from "react";
import { cn } from "@/lib/utils";
import { resolveHabitColor } from "@/lib/habitColorUtils";
import { Check, Flame, Star, Zap } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { motion, AnimatePresence } from "framer-motion";
import { zenMotion } from "@/lib/animationUtils";
import { generateParticles, ParticleIcon } from "./helpers";

interface HabitCompletionCelebrationProps {
  habitName: string;
  habitIcon: string;
  habitColor: number;
  xpGained?: number;
  streakDays?: number;
  isAllComplete?: boolean;
  onComplete: () => void;
}

export function HabitCompletionCelebration({
  habitName,
  habitIcon: _habitIcon,
  habitColor,
  xpGained = 10,
  streakDays,
  isAllComplete: _isAllComplete,
  onComplete,
}: HabitCompletionCelebrationProps) {
  const { t } = useLanguage();
  const [phase, setPhase] = useState<"check" | "xp" | "streak" | "done">(
    "check",
  );

  // Resolve palette index to hex for visual effects
  const colorHex = resolveHabitColor(habitColor);

  // Generate particles with habit color (capped at 12 for performance)
  const particles = useMemo(
    () => generateParticles(colorHex).slice(0, 12),
    [colorHex],
  );

  useEffect(() => {
    const timer1 = setTimeout(() => setPhase("xp"), 400);
    const timer2 = setTimeout(() => {
      if (streakDays && streakDays > 1) {
        setPhase("streak");
      } else {
        setPhase("done");
      }
    }, 1200);
    const timer3 = setTimeout(
      () => {
        setPhase("done");
        onComplete();
      },
      streakDays && streakDays > 1 ? 2200 : 1500,
    );

    return () => {
      clearTimeout(timer1);
      clearTimeout(timer2);
      clearTimeout(timer3);
    };
  }, [streakDays, onComplete]);

  return (
    <div
      className="fixed left-1/2 -translate-x-1/2 z-[150] pointer-events-none will-change-transform bottom-[calc(6rem+env(safe-area-inset-bottom,0px))]"
      role="status"
      aria-live="polite"
      aria-label={`${habitName} ${t.completed || "completed"}. +${xpGained} XP${streakDays && streakDays > 1 ? `. ${streakDays} ${t.dayStreak || "day streak"}` : ""}`}
    >
      {/* Main completion toast */}
      <div
        className={cn(
          "relative flex items-center gap-3 px-5 py-3 rounded-2xl shadow-2xl transition-all duration-300",
          phase === "check" && "animate-habit-complete-bounce scale-110",
          phase !== "done"
            ? "opacity-100 translate-y-0"
            : "opacity-0 translate-y-4",
        )}
        style={{ backgroundColor: colorHex }}
      >
        {/* Animated checkmark */}
        <div className="relative">
          <div
            className={cn(
              "w-10 h-10 rounded-xl bg-foreground/20 flex items-center justify-center",
              phase === "check" && "animate-check-circle-fill",
            )}
          >
            <Check
              className={cn(
                "w-6 h-6 text-white",
                phase === "check" && "animate-check-draw",
              )}
              strokeWidth={3}
            />
          </div>

          {/* Sparkle effects */}
          <div className="absolute -top-1 -end-1 animate-sparkle-burst">
            <Star className="w-4 h-4 text-yellow-300 fill-yellow-300" />
          </div>
          <div className="absolute -bottom-1 -start-1 animate-sparkle-burst delay-100">
            <Star className="w-3 h-3 text-yellow-300 fill-yellow-300" />
          </div>
        </div>

        {/* Habit name */}
        <div className="flex flex-col">
          <span className="text-white font-bold text-base">{habitName}</span>
          <span className="text-foreground/70 text-xs">
            {t.completed || "Completed!"}
          </span>
        </div>

        {/* XP Popup — zenMotion.bouncy for spring, CSS wobble for icon */}
        <AnimatePresence>
          {(phase === "xp" || phase === "streak") && (
            <motion.div
              className="absolute -top-10 end-4 flex items-center gap-1.5 px-4 py-1.5 rounded-full font-bold text-sm will-change-transform text-amber-900 shadow-[0_0_20px_rgba(251,191,36,0.6),0_4px_12px_rgba(0,0,0,0.2)] bg-gradient-to-br from-amber-400 via-amber-500 to-amber-600"
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.5 }}
              transition={zenMotion.bouncy}
            >
              <div className="[animation:zen-wobble_1s_ease-in-out_infinite]">
                <Zap className="w-5 h-5" />
              </div>
              <span className="text-base">+{xpGained} XP</span>
            </motion.div>
          )}
        </AnimatePresence>

        {/* Streak indicator — zenMotion.bouncy, CSS fire flicker */}
        <AnimatePresence>
          {streakDays && streakDays > 1 && phase === "streak" && (
            <motion.div
              className="absolute -top-14 left-1/2 flex items-center gap-2 px-5 py-2.5 rounded-full font-bold text-white will-change-transform shadow-[0_0_25px_rgba(249,115,22,0.5),0_4px_12px_rgba(0,0,0,0.2)] bg-gradient-to-br from-orange-500 via-red-500 to-red-600"
              style={{
                x: "-50%",
              }}
              initial={{ opacity: 0, y: 20, scale: 0.5 }}
              animate={{ opacity: 1, y: 0, scale: 1 }}
              exit={{ opacity: 0, y: -20, scale: 0.5 }}
              transition={zenMotion.bouncy}
            >
              {/* CSS-driven fire flicker instead of FM loop */}
              <div className="[animation:zen-wobble_0.6s_ease-in-out_infinite]">
                <Flame className="w-6 h-6" />
              </div>
              <span className="text-lg">
                {streakDays} {t.dayStreak || "day streak"}!
              </span>
            </motion.div>
          )}
        </AnimatePresence>
      </div>

      {/* Particle burst — one-shot, no repeat */}
      <AnimatePresence>
        {phase === "check" && (
          <div className="absolute inset-0 pointer-events-none overflow-visible">
            {particles.map((particle) => {
              const angleRad = (particle.angle * Math.PI) / 180;
              const endX = Math.cos(angleRad) * particle.distance;
              const endY = Math.sin(angleRad) * particle.distance;

              return (
                <motion.div
                  key={particle.id}
                  className="absolute left-1/2 top-1/2 will-change-transform"
                  initial={{ x: 0, y: 0, scale: 0, opacity: 1 }}
                  animate={{
                    x: endX,
                    y: endY,
                    scale: [0, 1.2, 0.8],
                    opacity: [1, 1, 0],
                    rotate: [0, 180, 360],
                  }}
                  transition={{
                    duration: 0.8,
                    delay: particle.delay / 1000,
                    ease: [0.25, 0.46, 0.45, 0.94],
                  }}
                >
                  <ParticleIcon
                    shape={particle.shape}
                    size={particle.size}
                    color={particle.color}
                  />
                </motion.div>
              );
            })}
          </div>
        )}
      </AnimatePresence>
    </div>
  );
}
