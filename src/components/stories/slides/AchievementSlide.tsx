/**
 * AchievementSlide - "Храм трофеев" (Trophy Temple)
 *
 * Achievements displayed on pedestals in a grand temple setting.
 * Spotlights, dust particles, and golden glow effects.
 */

import { motion } from 'framer-motion';
import { EmojiOrIcon, TrophyIcon } from '@/components/icons';
import type { StorySlide } from '@/lib/progressStories';
import type { Badge } from '@/types';

interface AchievementSlideProps {
  slide: StorySlide;
  language: string;
}

// Dust Particle in spotlight
function DustParticle({ x, delay }: { x: number; delay: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-yellow-200/50"
      style={{ left: `${x}%`, top: '20%' }}
      initial={{ y: 0, opacity: 0 }}
      animate={{
        y: [0, 200],
        opacity: [0, 0.8, 0.8, 0],
        x: [0, Math.random() * 20 - 10],
      }}
      transition={{
        duration: 4 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Pedestal with Badge
function BadgePedestal({
  badge,
  index,
  language,
}: {
  badge: Badge;
  index: number;
  language: string;
}) {
  const delay = 0.3 + index * 0.2;

  return (
    <motion.div
      className="relative flex flex-col items-center"
      initial={{ opacity: 0, y: 50 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ delay, type: 'spring', stiffness: 100 }}
    >
      {/* Spotlight beam */}
      <motion.div
        className="absolute -top-32 w-20 pointer-events-none"
        style={{
          height: 180,
          background: `linear-gradient(180deg,
            rgba(255, 215, 0, 0.3) 0%,
            rgba(255, 215, 0, 0.1) 50%,
            transparent 100%
          )`,
          clipPath: 'polygon(30% 0%, 70% 0%, 100% 100%, 0% 100%)',
        }}
        animate={{
          opacity: [0.5, 0.8, 0.5],
        }}
        transition={{ duration: 3, repeat: Infinity, delay: index * 0.5 }}
      />

      {/* Badge card with 3D effect */}
      <motion.div
        className="relative z-10 w-20 h-20 rounded-2xl flex items-center justify-center"
        style={{
          background: `linear-gradient(135deg, #2a2a2a 0%, #1a1a1a 100%)`,
          boxShadow: `
            0 0 30px rgba(255, 215, 0, 0.3),
            inset 0 1px 0 rgba(255, 255, 255, 0.1),
            inset 0 -1px 0 rgba(0, 0, 0, 0.3)
          `,
          border: '1px solid rgba(255, 215, 0, 0.2)',
        }}
        whileHover={{ scale: 1.1, rotateY: 10 }}
        animate={{
          boxShadow: [
            '0 0 30px rgba(255, 215, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
            '0 0 50px rgba(255, 215, 0, 0.5), inset 0 1px 0 rgba(255, 255, 255, 0.2)',
            '0 0 30px rgba(255, 215, 0, 0.3), inset 0 1px 0 rgba(255, 255, 255, 0.1)',
          ],
        }}
        transition={{ duration: 2, repeat: Infinity, delay: index * 0.3 }}
      >
        <motion.div
          initial={{ scale: 0, rotate: -180 }}
          animate={{ scale: 1, rotate: 0 }}
          transition={{ delay: delay + 0.2, type: 'spring' }}
          style={{
            filter: 'drop-shadow(0 0 10px rgba(255, 215, 0, 0.5))',
          }}
        >
          <EmojiOrIcon emoji={badge.icon} iconName={badge.iconName} size="lg" />
        </motion.div>
      </motion.div>

      {/* Pedestal */}
      <div
        className="w-24 h-8 mt-2 rounded-t-lg"
        style={{
          background: `linear-gradient(180deg, #d4af37 0%, #b8960c 50%, #8b7200 100%)`,
          boxShadow: '0 4px 15px rgba(0, 0, 0, 0.3)',
        }}
      />
      <div
        className="w-28 h-4 rounded-b-lg"
        style={{
          background: `linear-gradient(180deg, #8b7200 0%, #6b5500 100%)`,
        }}
      />

      {/* Badge title */}
      <motion.p
        className="text-xs text-white/80 mt-2 text-center max-w-24 line-clamp-2"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: delay + 0.4 }}
      >
        {badge.title[language as keyof typeof badge.title] || badge.title['en']}
      </motion.p>
    </motion.div>
  );
}

export function AchievementSlide({ slide, language }: AchievementSlideProps) {
  const badges = (slide.data as Badge[]) || [];
  const displayBadges = badges.slice(0, 4);

  // Generate dust particles
  const dustParticles = Array.from({ length: 20 }, (_, i) => ({
    id: i,
    x: 15 + (i % 4) * 20 + Math.random() * 10,
    delay: Math.random() * 3,
  }));

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Dark temple background */}
      <div
        className="absolute inset-0"
        style={{
          background: `linear-gradient(180deg,
            #0a0a0a 0%,
            #1a1510 30%,
            #2a2015 60%,
            #1a1510 100%
          )`,
        }}
      />

      {/* Temple columns on sides */}
      <svg className="absolute inset-0 w-full h-full pointer-events-none" preserveAspectRatio="none">
        <defs>
          <linearGradient id="columnGrad" x1="0%" y1="0%" x2="100%" y2="0%">
            <stop offset="0%" stopColor="#3d3020" />
            <stop offset="50%" stopColor="#5a4530" />
            <stop offset="100%" stopColor="#3d3020" />
          </linearGradient>
        </defs>

        {/* Left column */}
        <rect x="5%" y="0" width="8%" height="100%" fill="url(#columnGrad)" />
        <rect x="4%" y="0" width="10%" height="5%" fill="#4a3a28" />
        <rect x="4%" y="95%" width="10%" height="5%" fill="#4a3a28" />

        {/* Right column */}
        <rect x="87%" y="0" width="8%" height="100%" fill="url(#columnGrad)" />
        <rect x="86%" y="0" width="10%" height="5%" fill="#4a3a28" />
        <rect x="86%" y="95%" width="10%" height="5%" fill="#4a3a28" />
      </svg>

      {/* Marble floor reflection */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/4"
        style={{
          background: `linear-gradient(180deg,
            transparent 0%,
            rgba(100, 90, 70, 0.1) 30%,
            rgba(100, 90, 70, 0.2) 100%
          )`,
        }}
      />

      {/* Dust particles in spotlights */}
      {dustParticles.map((particle) => (
        <DustParticle key={particle.id} x={particle.x} delay={particle.delay} />
      ))}

      {/* Content */}
      <div className="absolute inset-0 flex flex-col items-center pt-12 px-8">
        {/* Title with trophy icon */}
        <motion.div
          className="flex items-center gap-3 mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.2 }}
        >
          <TrophyIcon size="md" animated />
          <h2 className="text-2xl font-bold text-white">{slide.title}</h2>
        </motion.div>

        <motion.p
          className="text-white/60 text-sm mb-8"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.4 }}
        >
          {displayBadges.length} new {displayBadges.length === 1 ? 'achievement' : 'achievements'}
        </motion.p>

        {/* Badges on pedestals */}
        <div className="flex justify-center gap-6 mt-4">
          {displayBadges.map((badge, index) => (
            <BadgePedestal
              key={badge.id}
              badge={badge}
              index={index}
              language={language}
            />
          ))}
        </div>

        {/* If no badges */}
        {displayBadges.length === 0 && (
          <motion.div
            className="flex flex-col items-center mt-12"
            initial={{ opacity: 0 }}
            animate={{ opacity: 1 }}
            transition={{ delay: 0.5 }}
          >
            <div className="w-20 h-20 rounded-2xl bg-white/5 flex items-center justify-center mb-4">
              <TrophyIcon size="xl" />
            </div>
            <p className="text-white/60">Keep going to unlock achievements!</p>
          </motion.div>
        )}
      </div>

      {/* Golden ambient light at bottom */}
      <div
        className="absolute bottom-0 left-0 right-0 h-32 pointer-events-none"
        style={{
          background: `radial-gradient(ellipse at bottom, rgba(255, 215, 0, 0.1) 0%, transparent 70%)`,
        }}
      />
    </div>
  );
}

export default AchievementSlide;
