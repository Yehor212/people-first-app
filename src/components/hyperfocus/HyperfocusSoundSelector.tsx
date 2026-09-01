/**
 * HyperfocusSoundSelector — ambient sound picker with status indicators.
 */

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
} from "lucide-react";
import { SOUNDS, type AudioStatus, type ToneFilterStatus } from "@/lib/ambientSounds";
import {
  HYPERFOCUS_AUDIO_FAMILIES,
  getHyperfocusAudioFamily,
  getHyperfocusVariantId,
  parseHyperfocusVariantId,
  type HyperfocusAudioFamilyId,
} from "@/lib/hyperfocusAudioCatalog";
import { formatHyperfocusToneKhz } from "@/lib/hyperfocusTone";
import { cn } from "@/lib/utils";

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
  toneCutoffKhz: number;
  toneFilterStatus: ToneFilterStatus;
  onToneCutoffChange: (cutoffKhz: number) => boolean;
  audioMuted?: boolean;
  t: Record<string, string>;
}

const selectorButtonClass =
  "flex h-auto min-h-[52px] min-w-0 flex-col items-center justify-center gap-1 whitespace-normal rounded-xl border px-2 py-3 text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors";

export function HyperfocusSoundSelector({
  selectedSoundId,
  isSoundPlaying,
  audioStatus,
  onSoundSelect,
  onToggleSound,
  onPlaySound,
  toneCutoffKhz,
  toneFilterStatus,
  onToneCutoffChange,
  audioMuted = false,
  t,
}: HyperfocusSoundSelectorProps) {
  const selectedVariant = selectedSoundId ? parseHyperfocusVariantId(selectedSoundId) : null;
  const activeFamily = selectedVariant
    ? getHyperfocusAudioFamily(selectedVariant.familyId)
    : undefined;
  const activeLevelId = selectedVariant?.levelId;

  return (
    <section className="mx-auto w-full max-w-sm sm:max-w-md lg:max-w-3xl">
      <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
        <span className="text-sm font-medium text-muted-foreground">
          {t.hyperfocusAmbientSound}
        </span>

        <div className="flex items-center gap-2">
          {audioStatus.state === "loading" && selectedSoundId && (
            <div
              role="status"
              aria-live="polite"
              aria-atomic="true"
              className="flex items-center gap-1.5 text-muted-foreground"
            >
              <Loader2 className="h-4 w-4 text-primary motion-safe:animate-spin" aria-hidden="true" />
              <span className="text-xs">{t.audioLoading || "Loading..."}</span>
            </div>
          )}
          {audioStatus.state === "blocked" && selectedSoundId && (
            <button
              type="button"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-border bg-secondary px-2 py-1 text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors"
              onClick={() => !audioMuted && onPlaySound(selectedSoundId)}
            >
              <AlertCircle className="h-4 w-4 text-primary" aria-hidden="true" />
              <span className="text-xs">{t.audioTapToEnable || "Tap to enable"}</span>
            </button>
          )}
          {audioStatus.state === "error" && selectedSoundId && (
            <button
              type="button"
              className="flex min-h-11 items-center gap-1.5 rounded-lg border border-destructive/40 bg-destructive/10 px-2 py-1 text-destructive hover:bg-destructive/15 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors"
              onClick={() => !audioMuted && onPlaySound(selectedSoundId)}
            >
              <RotateCcw className="h-4 w-4" aria-hidden="true" />
              <span className="text-xs">{t.audioRetry || "Retry"}</span>
            </button>
          )}
          {selectedSoundId && audioStatus.state !== "loading" && (
            <button
              type="button"
              onClick={onToggleSound}
              disabled={audioMuted}
              aria-label={isSoundPlaying ? t.muteSound : t.unmuteSound}
              className={cn(
                "flex min-h-11 min-w-11 items-center justify-center rounded-xl border p-2.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
                isSoundPlaying
                  ? "border-primary bg-primary/10 text-primary"
                  : "border-border bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
                audioMuted && "cursor-not-allowed opacity-55",
              )}
            >
              {isSoundPlaying ? (
                <Volume2 className="h-5 w-5" aria-hidden="true" />
              ) : (
                <VolumeX className="h-5 w-5" aria-hidden="true" />
              )}
            </button>
          )}
        </div>
      </div>

      <div className="grid grid-cols-1 gap-2 min-[420px]:grid-cols-2 lg:grid-cols-7">
        <button
          type="button"
          onClick={() => onSoundSelect(null)}
          aria-pressed={!selectedSoundId}
          className={cn(
            selectorButtonClass,
            !selectedSoundId
              ? "border-primary bg-primary/10 text-foreground"
              : "border-border bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
          )}
        >
          <VolumeX className="h-5 w-5 shrink-0" aria-hidden="true" />
          <span className="break-words text-center">{t.hyperfocusSoundNone}</span>
        </button>

        {HYPERFOCUS_AUDIO_FAMILIES.map((family) => {
          const sound = SOUNDS.find((candidate) => candidate.id === family.legacyId);
          const isSelected = activeFamily?.id === family.id;
          const { Icon } = soundMeta[family.id];
          const localizedName = t[family.labelKey] || sound?.nameEn || family.id;
          return (
            <button
              key={family.id}
              type="button"
              onClick={() => onSoundSelect(getHyperfocusVariantId(family.id, "deep"))}
              aria-pressed={isSelected}
              className={cn(
                selectorButtonClass,
                isSelected
                  ? "border-primary bg-primary/10 text-foreground"
                  : "border-border bg-secondary text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              <Icon className="h-5 w-5 shrink-0" aria-hidden="true" />
              <span className="break-words text-center">{localizedName}</span>
            </button>
          );
        })}
      </div>

      {activeFamily && (
        <>
          <div
            className="mt-3 grid grid-cols-1 gap-2 min-[420px]:grid-cols-3 rounded-xl bg-muted p-1"
            role="group"
            aria-label={t.hyperfocusSoundIntensity || "Sound intensity"}
          >
            {activeFamily.levels.map((level) => {
              const isSelected = activeLevelId === level.id;
              const familyLevelKey = `${activeFamily.labelKey}${level.id[0].toUpperCase()}${level.id.slice(1)}`;
              return (
                <button
                  key={level.id}
                  type="button"
                  onClick={() => onSoundSelect(level.variantId)}
                  aria-pressed={isSelected}
                  className={cn(
                    "flex min-h-[44px] min-w-0 items-center justify-center rounded-lg px-2 py-2 text-center text-xs font-medium focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
                    isSelected
                      ? "bg-background text-foreground"
                      : "bg-transparent text-muted-foreground hover:bg-background/60 hover:text-foreground",
                  )}
                >
                  {t[familyLevelKey] || t[level.labelKey] || level.label}
                </button>
              );
            })}
          </div>

          <div className="mt-3 rounded-xl border border-border bg-card p-3 text-start">
            <div className="flex items-baseline justify-between gap-3">
              <label htmlFor="hyperfocus-tone-cutoff" className="text-xs font-semibold text-foreground">
                {t.hyperfocusToneLabel || "Tone"}
              </label>
              <span className="shrink-0 text-xs font-bold tabular-nums text-primary">
                {formatHyperfocusToneKhz(toneCutoffKhz)}
              </span>
            </div>
            <p id="hyperfocus-tone-help" className="mt-1 text-[11px] leading-relaxed text-muted-foreground">
              {t.hyperfocusToneHelp || "High-frequency cutoff; pitch and speed stay unchanged."}
            </p>
            <input
              id="hyperfocus-tone-cutoff"
              type="range"
              min="3"
              max="16"
              step="0.5"
              value={toneCutoffKhz}
              onChange={(event) => onToneCutoffChange(Number(event.currentTarget.value))}
              aria-label={t.hyperfocusToneLabel || "Tone"}
              aria-valuetext={formatHyperfocusToneKhz(toneCutoffKhz)}
              aria-describedby="hyperfocus-tone-help"
              className="h-11 w-full cursor-pointer accent-primary"
            />
            <div className="-mt-1 flex justify-between gap-4 text-[10px] text-muted-foreground">
              <span>{t.hyperfocusToneSofter || "Softer"} · 3 kHz</span>
              <span className="text-end">{t.hyperfocusToneFullSpectrum || "Full spectrum"} · 16 kHz</span>
            </div>
            {toneFilterStatus.state === "degraded" && (
              <p className="mt-2 text-[11px] text-destructive" role="status">
                {t.hyperfocusToneUnavailable || "Tone control is unavailable on this device."}
              </p>
            )}
          </div>
        </>
      )}
    </section>
  );
}
