/**
 * HeroDailyRing — sticky daily-progress ring + identity prompt.
 *
 * Composes two ideas grounded in research:
 *   - Streaks-style at-a-glance ring (Apple Design Award 2016) — high-density
 *     progress signal that survives glances under 200ms.
 *   - Atoms by James Clear — "identity-based habits" (you ARE the kind of
 *     person who…). The line above the ring rotates daily and grounds the
 *     numbers in meaning, not just metrics.
 *
 * Pure presentational component. No store access. Sticky positioning is
 * controlled by the parent zone via `className` (Component Isolation, Law 15).
 */

import { memo, useMemo } from "react";
import { useShouldAnimate } from "@/hooks/useShouldAnimate";
import { useLanguage } from "@/contexts/LanguageContext";

interface HeroDailyRingProps {
  completed: number;
  total: number;
  ratio: number;
}

const RING_SIZE = 96;
const RING_STROKE = 8;
const RING_RADIUS = (RING_SIZE - RING_STROKE) / 2;
const RING_CIRCUMFERENCE = 2 * Math.PI * RING_RADIUS;

export const HeroDailyRing = memo(function HeroDailyRing({
  completed,
  total,
  ratio,
}: HeroDailyRingProps) {
  const { t } = useLanguage();
  const tx = t;
  const animate = useShouldAnimate();

  const dashOffset = useMemo(
    () => RING_CIRCUMFERENCE * (1 - Math.max(0, Math.min(1, ratio))),
    [ratio],
  );

  const isAllDone = total > 0 && completed >= total;
  const remaining = Math.max(0, total - completed);

  const remainingLabel = useMemo(() => {
    if (total === 0) return tx.navV2HabitsKeepGoing ?? "";
    if (isAllDone) return tx.navV2HabitsAllDone ?? "";
    if (remaining === 1) return tx.navV2HabitsOneHabitLeft ?? "";
    return (tx.navV2HabitsHabitsLeft ?? "{count} habits left").replace(
      "{count}",
      String(remaining),
    );
  }, [tx, total, isAllDone, remaining]);

  const ringSrLabel = `${completed} / ${total}`;

  return (
    <div
      className="flex items-center gap-4"
      data-testid="hero-daily-ring"
    >
      <div
        className="relative shrink-0"
        style={{ width: RING_SIZE, height: RING_SIZE }}
        role="img"
        aria-live="polite"
        aria-label={`${tx.navV2HabitsHero ?? "Today's habits"}: ${ringSrLabel}`}
        data-testid="habits-hero-progress-ring"
      >
        <svg
          width={RING_SIZE}
          height={RING_SIZE}
          viewBox={`0 0 ${RING_SIZE} ${RING_SIZE}`}
          aria-hidden="true"
          className="-rotate-90"
        >
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            className="fill-none stroke-muted"
          />
          <circle
            cx={RING_SIZE / 2}
            cy={RING_SIZE / 2}
            r={RING_RADIUS}
            strokeWidth={RING_STROKE}
            strokeLinecap="round"
            strokeDasharray={RING_CIRCUMFERENCE}
            strokeDashoffset={dashOffset}
            className={
              isAllDone
                ? "fill-none stroke-emerald-500"
                : "fill-none stroke-primary"
            }
            style={
              animate
                ? { transition: "stroke-dashoffset 600ms cubic-bezier(0.22,1,0.36,1)" }
                : undefined
            }
          />
        </svg>
        <span
          className="absolute inset-0 flex flex-col items-center justify-center font-display text-foreground"
          aria-hidden="true"
        >
          <span className="text-lg font-bold leading-none tabular-nums">{completed}</span>
          <span className="mt-0.5 text-xs font-medium uppercase tracking-wider text-muted-foreground">
            / {total}
          </span>
        </span>
      </div>
      <div className="flex min-w-0 flex-col">
        <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
          {tx.navV2HabitsHero}
        </span>
        <span
          key={isAllDone ? "done" : "progress"}
          className={
            "mt-1 font-display text-base font-semibold leading-tight text-foreground" +
            (animate && isAllDone
              ? " motion-safe:animate-fraunces-soft-wobble"
              : "")
          }
          data-testid="hero-daily-ring-status"
        >
          {remainingLabel}
        </span>
      </div>
    </div>
  );
});
