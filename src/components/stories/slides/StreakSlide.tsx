/**
 * StreakSlide - "Огненная орбита" (Fire Orbit)
 *
 * Premium v3: Orbital fire system like FocusSlide
 * Central glowing fire orb with rotating rings.
 * Abstract, premium, not realistic flame.
 */

import { useEffect } from "react";
import { motion, useMotionValue, useTransform, animate } from "framer-motion";
import { FireIcon } from "@/components/icons";
import type { StorySlide } from "@/lib/progressStories";

interface StreakSlideProps {
  slide: StorySlide;
}

// Fire particle floating up
function FireParticle({ delay, x }: { delay: number; x: number }) {
  return (
    <motion.div
      className="absolute rounded-full bottom-[30%] w-1 h-1 bg-[radial-gradient(circle,#ffd700_0%,#ff6b00_70%,transparent_100%)] shadow-[0_0_8px_rgba(255,200,0,0.8)]"
      style={{
        left: `${x}%`,
      }}
      animate={{
        y: [0, -150],
        opacity: [0, 1, 0],
        scale: [0.5, 1, 0.3],
      }}
      transition={{
        duration: 3,
        delay,
        repeat: Infinity,
        ease: "easeOut",
      }}
    />
  );
}

// Orbiting fire icon (like OrbitingStat in FocusSlide)
function OrbitingFire({
  orbitRadius,
  orbitDuration,
  startAngle,
}: {
  orbitRadius: number;
  orbitDuration: number;
  startAngle: number;
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
        className="p-2 rounded-full bg-black/30 backdrop-blur-sm border border-orange-500/30 shadow-[0_0_20px_rgba(255,150,0,0.4)]"
        animate={{
          boxShadow: [
            "0 0 20px rgba(255, 150, 0, 0.4)",
            "0 0 30px rgba(255, 150, 0, 0.6)",
            "0 0 20px rgba(255, 150, 0, 0.4)",
          ],
        }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <FireIcon size="md" animated />
      </motion.div>
    </motion.div>
  );
}

export function StreakSlide({ slide }: StreakSlideProps) {
  const streak = Number(slide.value) || 0;

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep fire cosmos background */}
      <div className="absolute inset-0 bg-[radial-gradient(ellipse_at_center,#1a0a00_0%,#0d0400_50%,#000000_100%)]" />

      {/* Fire nebula accents */}
      <motion.div
        className="absolute inset-0"
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 6, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 20% 30%, rgba(255, 100, 0, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, rgba(255, 150, 0, 0.1) 0%, transparent 35%),
            radial-gradient(circle at 50% 50%, rgba(255, 200, 0, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      {/* Fire particles */}
      {[...Array(8)].map((_, i) => (
        <FireParticle key={i} delay={i * 0.4} x={42 + Math.random() * 16} />
      ))}

      {/* Central orbital system (like FocusSlide) */}
      <div className="absolute inset-0 flex items-center justify-center">
        <div className="relative w-[300px] h-[300px]">
          {/* Outer orbit ring */}
          <motion.div
            className="absolute inset-0 rounded-full border border-orange-500/20 shadow-[0_0_15px_rgba(255,100,0,0.1)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 60, repeat: Infinity, ease: "linear" }}
          />

          {/* Middle orbit ring */}
          <motion.div
            className="absolute rounded-full border border-amber-500/25 inset-[30px] shadow-[0_0_20px_rgba(255,150,0,0.15)]"
            animate={{ rotate: -360 }}
            transition={{ duration: 40, repeat: Infinity, ease: "linear" }}
          />

          {/* Inner orbit ring */}
          <motion.div
            className="absolute rounded-full border-2 border-yellow-500/30 inset-[60px] shadow-[0_0_25px_rgba(255,200,0,0.2)]"
            animate={{ rotate: 360 }}
            transition={{ duration: 25, repeat: Infinity, ease: "linear" }}
          />

          {/* Central fire core */}
          <motion.div
            className="absolute rounded-full flex flex-col items-center justify-center inset-[75px]"
            style={{
              background: `radial-gradient(circle at 30% 30%,
                rgba(255, 255, 200, 0.3) 0%,
                rgba(255, 200, 0, 0.4) 30%,
                rgba(255, 100, 0, 0.3) 60%,
                transparent 80%)`,
              boxShadow: `
                0 0 60px rgba(255, 150, 0, 0.5),
                0 0 100px rgba(255, 100, 0, 0.3),
                inset 0 0 40px rgba(255, 200, 0, 0.3)
              `,
            }}
            animate={{
              scale: [1, 1.05, 1],
              boxShadow: [
                "0 0 60px rgba(255, 150, 0, 0.5), 0 0 100px rgba(255, 100, 0, 0.3), inset 0 0 40px rgba(255, 200, 0, 0.3)",
                "0 0 80px rgba(255, 150, 0, 0.7), 0 0 120px rgba(255, 100, 0, 0.4), inset 0 0 50px rgba(255, 200, 0, 0.4)",
                "0 0 60px rgba(255, 150, 0, 0.5), 0 0 100px rgba(255, 100, 0, 0.3), inset 0 0 40px rgba(255, 200, 0, 0.3)",
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
          >
            {/* Streak number */}
            <motion.div
              className="text-6xl font-black text-white [text-shadow:0_0_30px_rgba(255,200,0,0.8)]"
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ type: "spring", stiffness: 100, delay: 0.3 }}
            >
              {streak}
            </motion.div>

            <motion.p
              className="text-sm text-orange-100/80 mt-1 font-medium"
              initial={{ opacity: 0 }}
              animate={{ opacity: 1 }}
              transition={{ delay: 0.5 }}
            >
              day streak
            </motion.p>
          </motion.div>

          {/* Orbiting fire icons */}
          <OrbitingFire orbitRadius={130} orbitDuration={20} startAngle={0} />
          <OrbitingFire orbitRadius={130} orbitDuration={20} startAngle={120} />
          <OrbitingFire orbitRadius={130} orbitDuration={20} startAngle={240} />
        </div>
      </div>

      {/* Title at top */}
      <motion.h2
        className="absolute top-16 left-1/2 -translate-x-1/2 text-2xl font-bold text-white drop-shadow-lg [text-shadow:0_0_20px_rgba(255,150,0,0.5)]"
        initial={{ opacity: 0, y: -20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {slide.title || "On Fire!"}
      </motion.h2>

      {/* Subtitle at bottom */}
      <motion.p
        className="absolute bottom-20 left-1/2 -translate-x-1/2 text-lg text-orange-200/70"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        {slide.subtitle}
      </motion.p>

      {/* Corner glows */}
      <div className="absolute top-0 start-0 w-48 h-48 pointer-events-none bg-[radial-gradient(circle_at_top_left,rgba(255,100,0,0.1)_0%,transparent_70%)]" />
      <div className="absolute bottom-0 end-0 w-48 h-48 pointer-events-none bg-[radial-gradient(circle_at_bottom_right,rgba(255,150,0,0.1)_0%,transparent_70%)]" />
    </div>
  );
}

export default StreakSlide;
