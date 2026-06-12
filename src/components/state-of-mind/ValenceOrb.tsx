/**
 * ValenceOrb — GPU-accelerated orb for State of Mind valence step.
 *
 * Progressive enhancement (Law 22 — probe highest tier first):
 *   WebGPU available → WGSL shader (canonical GPU path, async pipeline)
 *   WebGL 2.0 available → GLSL 300 es shader (10/10 quality, 60fps capable)
 *   WebGL 1.0 available → GLSL ES 1.0 shader (10/10 quality, 60fps capable)
 *   Neither available → Canvas 2D fallback only for non-forced/debug surfaces
 *
 * Both paths share the same particle system, shape presets, and color mapping.
 * Context loss recovery: non-forced surfaces may fall back; forced canonical surfaces stay GPU-only.
 *
 * Law 12 (Performance): 30fps RAF, IntersectionObserver pause, DPR cap at 2x.
 * Law 18 (Cleanup): mounted guard, RAF cancel, observer disconnect, GL dispose, listener removal.
 * Dopamine gate: user/accessibility disables animation; runtime perf guard
 * keeps the canonical renderer and reduces cadence instead of changing visuals.
 *
 * Canvas management: canvases are created programmatically (not via JSX ref) to allow
 * replacing a WebGL-locked canvas with a fresh one for Canvas 2D fallback.
 * Per HTML spec, once getContext('webgl2') succeeds, the same canvas cannot provide
 * a '2d' context — a new <canvas> element is the only solution.
 */

import { useRef, useEffect, useLayoutEffect, useState, memo } from 'react';
import { shouldAnimate } from '@/lib/animationUtils';
import { recordError } from '@/lib/crashReporting';
import { hapticTap } from '@/lib/haptics';
import { safeSessionStorageGet, safeSessionStorageSet } from '@/lib/safeJson';
import { SSK } from '@/lib/storageKeys';
import { createParticlePool, updateParticles } from './particleSystem';
import { drawOrbScene, getShapeParams } from './orbRenderer';
import { valenceToHSL } from './colorUtils';
import { createOrbGL2, createOrbGL, createOrbGL2Async, createOrbGLAsync } from './orbShader';
import { createOrbWebGpuAsync } from './orbWebGpu';
import type { Particle } from './particleSystem';
import type { OrbGLBuildResult, OrbGLRenderer } from './orbShader';
import type { OrbWebGpuBuildResult, OrbWebGpuRenderer } from './orbWebGpu';

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
  /** Renderer policy. Explicit WebGL surfaces never display Canvas/CSS substitute orbs. */
  renderer?: OrbRendererMode;
  /** Fires once any canonical first-paint frame is visible. */
  onFirstPaintReady?: () => void;
  /** Fires once the stable renderer has produced its first real frame. */
  onVisualReady?: () => void;
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

interface OrbRuntimeState {
  targetValence: number;
  currentValence: number;
  time: number;
  particles: Particle[];
  lastFrame: number;
}

const WEBGL_FRAME_INTERVAL = 1000 / 60; // 60fps for healthy WebGL sessions.
const CANVAS_FRAME_INTERVAL = 1000 / 30; // 30fps for Canvas 2D fallback
const ORB_FRAME_CLOCK_REANCHOR_GAP_MS = 750;
const ORB_MAX_FRAME_DELTA_SECONDS = 0.05;

function shouldAnimateCanonicalOrb(): boolean {
  return shouldAnimate({ respectRuntimePerformance: false });
}
const PARTICLE_COUNT = 22;
export const CANONICAL_ORB_ANIMATION_SPEED = 1;
const WEBGL_BUILD_BUDGET_MS = 500;
export const WEBGL_WORKER_READY_BUDGET_MS = 700;
const WEBGL_READINESS_TIMEOUT_MS = 8000;
const FORCED_WEBGL_READINESS_TIMEOUT_MS = 900;
export const WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS = 30000;
export const WEBGL_VISIBILITY_RETRY_INTERVAL_MS = 250;
const FORCED_WEBGL_WORKER_STARTUP_TIMEOUT_MS = 30000;
export const WEBGL_VISIBLE_UPGRADE_DEADLINE_MS = 1200;
const WEBGL_UPGRADE_DELAY_MS = 180;
const FORCED_WEBGL_UPGRADE_DELAY_MS = 240;
const MINI_WEBGL_UPGRADE_DELAY_MS = 900;
const MINI_WEBGL_UPGRADE_QUEUE_GAP_MS = 6000;
const ORB_IDLE_WAKE_SOFT_EPSILON = 0.01;
const ORB_SUBTLE_TRANSITION_SHIMMER = 0.12;
const ORB_SUBTLE_TRANSITION_SHIMMER_DELTA = 0.3;
const MINI_ORB_CANONICAL_SIZE = 120;
const ORB_RUNTIME_SNAPSHOT_TTL_MS = 10_000;
const ORB_RUNTIME_SNAPSHOT_VALENCE_EPSILON = 0.001;

let nextMiniWebGLUpgradeStartAt = 0;

type OrbRuntimeSnapshot = {
  targetValence: number;
  time: number;
  currentValence: number;
  smoothValence: number;
  storedAt: number;
};

const orbRuntimeSnapshots = new Map<string, OrbRuntimeSnapshot>();

function resolveOrbRuntimeSnapshotKey(renderer: OrbRendererMode, size: number): string {
  const sizeBucket = size > MINI_ORB_CANONICAL_SIZE ? "full" : Math.round(size);
  return `${renderer}:${sizeBucket}`;
}

function pruneStaleOrbRuntimeSnapshots(now: number) {
  for (const [key, snapshot] of orbRuntimeSnapshots) {
    if (now - snapshot.storedAt > ORB_RUNTIME_SNAPSHOT_TTL_MS) {
      orbRuntimeSnapshots.delete(key);
    }
  }
}

function readOrbRuntimeSnapshot(
  renderer: OrbRendererMode,
  size: number,
  targetValence: number,
  now: number,
): OrbRuntimeSnapshot | null {
  pruneStaleOrbRuntimeSnapshots(now);
  const snapshot = orbRuntimeSnapshots.get(resolveOrbRuntimeSnapshotKey(renderer, size));
  if (!snapshot) return null;
  if (now - snapshot.storedAt > ORB_RUNTIME_SNAPSHOT_TTL_MS) return null;
  if (Math.abs(snapshot.targetValence - targetValence) > ORB_RUNTIME_SNAPSHOT_VALENCE_EPSILON) {
    return null;
  }
  return snapshot;
}

