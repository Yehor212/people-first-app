/**
 * ValenceOrb — GPU-accelerated orb for State of Mind valence step.
 *
 * Progressive enhancement (Law 22 — probe highest tier first):
 *   WebGL 2.0 available → GLSL 300 es shader (10/10 quality, 60fps capable)
 *   WebGL 1.0 available → GLSL ES 1.0 shader (10/10 quality, 60fps capable)
 *   Neither available → Canvas 2D fallback (8/10 quality, 30fps)
 *
 * Both paths share the same particle system, shape presets, and color mapping.
 * Context loss recovery: seamless WebGL → Canvas 2D → WebGL on restore.
 *
 * Law 12 (Performance): 30fps RAF, IntersectionObserver pause, DPR cap at 2x.
 * Law 18 (Cleanup): mounted guard, RAF cancel, observer disconnect, GL dispose, listener removal.
 * Dopamine gate: shouldAnimate() → static frame if disabled.
 *
 * Canvas management: canvases are created programmatically (not via JSX ref) to allow
 * replacing a WebGL-locked canvas with a fresh one for Canvas 2D fallback.
 * Per HTML spec, once getContext('webgl2') succeeds, the same canvas cannot provide
 * a '2d' context — a new <canvas> element is the only solution.
 */

import { useRef, useEffect, useState, memo } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { recordError } from '@/lib/crashReporting';
import { hapticTap } from '@/lib/haptics';
import { hapticMedium } from '@/lib/haptics';
import { safeSessionStorageGet, safeSessionStorageSet } from '@/lib/safeJson';
import { SSK } from '@/lib/storageKeys';
import { createParticlePool, updateParticles, burstParticles } from './particleSystem';
import { drawOrbScene, getShapeParams } from './orbRenderer';
import { valenceToHSL } from './colorUtils';
import { createOrbGL2Async, createOrbGLAsync } from './orbShader';
import type { Particle } from './particleSystem';
import type { OrbGLBuildResult, OrbGLRenderer } from './orbShader';

// Module-level: genesis plays only once per browser session
let genesisPlayed = false;

interface ValenceOrbProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height) */
  size?: number;
  /** Multiplier for the orb's ambient rotation/noise time; valence interpolation stays unchanged. */
  animationSpeed?: number;
  /** Controls how the orb settles into a new mood state. */
  transitionProfile?: OrbTransitionProfile;
  /** Renderer policy. Auto paints Canvas first, then upgrades to WebGL without blocking first paint. */
  renderer?: OrbRendererMode;
}

type OrbWorkerPayload = {
  valence: number;
  time: number;
  size: number;
  dpr: number;
  isDark: boolean;
  color: { h: number; s: number; l: number };
  shape: ReturnType<typeof getShapeParams>;
  particles: Particle[];
  genesis: number;
  touch: { x: number; y: number; age: number };
  shimmer: number;
};

type OrbWorkerController = {
  render: (payload: OrbWorkerPayload) => void;
  dispose: () => void;
};

const WEBGL_FRAME_INTERVAL = 1000 / 60; // 60fps for WebGL (shader is <1ms)
const CANVAS_FRAME_INTERVAL = 1000 / 30; // 30fps for Canvas 2D fallback
const PARTICLE_COUNT = 22;
export const CANONICAL_ORB_ANIMATION_SPEED = 0.72;
const WEBGL_BUILD_BUDGET_MS = 500;
export const WEBGL_WORKER_READY_BUDGET_MS = 700;
const WEBGL_READINESS_TIMEOUT_MS = 8000;
const WEBGL_UPGRADE_DELAY_MS = 180;
const IDLE_WAKE_SOFT_THRESHOLD_MS = 8000;
const ORB_IDLE_WAKE_SOFT_EPSILON = 0.01;

export type OrbTransitionProfile = "standard" | "v1-soft" | "input-soft";
export type OrbRendererMode = "auto" | "canvas" | "webgl";

