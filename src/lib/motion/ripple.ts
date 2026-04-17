/**
 * Ripple verb — tap acknowledge.
 *
 * Radial CSS expand from the touch point + haptic tap on native. 200ms linear,
 * finite (no loop). Spawns a transient span, removes on animationend.
 *
 * Uses CSS `@keyframes zen-ripple` (defined in verbs.css) — no JS frame tween,
 * so the browser schedules on the compositor thread (Law 8: 60fps).
 */

import { hapticTap } from '@/lib/haptics';

export interface RippleOptions {
  /** Diameter in px. Default: max(target.clientWidth, target.clientHeight) * 2. */
  size?: number;
  /** Relative coordinates inside the target (clientX - rect.left). */
  x: number;
  y: number;
  /** Override per-call class for theme integration. */
  className?: string;
}

/**
 * Spawn a ripple wave inside `target`. Auto-removes when the CSS animation
 * ends (or after a 400ms safety timer if the animationend event is missed).
 *
 * @returns a cleanup function — callers can cancel early (e.g. unmount).
 */
export function createRipple(target: HTMLElement, opts: RippleOptions): () => void {
  if (typeof document === 'undefined' || !target || !target.isConnected) {
    return () => undefined;
  }

  const rect = target.getBoundingClientRect();
  const size = opts.size ?? Math.max(rect.width, rect.height) * 2;
  const wave = document.createElement('span');
  wave.className = opts.className ?? 'zen-ripple-wave';
  wave.style.width = `${size}px`;
  wave.style.height = `${size}px`;
  wave.style.left = `${opts.x - size / 2}px`;
  wave.style.top = `${opts.y - size / 2}px`;

  // Fire-and-forget haptic; guarded internally by canTriggerHaptics().
  void hapticTap();

  target.appendChild(wave);

  let cancelled = false;
  const cleanup = (): void => {
    if (cancelled) return;
    cancelled = true;
    if (wave.parentNode === target) {
      target.removeChild(wave);
    }
  };

  wave.addEventListener('animationend', cleanup, { once: true });
  // Safety net if animationend is suppressed (e.g. target removed mid-flight).
  const timerId = window.setTimeout(cleanup, 400);

  return () => {
    window.clearTimeout(timerId);
    cleanup();
  };
}

/** Ripple duration in ms — sync with CSS @keyframes in verbs.css. */
export const RIPPLE_DURATION_MS = 200;

/** Class consumers may swap in for theme variants (e.g. dark ripple). */
export const RIPPLE_WAVE_CLASS = 'zen-ripple-wave';
