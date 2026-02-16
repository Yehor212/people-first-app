/**
 * HyperfocusSoundSelector — ambient sound picker with status indicators
 * Pure component, 0 useState.
 */

import { motion, AnimatePresence } from 'framer-motion';
import { Volume2, VolumeX, Loader2, AlertCircle, RotateCcw } from 'lucide-react';
import { SOUNDS, AudioStatus } from '@/lib/ambientSounds';
import { cn } from '@/lib/utils';

interface HyperfocusSoundSelectorProps {
  selectedSoundId: string | null;
  isSoundPlaying: boolean;
  audioStatus: AudioStatus;
  onSoundSelect: (soundId: string | null) => void;
  onToggleSound: () => void;
  onPlaySound: (soundId: string) => void;
  t: Record<string, string>;
}

export function HyperfocusSoundSelector({
  selectedSoundId, isSoundPlaying, audioStatus,
  onSoundSelect, onToggleSound, onPlaySound, t,
}: HyperfocusSoundSelectorProps) {
  return (
    <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto bg-secondary backdrop-blur-md rounded-2xl p-4 border border-border">
      <div className="flex items-center justify-between mb-4">
        <span className="text-sm text-slate-600 dark:text-white/70 font-medium">
          {t.hyperfocusAmbientSound}
        </span>

        <div className="flex items-center gap-2">
          {/* Audio status indicator */}
          <AnimatePresence mode="wait">
            {audioStatus.state === 'loading' && selectedSoundId && (
              <motion.div
                key="loading"
                initial={{ opacity: 0, scale: 0.8 }}
                animate={{ opacity: 1, scale: 1 }}
                exit={{ opacity: 0, scale: 0.8 }}
                className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg"
              >
                <Loader2 className="w-4 h-4 text-blue-500 animate-spin" aria-hidden="true" />
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
                onClick={() => selectedSoundId && onPlaySound(selectedSoundId)}
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
                onClick={() => selectedSoundId && onPlaySound(selectedSoundId)}
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
              onClick={onToggleSound}
              aria-label={isSoundPlaying ? t.muteSound : t.unmuteSound}
              className={cn(
                "p-2.5 min-w-[44px] min-h-[44px] rounded-xl transition-all flex items-center justify-center",
                isSoundPlaying
                  ? "bg-violet-500/30 border border-violet-500/50"
                  : "bg-secondary border border-border"
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

      {/* Sound selector grid */}
      <div className="grid grid-cols-3 gap-2">
        {/* None button */}
        <motion.button
          onClick={() => onSoundSelect(null)}
          className={cn(
            'px-2 py-3 min-h-[52px] rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1',
            !selectedSoundId
              ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
              : 'bg-secondary border border-border text-slate-600 dark:text-white/70 hover:bg-secondary/80'
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
          const soundMeta: Record<string, { emoji: string; labelKey: string }> = {
            underwater: { emoji: '🌊', labelKey: 'hyperfocusSoundOcean' },
            thunderstorm: { emoji: '⛈️', labelKey: 'hyperfocusSoundRain' },
            ocean: { emoji: '🏖️', labelKey: 'hyperfocusSoundOcean' },
            river: { emoji: '🏞️', labelKey: 'hyperfocusSoundForest' },
            cafe: { emoji: '☕', labelKey: 'hyperfocusSoundCoffee' },
            fireplace: { emoji: '🔥', labelKey: 'hyperfocusSoundFireplace' },
          };
          const meta = soundMeta[sound.id] || { emoji: '🎵', labelKey: '' };
          const localizedName = t[meta.labelKey] || sound.nameEn;

          return (
            <motion.button
              key={sound.id}
              onClick={() => onSoundSelect(sound.id)}
              className={cn(
                'px-2 py-3 min-h-[52px] rounded-xl text-xs font-medium transition-all flex flex-col items-center justify-center gap-1',
                isSelected
                  ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
                  : 'bg-secondary border border-border text-slate-600 dark:text-white/70 hover:bg-secondary/80'
              )}
              style={isSelected ? {
                boxShadow: '0 0 12px hsl(var(--focus-violet) / 0.3)'
              } : {}}
              whileHover={{ scale: 1.03 }}
              whileTap={{ scale: 0.97 }}
            >
              <span className="text-lg">{meta.emoji}</span>
              <span>{localizedName}</span>
            </motion.button>
          );
        })}
      </div>
    </div>
  );
}
