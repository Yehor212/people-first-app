import { useState, useEffect, useMemo, useCallback } from 'react';
import { MoodEntry, Habit, FocusSession, GratitudeEntry } from '@/types';
import { getToday, cn } from '@/lib/utils';
import { useLanguage } from '@/contexts/LanguageContext';
import { Zap, Flame, Star, Sparkles, Heart, Target, Brain, Trophy } from 'lucide-react';

interface DayClockProps {
  moods: MoodEntry[];
  habits: Habit[];
  focusSessions: FocusSession[];
  gratitudeEntries: GratitudeEntry[];
  onTimeBlockClick?: (section: 'mood' | 'habits' | 'focus' | 'gratitude') => void;
}

// Mascot expressions based on energy level
const MASCOT_STATES = {
  sleeping: '😴',
  waking: '🥱',
  calm: '😊',
  happy: '😄',
  excited: '🤩',
  onFire: '🔥',
  champion: '🏆',
};

// Activity config with rewards
const ACTIVITIES = {
  mood: { emoji: '💜', points: 10, color: 'from-purple-500 to-pink-500' },
  habit: { emoji: '🎯', points: 15, color: 'from-green-500 to-emerald-500' },
  focus: { emoji: '🧠', points: 20, color: 'from-blue-500 to-cyan-500' },
  gratitude: { emoji: '💖', points: 10, color: 'from-pink-500 to-rose-500' },
};

// Particle component for celebrations
function EnergyParticle({ delay, angle }: { delay: number; angle: number }) {
  return (
    <div
      className="absolute w-2 h-2 rounded-full bg-gradient-to-r from-yellow-400 to-orange-500 animate-energy-particle"
      style={{
        animationDelay: `${delay}ms`,
        transform: `rotate(${angle}deg) translateY(-60px)`,
        opacity: 0,
      }}
    />
  );
}

// Glowing ring segment
function RingSegment({
  startAngle,
  endAngle,
  isActive,
  isCompleted,
  color,
  pulseDelay = 0
}: {
  startAngle: number;
  endAngle: number;
  isActive: boolean;
  isCompleted: boolean;
  color: string;
  pulseDelay?: number;
}) {
  const radius = 85;
  const strokeWidth = 12;
  const normalizedRadius = radius - strokeWidth / 2;
  const circumference = normalizedRadius * 2 * Math.PI;

  // Convert angles to arc
  const arcLength = ((endAngle - startAngle) / 360) * circumference;
  const offset = ((90 - startAngle) / 360) * circumference;

  return (
    <circle
      className={cn(
        "transition-all duration-500",
        isActive && "animate-pulse-glow",
        isCompleted && "drop-shadow-[0_0_10px_currentColor]"
      )}
      style={{
        animationDelay: `${pulseDelay}ms`,
      }}
      stroke={isCompleted ? color : isActive ? `${color}88` : '#334155'}
      fill="transparent"
      strokeWidth={strokeWidth}
      strokeLinecap="round"
      strokeDasharray={`${arcLength} ${circumference - arcLength}`}
      strokeDashoffset={-offset}
      r={normalizedRadius}
      cx="100"
      cy="100"
    />
  );
}

