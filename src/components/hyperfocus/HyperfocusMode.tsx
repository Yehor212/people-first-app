/**
 * HyperfocusMode — fullscreen focus timer orchestrator
 * Decomposed from the original 1,012-line monolith (TD-20).
 * This file: ~280L, 0 useState, delegates state to 4 custom hooks.
 */

import { useMemo } from 'react';
import { motion } from 'framer-motion';
import { X, Play, Pause, Sparkles, Shield, Music } from 'lucide-react';
import { isNative } from '@/lib/platform';
import { useLanguage } from '@/contexts/LanguageContext';
import { useBackHandler } from '@/hooks/useBackHandler';
import { useScrollLock } from '@/hooks/useScrollLock';
import { requestDndPolicyAccess, checkPolicyAccess, checkDndActive, setDndEnabled } from '@/hooks/useDnd';
import { cn } from '@/lib/utils';
import { zenTap } from '@/lib/animationUtils';

import { SHOW_DND, SHOW_SPOTIFY } from './types';
import type { HyperfocusModeProps } from './types';
import { useHyperfocusTimer } from './useHyperfocusTimer';
import { useHyperfocusAudio } from './useHyperfocusAudio';
import { useHyperfocusDnd } from './useHyperfocusDnd';
import { useHyperfocusSpotify } from './useHyperfocusSpotify';
import { HyperfocusBackground } from './HyperfocusBackground';
import { HyperfocusTimerDisplay } from './HyperfocusTimerDisplay';
import { HyperfocusSoundSelector } from './HyperfocusSoundSelector';

