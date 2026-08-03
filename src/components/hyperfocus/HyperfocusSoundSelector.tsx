/**
 * HyperfocusSoundSelector — ambient sound picker with status indicators
 * Pure component, 0 useState.
 */

import { motion, AnimatePresence } from 'framer-motion';
import {
  AlertCircle,
  CloudRain,
  Droplets,
  Flame,
  Loader2,
  RotateCcw,
  TreePine,
  Volume2,
  VolumeX,
  Waves,
  Wind,
  type LucideIcon,
} from 'lucide-react';
import { SOUNDS, AudioStatus } from '@/lib/ambientSounds';
import {
  HYPERFOCUS_AUDIO_FAMILIES,
  getHyperfocusAudioFamily,
  getHyperfocusVariantId,
  parseHyperfocusVariantId,
  type HyperfocusAudioFamilyId,
} from '@/lib/hyperfocusAudioCatalog';
import { cn } from '@/lib/utils';
import { zenTap } from '@/lib/animationUtils';
import { useShouldAnimate } from '@/hooks/useShouldAnimate';

const soundMeta: Record<HyperfocusAudioFamilyId, { Icon: LucideIcon }> = {
  forest: { Icon: TreePine },
  rain: { Icon: CloudRain },
  ocean: { Icon: Waves },
  fireplace: { Icon: Flame },
  river: { Icon: Droplets },
  wind: { Icon: Wind },
};

interface HyperfocusSoundSelectorProps {
  selectedSoundId: string | null;
  isSoundPlaying: boolean;
  audioStatus: AudioStatus;
  onSoundSelect: (soundId: string | null) => void;
  onToggleSound: () => void;
  onPlaySound: (soundId: string) => void;
  audioMuted?: boolean;
  t: Record<string, string>;
}

