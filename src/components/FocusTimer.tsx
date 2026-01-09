import { useState, useEffect, useRef } from 'react';
import { FocusSession } from '@/types';
import { formatTime, getToday, generateId } from '@/lib/utils';
import { cn } from '@/lib/utils';
import { Play, Pause, RotateCcw, Coffee } from 'lucide-react';

const FOCUS_TIME = 25 * 60; // 25 minutes
const BREAK_TIME = 5 * 60; // 5 minutes

interface FocusTimerProps {
  sessions: FocusSession[];
  onCompleteSession: (session: FocusSession) => void;
}

export function FocusTimer({ sessions, onCompleteSession }: FocusTimerProps) {
  const [timeLeft, setTimeLeft] = useState(FOCUS_TIME);
  const [isRunning, setIsRunning] = useState(false);
  const [isBreak, setIsBreak] = useState(false);
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  
  const todaySessions = sessions.filter(s => s.date === getToday());
  const todayMinutes = todaySessions.reduce((acc, s) => acc + s.duration, 0);

  useEffect(() => {
    if (isRunning && timeLeft > 0) {
      intervalRef.current = setInterval(() => {
        setTimeLeft((prev) => prev - 1);
      }, 1000);
    } else if (timeLeft === 0) {
      if (!isBreak) {
        // Focus session completed
        const session: FocusSession = {
          id: generateId(),
          duration: FOCUS_TIME / 60,
          completedAt: Date.now(),
          date: getToday(),
        };
        onCompleteSession(session);
      }
      setIsBreak(!isBreak);
      setTimeLeft(isBreak ? FOCUS_TIME : BREAK_TIME);
      setIsRunning(false);
    }

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, timeLeft, isBreak, onCompleteSession]);

  const toggleTimer = () => {
    setIsRunning(!isRunning);
  };

  const resetTimer = () => {
    setIsRunning(false);
    setIsBreak(false);
    setTimeLeft(FOCUS_TIME);
  };

  const progress = isBreak 
    ? ((BREAK_TIME - timeLeft) / BREAK_TIME) * 100
    : ((FOCUS_TIME - timeLeft) / FOCUS_TIME) * 100;

  return (
    <div className="bg-card rounded-2xl p-6 zen-shadow-card animate-fade-in">
      <div className="flex items-center justify-between mb-6">
        <h3 className="text-lg font-semibold text-foreground">
          {isBreak ? 'Перерыв' : 'Фокус'}
        </h3>
        <div className="flex items-center gap-2 text-sm text-muted-foreground">
          <Coffee className="w-4 h-4" />
          <span>{todayMinutes} мин сегодня</span>
        </div>
      </div>

      <div className="relative w-48 h-48 mx-auto mb-6">
        {/* Background circle */}
        <svg className="w-full h-full -rotate-90" viewBox="0 0 100 100">
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke="hsl(var(--secondary))"
            strokeWidth="8"
          />
          <circle
            cx="50"
            cy="50"
            r="45"
            fill="none"
            stroke={isBreak ? "hsl(var(--accent))" : "hsl(var(--primary))"}
            strokeWidth="8"
            strokeLinecap="round"
            strokeDasharray={`${2 * Math.PI * 45}`}
            strokeDashoffset={`${2 * Math.PI * 45 * (1 - progress / 100)}`}
            className="transition-all duration-1000"
          />
        </svg>
        
        {/* Timer text */}
        <div className="absolute inset-0 flex flex-col items-center justify-center">
          <span className={cn(
            "text-4xl font-bold",
            isBreak ? "text-accent" : "text-primary"
          )}>
            {formatTime(timeLeft)}
          </span>
          <span className="text-sm text-muted-foreground mt-1">
            {isBreak ? '☕ Отдохните' : '🎯 Сконцентрируйтесь'}
          </span>
        </div>
      </div>

      <div className="flex justify-center gap-4">
        <button
          onClick={toggleTimer}
          className={cn(
            "p-4 rounded-full transition-all zen-shadow-soft",
            isBreak ? "zen-gradient-warm" : "zen-gradient",
            "text-primary-foreground hover:opacity-90"
          )}
        >
          {isRunning ? <Pause className="w-6 h-6" /> : <Play className="w-6 h-6" />}
        </button>
        <button
          onClick={resetTimer}
          className="p-4 rounded-full bg-secondary text-secondary-foreground hover:bg-muted transition-colors"
        >
          <RotateCcw className="w-6 h-6" />
        </button>
      </div>
    </div>
  );
}