interface OrbTransitionSettings {
  targetBaseLerp: number;
  shimmerBaseLerp: number;
  visualBaseLerp: number;
  tailDistance: number;
  tailMultiplier: number;
}

export const ORB_TRANSITION_SETTINGS: Record<OrbTransitionProfile, OrbTransitionSettings> = {
  standard: {
    targetBaseLerp: 0.06,
    shimmerBaseLerp: 0.02,
    visualBaseLerp: 0.05,
    tailDistance: 0,
    tailMultiplier: 1,
  },
  "v1-soft": {
    targetBaseLerp: 0.036,
    shimmerBaseLerp: 0.016,
    visualBaseLerp: 0.028,
    tailDistance: 0.22,
    tailMultiplier: 0.46,
  },
  "input-soft": {
    targetBaseLerp: 0.072,
    shimmerBaseLerp: 0.038,
    visualBaseLerp: 0.036,
    tailDistance: 0.18,
    tailMultiplier: 0.58,
  },
};

export function resolveOrbTransitionSettings(
  profile: OrbTransitionProfile,
  distanceToTarget: number,
  shimmerActive = false,
): { targetBaseLerp: number; visualBaseLerp: number } {
  const settings = ORB_TRANSITION_SETTINGS[profile];
  const tailScale =
    settings.tailDistance > 0 && distanceToTarget < settings.tailDistance
      ? settings.tailMultiplier
      : 1;

  return {
    targetBaseLerp: (shimmerActive ? settings.shimmerBaseLerp : settings.targetBaseLerp) * tailScale,
    visualBaseLerp: settings.visualBaseLerp * tailScale,
  };
}

export function shouldStartIdleWakeSoftening(
  profile: OrbTransitionProfile,
  idleElapsedMs: number,
  targetDelta: number,
): boolean {
  return (
    profile === "input-soft" &&
    idleElapsedMs >= IDLE_WAKE_SOFT_THRESHOLD_MS &&
    Math.abs(targetDelta) > ORB_IDLE_WAKE_SOFT_EPSILON
  );
}

export function resolveFrameTransitionProfile(
  profile: OrbTransitionProfile,
  idleWakeSoftActive: boolean,
): OrbTransitionProfile {
  return idleWakeSoftActive && profile === "input-soft" ? "v1-soft" : profile;
}

function frameRateIndependentLerp(baseLerp: number, dt: number, referenceFps: number): number {
  return 1 - Math.pow(1 - baseLerp, dt * referenceFps);
}

/** Probe whether WebGL actually renders (catches WKWebView/in-app browser broken contexts) */
function probeWebGLWorks(): boolean {
  try {
    const c = document.createElement('canvas');
    c.width = 1;
    c.height = 1;
    const gl = c.getContext('webgl2', { preserveDrawingBuffer: true })
            ?? c.getContext('webgl', { preserveDrawingBuffer: true });
    if (!gl) return false;

    // Clear to known color and read back
    gl.clearColor(1, 0, 0, 1);
    gl.clear(gl.COLOR_BUFFER_BIT);
    const pixel = new Uint8Array(4);
    gl.readPixels(0, 0, 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, pixel);

    // Free test context
    gl.getExtension('WEBGL_lose_context')?.loseContext();

    // If WebGL is broken (WKWebView), pixel will be all zeros
    return pixel[0] > 200 && pixel[3] > 200;
  } catch {
    return false;
  }
}

/** Create a fresh canvas element configured for the given size */
function createCanvas(size: number, dpr: number): HTMLCanvasElement {
  const c = document.createElement('canvas');
  c.width = size * dpr;
  c.height = size * dpr;
  c.style.width = `${size}px`;
  c.style.height = `${size}px`;
  c.setAttribute('aria-hidden', 'true');
  return c;
}

function getRendererOverride(): OrbRendererMode | null {
  try {
    const requested = new URLSearchParams(window.location.search).get('orbRenderer');
    if (requested === 'canvas' || requested === 'webgl') return requested;
  } catch {
    // graceful: malformed location should never block the orb
  }

  return null;
}

