import { useState, useEffect, useRef, useCallback, useMemo } from 'react';
import { motion, AnimatePresence } from 'framer-motion';
import { logger } from '@/lib/logger';
import { X, Play, Pause, Volume2, VolumeX, Music, ExternalLink, Sparkles, Loader2, AlertCircle, RotateCcw, Bug, Copy, Check } from 'lucide-react';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { getAmbientSoundGenerator, SOUNDS, unlockAudio, AmbientSoundGenerator, AudioStatus } from '@/lib/ambientSounds';
import { cn } from '@/lib/utils';
import {
  isSpotifyConnected,
  connectSpotify,
  getCurrentTrack,
  startFocusPlayback,
  stopFocusPlayback,
  SpotifyTrack
} from '@/lib/spotifyIntegration';

// P0 Fix: Declare app version global
declare const __APP_VERSION__: string;

// Star particle for cosmic background (dark theme only)
function CosmicStar({ x, y, size, delay }: { x: number; y: number; size: number; delay: number }) {
  return (
    <motion.div
      className="absolute rounded-full bg-white hidden dark:block"
      style={{
        left: `${x}%`,
        top: `${y}%`,
        width: size,
        height: size,
      }}
      animate={{
        opacity: [0.2, 0.8, 0.2],
        scale: [1, 1.3, 1],
      }}
      transition={{
        duration: 2 + Math.random() * 2,
        delay,
        repeat: Infinity,
        ease: 'easeInOut',
      }}
    />
  );
}

interface HyperfocusModeProps {
  duration: number; // в минутах
  onComplete: () => void;
  onExit: () => void;
}

