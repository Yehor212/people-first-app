/**
 * HyperfocusMode — fullscreen focus timer orchestrator
 * Decomposed from the original 1,012-line monolith (TD-20).
 * This file: ~280L, 0 useState, delegates state to 4 custom hooks.
 */

import { useEffect, useMemo, useRef } from "react";
import { motion } from "framer-motion";
import { X, Play, Pause, Shield, Music, Leaf } from "lucide-react";
import { isNative } from "@/lib/platform";
import { useLanguage } from "@/contexts/LanguageContext";
import { useModalA11y } from "@/hooks/useModalA11y";
import { useScrollLock } from "@/hooks/useScrollLock";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import {
  requestDndPolicyAccess,
  checkPolicyAccess,
  checkDndActive,
  setDndEnabled,
} from "@/hooks/useDnd";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";

import { SHOW_DND, SHOW_SPOTIFY } from "./types";
import type { HyperfocusModeProps } from "./types";
import { useHyperfocusTimer } from "./useHyperfocusTimer";
import { useHyperfocusAudio } from "./useHyperfocusAudio";
import { useHyperfocusDnd } from "./useHyperfocusDnd";
import { useHyperfocusSpotify } from "./useHyperfocusSpotify";
import { HyperfocusTimerDisplay } from "./HyperfocusTimerDisplay";
import { HyperfocusSoundSelector } from "./HyperfocusSoundSelector";

