/**
 * InnerWorldGarden - Beautiful minimalist garden visualization
 * Clean, peaceful design focused on the tree
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  InnerWorld,
  GardenPlant,
  GardenCreature,
  Season,
} from '@/types';
import { SeasonalTree } from './SeasonalTree';
import { getTreeStageName, getSeasonEmoji } from '@/lib/seasonHelper';

interface InnerWorldGardenProps {
  world: InnerWorld;
  onCompanionClick?: () => void;
  onPlantClick?: (plant: GardenPlant) => void;
  onCreatureClick?: (creature: GardenCreature) => void;
  compact?: boolean;
}

// ============================================
// SEASON THEMES - Refined beautiful gradients
// ============================================

const SEASON_THEMES: Record<Season, {
  sky: string;
  skyGradient: string;
  ground: string;
  accent: string;
  particles: string[];
  ambientColor: string;
}> = {
  spring: {
    sky: 'from-rose-100 via-sky-100 to-violet-100',
    skyGradient: 'linear-gradient(180deg, #fce7f3 0%, #e0f2fe 50%, #ede9fe 100%)',
    ground: 'from-emerald-400/80 to-green-500/80',
    accent: '#f9a8d4',
    particles: ['🌸', '🦋', '✨'],
    ambientColor: 'rgba(249, 168, 212, 0.15)',
  },
  summer: {
    sky: 'from-amber-50 via-sky-100 to-cyan-100',
    skyGradient: 'linear-gradient(180deg, #fffbeb 0%, #e0f2fe 50%, #cffafe 100%)',
    ground: 'from-green-400/80 to-emerald-500/80',
    accent: '#fbbf24',
    particles: ['☀️', '🌻', '✨'],
    ambientColor: 'rgba(251, 191, 36, 0.1)',
  },
  autumn: {
    sky: 'from-orange-100 via-amber-50 to-rose-100',
    skyGradient: 'linear-gradient(180deg, #ffedd5 0%, #fffbeb 50%, #ffe4e6 100%)',
    ground: 'from-amber-500/80 to-orange-600/80',
    accent: '#f97316',
    particles: ['🍂', '🍁', '✨'],
    ambientColor: 'rgba(249, 115, 22, 0.1)',
  },
  winter: {
    sky: 'from-slate-100 via-blue-50 to-indigo-100',
    skyGradient: 'linear-gradient(180deg, #f1f5f9 0%, #eff6ff 50%, #e0e7ff 100%)',
    ground: 'from-slate-300/80 to-blue-200/80',
    accent: '#93c5fd',
    particles: ['❄️', '✨', '💎'],
    ambientColor: 'rgba(147, 197, 253, 0.15)',
  },
};

// ============================================
// ANIMATED COMPONENTS
// ============================================

function FloatingParticle({ emoji, delay, season }: { emoji: string; delay: number; season: Season }) {
  const startX = useMemo(() => Math.random() * 80 + 10, []);
  const duration = useMemo(() => 8 + Math.random() * 6, []);

  return (
    <motion.div
      className="absolute text-lg pointer-events-none opacity-60"
      initial={{
        x: `${startX}%`,
        y: '-5%',
        opacity: 0,
        scale: 0.6,
        rotate: 0,
      }}
      animate={{
        y: '105%',
        opacity: [0, 0.6, 0.6, 0],
        scale: [0.6, 0.8, 0.8, 0.6],
        rotate: season === 'autumn' ? [0, 360] : [0, 180],
        x: `${startX + (Math.random() - 0.5) * 20}%`,
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {emoji}
    </motion.div>
  );
}

function GardenScene({
  world,
  onClick,
  language,
}: {
  world: InnerWorld;
  onClick?: () => void;
  language: string;
}) {
  const { companion } = world;
  const treeStage = companion.treeStage || 1;
  const waterLevel = companion.waterLevel || 50;
  const stageName = getTreeStageName(treeStage, language);
  const seasonTheme = SEASON_THEMES[world.season];

  return (
    <div className="relative w-full h-full flex flex-col items-center justify-end pb-4">
      {/* Tree container */}
      <motion.div
        className="relative cursor-pointer z-10"
        whileHover={{ scale: 1.02 }}
        whileTap={{ scale: 0.98 }}
        onClick={onClick}
      >
        <SeasonalTree
          stage={treeStage}
          waterLevel={waterLevel}
          xp={companion.treeXP || 0}
          season={world.season}
          size="md"
          className="drop-shadow-2xl"
        />
      </motion.div>

      {/* Stage name pill */}
      <motion.div
        className="mt-3 px-4 py-2 rounded-full backdrop-blur-md bg-white/20 border border-white/30 shadow-lg"
        initial={{ opacity: 0, y: 10 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        <div className="flex items-center gap-2">
          <span className="text-base">{getSeasonEmoji(world.season)}</span>
          <span className="text-sm font-medium text-slate-700 dark:text-slate-200">
            {stageName}
          </span>
          <span className="text-xs text-slate-500 dark:text-slate-400">
            ({treeStage}/5)
          </span>
        </div>
      </motion.div>

      {/* Water level warning */}
      {waterLevel < 30 && (
        <motion.div
          className="mt-2 px-3 py-1 rounded-full bg-orange-500/20 backdrop-blur-sm border border-orange-300/30"
          animate={{ scale: [1, 1.02, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <span className="text-xs text-orange-600 dark:text-orange-300 flex items-center gap-1">
            💧 Нужен полив
          </span>
        </motion.div>
      )}
    </div>
  );
}

// ============================================
// MAIN COMPONENT
// ============================================

export function InnerWorldGarden({
  world,
  onCompanionClick,
  onPlantClick,
  onCreatureClick,
  compact = false,
}: InnerWorldGardenProps) {
  const { t, language } = useLanguage();
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; delay: number }>>([]);

  const seasonTheme = SEASON_THEMES[world.season];

  // Generate sparse floating particles
  useEffect(() => {
    const particleEmojis = seasonTheme.particles;
    const newParticles = Array.from({ length: compact ? 3 : 5 }, (_, i) => ({
      id: i,
      emoji: particleEmojis[i % particleEmojis.length],
      delay: i * 2.5,
    }));
    setParticles(newParticles);
  }, [world.season, compact]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl shadow-xl",
        compact ? "h-56" : "h-72"
      )}
    >
      {/* Beautiful sky background */}
      <div
        className="absolute inset-0"
        style={{ background: seasonTheme.skyGradient }}
      />

      {/* Ambient glow */}
      <div
        className="absolute inset-0"
        style={{
          background: `radial-gradient(ellipse at 50% 100%, ${seasonTheme.ambientColor}, transparent 70%)`,
        }}
      />

      {/* Ground with grass effect */}
      <div className="absolute bottom-0 left-0 right-0 h-1/4">
        {/* Grass layer */}
        <div
          className={cn(
            "absolute inset-0 bg-gradient-to-t",
            seasonTheme.ground
          )}
          style={{
            borderTopLeftRadius: '50% 40px',
            borderTopRightRadius: '50% 40px',
          }}
        />
        {/* Grass highlight */}
        <div
          className="absolute inset-0 bg-gradient-to-t from-transparent to-white/10"
          style={{
            borderTopLeftRadius: '50% 40px',
            borderTopRightRadius: '50% 40px',
          }}
        />
      </div>

      {/* Floating particles - sparse and elegant */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {particles.map((p) => (
          <FloatingParticle
            key={p.id}
            emoji={p.emoji}
            delay={p.delay}
            season={world.season}
          />
        ))}
      </div>

      {/* Main garden scene */}
      <GardenScene
        world={world}
        onClick={onCompanionClick}
        language={language}
      />

      {/* Streak indicator - subtle top right */}
      {world.currentActiveStreak > 0 && (
        <motion.div
          className="absolute top-3 right-3 px-3 py-1.5 rounded-full backdrop-blur-md bg-white/30 border border-white/40 shadow-md"
          initial={{ opacity: 0, scale: 0.8 }}
          animate={{ opacity: 1, scale: 1 }}
        >
          <span className="text-sm font-semibold flex items-center gap-1">
            <span>🔥</span>
            <span className="text-orange-600 dark:text-orange-400">{world.currentActiveStreak}</span>
          </span>
        </motion.div>
      )}

      {/* Welcome back overlay */}
      <AnimatePresence>
        {world.pendingGrowth.companionMissedYou && (
          <motion.div
            className="absolute inset-0 bg-black/30 backdrop-blur-sm flex items-center justify-center z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
            onClick={onCompanionClick}
          >
            <motion.div
              className="text-center p-6 bg-white/10 backdrop-blur-md rounded-3xl border border-white/20 mx-4"
              initial={{ scale: 0.9, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.1, type: 'spring', stiffness: 200 }}
            >
              <motion.div
                className="text-5xl mb-3"
                animate={{ scale: [1, 1.1, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                {getSeasonEmoji(world.season)}
              </motion.div>
              <p className="text-white text-lg font-semibold mb-1">
                {t.treeMissedYou || 'Твоё дерево скучало!'}
              </p>
              <p className="text-white/70 text-sm">
                {t.welcomeBack || 'С возвращением в сад'}
              </p>
              <p className="text-white/50 text-xs mt-2">
                Нажми, чтобы продолжить
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Bottom gradient for polish */}
      <div className="absolute bottom-0 left-0 right-0 h-8 bg-gradient-to-t from-black/5 to-transparent pointer-events-none" />
    </div>
  );
}
