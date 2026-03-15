import { motion } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { cn } from '@/lib/utils';

interface CompletionViewProps {
  onReset: () => void;
  t: Record<string, string>;
}

export function CompletionView({ onReset, t }: CompletionViewProps) {
  return (
    <motion.div
      className="text-center py-8 relative"
      initial={{ opacity: 0, scale: 0.9 }}
      animate={{ opacity: 1, scale: 1 }}
    >
      {/* Celebration particles */}
      <div className="absolute inset-0 pointer-events-none overflow-hidden">
        {[...Array(20)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute w-2 h-2 rounded-full"
            style={{
              left: '50%',
              top: '50%',
              background: ['#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b'][i % 4],
              boxShadow: `0 0 6px ${['#06b6d4', '#8b5cf6', '#14b8a6', '#f59e0b'][i % 4]}`,
            }}
            initial={{ x: 0, y: 0, scale: 0 }}
            animate={{
              x: Math.cos((i / 20) * Math.PI * 2) * (60 + Math.random() * 40),
              y: Math.sin((i / 20) * Math.PI * 2) * (60 + Math.random() * 40),
              scale: [0, 1, 0],
              opacity: [0, 1, 0],
            }}
            transition={{
              duration: 1.5,
              delay: i * 0.05,
              ease: 'easeOut',
            }}
          />
        ))}
      </div>

      <motion.div
        className="w-24 h-24 mx-auto mb-6 rounded-full flex items-center justify-center bg-[linear-gradient(135deg,rgba(16,185,129,0.3)_0%,rgba(6,182,212,0.2)_100%)] shadow-[0_0_40px_rgba(16,185,129,0.4)]"
        initial={{ scale: 0, rotate: -180 }}
        animate={{ scale: 1, rotate: 0 }}
        transition={{ type: 'spring', stiffness: 200, damping: 15 }}
      >
        <motion.span
          className="text-5xl"
          animate={{ scale: [1, 1.1, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          ✨
        </motion.span>
      </motion.div>

      <motion.h3
        className="text-2xl font-bold mb-2 bg-gradient-to-r from-cyan-400 to-teal-400 bg-clip-text text-transparent"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.3 }}
      >
        {t.breathingComplete || 'Well done!'}
      </motion.h3>

      <motion.p
        className="text-muted-foreground mb-8"
        initial={{ opacity: 0 }}
        animate={{ opacity: 1 }}
        transition={{ delay: 0.5 }}
      >
        {t.breathingCompleteMsg || 'You completed the breathing exercise'}
      </motion.p>

      <motion.button
        onClick={onReset}
        className={cn(
          "w-full py-4 rounded-xl font-semibold",
          "bg-gradient-to-r from-cyan-500 to-teal-500 text-white",
          "hover:from-cyan-400 hover:to-teal-400 transition-all",
          "shadow-[0_0_20px_rgba(6,182,212,0.4)]"
        )}
        whileHover={{ scale: 1.02 }}
        whileTap={zenTap.card}
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        transition={{ delay: 0.7 }}
      >
        {t.breathingAgain || 'Do again'}
      </motion.button>
    </motion.div>
  );
}