export function HyperfocusMode({ duration, onComplete, onExit }: HyperfocusModeProps) {
  const { t } = useLanguage();

  useBackHandler(true, onExit);
  useScrollLock(true);

  // --- Hooks ---
  const timer = useHyperfocusTimer({ duration, onComplete });
  const audio = useHyperfocusAudio({ isRunning: timer.isRunning, isPaused: timer.isPaused });
  const dnd = useHyperfocusDnd();
  const spotify = useHyperfocusSpotify({ isRunning: timer.isRunning, isPaused: timer.isPaused });

  // Back handler for DND permission dialog (LIFO: takes priority over main back handler when open)
  useBackHandler(dnd.showDndPermission, () => dnd.setShowDndPermission(false));

  // Calculate color based on progress (purple -> pink -> orange as time runs out)
  const progressColor = useMemo(() => {
    if (timer.progress < 70) return { from: 'hsl(var(--focus-violet))', to: 'hsl(var(--focus-purple))' };
    if (timer.progress < 90) return { from: 'hsl(var(--focus-pink))', to: 'hsl(var(--focus-pink-mid))' };
    return { from: 'hsl(var(--focus-orange))', to: 'hsl(var(--focus-orange-light))' };
  }, [timer.progress]);

  // --- Gesture-context handlers ---
  const handleStart = () => {
    timer.setIsRunning(true);
    timer.setIsPaused(false);
    if (audio.selectedSoundId) {
      audio.playSound(audio.selectedSoundId);
    }
  };

  const handlePause = () => {
    const newPausedState = !timer.isPaused;
    timer.setIsPaused(newPausedState);
    if (audio.selectedSoundId) {
      if (newPausedState) {
        audio.pauseAudio();
      } else {
        audio.resumeAudioDirect();
      }
    }
  };

  const handleOpenDndSettings = async () => {
    dnd.setDndSettingsError(false);
    const opened = await requestDndPolicyAccess();
    if (!opened) {
      const hasAccess = await checkPolicyAccess();
      if (hasAccess) {
        dnd.setShowDndPermission(false);
        const currentlyActive = await checkDndActive();
        dnd.setDndPreviousState(currentlyActive);
        const success = await setDndEnabled(true);
        if (success) dnd.setDndEnabledState(true);
      } else {
        dnd.setDndSettingsError(true);
      }
    }
  };

  const tRecord = t as unknown as Record<string, string>;

  // --- JSX ---
  return (
    <div className="fixed inset-0 bg-slate-100 dark:bg-black z-[110]">
      <HyperfocusBackground showBreathingAnimation={timer.showBreathingAnimation} t={tRecord} />

      {/* Close Button */}
      <button
        onClick={onExit}
        className="fixed top-4 end-4 z-[110] p-3 min-w-[48px] min-h-[48px] bg-secondary hover:bg-secondary/80 rounded-xl transition-all text-slate-600 dark:text-white flex items-center justify-center active:scale-95"
        style={{ top: 'max(1rem, env(safe-area-inset-top, 1rem))', insetInlineEnd: 'max(1rem, env(safe-area-inset-right, 1rem))' }}
        aria-label={t.close}
      >
        <X className="w-6 h-6" />
      </button>

      {/* Scrollable content layer */}
      <div className="absolute inset-0 z-20 overflow-y-auto">
      <div className="min-h-full flex flex-col items-center justify-center text-center px-6 py-8 lg:px-12">
        <HyperfocusTimerDisplay
          formattedTime={timer.formattedTime}
          timeLeft={timer.timeLeft}
          progress={timer.progress}
          progressColor={progressColor}
          isRunning={timer.isRunning}
          isPaused={timer.isPaused}
          t={tRecord}
        />

        {/* Premium Controls */}
        <div className="flex items-center justify-center gap-4 lg:gap-6 mb-8 lg:mb-12">
          {!timer.isRunning ? (
            <motion.button
              onClick={handleStart}
              className="relative px-8 py-4 min-h-[56px] rounded-2xl text-white font-bold text-lg flex items-center gap-3 overflow-hidden"
              style={{
                background: `linear-gradient(135deg, ${progressColor.from}, ${progressColor.to})`,
                boxShadow: `0 0 30px ${progressColor.from}50`
              }}
              whileHover={{ scale: 1.05 }}
              whileTap={zenTap.button}
            >
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
              className="px-8 py-4 min-h-[56px] bg-secondary backdrop-blur-sm border border-border rounded-2xl text-slate-700 dark:text-white font-bold text-lg flex items-center gap-3 transition-all"
              whileHover={{ scale: 1.05 }}
              whileTap={zenTap.button}
            >
              {timer.isPaused ? (
                <><Play className="w-6 h-6" />{t.hyperfocusResume}</>
              ) : (
                <><Pause className="w-6 h-6" />{t.hyperfocusPause}</>
              )}
            </motion.button>
          )}

          <motion.button
            onClick={onExit}
            className="px-6 py-4 min-h-[56px] bg-red-100 dark:bg-red-500/20 backdrop-blur-sm border border-red-300 dark:border-red-500/30 rounded-2xl text-red-600 dark:text-red-300 font-medium transition-all"
            whileHover={{ scale: 1.05 }}
            whileTap={zenTap.button}
          >
            {t.hyperfocusExit}
          </motion.button>
        </div>

        {/* Phone Focus Mode — DND toggle (Android only) */}
        {SHOW_DND && isNative && (
          <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto mb-4">
            <motion.button
              onClick={() => void dnd.handleDndToggle()}
              className={cn(
                "w-full px-4 py-3 min-h-[52px] rounded-2xl flex items-center justify-between",
                "border transition-all",
                dnd.dndEnabled
                  ? "bg-violet-500/20 border-violet-500/40"
                  : "bg-secondary border-border"
              )}
              whileTap={zenTap.card}
              aria-label={t.focusModeToggle || 'Phone Focus Mode'}
              aria-pressed={dnd.dndEnabled}
              role="switch"
            >
              <div className="flex items-center gap-3">
                <Shield className={cn("w-5 h-5", dnd.dndEnabled ? "text-violet-600 dark:text-violet-300" : "text-slate-500 dark:text-white/60")} aria-hidden="true" />
                <div className="text-start">
                  <span className={cn("text-sm font-medium", dnd.dndEnabled ? "text-violet-700 dark:text-violet-200" : "text-slate-700 dark:text-white/80")}>
                    {t.focusModeToggle || 'Phone Focus Mode'}
                  </span>
                  {dnd.dndEnabled && (
                    <p className="text-xs text-violet-600/70 dark:text-violet-300/60">{t.focusModeEnabled || 'Focus mode on — distractions silenced'}</p>
                  )}
                  {dnd.dndError && !dnd.dndEnabled && (
                    <p className="text-xs text-red-500 dark:text-red-400" role="status" aria-live="polite">{t.focusModeError || 'Could not enable focus mode'}</p>
                  )}
                </div>
              </div>
              <div className={cn("w-11 h-6 rounded-full transition-colors flex-shrink-0", dnd.dndEnabled ? "bg-violet-500" : "bg-muted")}>
                <motion.div className="w-5 h-5 rounded-full bg-white shadow-sm mt-0.5" animate={{ marginInlineStart: dnd.dndEnabled ? '22px' : '2px' }} transition={{ type: 'spring', stiffness: 300, damping: 25 }} />
              </div>
            </motion.button>
          </div>
        )}

        {/* DND Permission Modal */}
        {SHOW_DND && dnd.showDndPermission && (
          <div className="fixed inset-0 z-[110] flex items-center justify-center bg-black/50 backdrop-blur-sm p-6" role="dialog" aria-modal="true" aria-label={t.focusModePermTitle || 'Enable Focus Mode'} onClick={() => dnd.setShowDndPermission(false)}>
            <motion.div className="bg-card rounded-2xl p-6 max-w-sm w-full shadow-xl border border-border" initial={{ scale: 0.9, opacity: 0 }} animate={{ scale: 1, opacity: 1 }} onClick={(e) => e.stopPropagation()}>
              <div className="flex items-center gap-3 mb-4">
                <div className="p-2.5 rounded-xl bg-violet-500/20"><Shield className="w-6 h-6 text-violet-500" aria-hidden="true" /></div>
                <h3 className="text-lg font-bold text-foreground">{t.focusModePermTitle || 'Enable Focus Mode'}</h3>
              </div>
              <p className="text-sm text-muted-foreground mb-6">{t.focusModePermDesc || 'ZenFlow needs permission to silence notifications during focus sessions.'}</p>
              <div className="flex gap-3">
                <button onClick={() => dnd.setShowDndPermission(false)} className="flex-1 py-3 min-h-[44px] rounded-xl bg-secondary text-foreground font-medium transition-opacity hover:opacity-80">{t.cancel || 'Cancel'}</button>
                <button onClick={() => void handleOpenDndSettings()} className="flex-1 py-3 min-h-[44px] rounded-xl bg-violet-500 text-white font-medium transition-opacity hover:opacity-90">{t.focusModeOpenSettings || 'Open Settings'}</button>
              </div>
              {dnd.dndSettingsError && (
                <p className="text-xs text-red-500 dark:text-red-400 mt-3 text-center" role="status" aria-live="polite">{t.focusModeSettingsError || 'Could not open settings. Go to Settings → Apps → ZenFlow → Notifications.'}</p>
              )}
            </motion.div>
          </div>
        )}

        <HyperfocusSoundSelector
          selectedSoundId={audio.selectedSoundId}
          isSoundPlaying={audio.isSoundPlaying}
          audioStatus={audio.audioStatus}
          onSoundSelect={audio.handleSoundSelect}
          onToggleSound={audio.toggleSound}
          onPlaySound={audio.playSound}
          t={tRecord}
        />

        {/* Spotify Section */}
        {SHOW_SPOTIFY && <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto mt-4 bg-secondary backdrop-blur-md rounded-2xl p-4 border border-border">
          <div className="flex items-center justify-between mb-3">
            <div className="flex items-center gap-2">
              <Music className="w-4 h-4 text-[hsl(var(--brand-spotify))]" />
              <p className="text-sm text-slate-600 dark:text-white/70 font-medium">Spotify</p>
            </div>
            {spotify.spotifyConnected && (
              <motion.button
                onClick={() => spotify.setSpotifyAutoPlay(!spotify.spotifyAutoPlay)}
                className={cn(
                  'px-3 py-1.5 rounded-lg text-xs font-medium transition-all',
                  spotify.spotifyAutoPlay
                    ? 'bg-[hsl(var(--brand-spotify))]/30 border border-[hsl(var(--brand-spotify))]/50 text-[hsl(var(--brand-spotify))]'
                    : 'bg-secondary border border-border text-slate-500 dark:text-white/60'
                )}
                whileTap={zenTap.button}
              >
                {spotify.spotifyAutoPlay ? t.spotifyAutoPlayOn : t.spotifyAutoPlayOff}
              </motion.button>
            )}
          </div>
          {spotify.spotifyTrack ? (
            <div className="flex items-center gap-3 p-3 bg-secondary border border-border rounded-xl">
              {spotify.spotifyTrack.albumArt && (
                <img src={spotify.spotifyTrack.albumArt} alt="Album" className="w-12 h-12 rounded-lg shadow-lg" />
              )}
              <div className="flex-1 min-w-0">
                <p className="text-sm text-slate-800 dark:text-white font-medium truncate">{spotify.spotifyTrack.name}</p>
                <p className="text-xs text-slate-600 dark:text-white/60 truncate">{spotify.spotifyTrack.artist}</p>
              </div>
              {spotify.spotifyTrack.isPlaying && (
                <div className="flex gap-0.5 items-end h-5">
                  <motion.div className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full" animate={{ height: ['8px', '20px', '12px', '16px', '8px'] }} transition={{ duration: 1, repeat: Infinity }} />
                  <motion.div className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full" animate={{ height: ['16px', '8px', '20px', '12px', '16px'] }} transition={{ duration: 1, repeat: Infinity, delay: 0.1 }} />
                  <motion.div className="w-1 bg-[hsl(var(--brand-spotify))] rounded-full" animate={{ height: ['12px', '16px', '8px', '20px', '12px'] }} transition={{ duration: 1, repeat: Infinity, delay: 0.2 }} />
                </div>
              )}
            </div>
          ) : (
            <p className="text-xs text-slate-500 dark:text-white/40 text-center py-2">{t.spotifyNoTrack}</p>
          )}
        </div>}

        {/* Premium Tips */}
        {!timer.isRunning && (
          <motion.div
            className="mt-8 max-w-sm sm:max-w-md lg:max-w-lg mx-auto"
            initial={{ opacity: 0, y: 10 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ delay: 0.3 }}
          >
            <div className="bg-secondary backdrop-blur-md border border-border rounded-2xl p-4">
              <div className="flex items-center gap-2 mb-2">
                <span className="text-lg">💡</span>
                <p className="text-xs text-slate-600 dark:text-white/60 font-medium">{t.hyperfocusTip}</p>
              </div>
              <p className="text-sm text-slate-700 dark:text-white/80">{t.hyperfocusTipText}</p>
            </div>
          </motion.div>
        )}
      </div>
      </div>
    </div>
  );
}
