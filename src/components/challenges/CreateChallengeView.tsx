import { useState } from 'react';
import { motion } from 'framer-motion';
import { zenTap } from '@/lib/animationUtils';
import { Users } from 'lucide-react';
import { cn } from '@/lib/utils';
import { hapticSuccess, hapticTap } from '@/lib/haptics';
import { useThrottledCallback } from '@/hooks/useThrottledCallback';
import { Habit } from '@/types';
import type { Translations } from '@/i18n/types';
import { Challenge, CHALLENGE_DURATIONS, createChallenge } from '@/lib/friendChallenge';

export function CreateChallengeView({
  habit,
  username,
  onCreated,
  t,
}: {
  habit: Habit;
  username?: string;
  onCreated: (challenge: Challenge) => void;
  t: Translations;
}) {
  const [duration, setDuration] = useState(7);
  const [isCreating, setIsCreating] = useState(false);

  const handleCreate = async () => {
    void hapticTap();
    setIsCreating(true);

    const challenge = createChallenge(habit, duration, username);

    // Small delay for effect
    await new Promise(resolve => setTimeout(resolve, 300));

    void hapticSuccess();
    onCreated(challenge);
  };

  const throttledCreate = useThrottledCallback(handleCreate, 1000);

  return (
    <div className="space-y-6 pb-8">
      {/* Habit preview - Premium */}
      <motion.div
        className="flex items-center gap-4 p-4 rounded-2xl overflow-hidden relative"
        initial={{ opacity: 0, y: 20 }}
        animate={{ opacity: 1, y: 0 }}
        style={{
          background: 'linear-gradient(135deg, rgba(139, 92, 246, 0.15) 0%, rgba(168, 85, 247, 0.1) 100%)',
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.1), inset 0 1px 0 rgba(255,255,255,0.05)'
        }}
      >
        <div
          className="text-5xl p-3 rounded-xl"
          style={{
            background: 'linear-gradient(135deg, rgba(255,255,255,0.1) 0%, rgba(255,255,255,0.05) 100%)',
          }}
        >
          {habit.icon}
        </div>
        <div>
          <p className="font-semibold text-slate-800 dark:text-white text-lg">{habit.name}</p>
          <p className="text-sm text-slate-500 dark:text-white/60">
            {t.challengeYourFriends || 'Challenge your friends to this habit!'}
          </p>
        </div>
      </motion.div>

      {/* Duration selector - Premium */}
      <div>
        <label className="text-sm font-medium text-slate-600 dark:text-white/80 mb-3 block">
          {t.challengeDuration || 'Challenge Duration'}
        </label>
        <div className="grid grid-cols-2 gap-3">
          {CHALLENGE_DURATIONS.map((opt, index) => (
            <motion.button
              key={opt.value}
              onClick={() => {
                void hapticTap();
                setDuration(opt.value);
              }}
              className={cn(
                'p-4 rounded-xl transition-all',
                duration === opt.value
                  ? 'bg-gradient-to-br from-violet-500/30 to-purple-600/20 border border-violet-500/40'
                  : 'bg-slate-100/60 dark:bg-white/5 border border-slate-200/60 dark:border-white/10 hover:bg-slate-200/60 dark:hover:bg-white/10'
              )}
              style={duration === opt.value ? {
                boxShadow: '0 0 16px rgba(139, 92, 246, 0.4)'
              } : undefined}
              initial={{ opacity: 0, y: 20 }}
              animate={{ opacity: 1, y: 0 }}
              transition={{ delay: index * 0.1 }}
              whileHover={{ scale: 1.02 }}
              whileTap={zenTap.card}
            >
              <div className={cn(
                "text-2xl font-bold",
                duration === opt.value ? "text-violet-700 dark:text-violet-300" : "text-slate-700 dark:text-white"
              )}>{opt.value}</div>
              <div className={cn(
                "text-xs",
                duration === opt.value ? "text-violet-700/70 dark:text-violet-300/70" : "text-slate-500 dark:text-white/50"
              )}>{t.days || 'days'}</div>
            </motion.button>
          ))}
        </div>
      </div>

      {/* Create button - Premium */}
      <motion.button
        onClick={throttledCreate}
        disabled={isCreating}
        className={cn(
          "relative w-full h-14 rounded-xl font-semibold text-lg text-white overflow-hidden",
          isCreating
            ? "bg-white/10 cursor-not-allowed"
            : "bg-gradient-to-r from-violet-500 to-purple-600"
        )}
        style={!isCreating ? {
          boxShadow: '0 0 20px rgba(139, 92, 246, 0.4)'
        } : undefined}
        whileHover={!isCreating ? { scale: 1.02 } : {}}
        whileTap={!isCreating ? zenTap.card : {}}
      >
        {/* Pulse ring */}
        {!isCreating && (
          <motion.div
            className="absolute inset-0 rounded-xl border-2 border-violet-400/30"
            animate={{ scale: [1, 1.05], opacity: [0.5, 0] }}
            transition={{ duration: 1.5, repeat: Infinity }}
          />
        )}
        <span className="relative z-10 flex items-center justify-center gap-2">
          {isCreating ? (
            <span className="animate-pulse">{t.creating || 'Creating...'}</span>
          ) : (
            <>
              <Users className="w-5 h-5" />
              {t.createChallenge || 'Create Challenge'}
            </>
          )}
        </span>
      </motion.button>

      <p className="text-xs text-center text-slate-400 dark:text-white/40">
        {t.challengeShareTip || "You'll be able to share this challenge with friends after creating it."}
      </p>
    </div>
  );
}
