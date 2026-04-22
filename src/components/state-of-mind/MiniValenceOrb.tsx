import { memo, useEffect, useState } from "react";

import { cn } from "@/lib/utils";

import { ValenceOrb } from "./ValenceOrb";

interface MiniValenceOrbProps {
  valence: number;
  hasEntry: boolean;
  containerClassName?: string;
  orbClassName?: string;
}

/**
 * Decorative compact orb used in previews and empty states.
 */
export const MiniValenceOrb = memo(function MiniValenceOrb({
  valence,
  hasEntry,
  containerClassName,
  orbClassName,
}: MiniValenceOrbProps) {
  const [oscillatedValence, setOscillatedValence] = useState(0);

  useEffect(() => {
    if (hasEntry) {
      setOscillatedValence(0);
      return;
    }

    let frame = 0;
    const id = setInterval(() => {
      frame += 1;
      setOscillatedValence(Math.sin(frame * 0.1) * 0.4);
    }, 200);

    return () => clearInterval(id);
  }, [hasEntry]);

  const displayValence = hasEntry ? valence : oscillatedValence;

  return (
    <div
      aria-hidden="true"
      className={cn("relative h-12 w-12 flex-shrink-0 pointer-events-none", containerClassName)}
    >
      <div
        className={cn(
          "absolute left-1/2 top-1/2 h-[120px] w-[120px] -translate-x-1/2 -translate-y-1/2 scale-[0.4] brightness-75",
          orbClassName,
        )}
      >
        <ValenceOrb valence={displayValence} size={120} />
      </div>
    </div>
  );
});
