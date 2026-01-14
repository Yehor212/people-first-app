// Time Blindness Helper for ADHD
// Visual time indicators and audio pings for better time awareness

import { useState, useEffect, useRef } from 'react';
import { Clock, Bell, BellOff, Play, Pause, X } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { cn } from '@/lib/utils';

interface TimeHelperProps {
  onClose: () => void;
}

export function TimeHelper({ onClose }: TimeHelperProps) {
  const { t } = useLanguage();
  const [duration, setDuration] = useState(60); // minutes
  const [timeLeft, setTimeLeft] = useState(duration * 60); // seconds
  const [isRunning, setIsRunning] = useState(false);
  const [soundEnabled, setSoundEnabled] = useState(true);
  const [pingInterval, setPingInterval] = useState(15); // minutes
  const intervalRef = useRef<NodeJS.Timeout | null>(null);
  const lastPingRef = useRef<number>(0);
  const audioContextRef = useRef<AudioContext | null>(null);

  useEffect(() => {
    setTimeLeft(duration * 60);
  }, [duration]);

  useEffect(() => {
    if (!isRunning) {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
      return;
    }

    intervalRef.current = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(intervalRef.current!);
          playCompletionSound();
          return 0;
        }

        const newTimeLeft = prev - 1;
        const elapsed = (duration * 60) - newTimeLeft;

        // Play ping at intervals
        if (soundEnabled && elapsed > 0 && elapsed % (pingInterval * 60) === 0) {
          const timeSinceLastPing = Date.now() - lastPingRef.current;
          if (timeSinceLastPing > 1000) { // Prevent double pings
            playPing();
            lastPingRef.current = Date.now();
          }
        }

        return newTimeLeft;
      });
    }, 1000);

    return () => {
      if (intervalRef.current) {
        clearInterval(intervalRef.current);
      }
    };
  }, [isRunning, duration, soundEnabled, pingInterval]);

  const playPing = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;
    const oscillator = ctx.createOscillator();
    const gainNode = ctx.createGain();

    oscillator.connect(gainNode);
    gainNode.connect(ctx.destination);

    oscillator.frequency.value = 800;
    oscillator.type = 'sine';

    gainNode.gain.setValueAtTime(0.3, ctx.currentTime);
    gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + 0.1);

    oscillator.start(ctx.currentTime);
    oscillator.stop(ctx.currentTime + 0.1);
  };

  const playCompletionSound = () => {
    if (!audioContextRef.current) {
      audioContextRef.current = new (window.AudioContext || (window as any).webkitAudioContext)();
    }

    const ctx = audioContextRef.current;

    // Triple beep for completion
    [0, 0.2, 0.4].forEach((offset) => {
      const oscillator = ctx.createOscillator();
      const gainNode = ctx.createGain();

      oscillator.connect(gainNode);
      gainNode.connect(ctx.destination);

      oscillator.frequency.value = 1000;
      oscillator.type = 'sine';

      gainNode.gain.setValueAtTime(0.3, ctx.currentTime + offset);
      gainNode.gain.exponentialRampToValueAtTime(0.01, ctx.currentTime + offset + 0.15);

      oscillator.start(ctx.currentTime + offset);
      oscillator.stop(ctx.currentTime + offset + 0.15);
    });
  };

  const formatTime = (seconds: number) => {
    const hours = Math.floor(seconds / 3600);
    const mins = Math.floor((seconds % 3600) / 60);
    const secs = seconds % 60;

    if (hours > 0) {
      return `${hours}:${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
    }
    return `${mins}:${secs.toString().padStart(2, '0')}`;
  };

  const getTimeRemaining = () => {
    const hours = Math.floor(timeLeft / 3600);
    const mins = Math.floor((timeLeft % 3600) / 60);

    if (hours > 0) {
      return `${hours}h ${mins}m left`;
    }
    return `${mins}m left`;
  };

  const getEndTime = () => {
    const end = new Date(Date.now() + timeLeft * 1000);
    return end.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;
  const progressColor = timeLeft < 300 ? 'text-red-500' : timeLeft < 900 ? 'text-yellow-500' : 'text-primary';

  return (
    <div className="fixed inset-0 bg-black/50 backdrop-blur-sm z-50 flex items-center justify-center p-4">
      <div className="bg-card rounded-2xl shadow-2xl max-w-lg w-full p-6">
        {/* Header */}
        <div className="flex items-center justify-between mb-6">
          <div className="flex items-center gap-3">
            <div className="p-2 zen-gradient rounded-xl">
              <Clock className="w-6 h-6 text-white" />
            </div>
            <div>
              <h2 className="text-xl font-bold">Time Blindness Helper</h2>
              <p className="text-sm text-muted-foreground">
                Visual time awareness for ADHD
              </p>
            </div>
          </div>
          <button
            onClick={onClose}
            className="p-2 hover:bg-muted rounded-lg transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        {/* Circular Timer */}
        <div className="mb-6">
          <div className="relative w-64 h-64 mx-auto">
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="rgba(139, 92, 246, 0.1)"
                strokeWidth="12"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="url(#timeGradient)"
                strokeWidth="12"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 120}`}
                strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                className="transition-all duration-1000"
              />
              <defs>
                <linearGradient id="timeGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>

            {/* Time Display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className={cn('text-5xl font-bold mb-2', progressColor)}>
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-muted-foreground">
                  {timeLeft > 0 ? getTimeRemaining() : 'Time\'s up!'}
                </div>
              </div>
            </div>
          </div>

          {/* End Time Prediction */}
          {isRunning && timeLeft > 0 && (
            <div className="text-center mt-4 p-3 bg-primary/10 rounded-xl">
              <p className="text-sm text-muted-foreground mb-1">
                🎯 You'll finish at:
              </p>
              <p className="text-xl font-bold text-primary">
                {getEndTime()}
              </p>
            </div>
          )}
        </div>

        {/* Controls */}
        {!isRunning ? (
          <>
            {/* Duration Selector */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">
                Duration (minutes)
              </label>
              <div className="grid grid-cols-4 gap-2 mb-3">
                {[15, 30, 45, 60].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setDuration(mins)}
                    className={cn(
                      'py-2 rounded-lg font-medium transition-all',
                      duration === mins
                        ? 'zen-gradient text-white zen-shadow'
                        : 'bg-muted hover:bg-muted/70'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
              <input
                type="range"
                min="5"
                max="180"
                step="5"
                value={duration}
                onChange={(e) => setDuration(parseInt(e.target.value))}
                className="w-full"
              />
              <div className="text-center text-sm text-muted-foreground mt-1">
                {duration} minutes
              </div>
            </div>

            {/* Ping Interval */}
            <div className="mb-4">
              <label className="text-sm font-medium mb-2 block">
                Ping Every (minutes)
              </label>
              <div className="grid grid-cols-4 gap-2">
                {[5, 10, 15, 30].map(mins => (
                  <button
                    key={mins}
                    onClick={() => setPingInterval(mins)}
                    className={cn(
                      'py-2 rounded-lg font-medium transition-all text-sm',
                      pingInterval === mins
                        ? 'bg-primary text-primary-foreground'
                        : 'bg-muted hover:bg-muted/70'
                    )}
                  >
                    {mins}m
                  </button>
                ))}
              </div>
            </div>

            {/* Sound Toggle */}
            <div className="flex items-center justify-between mb-4">
              <span className="text-sm font-medium">Audio Pings</span>
              <button
                onClick={() => setSoundEnabled(!soundEnabled)}
                className={cn(
                  'flex items-center gap-2 px-3 py-2 rounded-lg transition-colors',
                  soundEnabled
                    ? 'bg-primary text-primary-foreground'
                    : 'bg-muted text-muted-foreground'
                )}
              >
                {soundEnabled ? <Bell className="w-4 h-4" /> : <BellOff className="w-4 h-4" />}
                <span className="text-sm">{soundEnabled ? 'On' : 'Off'}</span>
              </button>
            </div>

            {/* Start Button */}
            <button
              onClick={() => setIsRunning(true)}
              className="w-full py-3 zen-gradient text-white font-bold rounded-xl hover:opacity-90 transition-opacity flex items-center justify-center gap-2"
            >
              <Play className="w-5 h-5" />
              Start Timer
            </button>
          </>
        ) : (
          <div className="flex gap-2">
            <button
              onClick={() => setIsRunning(false)}
              className="flex-1 py-3 bg-muted hover:bg-muted/70 font-medium rounded-xl transition-colors flex items-center justify-center gap-2"
            >
              <Pause className="w-5 h-5" />
              Pause
            </button>
            <button
              onClick={() => {
                setIsRunning(false);
                setTimeLeft(duration * 60);
              }}
              className="flex-1 py-3 bg-destructive/10 hover:bg-destructive/20 text-destructive font-medium rounded-xl transition-colors"
            >
              Reset
            </button>
          </div>
        )}

        {/* Info */}
        <div className="mt-6 p-4 bg-primary/5 border border-primary/20 rounded-xl">
          <div className="flex gap-3">
            <div className="text-2xl">💡</div>
            <div className="text-sm">
              <div className="font-medium mb-1">ADHD Time Management</div>
              <ul className="text-muted-foreground space-y-1 list-disc list-inside">
                <li>Audio pings help track time passing</li>
                <li>Visual countdown reduces anxiety</li>
                <li>End time prediction = better planning</li>
                <li>Color changes warn when time is low</li>
              </ul>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
}