function rememberOrbRuntimeSnapshot(
  renderer: OrbRendererMode,
  size: number,
  state: OrbRuntimeState | null,
  smoothValence: number,
  now: number,
) {
  if (!state) return;
  if (!Number.isFinite(state.time) || state.time < 0) return;
  if (
    !Number.isFinite(state.targetValence) ||
    !Number.isFinite(state.currentValence) ||
    !Number.isFinite(smoothValence)
  ) {
    return;
  }
  pruneStaleOrbRuntimeSnapshots(now);
  orbRuntimeSnapshots.set(resolveOrbRuntimeSnapshotKey(renderer, size), {
    targetValence: state.targetValence,
    time: state.time,
    currentValence: state.currentValence,
    smoothValence,
    storedAt: now,
  });
}

export function resetOrbRuntimeSnapshotsForTests(): void {
  orbRuntimeSnapshots.clear();
  nextMiniWebGLUpgradeStartAt = 0;
}

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
    targetBaseLerp: 0.022,
    shimmerBaseLerp: 0.01,
    visualBaseLerp: 0.016,
    tailDistance: 0.28,
    tailMultiplier: 0.42,
  },
  "input-soft": {
    targetBaseLerp: 0.072,
    shimmerBaseLerp: 0.038,
    visualBaseLerp: 0.036,
    tailDistance: 0.18,
    tailMultiplier: 0.58,
  },
};

export function resolveOrbFrameInterval(
  hasWebGLRenderer: boolean,
): number {
  if (!hasWebGLRenderer) return CANVAS_FRAME_INTERVAL;
  return WEBGL_FRAME_INTERVAL;
}

export function resolveOrbFrameDeltaSeconds(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
): number {
  if (!Number.isFinite(previousFrameAtMs) || previousFrameAtMs <= 0) return 0;
  if (!Number.isFinite(currentFrameAtMs)) return 0;

  const elapsedMs = currentFrameAtMs - previousFrameAtMs;
  if (!Number.isFinite(elapsedMs) || elapsedMs <= 0) return 0;
  if (elapsedMs > ORB_FRAME_CLOCK_REANCHOR_GAP_MS) return 0;

  return Math.min(elapsedMs / 1000, ORB_MAX_FRAME_DELTA_SECONDS);
}

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
  void profile;
  void idleElapsedMs;
  void targetDelta;
  return false;
}

export function shouldDropLateVisibleWebGLUpgrade({
  forceCanonicalWebGL,
  explicitWebGLOverride,
  visualReady,
  visibleCanvasAgeMs,
}: {
  forceCanonicalWebGL: boolean;
  explicitWebGLOverride: boolean;
  visualReady: boolean;
  visibleCanvasAgeMs: number;
}): boolean {
  return (
    forceCanonicalWebGL &&
    !explicitWebGLOverride &&
    visualReady &&
    visibleCanvasAgeMs > WEBGL_VISIBLE_UPGRADE_DEADLINE_MS
  );
}

export function resolveFrameTransitionProfile(
  profile: OrbTransitionProfile,
  idleWakeSoftActive: boolean,
): OrbTransitionProfile {
  void idleWakeSoftActive;
  return profile;
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
  c.style.display = 'block';
  c.style.contain = 'strict';
  c.style.willChange = 'transform';
  c.style.transform = 'translateZ(0)';
  c.style.backfaceVisibility = 'hidden';
  c.setAttribute('aria-hidden', 'true');
  return c;
}

function markRendererTier(
  canvas: HTMLCanvasElement,
  tier: 'canvas2d' | 'webgpu-main' | 'webgl-main' | 'webgl-worker',
) {
  canvas.dataset.orbRendererTier = tier;
}

export function allowsFirstPaintFallback(
  renderer: OrbRendererMode,
  rendererOverride: OrbRendererMode | null,
): boolean {
  void renderer;
  void rendererOverride;
  return false;
}

