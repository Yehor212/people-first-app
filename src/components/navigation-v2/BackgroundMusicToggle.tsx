import { LoaderCircle, Volume2, VolumeX } from "lucide-react";
import { useRef } from "react";
import { useLanguage } from "@/contexts/LanguageContext";
import { useAppAudioSettings } from "@/hooks/useAppAudioSettings";
import { useAudioComfortSettings } from "@/hooks/useAudioComfortSettings";
import { cn } from "@/lib/utils";
import { useAppBackgroundMusicControl } from "./AppBackgroundMusicProvider";

export type BackgroundMusicTogglePresentation =
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
  const isRetry = music.state === "blocked" || music.state === "error";
  const actionLabel = isRetry
    ? tx.backgroundMusicPlayAction || "Play evening music"
    : music.enabled
      ? tx.backgroundMusicPauseAction || "Pause evening music"
      : tx.backgroundMusicPlayAction || "Play evening music";

  const statusLabel = (() => {
    if (music.state === "playing") return tx.backgroundMusicStateOn || "On";
    if (music.state === "loading") return tx.backgroundMusicStateLoading || "Loading";
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
      return (
        tx.backgroundMusicPausedComfort || "Paused while background sounds are off"
      );
    }
    if (music.state === "paused" && music.enabled) {
      return tx.backgroundMusicPausedOtherSound || "Paused while another sound plays";
    }
    return tx.backgroundMusicStateOff || "Off";
  })();

  const Icon =
    music.state === "loading"
      ? LoaderCircle
      : music.state === "playing"
        ? Volume2
        : VolumeX;
  const collapsed = presentation === "sidebar-collapsed";
  const drawer = presentation === "drawer";
  const showDisableControl = isRetry && music.enabled;
  const primaryControlRef = useRef<HTMLButtonElement>(null);

  const primaryControl = (
    <button
      ref={primaryControlRef}
      type="button"
      data-app-background-music-control="true"
      data-testid="background-music-toggle"
      data-presentation={presentation}
      data-playback-state={music.state}
      aria-label={actionLabel}
      aria-pressed={music.enabled}
      aria-busy={music.state === "loading" ? "true" : undefined}
      title={collapsed ? title : undefined}
      onClick={isRetry ? music.retry : music.toggle}
      className={cn(
        "group flex items-center rounded-[8px] border text-start",
        "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
        "motion-safe:transition-[transform,background-color,border-color,box-shadow,color] motion-safe:duration-200 motion-safe:ease-out",
        "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] active:shadow-none",
        drawer
          ? "min-h-[48px] gap-3 border-[hsl(var(--nav-v2-drawer-border)/0.24)] bg-[hsl(var(--nav-v2-item-surface)/0.52)] px-3.5 py-2.5 text-[hsl(var(--nav-v2-drawer-muted))] shadow-[0_8px_18px_-16px_hsl(var(--nav-v2-shadow)/0.38)] hover:bg-[hsl(var(--nav-v2-item-hover)/0.82)] hover:text-[hsl(var(--nav-v2-drawer-text))]"
          : "min-h-[44px] gap-2 border-border/40 bg-muted/25 px-3 py-2 text-muted-foreground hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)] hover:text-foreground",
        collapsed && "justify-center px-2",
        showDisableControl
          ? collapsed
            ? "w-full"
            : "min-w-0 flex-1"
          : "w-full",
        music.state === "playing" &&
          "border-primary/35 bg-primary/10 text-foreground",
      )}
    >
      <span
        aria-hidden="true"
        className={cn(
          "flex shrink-0 items-center justify-center rounded-[8px] ring-1",
          drawer ? "h-11 w-11" : "h-9 w-9",
          music.state === "playing"
            ? "bg-primary/14 text-primary ring-primary/30"
            : "bg-muted/45 text-muted-foreground ring-border/40",
        )}
      >
        <Icon
          className={cn(
            "h-5 w-5",
            music.state === "loading" && "motion-safe:animate-spin",
          )}
        />
      </span>
      {collapsed ? (
        <span className="sr-only">{`${title}: ${statusLabel}`}</span>
      ) : (
        <span className="min-w-0 flex-1">
          <span className="block whitespace-normal break-words font-display text-sm font-medium leading-snug [overflow-wrap:break-word]">
            {title}
          </span>
          <span className="mt-0.5 block whitespace-normal break-words text-xs leading-snug text-current opacity-75 [overflow-wrap:break-word]">
            {statusLabel}
          </span>
        </span>
      )}
    </button>
  );

  return (
    <div className={cn("flex w-full gap-1", collapsed ? "flex-col" : "items-stretch")}>
      {primaryControl}
      {showDisableControl && (
        <button
          type="button"
          data-app-background-music-control="true"
          data-testid="background-music-disable"
          aria-label={tx.backgroundMusicPauseAction || "Pause evening music"}
          title={tx.backgroundMusicPauseAction || "Pause evening music"}
          onClick={() => {
            music.toggle();
            primaryControlRef.current?.focus();
          }}
          className={cn(
            "flex shrink-0 items-center justify-center rounded-[8px] border border-border/40 bg-muted/25 text-muted-foreground",
            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary focus-visible:ring-offset-2",
            "motion-safe:transition-[transform,background-color,border-color,color] motion-safe:duration-200 motion-safe:ease-out",
            "motion-safe:hover:-translate-y-0.5 motion-safe:active:translate-y-[1px] hover:bg-[hsl(var(--nav-v2-item-hover)/0.72)] hover:text-foreground",
            drawer ? "min-h-[48px] min-w-[48px]" : "min-h-[44px] min-w-[44px]",
            collapsed && "w-full",
          )}
        >
          <VolumeX aria-hidden="true" className="h-5 w-5" />
        </button>
      )}
    </div>
  );
}
