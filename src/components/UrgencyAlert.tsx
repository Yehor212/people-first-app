/**
 * UrgencyAlert - Premium Predictive Alerts
 *
 * Beautiful, premium-feeling alerts for:
 * - Habits at risk of being missed (2h before end of day)
 * - Streak about to break
 * - Comeback challenge progress reminders
 *
 * Design: Glassmorphism + gradient animations + micro-interactions
 */

import { useState, useEffect, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { Clock, Flame, AlertTriangle, Sparkles, ChevronRight, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { Habit } from '@/types';
import { cn, interpolate, getToday } from '@/lib/utils';
import { zenTap } from '@/lib/animationUtils';
import { isHabitCompletedOnDate } from '@/lib/habits';
import { SK } from '@/lib/storageKeys';
import { safeLocalStorageGet, safeLocalStorageSet } from '@/lib/safeJson';

interface UrgencyAlertProps {
  habits: Habit[];
  currentStreak: number;
  onHabitClick?: (habitId: string) => void;
  onDismiss?: (alertType: string) => void;
}

type AlertType = 'habits_pending' | 'streak_at_risk' | 'perfect_day_possible';

interface Alert {
  id: string;
  type: AlertType;
  priority: number;
  title: string;
  subtitle: string;
  icon: typeof Clock;
  gradient: string;
  glowColor: string;
  action?: () => void;
}

// Check if it's late in the day (after 8 PM)
function isLateInDay(): boolean {
  return new Date().getHours() >= 20;
}

// Check if it's very late (after 10 PM)
function isVeryLate(): boolean {
  return new Date().getHours() >= 22;
}

// Get hours until midnight
function getHoursUntilMidnight(): number {
  const now = new Date();
  const midnight = new Date(now);
  midnight.setHours(24, 0, 0, 0);
  return Math.round((midnight.getTime() - now.getTime()) / (1000 * 60 * 60));
}

// Animated gradient background
function AnimatedGradient({ colors, className }: { colors: string; className?: string }) {
  return (
    <motion.div
      className={cn("absolute inset-0 rounded-2xl opacity-80", className)}
      style={{ background: colors }}
      animate={{
        backgroundPosition: ['0% 50%', '100% 50%', '0% 50%'],
      }}
      transition={{
        duration: 5,
        repeat: Infinity,
        ease: 'linear',
      }}
    />
  );
}

// Sparkle particle effect
function SparkleParticle({ delay }: { delay: number }) {
  return (
    <motion.div
      className="absolute w-1 h-1 rounded-full bg-white"
      style={{
        left: `${Math.random() * 100}%`,
        top: `${Math.random() * 100}%`,
      }}
      initial={{ scale: 0, opacity: 0 }}
      animate={{
        scale: [0, 1, 0],
        opacity: [0, 1, 0],
      }}
      transition={{
        duration: 2,
        delay,
        repeat: Infinity,
        repeatDelay: Math.random() * 3,
      }}
    />
  );
}

// Single alert card
function AlertCard({
  alert,
  onDismiss,
  hoursLeft,
  pendingCount,
  t,
}: {
  alert: Alert;
  onDismiss: () => void;
  hoursLeft: number;
  pendingCount?: number;
  t: Record<string, string>;
}) {
  const Icon = alert.icon;

  return (
    <motion.div
      initial={{ opacity: 0, y: 20, scale: 0.95 }}
      animate={{ opacity: 1, y: 0, scale: 1 }}
      exit={{ opacity: 0, y: -20, scale: 0.95 }}
      whileHover={{ scale: 1.02 }}
      className="relative overflow-hidden rounded-2xl"
      style={{
        boxShadow: `0 0 40px ${alert.glowColor}, 0 10px 40px rgba(0,0,0,0.2)`,
      }}
    >
      {/* Animated gradient background */}
      <AnimatedGradient colors={alert.gradient} />

      {/* Glassmorphism overlay */}
      <div className="absolute inset-0 bg-white/10 backdrop-blur-sm rounded-2xl" />

      {/* Sparkle effects */}
      <div className="absolute inset-0 overflow-hidden pointer-events-none">
        {[0, 0.5, 1, 1.5, 2].map((delay, i) => (
          <SparkleParticle key={i} delay={delay} />
        ))}
      </div>

      {/* Content */}
      <div className="relative p-4 sm:p-5">
        {/* Close button */}
        <button
          onClick={(e) => {
            e.stopPropagation();
            onDismiss();
          }}
          className="absolute top-2 end-2 p-2.5 min-w-[44px] min-h-[44px] flex items-center justify-center rounded-full bg-white/10 hover:bg-white/20 transition-colors"
          aria-label={t.close || 'Dismiss'}
        >
          <X className="w-4 h-4 text-white/80" />
        </button>

        <div className="flex items-start gap-4">
          {/* Icon with glow */}
          <motion.div
            className="flex-shrink-0 p-3 rounded-xl bg-white/20 backdrop-blur-sm"
            animate={{
              boxShadow: [
                `0 0 20px ${alert.glowColor}`,
                `0 0 30px ${alert.glowColor}`,
                `0 0 20px ${alert.glowColor}`,
              ],
            }}
            transition={{ duration: 2, repeat: Infinity }}
          >
            <Icon className="w-6 h-6 text-white" />
          </motion.div>

          <div className="flex-1 min-w-0 pe-6">
            <h3 className="text-lg font-bold text-white mb-1 tracking-tight">
              {alert.title}
            </h3>
            <p className="text-sm text-white/80 leading-relaxed">
              {alert.subtitle}
            </p>

            {/* Timer / Counter */}
            {alert.type === 'habits_pending' && (
              <div className="mt-3 flex items-center gap-3">
                <motion.div
                  className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm"
                  animate={{ scale: [1, 1.05, 1] }}
                  transition={{ duration: 2, repeat: Infinity }}
                >
                  <Clock className="w-4 h-4 text-white" />
                  <span className="text-sm font-semibold text-white">
                    {interpolate(t.urgencyTimeLeft || '{hours}h left', { hours: hoursLeft })}
                  </span>
                </motion.div>

                {pendingCount && pendingCount > 0 && (
                  <div className="flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm">
                    <span className="text-sm font-semibold text-white">
                      {interpolate(t.urgencyPendingCount || '{count} pending', { count: pendingCount || 0 })}
                    </span>
                  </div>
                )}
              </div>
            )}

            {alert.type === 'streak_at_risk' && (
              <motion.div
                className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm w-fit"
                animate={{
                  backgroundColor: ['rgba(255,255,255,0.2)', 'rgba(255,255,255,0.3)', 'rgba(255,255,255,0.2)'],
                }}
                transition={{ duration: 1.5, repeat: Infinity }}
              >
                <Flame className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">
                  {t.urgencyProtectStreak || 'Protect your streak!'}
                </span>
              </motion.div>
            )}

            {alert.type === 'perfect_day_possible' && (
              <motion.div
                className="mt-3 flex items-center gap-2 px-3 py-1.5 rounded-full bg-white/20 backdrop-blur-sm w-fit"
                animate={{ scale: [1, 1.02, 1] }}
                transition={{ duration: 2, repeat: Infinity }}
              >
                <Sparkles className="w-4 h-4 text-white" />
                <span className="text-sm font-semibold text-white">
                  {t.urgencyPerfectDayAwaits || 'Perfect day awaits!'}
                </span>
              </motion.div>
            )}
          </div>
        </div>

        {/* Action button */}
        {alert.action && (
          <motion.button
            onClick={alert.action}
            className="mt-4 w-full py-3 rounded-xl bg-white/20 hover:bg-white/30 backdrop-blur-sm transition-colors flex items-center justify-center gap-2 group"
            whileHover={{ scale: 1.02 }}
            whileTap={zenTap.card}
          >
            <span className="text-sm font-semibold text-white">{t.urgencyCompleteNow || 'Complete now'}</span>
            <ChevronRight className="w-4 h-4 text-white group-hover:translate-x-1 transition-transform" />
          </motion.button>
        )}
      </div>
    </motion.div>
  );
}

export function UrgencyAlert({
  habits,
  currentStreak,
  onHabitClick,
  onDismiss,
}: UrgencyAlertProps) {
  const { t } = useLanguage();
  const [dismissedAlerts, setDismissedAlerts] = useState<Set<string>>(() => {
    const data = safeLocalStorageGet<{ date?: string; alerts?: string[] }>(SK.DISMISSED_URGENCY, {});
    // Clear dismissed alerts from previous day
    const today = new Date().toDateString();
    if (data.date !== today) {
      return new Set();
    }
    return new Set(data.alerts || []);
  });

  // Persist dismissed alerts
  useEffect(() => {
    const today = new Date().toDateString();
    safeLocalStorageSet(SK.DISMISSED_URGENCY, {
      date: today,
      alerts: Array.from(dismissedAlerts),
    });
  }, [dismissedAlerts]);

  const today = getToday();
  const hoursLeft = getHoursUntilMidnight();
  const isLate = isLateInDay();
  const isVeryLateNow = isVeryLate();

  // Calculate pending habits (entry-based model)
  const pendingHabits = useMemo(() => {
    return habits.filter(h => !h.isArchived && !isHabitCompletedOnDate(h, today));
  }, [habits, today]);

  // Generate alerts
  const alerts = useMemo<Alert[]>(() => {
    const result: Alert[] = [];

    // Habits pending alert (show after 8 PM if there are pending habits)
    if (isLate && pendingHabits.length > 0 && !dismissedAlerts.has('habits_pending')) {
      result.push({
        id: 'habits_pending',
        type: 'habits_pending',
        priority: isVeryLateNow ? 10 : 5,
        title: isVeryLateNow
          ? (t.urgencyLastChance || 'Last chance today!')
          : (t.urgencyHabitsPending || 'Habits waiting for you'),
        subtitle: isVeryLateNow
          ? interpolate(t.urgencyLastChanceDesc || "{count} habits left. Don't break your momentum!", { count: pendingHabits.length })
          : interpolate(t.urgencyHabitsPendingDesc || '{hours} hours left to complete {count} habits', { hours: hoursLeft, count: pendingHabits.length }),
        icon: isVeryLateNow ? AlertTriangle : Clock,
        gradient: isVeryLateNow
          ? 'linear-gradient(135deg, #ef4444 0%, #f97316 50%, #f59e0b 100%)'
          : 'linear-gradient(135deg, #6366f1 0%, #8b5cf6 50%, #a855f7 100%)',
        glowColor: isVeryLateNow ? 'rgba(239, 68, 68, 0.4)' : 'rgba(139, 92, 246, 0.4)',
        action: () => onHabitClick?.(pendingHabits[0]?.id),
      });
    }

    // Streak at risk (show if streak > 3 and habits pending after 10 PM)
    if (isVeryLateNow && currentStreak >= 3 && pendingHabits.length > 0 && !dismissedAlerts.has('streak_at_risk')) {
      result.push({
        id: 'streak_at_risk',
        type: 'streak_at_risk',
        priority: 15,
        title: interpolate(t.urgencyStreakAtRisk || '{streak}-day streak at risk!', { streak: currentStreak }),
        subtitle: t.urgencyStreakAtRiskDesc || "Complete at least one habit to keep your streak alive",
        icon: Flame,
        gradient: 'linear-gradient(135deg, #f97316 0%, #ef4444 50%, #dc2626 100%)',
        glowColor: 'rgba(249, 115, 22, 0.5)',
        action: () => onHabitClick?.(pendingHabits[0]?.id),
      });
    }

    // Perfect day possible (show if only 1 habit left and it's not too late)
    if (pendingHabits.length === 1 && !isVeryLateNow && habits.length >= 3 && !dismissedAlerts.has('perfect_day_possible')) {
      result.push({
        id: 'perfect_day_possible',
        type: 'perfect_day_possible',
        priority: 3,
        title: t.urgencyPerfectDay || 'Perfect day within reach!',
        subtitle: interpolate(t.urgencyPerfectDayDesc || 'Just 1 habit left: {habit}', { habit: pendingHabits[0]?.name || '' }),
        icon: Sparkles,
        gradient: 'linear-gradient(135deg, #10b981 0%, #14b8a6 50%, #06b6d4 100%)',
        glowColor: 'rgba(16, 185, 129, 0.4)',
        action: () => onHabitClick?.(pendingHabits[0]?.id),
      });
    }

    // Sort by priority (highest first)
    return result.sort((a, b) => b.priority - a.priority);
  }, [habits, pendingHabits, currentStreak, isLate, isVeryLateNow, hoursLeft, dismissedAlerts, t, onHabitClick]);

  const handleDismiss = (alertId: string) => {
    setDismissedAlerts(prev => new Set([...prev, alertId]));
    onDismiss?.(alertId);
  };

  // Don't show if no alerts
  if (alerts.length === 0) return null;

  // Show only the highest priority alert
  const topAlert = alerts[0];

  return (
    <div className="space-y-3">
      <AnimatePresence mode="wait">
        <AlertCard
          key={topAlert.id}
          alert={topAlert}
          onDismiss={() => handleDismiss(topAlert.id)}
          hoursLeft={hoursLeft}
          pendingCount={pendingHabits.length}
          t={t as unknown as Record<string, string>}
        />
      </AnimatePresence>
    </div>
  );
}
