/**
 * InnerWorldGarden - Beautiful animated garden visualization
 * Your personal growth garden that evolves with your activities
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Sparkles, Cloud, Sun, Moon, Star, Droplets, TreeDeciduous, Heart } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import {
  InnerWorld,
  GardenPlant,
  GardenCreature,
  Season,
  GardenWeather,
  GardenStage,
} from '@/types';
import { COMPANION_EMOJIS, PLANT_EMOJIS, CREATURE_EMOJIS } from '@/hooks/useInnerWorld';

interface InnerWorldGardenProps {
  world: InnerWorld;
  onCompanionClick?: () => void;
  onPlantClick?: (plant: GardenPlant) => void;
  onCreatureClick?: (creature: GardenCreature) => void;
  compact?: boolean;
}

// ============================================
// SEASON THEMES
// ============================================

const SEASON_THEMES: Record<Season, {
  sky: string;
  ground: string;
  accent: string;
  particles: string[];
}> = {
  spring: {
    sky: 'from-sky-200 via-pink-100 to-sky-300',
    ground: 'from-green-400 to-emerald-500',
    accent: '#f9a8d4',
    particles: ['🌸', '🌷', '🦋', '💮'],
  },
  summer: {
    sky: 'from-blue-400 via-sky-300 to-cyan-200',
    ground: 'from-green-500 to-lime-500',
    accent: '#fbbf24',
    particles: ['☀️', '🌻', '🐝', '✨'],
  },
  autumn: {
    sky: 'from-orange-200 via-amber-100 to-yellow-200',
    ground: 'from-amber-600 to-orange-500',
    accent: '#f97316',
    particles: ['🍂', '🍁', '🌾', '🍄'],
  },
  winter: {
    sky: 'from-slate-300 via-blue-100 to-indigo-200',
    ground: 'from-slate-200 to-blue-200',
    accent: '#93c5fd',
    particles: ['❄️', '⛄', '✨', '💎'],
  },
};

const WEATHER_EFFECTS: Record<GardenWeather, {
  icon: React.ReactNode;
  particles: string[];
  overlay: string;
}> = {
  sunny: {
    icon: <Sun className="w-8 h-8 text-yellow-400" />,
    particles: ['✨', '☀️'],
    overlay: '',
  },
  cloudy: {
    icon: <Cloud className="w-8 h-8 text-gray-400" />,
    particles: ['☁️'],
    overlay: 'bg-gray-200/20',
  },
  rainy: {
    icon: <Droplets className="w-8 h-8 text-blue-400" />,
    particles: ['💧', '🌧️'],
    overlay: 'bg-blue-200/20',
  },
  starry: {
    icon: <Star className="w-8 h-8 text-yellow-300" />,
    particles: ['⭐', '✨', '🌟'],
    overlay: 'bg-indigo-900/30',
  },
  aurora: {
    icon: <Sparkles className="w-8 h-8 text-purple-400" />,
    particles: ['💜', '💙', '💚', '✨'],
    overlay: 'bg-gradient-to-b from-purple-500/20 via-green-400/10 to-transparent',
  },
  magical: {
    icon: <Sparkles className="w-8 h-8 text-pink-400" />,
    particles: ['✨', '💫', '🌟', '⭐', '🔮'],
    overlay: 'bg-gradient-to-b from-purple-400/20 via-pink-300/10 to-transparent',
  },
};

const GARDEN_STAGE_INFO: Record<GardenStage, {
  name: string;
  emoji: string;
  description: string;
}> = {
  empty: { name: 'New Beginning', emoji: '🌱', description: 'Your garden awaits...' },
  sprouting: { name: 'Sprouting', emoji: '🌿', description: 'Life is beginning!' },
  growing: { name: 'Growing', emoji: '🌳', description: 'Your garden thrives!' },
  flourishing: { name: 'Flourishing', emoji: '🌺', description: 'Beautiful growth!' },
  magical: { name: 'Magical', emoji: '✨', description: 'Magic fills the air!' },
  legendary: { name: 'Legendary', emoji: '🏰', description: 'A legendary garden!' },
};

// ============================================
// ANIMATED COMPONENTS
// ============================================

function FloatingParticle({ emoji, delay }: { emoji: string; delay: number }) {
  return (
    <motion.div
      className="absolute text-2xl pointer-events-none"
      initial={{
        x: Math.random() * 100 + '%',
        y: '110%',
        opacity: 0,
        scale: 0.5,
      }}
      animate={{
        y: '-10%',
        opacity: [0, 1, 1, 0],
        scale: [0.5, 1, 1, 0.5],
        x: `${Math.random() * 100}%`,
      }}
      transition={{
        duration: 8 + Math.random() * 4,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {emoji}
    </motion.div>
  );
}

function Plant({ plant, onClick }: { plant: GardenPlant; onClick?: () => void }) {
  const emoji = PLANT_EMOJIS[plant.type][plant.stage];
  const size = plant.stage === 'seed' ? 'text-xl' :
               plant.stage === 'sprout' ? 'text-2xl' :
               plant.stage === 'growing' ? 'text-3xl' :
               plant.stage === 'blooming' ? 'text-4xl' : 'text-5xl';

  return (
    <motion.div
      className={cn(
        "absolute cursor-pointer select-none",
        size,
        plant.isSpecial && "drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]"
      )}
      style={{
        left: `${plant.position.x}%`,
        top: `${plant.position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{ scale: 1, opacity: 1 }}
      whileHover={{ scale: 1.2, y: -5 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      transition={{ type: 'spring', stiffness: 300, damping: 20 }}
    >
      <motion.span
        animate={plant.stage === 'magnificent' ? {
          scale: [1, 1.1, 1],
          rotate: [-2, 2, -2],
        } : {}}
        transition={{ duration: 2, repeat: Infinity }}
      >
        {emoji}
      </motion.span>
      {plant.isSpecial && (
        <motion.span
          className="absolute -top-2 -right-2 text-sm"
          animate={{ scale: [1, 1.3, 1], opacity: [0.8, 1, 0.8] }}
          transition={{ duration: 1.5, repeat: Infinity }}
        >
          ✨
        </motion.span>
      )}
    </motion.div>
  );
}

function Creature({ creature, onClick }: { creature: GardenCreature; onClick?: () => void }) {
  const emoji = CREATURE_EMOJIS[creature.type][creature.stage];
  const size = creature.stage === 'egg' ? 'text-lg' :
               creature.stage === 'baby' ? 'text-xl' :
               creature.stage === 'young' ? 'text-2xl' :
               creature.stage === 'adult' ? 'text-3xl' : 'text-4xl';

  // Random floating animation
  const floatY = useMemo(() => Math.random() * 10 + 5, []);
  const floatDuration = useMemo(() => Math.random() * 2 + 3, []);

  return (
    <motion.div
      className={cn(
        "absolute cursor-pointer select-none",
        size,
        creature.isSpecial && "drop-shadow-[0_0_8px_rgba(255,215,0,0.8)]"
      )}
      style={{
        left: `${creature.position.x}%`,
        top: `${creature.position.y}%`,
        transform: 'translate(-50%, -50%)',
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: 1,
        opacity: 1,
        y: [-floatY, floatY, -floatY],
        x: creature.type === 'butterfly' || creature.type === 'firefly'
          ? [-5, 5, -5] : 0,
      }}
      whileHover={{ scale: 1.3 }}
      whileTap={{ scale: 0.9 }}
      onClick={onClick}
      transition={{
        scale: { type: 'spring', stiffness: 300 },
        y: { duration: floatDuration, repeat: Infinity, ease: 'easeInOut' },
        x: { duration: floatDuration * 1.5, repeat: Infinity, ease: 'easeInOut' },
      }}
    >
      {emoji}
      {creature.isSpecial && (
        <motion.span
          className="absolute -top-1 -right-1 text-xs"
          animate={{ scale: [1, 1.3, 1] }}
          transition={{ duration: 1, repeat: Infinity }}
        >
          💫
        </motion.span>
      )}
    </motion.div>
  );
}

function Companion({
  world,
  onClick
}: {
  world: InnerWorld;
  onClick?: () => void;
}) {
  const emoji = COMPANION_EMOJIS[world.companion.type];
  const { mood, level, name } = world.companion;

  const moodAnimation = useMemo(() => {
    switch (mood) {
      case 'sleeping':
        return { rotate: [0, 5, 0], scale: [1, 1.02, 1] };
      case 'calm':
        return { y: [0, -3, 0] };
      case 'happy':
        return { y: [0, -8, 0], rotate: [-3, 3, -3] };
      case 'excited':
        return { y: [0, -12, 0], rotate: [-5, 5, -5], scale: [1, 1.1, 1] };
      case 'celebrating':
        return { y: [0, -15, 0], rotate: [-10, 10, -10], scale: [1, 1.15, 1] };
      case 'supportive':
        return { y: [0, -5, 0], scale: [1, 1.05, 1] };
      default:
        return { y: [0, -3, 0] };
    }
  }, [mood]);

  return (
    <motion.div
      className="absolute bottom-[15%] left-1/2 -translate-x-1/2 cursor-pointer z-20"
      whileHover={{ scale: 1.15 }}
      whileTap={{ scale: 0.95 }}
      onClick={onClick}
    >
      <motion.div
        className="flex flex-col items-center"
        animate={moodAnimation}
        transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
      >
        {/* Companion emoji */}
        <span className="text-6xl drop-shadow-lg">{emoji}</span>

        {/* Mood indicator */}
        {mood === 'sleeping' && (
          <motion.span
            className="absolute -top-2 -right-2 text-2xl"
            animate={{ opacity: [0.5, 1, 0.5], y: [0, -5, 0] }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            💤
          </motion.span>
        )}
        {mood === 'celebrating' && (
          <>
            <motion.span
              className="absolute -top-4 -left-4 text-xl"
              animate={{ rotate: [0, 20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity }}
            >
              🎉
            </motion.span>
            <motion.span
              className="absolute -top-4 -right-4 text-xl"
              animate={{ rotate: [0, -20, 0], scale: [1, 1.2, 1] }}
              transition={{ duration: 0.5, repeat: Infinity, delay: 0.25 }}
            >
              🎊
            </motion.span>
          </>
        )}
        {mood === 'supportive' && (
          <motion.span
            className="absolute -top-2 right-0 text-xl"
            animate={{ scale: [1, 1.2, 1] }}
            transition={{ duration: 1, repeat: Infinity }}
          >
            💝
          </motion.span>
        )}

        {/* Name and level badge */}
        <div className="mt-1 flex flex-col items-center">
          <span className="text-xs font-medium text-white/90 drop-shadow-md">
            {name}
          </span>
          <span className="text-[10px] px-2 py-0.5 rounded-full bg-white/20 backdrop-blur-sm text-white/80">
            Lv.{level}
          </span>
        </div>
      </motion.div>
    </motion.div>
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
  const { t } = useLanguage();
  const [particles, setParticles] = useState<Array<{ id: number; emoji: string; delay: number }>>([]);

  const seasonTheme = SEASON_THEMES[world.season];
  const weatherEffect = WEATHER_EFFECTS[world.weather];
  const stageInfo = GARDEN_STAGE_INFO[world.gardenStage];

  // Generate floating particles
  useEffect(() => {
    const allParticles = [...seasonTheme.particles, ...weatherEffect.particles];
    const newParticles = Array.from({ length: 8 }, (_, i) => ({
      id: i,
      emoji: allParticles[Math.floor(Math.random() * allParticles.length)],
      delay: i * 1.5,
    }));
    setParticles(newParticles);
  }, [world.season, world.weather]);

  return (
    <div
      className={cn(
        "relative overflow-hidden rounded-3xl",
        compact ? "h-48" : "h-80"
      )}
    >
      {/* Sky background */}
      <div className={cn(
        "absolute inset-0 bg-gradient-to-b",
        seasonTheme.sky
      )} />

      {/* Weather overlay */}
      {weatherEffect.overlay && (
        <div className={cn("absolute inset-0", weatherEffect.overlay)} />
      )}

      {/* Ground */}
      <div
        className={cn(
          "absolute bottom-0 left-0 right-0 h-1/3 bg-gradient-to-t",
          seasonTheme.ground
        )}
        style={{
          borderTopLeftRadius: '50% 30px',
          borderTopRightRadius: '50% 30px',
        }}
      />

      {/* Weather icon */}
      <div className="absolute top-3 right-3 z-10">
        <motion.div
          animate={{ rotate: world.weather === 'sunny' ? 360 : 0 }}
          transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
        >
          {weatherEffect.icon}
        </motion.div>
      </div>

      {/* Garden stage badge */}
      <div className="absolute top-3 left-3 z-10">
        <div className="flex items-center gap-1.5 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
          <span className="text-lg">{stageInfo.emoji}</span>
          <span className="text-xs font-medium text-white/90">{stageInfo.name}</span>
        </div>
      </div>

      {/* Stats bar */}
      {!compact && (
        <div className="absolute top-12 left-3 z-10 flex flex-col gap-1">
          <div className="flex items-center gap-1 text-xs text-white/80">
            <TreeDeciduous className="w-3 h-3" />
            <span>{world.plants.length}</span>
          </div>
          <div className="flex items-center gap-1 text-xs text-white/80">
            <Heart className="w-3 h-3" />
            <span>{world.creatures.length}</span>
          </div>
          {world.currentActiveStreak > 0 && (
            <div className="flex items-center gap-1 text-xs text-white/80">
              <Sparkles className="w-3 h-3" />
              <span>{world.currentActiveStreak}🔥</span>
            </div>
          )}
        </div>
      )}

      {/* Floating particles */}
      <AnimatePresence>
        {particles.map((p) => (
          <FloatingParticle key={p.id} emoji={p.emoji} delay={p.delay} />
        ))}
      </AnimatePresence>

      {/* Plants */}
      <AnimatePresence>
        {world.plants.map((plant) => (
          <Plant
            key={plant.id}
            plant={plant}
            onClick={() => onPlantClick?.(plant)}
          />
        ))}
      </AnimatePresence>

      {/* Creatures */}
      <AnimatePresence>
        {world.creatures.map((creature) => (
          <Creature
            key={creature.id}
            creature={creature}
            onClick={() => onCreatureClick?.(creature)}
          />
        ))}
      </AnimatePresence>

      {/* Companion */}
      <Companion
        world={world}
        onClick={onCompanionClick}
      />

      {/* Welcome back overlay */}
      <AnimatePresence>
        {world.pendingGrowth.companionMissedYou && (
          <motion.div
            className="absolute inset-0 bg-black/40 backdrop-blur-sm flex items-center justify-center z-30"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            exit={{ opacity: 0 }}
          >
            <motion.div
              className="text-center p-6"
              initial={{ scale: 0.8, y: 20 }}
              animate={{ scale: 1, y: 0 }}
              transition={{ delay: 0.2 }}
            >
              <motion.span
                className="text-7xl block mb-4"
                animate={{ y: [0, -10, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                {COMPANION_EMOJIS[world.companion.type]}
              </motion.span>
              <p className="text-white text-lg font-medium mb-1">
                {world.companion.name} {t.missedYou || 'missed you!'}
              </p>
              <p className="text-white/70 text-sm">
                {t.welcomeBack || 'Welcome back to your garden'}
              </p>
            </motion.div>
          </motion.div>
        )}
      </AnimatePresence>

      {/* Gradient overlay at bottom for text readability */}
      <div className="absolute bottom-0 left-0 right-0 h-16 bg-gradient-to-t from-black/20 to-transparent pointer-events-none" />
    </div>
  );
}

export default InnerWorldGarden;
