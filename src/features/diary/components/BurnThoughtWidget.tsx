/**
 * BurnThoughtWidget — Interactive "burn a worry" widget.
 *
 * Renders as an overlay at the placeholder's position.
 * Reads initial state from widgetStates sidecar.
 * On "Burn": Canvas fire particle animation → marks burned in sidecar.
 * Memory-safe: rAF cleaned up on unmount.
 */

import { useState, useRef, useCallback, useEffect } from 'react';
import { Flame, X } from 'lucide-react';
import { motion } from 'framer-motion';
import { zenMotion, shouldAnimate } from '@/lib/animationUtils';
import type { WidgetState } from '../types';

interface BurnThoughtWidgetProps {
  widgetId: string;
  initialState: Extract<WidgetState, { type: 'burn' }> | undefined;
  position: { top: number; left: number; width: number };
  onStateChange: (id: string, state: WidgetState) => void;
  onClose: () => void;
}

// ── Fire particle system ──

interface FireParticle {
  x: number; y: number;
  vx: number; vy: number;
  life: number; maxLife: number;
  size: number;
  hue: number; // 0-40 for orange/red
}

function initFireParticles(w: number, h: number): FireParticle[] {
  return Array.from({ length: 60 }, () => ({
    x: w * 0.3 + Math.random() * w * 0.4,
    y: h * 0.8 + Math.random() * h * 0.2,
    vx: (Math.random() - 0.5) * 2,
    vy: -1.5 - Math.random() * 3,
    life: 1,
    maxLife: 0.6 + Math.random() * 0.4,
    size: 3 + Math.random() * 5,
    hue: Math.random() * 40,
  }));
}

export function BurnThoughtWidget({
  widgetId, initialState, position, onStateChange, onClose,
}: BurnThoughtWidgetProps) {
  const [text, setText] = useState(initialState?.text || '');
  const [burned, setBurned] = useState(initialState?.burned || false);
  const [burning, setBurning] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const rafRef = useRef(0);

  // ── Fire animation ──

  const startBurn = useCallback(() => {
    if (!text.trim() || burning) return;

    // Reduced motion: skip fire animation, mark burned immediately
    if (!shouldAnimate()) {
      setBurned(true);
      onStateChange(widgetId, { type: 'burn', text, burned: true });
      return;
    }

    setBurning(true);

    const canvas = canvasRef.current;
    if (!canvas) return;

    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;
    const particles = initFireParticles(w, h);
    const startTime = performance.now();
    const DURATION = 2000;

    function frame(now: number) {
      if (!ctx) return;
      const elapsed = now - startTime;
      const progress = Math.min(1, elapsed / DURATION);

      ctx.clearRect(0, 0, w, h);

      for (const p of particles) {
        p.x += p.vx;
        p.y += p.vy;
        p.vy -= 0.02; // accelerate upward
        p.life = Math.max(0, 1 - (elapsed / DURATION) * (1 / p.maxLife));

        if (p.life <= 0) continue;

        ctx.globalAlpha = p.life * 0.8;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fillStyle = `hsl(${p.hue}, 100%, ${50 + p.life * 30}%)`;
        ctx.fill();
      }
      ctx.globalAlpha = 1;

      if (progress < 1) {
        rafRef.current = requestAnimationFrame(frame);
      } else {
        setBurned(true);
        setBurning(false);
        onStateChange(widgetId, { type: 'burn', text, burned: true });
      }
    }

    rafRef.current = requestAnimationFrame(frame);
  }, [text, burning, widgetId, onStateChange]);

  // ── Cleanup rAF ──
  useEffect(() => {
    return () => cancelAnimationFrame(rafRef.current);
  }, []);

  // ── Sync text changes to sidecar ──
  const handleTextChange = useCallback((value: string) => {
    setText(value);
    onStateChange(widgetId, { type: 'burn', text: value, burned: false });
  }, [widgetId, onStateChange]);

  return (
    <motion.div
      className="absolute rounded-xl overflow-hidden"
      style={{
        top: position.top,
        left: position.left,
        width: position.width,
        minHeight: 140,
        backgroundColor: 'color-mix(in srgb, var(--diary-bg) 95%, transparent)',
        border: '1px solid var(--diary-border)',
        pointerEvents: 'auto',
        zIndex: 10,
      }}
      initial={{ opacity: 0, scale: 0.95 }}
      animate={{ opacity: 1, scale: 1 }}
      transition={zenMotion.gentle}
    >
      {/* Header */}
      <div className="flex items-center justify-between px-3 py-2">
        <div className="flex items-center gap-2" style={{ color: 'var(--diary-accent)' }}>
          <Flame className="w-4 h-4" />
          <span className="text-sm font-medium">
            {burned ? 'Released' : 'Burn a thought'}
          </span>
        </div>
        <button
          onClick={onClose}
          className="w-7 h-7 flex items-center justify-center rounded-full"
          style={{ color: 'var(--diary-muted)' }}
          aria-label="Close widget"
        >
          <X className="w-3.5 h-3.5" />
        </button>
      </div>

      {/* Body */}
      <div className="relative px-3 pb-3">
        {burned ? (
          <p className="text-sm py-4 text-center" style={{ color: 'var(--diary-muted)' }}>
            Your thought has been released.
          </p>
        ) : burning ? (
          <canvas
            ref={canvasRef}
            width={280}
            height={120}
            className="w-full rounded-lg"
            aria-hidden="true"
          />
        ) : (
          <>
            <textarea
              value={text}
              onChange={(e) => handleTextChange(e.target.value)}
              placeholder="Write what worries you..."
              className="w-full rounded-lg px-3 py-2 text-sm outline-none resize-none"
              style={{
                backgroundColor: 'color-mix(in srgb, var(--diary-accent) 5%, transparent)',
                color: 'var(--diary-text)',
                border: '1px solid var(--diary-border)',
                minHeight: 60,
              }}
              rows={2}
            />
            <button
              onClick={startBurn}
              disabled={!text.trim()}
              className="mt-2 w-full py-2 rounded-lg text-sm font-medium transition-colors flex items-center justify-center gap-2 min-h-[44px]"
              style={{
                backgroundColor: text.trim() ? 'var(--diary-accent)' : 'var(--diary-border)',
                color: text.trim() ? '#fff' : 'var(--diary-muted)',
              }}
            >
              <Flame className="w-4 h-4" />
              Burn it
            </button>
          </>
        )}
      </div>
    </motion.div>
  );
}