export function HyperfocusMode({ duration, onComplete, onExit }: HyperfocusModeProps) {
  const { t, language } = useLanguage();

  // Android back button: close fullscreen overlay
  useBackHandler(true, onExit);

  const [timeLeft, setTimeLeft] = useState(duration * 60); // секунды
  const [isRunning, setIsRunning] = useState(false);
  const [isPaused, setIsPaused] = useState(false);
  const [selectedSoundId, setSelectedSoundId] = useState<string | null>(null);
  const [isSoundPlaying, setIsSoundPlaying] = useState(false);
  const [showBreathingAnimation, setShowBreathingAnimation] = useState(false);
  // Use global singleton to prevent audio overlap
  const soundGeneratorRef = useRef<AmbientSoundGenerator>(getAmbientSoundGenerator());

  // P0 Fix: Audio status tracking for UI feedback
  const [audioStatus, setAudioStatus] = useState<AudioStatus>({
    state: 'idle',
    soundId: null,
    isUnlocked: false,
  });

  // P1 Fix: Debug panel state (activated by 5 taps on header)
  const [showDebugPanel, setShowDebugPanel] = useState(false);
  useBackHandler(showDebugPanel, () => setShowDebugPanel(false));
  const [debugTapCount, setDebugTapCount] = useState(0);
  const debugTapTimeoutRef = useRef<NodeJS.Timeout | null>(null);
  const [copiedDebug, setCopiedDebug] = useState(false);

  // Spotify state
  const [spotifyConnected, setSpotifyConnected] = useState(isSpotifyConnected());
  const [spotifyTrack, setSpotifyTrack] = useState<SpotifyTrack | null>(null);
  const [spotifyAutoPlay, setSpotifyAutoPlay] = useState(false);

  // P0 Fix: Subscribe to audio status updates
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    const unsubscribe = generator.addStatusListener((status) => {
      setAudioStatus(status);
      // Update isSoundPlaying based on status
      if (status.state === 'playing') {
        setIsSoundPlaying(true);
      } else if (status.state === 'idle' || status.state === 'error') {
        setIsSoundPlaying(false);
      }
    });

    return unsubscribe;
  }, []);

  // P1 Fix: Debug panel tap handler
  const handleDebugTap = useCallback(() => {
    if (debugTapTimeoutRef.current) {
      clearTimeout(debugTapTimeoutRef.current);
    }

    const newCount = debugTapCount + 1;
    setDebugTapCount(newCount);

    // P0 Fix: Reduced from 5 to 3 taps for easier debug access
    if (newCount >= 3) {
      setShowDebugPanel(true);
      setDebugTapCount(0);
      logger.log('[HyperfocusMode] Debug panel activated');
    } else {
      // Reset tap count after 2 seconds of no taps
      debugTapTimeoutRef.current = setTimeout(() => {
        setDebugTapCount(0);
      }, 2000);
    }
  }, [debugTapCount]);

  // P1 Fix: Copy debug info to clipboard
  const copyDebugInfo = useCallback(async () => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    const debugInfo = generator.getDebugInfo();
    const debugText = JSON.stringify(debugInfo, null, 2);

    try {
      await navigator.clipboard.writeText(debugText);
      setCopiedDebug(true);
      setTimeout(() => setCopiedDebug(false), 2000);
      logger.log('[HyperfocusMode] Debug info copied to clipboard');
    } catch (e) {
      logger.error('[HyperfocusMode] Failed to copy debug info:', e);
    }
  }, []);

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
  // Note: gesture handlers (handleStart, handleSoundSelect, handlePause) already
  // initiate playSound within user gesture context for iOS. This effect handles
  // pause/resume synchronization and cleanup only.
  useEffect(() => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (!selectedSoundId) {
      generator.stop();
      setIsSoundPlaying(false);
      return;
    }

    if (!isRunning || isPaused) {
      // Pause sound when timer stops or pauses
      generator.pause();
    }
    // Note: actual playSound() is called from gesture handlers, not here,
    // to preserve iOS user gesture context for audio playback.
  }, [selectedSoundId, isRunning, isPaused]);

  const formatTime = (seconds: number) => {
    const mins = Math.floor(seconds / 60);
    const secs = seconds % 60;
    return `${mins.toString().padStart(2, '0')}:${secs.toString().padStart(2, '0')}`;
  };

  const progress = ((duration * 60 - timeLeft) / (duration * 60)) * 100;

  const handleStart = () => {
    // Start timer immediately — never block on audio
    setIsRunning(true);
    setIsPaused(false);

    // Unlock audio within user gesture context (fire-and-forget)
    unlockAudio().catch(e => {
      logger.warn('[HyperfocusMode] Audio unlock failed:', e);
    });

    // Play sound within user gesture context (critical for iOS)
    if (selectedSoundId) {
      playSound(selectedSoundId);
    }
  };

  const handlePause = () => {
    const newPausedState = !isPaused;
    setIsPaused(newPausedState);

    const generator = soundGeneratorRef.current;
    if (generator && selectedSoundId) {
      if (newPausedState) {
        // Pausing
        generator.pause();
      } else {
        // Resuming — unlock + play within gesture context (critical for iOS)
        unlockAudio().catch(() => {});
        playSound(selectedSoundId);
      }
    }
  };

  const toggleSound = () => {
    const generator = soundGeneratorRef.current;
    if (!generator) return;

    if (isSoundPlaying) {
      generator.pause();
      setIsSoundPlaying(false);
    } else if (selectedSoundId) {
      // Unlock + re-play within gesture context (critical for iOS)
      unlockAudio().catch(() => {});
      playSound(selectedSoundId);
    }
  };

  const handleSoundSelect = (soundId: string | null) => {
    // Unlock audio within gesture context (fire-and-forget, critical for iOS)
    unlockAudio().catch(e => {
      logger.warn('[HyperfocusMode] Audio unlock failed:', e);
    });

    setSelectedSoundId(soundId);

    // Play immediately within gesture context
    if (soundId && isRunning && !isPaused) {
      playSound(soundId);
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

  // Generate stars for cosmic background
  const cosmicStars = useMemo(() =>
    Array.from({ length: 50 }, (_, i) => ({
      id: i,
      x: Math.random() * 100,
      y: Math.random() * 100,
      size: 1 + Math.random() * 2,
      delay: Math.random() * 3,
    })),
  []);

  // Calculate color based on progress (purple -> pink -> orange as time runs out)
  const progressColor = useMemo(() => {
    if (progress < 70) return { from: 'hsl(var(--focus-violet))', to: 'hsl(var(--focus-purple))' }; // Purple
    if (progress < 90) return { from: 'hsl(var(--focus-pink))', to: 'hsl(var(--focus-pink-mid))' }; // Pink
    return { from: 'hsl(var(--focus-orange))', to: 'hsl(var(--focus-orange-light))' }; // Orange - ending soon
  }, [progress]);

  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-black z-[100] flex items-center justify-center overflow-hidden touch-none">
      {/* Deep space background - Theme-aware */}
      <div className="absolute inset-0 bg-gradient-to-b from-slate-100 via-indigo-50 to-violet-100 dark:bg-none" />
      <div
        className="absolute inset-0 hidden dark:block"
        style={{
          background: `radial-gradient(ellipse at center,
            hsl(var(--focus-cosmic-mid)) 0%, hsl(var(--focus-cosmic-deep)) 50%, hsl(0 0% 0%) 100%)`
        }}
      />

      {/* Star field */}
      {cosmicStars.map((star) => (
        <CosmicStar key={star.id} {...star} />
      ))}

      {/* Animated nebula gradient */}
      <motion.div
        className="absolute inset-0 pointer-events-none"
        animate={{ opacity: [0.2, 0.4, 0.2] }}
        transition={{ duration: 8, repeat: Infinity }}
        style={{
          background: `
            radial-gradient(circle at 20% 30%, hsl(var(--focus-violet) / 0.15) 0%, transparent 40%),
            radial-gradient(circle at 80% 70%, hsl(var(--focus-pink) / 0.1) 0%, transparent 40%),
            radial-gradient(circle at 50% 90%, hsl(var(--focus-cyan) / 0.08) 0%, transparent 30%)
          `
        }}
      />

      {/* Breathing Animation */}
      {showBreathingAnimation && (
        <div className="absolute inset-0 flex items-center justify-center z-10 pointer-events-none">
          <div className="breathing-circle zen-gradient rounded-full opacity-40" />
          <div className="absolute text-center">
            <p className="text-4xl font-bold text-slate-800 dark:text-white mb-4">
              {t.hyperfocusBreathe}
            </p>
            <p className="text-xl text-white/70">
              {t.hyperfocusBreathDesc}
            </p>
          </div>
        </div>
      )}

      {/* Close Button - Fixed position with safe area for iOS */}
      <button
        onClick={onExit}
        className="fixed top-4 right-4 z-[110] p-3 min-w-[48px] min-h-[48px] bg-slate-200/80 dark:bg-white/10 hover:bg-slate-300/80 dark:hover:bg-white/20 rounded-xl transition-all text-slate-600 dark:text-white flex items-center justify-center active:scale-95"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', right: 'max(1rem, env(safe-area-inset-right, 1rem))' }}
        aria-label={t.close}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Main Content */}
      <div className="relative z-20 text-center px-6">
        {/* Premium Timer Display */}
        <div className="mb-12">
          <div className="relative w-72 h-72 mx-auto mb-8">
            {/* Multi-layer Circular Progress */}
            <svg className="w-full h-full transform -rotate-90" viewBox="0 0 280 280">
              {/* Layer 1: Outer orbit path (dashed) - dark mode only */}
              <circle
                cx="140"
                cy="140"
                r="135"
                fill="none"
                className="stroke-slate-300 dark:stroke-white/10"
                strokeWidth="1"
                strokeDasharray="4 4"
              />

              {/* Layer 2: Minute markers */}
              {Array.from({ length: 60 }).map((_, i) => {
                const angle = (i * 6 - 90) * (Math.PI / 180);
                const isHour = i % 5 === 0;
                const innerR = isHour ? 118 : 122;
                const outerR = 128;
                return (
                  <line
                    key={i}
                    x1={140 + innerR * Math.cos(angle)}
                    y1={140 + innerR * Math.sin(angle)}
                    x2={140 + outerR * Math.cos(angle)}
                    y2={140 + outerR * Math.sin(angle)}
                    className={isHour ? "stroke-slate-400 dark:stroke-white/30" : "stroke-slate-300 dark:stroke-white/10"}
                    strokeWidth={isHour ? 2 : 1}
                  />
                );
              })}

              {/* Layer 3: Background track */}
              <circle
                cx="140"
                cy="140"
                r="110"
                fill="none"
                className="stroke-slate-200 dark:stroke-white/[0.08]"
                strokeWidth="8"
              />

              {/* Layer 4: Progress ring with dynamic color */}
              <motion.circle
                cx="140"
                cy="140"
                r="110"
                fill="none"
                stroke="url(#hyperfocusGradient)"
                strokeWidth="8"
                strokeLinecap="round"
                strokeDasharray={`${2 * Math.PI * 110}`}
                initial={false}
                animate={{
                  strokeDashoffset: `${2 * Math.PI * 110 * (1 - progress / 100)}`
                }}
                transition={{ duration: 0.5, ease: "easeOut" }}
                style={{
                  filter: `drop-shadow(0 0 12px ${progressColor.from})`
                }}
              />

              {/* Gradient definition with dynamic colors */}
              <defs>
                <linearGradient id="hyperfocusGradient" x1="0%" y1="0%" x2="100%" y2="100%">
                  <stop offset="0%" stopColor={progressColor.from} />
                  <stop offset="100%" stopColor={progressColor.to} />
                </linearGradient>
              </defs>
            </svg>

            {/* Inner breathing glow */}
            {isRunning && !isPaused && (
              <motion.div
                className="absolute inset-12 rounded-full pointer-events-none"
                style={{
                  background: `radial-gradient(circle, ${progressColor.from}20 0%, transparent 70%)`
                }}
                animate={{
                  scale: [1, 1.1, 1],
                  opacity: [0.4, 0.7, 0.4],
                }}
                transition={{
                  duration: 4,
                  repeat: Infinity,
                  ease: 'easeInOut',
                }}
              />
            )}

            {/* Time Display */}
            <div className="absolute inset-0 flex items-center justify-center">
              <div className="text-center">
                <motion.div
                  className="text-6xl font-bold text-violet-700 dark:text-white mb-2"
                  style={{
                    textShadow: `0 0 30px ${progressColor.from}60`
                  }}
                  key={timeLeft}
                  initial={{ scale: 0.95, opacity: 0.8 }}
                  animate={{ scale: 1, opacity: 1 }}
                  transition={{ duration: 0.15 }}
                >
                  {formatTime(timeLeft)}
                </motion.div>
                <div className="text-sm text-slate-600 dark:text-white/60">
                  {t.hyperfocusTimeLeft}
                </div>
              </div>
            </div>
          </div>

          {/* Status Text */}
          <p className="text-xl text-slate-700 dark:text-white/80 mb-2">
            {isPaused
              ? t.hyperfocusPaused
              : !isRunning
              ? t.hyperfocusReady
              : t.hyperfocusFocusing}
          </p>

          {isPaused && (
            <p className="text-sm text-slate-600 dark:text-white/60">
              {t.hyperfocusPauseMsg}
            </p>
          )}
        </div>

        {/* Premium Controls */}
        <div className="flex items-center justify-center gap-4 mb-8">
          {!isRunning ? (
            <motion.button
              onClick={handleStart}
              className="relative px-8 py-4 min-h-[56px] rounded-2xl text-white font-bold text-lg flex items-center gap-3 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${progressColor.from}, ${progressColor.to})`,
                boxShadow: `0 0 30px ${progressColor.from}50`
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {/* Pulse ring */}
              <motion.div
                className="absolute inset-0 rounded-2xl border-2 border-white/30"
                animate={{ scale: [1, 1.1], opacity: [0.5, 0] }}
                transition={{ duration: 1.5, repeat: Infinity }}
              />
              <Sparkles className="w-5 h-5" />
              {t.hyperfocusStart}
            </motion.button>
          ) : (
            <motion.button
              onClick={handlePause}
              className="px-8 py-4 min-h-[56px] bg-slate-200/80 dark:bg-white/10 backdrop-blur-sm border border-slate-300 dark:border-white/20 rounded-2xl text-slate-700 dark:text-white font-bold text-lg flex items-center gap-3 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={{ scale: 0.95 }}
            >
              {isPaused ? (
                <>
                  <Play className="w-6 h-6" />
                  {t.hyperfocusResume}
                </>
              ) : (
                <>
                  <Pause className="w-6 h-6" />
                  {t.hyperfocusPause}
                </>
              )}
            </motion.button>
          )}

          <motion.button
            onClick={onExit}
            className="px-6 py-4 min-h-[56px] bg-red-100 dark:bg-red-500/20 backdrop-blur-sm border border-red-300 dark:border-red-500/30 rounded-2xl text-red-600 dark:text-red-300 font-medium transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={{ scale: 0.95 }}
          >
            {t.hyperfocusExit}
          </motion.button>
        </div>

        {/* Premium Ambient Sound Selector */}
        <div className="max-w-md mx-auto bg-slate-200/80 dark:bg-white/5 backdrop-blur-md rounded-2xl p-4 border border-slate-300 dark:border-white/10">
          <div className="flex items-center justify-between mb-4">
            {/* P1 Fix: 5-tap to activate debug panel */}
            <button
              onClick={handleDebugTap}
              className="text-sm text-slate-600 dark:text-white/70 font-medium select-none"
              aria-label={t.hyperfocusAmbientSound || 'Ambient sound'}
            >
              {t.hyperfocusAmbientSound}
            </button>

            <div className="flex items-center gap-2">
              {/* P0 Fix: Audio status indicator */}
              <AnimatePresence mode="wait">
                {audioStatus.state === 'loading' && selectedSoundId && (
                  <motion.div
                    key="loading"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg"
                  >
                    <Loader2 className="w-4 h-4 text-blue-500 animate-spin" />
                    <span className="text-xs text-blue-600 dark:text-blue-400">
                      {t.audioLoading || 'Loading...'}
                    </span>
                  </motion.div>
                )}
                {audioStatus.state === 'blocked' && selectedSoundId && (
                  <motion.div
                    key="blocked"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg cursor-pointer"
                    onClick={() => unlockAudio()}
                  >
                    <AlertCircle className="w-4 h-4 text-amber-500" />
                    <span className="text-xs text-amber-600 dark:text-amber-400">
                      {t.audioTapToEnable || 'Tap to enable'}
                    </span>
                  </motion.div>
                )}
                {audioStatus.state === 'error' && selectedSoundId && (
                  <motion.div
                    key="error"
                    initial={{ opacity: 0, scale: 0.8 }}
                    animate={{ opacity: 1, scale: 1 }}
                    exit={{ opacity: 0, scale: 0.8 }}
                    className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg cursor-pointer"
                    onClick={() => selectedSoundId && playSound(selectedSoundId)}
                  >
                    <RotateCcw className="w-4 h-4 text-red-500" />
                    <span className="text-xs text-red-600 dark:text-red-400">
                      {t.audioRetry || 'Retry'}
                    </span>
                  </motion.div>
                )}
              </AnimatePresence>

              {selectedSoundId && audioStatus.state !== 'loading' && (
                <motion.button
                  onClick={toggleSound}
                  className={cn(
                    "p-2.5 min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center",
                    isSoundPlaying
                      ? "bg-violet-500/30 border border-violet-500/50"
                      : "bg-slate-300/50 dark:bg-white/10 border border-slate-400 dark:border-white/20"
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {isSoundPlaying ? (
                    <Volume2 className="w-5 h-5 text-violet-700 dark:text-violet-300" />
                  ) : (
                    <VolumeX className="w-5 h-5 text-slate-500 dark:text-white/60" />
                  )}
                </motion.button>
              )}
            </div>
          </div>

          {/* Sound selector grid with glassmorphism */}
          <div className="grid grid-cols-3 gap-2">
            {/* None button */}
            <motion.button
              onClick={() => handleSoundSelect(null)}
              className={cn(
                'px-2 py-3 min-h-[52px] rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1',
                !selectedSoundId
                  ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
                  : 'bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
              )}
              style={!selectedSoundId ? {
                boxShadow: '0 0 12px hsl(var(--focus-violet) / 0.3)'
              } : {}}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-lg">🔇</span>
              <span>{t.hyperfocusSoundNone}</span>
            </motion.button>

            {/* All available sounds */}
            {SOUNDS.map(sound => {
              const isSelected = selectedSoundId === sound.id;
              const emoji = {
                underwater: '🌊',
                thunderstorm: '⛈️',
                ocean: '🏖️',
                river: '🏞️',
                cafe: '☕',
                fireplace: '🔥',
              }[sound.id] || '🎵';

              return (
                <motion.button
                  key={sound.id}
                  onClick={() => handleSoundSelect(sound.id)}
                  className={cn(
                    'px-2 py-3 min-h-[52px] rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1',
                    isSelected
                      ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
                      : 'bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 text-slate-600 dark:text-white/70 hover:bg-slate-200 dark:hover:bg-white/10'
                  )}
                  style={isSelected ? {
                    boxShadow: '0 0 12px hsl(var(--focus-violet) / 0.3)'
                  } : {}}
                  whileHover={{ scale: 1.03 }}
                  whileTap={{ scale: 0.97 }}
                >
                  <span className="text-lg">{emoji}</span>
                  <span>{language === 'ru' || language === 'uk' ? sound.nameRu : sound.nameEn}</span>
                </motion.button>
              );
            })}
          </div>

          {/* Premium Spotify Section */}
          <div className="mt-4 pt-4 border-t border-slate-300 dark:border-white/10">
            <div className="flex items-center justify-between mb-3">
              <div className="flex items-center gap-2">
                <Music className="w-4 h-4 text-[hsl(var(--brand-spotify))]" />
                <p className="text-sm text-slate-600 dark:text-white/70 font-medium">Spotify</p>
              </div>
              {spotifyConnected && (
                <motion.button
                  onClick={() => setSpotifyAutoPlay(!spotifyAutoPlay)}
                  className={cn(
                    'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                    spotifyAutoPlay
                      ? 'bg-[hsl(var(--brand-spotify))]/30 border border-[hsl(var(--brand-spotify))]/50 text-[hsl(var(--brand-spotify))]'
                      : 'bg-slate-300/50 dark:bg-white/10 border border-slate-400 dark:border-white/20 text-slate-500 dark:text-white/60'
                  )}
                  whileTap={{ scale: 0.95 }}
                >
                  {spotifyAutoPlay ? 'Auto-play ON' : 'Auto-play OFF'}
                </motion.button>
              )}
            </div>

            {/* TODO: Restore Spotify Connect button when API keys are configured
            {!spotifyConnected ? (
              <motion.button
                onClick={handleSpotifyConnect}
                className="w-full py-3 bg-[hsl(var(--brand-spotify))]/20 border border-[hsl(var(--brand-spotify))]/30 rounded-xl text-[hsl(var(--brand-spotify))] font-medium flex items-center justify-center gap-2 transition-all"
                whileHover={{ backgroundColor: 'hsl(var(--brand-spotify) / 0.3)' }}
                whileTap={{ scale: 0.98 }}
              >
                <ExternalLink className="w-4 h-4" />
                {t.spotifyConnect}
              </motion.button>
            ) : */}
            {spotifyTrack ? (
              <div className="flex items-center gap-3 p-3 bg-slate-100 dark:bg-white/5 border border-slate-300 dark:border-white/10 rounded-xl">
                {spotifyTrack.albumArt && (
                  <img
                    src={spotifyTrack.albumArt}
                    alt="Album"
                    className="w-12 h-12 rounded-lg shadow-lg"
                  />
                )}
                <div className="flex-1 min-w-0">
                  <p className="text-sm text-slate-800 dark:text-white font-medium truncate">
                    {spotifyTrack.name}
                  </p>
                  <p className="text-xs text-slate-600 dark:text-white/60 truncate">
                    {spotifyTrack.artist}
                  </p>
                </div>
                {spotifyTrack.isPlaying && (
                  <div className="flex gap-0.5 items-end h-5">
                    <motion.div
                      className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full"
                      animate={{ height: ['8px', '20px', '12px', '16px', '8px'] }}
                      transition={{ duration: 1, repeat: Infinity }}
                    />
                    <motion.div
                      className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full"
                      animate={{ height: ['16px', '8px', '20px', '12px', '16px'] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.1 }}
                    />
                    <motion.div
                      className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full"
                      animate={{ height: ['12px', '16px', '8px', '20px', '12px'] }}
                      transition={{ duration: 1, repeat: Infinity, delay: 0.2 }}
                    />
                  </div>
                )}
              </div>
            ) : (
              <p className="text-xs text-slate-500 dark:text-white/40 text-center py-2">
                {t.spotifyNoTrack}
              </p>
            )}
          </div>

          {/* P1 Fix: Audio Debug Panel */}
          <AnimatePresence>
            {showDebugPanel && (
              <motion.div
                initial={{ opacity: 0, height: 0 }}
                animate={{ opacity: 1, height: 'auto' }}
                exit={{ opacity: 0, height: 0 }}
                className="mt-4 pt-4 border-t border-slate-300 dark:border-white/10"
              >
                <div className="flex items-center justify-between mb-3">
                  <div className="flex items-center gap-2">
                    <Bug className="w-4 h-4 text-orange-500" />
                    <p className="text-sm text-slate-600 dark:text-white/70 font-medium">
                      Audio Debug
                    </p>
                  </div>
                  <div className="flex items-center gap-2">
                    <motion.button
                      onClick={copyDebugInfo}
                      className="px-2 py-1 bg-slate-300/50 dark:bg-white/10 border border-slate-400 dark:border-white/20 rounded-lg text-xs text-slate-600 dark:text-white/70 flex items-center gap-1"
                      whileTap={{ scale: 0.95 }}
                    >
                      {copiedDebug ? (
                        <>
                          <Check className="w-3 h-3 text-green-500" />
                          Copied!
                        </>
                      ) : (
                        <>
                          <Copy className="w-3 h-3" />
                          Copy
                        </>
                      )}
                    </motion.button>
                    <motion.button
                      onClick={() => setShowDebugPanel(false)}
                      className="px-2 py-1 bg-slate-300/50 dark:bg-white/10 border border-slate-400 dark:border-white/20 rounded-lg text-xs text-slate-600 dark:text-white/70"
                      whileTap={{ scale: 0.95 }}
                    >
                      Close
                    </motion.button>
                  </div>
                </div>
                <div className="space-y-2 text-xs font-mono">
                  {/* P0 Fix: Show app version for diagnostics */}
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-white/50">App Version:</span>
                    <span className="text-slate-600 dark:text-white/70">{__APP_VERSION__}</span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-white/50">State:</span>
                    <span className={cn(
                      "font-medium",
                      audioStatus.state === 'playing' && "text-green-500",
                      audioStatus.state === 'loading' && "text-blue-500",
                      audioStatus.state === 'error' && "text-red-500",
                      audioStatus.state === 'blocked' && "text-amber-500",
                      (audioStatus.state === 'idle' || audioStatus.state === 'paused') && "text-slate-600 dark:text-white/70"
                    )}>
                      {audioStatus.state}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-white/50">Unlocked:</span>
                    <span className={audioStatus.isUnlocked ? "text-green-500" : "text-red-500"}>
                      {audioStatus.isUnlocked ? 'Yes' : 'No'}
                    </span>
                  </div>
                  <div className="flex justify-between">
                    <span className="text-slate-500 dark:text-white/50">Sound:</span>
                    <span className="text-slate-600 dark:text-white/70">{audioStatus.soundId || 'None'}</span>
                  </div>
                  {audioStatus.error && (
                    <div className="mt-2 p-2 bg-red-500/10 border border-red-500/30 rounded-lg">
                      <p className="text-red-500 font-medium">{audioStatus.error.code}</p>
                      <p className="text-red-400 text-[10px]">{audioStatus.error.message}</p>
                    </div>
                  )}
                </div>
              </motion.div>
            )}
          </AnimatePresence>
        </div>

        {/* Premium Tips */}
        {!isRunning && (
          <motion.div
            className="mt-8 max-w-sm mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-slate-200/80 dark:bg-white/5 backdrop-blur-md border border-slate-300 dark:border-white/10 rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <p className="text-xs text-slate-600 dark:text-white/60 font-medium">
                  {t.hyperfocusTip}
                </p>
              </div>
              <p className="text-sm text-slate-700 dark:text-white/80">
                {t.hyperfocusTipText}
              </p>
            </div>
          </motion.div>
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
