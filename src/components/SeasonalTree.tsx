/**
 * SeasonalTree - Beautiful animated tree that changes with seasons
 *
 * Features:
 * - 5 growth stages (seed → sprout → sapling → tree → great tree)
 * - 4 seasonal variations (spring, summer, autumn, winter)
 * - Animated particles (petals, leaves, snowflakes)
 * - Water level indicator
 * - Idle breathing animation
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import {
  Season,
  TreeStage,
  getSeasonColors,
  getCurrentSeason,
} from '@/lib/seasonHelper';

interface SeasonalTreeProps {
  stage: TreeStage;
  waterLevel: number; // 0-100
  xp?: number;
  season?: Season;
  isWatering?: boolean;
  onClick?: () => void;
  className?: string;
  size?: 'sm' | 'md' | 'lg';
}

// Particle types for each season
const PARTICLE_COUNT = 8;

export function SeasonalTree({
  stage,
  waterLevel,
  xp = 0,
  season: propSeason,
  isWatering = false,
  onClick,
  className,
  size = 'md',
}: SeasonalTreeProps) {
  const season = propSeason || getCurrentSeason();
  const colors = getSeasonColors(season);
  const [particles, setParticles] = useState<Array<{ id: number; x: number; delay: number }>>([]);

  // Generate particles on mount
  useEffect(() => {
    setParticles(
      Array.from({ length: PARTICLE_COUNT }, (_, i) => ({
        id: i,
        x: Math.random() * 100,
        delay: Math.random() * 5,
      }))
    );
  }, [season]);

  // Size mappings
  const sizeConfig = {
    sm: { width: 120, height: 150, scale: 0.6 },
    md: { width: 200, height: 250, scale: 1 },
    lg: { width: 280, height: 350, scale: 1.4 },
  };
  const { width, height, scale } = sizeConfig[size];

  // Water level affects tree appearance
  const isThirsty = waterLevel < 30;
  const isHealthy = waterLevel >= 50;

  // Tree opacity based on water
  const treeOpacity = isThirsty ? 0.7 : 1;

  return (
    <div
      className={cn(
        "relative cursor-pointer select-none",
        onClick && "hover:scale-105 transition-transform",
        className
      )}
      onClick={onClick}
      style={{ width, height }}
    >
      {/* Background glow */}
      <div
        className="absolute inset-0 rounded-full blur-3xl opacity-30"
        style={{
          background: `radial-gradient(circle, ${colors.primary}40, transparent 70%)`,
        }}
      />

      {/* Falling particles */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {particles.map((particle) => (
          <motion.div
            key={particle.id}
            className="absolute text-lg"
            initial={{ y: -20, x: `${particle.x}%`, opacity: 0, rotate: 0 }}
            animate={{
              y: height + 20,
              opacity: [0, 1, 1, 0],
              rotate: 360,
              x: [`${particle.x}%`, `${particle.x + (Math.random() - 0.5) * 30}%`],
            }}
            transition={{
              duration: 6 + Math.random() * 4,
              delay: particle.delay,
              repeat: Infinity,
              ease: 'linear',
            }}
          >
            {season === 'spring' && '🌸'}
            {season === 'summer' && '🍃'}
            {season === 'autumn' && '🍂'}
            {season === 'winter' && '❄️'}
          </motion.div>
        ))}
      </div>

      {/* SVG Tree */}
      <svg
        viewBox="0 0 200 250"
        className="w-full h-full"
        style={{ opacity: treeOpacity }}
      >
        {/* Pot / Ground */}
        <ellipse
          cx="100"
          cy="235"
          rx="50"
          ry="12"
          fill="#8B4513"
          opacity="0.3"
        />

        {/* Stage 1: Seed - Beautiful terracotta pot */}
        {stage === 1 && (
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200, damping: 15 }}
          >
            {/* Pot shadow */}
            <ellipse cx="100" cy="232" rx="35" ry="8" fill="rgba(0,0,0,0.15)" />

            {/* Pot body - terracotta gradient */}
            <defs>
              <linearGradient id="potGradient" x1="0%" y1="0%" x2="100%" y2="0%">
                <stop offset="0%" stopColor="#C67B4E" />
                <stop offset="50%" stopColor="#D4845A" />
                <stop offset="100%" stopColor="#B5714A" />
              </linearGradient>
              <linearGradient id="potRim" x1="0%" y1="0%" x2="0%" y2="100%">
                <stop offset="0%" stopColor="#D4845A" />
                <stop offset="100%" stopColor="#A65F3A" />
              </linearGradient>
            </defs>

            {/* Main pot */}
            <path
              d="M68 198 Q70 215 75 230 L125 230 Q130 215 132 198 Z"
              fill="url(#potGradient)"
            />

            {/* Pot rim */}
            <ellipse cx="100" cy="198" rx="35" ry="10" fill="url(#potRim)" />
            <ellipse cx="100" cy="196" rx="32" ry="8" fill="#8B4513" />

            {/* Soil with texture */}
            <ellipse cx="100" cy="196" rx="28" ry="6" fill="#3E2723" />
            <ellipse cx="100" cy="194" rx="24" ry="4" fill="#4E342E" />

            {/* Seed with shine */}
            <motion.g
              animate={{ y: [-1, 1, -1] }}
              transition={{ duration: 3, repeat: Infinity, ease: "easeInOut" }}
            >
              <ellipse cx="100" cy="190" rx="9" ry="13" fill="#5D4037" />
              <ellipse cx="100" cy="190" rx="9" ry="13" fill="url(#seedShine)" />
              {/* Seed highlight */}
              <ellipse cx="97" cy="186" rx="3" ry="4" fill="rgba(255,255,255,0.2)" />
            </motion.g>

            <defs>
              <radialGradient id="seedShine" cx="30%" cy="30%">
                <stop offset="0%" stopColor="#8D6E63" stopOpacity="0.5" />
                <stop offset="100%" stopColor="#3E2723" stopOpacity="0" />
              </radialGradient>
            </defs>

            {/* Decorative water droplet */}
            <motion.g
              animate={{
                y: [0, -3, 0],
                opacity: [0.7, 1, 0.7]
              }}
              transition={{ duration: 2, repeat: Infinity, delay: 1 }}
            >
              <path
                d="M115 185 Q118 178 115 172 Q112 178 115 185"
                fill="#60A5FA"
                opacity="0.6"
              />
            </motion.g>
          </motion.g>
        )}

        {/* Stage 2: Sprout */}
        {stage === 2 && (
          <motion.g
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ type: 'spring', stiffness: 200 }}
          >
            {/* Pot */}
            <path d="M70 200 L75 230 L125 230 L130 200 Z" fill="#A0522D" />
            <ellipse cx="100" cy="200" rx="30" ry="8" fill="#8B4513" />
            <ellipse cx="100" cy="198" rx="25" ry="6" fill="#3E2723" />

            {/* Stem */}
            <motion.path
              d="M100 195 Q100 170 100 160"
              stroke="#228B22"
              strokeWidth="4"
              fill="none"
              strokeLinecap="round"
              animate={{ d: ["M100 195 Q100 170 100 160", "M100 195 Q102 170 100 160", "M100 195 Q100 170 100 160"] }}
              transition={{ duration: 3, repeat: Infinity }}
            />

            {/* Leaves */}
            <motion.ellipse
              cx="90"
              cy="155"
              rx="12"
              ry="8"
              fill={colors.secondary}
              animate={{ rotate: [-5, 5, -5] }}
              transition={{ duration: 2, repeat: Infinity }}
              style={{ transformOrigin: '100px 160px' }}
            />
            <motion.ellipse
              cx="110"
              cy="155"
              rx="12"
              ry="8"
              fill={colors.secondary}
              animate={{ rotate: [5, -5, 5] }}
              transition={{ duration: 2, repeat: Infinity, delay: 0.5 }}
              style={{ transformOrigin: '100px 160px' }}
            />
          </motion.g>
        )}

        {/* Stage 3: Sapling */}
        {stage === 3 && (
          <motion.g
            initial={{ scale: 0.8, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 150 }}
          >
            {/* Ground */}
            <ellipse cx="100" cy="230" rx="40" ry="10" fill="#3E2723" />

            {/* Trunk */}
            <path
              d="M95 230 Q95 180 95 140 L105 140 Q105 180 105 230 Z"
              fill="#8B4513"
            />

            {/* Branches */}
            <motion.g
              animate={{ rotate: [-1, 1, -1] }}
              transition={{ duration: 4, repeat: Infinity }}
              style={{ transformOrigin: '100px 180px' }}
            >
              {/* Foliage */}
              <ellipse cx="100" cy="120" rx="35" ry="30" fill={colors.primary} opacity="0.9" />
              <ellipse cx="80" cy="130" rx="20" ry="18" fill={colors.secondary} opacity="0.8" />
              <ellipse cx="120" cy="130" rx="20" ry="18" fill={colors.secondary} opacity="0.8" />
              <ellipse cx="100" cy="100" rx="25" ry="20" fill={colors.primary} />

              {/* Season accents */}
              {season === 'spring' && (
                <>
                  <circle cx="85" cy="110" r="5" fill="#FFB7C5" />
                  <circle cx="115" cy="115" r="4" fill="#FFB7C5" />
                  <circle cx="100" cy="95" r="4" fill="#FFB7C5" />
                </>
              )}
              {season === 'autumn' && (
                <>
                  <circle cx="75" cy="125" r="4" fill="#FF6B35" />
                  <circle cx="125" cy="120" r="3" fill="#FFD93D" />
                </>
              )}
              {season === 'winter' && (
                <>
                  <circle cx="80" cy="105" r="3" fill="white" opacity="0.8" />
                  <circle cx="110" cy="100" r="4" fill="white" opacity="0.8" />
                  <circle cx="95" cy="115" r="3" fill="white" opacity="0.8" />
                </>
              )}
            </motion.g>
          </motion.g>
        )}

        {/* Stage 4: Tree */}
        {stage === 4 && (
          <motion.g
            initial={{ scale: 0.9, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 120 }}
          >
            {/* Ground */}
            <ellipse cx="100" cy="235" rx="50" ry="12" fill="#3E2723" />

            {/* Trunk */}
            <path
              d="M90 235 Q88 180 85 130 L115 130 Q112 180 110 235 Z"
              fill="#8B4513"
            />
            <path
              d="M85 130 Q70 120 60 140"
              stroke="#8B4513"
              strokeWidth="6"
              fill="none"
            />
            <path
              d="M115 130 Q130 120 140 140"
              stroke="#8B4513"
              strokeWidth="6"
              fill="none"
            />

            {/* Main canopy */}
            <motion.g
              animate={{ rotate: [-0.5, 0.5, -0.5] }}
              transition={{ duration: 5, repeat: Infinity }}
              style={{ transformOrigin: '100px 150px' }}
            >
              <ellipse cx="100" cy="90" rx="55" ry="45" fill={colors.primary} opacity="0.9" />
              <ellipse cx="65" cy="110" rx="30" ry="25" fill={colors.secondary} opacity="0.85" />
              <ellipse cx="135" cy="110" rx="30" ry="25" fill={colors.secondary} opacity="0.85" />
              <ellipse cx="100" cy="60" rx="40" ry="30" fill={colors.primary} />

              {/* Season details */}
              {season === 'spring' && (
                <>
                  <circle cx="70" cy="75" r="6" fill="#FFB7C5" />
                  <circle cx="130" cy="80" r="5" fill="#FFB7C5" />
                  <circle cx="100" cy="50" r="6" fill="#FFB7C5" />
                  <circle cx="55" cy="100" r="4" fill="#FFB7C5" />
                  <circle cx="145" cy="95" r="4" fill="#FFB7C5" />
                </>
              )}
              {season === 'summer' && (
                <>
                  <circle cx="80" cy="85" r="4" fill="#FFD700" opacity="0.6" />
                  <circle cx="120" cy="75" r="3" fill="#FFD700" opacity="0.6" />
                </>
              )}
              {season === 'autumn' && (
                <>
                  <circle cx="60" cy="100" r="5" fill="#FF6B35" />
                  <circle cx="140" cy="105" r="4" fill="#FFD93D" />
                  <circle cx="80" cy="70" r="4" fill="#FF6B35" />
                  <circle cx="120" cy="65" r="3" fill="#FFD93D" />
                </>
              )}
              {season === 'winter' && (
                <>
                  <ellipse cx="100" cy="50" rx="35" ry="8" fill="white" opacity="0.7" />
                  <ellipse cx="70" cy="85" rx="20" ry="5" fill="white" opacity="0.6" />
                  <ellipse cx="130" cy="90" rx="20" ry="5" fill="white" opacity="0.6" />
                </>
              )}
            </motion.g>
          </motion.g>
        )}

        {/* Stage 5: Great Tree */}
        {stage === 5 && (
          <motion.g
            initial={{ scale: 0.95, opacity: 0 }}
            animate={{ scale: 1, opacity: 1 }}
            transition={{ type: 'spring', stiffness: 100 }}
          >
            {/* Ground */}
            <ellipse cx="100" cy="240" rx="60" ry="15" fill="#3E2723" />

            {/* Massive trunk */}
            <path
              d="M80 240 Q75 180 70 100 L130 100 Q125 180 120 240 Z"
              fill="#8B4513"
            />
            {/* Roots */}
            <path d="M80 240 Q60 235 50 245" stroke="#8B4513" strokeWidth="8" fill="none" />
            <path d="M120 240 Q140 235 150 245" stroke="#8B4513" strokeWidth="8" fill="none" />

            {/* Main branches */}
            <path d="M70 100 Q40 80 25 100" stroke="#8B4513" strokeWidth="8" fill="none" />
            <path d="M130 100 Q160 80 175 100" stroke="#8B4513" strokeWidth="8" fill="none" />

            {/* Majestic canopy */}
            <motion.g
              animate={{ rotate: [-0.3, 0.3, -0.3] }}
              transition={{ duration: 6, repeat: Infinity }}
              style={{ transformOrigin: '100px 120px' }}
            >
              {/* Multiple layers */}
              <ellipse cx="100" cy="60" rx="75" ry="55" fill={colors.primary} opacity="0.85" />
              <ellipse cx="50" cy="90" rx="40" ry="35" fill={colors.secondary} opacity="0.8" />
              <ellipse cx="150" cy="90" rx="40" ry="35" fill={colors.secondary} opacity="0.8" />
              <ellipse cx="100" cy="30" rx="55" ry="35" fill={colors.primary} opacity="0.9" />
              <ellipse cx="70" cy="50" rx="30" ry="25" fill={colors.secondary} opacity="0.85" />
              <ellipse cx="130" cy="50" rx="30" ry="25" fill={colors.secondary} opacity="0.85" />

              {/* Crown highlight */}
              <ellipse cx="100" cy="15" rx="35" ry="20" fill={colors.primary} />

              {/* Season magic */}
              {season === 'spring' && (
                <>
                  {[...Array(12)].map((_, i) => (
                    <motion.circle
                      key={i}
                      cx={30 + Math.random() * 140}
                      cy={20 + Math.random() * 80}
                      r={3 + Math.random() * 4}
                      fill="#FFB7C5"
                      animate={{ scale: [1, 1.2, 1], opacity: [0.8, 1, 0.8] }}
                      transition={{ duration: 2, delay: i * 0.2, repeat: Infinity }}
                    />
                  ))}
                </>
              )}
              {season === 'summer' && (
                <>
                  <circle cx="100" cy="10" r="8" fill="#FFD700" opacity="0.4" />
                  <circle cx="100" cy="10" r="15" fill="#FFD700" opacity="0.2" />
                </>
              )}
              {season === 'autumn' && (
                <>
                  {[...Array(10)].map((_, i) => (
                    <circle
                      key={i}
                      cx={35 + Math.random() * 130}
                      cy={25 + Math.random() * 70}
                      r={3 + Math.random() * 3}
                      fill={i % 2 === 0 ? '#FF6B35' : '#FFD93D'}
                    />
                  ))}
                </>
              )}
              {season === 'winter' && (
                <>
                  <ellipse cx="100" cy="15" rx="50" ry="12" fill="white" opacity="0.8" />
                  <ellipse cx="55" cy="55" rx="30" ry="8" fill="white" opacity="0.7" />
                  <ellipse cx="145" cy="55" rx="30" ry="8" fill="white" opacity="0.7" />
                  <ellipse cx="100" cy="45" rx="40" ry="10" fill="white" opacity="0.6" />
                </>
              )}

              {/* Magical glow for max stage */}
              <motion.ellipse
                cx="100"
                cy="60"
                rx="80"
                ry="60"
                fill="url(#magicGlow)"
                opacity="0.3"
                animate={{ opacity: [0.2, 0.4, 0.2] }}
                transition={{ duration: 3, repeat: Infinity }}
              />
            </motion.g>

            {/* Glow gradient */}
            <defs>
              <radialGradient id="magicGlow">
                <stop offset="0%" stopColor={colors.accent} />
                <stop offset="100%" stopColor="transparent" />
              </radialGradient>
            </defs>
          </motion.g>
        )}
      </svg>

      {/* Water indicator */}
      <div className="absolute bottom-2 left-1/2 -translate-x-1/2 flex items-center gap-1 bg-black/20 backdrop-blur-sm rounded-full px-2 py-1">
        <span className="text-sm">💧</span>
        <div className="w-12 h-2 bg-white/30 rounded-full overflow-hidden">
          <motion.div
            className={cn(
              "h-full rounded-full",
              waterLevel >= 70 ? "bg-blue-400" :
              waterLevel >= 30 ? "bg-yellow-400" :
              "bg-red-400"
            )}
            initial={{ width: 0 }}
            animate={{ width: `${waterLevel}%` }}
            transition={{ duration: 0.5 }}
          />
        </div>
      </div>

      {/* Watering animation */}
      <AnimatePresence>
        {isWatering && (
          <motion.div
            className="absolute top-0 left-1/2 -translate-x-1/2"
            initial={{ y: -20, opacity: 0 }}
            animate={{ y: height / 2, opacity: [0, 1, 1, 0] }}
            exit={{ opacity: 0 }}
            transition={{ duration: 1.5 }}
          >
            {[...Array(5)].map((_, i) => (
              <motion.span
                key={i}
                className="absolute text-xl"
                style={{ left: `${i * 10 - 20}px` }}
                animate={{
                  y: [0, 30],
                  opacity: [1, 0],
                }}
                transition={{
                  duration: 0.8,
                  delay: i * 0.1,
                  repeat: 2,
                }}
              >
                💧
              </motion.span>
            ))}
          </motion.div>
        )}
      </AnimatePresence>

      {/* Thirsty indicator */}
      {isThirsty && !isWatering && (
        <motion.div
          className="absolute top-2 right-2 text-2xl"
          animate={{ scale: [1, 1.2, 1], rotate: [-5, 5, -5] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          😢
        </motion.div>
      )}
    </div>
  );
}