export function DayClock({
  moods,
  habits,
  focusSessions,
  gratitudeEntries,
  onTimeBlockClick
}: DayClockProps) {
  const { t } = useLanguage();
  const today = getToday();
  const [currentTime, setCurrentTime] = useState(new Date());
  const [showCelebration, setShowCelebration] = useState(false);
  const [lastEnergy, setLastEnergy] = useState(0);

  // Update time every minute
  useEffect(() => {
    const interval = setInterval(() => setCurrentTime(new Date()), 60000);
    return () => clearInterval(interval);
  }, []);

  const currentHour = currentTime.getHours();
  const currentMinute = currentTime.getMinutes();

  // Calculate activities completed today
  const todayActivities = useMemo(() => {
    const moodCount = moods.filter(m => m.date === today).length;
    const habitCount = habits.filter(h => h.completedDates?.includes(today)).length;
    const totalHabits = habits.length;
    const focusMinutes = focusSessions.filter(s => s.date === today).reduce((acc, s) => acc + s.duration, 0);
    const gratitudeCount = gratitudeEntries.filter(g => g.date === today).length;

    return {
      mood: moodCount > 0,
      habits: { completed: habitCount, total: totalHabits, done: totalHabits > 0 && habitCount >= totalHabits },
      focus: { minutes: focusMinutes, done: focusMinutes >= 25 },
      gratitude: gratitudeCount > 0,
    };
  }, [moods, habits, focusSessions, gratitudeEntries, today]);

  // Calculate energy level (0-100)
  const energyLevel = useMemo(() => {
    let energy = 0;
    if (todayActivities.mood) energy += 25;
    if (todayActivities.habits.total > 0) {
      energy += (todayActivities.habits.completed / todayActivities.habits.total) * 25;
    } else {
      energy += 25; // No habits = full points
    }
    if (todayActivities.focus.minutes >= 25) energy += 25;
    else if (todayActivities.focus.minutes > 0) energy += (todayActivities.focus.minutes / 25) * 25;
    if (todayActivities.gratitude) energy += 25;
    return Math.min(100, Math.round(energy));
  }, [todayActivities]);

  // Trigger celebration when energy increases
  useEffect(() => {
    if (energyLevel > lastEnergy && lastEnergy > 0) {
      setShowCelebration(true);
      setTimeout(() => setShowCelebration(false), 1500);
    }
    setLastEnergy(energyLevel);
  }, [energyLevel, lastEnergy]);

  // Get mascot state based on energy
  const mascotState = useMemo(() => {
    if (energyLevel >= 100) return MASCOT_STATES.champion;
    if (energyLevel >= 80) return MASCOT_STATES.onFire;
    if (energyLevel >= 60) return MASCOT_STATES.excited;
    if (energyLevel >= 40) return MASCOT_STATES.happy;
    if (energyLevel >= 20) return MASCOT_STATES.calm;
    if (energyLevel > 0) return MASCOT_STATES.waking;
    return MASCOT_STATES.sleeping;
  }, [energyLevel]);

  // Current time period
  const currentPeriod = useMemo(() => {
    if (currentHour >= 6 && currentHour < 12) return 'morning';
    if (currentHour >= 12 && currentHour < 18) return 'afternoon';
    return 'evening';
  }, [currentHour]);

  // Time progress through day (6am-11pm)
  const dayProgress = useMemo(() => {
    const totalMinutes = (currentHour - 6) * 60 + currentMinute;
    const maxMinutes = 17 * 60; // 6am to 11pm
    return Math.max(0, Math.min(100, (totalMinutes / maxMinutes) * 100));
  }, [currentHour, currentMinute]);

  // Format time
  const formatTime = (date: Date) => {
    return date.toLocaleTimeString('ru-RU', {
      hour: '2-digit',
      minute: '2-digit',
      hour12: false,
    });
  };

  // Ring colors
  const getEnergyColor = () => {
    if (energyLevel >= 80) return '#22c55e'; // green
    if (energyLevel >= 60) return '#eab308'; // yellow
    if (energyLevel >= 40) return '#f97316'; // orange
    return '#ef4444'; // red
  };

  return (
    <div className="bg-card rounded-3xl p-5 zen-shadow-card animate-fade-in overflow-hidden relative">
      {/* Celebration particles */}
      {showCelebration && (
        <div className="absolute inset-0 pointer-events-none z-20 flex items-center justify-center">
          {[...Array(12)].map((_, i) => (
            <EnergyParticle key={i} delay={i * 50} angle={i * 30} />
          ))}
        </div>
      )}

      {/* Background glow effect */}
      <div
        className="absolute inset-0 opacity-20 rounded-3xl transition-all duration-1000"
        style={{
          background: `radial-gradient(circle at center, ${getEnergyColor()}40 0%, transparent 70%)`
        }}
      />

      <div className="relative flex items-center gap-4">
        {/* Circular Energy Meter */}
        <div className="relative w-[200px] h-[200px] flex-shrink-0">
          <svg viewBox="0 0 200 200" className="w-full h-full -rotate-90">
            {/* Background ring */}
            <circle
              stroke="#1e293b"
              fill="transparent"
              strokeWidth="12"
              r="79"
              cx="100"
              cy="100"
            />

            {/* Time period segments */}
            <RingSegment
              startAngle={0}
              endAngle={120}
              isActive={currentPeriod === 'morning'}
              isCompleted={currentHour >= 12}
              color="#f59e0b"
              pulseDelay={0}
            />
            <RingSegment
              startAngle={120}
              endAngle={240}
              isActive={currentPeriod === 'afternoon'}
              isCompleted={currentHour >= 18}
              color="#3b82f6"
              pulseDelay={200}
            />
            <RingSegment
              startAngle={240}
              endAngle={360}
              isActive={currentPeriod === 'evening'}
              isCompleted={currentHour >= 23}
              color="#8b5cf6"
              pulseDelay={400}
            />

            {/* Energy progress ring (inner) */}
            <circle
              className="transition-all duration-700 ease-out"
              stroke={getEnergyColor()}
              fill="transparent"
              strokeWidth="8"
              strokeLinecap="round"
              strokeDasharray={`${(energyLevel / 100) * 2 * Math.PI * 60} ${2 * Math.PI * 60}`}
              r="60"
              cx="100"
              cy="100"
              style={{
                filter: `drop-shadow(0 0 8px ${getEnergyColor()})`,
              }}
            />

            {/* Current time indicator */}
            <circle
              className="animate-pulse"
              fill={currentPeriod === 'morning' ? '#f59e0b' : currentPeriod === 'afternoon' ? '#3b82f6' : '#8b5cf6'}
              r="6"
              cx={100 + 85 * Math.cos((dayProgress / 100 * 360 - 90) * Math.PI / 180)}
              cy={100 + 85 * Math.sin((dayProgress / 100 * 360 - 90) * Math.PI / 180)}
              style={{
                filter: 'drop-shadow(0 0 6px currentColor)',
              }}
            />
          </svg>

          {/* Center content */}
          <div className="absolute inset-0 flex flex-col items-center justify-center">
            {/* Mascot */}
            <div className={cn(
              "text-5xl transition-all duration-300",
              energyLevel >= 80 && "animate-bounce-gentle",
              showCelebration && "scale-125"
            )}>
              {mascotState}
            </div>

            {/* Energy percentage */}
            <div className="flex items-center gap-1 mt-1">
              <Zap className={cn(
                "w-4 h-4 transition-colors",
                energyLevel >= 60 ? "text-yellow-400" : "text-muted-foreground"
              )} />
              <span className={cn(
                "text-lg font-bold",
                energyLevel >= 80 ? "text-green-400" :
                energyLevel >= 60 ? "text-yellow-400" :
                energyLevel >= 40 ? "text-orange-400" : "text-red-400"
              )}>
                {energyLevel}%
              </span>
            </div>

            {/* Current time */}
            <span className="text-xs text-muted-foreground mt-1">
              {formatTime(currentTime)}
            </span>
          </div>
        </div>

        {/* Activity checklist */}
        <div className="flex-1 space-y-2.5">
          {/* Mood */}
          <ActivityRow
            emoji="💜"
            label={t.moodToday || 'Mood'}
            completed={todayActivities.mood}
            onClick={() => onTimeBlockClick?.('mood')}
          />

          {/* Habits */}
          <ActivityRow
            emoji="🎯"
            label={t.habits || 'Habits'}
            completed={todayActivities.habits.done}
            progress={todayActivities.habits.total > 0 ? `${todayActivities.habits.completed}/${todayActivities.habits.total}` : undefined}
            onClick={() => onTimeBlockClick?.('habits')}
          />

          {/* Focus */}
          <ActivityRow
            emoji="🧠"
            label={t.focusSession || 'Focus'}
            completed={todayActivities.focus.done}
            progress={todayActivities.focus.minutes > 0 ? `${todayActivities.focus.minutes} ${t.min}` : undefined}
            onClick={() => onTimeBlockClick?.('focus')}
          />

          {/* Gratitude */}
          <ActivityRow
            emoji="💖"
            label={t.gratitude || 'Gratitude'}
            completed={todayActivities.gratitude}
            onClick={() => onTimeBlockClick?.('gratitude')}
          />

          {/* Streak indicator */}
          {energyLevel >= 100 && (
            <div className="flex items-center gap-2 pt-2 mt-2 border-t border-border/50">
              <div className="flex items-center gap-1 text-orange-400">
                <Flame className="w-5 h-5 animate-flame-flicker" />
                <span className="text-sm font-bold">{t.perfectDay || 'Perfect Day!'}</span>
              </div>
              <div className="flex -space-x-1">
                {['✨', '🌟', '⭐'].map((star, i) => (
                  <span key={i} className="text-lg animate-bounce-gentle" style={{ animationDelay: `${i * 150}ms` }}>
                    {star}
                  </span>
                ))}
              </div>
            </div>
          )}
        </div>
      </div>

      {/* Bottom motivational message */}
      <div className={cn(
        "mt-4 pt-3 border-t border-border/30 text-center transition-all duration-500",
        energyLevel >= 80 && "bg-gradient-to-r from-green-500/10 via-emerald-500/10 to-green-500/10 -mx-5 px-5 -mb-5 pb-4 rounded-b-3xl"
      )}>
        <p className="text-sm text-muted-foreground">
          {energyLevel === 0 && (t.startYourDay || "Start your day! 🌅")}
          {energyLevel > 0 && energyLevel < 40 && (t.keepGoing || "Keep going! You're doing great 💪")}
          {energyLevel >= 40 && energyLevel < 80 && (t.almostThere || "Almost there! 🚀")}
          {energyLevel >= 80 && energyLevel < 100 && (t.soClose || "So close to perfection! ⭐")}
          {energyLevel >= 100 && (t.legendaryDay || "LEGENDARY DAY! 🏆🔥✨")}
        </p>
      </div>
    </div>
  );
}

