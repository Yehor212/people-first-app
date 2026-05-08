import { PremiumLoader } from "@/components/PremiumLoader";
import { cn } from "@/lib/utils";

interface RecoveryOrbitProps {
  className?: string;
  label?: string;
}

export function RecoveryOrbit({ className, label = "ZenFlow recovery" }: RecoveryOrbitProps) {
  return (
    <div
      className={cn("zf-recovery-orbit relative flex h-32 w-32 items-center justify-center", className)}
      role="presentation"
      aria-hidden="true"
      data-testid="recovery-orbit"
    >
      <span className="zf-recovery-orbit__halo" />
      <span className="zf-recovery-orbit__scan" />
      <span className="zf-recovery-orbit__satellite zf-recovery-orbit__satellite--one" />
      <span className="zf-recovery-orbit__satellite zf-recovery-orbit__satellite--two" />
      <span className="zf-recovery-orbit__satellite zf-recovery-orbit__satellite--three" />
      <svg viewBox="0 0 120 120" className="relative z-[2] h-24 w-24" aria-hidden="true">
        <defs>
          <radialGradient id="recovery-glow" cx="50%" cy="50%" r="52%">
            <stop offset="0%" stopColor="hsl(var(--zf-role-body))" stopOpacity="0.95" />
            <stop offset="48%" stopColor="hsl(var(--zf-role-focus))" stopOpacity="0.42" />
            <stop offset="100%" stopColor="hsl(var(--zf-role-mind))" stopOpacity="0" />
          </radialGradient>
          <linearGradient id="recovery-thread" x1="0" x2="1" y1="0" y2="1">
            <stop offset="0%" stopColor="hsl(var(--zf-role-body))" />
            <stop offset="48%" stopColor="hsl(var(--zf-role-focus))" />
            <stop offset="100%" stopColor="hsl(var(--zf-role-mind))" />
          </linearGradient>
        </defs>
        <circle cx="60" cy="60" r="50" fill="url(#recovery-glow)" opacity="0.82" />
        <circle
          className="zf-recovery-orbit__ring"
          cx="60"
          cy="60"
          r="38"
          fill="hsl(var(--zf-night-0))"
          opacity="0.76"
          stroke="url(#recovery-thread)"
          strokeWidth="2"
        />
      </svg>
      <span className="zf-recovery-orbit__core" aria-hidden="true" />
      <div className="zf-recovery-orbit__loader" data-testid="recovery-infinity-loader">
        <PremiumLoader size="md" label={label} />
      </div>
    </div>
  );
}
