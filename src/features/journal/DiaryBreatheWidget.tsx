/**
 * DiaryBreatheWidget — Inline 70×70px breathing circle for the diary editor.
 *
 * Spec: Emerald border, "FLOW" text, scale 1.0→1.6 infinite,
 * box-shadow pulse. Never stops animating while visible.
 */

import { motion } from 'framer-motion';

export function DiaryBreatheWidget() {
  return (
    <motion.div
      className="w-[70px] h-[70px] mx-auto my-6 rounded-full border-2 border-emerald-500/60 flex items-center justify-center"
      animate={{
        scale: [1, 1.6, 1.6, 1],
        boxShadow: [
          '0 0 20px rgba(16, 185, 129, 0.3)',
          '0 0 40px rgba(16, 185, 129, 0.6)',
          '0 0 40px rgba(16, 185, 129, 0.6)',
          '0 0 20px rgba(16, 185, 129, 0.3)',
        ],
      }}
      transition={{
        duration: 8,
        repeat: Infinity,
        times: [0, 0.375, 0.625, 1],
        ease: 'easeInOut',
      }}
    >
      <span className="text-emerald-400 text-xs font-bold tracking-widest select-none">
        FLOW
      </span>
    </motion.div>
  );
}
