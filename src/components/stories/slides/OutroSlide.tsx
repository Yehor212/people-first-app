/**
 * OutroSlide - "Рассвет нового дня" (New Day Sunrise)
 *
 * A hopeful closing with an animated sunrise, birds flying,
 * and an inspirational message. Sets positive tone for next week.
 */

import { motion } from 'framer-motion';
import { SeedlingIcon, SparklesIcon } from '@/components/icons';
import type { StorySlide } from '@/lib/progressStories';

interface OutroSlideProps {
  slide: StorySlide;
  t: Record<string, string>;
}

// Flying Bird Component
function Bird({ id }: { id: number }) {
  const startY = 20 + Math.random() * 30;
  const duration = 6 + Math.random() * 4;
  const delay = id * 0.8;

  return (
    <motion.div
      className="absolute"
      style={{ top: `${startY}%`, left: '-10%' }}
      initial={{ x: 0 }}
      animate={{
        x: ['0%', '120%'],
        y: [0, -20, 0, -15, 0],
      }}
      transition={{
        duration,
        delay,
        repeat: Infinity,
        ease: 'linear',
      }}
    >
      {/* Bird silhouette */}
      <motion.svg
        width="24"
        height="12"
        viewBox="0 0 24 12"
        fill="currentColor"
        className="text-gray-800"
        animate={{
          scaleY: [1, 0.6, 1],
        }}
        transition={{
          duration: 0.3,
          repeat: Infinity,
        }}
      >
        <path d="M12 6 C8 2, 4 4, 0 6 C4 4, 8 6, 12 6 C16 6, 20 4, 24 6 C20 4, 16 2, 12 6" />
      </motion.svg>
    </motion.div>
  );
}

// Sun Ray Component
function SunRay({ angle, length }: { angle: number; length: number }) {
  return (
    <motion.div
      className="absolute origin-bottom"
      style={{
        bottom: '25%',
        left: '50%',
        width: 3,
        height: length,
        background: `linear-gradient(to top, rgba(255, 200, 100, 0.8), transparent)`,
        transform: `translateX(-50%) rotate(${angle}deg)`,
        transformOrigin: 'bottom center',
      }}
      initial={{ scaleY: 0, opacity: 0 }}
      animate={{ scaleY: 1, opacity: 1 }}
      transition={{ delay: 0.5 + Math.abs(angle) * 0.01, duration: 1 }}
    />
  );
}

