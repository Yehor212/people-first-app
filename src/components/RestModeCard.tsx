/**
 * RestModeCard - Beautiful rest mode UI
 * Shows when user activates "Rest Day" to preserve streak without activity
 */

import { motion } from 'framer-motion';
import { Moon, Sparkles } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface RestModeCardProps {
  streak: number;
  onCancel: () => void;
}

export function RestModeCard({ streak, onCancel }: RestModeCardProps) {
  const { t } = useLanguage();

  return (
    <motion.div
      className="relative overflow-hidden rounded-3xl bg-gradient-to-br from-indigo-500/20 via-purple-500/15 to-violet-500/20 p-8 text-center border border-indigo-500/30"
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={{ type: 'spring', stiffness: 200, damping: 20 }}
    >
      {/* Animated background stars */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[...Array(8)].map((_, i) => (
          <motion.div
            key={i}
            className="absolute text-lg opacity-30"
            initial={{
              x: `${Math.random() * 100}%`,
              y: `${Math.random() * 100}%`,
              scale: 0.5
            }}
            animate={{
              scale: [0.5, 1, 0.5],
              opacity: [0.2, 0.5, 0.2],
            }}
            transition={{
              duration: 3 + Math.random() * 2,
              delay: i * 0.3,
              repeat: Infinity,
            }}
          >
            ✨
          </motion.div>
        ))}
      </div>

      {/* Moon icon */}
      <motion.div
        className="relative mb-6"
        animate={{ y: [0, -5, 0] }}
        transition={{ duration: 4, repeat: Infinity, ease: 'easeInOut' }}
      >
        <div className="inline-flex items-center justify-center w-20 h-20 rounded-full bg-indigo-500/20 border border-indigo-400/30">
          <Moon className="w-10 h-10 text-indigo-400" />
        </div>
        <motion.div
          className="absolute -right-1 -top-1"
          animate={{ scale: [1, 1.2, 1] }}
          transition={{ duration: 2, repeat: Infinity }}
        >
          <Sparkles className="w-6 h-6 text-yellow-400" />
        </motion.div>
      </motion.div>

      {/* Title */}
      <h2 className="text-2xl font-bold text-foreground mb-2">
        {t.restDayTitle || 'День отдыха'}
      </h2>

      {/* Message */}
      <p className="text-muted-foreground mb-6">
        {t.restDayMessage || 'Отдыхай, твой стрик в безопасности'}
      </p>

      {/* Streak preserved badge */}
      <motion.div
        className="inline-flex items-center gap-2 px-5 py-2.5 bg-orange-500/20 rounded-full mb-6 border border-orange-500/30"
        animate={{ scale: [1, 1.02, 1] }}
        transition={{ duration: 2, repeat: Infinity }}
      >
        <span className="text-xl">🔥</span>
        <span className="font-bold text-orange-500 text-lg">{streak}</span>
        <span className="text-sm text-orange-400">{t.daysSaved || 'дней сохранено'}</span>
      </motion.div>

      {/* Supportive message */}
      <p className="text-sm text-muted-foreground mb-6">
        {t.restDaySupportive || 'Завтра продолжим вместе 💚'}
      </p>

      {/* Cancel button */}
      <button
        onClick={onCancel}
        className="w-full py-3 text-muted-foreground hover:text-foreground hover:bg-white/5 rounded-xl transition-colors"
      >
        {t.restDayCancel || 'Всё-таки хочу записать'}
      </button>
    </motion.div>
  );
}
