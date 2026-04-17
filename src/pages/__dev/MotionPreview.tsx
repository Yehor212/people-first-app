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
  staggerDelay,
  withTransitionName,
} from '@/lib/motion';
import {
  DialogMotion,
  DialogMotionContent,
  DialogMotionDescription,
  DialogMotionTitle,
} from '@/components/ui/DialogMotion';
import {
  SheetMotion,
  SheetMotionContent,
  SheetMotionDescription,
  SheetMotionTitle,
} from '@/components/ui/SheetMotion';
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
  const [tabDemo, setTabDemo] = useState<'home' | 'stats' | 'settings'>('home');
  const [cardOpen, setCardOpen] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);
  const [sheetOpen, setSheetOpen] = useState(false);
  const rippleRef = useRef<HTMLButtonElement>(null);

  const handleTabDemo = async (next: 'home' | 'stats' | 'settings') => {
    await morph(`tab-demo-${next}`, () => {
      setTabDemo(next);
    });
  };

  const handleCardTap = async () => {
    await morph('motion-preview-card', () => {
      setCardOpen((o) => !o);
    });
  };

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

      <section className="motion-preview-rollout max-w-[1200px] mx-auto mt-12">
        <h2 className="text-2xl font-display mb-4">Phase 2-A rollout — real-world demos</h2>
        <div className="motion-preview-grid grid gap-6 md:grid-cols-2">
          <div className="motion-preview-card">
            <h3 className="motion-preview-card-title">Tab switch (Index.tsx)</h3>
            <p className="motion-preview-spec">Morph + Bloom at primary stage (140ms)</p>
            <div className="motion-preview-tab-bar">
              {(['home', 'stats', 'settings'] as const).map((tab) => (
                <button
                  key={tab}
                  type="button"
                  onClick={() => handleTabDemo(tab)}
                  className="motion-preview-btn"
                  data-active={tabDemo === tab}
                >
                  {tab}
                </button>
              ))}
            </div>
            <Bloom
              key={tabDemo}
              className="motion-preview-panel"
              transition={staggerDelay('primary')}
            >
              <p>Active tab: {tabDemo}</p>
            </Bloom>
          </div>

          <div className="motion-preview-card">
            <h3 className="motion-preview-card-title">Journal shared element</h3>
            <p className="motion-preview-spec">morph() + view-transition-name</p>
            <button
              type="button"
              onClick={handleCardTap}
              className="motion-preview-card-tap"
              style={withTransitionName('motion-preview-journal-card')}
            >
              {cardOpen ? 'Close entry' : 'Tap card'}
            </button>
            {cardOpen && (
              <div
                className="motion-preview-panel"
                style={withTransitionName('motion-preview-journal-card')}
              >
                <p>Expanded editor view.</p>
              </div>
            )}
          </div>

          <div className="motion-preview-card">
            <h3 className="motion-preview-card-title">DialogMotion</h3>
            <p className="motion-preview-spec">Bloom open · Fold close</p>
            <button
              type="button"
              onClick={() => setDialogOpen(true)}
              className="motion-preview-btn"
            >
              Open DialogMotion
            </button>
            <DialogMotion open={dialogOpen} onOpenChange={setDialogOpen}>
              <DialogMotionContent>
                <DialogMotionTitle>DialogMotion demo</DialogMotionTitle>
                <DialogMotionDescription>
                  Bloom on enter, Fold on exit.
                </DialogMotionDescription>
              </DialogMotionContent>
            </DialogMotion>
          </div>

          <div className="motion-preview-card">
            <h3 className="motion-preview-card-title">SheetMotion</h3>
            <p className="motion-preview-spec">Bloom from edge · Fold to edge</p>
            <button
              type="button"
              onClick={() => setSheetOpen(true)}
              className="motion-preview-btn"
            >
              Open SheetMotion
            </button>
            <SheetMotion open={sheetOpen} onOpenChange={setSheetOpen}>
              <SheetMotionContent side="right">
                <SheetMotionTitle>SheetMotion demo</SheetMotionTitle>
                <SheetMotionDescription>
                  Slides from the end edge with Bloom.
                </SheetMotionDescription>
              </SheetMotionContent>
            </SheetMotion>
          </div>
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