export function OutroSlide({ slide, t }: OutroSlideProps) {
  // Generate sun rays
  const rays = Array.from({ length: 15 }, (_, i) => ({
    angle: -70 + i * 10,
    length: 80 + Math.random() * 60,
  }));

  // Generate birds
  const birds = Array.from({ length: 5 }, (_, i) => i);

  return (
    <div className="relative w-full h-full overflow-hidden">
      {/* Sky gradient - sunrise colors */}
      <motion.div
        className="absolute inset-0"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ duration: 1 }}
        style={{
          background: `linear-gradient(180deg,
            #1a1a2e 0%,
            #2d2d5a 10%,
            #4a3f6b 20%,
            #7b5e7b 30%,
            #c97b84 45%,
            #f0a58f 60%,
            #ffcb8e 75%,
            #fff5d4 90%,
            #fffef0 100%
          )`,
        }}
      />

      {/* Clouds at top */}
      <div className="absolute top-0 left-0 right-0 h-1/3 overflow-hidden">
        {[...Array(4)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute"
            style={{
              top: `${5 + i * 8}%`,
              left: `${i * 25 - 10}%`,
              width: 150 + Math.random() * 100,
              height: 40 + Math.random() * 20,
              background: `rgba(255, 200, 180, ${0.3 - i * 0.05})`,
              borderRadius: '50%',
              filter: 'blur(10px)',
            }}
            animate={{
              x: [0, 30, 0],
            }}
            transition={{
              duration: 20 + i * 5,
              repeat: Infinity,
              ease: 'easeInOut',
            }}
          />
        ))}
      </div>

      {/* Sun rays */}
      {rays.map((ray, i) => (
        <SunRay key={i} angle={ray.angle} length={ray.length} />
      ))}

      {/* Rising sun */}
      <motion.div
        className="absolute left-1/2 -translate-x-1/2"
        style={{ bottom: '20%' }}
        initial={{ y: 100, opacity: 0 }}
        animate={{ y: 0, opacity: 1 }}
        transition={{ duration: 1.5, ease: 'easeOut' }}
      >
        {/* Sun glow */}
        <motion.div
          className="absolute -inset-8 rounded-full"
          style={{
            background: `radial-gradient(circle, rgba(255, 200, 100, 0.6) 0%, transparent 70%)`,
          }}
          animate={{
            scale: [1, 1.2, 1],
            opacity: [0.6, 0.8, 0.6],
          }}
          transition={{ duration: 4, repeat: Infinity }}
        />

        {/* Sun disc */}
        <motion.div
          className="w-24 h-24 rounded-full"
          style={{
            background: `radial-gradient(circle at 30% 30%,
              #fff5d4 0%,
              #ffdd80 30%,
              #ffb347 70%,
              #ff8c42 100%
            )`,
            boxShadow: '0 0 60px 20px rgba(255, 200, 100, 0.5)',
          }}
          animate={{
            scale: [1, 1.05, 1],
          }}
          transition={{ duration: 3, repeat: Infinity }}
        />
      </motion.div>

      {/* Horizon/ground */}
      <div
        className="absolute bottom-0 left-0 right-0 h-1/5"
        style={{
          background: `linear-gradient(180deg,
            transparent 0%,
            rgba(30, 30, 30, 0.3) 50%,
            rgba(20, 20, 20, 0.6) 100%
          )`,
        }}
      />

      {/* Mountain/hill silhouette */}
      <svg
        className="absolute bottom-0 left-0 right-0 w-full"
        viewBox="0 0 400 100"
        preserveAspectRatio="none"
        style={{ height: '15%' }}
      >
        <path
          d="M0 100 L0 60 Q50 40 100 55 Q150 70 200 45 Q250 20 300 50 Q350 80 400 55 L400 100 Z"
          fill="rgba(30, 30, 30, 0.8)"
        />
      </svg>

      {/* Flying birds */}
      {birds.map((id) => (
        <Bird key={id} id={id} />
      ))}

      {/* Content overlay */}
      <div className="absolute inset-0 flex flex-col items-center justify-start pt-16 px-8">
        {/* Main title */}
        <motion.h1
          className="text-3xl font-bold text-white text-center mb-2"
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ delay: 0.5 }}
          style={{
            textShadow: '0 2px 10px rgba(0, 0, 0, 0.3)',
          }}
        >
          {slide.title}
        </motion.h1>

        <motion.p
          className="text-xl text-white/80 text-center"
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          transition={{ delay: 0.7 }}
        >
          {slide.subtitle}
        </motion.p>

        {/* Floating sparkles */}
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {[...Array(6)].map((_, i) => (
            <motion.div
              key={i}
              className="absolute"
              initial={{ opacity: 0 }}
              animate={{
                opacity: [0, 0.8, 0],
                y: [-10, -50],
                scale: [0.5, 1, 0.5],
              }}
              transition={{
                duration: 3,
                delay: 1 + i * 0.4,
                repeat: Infinity,
              }}
              style={{
                left: `${15 + i * 14}%`,
                top: `${25 + (i % 3) * 10}%`,
              }}
            >
              <SparklesIcon size="sm" animated />
            </motion.div>
          ))}
        </div>
      </div>

      {/* Bottom branding card */}
      <motion.div
        className="absolute bottom-16 left-1/2 -translate-x-1/2"
        initial={{ opacity: 0, y: 30 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 1.2 }}
      >
        <div className="flex flex-col items-center px-8 py-4 rounded-2xl bg-white/10 backdrop-blur-md border border-white/20">
          <div className="flex items-center gap-2 mb-1">
            <SeedlingIcon size="sm" animated />
            <span className="text-sm text-white/60">
              {t.storyTrackYourJourney || 'Track your journey with'}
            </span>
          </div>
          <motion.span
            className="text-2xl font-bold"
            style={{
              background: `linear-gradient(135deg, #fff 0%, #ffcb8e 100%)`,
              WebkitBackgroundClip: 'text',
              WebkitTextFillColor: 'transparent',
              backgroundClip: 'text',
            }}
          >
            ZenFlow
          </motion.span>
        </div>
      </motion.div>
    </div>
  );
}

export default OutroSlide;
