import { Wind } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { cn } from '@/lib/utils';

interface CompactCardProps {
  onOpen: () => void;
  t: Record<string, string>;
}

export function CompactCard({ onOpen, t }: CompactCardProps) {
  return (
    <motion.button
      onClick={onOpen}
      className={cn(
        "w-full rounded-2xl p-4 text-start transition-all relative overflow-hidden",
        "bg-gradient-to-br from-cyan-500/10 via-teal-500/5 to-transparent",
        "border border-cyan-500/20",
        "hover:border-cyan-500/40"
      )}
      style={{
        boxShadow: '0 0 20px rgba(6, 182, 212, 0.15), 0 4px 12px rgba(0, 0, 0, 0.1)',
      }}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={zenTap.card}
    >
      {/* Animated background glow */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        style={{
          background: 'radial-gradient(circle at 30% 50%, rgba(6, 182, 212, 0.15) 0%, transparent 50%)',
        }}
        animate={{ opacity: [0.5, 0.8, 0.5] }}
        transition={{ duration: 3, repeat: Infinity, ease: 'easeInOut' }}
      />

      <div className="flex items-center gap-3 relative z-10">
        <motion.div
          className="w-12 h-12 rounded-xl flex items-center justify-center"
          style={{
            background: 'linear-gradient(135deg, rgba(6, 182, 212, 0.3) 0%, rgba(20, 184, 166, 0.2) 100%)',
            boxShadow: '0 0 16px rgba(6, 182, 212, 0.4)',
          }}
          animate={{ scale: [1, 1.05, 1] }}
          transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
        >
          <Wind className="w-6 h-6 text-cyan-400" />
        </motion.div>

        <div className="flex-1">
          <h3 className="font-semibold text-foreground">
            {t.breathingTitle || 'Breathing'}
          </h3>
          <p className="text-sm text-muted-foreground">
            {t.breathingSubtitle || 'Calm your mind'}
          </p>
        </div>

        <motion.div
          className="text-2xl"
          animate={{ y: [0, -3, 0] }}
          transition={{ duration: 2, repeat: Infinity, ease: 'easeInOut' }}
        >
          🧘
        </motion.div>
      </div>
    </motion.button>
  );
}
