/**
 * CanvasFAB — Bottom-right controls pill for the Mind Map Canvas.
 *
 * Controls only: recenter, zoom in, zoom out.
 * Mood + Task quick actions are now on-canvas interactions (AuxPills).
 */

import { Crosshair, ZoomIn, ZoomOut } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface CanvasFABProps {
  onRecenter: () => void;
  onZoomIn: () => void;
  onZoomOut: () => void;
}

export function CanvasFAB({ onRecenter, onZoomIn, onZoomOut }: CanvasFABProps) {
  return (
    <div
      className="fixed z-50 flex flex-col items-center"
      style={{
        bottom: 'calc(env(safe-area-inset-bottom, 0px) + 1.5rem)',
        right: '1rem',
      }}
    >
      {/* Canvas controls pill */}
      <div className={cn(
        'flex flex-col items-center gap-1 py-1.5 px-1.5',
        'bg-white/5 backdrop-blur-md',
        'border border-white/10',
        'rounded-full',
      )}>
        <button
          onClick={() => { void haptics.buttonPress(); onRecenter(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Recenter"
        >
          <Crosshair className="w-4 h-4 text-white/50" />
        </button>
        <button
          onClick={() => { void haptics.buttonPress(); onZoomIn(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Zoom in"
        >
          <ZoomIn className="w-4 h-4 text-white/50" />
        </button>
        <button
          onClick={() => { void haptics.buttonPress(); onZoomOut(); }}
          className="w-10 h-10 rounded-full flex items-center justify-center hover:bg-white/10 transition-colors"
          aria-label="Zoom out"
        >
          <ZoomOut className="w-4 h-4 text-white/50" />
        </button>
      </div>
    </div>
  );
}
