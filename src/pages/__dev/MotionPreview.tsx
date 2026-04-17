/**
 * MotionPreview — Phase 1 dev-only showcase of the six motion verbs.
 *
 * Gated by `import.meta.env.DEV` so this entire page dead-code-eliminates
 * in production bundles. Each verb is individually triggerable with a live
 * spec readout; one section shows all six together for quick comparison.
 *
 * Uses sibling `MotionPreview.css` — zero inline `style={}` (ratchet
 * discipline: inlineStyles floor).
 */

import { useState, useRef, type PointerEvent } from 'react';
import { AnimatePresence, motion } from 'framer-motion';
import { Bloom, Fold, Breathe } from '@/lib/motion';
import {
  bloom,
  fold,
  breathe,
  settle,
  morph,
  morphTiming,
  createRipple,
  easings,
  withTransitionName,
} from '@/lib/motion';
import './MotionPreview.css';

const VERB_SPECS = [
  { name: 'Bloom', duration: '320ms', ease: 'cubic-bezier(0.2, 0.9, 0.2, 1)', trigger: 'open/appear/reveal' },
  { name: 'Fold', duration: '240ms', ease: 'cubic-bezier(0.4, 0, 1, 1)', trigger: 'close/dismiss/hide' },
  { name: 'Morph', duration: '420ms', ease: 'cubic-bezier(0.19, 1, 0.22, 1)', trigger: 'shared element' },
  { name: 'Settle', duration: '~300ms spring', ease: 'stiffness:200 damping:24', trigger: 'drag release' },
  { name: 'Breathe', duration: '4s loop', ease: 'cubic-bezier(0.4, 0, 0.6, 1)', trigger: 'idle pulse' },
  { name: 'Ripple', duration: '200ms', ease: 'linear', trigger: 'tap acknowledge' },
] as const;

export default function MotionPreview() {
  const [bloomOpen, setBloomOpen] = useState(true);
  const [foldOpen, setFoldOpen] = useState(true);
  const [morphedA, setMorphedA] = useState(true);
  const [settlePos, setSettlePos] = useState<'left' | 'right'>('left');
  const rippleRef = useRef<HTMLButtonElement>(null);

  if (!import.meta.env.DEV) return null;

  const handleRipple = (e: PointerEvent<HTMLButtonElement>) => {
    if (!rippleRef.current) return;
    const rect = rippleRef.current.getBoundingClientRect();
    createRipple(rippleRef.current, {
      x: e.clientX - rect.left,
      y: e.clientY - rect.top,
    });
  };

  const handleMorph = async () => {
    await morph('motion-preview-morph', () => {
      setMorphedA((prev) => !prev);
    });
  };

  return (
    <div className="motion-preview-root min-h-screen p-8 bg-background">
      <header className="motion-preview-header max-w-4xl mx-auto mb-8">
        <h1 className="text-4xl font-display mb-2">ZenFlow Motion Verbs</h1>
        <p className="text-muted-foreground mb-4">
          Phase 1 — Six semantic motion verbs. Dev-only preview; not shipped.
        </p>
      </header>

      <section className="motion-preview-grid max-w-[1200px] mx-auto grid gap-6 md:grid-cols-2">
        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Bloom</h2>
          <p className="motion-preview-spec">{`duration: ${bloom.transition.duration * 1000}ms · ease: ${easings.bloomOut.join(', ')}`}</p>
          <button
            type="button"
            onClick={() => setBloomOpen((v) => !v)}
            className="motion-preview-btn"
          >
            Toggle Bloom
          </button>
          <AnimatePresence>
            {bloomOpen && (
              <Bloom className="motion-preview-panel">
                <p>I blossomed in.</p>
              </Bloom>
            )}
          </AnimatePresence>
        </div>

        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Fold</h2>
          <p className="motion-preview-spec">{`duration: ${fold.transition.duration * 1000}ms · ease: ${easings.foldIn.join(', ')}`}</p>
          <button
            type="button"
            onClick={() => setFoldOpen((v) => !v)}
            className="motion-preview-btn"
          >
            Toggle Fold
          </button>
          <AnimatePresence>
            {foldOpen && (
              <Fold className="motion-preview-panel">
                <p>I fold away.</p>
              </Fold>
            )}
          </AnimatePresence>
        </div>

        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Morph (View Transitions)</h2>
          <p className="motion-preview-spec">{`duration: ${morphTiming.durationMs}ms · expo ease-out`}</p>
          <button
            type="button"
            onClick={handleMorph}
            className="motion-preview-btn"
          >
            Morph
          </button>
          <div className="motion-preview-morph-stage">
            {morphedA ? (
              <div className="motion-preview-morph-a" style={withTransitionName('motion-preview-morph-shape')}>A</div>
            ) : (
              <div className="motion-preview-morph-b" style={withTransitionName('motion-preview-morph-shape')}>B</div>
            )}
          </div>
        </div>

        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Settle (spring)</h2>
          <p className="motion-preview-spec">{`stiffness: ${settle.stiffness} · damping: ${settle.damping} · mass: ${settle.mass}`}</p>
          <button
            type="button"
            onClick={() => setSettlePos((p) => (p === 'left' ? 'right' : 'left'))}
            className="motion-preview-btn"
          >
            Toggle position
          </button>
          <div className="motion-preview-settle-track">
            <motion.div
              className="motion-preview-settle-dot"
              layout
              transition={settle}
              data-pos={settlePos}
            />
          </div>
        </div>

        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Breathe</h2>
          <p className="motion-preview-spec">{`${breathe.transition.duration}s · infinite · idle pulse`}</p>
          <Breathe className="motion-preview-breathe-dot" />
        </div>

        <div className="motion-preview-card">
          <h2 className="motion-preview-card-title">Ripple</h2>
          <p className="motion-preview-spec">200ms · linear · tap acknowledge</p>
          <button
            ref={rippleRef}
            type="button"
            onPointerDown={handleRipple}
            className="motion-preview-ripple-btn"
          >
            Tap me
          </button>
        </div>
      </section>

      <section className="motion-preview-spec-table max-w-[1200px] mx-auto mt-12">
        <h2 className="text-2xl font-display mb-4">Verb specifications</h2>
        <table className="motion-preview-table">
          <thead>
            <tr>
              <th>Verb</th>
              <th>Trigger</th>
              <th>Duration</th>
              <th>Easing</th>
            </tr>
          </thead>
          <tbody>
            {VERB_SPECS.map((spec) => (
              <tr key={spec.name}>
                <td className="motion-preview-verb-cell">{spec.name}</td>
                <td>{spec.trigger}</td>
                <td>{spec.duration}</td>
                <td className="motion-preview-mono-cell">{spec.ease}</td>
              </tr>
            ))}
          </tbody>
        </table>
      </section>
    </div>
  );
}
