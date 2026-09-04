import { LoaderCircle, Volume1, Volume2, VolumeX } from "lucide-react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { cn } from "@/lib/utils";
import { useAppBackgroundMusicControl } from "./AppBackgroundMusicProvider";

export type BackgroundMusicTogglePresentation =
  | "auth"
  | "sidebar-expanded"
  | "sidebar-collapsed"
  | "drawer";

export function BackgroundMusicToggle({
  presentation,
}: {
  presentation: BackgroundMusicTogglePresentation;
}) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const music = useAppBackgroundMusicControl();
  const appAudio = useAppAudioSettings();
  const comfort = useAudioComfortSettings();
  const title = tx.backgroundMusicTitle || "Evening music";
  const actionLabel = music.enabled
    ? tx.backgroundMusicPauseAction || "Pause evening music"
    : tx.backgroundMusicPlayAction || "Play evening music";

  const statusLabel = (() => {
    if (music.state === "playing" || music.state === "fading") {
      return tx.backgroundMusicStateOn || "On";
    }
    if (music.state === "loading" || music.state === "recovering") {
      return tx.backgroundMusicStateLoading || "Loading";
    }
    if (music.state === "blocked") {
      return tx.backgroundMusicStateBlocked || "Tap to resume";
    }
    if (music.state === "error") {
      return tx.backgroundMusicStateUnavailable || "Unavailable";
    }
    if (music.state === "paused" && (appAudio.muted || appAudio.volume <= 0)) {
      return tx.backgroundMusicPausedMaster || "Paused while app sound is off";
    }
    if (music.state === "paused" && !comfort.settings.ambientEnabled) {
      return tx.backgroundMusicPausedComfort || "Paused while background sounds are off";
    }
    if (music.state === "paused" && music.enabled) {
      return tx.backgroundMusicPausedOtherSound || "Paused while another sound plays";
    }
    return tx.backgroundMusicStateOff || "Off";
  })();

  const isBusy = music.state === "loading" || music.state === "recovering";
  const Icon = isBusy
    ? LoaderCircle
    : music.state === "playing" || music.state === "fading"
      ? Volume2
      : music.state === "blocked" || music.state === "error"
        ? Volume1
        : VolumeX;
  const isPhoneSurface = presentation === "auth" || presentation === "drawer";

  return (
    <button
      type="button"
      data-app-background-music-control="true"
      data-testid="background-music-toggle"
      data-presentation={presentation}
      data-playback-state={music.state}
      aria-label={actionLabel}
      aria-pressed={music.enabled}
      aria-busy={isBusy ? "true" : undefined}
      onClick={music.toggle}
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center rounded-[8px] border",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
        isPhoneSurface
          ? "h-12 w-12 min-h-[48px] min-w-[48px]"
          : "h-11 w-11 min-h-[44px] min-w-[44px]",
        presentation === "auth" &&
          "entry-action-tile btn-press mx-auto border-border/50 bg-background/35 text-foreground shadow-lg hover:bg-background/45",
        presentation === "drawer" &&
          "mx-auto border-[hsl(var(--nav-v2-drawer-border)/0.3)] bg-[hsl(var(--nav-v2-item-surface)/0.58)] text-[hsl(var(--nav-v2-drawer-muted))] shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))]",
        presentation.startsWith("sidebar") &&
          "mx-auto border-border/40 bg-muted/25 text-muted-foreground hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)] hover:text-foreground",
        music.state === "playing" && "border-primary/35 bg-primary/10 text-primary",
        music.state === "fading" && "border-primary/25 bg-primary/5 text-primary",
        (music.state === "blocked" || music.state === "error") &&
          "border-border/60 bg-muted/35 text-foreground",
      )}
    >
      <Icon
        aria-hidden="true"
        className={cn("h-5 w-5", isBusy && "motion-safe:animate-spin")}
      />
      <span className="sr-only">{`${title}: ${statusLabel}`}</span>
    </button>
  );
}
