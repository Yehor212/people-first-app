import { motion } from 'framer-motion';
import { ChevronRight } from 'lucide-react';
import { cn } from '@/lib/utils';
import { Challenge, getChallengeProgress, getDaysRemaining } from '@/lib/friendChallenge';

export function ChallengeCard({
  challenge,
  onClick,
  t,
}: {
  challenge: Challenge;
  onClick: () => void;
  t: Record<string, string>;
}) {
  const progress = getChallengeProgress(challenge);
  const daysLeft = getDaysRemaining(challenge);

  const statusConfig = {
    active: {
      bg: 'bg-gradient-to-r from-emerald-500/80 to-teal-500/80',
      glow: 'rgba(16, 185, 129, 0.4)',
      progressBg: 'bg-gradient-to-r from-emerald-500 to-teal-500',
    },
    completed: {
      bg: 'bg-gradient-to-r from-amber-500/80 to-orange-500/80',
      glow: 'rgba(245, 158, 11, 0.4)',
      progressBg: 'bg-gradient-to-r from-amber-500 to-orange-500',
    },
    expired: {
      bg: 'bg-muted-foreground/50',
      glow: 'transparent',
      progressBg: 'bg-muted-foreground/50',
    },
  }[challenge.status];

  return (
    <motion.button
      onClick={onClick}
      className={cn(
        "relative w-full p-4 rounded-2xl text-start overflow-hidden",
        "bg-slate-100/60 dark:bg-white/5 backdrop-blur-sm border border-slate-200/60 dark:border-white/10",
        "hover:bg-slate-200/60 dark:hover:bg-white/10 transition-all"
      )}
      whileHover={{ scale: 1.01, y: -2 }}
      whileTap={{ scale: 0.99 }}
    >
      {/* Gradient accent on left */}
      <div
        className="absolute top-0 start-0 w-1 h-full bg-gradient-to-b from-violet-500 to-purple-600"
        style={{ boxShadow: '0 0 8px rgba(139, 92, 246, 0.4)' }}
      />

      <div className="flex items-start justify-between gap-3 ps-2">
        <div className="flex items-center gap-3">
          <div
            className="text-3xl p-2 rounded-xl"
            style={{
              background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
            }}
          >
            {challenge.habitIcon}
          </div>
          <div>
            <p className="font-medium text-slate-800 dark:text-white">{challenge.habitName}</p>
            <p className="text-xs text-slate-500 dark:text-white/60">
              {challenge.isCreator
                ? t.youCreated || 'You created this'
                : `${t.createdBy || 'Created by'} ${challenge.creatorName || t.friend || 'a friend'}`}
            </p>
          </div>
        </div>
        <ChevronRight className="w-5 h-5 text-slate-400 dark:text-white/40 flex-shrink-0" />
      </div>

      {/* Progress bar - Premium */}
      <div className="mt-3 ps-2">
        <div className="flex items-center justify-between text-xs mb-1.5">
          <span className="text-slate-500 dark:text-white/60">
            {challenge.myProgress}/{challenge.duration} {t.days || 'days'}
          </span>
          <span
            className={cn('px-2.5 py-1 rounded-full text-white text-xs font-medium', statusConfig.bg)}
            style={{ boxShadow: `0 0 12px ${statusConfig.glow}` }}
          >
            {challenge.status === 'active'
              ? `${daysLeft} ${t.daysLeft || 'days left'}`
              : challenge.status === 'completed'
                ? t.completed || 'Completed!'
                : t.expired || 'Expired'}
          </span>
        </div>
        <div className="h-2.5 bg-slate-200/60 dark:bg-white/10 rounded-full overflow-hidden">
          <motion.div
            className={cn('h-full rounded-full', statusConfig.progressBg)}
            initial={{ scaleX: 0 }}
            animate={{ scaleX: progress / 100 }}
            transition={{ duration: 0.5, ease: 'easeOut' }}
            style={{ width: '100%', transformOrigin: 'left center', boxShadow: `0 0 8px ${statusConfig.glow}` }}
          />
        </div>
      </div>
    </motion.button>
  );
}
