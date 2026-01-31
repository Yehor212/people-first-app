/**
 * IntroSlide - "Космический портал" (Space Portal)
 *
 * A dramatic opening with an expanding portal, star vortex,
 * and cinematic title reveal. Sets the premium tone for the entire story.
 */

import { motion } from 'framer-motion';
import { StarField } from '../elements/StarField';
import { SparklesIcon } from '@/components/icons';
import type { StorySlide } from '@/lib/progressStories';

interface IntroSlideProps {
  slide: StorySlide;
}

// Animation variants
const portalVariants = {
  closed: {
    scale: 0,
    opacity: 0,
    rotate: -180,
  },
  open: {
    scale: 1,
    opacity: 1,
    rotate: 0,
    transition: {
      type: 'spring',
      stiffness: 60,
      damping: 12,
      duration: 1.5,
    },
  },
};

const titleVariants = {
  hidden: {
    opacity: 0,
    scale: 0.8,
    filter: 'blur(20px)',
  },
  visible: {
    opacity: 1,
    scale: 1,
    filter: 'blur(0px)',
    transition: {
      duration: 0.8,
      delay: 0.5,
      ease: 'easeOut',
    },
  },
};

const subtitleVariants = {
  hidden: { opacity: 0, y: 20 },
  visible: {
    opacity: 1,
    y: 0,
    transition: { duration: 0.6, delay: 0.9 },
  },
};

const sparkleVariants = {
  animate: (i: number) => ({
    opacity: [0, 1, 0],
    scale: [0.5, 1.2, 0.5],
    x: Math.cos(i * 0.8) * 80,
    y: Math.sin(i * 0.8) * 80 - 20,
    transition: {
      duration: 2 + i * 0.2,
      repeat: Infinity,
      delay: i * 0.15,
      ease: 'easeInOut',
    },
  }),
};

export function IntroSlide({ slide }: IntroSlideProps) {
  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Deep space background gradient */}
      <div
        className="absolute inset-0"
        style={{
          background: `
            radial-gradient(ellipse at center, #1a1a2e 0%, #0d0d1a 50%, #000000 100%)
          `,
        }}
      />

      {/* Animated star field with vortex effect */}
      <StarField count={80} speed={1.5} vortex twinkle={false} />

      {/* Nebula glow layers */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 2 }}
        style={{
          background: `
            radial-gradient(circle at 30% 40%, rgba(139, 92, 246, 0.15) 0%, transparent 40%),
            radial-gradient(circle at 70% 60%, rgba(59, 130, 246, 0.1) 0%, transparent 35%),
            radial-gradient(circle at 50% 50%, rgba(236, 72, 153, 0.08) 0%, transparent 50%)
          `,
        }}
      />

      {/* Central portal ring */}
      <div className="absolute inset-0 flex items-center justify-center">
        <motion.div
          className="relative"
          variants={portalVariants}
          initial="closed"
          animate="open"
        >
          {/* Outer glow ring */}
          <motion.div
            className="absolute -inset-8 rounded-full"
            animate={{
              boxShadow: [
                '0 0 60px 20px rgba(139, 92, 246, 0.3)',
                '0 0 80px 30px rgba(59, 130, 246, 0.4)',
                '0 0 60px 20px rgba(139, 92, 246, 0.3)',
              ],
            }}
            transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
          />

          {/* Portal ring SVG */}
          <svg
            width="280"
            height="280"
            viewBox="0 0 280 280"
            className="relative z-10"
          >
            <defs>
              <linearGradient id="portalGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                <stop offset="0%" stopColor="#8B5CF6" />
                <stop offset="50%" stopColor="#3B82F6" />
                <stop offset="100%" stopColor="#EC4899" />
              </linearGradient>
              <filter id="portalGlow">
                <feGaussianBlur stdDeviation="4" result="coloredBlur" />
                <feMerge>
                  <feMergeNode in="coloredBlur" />
                  <feMergeNode in="SourceGraphic" />
                </feMerge>
              </filter>
            </defs>

            {/* Outer ring */}
            <motion.circle
              cx="140"
              cy="140"
              r="130"
              fill="none"
              stroke="url(#portalGradient)"
              strokeWidth="3"
              filter="url(#portalGlow)"
              initial={{ pathLength: 0, opacity: 0 }}
              animate={{ pathLength: 1, opacity: 1 }}
              transition={{ duration: 1.5, ease: 'easeOut' }}
            />

            {/* Inner ring */}
            <motion.circle
              cx="140"
              cy="140"
              r="110"
              fill="none"
              stroke="url(#portalGradient)"
              strokeWidth="2"
              strokeDasharray="10 5"
              opacity={0.6}
              animate={{ rotate: 360 }}
              transition={{ duration: 20, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: 'center' }}
            />

            {/* Innermost ring */}
            <motion.circle
              cx="140"
              cy="140"
              r="90"
              fill="none"
              stroke="url(#portalGradient)"
              strokeWidth="1"
              opacity={0.4}
              animate={{ rotate: -360 }}
              transition={{ duration: 15, repeat: Infinity, ease: 'linear' }}
              style={{ transformOrigin: 'center' }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Sparkle particles around center */}
            {[...Array(8)].map((_, i) => (
              <motion.div
                key={i}
                className="absolute"
                custom={i}
                variants={sparkleVariants}
                animate="animate"
                style={{
                  left: '50%',
                  top: '50%',
                  marginLeft: -8,
                  marginTop: -8,
                }}
              >
                <SparklesIcon size="sm" animated />
              </motion.div>
            ))}

            {/* Title */}
            <motion.h1
              className="text-3xl font-black tracking-tight text-white text-center"
              variants={titleVariants}
              initial="hidden"
              animate="visible"
              style={{
                textShadow: '0 0 30px rgba(139, 92, 246, 0.5)',
              }}
            >
              {slide.title}
            </motion.h1>

            {/* Subtitle (date range) */}
            <motion.p
              className="text-lg text-white/70 mt-2"
              variants={subtitleVariants}
              initial="hidden"
              animate="visible"
            >
              {slide.subtitle}
            </motion.p>
          </div>
        </motion.div>
      </div>

      {/* Bottom decorative element */}
      <motion.div
        className="absolute bottom-20 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2, duration: 0.6 }}
      >
        <div className="flex items-center gap-2 px-4 py-2 rounded-full bg-white/5 backdrop-blur-sm border border-white/10">
          <motion.div
            animate={{ rotate: 360 }}
            transition={{ duration: 8, repeat: Infinity, ease: 'linear' }}
          >
            <SparklesIcon size="xs" />
          </motion.div>
          <span className="text-sm text-white/60 font-medium">
            Swipe to explore
          </span>
        </div>
      </motion.div>
    </div>
  );
}

export default IntroSlide;
