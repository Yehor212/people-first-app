import { useState, useEffect, useRef } from 'react';
import { X, Play, Pause, Volume2, VolumeX } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';

interface HyperfocusModeProps {
  duration: number; // в минутах
  onComplete: () => void;
  onExit: () => void;
}

type AmbientSound = 'none' | 'white-noise' | 'rain' | 'ocean' | 'forest' | 'coffee-shop';

export function HyperfocusMode({ duration, onComplete, onExit }: HyperfocusModeProps) {
  const { t } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(duration * 60); // секунды
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSound, setSelectedSound] = useState<AmbientSound>('none');
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [showBreathingAnimation, setShowBreathingAnimation] = useState(false);
  const audioRef = useRef<HTMLAudioElement | null>(null);

  // Countdown timer
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const interval = setInterval(() => {
      setTimeLeft(prev => {
        if (prev <= 1) {
          clearInterval(interval);
          onComplete();
          return 0;
        }
        return prev - 1;
      });
    }, 1000);

    return () => clearInterval(interval);
  }, [isRunning, isPaused, onComplete]);

  // Auto-break reminder every 25 minutes
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const elapsed = (duration * 60) - timeLeft;
    if (elapsed > 0 && elapsed % (25 * 60) === 0) {
      // Show breathing animation
      setShowBreathingAnimation(true);
      setIsPaused(true);

      // Auto-resume after 30 seconds
      setTimeout(() => {
        setShowBreathingAnimation(false);
        setIsPaused(false);
      }, 30000);
    }
  }, [timeLeft, duration, isRunning, isPaused]);

  // Ambient sound player
  useEffect(() => {
    if (selectedSound === 'none') {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
      setIsSoundPlaying(false);
      return;
    }

    // Create audio element for ambient sound
    // Note: In production, you'll need actual sound files in public/sounds/
    const soundUrls: Record<Exclude<AmbientSound, 'none'>, string> = {
      'white-noise': '/sounds/white-noise.mp3',
      'rain': '/sounds/rain.mp3',
      'ocean': '/sounds/ocean.mp3',
      'forest': '/sounds/forest.mp3',
      'coffee-shop': '/sounds/coffee-shop.mp3',
    };

    if (audioRef.current) {
      audioRef.current.pause();
    }

    audioRef.current = new Audio(soundUrls[selectedSound]);
    audioRef.current.loop = true;
    audioRef.current.volume = 0.3;

    if (isRunning && !isPaused) {
      audioRef.current.play().catch(err => {
        console.error('Failed to play ambient sound:', err);
      });
      setIsSoundPlaying(true);
    }

    return () => {
      if (audioRef.current) {
        audioRef.current.pause();
        audioRef.current = null;
      }
    };
  }, [selectedSound, isRunning, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const handleStart = () => {
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = () => {
    setIsPaused(!isPaused);
    if (audioRef.current) {
      if (isPaused) {
        audioRef.current.play();
      } else {
        audioRef.current.pause();
      }
    }
  };

  const handleEmergencyPause = () => {
    if (window.confirm(t.hyperfocusEmergencyConfirm || 'Хотите приостановить сессию? Без чувства вины! 💜')) {
      setIsPaused(true);
      if (audioRef.current) {
        audioRef.current.pause();
      }
    }
  };

  const toggleSound = () => {
    if (isSoundPlaying && audioRef.current) {
      audioRef.current.pause();
      setIsSoundPlaying(false);
    } else if (audioRef.current) {
      audioRef.current.play();
      setIsSoundPlaying(true);
    }
  };

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center">
      {/* Background gradient */}
      <div className="absolute inset-0 zen-gradient-calm opacity-20" />

      {/* Breathing Animation */}
      {showBreathingAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-10">
          <div className="breathing-circle zen-gradient rounded-full opacity-40" />
          <div className="absolute text-center">
            <p className="text-4xl font-bold text-white mb-4">
              {t.hyperfocusBreathe || 'Дышите...'}
            </p>
            <p className="text-xl text-white/70">
              {t.hyperfocusBreathDesc || 'Вдох 4 сек • Выдох 4 сек'}
            </p>
          </div>
        </div>
      )}

      {/* Main Content */}
      <div className="relative z-20 text-center px-6">
        {/* Emergency Exit Button */}
        <button
          onClick={handleEmergencyPause}
          className="absolute top-4 right-4 p-3 bg-red-500/20 hover:bg-red-500/30 rounded-xl transition-all text-white"
          aria-label="Emergency Pause"
        >
          <X className="w-6 h-6" />
        </button>

        {/* Timer Display */}
        <div className="mb-12">
          <div className="relative w-64 h-64 mx-auto mb-8">
            {/* Circular Progress */}
            <svg className="w-full h-full transform -rotate-90">
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="rgba(255,255,255,0.1)"
                strokeWidth="8"
              />
              <circle
                cx="128"
                cy="128"
                r="120"
                fill="none"
                stroke="url(#gradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 120}`}
                strokeDashoffset={`${2 * Math.PI * 120 * (1 - progress / 100)}`}
                className="transition-all duration-1000 ease-linear"
              />
              <defs>
                <linearGradient id="gradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor="#8B5CF6" />
                  <stop offset="100%" stopColor="#EC4899" />
                </linearGradient>
              </defs>
            </svg>

            {/* Time Display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <div className="text-6xl font-bold text-white mb-2">
                  {formatTime(timeLeft)}
                </div>
                <div className="text-sm text-white/60">
                  {t.hyperfocusTimeLeft || 'осталось'}
                </div>
              </div>
            </div>
          </div>

          {/* Status Text */}
          <p className="text-xl text-white/80 mb-2">
            {isPaused
              ? t.hyperfocusPaused || 'Приостановлено'
              : !isRunning
              ? t.hyperfocusReady || 'Готовы к гиперфокусу?'
              : t.hyperfocusFocusing || 'В зоне фокуса...'}
          </p>

          {isPaused && (
            <p className="text-sm text-white/60">
              {t.hyperfocusPauseMsg || 'Нажмите Play, чтобы продолжить'}
            </p>
          )}
        </div>

        {/* Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {!isRunning ? (
            <button
              onClick={handleStart}
              className="btn-press px-8 py-4 zen-gradient rounded-2xl text-white font-bold text-lg flex items-center gap-3 hover:opacity-90 transition-opacity zen-shadow-xl"
            >
              <Play className="w-6 h-6" />
              {t.hyperfocusStart || 'Начать'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="btn-press px-8 py-4 bg-white/10 hover:bg-white/20 rounded-2xl text-white font-bold text-lg flex items-center gap-3 transition-all zen-shadow-xl"
            >
              {isPaused ? (
                <>
                  <Play className="w-6 h-6" />
                  {t.hyperfocusResume || 'Продолжить'}
                </>
              ) : (
                <>
                  <Pause className="w-6 h-6" />
                  {t.hyperfocusPause || 'Пауза'}
                </>
              )}
            </button>
          )}

          <button
            onClick={onExit}
            className="btn-press px-6 py-4 bg-red-500/20 hover:bg-red-500/30 rounded-2xl text-white font-medium transition-all"
          >
            {t.hyperfocusExit || 'Выход'}
          </button>
        </div>

        {/* Ambient Sound Selector */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">
              {t.hyperfocusAmbientSound || 'Фоновый звук'}
            </p>
            {selectedSound !== 'none' && (
              <button
                onClick={toggleSound}
                className="p-2 bg-white/10 hover:bg-white/20 rounded-lg transition-colors"
              >
                {isSoundPlaying ? (
                  <Volume2 className="w-4 h-4 text-white" />
                ) : (
                  <VolumeX className="w-4 h-4 text-white" />
                )}
              </button>
            )}
          </div>

          <div className="grid grid-cols-3 gap-2">
            {(['none', 'white-noise', 'rain', 'ocean', 'forest', 'coffee-shop'] as AmbientSound[]).map(sound => (
              <button
                key={sound}
                onClick={() => setSelectedSound(sound)}
                className={`btn-press px-3 py-2 rounded-xl text-sm font-medium transition-all ${
                  selectedSound === sound
                    ? 'bg-primary text-primary-foreground zen-shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                }`}
              >
                {sound === 'none' && (t.hyperfocusSoundNone || 'Без звука')}
                {sound === 'white-noise' && (t.hyperfocusSoundWhiteNoise || 'Белый шум')}
                {sound === 'rain' && (t.hyperfocusSoundRain || 'Дождь')}
                {sound === 'ocean' && (t.hyperfocusSoundOcean || 'Океан')}
                {sound === 'forest' && (t.hyperfocusSoundForest || 'Лес')}
                {sound === 'coffee-shop' && (t.hyperfocusSoundCoffee || 'Кафе')}
              </button>
            ))}
          </div>
        </div>

        {/* Tips */}
        {!isRunning && (
          <div className="mt-8 max-w-sm mx-auto">
            <div className="bg-white/5 backdrop-blur rounded-2xl p-4">
              <p className="text-xs text-white/60 mb-2">
                💡 {t.hyperfocusTip || 'Совет'}
              </p>
              <p className="text-sm text-white/80">
                {t.hyperfocusTipText || 'Каждые 25 минут будет короткая дыхательная пауза. Это помогает избежать выгорания!'}
              </p>
            </div>
          </div>
        )}
      </div>

      {/* Breathing Animation CSS */}
      <style>{`
        @keyframes breathing {
          0%, 100% {
            transform: scale(1);
            opacity: 0.3;
          }
          50% {
            transform: scale(1.5);
            opacity: 0.6;
          }
        }

        .breathing-circle {
          width: 200px;
          height: 200px;
          animation: breathing 8s ease-in-out infinite;
        }
      `}</style>
    </div>
  );
}
