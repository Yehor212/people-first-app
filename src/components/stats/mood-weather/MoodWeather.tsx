/**
 * MoodWeather - Premium animated weather card based on mood + emotion
 * 12 weather moods with 4-layer animation system:
 *   Layer 1: Background gradient (inline styles from palette)
 *   Layer 2: Weather effect (sun/clouds/rain/storm/fog/aurora/wind/clear)
 *   Layer 3: Particles (dots/sparkle/rain/fog)
 *   Layer 4: Content overlay (emoji + label + message)
 *
 * Tap opens MoodWeatherCalendar bottom sheet.
 */

import { useMemo } from "react";
import { motion } from "framer-motion";
import { cn } from "@/lib/utils";
import { useLanguage } from "@/contexts/LanguageContext";
import { useTheme } from "@/components/ThemeToggle";
import { shouldAnimate } from "@/lib/animationUtils";
import { MoodType, EmotionData } from "@/types";
import { deriveWeatherMood, getWeatherMoodConfig } from "@/lib/weatherMoodConfig";
import { WeatherEffectLayer } from "./WeatherEffects";
import { MoodParticles } from "./MoodParticles";

// ============================================
// TYPES
// ============================================

interface MoodWeatherProps {
  mood: MoodType;
  emotion?: EmotionData | null;
  className?: string;
}

// ============================================
// MAIN COMPONENT
// ============================================

export function MoodWeather({ mood, emotion, className }: MoodWeatherProps) {
  const { t } = useLanguage();
  const { effectiveTheme } = useTheme();
  const animate = shouldAnimate();

  const weatherMoodId = useMemo(() => deriveWeatherMood(mood, emotion), [mood, emotion]);
  const config = getWeatherMoodConfig(weatherMoodId);
  const isDark = effectiveTheme === "dark";
  const palette = isDark ? config.palette.dark : config.palette.light;

  const label = (t as unknown as Record<string, string>)[config.labelKey] || config.labelKey;
  const message = (t as unknown as Record<string, string>)[config.messageKey] || "";

  return (
    <motion.div
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      className={cn(
        "relative min-h-[calc(8.75rem*var(--font-scale,1))] overflow-hidden rounded-2xl p-4",
        "border border-border/30 backdrop-blur-sm",
        className
      )}
      style={{
        background: `linear-gradient(135deg, hsl(${palette.surface}), hsl(${palette.accent} / 0.18))`,
        boxShadow: `inset 0 1px 0 rgba(255,255,255,0.08), 0 2px 12px ${palette.glow}`,
      }}
    >
      {/* Layer 2: Weather Effect */}
      {animate && (
        <WeatherEffectLayer
          type={config.layers.weatherEffect.type}
          intensity={config.layers.weatherEffect.intensity}
          palette={palette}
        />
      )}

      {/* Layer 3: Particles */}
      {animate && config.layers.particles.type !== "none" && (
        <MoodParticles
          config={config.layers.particles}
          budget={config.performanceBudget.maxParticles}
        />
      )}

      {/* Layer 4: Content */}
      <div className="relative z-10 flex h-full min-w-0 flex-col items-center justify-center">
        {/* Emoji */}
        <motion.span
          className="text-3xl mb-1 block"
          initial={animate ? { scale: 0, opacity: 0 } : false}
          animate={{ scale: 1, opacity: 1 }}
          transition={{ type: "spring", stiffness: 300, damping: 20, delay: 0.1 }}
        >
          {config.emoji}
        </motion.span>

        {/* Label */}
        <h3 className="break-words text-center text-xs font-bold uppercase leading-tight tracking-wider text-foreground">
          {label}
        </h3>

        {/* Message */}
        <p className="mt-1 break-words px-1 text-center text-xs leading-relaxed text-muted-foreground">
          {message}
        </p>
      </div>

      {/* Reduced motion fallback: just static gradient + emoji is already shown via inline styles */}
    </motion.div>
  );
}

export default MoodWeather;
