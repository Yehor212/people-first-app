import { useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';

interface FloatingParticle {
  id: number;
  x: number;
  emoji: string;
  delay: number;
  duration: number;
}

/** Cosmic background nebula effects for primary CTA mode */
export function CosmicBackground() {
  return (
    <div className="absolute inset-0 pointer-events-none">
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 70% 30%, rgba(236, 72, 153, 0.12) 0%, transparent 50%)',
        }}
        animate={{ opacity: [0.3, 0.5, 0.3] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      />
      {/* Secondary nebula */}
      <motion.div
        className="absolute inset-0"
        style={{
          background: 'radial-gradient(circle at 20% 80%, rgba(244, 114, 182, 0.08) 0%, transparent 40%)',
        }}
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 5, repeat: Infinity, ease: 'easeInOut', delay: 1 }}
      />
    </div>
  );
}

/** Floating emoji particles shown when journal is expanded in CTA mode */
export function FloatingParticles({ isExpanded }: { isExpanded: boolean }) {
  const floatingParticles = useMemo<FloatingParticle[]>(() => {
    const emojis = ['✨', '💖', '🌟', '💫', '✨', '💗'];
    return Array.from({ length: 6 }, (_, i) => ({
      id: i,
      x: 12 + i * 14,
      emoji: emojis[i % emojis.length],
      delay: i * 0.4,
      duration: 3 + Math.random() * 1.5,
    }));
  }, []);

  return (
    <AnimatePresence>
      {isExpanded && (
        <div className="absolute inset-0 pointer-events-none overflow-hidden">
          {floatingParticles.map((particle) => (
            <motion.div
              key={particle.id}
              className="absolute text-pink-400/50"
              style={{
                left: `${particle.x}%`,
                bottom: '15%',
                fontSize: 14,
              }}
              initial={{ y: 0, opacity: 0, scale: 0.5 }}
              animate={{
                y: [-20, -70, -100],
                x: [0, particle.id % 2 === 0 ? 8 : -8, 0],
                opacity: [0, 0.7, 0],
                scale: [0.5, 1, 0.7],
                rotate: [0, particle.id % 2 === 0 ? 15 : -15, 0],
              }}
              exit={{ opacity: 0 }}
              transition={{
                duration: particle.duration,
                repeat: Infinity,
                delay: particle.delay,
                ease: 'easeOut',
              }}
            >
              {particle.emoji}
            </motion.div>
          ))}
        </div>
      )}
    </AnimatePresence>
  );
}
