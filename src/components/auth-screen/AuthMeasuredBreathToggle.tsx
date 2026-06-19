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
      className="entry-action-tile btn-press mx-auto flex min-h-[48px] w-full max-w-sm items-center justify-center gap-3 rounded-2xl border border-border/50 bg-background/35 px-4 py-3 text-sm font-semibold text-foreground shadow-lg transition-all hover:bg-background/45 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/40 disabled:cursor-not-allowed disabled:opacity-55"
    >
      {isPlaying ? (
        <Volume2 className="h-5 w-5 text-primary" aria-hidden="true" />
      ) : (
        <VolumeX className="h-5 w-5 text-muted-foreground" aria-hidden="true" />
      )}
      <span className="min-w-0 truncate">{label}</span>
      <span className="rounded-full border border-border/50 px-2 py-0.5 text-xs font-medium text-muted-foreground">
        {statusLabel}
      </span>
    </button>
  );
}
