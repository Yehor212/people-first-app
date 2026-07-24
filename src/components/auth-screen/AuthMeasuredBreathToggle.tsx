import { Volume2, VolumeX } from "lucide-react";

interface AuthMeasuredBreathToggleProps {
  isPlaying: boolean;
  isMuted: boolean;
  label: string;
  statusLabel: string;
  toggleLabel: string;
  onToggle: () => void;
}

export function AuthMeasuredBreathToggle({
  isPlaying,
  isMuted,
  label,
  statusLabel,
  toggleLabel,
  onToggle,
}: AuthMeasuredBreathToggleProps) {
  return (
    <button
      type="button"
      data-testid="auth-measured-breath-toggle"
      aria-label={toggleLabel}
      aria-pressed={isPlaying}
      title={toggleLabel}
      onClick={onToggle}
      disabled={isMuted}
      className="entry-action-tile btn-press mx-auto grid min-h-[48px] w-full max-w-sm grid-cols-[auto_minmax(0,1fr)] items-center gap-x-3 gap-y-2 rounded-2xl border border-border/50 bg-background/35 px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-all hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-55 min-[420px]:grid-cols-[auto_minmax(0,1fr)_auto]"
    >
      {isPlaying ? (
        <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
      ) : (
        <VolumeX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 whitespace-normal break-words text-start [hyphens:auto] [overflow-wrap:break-word]">
        {label}
      </span>
      <span className="col-start-2 min-w-0 max-w-full justify-self-start whitespace-normal break-words rounded-full border border-border/50 px-2 py-0.5 text-xs font-medium text-muted-foreground [hyphens:auto] [overflow-wrap:break-word] min-[420px]:col-start-3 min-[420px]:row-start-1 min-[420px]:justify-self-auto">
        {statusLabel}
      </span>
    </button>
  );
}