export function HyperfocusSoundSelector({
  selectedSoundId, isSoundPlaying, audioStatus,
  onSoundSelect, onToggleSound, onPlaySound, audioMuted = false, t,
}: HyperfocusSoundSelectorProps) {
  const motionAllowed = useShouldAnimate({ respectRuntimePerformance: false });
  const selectedVariant = selectedSoundId ? parseHyperfocusVariantId(selectedSoundId) : null;
  const activeFamily = selectedVariant ? getHyperfocusAudioFamily(selectedVariant.familyId) : undefined;
  const activeLevelId = selectedVariant?.levelId;

  return (
    <div className="w-full max-w-sm sm:max-w-md lg:max-w-3xl mx-auto bg-secondary backdrop-blur-md rounded-2xl p-4 border border-border">
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
                initial={motionAllowed ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                exit={motionAllowed ? { opacity: 0, scale: 0.8 } : undefined}
                className="flex items-center gap-1.5 px-2 py-1 bg-blue-500/20 border border-blue-500/30 rounded-lg"
              >
                <Loader2 className={cn("w-4 h-4 text-blue-500", motionAllowed && "animate-spin")} aria-hidden="true" />
                <span className="text-xs text-blue-600 dark:text-blue-400">
                  {t.audioLoading || 'Loading...'}
                </span>
              </motion.div>
            )}
            {audioStatus.state === 'blocked' && selectedSoundId && (
              <motion.button
                key="blocked"
                type="button"
                initial={motionAllowed ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                exit={motionAllowed ? { opacity: 0, scale: 0.8 } : undefined}
                className="flex items-center gap-1.5 px-2 py-1 bg-amber-500/20 border border-amber-500/30 rounded-lg cursor-pointer min-h-[44px]"
                onClick={() => selectedSoundId && !audioMuted && onPlaySound(selectedSoundId)}
              >
                <AlertCircle className="w-4 h-4 text-amber-500" />
                <span className="text-xs text-amber-600 dark:text-amber-400">
                  {t.audioTapToEnable || 'Tap to enable'}
                </span>
              </motion.button>
            )}
            {audioStatus.state === 'error' && selectedSoundId && (
              <motion.button
                key="error"
                type="button"
                initial={motionAllowed ? { opacity: 0, scale: 0.8 } : false}
                animate={{ opacity: 1, scale: 1 }}
                exit={motionAllowed ? { opacity: 0, scale: 0.8 } : undefined}
                className="flex items-center gap-1.5 px-2 py-1 bg-red-500/20 border border-red-500/30 rounded-lg cursor-pointer min-h-[44px]"
                onClick={() => selectedSoundId && !audioMuted && onPlaySound(selectedSoundId)}
              >
                <RotateCcw className="w-4 h-4 text-red-500" />
                <span className="text-xs text-red-600 dark:text-red-400">
                  {t.audioRetry || 'Retry'}
                </span>
              </motion.button>
            )}
          </AnimatePresence>

          {selectedSoundId && audioStatus.state !== 'loading' && (
            <motion.button
              onClick={onToggleSound}
              disabled={audioMuted}
              aria-label={isSoundPlaying ? t.muteSound : t.unmuteSound}
              className={cn(
                "p-2.5 min-w-[44px] min-h-[44px] rounded-xl motion-safe:transition-all flex items-center justify-center",
                isSoundPlaying
                  ? "bg-violet-500/30 border border-violet-500/50"
                  : "bg-secondary border border-border",
                audioMuted && "cursor-not-allowed opacity-55"
              )}
              whileTap={motionAllowed ? zenTap.button : undefined}
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
      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-7">
        {/* None button */}
        <motion.button
          onClick={() => onSoundSelect(null)}
          aria-pressed={!selectedSoundId}
          className={cn(
            'h-auto min-h-[52px] min-w-0 whitespace-normal px-2 py-3 rounded-xl text-xs font-medium motion-safe:transition-all flex flex-col items-center justify-center gap-1',
            !selectedSoundId
              ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
              : 'bg-secondary border border-border text-slate-600 dark:text-white/70 hover:bg-secondary/80'
          )}
          style={!selectedSoundId ? {
            boxShadow: '0 0 12px hsl(var(--focus-violet) / 0.3)'
          } : {}}
          whileHover={motionAllowed ? { scale: 1.03 } : undefined}
          whileTap={motionAllowed ? zenTap.card : undefined}
        >
          <VolumeX className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="break-words text-center">{t.hyperfocusSoundNone}</span>
        </motion.button>

        {/* All available sounds */}
        {HYPERFOCUS_AUDIO_FAMILIES.map((family) => {
          const sound = SOUNDS.find((candidate) => candidate.id === family.legacyId);
          const isSelected = activeFamily?.id === family.id;
          const { Icon } = soundMeta[family.id];
          const localizedName = t[family.labelKey] || sound?.nameEn || family.id;

          return (
            <motion.button
              key={family.id}
              onClick={() => onSoundSelect(getHyperfocusVariantId(family.id, 'deep'))}
              aria-pressed={isSelected}
              className={cn(
                'h-auto min-h-[52px] min-w-0 whitespace-normal px-2 py-3 rounded-xl text-xs font-medium motion-safe:transition-all flex flex-col items-center justify-center gap-1',
                isSelected
                  ? 'bg-gradient-to-br from-violet-500/40 to-purple-600/40 border border-violet-500/50 text-violet-700 dark:text-white'
                  : 'bg-secondary border border-border text-slate-600 dark:text-white/70 hover:bg-secondary/80'
              )}
              style={isSelected ? {
                boxShadow: '0 0 12px hsl(var(--focus-violet) / 0.3)'
              } : {}}
              whileHover={motionAllowed ? { scale: 1.03 } : undefined}
              whileTap={motionAllowed ? zenTap.card : undefined}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="break-words text-center">{localizedName}</span>
            </motion.button>
          );
        })}
      </div>

      {activeFamily && (
        <div className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3" role="group" aria-label={t.hyperfocusSoundIntensity || 'Sound intensity'}>
          {activeFamily.levels.map((level) => {
            const isSelected = activeLevelId === level.id;
            const localizedLevelName = t[level.labelKey] || level.label;

            return (
              <motion.button
                key={level.id}
                type="button"
                onClick={() => onSoundSelect(level.variantId)}
                aria-pressed={isSelected}
                className={cn(
                  'h-auto min-h-[44px] min-w-0 whitespace-normal break-words px-2 py-2 rounded-xl text-xs font-medium motion-safe:transition-all flex items-center justify-center text-center',
                  isSelected
                    ? 'bg-violet-500/30 border border-violet-500/50 text-violet-700 dark:text-violet-100'
                    : 'bg-secondary border border-border text-slate-600 dark:text-white/70 hover:bg-secondary/80'
                )}
                whileTap={motionAllowed ? zenTap.button : undefined}
              >
                {localizedLevelName}
              </motion.button>
            );
          })}
        </div>
      )}
    </div>
  );
}