export function shouldShowFirstPaintFallback(
  renderer: OrbRendererMode,
  rendererOverride: OrbRendererMode | null,
  visualReady: boolean,
): boolean {
  void visualReady;
  return allowsFirstPaintFallback(renderer, rendererOverride);
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

function isDebugCanvasFallbackAllowed(rendererOverride: OrbRendererMode | null): boolean {
  if (rendererOverride !== 'canvas') return false;
  try {
    return new URLSearchParams(window.location.search).get('dev') === 'true';
  } catch {
    return false;
  }
}

function shouldTryWebGL(mode: OrbRendererMode): boolean {
  const override = getRendererOverride();
  if (isDebugCanvasFallbackAllowed(override)) return false;
  if (override === 'webgl') return true;
  if (mode === 'canvas') return false;
  if (mode === 'webgl') return true;
  if (hasSlowWebGLSession()) return false;
  return true;
}

function shouldTryCanonicalGpu(mode: OrbRendererMode): boolean {
  const override = getRendererOverride();
  if (isDebugCanvasFallbackAllowed(override)) return false;
  if (override === 'webgl') return true;
  return mode !== 'canvas';
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

export function resolveCanonicalWebGLUpgradeScheduling(
  forceCanonicalWebGL: boolean,
  size: number,
  now: number,
  nextMiniUpgradeStartAt: number,
): {
  delayMs: number;
  preferIdle: boolean;
  nextMiniUpgradeStartAt: number;
} {
  if (!forceCanonicalWebGL) {
    return {
      delayMs: WEBGL_UPGRADE_DELAY_MS,
      preferIdle: true,
      nextMiniUpgradeStartAt,
    };
  }

  if (size > MINI_ORB_CANONICAL_SIZE) {
    return {
      delayMs: FORCED_WEBGL_UPGRADE_DELAY_MS,
      preferIdle: true,
      nextMiniUpgradeStartAt,
    };
  }

  const earliestStartAt = Math.max(now + MINI_WEBGL_UPGRADE_DELAY_MS, nextMiniUpgradeStartAt);

  return {
    delayMs: Math.max(0, Math.round(earliestStartAt - now)),
    preferIdle: true,
    nextMiniUpgradeStartAt: earliestStartAt + MINI_WEBGL_UPGRADE_QUEUE_GAP_MS,
  };
}

function reserveCanonicalWebGLUpgradeScheduling(
  forceCanonicalWebGL: boolean,
  size: number,
): { delayMs: number; preferIdle: boolean } {
  const scheduling = resolveCanonicalWebGLUpgradeScheduling(
    forceCanonicalWebGL,
    size,
    performance.now(),
    nextMiniWebGLUpgradeStartAt,
  );

  nextMiniWebGLUpgradeStartAt = scheduling.nextMiniUpgradeStartAt;

  return {
    delayMs: scheduling.delayMs,
    preferIdle: scheduling.preferIdle,
  };
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

function isPhoneLikeViewport(): boolean {
  try {
    return (
      (window.innerWidth || document.documentElement.clientWidth) < 768 ||
      window.matchMedia?.('(pointer: coarse)').matches === true ||
      (navigator.maxTouchPoints || 0) > 0
    );
  } catch {
    return false;
  }
}

export function shouldUseWorkerWebGL(forceCanonicalWebGL: boolean, size = Number.POSITIVE_INFINITY): boolean {
  void size;
  if (!canUseWorkerWebGL()) return false;
  if (forceCanonicalWebGL) return true;
  return !isPhoneLikeViewport();
}

function scheduleAfterFirstPaint(
  task: () => void,
  options: { preferIdle?: boolean; delayMs?: number } = {},
): () => void {
  let cancelled = false;
  let timeoutId = 0;
  let idleId = 0;
  const preferIdle = options.preferIdle ?? true;
  const delayMs = options.delayMs ?? WEBGL_UPGRADE_DELAY_MS;

  const run = () => {
    if (cancelled) return;
    task();
  };

  const requestIdle = window.requestIdleCallback;
  if (preferIdle && requestIdle) {
    const queueIdle = () => {
      if (cancelled) return;
      idleId = requestIdle(run, { timeout: 600 });
    };

    if (delayMs > 0) {
      timeoutId = window.setTimeout(queueIdle, delayMs);
    } else {
      queueIdle();
    }

    return () => {
      cancelled = true;
      window.clearTimeout(timeoutId);
      window.cancelIdleCallback?.(idleId);
    };
  }

  const rafId = requestAnimationFrame(() => {
    timeoutId = window.setTimeout(run, delayMs);
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
  onFirstPaintReady,
  onVisualReady,
}: ValenceOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const webGpuRendererRef = useRef<OrbWebGpuRenderer | null>(null);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
  const workerRendererRef = useRef<OrbWorkerController | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const firstPaintReadyRef = useRef(false);
  const visualReadyRef = useRef(false);
  const firstVisualReadyAtRef = useRef(0);
  const [ctxFailed, setCtxFailed] = useState(false);
  const genesisStartRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
  const shimmerRef = useRef(0); // subtle target-change glow; never a late burst
  const lastInteractionRef = useRef(performance.now()); // P4: idle awareness
  const smoothValenceRef = useRef(valence); // P5: smoothed valence for organic color/shape flow
  const targetValenceRef = useRef(valence);
  const idleWakeSoftActiveRef = useRef(false);
  const animationSpeedRef = useRef(animationSpeed);
  animationSpeedRef.current = animationSpeed;
  const transitionProfileRef = useRef<OrbTransitionProfile>(transitionProfile);
  transitionProfileRef.current = transitionProfile;

  // Mutable animation state — avoids React re-renders during animation
  const stateRef = useRef<OrbRuntimeState | null>(null);

  // Keep target valence in sync with prop
  const valenceRef = useRef(valence);
  valenceRef.current = valence;
  const onFirstPaintReadyRef = useRef(onFirstPaintReady);
  onFirstPaintReadyRef.current = onFirstPaintReady;
  const onVisualReadyRef = useRef(onVisualReady);
  onVisualReadyRef.current = onVisualReady;
  const markFirstPaintReadyRef = useRef<() => void>(() => {});
  markFirstPaintReadyRef.current = () => {
    const alreadyReady = firstPaintReadyRef.current;
    firstPaintReadyRef.current = true;
    wrapperRef.current?.setAttribute('data-orb-first-paint-ready', 'true');
    if (alreadyReady) return;
    onFirstPaintReadyRef.current?.();
  };
  const markVisualReadyRef = useRef<() => void>(() => {});
  markVisualReadyRef.current = () => {
    const alreadyReady = visualReadyRef.current;
    const revealCanonicalCanvas = (orbCanvas: HTMLCanvasElement) => {
      orbCanvas.style.setProperty('transition', 'none', 'important');
      orbCanvas.style.setProperty('opacity', '1', 'important');
      orbCanvas.setAttribute('data-orb-visual-ready', 'true');
    };

    if (alreadyReady) {
      const canvas = canvasElRef.current;
      if (canvas && canvas.getAttribute('data-orb-visual-ready') !== 'true') {
        revealCanonicalCanvas(canvas);
      }
      const wrapper = wrapperRef.current;
      if (wrapper && wrapper.getAttribute('data-orb-visual-ready') !== 'true') {
        wrapper.setAttribute('data-orb-visual-ready', 'true');
      }
      return;
    }

    markFirstPaintReadyRef.current();
    visualReadyRef.current = true;
    if (firstVisualReadyAtRef.current === 0) {
      firstVisualReadyAtRef.current = performance.now();
    }
    const canvas = canvasElRef.current;
    if (canvas) {
      revealCanonicalCanvas(canvas);
    }
    const wrapper = wrapperRef.current;
    wrapper?.querySelectorAll('canvas').forEach((orbCanvas) => {
      revealCanonicalCanvas(orbCanvas);
    });
    wrapper?.setAttribute('data-orb-visual-ready', 'true');
    onVisualReadyRef.current?.();
  };

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

    if (Math.abs(valence - state.currentValence) > ORB_SUBTLE_TRANSITION_SHIMMER_DELTA) {
      shimmerRef.current = Math.max(shimmerRef.current, ORB_SUBTLE_TRANSITION_SHIMMER);
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
  useLayoutEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    firstPaintReadyRef.current = false;
    visualReadyRef.current = false;
    wrapper.removeAttribute('data-orb-first-paint-ready');
    wrapper.removeAttribute('data-orb-visual-ready');
    wrapper.removeAttribute('data-orb-webgl-upgrade');
    wrapper.querySelectorAll('canvas[data-orb-visual-ready]').forEach((canvas) => {
      canvas.removeAttribute('data-orb-visual-ready');
    });

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const canvasDpr = 1;
    isVisibleRef.current = true;

    // Initialize animation state
    const cx = size / 2;
    const cy = size / 2;
    const innerR = size * 0.28;
    const outerR = size * 0.42;
    const runtimeSnapshot = readOrbRuntimeSnapshot(
      renderer,
      size,
      valenceRef.current,
      performance.now(),
    );
    const initialCurrentValence = runtimeSnapshot?.currentValence ?? valenceRef.current;
    const initialSmoothValence = runtimeSnapshot?.smoothValence ?? valenceRef.current;
    const initialTime = runtimeSnapshot?.time ?? 0;

    targetValenceRef.current = valenceRef.current;
    smoothValenceRef.current = initialSmoothValence;
    stateRef.current = {
      targetValence: valenceRef.current,
      currentValence: initialCurrentValence,
      time: initialTime,
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

    const rendererOverride = getRendererOverride();
    const debugCanvasFallbackAllowed = isDebugCanvasFallbackAllowed(rendererOverride);
    const explicitWebGLOverride = rendererOverride === 'webgl';
    const forceCanonicalWebGL =
      !debugCanvasFallbackAllowed && (renderer === 'webgl' || rendererOverride === 'webgl');
    const canUseCanonicalCanvasRecovery = !forceCanonicalWebGL || debugCanvasFallbackAllowed;
    let activeCanvas = createCanvas(size, canvasDpr);
    let webGpuRenderer: OrbWebGpuRenderer | null = null;
    let glRenderer: OrbGLRenderer | null = null;
    let workerRenderer: OrbWorkerController | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let webglEventCanvas: HTMLCanvasElement | null = null;
    let webglWorker: Worker | null = null;
    let nextWorkerRenderId = 0;
    let workerRenderInFlight = false;
    let latestWorkerPayload: OrbWorkerPayload | null = null;
    let forceWebGLStartupRecovered = false;

    if (canUseCanonicalCanvasRecovery) {
      markRendererTier(activeCanvas, 'canvas2d');
      try {
        ctx2d = activeCanvas.getContext('2d', { willReadFrequently: false });
      } catch (err) {
        recordError(err, { component: 'ValenceOrb', action: 'canvas2d-probe' });
        ctx2d = null;
      }

      if (!ctx2d && !forceCanonicalWebGL) {
        setCtxFailed(true);
        return;
      }
    }

    webGpuRendererRef.current = webGpuRenderer;
    glRendererRef.current = glRenderer;
    if (ctx2d) {
      canvasElRef.current = activeCanvas;
      wrapper.appendChild(activeCanvas);
    } else {
      canvasElRef.current = null;
    }
    let visibleCanvasMountedAt = ctx2d ? performance.now() : 0;

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
      markVisualReadyRef.current();
    };

    const renderWebGPU = (
      v: number,
      t: number,
      particles: Particle[],
      timestamp = performance.now(),
    ) => {
      const webGpu = webGpuRendererRef.current;
      if (!webGpu) return;
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;
      webGpu.render({
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
      markVisualReadyRef.current();
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
      const effectiveDpr = Math.max(1, (canvasElRef.current?.width ?? size) / size);
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        particles,
        size,
        dpr: effectiveDpr,
        isDark: isDarkRead(),
        shimmer: shimmerRef.current,
      });
      markVisualReadyRef.current();
    };

    const renderCanonicalCanvasFirstPaint = () => {
      const state = stateRef.current;
      if (!ctx2d || !state || visualReadyRef.current) return;

      try {
        renderCanvas2D(smoothValenceRef.current, state.time, state.particles);
      } catch (err) {
        recordError(err, { component: 'ValenceOrb', action: 'canvas2d-first-paint' });
      }
    };

    const renderPendingWebGL = () => {};
    let render = webGpuRenderer
      ? renderWebGPU
      : (glRenderer ? renderGL : (ctx2d ? renderCanvas2D : renderPendingWebGL));
    let disposed = false;
    let rafScheduled = false;

    // ── Fallback canvas for context loss recovery ──
    let fallbackCanvas: HTMLCanvasElement | null = null;
    /** Degrade to Canvas 2D only for non-forced/debug recovery; forced canonical surfaces stay GPU-only. */
    const degradeToCanvas2D = () => {
      if (!canUseCanonicalCanvasRecovery) {
        render = renderPendingWebGL;
        setCtxFailed(true);
        return;
      }

      if (ctx2d && canvasElRef.current === activeCanvas) {
        activeCanvas.style.setProperty('transition', 'none', 'important');
        activeCanvas.style.setProperty('opacity', '1', 'important');
        render = renderCanvas2D;

        const state = stateRef.current;
        if (state) {
          renderCanvas2D(smoothValenceRef.current, state.time, state.particles);
        }
        return;
      }

      if (ctx2d && fallbackCanvas && activeCanvas === fallbackCanvas) {
        return;
      }

      const previousCanvas = activeCanvas;
      fallbackCanvas = createCanvas(size, canvasDpr);
      markRendererTier(fallbackCanvas, 'canvas2d');
      try {
        ctx2d = fallbackCanvas.getContext('2d', { willReadFrequently: false });
      } catch {
        ctx2d = null;
      }

      if (ctx2d) {
        fallbackCanvas.style.setProperty('transition', 'none', 'important');
        fallbackCanvas.style.setProperty('opacity', '1', 'important');
        if (fallbackCanvas !== previousCanvas && wrapper.contains(previousCanvas)) {
          wrapper.replaceChild(fallbackCanvas, previousCanvas);
        } else if (!wrapper.contains(fallbackCanvas)) {
          wrapper.appendChild(fallbackCanvas);
        }
        activeCanvas = fallbackCanvas;
        canvasElRef.current = fallbackCanvas;
        visibleCanvasMountedAt = performance.now();
        webGpuRendererRef.current?.dispose();
        webGpuRendererRef.current = null;
        webGpuRenderer = null;
        glRendererRef.current?.dispose();
        glRendererRef.current = null;
        workerRendererRef.current?.dispose();
        workerRendererRef.current = null;
        render = renderCanvas2D;

        const state = stateRef.current;
        if (state) {
          renderCanvas2D(smoothValenceRef.current, state.time, state.particles);
        }
      } else {
        setCtxFailed(true);
      }
    };

    let forceWebGLFirstFrameTimeoutId = 0;
    const cancelNextFrame = () => {
      if (!rafScheduled) return;
      cancelAnimationFrame(rafRef.current);
      rafScheduled = false;
    };

    const resetFrameClock = () => {
      const state = stateRef.current;
      if (state) state.lastFrame = 0;
    };

    const requestNextFrame = () => {
      if (disposed || rafScheduled || !mountedRef.current) return;
      rafScheduled = true;
      rafRef.current = requestAnimationFrame((timestamp) => {
        rafScheduled = false;
        loop(timestamp);
      });
    };

    // ── Animation loop ──
    function loop(timestamp: number) {
      if (!mountedRef.current || disposed) return;

      const state = stateRef.current;
      if (!state) return;

      const documentHidden = typeof document !== "undefined" && document.hidden;
      if (documentHidden || !isVisibleRef.current) {
        resetFrameClock();
        return;
      }

      // Runtime dopamine gate
      if (!shouldAnimateCanonicalOrb()) {
        try { render(state.currentValence, state.time, state.particles); } catch { /* graceful: static frame render failure invisible — orb just stays as-is */ }
        return;
      }

      // The worker owns the visible WebGL frame. If it is still rendering the
      // previous payload, do not advance shader time/particles behind the
      // user's back and then "catch up" in one visible frame.
      if (workerRenderer && workerRenderInFlight) {
        requestNextFrame();
        return;
      }

      // Throttle: healthy WebGL stays 60fps; strained Chrome/WebView sessions keep
      // the canonical renderer but reduce compositor pressure to the fallback cadence.
      const frameInterval = resolveOrbFrameInterval(Boolean(webGpuRendererRef.current || glRendererRef.current || workerRenderer));
      const elapsed = state.lastFrame > 0 ? timestamp - state.lastFrame : frameInterval;
      if (state.lastFrame > 0 && elapsed < frameInterval) {
        requestNextFrame();
        return;
      }
      // Re-anchor instead of catching up after hidden tabs, reload restore, or long stalls.
      const dt = resolveOrbFrameDeltaSeconds(state.lastFrame, timestamp);
      state.lastFrame = timestamp;

      // Shimmer decay: dt-based exponential (~0.8s half-life, frame-rate independent).
      // Keep it as a quiet target-change glow; delayed high-energy bursts read as
      // a sudden spin-up after the transition should already feel settled.
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

      // P4: keep shader time stable while preserving subtle idle visual calm.
      const idleElapsed = timestamp - lastInteractionRef.current;
      const idleFactor = Math.max(0, Math.min(1, (idleElapsed - 8000) / 4000));
      state.time += dt * animationSpeedRef.current;

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
          dt,
        );
      }

      // Proactive context loss detection (WebGPU device loss / iOS 17+ WKWebView WebGL loss without event)
      if (webGpuRendererRef.current?.isContextLost()) {
        webGpuRendererRef.current.dispose();
        webGpuRendererRef.current = null;
        webGpuRenderer = null;
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          render = renderPendingWebGL;
          setCtxFailed(true);
        }
      }

      if (glRendererRef.current?.isContextLost()) {
        glRendererRef.current.dispose();
        glRendererRef.current = null;
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          render = renderPendingWebGL;
          setCtxFailed(true);
        }
      }

      // Draw scene (skip when off-screen, catch errors to prevent loop death)
      if (isVisibleRef.current) {
        try {
          render(smoothValenceRef.current, state.time, state.particles, timestamp);
        } catch (err) {
          recordError(err, { component: 'ValenceOrb', action: 'render' });

          if (webGpuRendererRef.current) {
            // WebGPU render threw — recover only through approved fallback paths.
            webGpuRendererRef.current.dispose();
            webGpuRendererRef.current = null;
            webGpuRenderer = null;
            if (canUseCanonicalCanvasRecovery) {
              degradeToCanvas2D();
            } else {
              render = renderPendingWebGL;
              setCtxFailed(true);
              return;
            }
          } else if (glRendererRef.current) {
            // WebGL render threw — degrade to Canvas 2D
            glRendererRef.current.dispose();
            glRendererRef.current = null;
            if (canUseCanonicalCanvasRecovery) {
              degradeToCanvas2D();
            } else {
              render = renderPendingWebGL;
              setCtxFailed(true);
              return;
            }
          } else {
            // Canvas 2D render also threw — give up
            cancelNextFrame();
            setCtxFailed(true);
            return;
          }
        }
      }

      requestNextFrame();
    }

    // ── Context loss recovery (Law 22, Part 10) ──
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelNextFrame();
      glRendererRef.current?.dispose();
      glRendererRef.current = null;

      // Cannot getContext('2d') on a WebGL-locked canvas — create a fresh one
      if (canUseCanonicalCanvasRecovery) {
        degradeToCanvas2D();
      } else {
        render = renderPendingWebGL;
        setCtxFailed(true);
      }

      // Restart RAF loop only when a non-forced/debug Canvas 2D recovery exists.
      if (ctx2d && shouldAnimateCanonicalOrb() && mountedRef.current) {
        requestNextFrame();
      }

      recordError(
        new Error(
          forceCanonicalWebGL
            ? 'WebGL context lost without using a substitute orb'
            : 'WebGL context lost — degraded to Canvas 2D',
        ),
        { component: 'ValenceOrb' },
      );
    };

    const handleContextRestored = () => {
      // Keep Canvas 2D after a context loss. Recompiling immediately can repeat
      // the same Chrome/GPU stall that caused the fallback in the first place.
      if (shouldAnimateCanonicalOrb() && mountedRef.current) {
        resetFrameClock();
        requestNextFrame();
      }
    };

    const attachWebGLListeners = (canvas: HTMLCanvasElement) => {
      webglEventCanvas = canvas;
      canvas.addEventListener('webglcontextlost', handleContextLost);
      canvas.addEventListener('webglcontextrestored', handleContextRestored);
    };

    if (glRenderer) {
      attachWebGLListeners(activeCanvas);
    }

    const restartAnimationClock = () => {
      resetFrameClock();
      if (shouldAnimateCanonicalOrb() && mountedRef.current && !disposed) {
        requestNextFrame();
      }
    };

    const pauseAnimationClock = () => {
      resetFrameClock();
      cancelNextFrame();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseAnimationClock();
        return;
      }

      restartAnimationClock();
    };

    const handlePageHide = () => {
      pauseAnimationClock();
    };

    const handlePageShow = () => {
      restartAnimationClock();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);

    const upgradeToWebGL = async (signal: AbortSignal) => {
      if (!shouldTryCanonicalGpu(renderer) || signal.aborted) return;

      let webglStartupRecoveryStarted = false;
      const shouldKeepCurrentVisibleCanvas = () => {
        const visibleUpgradeAgeMs =
          performance.now() - (firstVisualReadyAtRef.current || visibleCanvasMountedAt);

        return shouldDropLateVisibleWebGLUpgrade({
          forceCanonicalWebGL,
          explicitWebGLOverride,
          visualReady: visualReadyRef.current,
          visibleCanvasAgeMs: visibleUpgradeAgeMs,
        });
      };

      const upgradeToMainThreadWebGL = async (): Promise<boolean> => {
        if (!forceCanonicalWebGL && !probeWebGLWorks()) return false;

        const readinessTimeoutMs = forceCanonicalWebGL
          ? FORCED_WEBGL_READINESS_TIMEOUT_MS
          : WEBGL_READINESS_TIMEOUT_MS;
        const gl1Canvas = createCanvas(size, dpr);
        let result: OrbGLBuildResult | null = await createOrbGLAsync(gl1Canvas, {
          signal,
          timeoutMs: readinessTimeoutMs,
        });

        let upgradeCanvas = gl1Canvas;
        if (!result && !forceCanonicalWebGL && !signal.aborted) {
          const syncStartedAt = performance.now();
          const syncCanvas = createCanvas(size, dpr);
          const syncRenderer = createOrbGL(syncCanvas);
          if (syncRenderer) {
            result = {
              renderer: syncRenderer,
              durationMs: performance.now() - syncStartedAt,
              tier: 'webgl',
            };
            upgradeCanvas = syncCanvas;
          }
        }

        if (!result && !signal.aborted) {
          const gl2Canvas = createCanvas(size, dpr);
          result = await createOrbGL2Async(gl2Canvas, {
            signal,
            timeoutMs: readinessTimeoutMs,
          });
          upgradeCanvas = gl2Canvas;
        }

        if (!result && !forceCanonicalWebGL && !signal.aborted) {
          const syncStartedAt = performance.now();
          const syncCanvas = createCanvas(size, dpr);
          const syncRenderer = createOrbGL2(syncCanvas);
          if (syncRenderer) {
            result = {
              renderer: syncRenderer,
              durationMs: performance.now() - syncStartedAt,
              tier: 'webgl2',
            };
            upgradeCanvas = syncCanvas;
          }
        }

        if (signal.aborted || !mountedRef.current) return false;
        if (!result) return false;
        if (forceWebGLFirstFrameTimeoutId !== 0) {
          window.clearTimeout(forceWebGLFirstFrameTimeoutId);
          forceWebGLFirstFrameTimeoutId = 0;
        }

        const visibleCanvasAgeMs =
          visibleCanvasMountedAt > 0 ? performance.now() - visibleCanvasMountedAt : 0;
        const visibleUpgradeAgeMs =
          forceCanonicalWebGL && !explicitWebGLOverride
            ? result.durationMs
            : Math.max(result.durationMs, visibleCanvasAgeMs);
        if (!shouldApplyWorkerWebGLUpgrade(visibleUpgradeAgeMs, forceCanonicalWebGL || explicitWebGLOverride)) {
          rememberSlowWebGL(visibleUpgradeAgeMs);
          result.renderer.dispose();
          return false;
        }

        if (visibleUpgradeAgeMs > WEBGL_BUILD_BUDGET_MS) {
          rememberSlowWebGL(visibleUpgradeAgeMs);
        }

        if (shouldKeepCurrentVisibleCanvas()) {
          rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
          result.renderer.dispose();
          return true;
        }

        const previousCanvas = activeCanvas;
        markRendererTier(upgradeCanvas, 'webgl-main');
        glRenderer = result.renderer;
        glRendererRef.current = result.renderer;
        canvasElRef.current = upgradeCanvas;
        ctx2d = null;
        activeCanvas = upgradeCanvas;
        render = renderGL;
        attachWebGLListeners(upgradeCanvas);

        const state = stateRef.current;
        if (state) {
          try {
            renderGL(smoothValenceRef.current, state.time, state.particles);
          } catch (err) {
            recordError(err, { component: 'ValenceOrb', action: 'webgl-first-frame' });
            result.renderer.dispose();
            glRenderer = null;
            glRendererRef.current = null;
            canvasElRef.current = null;
            render = renderPendingWebGL;
            return false;
          }
        }

        if (wrapper.contains(previousCanvas)) {
          wrapper.replaceChild(upgradeCanvas, previousCanvas);
        } else {
          wrapper.appendChild(upgradeCanvas);
        }
        visibleCanvasMountedAt = performance.now();

        return true;
      };

      const upgradeToWebGPU = async (): Promise<boolean> => {
        const readinessTimeoutMs = forceCanonicalWebGL
          ? FORCED_WEBGL_READINESS_TIMEOUT_MS
          : WEBGL_READINESS_TIMEOUT_MS;
        const webGpuCanvas = createCanvas(size, dpr);
        const result: OrbWebGpuBuildResult | null = await createOrbWebGpuAsync(webGpuCanvas, {
          signal,
          timeoutMs: readinessTimeoutMs,
        });

        if (signal.aborted || !mountedRef.current) return false;
        if (!result) return false;
        if (forceWebGLFirstFrameTimeoutId !== 0) {
          window.clearTimeout(forceWebGLFirstFrameTimeoutId);
          forceWebGLFirstFrameTimeoutId = 0;
        }

        const visibleCanvasAgeMs =
          visibleCanvasMountedAt > 0 ? performance.now() - visibleCanvasMountedAt : 0;
        const visibleUpgradeAgeMs =
          forceCanonicalWebGL && !explicitWebGLOverride
            ? result.durationMs
            : Math.max(result.durationMs, visibleCanvasAgeMs);
        if (!shouldApplyWorkerWebGLUpgrade(visibleUpgradeAgeMs, forceCanonicalWebGL || explicitWebGLOverride)) {
          rememberSlowWebGL(visibleUpgradeAgeMs);
          result.renderer.dispose();
          return false;
        }

        if (visibleUpgradeAgeMs > WEBGL_BUILD_BUDGET_MS) {
          rememberSlowWebGL(visibleUpgradeAgeMs);
        }

        if (shouldKeepCurrentVisibleCanvas()) {
          rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
          result.renderer.dispose();
          return true;
        }

        const previousCanvas = activeCanvas;
        markRendererTier(webGpuCanvas, 'webgpu-main');
        webGpuRenderer = result.renderer;
        webGpuRendererRef.current = result.renderer;
        glRendererRef.current?.dispose();
        glRendererRef.current = null;
        canvasElRef.current = webGpuCanvas;
        ctx2d = null;
        activeCanvas = webGpuCanvas;
        render = renderWebGPU;

        const state = stateRef.current;
        if (state) {
          try {
            renderWebGPU(smoothValenceRef.current, state.time, state.particles);
          } catch (err) {
            recordError(err, { component: 'ValenceOrb', action: 'webgpu-first-frame' });
            result.renderer.dispose();
            webGpuRenderer = null;
            webGpuRendererRef.current = null;
            canvasElRef.current = null;
            render = renderPendingWebGL;
            return false;
          }
        }

        if (wrapper.contains(previousCanvas)) {
          wrapper.replaceChild(webGpuCanvas, previousCanvas);
        } else {
          wrapper.appendChild(webGpuCanvas);
        }
        visibleCanvasMountedAt = performance.now();

        return true;
      };

      const recoverFromWebGLStartupFailure = () => {
        if (webglStartupRecoveryStarted || signal.aborted || !mountedRef.current) return;
        webglStartupRecoveryStarted = true;

        if (!forceCanonicalWebGL) {
          degradeToCanvas2D();
          return;
        }

        if (!explicitWebGLOverride && visualReadyRef.current) {
          rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
          return;
        }

        void (async () => {
          const recoveredWithWebGL = await upgradeToMainThreadWebGL();
          if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
            if (canUseCanonicalCanvasRecovery) {
              degradeToCanvas2D();
            } else {
              setCtxFailed(true);
            }
          }
        })();
      };

      const upgradedWithWebGPU = await upgradeToWebGPU();
      if (upgradedWithWebGPU) return;
      if (!shouldTryWebGL(renderer) || signal.aborted) return;

      if ((renderer === 'auto' || renderer === 'webgl') && shouldUseWorkerWebGL(forceCanonicalWebGL, size)) {
        const workerStartedAt = performance.now();
        const workerCanvas = createCanvas(size, dpr);
        if (forceCanonicalWebGL) {
          workerCanvas.style.opacity = '0';
          workerCanvas.style.transition = 'opacity 160ms ease-out';
        }
        markRendererTier(workerCanvas, 'webgl-worker');
        const offscreen = workerCanvas.transferControlToOffscreen();
        const worker = new Worker(new URL('./orbWorker.ts', import.meta.url), {
          type: 'module',
          name: 'zenflow-orb-renderer',
        });
        webglWorker = worker;
        nextWorkerRenderId = 0;
        workerRenderInFlight = false;
        latestWorkerPayload = null;
        let workerStartupTimeoutId = 0;

        const clearWorkerStartupTimeout = () => {
          if (workerStartupTimeoutId !== 0) {
            window.clearTimeout(workerStartupTimeoutId);
            workerStartupTimeoutId = 0;
          }
        };

        const postWorkerRender = (payload: OrbWorkerPayload) => {
          if (signal.aborted || !mountedRef.current) return;
          workerRenderInFlight = true;
          worker.postMessage({
            type: 'render',
            requestId: ++nextWorkerRenderId,
            payload,
          });
        };

        const flushWorkerRender = () => {
          if (signal.aborted || !mountedRef.current) {
            workerRenderInFlight = false;
            latestWorkerPayload = null;
            return;
          }

          const nextPayload = latestWorkerPayload;
          latestWorkerPayload = null;
          if (nextPayload) {
            postWorkerRender(nextPayload);
            return;
          }
          workerRenderInFlight = false;
        };

        worker.onmessage = (
          event: MessageEvent<{ type: 'ready' | 'failed' | 'rendered'; reason?: string; requestId?: number }>,
        ) => {
          if (signal.aborted || !mountedRef.current) return;

          if (event.data.type === 'rendered') {
            clearWorkerStartupTimeout();
            if (activeCanvas !== workerCanvas || !wrapper.contains(workerCanvas)) {
              if (shouldKeepCurrentVisibleCanvas()) {
                rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
                clearWorkerStartupTimeout();
                worker.terminate();
                if (webglWorker === worker) webglWorker = null;
                if (workerRendererRef.current === workerRenderer) {
                  workerRendererRef.current = null;
                }
                workerRenderer = null;
                workerRenderInFlight = false;
                latestWorkerPayload = null;
                if (webGpuRendererRef.current) {
                  render = renderWebGPU;
                } else if (glRendererRef.current) {
                  render = renderGL;
                } else if (ctx2d) {
                  render = renderCanvas2D;
                } else {
                  render = renderPendingWebGL;
                }
                return;
              }

              const previousCanvas = activeCanvas;
              activeCanvas = workerCanvas;
              if (wrapper.contains(previousCanvas)) {
                wrapper.replaceChild(workerCanvas, previousCanvas);
              } else {
                wrapper.appendChild(workerCanvas);
              }
              visibleCanvasMountedAt = performance.now();
            }
            workerRendererRef.current = workerRenderer;
            canvasElRef.current = workerCanvas;
            ctx2d = null;
            render = renderWorkerGL;
            markVisualReadyRef.current();
            flushWorkerRender();
            return;
          }

          if (event.data.type === 'failed') {
            recordError(
              new Error(event.data.reason || 'Worker WebGL renderer failed'),
              { component: 'ValenceOrb', action: 'worker-webgl' },
            );
            clearWorkerStartupTimeout();
            worker.terminate();
            if (webglWorker === worker) webglWorker = null;
            recoverFromWebGLStartupFailure();
            return;
          }

          const readyDurationMs = performance.now() - workerStartedAt;
          const visibleCanvasAgeMs = performance.now() - visibleCanvasMountedAt;
          const visibleUpgradeAgeMs =
            forceCanonicalWebGL && !explicitWebGLOverride
              ? readyDurationMs
              : Math.max(readyDurationMs, visibleCanvasAgeMs);
          if (!shouldApplyWorkerWebGLUpgrade(visibleUpgradeAgeMs, forceCanonicalWebGL || explicitWebGLOverride)) {
            rememberSlowWebGL(visibleUpgradeAgeMs);
            clearWorkerStartupTimeout();
            worker.terminate();
            if (webglWorker === worker) webglWorker = null;
            return;
          }

          const controller: OrbWorkerController = {
            render(payload) {
              if (workerRenderInFlight) {
                latestWorkerPayload = payload;
                return;
              }
              postWorkerRender(payload);
            },
            dispose() {
              worker.postMessage({ type: 'dispose' });
              worker.terminate();
            },
          };

          workerRenderer = controller;

          const state = stateRef.current;
          if (state) {
            controller.render(createWorkerPayload(smoothValenceRef.current, state.time, state.particles));
          }
        };

        worker.onerror = () => {
          recordError(
            new Error('Worker WebGL renderer errored before first paint'),
            { component: 'ValenceOrb', action: 'worker-webgl-error' },
          );
          clearWorkerStartupTimeout();
          worker.terminate();
          if (webglWorker === worker) webglWorker = null;
          recoverFromWebGLStartupFailure();
        };

        if (forceCanonicalWebGL) {
          workerStartupTimeoutId = window.setTimeout(() => {
            if (signal.aborted || !mountedRef.current || visualReadyRef.current) return;
            clearWorkerStartupTimeout();
            worker.terminate();
            if (webglWorker === worker) webglWorker = null;
            if (workerRendererRef.current === workerRenderer) {
              workerRendererRef.current = null;
            }
            workerRenderer = null;
            workerRenderInFlight = false;
            latestWorkerPayload = null;
            recoverFromWebGLStartupFailure();
          }, FORCED_WEBGL_WORKER_STARTUP_TIMEOUT_MS);
        }

        worker.postMessage({ type: 'init', canvas: offscreen, size, dpr }, [offscreen]);
        return;
      }

      const recoveredWithWebGL = await upgradeToMainThreadWebGL();
      if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          setCtxFailed(true);
        }
      }
    };

    // ── Touch ripple handler (P2) ──
    const handlePointerDown = (e: PointerEvent) => {
      const rect = (canvasElRef.current ?? activeCanvas).getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
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
    let webglUpgradeStarted = false;
    let webglUpgradePendingUntilVisible = false;
    let pendingVisibilityRetryId = 0;
    const clearPendingVisibilityRetry = () => {
      if (pendingVisibilityRetryId !== 0) {
        window.clearTimeout(pendingVisibilityRetryId);
        pendingVisibilityRetryId = 0;
      }
    };
    const schedulePendingVisibilityRetry = () => {
      if (pendingVisibilityRetryId !== 0 || webglUpgradeAbort.signal.aborted) return;
      pendingVisibilityRetryId = window.setTimeout(() => {
        pendingVisibilityRetryId = 0;
        if (
          webglUpgradeAbort.signal.aborted ||
          webglUpgradeStarted ||
          !webglUpgradePendingUntilVisible
        ) {
          return;
        }
        if (isVisibleRef.current) {
          startWebGLUpgradeWhenVisible();
          return;
        }
        schedulePendingVisibilityRetry();
      }, WEBGL_VISIBILITY_RETRY_INTERVAL_MS);
    };
    const armForcedWebGLFirstFrameTimeout = () => {
      if (!forceCanonicalWebGL || forceWebGLFirstFrameTimeoutId !== 0) return;
      forceWebGLFirstFrameTimeoutId = window.setTimeout(
        recoverForcedWebGLFirstFrame,
        WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS,
      );
    };
    const recoverForcedWebGLFirstFrame = () => {
      if (
        !forceCanonicalWebGL ||
        forceWebGLStartupRecovered ||
        visualReadyRef.current ||
        webglUpgradeAbort.signal.aborted ||
        !mountedRef.current
      ) {
        return;
      }

      forceWebGLStartupRecovered = true;
      forceWebGLFirstFrameTimeoutId = 0;
      cancelWebGLUpgrade();
      webglWorker?.terminate();
      webglWorker = null;
      workerRendererRef.current?.dispose();
      workerRendererRef.current = null;
      webGpuRendererRef.current?.dispose();
      webGpuRendererRef.current = null;
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      workerRenderer = null;
      webGpuRenderer = null;
      glRenderer = null;

      if (canUseCanonicalCanvasRecovery) {
        degradeToCanvas2D();
      } else {
        setCtxFailed(true);
      }
    };
    const startWebGLUpgradeWhenVisible = () => {
      if (webglUpgradeAbort.signal.aborted || webglUpgradeStarted) return;

      if (!isVisibleRef.current) {
        webglUpgradePendingUntilVisible = true;
        schedulePendingVisibilityRetry();
        return;
      }

      clearPendingVisibilityRetry();
      webglUpgradePendingUntilVisible = false;
      webglUpgradeStarted = true;
      armForcedWebGLFirstFrameTimeout();
      void upgradeToWebGL(webglUpgradeAbort.signal);
    };

    let upgradeVisibilityObserver: IntersectionObserver | null = null;
    if (typeof IntersectionObserver !== "undefined") {
      upgradeVisibilityObserver = new IntersectionObserver(
        ([entry]) => {
          isVisibleRef.current = entry.isIntersecting;
          if (!entry.isIntersecting) {
            resetFrameClock();
          } else {
            restartAnimationClock();
          }
          if (entry.isIntersecting && webglUpgradePendingUntilVisible) {
            startWebGLUpgradeWhenVisible();
          }
        },
        { threshold: 0 },
      );
      upgradeVisibilityObserver.observe(wrapper);
    }

    // ── Cleanup ──
    const cleanup = () => {
      disposed = true;
      rememberOrbRuntimeSnapshot(
        renderer,
        size,
        stateRef.current,
        smoothValenceRef.current,
        performance.now(),
      );
      webglUpgradeAbort.abort();
      window.clearTimeout(forceWebGLFirstFrameTimeoutId);
      clearPendingVisibilityRetry();
      cancelWebGLUpgrade();
      cancelNextFrame();
      upgradeVisibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
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
      webGpuRendererRef.current?.dispose();
      webGpuRendererRef.current = null;
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
    const shouldAnimateOrb = shouldAnimateCanonicalOrb();
    if (canUseCanonicalCanvasRecovery) {
      renderCanonicalCanvasFirstPaint();
    }

    if (!shouldAnimateOrb && !forceCanonicalWebGL) {
      try { render(valenceRef.current, 0, stateRef.current.particles); } catch { /* graceful: initial frame render failure leaves the canvas untouched */ }
      return cleanup;
    }

    if (!glRenderer) {
      const webglUpgradeScheduling = reserveCanonicalWebGLUpgradeScheduling(
        forceCanonicalWebGL,
        size,
      );
      cancelWebGLUpgrade = scheduleAfterFirstPaint(() => {
        startWebGLUpgradeWhenVisible();
      }, {
        delayMs: webglUpgradeScheduling.delayMs,
        preferIdle: webglUpgradeScheduling.preferIdle,
      });
    }

    if (shouldAnimateOrb) {
      requestNextFrame();
    }

    return cleanup;
  }, [renderer, size]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimateCanonicalOrb()) return;

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
      markVisualReadyRef.current();
      return;
    }

    if (webGpuRendererRef.current) {
      webGpuRendererRef.current.render({
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
      markVisualReadyRef.current();
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
      markVisualReadyRef.current();
    } else {
      if (renderer === 'webgl' || getRendererOverride() === 'webgl') return;
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
      markVisualReadyRef.current();
    }
  }, [valence, size, renderer]);

  if (ctxFailed) {
    return (
      <div
        ref={wrapperRef}
        className="relative flex items-center justify-center flex-shrink-0"
        data-orb-transition-profile={transitionProfile}
        data-orb-animation-speed={animationSpeed}
        data-orb-renderer-policy={renderer}
        style={{
          width: size,
          height: size,
          contain: 'layout paint style',
          isolation: 'isolate',
          willChange: 'transform',
          transform: 'translateZ(0)',
          backfaceVisibility: 'hidden',
        }}
        aria-hidden="true"
      />
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="relative flex items-center justify-center"
      data-orb-transition-profile={transitionProfile}
      data-orb-animation-speed={animationSpeed}
      data-orb-renderer-policy={renderer}
      style={{
        width: size,
        height: size,
        touchAction: 'manipulation',
        contain: 'layout paint style',
        isolation: 'isolate',
        willChange: 'transform',
        transform: 'translateZ(0)',
        backfaceVisibility: 'hidden',
      }}
      aria-hidden="true"
    />
  );
});