function shouldTryWebGL(mode: OrbRendererMode): boolean {
  const override = getRendererOverride();
  if (override === 'canvas') return false;
  if (override === 'webgl') return true;
  if (mode === 'canvas') return false;
  if (hasSlowWebGLSession()) return false;
  return true;
}

function rememberSlowWebGL(durationMs: number) {
  safeSessionStorageSet(SSK.ORB_WEBGL_SLOW_MS, Math.round(durationMs));
}

function hasSlowWebGLSession(): boolean {
  const slowMs = safeSessionStorageGet<number | null>(SSK.ORB_WEBGL_SLOW_MS, null);
  return typeof slowMs === 'number' && slowMs >= WEBGL_BUILD_BUDGET_MS;
}

export function shouldApplyWorkerWebGLUpgrade(
  readyDurationMs: number,
  forcedWebGL = false,
): boolean {
  return forcedWebGL || readyDurationMs <= WEBGL_WORKER_READY_BUDGET_MS;
}

function isVisibleCanvasHost(node: HTMLElement): boolean {
  const rect = node.getBoundingClientRect();
  return rect.width > 0 && rect.height > 0;
}

function canUseWorkerWebGL(): boolean {
  try {
    return (
      typeof Worker !== 'undefined' &&
      typeof HTMLCanvasElement !== 'undefined' &&
      'transferControlToOffscreen' in HTMLCanvasElement.prototype &&
      typeof OffscreenCanvas !== 'undefined'
    );
  } catch {
    return false;
  }
}

function scheduleAfterFirstPaint(task: () => void): () => void {
  let cancelled = false;
  let timeoutId = 0;

  const run = () => {
    if (cancelled) return;
    task();
  };

  const requestIdle = window.requestIdleCallback;
  if (requestIdle) {
    const idleId = requestIdle(run, { timeout: WEBGL_UPGRADE_DELAY_MS + 600 });
    return () => {
      cancelled = true;
      window.cancelIdleCallback?.(idleId);
    };
  }

  const rafId = requestAnimationFrame(() => {
    timeoutId = window.setTimeout(run, WEBGL_UPGRADE_DELAY_MS);
  });

  return () => {
    cancelled = true;
    cancelAnimationFrame(rafId);
    window.clearTimeout(timeoutId);
  };
}

