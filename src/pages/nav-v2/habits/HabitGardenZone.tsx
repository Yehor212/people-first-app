/**
 * HabitGardenZone — Phase 3-C zone 2.
 *
 * Adapter that wraps the V1 {@link GardenCanvas} without modifying it.
 * Pulls the inner-world state via {@link useInnerWorld} and computes a default
 * atmosphere — the canvas itself owns its visual logic.
 *
 * Wraps the canvas in a `<section>` landmark with an aria-labelled heading so
 * screen readers can navigate to it via the in-page table of contents.
 */

import { memo } from "react";
import { GardenCanvas } from "@/components/GardenCanvas";
import { useInnerWorld } from "@/hooks/useInnerWorld";
import { useLanguage } from "@/contexts/LanguageContext";
import type { GardenAtmosphere } from "@/lib/gardenAtmosphere";

interface HabitGardenZoneProps {
  /** Override the computed atmosphere — useful for previews and tests. */
  atmosphere?: GardenAtmosphere;
}

export const HabitGardenZone = memo(function HabitGardenZone({
  atmosphere = "default",
}: HabitGardenZoneProps) {
  const { t } = useLanguage();
  const tx = t as unknown as Record<string, string>;
  const { world, isLoading } = useInnerWorld();

  return (
    <section
      aria-labelledby="habits-garden-heading"
      data-testid="habits-garden-zone"
      className="px-4 py-8 md:px-6 md:py-12"
    >
      <h2
        id="habits-garden-heading"
        className="mb-4 font-display text-xl font-semibold tracking-tight text-foreground"
      >
        {tx.navV2HabitsGarden}
      </h2>
      {isLoading ? (
        <div
          className="min-h-[280px] motion-safe:animate-pulse rounded-xl bg-muted/40"
          aria-hidden="true"
          data-testid="habits-garden-skeleton"
        />
      ) : (
        <GardenCanvas world={world} atmosphere={atmosphere} />
      )}
    </section>
  );
});