export function HyperfocusMode({ duration, onComplete, onExit }: HyperfocusModeProps) {
  const { t } = useLanguage();
  const motionAllowed = useShouldAnimate({ respectRuntimePerformance: false });

  useScrollLock(true);

  useEffect(() => {
    const html = document.documentElement;
    const previousOverflow = html.style.overflow;
    const previousBackgroundColor = html.style.backgroundColor;
    const previousScrollbarGutter = html.style.getPropertyValue("scrollbar-gutter");

    html.style.overflow = "hidden";
    html.style.backgroundColor = "hsl(var(--focus-cosmic-deep))";
    html.style.setProperty("scrollbar-gutter", "auto");

    return () => {
      html.style.overflow = previousOverflow;
      html.style.backgroundColor = previousBackgroundColor;
      if (previousScrollbarGutter) {
        html.style.setProperty("scrollbar-gutter", previousScrollbarGutter);
      } else {
        html.style.removeProperty("scrollbar-gutter");
      }
    };
  }, []);

  // --- Hooks ---
  const timer = useHyperfocusTimer({ duration, onComplete });
  const audio = useHyperfocusAudio({ isRunning: timer.isRunning, isPaused: timer.isPaused });
  const dnd = useHyperfocusDnd();
  const spotify = useHyperfocusSpotify({ isRunning: timer.isRunning, isPaused: timer.isPaused });
  const dndPermissionOpenerRef = useRef<HTMLButtonElement>(null);
  const hyperfocusA11y = useModalA11y(true, onExit);
  const dndPermissionA11y = useModalA11y(
    dnd.showDndPermission,
    () => dnd.setShowDndPermission(false),
    dndPermissionOpenerRef
  );

  // Keep urgency legible without introducing a multicolor progress treatment.
  const progressColor = useMemo(() => {
    const color = timer.progress >= 90 ? "hsl(var(--destructive))" : "hsl(var(--primary))";
    return { from: color, to: color };
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
    <div
      {...hyperfocusA11y.modalProps}
      data-hyperfocus-theme="night"
      aria-label={t.hyperfocusMode}
      className="dark fixed inset-y-0 left-0 z-[110] min-h-[var(--app-viewport-height)] w-screen max-w-none overflow-hidden bg-[hsl(var(--focus-cosmic-deep))] text-[hsl(var(--zf-text-strong))]"
      style={{ colorScheme: "dark" }}
    >
      {/* Close Button */}
      <Button
        type="button"
        variant="secondary"
        size="icon-lg"
        onClick={onExit}
        className="fixed end-4 top-4 z-[110] rounded-xl"
        style={{
          top: "max(1rem, calc(var(--safe-top) + 0.75rem))",
          insetInlineEnd: "max(1rem, calc(var(--safe-inline-end) + 0.75rem))",
        }}
        aria-label={t.close}
      >
        <X className="w-6 h-6" />
      </Button>

      {/* Scrollable content layer */}
      <div className="absolute inset-0 z-20 overflow-y-auto overscroll-contain scrollbar-hide">
        <div className="min-h-[var(--app-viewport-height)] flex flex-col items-center justify-center text-center px-6 pt-[calc(var(--safe-top)_+_4.75rem)] pb-[calc(var(--safe-bottom)_+_2rem)] lg:px-12">
          <HyperfocusTimerDisplay
            formattedTime={timer.formattedTime}
            timeLeft={timer.timeLeft}
            progress={timer.progress}
            progressColor={progressColor}
            isRunning={timer.isRunning}
            isPaused={timer.isPaused}
            t={tRecord}
          />

          <div className="mb-8 flex flex-wrap items-center justify-center gap-4 lg:mb-12 lg:gap-6">
            {!timer.isRunning ? (
              <Button
                type="button"
                variant="default"
                size="xl"
                onClick={handleStart}
                className="min-h-14 rounded-2xl text-lg"
              >
                <Play className="h-5 w-5" aria-hidden="true" />
                {t.hyperfocusStart}
              </Button>
            ) : (
              <Button
                type="button"
                variant="secondary"
                size="xl"
                onClick={handlePause}
                className="min-h-14 rounded-2xl text-lg"
              >
                {timer.isPaused ? (
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
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="xl"
              onClick={onExit}
              className="min-h-14 rounded-2xl"
            >
              {t.hyperfocusExit}
            </Button>
          </div>

          {/* Phone Focus Mode — DND toggle (Android only) */}
          {SHOW_DND && isNative && (
            <div className="w-full max-w-sm sm:max-w-md lg:max-w-lg mx-auto mb-4">
              <button
                type="button"
                ref={dndPermissionOpenerRef}
                onClick={() => void dnd.handleDndToggle()}
                className={cn(
                  "flex min-h-[52px] w-full items-center justify-between rounded-2xl border px-4 py-3 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring motion-safe:transition-colors",
                  dnd.dndEnabled
                    ? "border-primary bg-primary/10"
                    : "border-border bg-secondary hover:bg-muted"
                )}
                aria-label={t.focusModeToggle || "Phone Focus Mode"}
                aria-checked={dnd.dndEnabled}
                role="switch"
              >
                <div className="flex items-center gap-3">
                  <Shield
                    className={cn(
                      "h-5 w-5",
                      dnd.dndEnabled ? "text-primary" : "text-muted-foreground"
                    )}
                    aria-hidden="true"
                  />
                  <div className="text-start">
                    <span className="text-sm font-medium text-foreground">
                      {t.focusModeToggle || "Phone Focus Mode"}
                    </span>
                    {dnd.dndEnabled && (
                      <p className="text-xs text-primary">
                        {t.focusModeEnabled || "Focus mode on — distractions silenced"}
                      </p>
                    )}
                    {dnd.dndError && !dnd.dndEnabled && (
                      <p
                        className="text-xs text-destructive"
                        role="status"
                        aria-live="polite"
                      >
                        {t.focusModeError || "Could not enable focus mode"}
                      </p>
                    )}
                  </div>
                </div>
                <div
                  className={cn(
                    "w-11 h-6 rounded-full motion-safe:transition-colors flex-shrink-0",
                    dnd.dndEnabled ? "bg-primary" : "bg-muted"
                  )}
                >
                  <motion.div
                    className="mt-0.5 h-5 w-5 rounded-full bg-background"
                    animate={{ marginInlineStart: dnd.dndEnabled ? "22px" : "2px" }}
                    transition={motionAllowed ? { type: "spring", stiffness: 300, damping: 25 } : { duration: 0 }}
                  />
                </div>
              </button>
            </div>
          )}

          {/* DND Permission Modal */}
          {SHOW_DND && dnd.showDndPermission && (
            <div
              {...dndPermissionA11y.modalProps}
              className="fixed inset-0 z-[110] flex items-center justify-center bg-background/80 p-6"
              aria-labelledby="hyperfocus-dnd-permission-title"
              onKeyDown={(event) => {
                dndPermissionA11y.handleKeyDown(event);
                event.stopPropagation();
              }}
              onClick={() => dnd.setShowDndPermission(false)}
            >
              <motion.div
                className="w-full max-w-sm rounded-2xl border border-border bg-card p-6"
                initial={motionAllowed ? { scale: 0.9, opacity: 0 } : false}
                animate={{ scale: 1, opacity: 1 }}
                onClick={(e) => e.stopPropagation()}
              >
                <div className="flex items-center gap-3 mb-4">
                  <Shield className="h-6 w-6 text-primary" aria-hidden="true" />
                  <h3 id="hyperfocus-dnd-permission-title" className="text-lg font-bold text-foreground">
                    {t.focusModePermTitle || "Enable Focus Mode"}
                  </h3>
                </div>
                <p className="text-sm text-muted-foreground mb-6">
                  {t.focusModePermDesc ||
                    "ZenFlow needs permission to silence notifications during focus sessions."}
                </p>
                <div className="flex gap-3">
                  <Button
                    type="button"
                    variant="secondary"
                    onClick={() => dnd.setShowDndPermission(false)}
                    className="flex-1"
                  >
                    {t.cancel || "Cancel"}
                  </Button>
                  <Button
                    type="button"
                    variant="default"
                    onClick={() => void handleOpenDndSettings()}
                    className="flex-1"
                  >
                    {t.focusModeOpenSettings || "Open Settings"}
                  </Button>
                </div>
                {dnd.dndSettingsError && (
                  <p
                    className="mt-3 text-center text-xs text-destructive"
                    role="status"
                    aria-live="polite"
                  >
                    {t.focusModeSettingsError ||
                      "Could not open settings. Go to Settings → Apps → ZenFlow → Notifications."}
                  </p>
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
            toneCutoffKhz={audio.toneCutoffKhz}
            toneFilterStatus={audio.toneFilterStatus}
            onToneCutoffChange={audio.setToneCutoffKhz}
            audioMuted={audio.audioMuted}
            t={tRecord}
          />

          {/* Spotify Section */}
          {SHOW_SPOTIFY && (
            <div className="mx-auto mt-4 w-full max-w-sm rounded-2xl border border-border bg-card p-4 sm:max-w-md lg:max-w-lg">
              <div className="mb-3 flex flex-wrap items-start justify-between gap-2">
                <div className="flex items-center gap-2">
                  <Music className="w-4 h-4 text-[hsl(var(--brand-spotify))]" />
                  <p className="text-sm font-medium text-muted-foreground">Spotify</p>
                </div>
                {spotify.spotifyConnected && (
                  <Button
                    type="button"
                    variant={spotify.spotifyAutoPlay ? "soft" : "secondary"}
                    size="sm"
                    onClick={() => spotify.setSpotifyAutoPlay(!spotify.spotifyAutoPlay)}
                    className="min-w-0"
                  >
                    {spotify.spotifyAutoPlay ? t.spotifyAutoPlayOn : t.spotifyAutoPlayOff}
                  </Button>
                )}
              </div>
              {spotify.spotifyTrack ? (
                <div className="flex flex-col items-stretch gap-3 p-3 min-[420px]:flex-row min-[420px]:items-center">
                  {spotify.spotifyTrack.albumArt && (
                    <img
                      src={spotify.spotifyTrack.albumArt}
                      alt=""
                      width={48}
                      height={48}
                      loading="lazy"
                      className="h-12 w-12 rounded-lg"
                    />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="break-words text-sm font-medium text-foreground [overflow-wrap:anywhere]">
                      {spotify.spotifyTrack.name}
                    </p>
                    <p className="break-words text-xs text-muted-foreground [overflow-wrap:anywhere]">
                      {spotify.spotifyTrack.artist}
                    </p>
                  </div>
                </div>
              ) : (
                <p className="py-2 text-center text-xs text-muted-foreground">
                  {t.spotifyNoTrack}
                </p>
              )}
            </div>
          )}

          {/* Premium Tips */}
          {!timer.isRunning && (
            <motion.div
              className="mt-8 hidden max-w-sm sm:max-w-md lg:max-w-lg mx-auto [@media(min-height:980px)]:block"
              initial={motionAllowed ? { opacity: 0, y: 10 } : false}
              animate={{ opacity: 1, y: 0 }}
              transition={motionAllowed ? { delay: 0.3 } : { duration: 0 }}
            >
              <div className="border-t border-border pt-4">
                <div className="flex items-center gap-2 mb-2">
                  <Leaf className="h-4 w-4 text-[hsl(var(--zf-primary))]" aria-hidden="true" />
                  <p className="text-xs font-medium text-muted-foreground">
                    {t.hyperfocusTip}
                  </p>
                </div>
                <p className="text-sm text-foreground">{t.hyperfocusTipText}</p>
              </div>
            </motion.div>
          )}
        </div>
      </div>
    </div>
  );
}
