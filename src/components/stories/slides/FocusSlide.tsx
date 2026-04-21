/**
 * FocusSlide - "Космическая станция" (Space Station)
 *
 * Focus time visualized as orbital rings around a central timer.
 * Stats orbit like satellites around the core.
 */

import { useEffect, useState } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { StarField } from "../elements/StarField";
import { BrainIcon } from "@/components/icons";
import type { StorySlide, FocusStatsData } from "@/lib/progressStories";

interface FocusSlideProps {
  slide: StorySlide;
  t: Record<string, string>;
}

// Animated Counter Hook
function useAnimatedCounter(target: number, duration: number = 1.5) {
  const [current, setCurrent] = useState(0);

  useEffect(() => {
    const controls = animate(0, target, {
      duration,
      ease: "easeOut",
      onUpdate: (value) => setCurrent(Math.round(value)),
    });
    return () => controls.stop();
  }, [target, duration]);

  return current;
}

// Orbiting Stat Component
function OrbitingStat({
  icon,
  value,
  label,
  orbitRadius,
  orbitDuration,
  startAngle,
  color,
}: {
  icon: string;
  value: string;
  label: string;
  orbitRadius: number;
  orbitDuration: number;
  startAngle: number;
  color: string;
}) {
  const angle = useMotionValue(startAngle);
  const x = useTransform(
    angle,
    (a) => Math.cos((a * Math.PI) / 180) * orbitRadius,
  );
  const y = useTransform(
    angle,
    (a) => Math.sin((a * Math.PI) / 180) * orbitRadius,
  );

  useEffect(() => {
    const controls = animate(angle, startAngle + 360, {
      duration: orbitDuration,
      repeat: Infinity,
      ease: "linear",
    });
    return () => controls.stop();
  }, [angle, orbitDuration, startAngle]);

  return (
    <motion.div
      className="absolute left-1/2 top-1/2 -translate-x-1/2 -translate-y-1/2"
      style={{ x, y }}
    >
      <motion.div
        className="flex flex-col items-center px-3 py-2 rounded-xl bg-black/40 dark:bg-black/40 backdrop-blur-sm border border-white/10 dark:border-white/10"
        style={{
          boxShadow: `0 0 20px ${color}40`,
        }}
        whileHover={{ scale: 1.1 }}
      >
        <span className="text-lg">{icon}</span>
        <span className="text-sm font-bold text-white">{value}</span>
        <span className="text-xs text-white/60">{label}</span>
      </motion.div>
    </motion.div>
  );
}

export function FocusSlide({ slide, t }: FocusSlideProps) {
  const data = slide.data as FocusStatsData;
  const totalMinutes = data?.totalMinutes || 0;
  const animatedMinutes = useAnimatedCounter(totalMinutes);

  // Parse hours and minutes from slide.value (e.g., "4h 7m")
  const timeMatch = String(slide.value).match(/(\d+)h?\s*(\d+)?m?/);
  const hours = timeMatch ? parseInt(timeMatch[1]) || 0 : 0;
  const minutes = timeMatch ? parseInt(timeMatch[2]) || 0 : 0;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep space background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#0a1628_0%,#050a14_50%,#000000_100%)]" />

      {/* Animated star field */}
      <StarField count={60} speed={0.5} twinkle />

      {/* Nebula accents */}
      <motion.div
        className="absolute inset-0 bg-[radial-gradient(circle_at_20%_30%,rgba(59,130,246,0.15)_0%,transparent_40%),radial-gradient(circle_at_80%_70%,rgba(139,92,246,0.1)_0%,transparent_35%)]"
        animate={{
          opacity: [0.3, 0.5, 0.3],
        }}
        transition={{ duration: 8, repeat: Infinity }}
      />

      {/* Central orbital system */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[300px] h-[300px]">
          {/* Outer orbit ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-white/10 dark:border-white/10"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />

          {/* Middle orbit ring */}
          <motion.div
            className="absolute rounded-full border border-cyan-500/20 inset-[30px] shadow-[0_0_20px_rgba(6,182,212,0.1)]"
            animate={{ rotate: -360 }}
            transition={{ duration: 45, repeat: Infinity, ease: "linear" }}
          />

          {/* Inner orbit ring */}
          <motion.div
            className="absolute rounded-full border-2 border-blue-500/30 inset-[60px] shadow-[0_0_30px_rgba(59,130,246,0.2)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 30, repeat: Infinity, ease: "linear" }}
          />

          {/* Central core */}
          <motion.div
            className="absolute rounded-full flex flex-col items-center justify-center inset-[80px] bg-[radial-gradient(circle,rgba(59,130,246,0.3)_0%,rgba(139,92,246,0.2)_50%,transparent_70%)] shadow-[0_0_60px_rgba(59,130,246,0.3),inset_0_0_40px_rgba(59,130,246,0.2)]"
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 60px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.2)",
                "0 0 80px rgba(59, 130, 246, 0.4), inset 0 0 50px rgba(59, 130, 246, 0.3)",
                "0 0 60px rgba(59, 130, 246, 0.3), inset 0 0 40px rgba(59, 130, 246, 0.2)",
              ],
            }}
            transition={{ duration: 4, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Brain icon */}
            <motion.div
              className="mb-2"
              initial={{ scale: 0, rotate: -180 }}
              animate={{ scale: 1, rotate: 0 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            >
              <BrainIcon size="lg" animated />
            </motion.div>

            {/* Time display */}
            <motion.div
              className="text-4xl font-black text-white [text-shadow:0_0_20px_rgba(59,130,246,0.5)]"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              {hours > 0 ? `${hours}h ${minutes}m` : `${animatedMinutes}m`}
            </motion.div>

            <motion.p
              className="text-xs text-white/60 mt-1"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.7 }}
            >
              {t.storyTotalFocus || "total focus"}
            </motion.p>
          </motion.div>

          {/* Orbiting stats */}
          <OrbitingStat
            icon="⏱️"
            value={`${data?.averageSession || 0}m`}
            label={t.storyAvgSession || "avg"}
            orbitRadius={120}
            orbitDuration={25}
            startAngle={0}
            color="#06b6d4"
          />
          <OrbitingStat
            icon="🏆"
            value={`${data?.longestSession || 0}m`}
            label={t.storyLongestSession || "best"}
            orbitRadius={120}
            orbitDuration={25}
            startAngle={180}
            color="#8b5cf6"
          />
        </div>
      </div>

      {/* Title */}
      <motion.h2
        className="absolute top-16 left-1/2 -translate-x-1/2 text-2xl font-bold text-white drop-shadow-lg"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {slide.title}
      </motion.h2>

      {/* Top label badge */}
      {data?.topLabel && (
        <motion.div
          className="absolute bottom-24 left-1/2 -translate-x-1/2 px-4 py-2 rounded-full bg-white/10 dark:bg-white/10 backdrop-blur-sm border border-white/10 dark:border-white/10"
          initial={{ opacity: 0, y: 20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 1 }}
        >
          <span className="text-sm text-white">
            {t.storyMostFocusedOn || "Most focused on:"}{" "}
            <span className="font-semibold">{data.topLabel}</span>
          </span>
        </motion.div>
      )}

      {/* Decorative corner glows */}
      <div className="absolute top-0 start-0 w-48 h-48 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(59,130,246,0.1)_0%,transparent_70%)]" />
      <div className="absolute bottom-0 end-0 w-48 h-48 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,rgba(139,92,246,0.1)_0%,transparent_70%)]" />
    </div>
  );
}

export default FocusSlide;