export const ValenceOrb = memo(function ValenceOrb({
  valence,
  size = 192,
  animationSpeed = CANONICAL_ORB_ANIMATION_SPEED,
  transitionProfile = "v1-soft",
  renderer = "auto",
}: ValenceOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
  const workerRendererRef = useRef<OrbWorkerController | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [ctxFailed, setCtxFailed] = useState(false);
  const genesisStartRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
  const shimmerRef = useRef(0); // P3: 1.0→0 decaying flash on large valence change
  const prevStableValenceRef = useRef(0); // P3: last settled valence for delta detection
  const lastInteractionRef = useRef(performance.now()); // P4: idle awareness
  const smoothValenceRef = useRef(valence); // P5: smoothed valence for organic color/shape flow
  const targetValenceRef = useRef(valence);
  const idleWakeSoftActiveRef = useRef(false);
  const animationSpeedRef = useRef(animationSpeed);
  animationSpeedRef.current = animationSpeed;
  const transitionProfileRef = useRef<OrbTransitionProfile>(transitionProfile);
  transitionProfileRef.current = transitionProfile;

  // Mutable animation state — avoids React re-renders during animation
  const stateRef = useRef<{
    targetValence: number;
    currentValence: number;
    time: number;
    particles: Particle[];
    lastFrame: number;
  } | null>(null);

  // Keep target valence in sync with prop
  const valenceRef = useRef(valence);
  valenceRef.current = valence;

  useEffect(() => {
    const state = stateRef.current;
    if (!state) {
      targetValenceRef.current = valence;
      return;
    }

    const targetDelta = valence - targetValenceRef.current;
    state.targetValence = valence;

    if (Math.abs(targetDelta) <= ORB_IDLE_WAKE_SOFT_EPSILON) {
      return;
    }

    const now = performance.now();
    const idleElapsedMs = now - lastInteractionRef.current;
    idleWakeSoftActiveRef.current = shouldStartIdleWakeSoftening(
      transitionProfileRef.current,
      idleElapsedMs,
      valence - state.currentValence,
    );
    targetValenceRef.current = valence;
    lastInteractionRef.current = now;
  }, [valence]);

  // Law 18: track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // IntersectionObserver: pause RAF when off-screen
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;
    if (typeof IntersectionObserver === "undefined") return;

    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Main canvas + animation setup
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasDpr = 1;

    // Initialize animation state
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.28;
    const outerR = size * 0.42;

    stateRef.current = {
      targetValence: valenceRef.current,
      currentValence: valenceRef.current,
      time: 0,
      particles: createParticlePool(PARTICLE_COUNT, cx, cy, innerR, outerR),
      lastFrame: 0,
    };

    // Genesis plays once per session — skip on re-mounts (tab switches, etc.)
    if (genesisPlayed) {
      genesisStartRef.current = -10000; // far in past → computeGenesis returns 1.0 instantly
    } else {
      genesisStartRef.current = performance.now();
      genesisPlayed = true;
    }

    const isDarkRead = () => document.documentElement.classList.contains('dark');

    // ── Progressive enhancement with fresh canvas per tier (Law 22) ──
    // Key: each tier gets a fresh canvas to avoid context locking.
    // Per HTML spec, once getContext('webgl2') succeeds, getContext('2d')
    // on the same canvas returns null — a new <canvas> element is required.

    let activeCanvas = createCanvas(size, canvasDpr);
    let glRenderer: OrbGLRenderer | null = null;
    let workerRenderer: OrbWorkerController | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let webglEventCanvas: HTMLCanvasElement | null = null;
    let webglWorker: Worker | null = null;

    // Canvas 2D fallback (always tried if WebGL skipped or failed)
    if (!glRenderer) {
      const c2dCanvas = createCanvas(size, canvasDpr);
      try {
        ctx2d = c2dCanvas.getContext('2d', { willReadFrequently: false });
      } catch (err) {
        recordError(err, { component: 'ValenceOrb', action: 'canvas2d-probe' });
        ctx2d = null;
      }

      if (!ctx2d) {
        setCtxFailed(true);
        return;
      }
      activeCanvas = c2dCanvas;
    }

    if (!activeCanvas) {
      setCtxFailed(true);
      return;
    }

    glRendererRef.current = glRenderer;
    canvasElRef.current = activeCanvas;
    wrapper.appendChild(activeCanvas);
    const visibleCanvasMountedAt = performance.now();

    // ── Genesis easing (ease-out-back with slight overshoot) ──
    const computeGenesis = (timestamp: number): number => {
      const elapsed = (timestamp - genesisStartRef.current) / 1000;
      if (elapsed >= 1.5) return 1.0;
      const t = elapsed / 1.5;
      const c1 = 1.70158;
      const c3 = c1 + 1;
      return Math.max(0, 1 + c3 * Math.pow(t - 1, 3) + c1 * Math.pow(t - 1, 2));
    };

    // ── Touch state ──
    const computeTouch = (time: number): { x: number; y: number; age: number } => {
      const tc = touchRef.current;
      if (!tc) return { x: 0, y: 0, age: 0 };
      const age = time - tc.startTime;
      if (age > 1.5) { touchRef.current = null; return { x: 0, y: 0, age: 0 }; }
      return { x: tc.x, y: tc.y, age };
    };

    // ── Render helpers ──
    const renderGL = (v: number, t: number, particles: Particle[], timestamp = performance.now()) => {
      const gl = glRendererRef.current;
      if (!gl) return;
      // P5: Color breathing — ±2° hue oscillation for organic life
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;
      gl.render({
        valence: v,
        time: t,
        size,
        dpr,
        isDark: isDarkRead(),
        color,
        shape: getShapeParams(v),
        particles,
        genesis: computeGenesis(timestamp),
        touch: computeTouch(t),
        shimmer: shimmerRef.current,
      });
    };

    const createWorkerPayload = (
      v: number,
      t: number,
      particles: Particle[],
      timestamp = performance.now(),
    ): OrbWorkerPayload => {
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;

      return {
        valence: v,
        time: t,
        size,
        dpr,
        isDark: isDarkRead(),
        color,
        shape: getShapeParams(v),
        particles,
        genesis: computeGenesis(timestamp),
        touch: computeTouch(t),
        shimmer: shimmerRef.current,
      };
    };

    const renderWorkerGL = (
      v: number,
      t: number,
      particles: Particle[],
      timestamp = performance.now(),
    ) => {
      workerRenderer?.render(createWorkerPayload(v, t, particles, timestamp));
    };

    const renderCanvas2D = (v: number, t: number, particles: Particle[], _timestamp?: number) => {
      if (!ctx2d) return;
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        particles,
        size,
        dpr: canvasDpr,
        isDark: isDarkRead(),
        shimmer: shimmerRef.current,
      });
    };

    let render = glRenderer ? renderGL : renderCanvas2D;

    // ── Fallback canvas for context loss recovery ──
    let fallbackCanvas: HTMLCanvasElement | null = null;

    /** Degrade to Canvas 2D on a fresh canvas (WebGL canvas is locked) */
    const degradeToCanvas2D = () => {
      fallbackCanvas = createCanvas(size, canvasDpr);
      ctx2d = fallbackCanvas.getContext('2d', { willReadFrequently: false });

      if (ctx2d) {
        activeCanvas.style.display = 'none';
        wrapper.appendChild(fallbackCanvas);
        render = renderCanvas2D;
      }
    };

    // ── Animation loop ──
    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;

      const state = stateRef.current;
      if (!state) return;

      // Runtime dopamine gate
      if (!shouldAnimate()) {
        try { render(state.currentValence, state.time, state.particles); } catch { /* graceful: static frame render failure invisible — orb just stays as-is */ }
        return;
      }

      // Throttle: 60fps for WebGL, 30fps for Canvas 2D
      const frameInterval = glRendererRef.current || workerRenderer
        ? WEBGL_FRAME_INTERVAL
        : CANVAS_FRAME_INTERVAL;
      const elapsed = timestamp - state.lastFrame;
      if (elapsed < frameInterval) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }
      // dt in seconds (clamped to avoid spiral-of-death on tab-switch)
      const dt = Math.min(elapsed / 1000, 0.1);
      state.lastFrame = timestamp;

      // ── P3: Shimmer detection (large valence change from stable state) ──
      const settled = Math.abs(state.targetValence - state.currentValence) < 0.01;
      if (settled) {
        // Check if new target diverges significantly from last stable value
        const delta = Math.abs(state.targetValence - prevStableValenceRef.current);
        if (delta > 0.3 && shimmerRef.current < 0.1) {
          shimmerRef.current = 1.0;
          void hapticMedium(); // tactile punctuation for the transformation
          burstParticles(state.particles, 8, cx, cy, innerR, outerR);
        }
        prevStableValenceRef.current = state.currentValence;
      }

      // Shimmer decay: dt-based exponential (~0.8s half-life, frame-rate independent)
      shimmerRef.current *= Math.pow(0.08, dt); // 0.08^(1/30) ≈ 0.92 per frame at 30fps
      if (shimmerRef.current < 0.005) shimmerRef.current = 0;

      // Soft-tail interpolation: the last part of a mood transition must not
      // snap. V1/V2 and mini-orbs share this profile by default.
      const targetDelta = state.targetValence - state.currentValence;
      const preVisualDelta = state.currentValence - smoothValenceRef.current;
      const transitionDistance = Math.max(Math.abs(targetDelta), Math.abs(preVisualDelta));
      const idleWakeSoftActive =
        idleWakeSoftActiveRef.current &&
        transitionDistance > ORB_IDLE_WAKE_SOFT_EPSILON;
      if (!idleWakeSoftActive && idleWakeSoftActiveRef.current) {
        idleWakeSoftActiveRef.current = false;
      }
      const frameTransitionProfile = resolveFrameTransitionProfile(
        transitionProfileRef.current,
        idleWakeSoftActive,
      );
      const { targetBaseLerp } = resolveOrbTransitionSettings(
        frameTransitionProfile,
        Math.abs(targetDelta),
        shimmerRef.current > 0.1,
      );
      const lerpRate = frameRateIndependentLerp(targetBaseLerp, dt, 30);

      // Interpolate valence (exponential ease)
      state.currentValence += targetDelta * lerpRate;

      // ── P4: Idle awareness (meditative slowdown after 8s inactivity) ──
      const idleElapsed = timestamp - lastInteractionRef.current;
      const idleFactor = Math.max(0, Math.min(1, (idleElapsed - 8000) / 4000));

      state.time += dt * animationSpeedRef.current * (1 - idleFactor * 0.4); // idle → 40% slower internal time

      // P5: Smoothed valence — organic flow between color/shape states
      // Lower factor → slow-breath settle. User feedback 2026-04-18:
      // "мягкость перехода от орба к орбу как раньше было" — restore very soft
      // transition between mood states, not snappy.
      const visualDelta = state.currentValence - smoothValenceRef.current;
      const { visualBaseLerp } = resolveOrbTransitionSettings(
        frameTransitionProfile,
        Math.abs(visualDelta),
      );
      const smoothLerp = frameRateIndependentLerp(visualBaseLerp, dt, 60);
      smoothValenceRef.current += (state.currentValence - smoothValenceRef.current) * smoothLerp;

      // Update particles (skip when off-screen to save CPU)
      if (isVisibleRef.current) {
        updateParticles(
          state.particles,
          state.currentValence,
          cx, cy,
          innerR, outerR,
          idleFactor, // P4: calm factor
        );
      }

      // Proactive context loss detection (iOS 17+ WKWebView — context lost without event)
      if (glRendererRef.current?.isContextLost()) {
        glRendererRef.current.dispose();
        glRendererRef.current = null;
        degradeToCanvas2D();
      }

      // Draw scene (skip when off-screen, catch errors to prevent loop death)
      if (isVisibleRef.current) {
        try {
          render(smoothValenceRef.current, state.time, state.particles, timestamp);
        } catch (err) {
          recordError(err, { component: 'ValenceOrb', action: 'render' });

          if (glRendererRef.current) {
            // WebGL render threw — degrade to Canvas 2D
            glRendererRef.current.dispose();
            glRendererRef.current = null;
            degradeToCanvas2D();
          } else {
            // Canvas 2D render also threw — give up
            cancelAnimationFrame(rafRef.current);
            setCtxFailed(true);
            return;
          }
        }
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // ── Context loss recovery (Law 22, Part 10) ──
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      glRendererRef.current?.dispose();
      glRendererRef.current = null;

      // Cannot getContext('2d') on a WebGL-locked canvas — create a fresh one
      degradeToCanvas2D();

      // Restart RAF loop with Canvas 2D rendering
      if (ctx2d && shouldAnimate() && mountedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }

      recordError(
        new Error('WebGL context lost — degraded to Canvas 2D'),
        { component: 'ValenceOrb' },
      );
    };

    const handleContextRestored = () => {
      // Keep Canvas 2D after a context loss. Recompiling immediately can repeat
      // the same Chrome/GPU stall that caused the fallback in the first place.
      if (shouldAnimate() && mountedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    const attachWebGLListeners = (canvas: HTMLCanvasElement) => {
      webglEventCanvas = canvas;
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    };

    const upgradeToWebGL = async (signal: AbortSignal) => {
      if (!shouldTryWebGL(renderer) || signal.aborted) return;

      if (renderer === 'auto' && canUseWorkerWebGL()) {
        if (!isVisibleCanvasHost(wrapper)) return;

        const workerStartedAt = performance.now();
        const workerCanvas = createCanvas(size, dpr);
        const offscreen = workerCanvas.transferControlToOffscreen();
        const worker = new Worker(new URL('./orbWorker.ts', import.meta.url), {
          type: 'module',
          name: 'zenflow-orb-renderer',
        });
        webglWorker = worker;

        worker.onmessage = (event: MessageEvent<{ type: 'ready' | 'failed'; reason?: string }>) => {
          if (signal.aborted || !mountedRef.current) return;

          if (event.data.type === 'failed') {
            recordError(
              new Error(event.data.reason || 'Worker WebGL renderer failed'),
              { component: 'ValenceOrb', action: 'worker-webgl' },
            );
            worker.terminate();
            if (webglWorker === worker) webglWorker = null;
            return;
          }

          const readyDurationMs = performance.now() - workerStartedAt;
          const visibleCanvasAgeMs = performance.now() - visibleCanvasMountedAt;
          const visibleUpgradeAgeMs = Math.max(readyDurationMs, visibleCanvasAgeMs);
          if (!shouldApplyWorkerWebGLUpgrade(visibleUpgradeAgeMs, getRendererOverride() === 'webgl')) {
            rememberSlowWebGL(visibleUpgradeAgeMs);
            worker.terminate();
            if (webglWorker === worker) webglWorker = null;
            return;
          }

          const controller: OrbWorkerController = {
            render(payload) {
              worker.postMessage({ type: 'render', payload });
            },
            dispose() {
              worker.postMessage({ type: 'dispose' });
              worker.terminate();
            },
          };

          const previousCanvas = activeCanvas;
          workerRenderer = controller;
          workerRendererRef.current = controller;
          canvasElRef.current = workerCanvas;
          ctx2d = null;
          activeCanvas = workerCanvas;
          render = renderWorkerGL;

          if (wrapper.contains(previousCanvas)) {
            wrapper.replaceChild(workerCanvas, previousCanvas);
          } else {
            wrapper.appendChild(workerCanvas);
          }

          const state = stateRef.current;
          if (state) {
            renderWorkerGL(smoothValenceRef.current, state.time, state.particles);
          }
        };

        worker.postMessage({ type: 'init', canvas: offscreen, size, dpr }, [offscreen]);
        return;
      }

      if (!probeWebGLWorks()) return;

      const gl2Canvas = createCanvas(size, dpr);
      let result: OrbGLBuildResult | null = await createOrbGL2Async(gl2Canvas, {
        signal,
        timeoutMs: WEBGL_READINESS_TIMEOUT_MS,
      });

      let upgradeCanvas = gl2Canvas;
      if (!result && !signal.aborted) {
        const gl1Canvas = createCanvas(size, dpr);
        result = await createOrbGLAsync(gl1Canvas, {
          signal,
          timeoutMs: WEBGL_READINESS_TIMEOUT_MS,
        });
        upgradeCanvas = gl1Canvas;
      }

      if (signal.aborted || !mountedRef.current) return;
      if (!result) {
        return;
      }

      if (result.durationMs > WEBGL_BUILD_BUDGET_MS) {
        rememberSlowWebGL(result.durationMs);
      }

      const previousCanvas = activeCanvas;
      glRenderer = result.renderer;
      glRendererRef.current = result.renderer;
      canvasElRef.current = upgradeCanvas;
      ctx2d = null;
      activeCanvas = upgradeCanvas;
      render = renderGL;
      attachWebGLListeners(upgradeCanvas);

      if (wrapper.contains(previousCanvas)) {
        wrapper.replaceChild(upgradeCanvas, previousCanvas);
      } else {
        wrapper.appendChild(upgradeCanvas);
      }
    };

    // ── Touch ripple handler (P2) ──
    const handlePointerDown = (e: PointerEvent) => {
      const rect = activeCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y for WebGL UV
      const state = stateRef.current;
      if (state) {
        touchRef.current = { x, y, startTime: state.time };
        lastInteractionRef.current = performance.now(); // P4: reset idle
        void hapticTap(); // Tactile feedback on touch (Law 22 — sensory pairing)
      }
    };
    // passive: true — never blocks scroll/swipe gestures
    wrapper.addEventListener('pointerdown', handlePointerDown, { passive: true });

    const webglUpgradeAbort = new AbortController();
    let cancelWebGLUpgrade = () => {};

    // ── Cleanup ──
    const cleanup = () => {
      webglUpgradeAbort.abort();
      cancelWebGLUpgrade();
      cancelAnimationFrame(rafRef.current);
      wrapper.removeEventListener('pointerdown', handlePointerDown);
      if (webglEventCanvas) {
        webglEventCanvas.removeEventListener('webglcontextlost', handleContextLost);
        webglEventCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      if (workerRendererRef.current === workerRenderer) {
        workerRendererRef.current?.dispose();
        workerRendererRef.current = null;
      } else if (webglWorker) {
        webglWorker.terminate();
      }
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      canvasElRef.current = null;

      // Remove canvas elements from DOM
      if (wrapper.contains(activeCanvas)) {
        wrapper.removeChild(activeCanvas);
      }
      if (fallbackCanvas && wrapper.contains(fallbackCanvas)) {
        wrapper.removeChild(fallbackCanvas);
      }
    };

    // ── Animation gate ──
    if (!shouldAnimate()) {
      try { render(valenceRef.current, 0, stateRef.current.particles); } catch { /* graceful: initial frame render failure invisible — orb shows fallback CSS */ }
      return cleanup;
    }

    cancelWebGLUpgrade = scheduleAfterFirstPaint(() => {
      void upgradeToWebGL(webglUpgradeAbort.signal);
    });

    rafRef.current = requestAnimationFrame(loop);

    return cleanup;
  }, [renderer, size]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimate()) return;

    const canvas = canvasElRef.current;
    if (!canvas) return;
    const state = stateRef.current;
    if (!state) return;

    const dpr = Math.max(1, canvas.width / size);
    state.currentValence = valence;

    if (workerRendererRef.current) {
      workerRendererRef.current.render({
        valence,
        time: 0,
        size,
        dpr,
        isDark: document.documentElement.classList.contains('dark'),
        color: valenceToHSL(valence),
        shape: getShapeParams(valence),
        particles: state.particles,
        genesis: 1.0,
        touch: { x: 0, y: 0, age: 0 },
        shimmer: 0,
      });
      return;
    }

    if (glRendererRef.current) {
      glRendererRef.current.render({
        valence,
        time: 0,
        size,
        dpr,
        isDark: document.documentElement.classList.contains('dark'),
        color: valenceToHSL(valence),
        shape: getShapeParams(valence),
        particles: state.particles,
        genesis: 1.0,
        touch: { x: 0, y: 0, age: 0 },
        shimmer: 0,
      });
    } else {
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawOrbScene(ctx, {
        valence,
        time: 0,
        particles: state.particles,
        size,
        dpr,
        isDark: document.documentElement.classList.contains('dark'),
      });
    }
  }, [valence, size]);

  // Context failure fallback — soft radial gradient instead of boring pulse
  if (ctxFailed) {
    return (
      <div
        ref={wrapperRef}
        className="relative flex items-center justify-center flex-shrink-0"
        data-orb-transition-profile={transitionProfile}
        data-orb-animation-speed={animationSpeed}
        style={{ width: size, height: size }}
        aria-hidden="true"
      >
        <div
          className="rounded-full motion-safe:animate-pulse"
          style={{
            width: size * 0.7,
            height: size * 0.7,
            background: `radial-gradient(circle at 35% 35%,
              hsl(var(--primary) / 0.3),
              hsl(var(--primary) / 0.15) 50%,
              hsl(var(--primary) / 0.05) 80%,
              transparent)`,
            filter: 'blur(4px)',
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center justify-center"
      data-orb-transition-profile={transitionProfile}
      data-orb-animation-speed={animationSpeed}
      style={{ width: size, height: size, touchAction: 'manipulation' }}
      aria-hidden="true"
    />
  );
});
