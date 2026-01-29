import { useState, useEffect, useRef, useCallback } from 'react';
import { logger } from '@/lib/logger';
import { X, Play, Pause, Volume2, VolumeX, Music, ExternalLink } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { getAmbientSoundGenerator, SOUNDS, unlockAudio, AmbientSoundGenerator } from '@/lib/ambientSounds';
import { cn } from '@/lib/utils';
import {
  isSpotifyConnected,
  connectSpotify,
  getCurrentTrack,
  startFocusPlayback,
  stopFocusPlayback,
  SpotifyTrack
} from '@/lib/spotifyIntegration';

interface HyperfocusModeProps {
  duration: number; // в минутах
  onComplete: () => void;
  onExit: () => void;
}

export function HyperfocusMode({ duration, onComplete, onExit }: HyperfocusModeProps) {
  const { t, language } = useLanguage();
  const [timeLeft, setTimeLeft] = useState(duration * 60); // секунды
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [showBreathingAnimation, setShowBreathingAnimation] = useState(false);
  // Use global singleton to prevent audio overlap
  const soundGeneratorRef = useRef<AmbientSoundGenerator>(getAmbientSoundGenerator());

  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(isSpotifyConnected());
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyAutoPlay, setSpotifyAutoPlay] = useState(false);

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

  // P1 Fix: Ref to store auto-break timeout for cleanup
  const autoBreakTimeoutRef = useRef<NodeJS.Timeout | null>(null);

  // Auto-break reminder every 25 minutes
  useEffect(() => {
    if (!isRunning || isPaused) return;

    const elapsed = (duration * 60) - timeLeft;
    if (elapsed > 0 && elapsed % (25 * 60) === 0) {
      // Show breathing animation
      setShowBreathingAnimation(true);
      setIsPaused(true);

      // P1 Fix: Store timeout ref for cleanup
      autoBreakTimeoutRef.current = setTimeout(() => {
        setShowBreathingAnimation(false);
        setIsPaused(false);
      }, 30000);
    }

    // P1 Fix: Cleanup timeout on unmount or deps change
    return () => {
      if (autoBreakTimeoutRef.current) {
        clearTimeout(autoBreakTimeoutRef.current);
      }
    };
  }, [timeLeft, duration, isRunning, isPaused]);

  // Stop sound when component unmounts (but don't destroy global singleton)
  useEffect(() => {
    return () => {
      if (soundGeneratorRef.current) {
        soundGeneratorRef.current.stop();
      }
    };
  }, []);

  // Spotify auto-play/pause when timer starts/stops
  useEffect(() => {
    if (!spotifyConnected || !spotifyAutoPlay) return;

    if (isRunning && !isPaused) {
      startFocusPlayback();
    } else {
      stopFocusPlayback();
    }
  }, [isRunning, isPaused, spotifyConnected, spotifyAutoPlay]);

  // Poll Spotify current track
  useEffect(() => {
    if (!spotifyConnected) return;

    const pollTrack = async () => {
      const track = await getCurrentTrack();
      setSpotifyTrack(track);
    };

    pollTrack();
    const interval = setInterval(pollTrack, 5000);
    return () => clearInterval(interval);
  }, [spotifyConnected]);

  // Handle Spotify connect
  const handleSpotifyConnect = () => {
    connectSpotify();
  };

  // Play sound helper
  const playSound = useCallback(async (soundId: string) => {
    const generator = soundGeneratorRef.current;
    if (!generator || !soundId) return;

    try {
      // Unlock audio (required for mobile)
      await unlockAudio();

      // Play directly - cancellation handled by AmbientSoundGenerator
      await generator.play(soundId);
      setIsSoundPlaying(true);
      logger.log('[HyperfocusMode] Sound playing:', soundId);
    } catch (err) {
      logger.error('[HyperfocusMode] Failed to play sound:', err);
      setIsSoundPlaying(false);
    }
  }, []); // Empty deps - stable function

  // Ambient sound player - react to state changes
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (!selectedSoundId) {
      generator.stop();
      setIsSoundPlaying(false);
      return;
    }

    // Always play sound when selected (loads and initializes audio)
    playSound(selectedSoundId);

    // Pause immediately if timer not running or paused
    if (!isRunning || isPaused) {
      generator.pause();
    }
  }, [selectedSoundId, isRunning, isPaused]); // Removed audioReady and playSound

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const handleStart = async () => {
    // Unlock audio on user gesture (required for mobile browsers)
    try {
      await unlockAudio();
    } catch (e) {
      logger.warn('[HyperfocusMode] Audio unlock failed:', e);
    }
    setIsRunning(true);
    setIsPaused(false);
  };

  const handlePause = async () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);

    const generator = soundGeneratorRef.current;
    if (generator && selectedSoundId) {
      if (newPausedState) {
        // Pausing
        generator.pause();
      } else {
        // Resuming - need to replay on mobile
        await playSound(selectedSoundId);
      }
    }
  };

  const toggleSound = async () => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (isSoundPlaying) {
      generator.pause();
      setIsSoundPlaying(false);
    } else if (selectedSoundId) {
      // Need to re-play on mobile instead of just resume
      await playSound(selectedSoundId);
    }
  };

  const handleSoundSelect = async (soundId: string | null) => {
    // Always unlock on user interaction
    try {
      await unlockAudio();
    } catch (e) {
      logger.warn('[HyperfocusMode] Audio unlock failed:', e);
    }

    setSelectedSoundId(soundId);

    // If running and not paused, play immediately
    if (soundId && isRunning && !isPaused) {
      await playSound(soundId);
    } else if (!soundId) {
      soundGeneratorRef.current?.stop();
      setIsSoundPlaying(false);
    }
  };

  // Lock body scroll when component mounts (preserves scroll position)
  useEffect(() => {
    const scrollY = window.scrollY;
    const originalStyles = {
      overflow: document.body.style.overflow,
      position: document.body.style.position,
      width: document.body.style.width,
      top: document.body.style.top,
    };

    document.body.style.overflow = 'hidden';
    document.body.style.position = 'fixed';
    document.body.style.width = '100%';
    document.body.style.top = `-${scrollY}px`;

    return () => {
      document.body.style.overflow = originalStyles.overflow;
      document.body.style.position = originalStyles.position;
      document.body.style.width = originalStyles.width;
      document.body.style.top = originalStyles.top;
      window.scrollTo(0, scrollY);
    };
  }, []);

  return (
    <div className="fixed inset-0 bg-black z-[100] flex items-center justify-center overflow-hidden touch-none">
      {/* Background gradient */}
      <div className="absolute inset-0 zen-gradient-calm opacity-20 pointer-events-none" />

      {/* Breathing Animation */}
      {showBreathingAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
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

      {/* Close Button - Fixed position with safe area for iOS */}
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-[110] p-3 min-w-[48px] min-h-[48px] bg-white/10 hover:bg-white/20 rounded-xl transition-all text-white flex items-center justify-center active:scale-95"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', right: 'max(1rem, env(safe-area-inset-right, 1rem))' }}
        aria-label="Close"
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div className="relative z-20 text-center px-6">
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
              className="btn-press px-8 py-4 min-h-[56px] zen-gradient rounded-2xl text-white font-bold text-lg flex items-center gap-3 hover:opacity-90 transition-opacity zen-shadow-xl active:scale-95"
            >
              <Play className="w-6 h-6" />
              {t.hyperfocusStart || 'Начать'}
            </button>
          ) : (
            <button
              onClick={handlePause}
              className="btn-press px-8 py-4 min-h-[56px] bg-white/10 hover:bg-white/20 rounded-2xl text-white font-bold text-lg flex items-center gap-3 transition-all zen-shadow-xl active:scale-95"
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
            className="btn-press px-6 py-4 min-h-[56px] bg-red-500/20 hover:bg-red-500/30 rounded-2xl text-white font-medium transition-all active:scale-95"
          >
            {t.hyperfocusExit || 'Выход'}
          </button>
        </div>

        {/* Ambient Sound Selector - Simple list of local sounds */}
        <div className="max-w-md mx-auto">
          <div className="flex items-center justify-between mb-3">
            <p className="text-sm text-white/70">
              {t.hyperfocusAmbientSound || 'Фоновый звук'}
            </p>
            {selectedSoundId && (
              <button
                onClick={toggleSound}
                className="p-2.5 min-w-[44px] min-h-[44px] bg-white/10 hover:bg-white/20 rounded-lg transition-colors flex items-center justify-center active:scale-95"
              >
                {isSoundPlaying ? (
                  <Volume2 className="w-5 h-5 text-white" />
                ) : (
                  <VolumeX className="w-5 h-5 text-white" />
                )}
              </button>
            )}
          </div>

          {/* Sound selector - one button per sound */}
          <div className="grid grid-cols-3 gap-2">
            {/* None button */}
            <button
              onClick={() => handleSoundSelect(null)}
              className={cn(
                'btn-press px-2 py-3 min-h-[48px] rounded-xl text-xs font-medium transition-all active:scale-95',
                !selectedSoundId
                  ? 'bg-primary text-primary-foreground zen-shadow'
                  : 'bg-white/10 text-white hover:bg-white/20'
              )}
            >
              🔇 {t.hyperfocusSoundNone || 'Без звуку'}
            </button>

            {/* All available sounds */}
            {SOUNDS.map(sound => (
              <button
                key={sound.id}
                onClick={() => handleSoundSelect(sound.id)}
                className={cn(
                  'btn-press px-2 py-3 min-h-[48px] rounded-xl text-xs font-medium transition-all active:scale-95',
                  selectedSoundId === sound.id
                    ? 'bg-primary text-primary-foreground zen-shadow'
                    : 'bg-white/10 text-white hover:bg-white/20'
                )}
              >
                {sound.id === 'underwater' && '🌊'}
                {sound.id === 'thunderstorm' && '⛈️'}
                {sound.id === 'ocean' && '🏖️'}
                {sound.id === 'river' && '🏞️'}
                {sound.id === 'cafe' && '☕'}
                {sound.id === 'fireplace' && '🔥'}
                {' '}
                {language === 'ru' || language === 'uk' ? sound.nameRu : sound.nameEn}
              </button>
            ))}
          </div>

          {/* Spotify Section */}
          <div className="mt-6 pt-4 border-t border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-green-400" />
                <p className="text-sm text-white/70">Spotify</p>
              </div>
              {spotifyConnected && (
                <button
                  onClick={() => setSpotifyAutoPlay(!spotifyAutoPlay)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    spotifyAutoPlay
                      ? 'bg-green-500/20 text-green-400'
                      : 'bg-white/10 text-white/60'
                  )}
                >
                  {spotifyAutoPlay ? 'Auto-play ON' : 'Auto-play OFF'}
                </button>
              )}
            </div>

            {!spotifyConnected ? (
              <button
                onClick={handleSpotifyConnect}
                className="w-full py-3 bg-[#1DB954]/20 hover:bg-[#1DB954]/30 rounded-xl text-[#1DB954] font-medium flex items-center justify-center gap-2 transition-all active:scale-95"
              >
                <ExternalLink className="w-4 h-4" />
                {t.spotifyConnect || 'Подключить Spotify'}
              </button>
            ) : spotifyTrack ? (
              <div className="flex items-center gap-3 p-3 bg-white/5 rounded-xl">
                {spotifyTrack.albumArt && (
                  <img
                    src={spotifyTrack.albumArt}
                    alt="Album"
                    className="w-12 h-12 rounded-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-white font-medium truncate">
                    {spotifyTrack.name}
                  </p>
                  <p className="text-xs text-white/60 truncate">
                    {spotifyTrack.artist}
                  </p>
                </div>
                {spotifyTrack.isPlaying && (
                  <div className="flex gap-0.5">
                    <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse" />
                    <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse delay-75" />
                    <div className="w-1 h-4 bg-green-400 rounded-full animate-pulse delay-150" />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-white/40 text-center py-2">
                {t.spotifyNoTrack || 'Откройте Spotify и включите музыку'}
              </p>
            )}
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
          width: 150px;
          height: 150px;
          animation: breathing 8s ease-in-out infinite;
        }

        @media (min-width: 360px) {
          .breathing-circle {
            width: 200px;
            height: 200px;
          }
        }
      `}</style>
    </div>
  );
}