// Activity row component
function ActivityRow({
  emoji,
  label,
  completed,
  progress,
  onClick
}: {
  emoji: string;
  label: string;
  completed: boolean;
  progress?: string;
  onClick?: () => void;
}) {
  return (
    <button
      onClick={onClick}
      className={cn(
        "w-full flex items-center gap-3 p-2.5 rounded-xl transition-all",
        completed
          ? "bg-gradient-to-r from-green-500/20 to-emerald-500/20 ring-1 ring-green-500/30"
          : "bg-secondary/50 hover:bg-secondary/80 hover:scale-[1.02]"
      )}
    >
      <div className={cn(
        "w-9 h-9 rounded-full flex items-center justify-center text-xl transition-all",
        completed
          ? "bg-green-500/30 animate-pulse-soft"
          : "bg-primary/10"
      )}>
        {completed ? '✅' : emoji}
      </div>

      <div className="flex-1 text-left">
        <span className={cn(
          "text-sm font-medium",
          completed ? "text-green-400" : "text-foreground"
        )}>
          {label}
        </span>
        {progress && (
          <span className="ml-2 text-xs text-muted-foreground">
            {progress}
          </span>
        )}
      </div>

      {completed && (
        <Sparkles className="w-4 h-4 text-green-400 animate-pulse" />
      )}
    </button>
  );
}
