/**
 * Legacy-named primary entry marker for FocusTimer.
 */

import { Focus } from "lucide-react";

interface CosmicBackgroundProps {
  startHereLabel: string;
}

export function CosmicBackground({ startHereLabel }: CosmicBackgroundProps) {
  return (
    <div className="relative mb-4 flex items-center justify-center gap-2 text-primary">
      <Focus className="h-4 w-4" aria-hidden="true" />
      <span className="text-sm font-semibold">{startHereLabel}</span>
    </div>
  );
}
