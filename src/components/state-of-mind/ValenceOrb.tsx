/**
 * ValenceOrb — GPU-accelerated orb for State of Mind valence step.
 *
 * Progressive enhancement (Law 22 — probe highest tier first):
 *   WebGPU available → WGSL shader (preferred Chrome/desktop tier)
 *   WebGL 2.0 available → GLSL 300 es shader (10/10 quality, 60fps capable)
 *   WebGL 1.0 available → GLSL ES 1.0 shader (10/10 quality, 60fps capable)
 *   None available → Canvas 2D fallback only for non-forced/debug surfaces
 *
 * Both paths share the same particle system, shape presets, and color mapping.
 * Context loss recovery: non-forced surfaces may fall back; forced canonical surfaces stay WebGL-only.
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
import { createOrbGL2Async, createOrbGLAsync } from './orbShader';
import { createOrbWebGPUAsync } from './orbWebGpu';
import type { Particle } from './particleSystem';
import type { OrbGLBuildResult, OrbGLRenderer } from './orbShader';

// Module-level: genesis plays only once per browser session
let genesisPlayed = false;

function recordCanonicalOrbFailure(action: string) {
  recordError(
    new Error(`Canonical orb runtime failure: ${action}`),
    { component: 'ValenceOrb', action },
  );
}

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
  /** Fires once when no canonical renderer can produce a real frame. */
  onVisualError?: () => void;
}

type OrbWorkerPayload = {
  valence: number;
  time: number;
  organicTime: number;
  paletteTime: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
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

export type OrbRuntimeProbeSource = "canvas2d" | "webgl-main" | "webgpu-main" | "webgl-worker";

export interface OrbRuntimeProbeSample {
  source: OrbRuntimeProbeSource;
  rendererPolicy: OrbRendererMode;
  rendererTier: string | null;
  size: number;
  renderedValence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
  renderedAt: number;
  postedAt?: number;
  requestId?: number;
}

export interface OrbLifecycleProbeEvent {
  at: number;
  event: string;
  details?: Record<string, boolean | number | string | null>;
}

declare global {
  interface Window {
    __zenOrbClockProbeSink?: (sample: OrbRuntimeProbeSample) => void;
    __zenOrbLifecycleProbeSink?: (event: OrbLifecycleProbeEvent) => void;
  }
}

type OrbClockProbeLocation = Pick<Location | URL, "hostname" | "port" | "protocol">;

export function isOrbClockProbeAllowed(
  location: OrbClockProbeLocation,
  mode = import.meta.env.MODE,
): boolean {
  if (location.protocol !== "http:") return false;
  if (
    location.hostname === "127.0.0.1" ||
    location.hostname === "::1" ||
    location.hostname === "[::1]"
  ) {
    return true;
  }
  if (location.hostname !== "localhost") return false;
  return location.port !== "" || mode === "development" || mode === "test";
}

interface OrbRuntimeState {
  targetValence: number;
  currentValence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
  particles: Particle[];
  lastFrame: number;
  lastWallFrame: number;
}

const WEBGL_FRAME_INTERVAL = 1000 / 60; // 60fps for healthy WebGL sessions.
const CANVAS_FRAME_INTERVAL = 1000 / 30; // 30fps for Canvas 2D fallback
const ORB_FRAME_INTERVAL_EARLY_TOLERANCE_MS = 1;
const ORB_FRAME_CLOCK_REANCHOR_GAP_MS = 750;
const ORB_FRAME_CLOCK_BURST_SKEW_MS = 20;
const ORB_MAX_FRAME_DELTA_SECONDS = 0.05;
const ORB_MAX_TRANSITION_DELTA_SECONDS = 0.12;
const ORB_ROTATION_PHASE_WRAP_RADIANS = Math.PI * 2;
const ORB_PULSE_PHASE_WRAP = 1;
export const ORB_CANONICAL_PULSE_CYCLES_PER_SECOND = 0.15;
export const ORB_SHADER_TIME_WRAP_SECONDS = Math.PI * 6000;
export const ORB_GPU_ORGANIC_TIME_WRAP_SECONDS = 86_700;
export const ORB_GPU_NOISE_PHASE_WRAP = 8_670;
export const ORB_GPU_PALETTE_TIME_WRAP_SECONDS = 250;
export const ORB_REDUCED_MOTION_STILL_TIME_SECONDS = 1.2;

export function resolveReducedMotionOrbStillTime(currentTime: number): number {
  if (Number.isFinite(currentTime) && currentTime >= 0.5) return currentTime;
  return ORB_REDUCED_MOTION_STILL_TIME_SECONDS;
}

export function resolveOrbRotationSpeed(valence: number): number {
  const normalized = (Math.max(-1, Math.min(1, valence)) + 1) * 0.5;
  return 0.055 + (0.015 - 0.055) * normalized;
}

export function resolveOrbNoiseSpeed(valence: number): number {
  const normalized = (Math.max(-1, Math.min(1, valence)) + 1) * 0.5;
  return 0.85 + (0.20 - 0.85) * normalized;
}

export function resolveOrbMotionPhase(
  previousPhase: number,
  deltaSeconds: number,
  valence: number,
  animationSpeed: number,
): number {
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  return normalizeOrbShaderTime(
    previousPhase + safeDelta * safeSpeed * resolveOrbRotationSpeed(valence),
    ORB_ROTATION_PHASE_WRAP_RADIANS,
  );
}

export function resolveOrbNoisePhase(
  previousPhase: number,
  deltaSeconds: number,
  valence: number,
  animationSpeed: number,
): number {
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  const safePrevious = Number.isFinite(previousPhase) && previousPhase >= 0
    ? previousPhase
    : 0;
  return safePrevious + safeDelta * safeSpeed * resolveOrbNoiseSpeed(valence);
}

export function resolveOrbPulsePhase(
  previousPhase: number,
  deltaSeconds: number,
  animationSpeed: number,
): number {
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  return normalizeOrbShaderTime(
    previousPhase + safeDelta * safeSpeed * ORB_CANONICAL_PULSE_CYCLES_PER_SECOND,
    ORB_PULSE_PHASE_WRAP,
  );
}

export function resolveOrbPulsePhaseAtTime(
  timeSeconds: number,
  animationSpeed: number,
): number {
  const safeTime = Number.isFinite(timeSeconds) && timeSeconds > 0 ? timeSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  return normalizeOrbShaderTime(
    safeTime * safeSpeed * ORB_CANONICAL_PULSE_CYCLES_PER_SECOND,
    ORB_PULSE_PHASE_WRAP,
  );
}

export function resolveOrbBreathPeriodSeconds(valence: number): number {
  return 12 + Math.max(-1, Math.min(1, valence)) * 4;
}

export function resolveOrbBreathPhase(
  previousPhase: number,
  deltaSeconds: number,
  valence: number,
  animationSpeed: number,
): number {
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  return normalizeOrbShaderTime(
    previousPhase +
      (safeDelta * safeSpeed) / resolveOrbBreathPeriodSeconds(valence),
    ORB_PULSE_PHASE_WRAP,
  );
}

export function resolveOrbBreathPhaseAtTime(
  timeSeconds: number,
  valence: number,
  animationSpeed: number,
): number {
  const safeTime = Number.isFinite(timeSeconds) && timeSeconds > 0 ? timeSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;
  return normalizeOrbShaderTime(
    (safeTime * safeSpeed) / resolveOrbBreathPeriodSeconds(valence),
    ORB_PULSE_PHASE_WRAP,
  );
}

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
export const ORB_WORKER_STARTUP_TIMEOUT_MS = 12000;
export const ORB_WORKER_RENDER_ACK_TIMEOUT_MS = 1500;
export const ORB_WORKER_FIRST_PRESENTATION_ACK_TIMEOUT_MS = 12000;
const ORB_WORKER_RENDER_ACK_TIMEOUT_MAX_MS = 4000;
const ORB_WORKER_RENDER_ACK_LATENCY_MULTIPLIER = 4;
export const ORB_WORKER_STATIC_HEALTHCHECK_MS = 5000;
const ORB_GPU_RECOVERY_MAX_ATTEMPTS = 2;
export const ORB_GPU_RECOVERY_LIFETIME_MAX_ATTEMPTS = 3;
export const ORB_GPU_RECOVERY_WINDOW_MS = 1500;
export const WEBGL_VISIBLE_UPGRADE_DEADLINE_MS = 1200;
const WEBGL_UPGRADE_DELAY_MS = 180;
const MINI_WEBGL_UPGRADE_DELAY_MS = 900;
const MINI_WEBGL_UPGRADE_QUEUE_GAP_MS = 6000;
const ORB_IDLE_WAKE_SOFT_EPSILON = 0.01;
const ORB_SUBTLE_TRANSITION_SHIMMER = 0.12;
const ORB_SUBTLE_TRANSITION_SHIMMER_DELTA = 0.3;
const MINI_ORB_CANONICAL_SIZE = 120;
const ORB_RUNTIME_SNAPSHOT_TTL_MS = 10_000;
const ORB_RUNTIME_SNAPSHOT_VALENCE_EPSILON = 0.001;
const ORB_FIRST_VISIBLE_PRESENTATION_BUDGET_MS = 3000;

let nextMiniWebGLUpgradeStartAt = 0;

export function resolveOrbWorkerAckTimeoutMs(
  lastAckLatencyMs?: number | null,
  firstPresentationPending = false,
): number {
  if (firstPresentationPending) {
    return ORB_WORKER_FIRST_PRESENTATION_ACK_TIMEOUT_MS;
  }
  if (!Number.isFinite(lastAckLatencyMs) || (lastAckLatencyMs ?? 0) <= 0) {
    return ORB_WORKER_RENDER_ACK_TIMEOUT_MS;
  }

  return Math.min(
    ORB_WORKER_RENDER_ACK_TIMEOUT_MAX_MS,
    Math.max(
      ORB_WORKER_RENDER_ACK_TIMEOUT_MS,
      Math.ceil((lastAckLatencyMs as number) * ORB_WORKER_RENDER_ACK_LATENCY_MULTIPLIER),
    ),
  );
}

function waitForNextOrbPresentationFrame(signal: AbortSignal): Promise<boolean> {
  if (signal.aborted) return Promise.resolve(false);

  return new Promise((resolve) => {
    let settled = false;
    const finish = (ready: boolean) => {
      if (settled) return;
      settled = true;
      signal.removeEventListener('abort', handleAbort);
      if (!ready) cancelAnimationFrame(frameId);
      resolve(ready);
    };
    const handleAbort = () => finish(false);
    const frameId = requestAnimationFrame(() => finish(true));
    signal.addEventListener('abort', handleAbort, { once: true });
  });
}

type OrbRuntimeSnapshot = {
  targetValence: number;
  time: number;
  motionPhase: number;
  noisePhase: number;
  pulsePhase: number;
  breathPhase: number;
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
    motionPhase: state.motionPhase,
    noisePhase: state.noisePhase,
    pulsePhase: state.pulsePhase,
    breathPhase: state.breathPhase,
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
export type OrbRendererMode = "auto" | "canvas" | "webgpu" | "webgl";

export function isActiveOrbWorkerRenderAck(
  requestId: number | undefined,
  activeRequestId: number,
  renderInFlight: boolean,
): requestId is number {
  return (
    renderInFlight &&
    requestId !== undefined &&
    activeRequestId !== 0 &&
    requestId === activeRequestId
  );
}

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

export function isOrbFrameDue(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  frameIntervalMs: number,
): boolean {
  if (!Number.isFinite(currentFrameAtMs)) return false;
  if (!Number.isFinite(previousFrameAtMs) || previousFrameAtMs <= 0) return true;
  if (!Number.isFinite(frameIntervalMs) || frameIntervalMs <= 0) return true;

  const elapsedMs = currentFrameAtMs - previousFrameAtMs;
  return Number.isFinite(elapsedMs) &&
    elapsedMs >= 0 &&
    elapsedMs + ORB_FRAME_INTERVAL_EARLY_TOLERANCE_MS >= frameIntervalMs;
}

export function resolveOrbFrameDeltaSeconds(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  previousWallFrameAtMs = previousFrameAtMs,
  currentWallFrameAtMs = currentFrameAtMs,
): number {
  const elapsedMs = resolveOrbVisibleFrameElapsedMs(
    previousFrameAtMs,
    currentFrameAtMs,
    previousWallFrameAtMs,
    currentWallFrameAtMs,
  );
  if (elapsedMs <= 0) return 0;

  return Math.min(elapsedMs / 1000, ORB_MAX_FRAME_DELTA_SECONDS);
}

export function resolveOrbTransitionDeltaSeconds(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  previousWallFrameAtMs = previousFrameAtMs,
  currentWallFrameAtMs = currentFrameAtMs,
): number {
  const elapsedMs = resolveOrbVisibleFrameElapsedMs(
    previousFrameAtMs,
    currentFrameAtMs,
    previousWallFrameAtMs,
    currentWallFrameAtMs,
  );
  if (elapsedMs <= 0) return 0;

  return Math.min(elapsedMs / 1000, ORB_MAX_TRANSITION_DELTA_SECONDS);
}

export function resolveOrbWorkerFrameDeltaSeconds(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  previousWallFrameAtMs = previousFrameAtMs,
  currentWallFrameAtMs = currentFrameAtMs,
): number {
  const elapsedMs = resolveOrbVisibleFrameElapsedMs(
    previousFrameAtMs,
    currentFrameAtMs,
    previousWallFrameAtMs,
    currentWallFrameAtMs,
  );
  if (elapsedMs <= 0) return 0;

  return Math.min(elapsedMs / 1000, ORB_MAX_FRAME_DELTA_SECONDS);
}

export function resolveOrbVisibleFrameElapsedMs(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  previousWallFrameAtMs: number,
  currentWallFrameAtMs: number,
): number {
  if (!Number.isFinite(previousFrameAtMs) || previousFrameAtMs <= 0) return 0;
  if (!Number.isFinite(currentFrameAtMs)) return 0;
  if (!Number.isFinite(previousWallFrameAtMs) || previousWallFrameAtMs <= 0) return 0;
  if (!Number.isFinite(currentWallFrameAtMs)) return 0;

  const frameElapsedMs = currentFrameAtMs - previousFrameAtMs;
  const wallElapsedMs = currentWallFrameAtMs - previousWallFrameAtMs;
  if (!Number.isFinite(frameElapsedMs) || frameElapsedMs <= 0) return 0;
  if (!Number.isFinite(wallElapsedMs) || wallElapsedMs <= 0) return 0;
  if (
    frameElapsedMs > ORB_FRAME_CLOCK_REANCHOR_GAP_MS ||
    wallElapsedMs > ORB_FRAME_CLOCK_REANCHOR_GAP_MS
  ) {
    return 0;
  }

  if (frameElapsedMs - wallElapsedMs > ORB_FRAME_CLOCK_BURST_SKEW_MS) {
    return wallElapsedMs;
  }

  return frameElapsedMs;
}

export function resolveOrbWorkerTransitionDeltaSeconds(
  previousFrameAtMs: number,
  currentFrameAtMs: number,
  previousWallFrameAtMs = previousFrameAtMs,
  currentWallFrameAtMs = currentFrameAtMs,
): number {
  return resolveOrbTransitionDeltaSeconds(
    previousFrameAtMs,
    currentFrameAtMs,
    previousWallFrameAtMs,
    currentWallFrameAtMs,
  );
}

function normalizeOrbShaderTime(timeSeconds: number, wrapSeconds = ORB_SHADER_TIME_WRAP_SECONDS): number {
  if (!Number.isFinite(wrapSeconds) || wrapSeconds <= 0) return 0;
  if (!Number.isFinite(timeSeconds)) return 0;

  const wrapped = timeSeconds % wrapSeconds;
  return wrapped < 0 ? wrapped + wrapSeconds : wrapped;
}

export function resolveOrbWrappedTimeDelta(
  previousTimeSeconds: number,
  currentTimeSeconds: number,
  wrapSeconds = ORB_SHADER_TIME_WRAP_SECONDS,
): number {
  if (!Number.isFinite(wrapSeconds) || wrapSeconds <= 0) return 0;
  if (!Number.isFinite(previousTimeSeconds) || !Number.isFinite(currentTimeSeconds)) return 0;

  const previous = normalizeOrbShaderTime(previousTimeSeconds, wrapSeconds);
  const current = normalizeOrbShaderTime(currentTimeSeconds, wrapSeconds);
  const delta = current - previous;

  return delta >= 0 ? delta : delta + wrapSeconds;
}

export function resolveOrbShaderTime(
  previousTimeSeconds: number,
  deltaSeconds: number,
  animationSpeed: number,
): number {
  const previous = Number.isFinite(previousTimeSeconds) && previousTimeSeconds >= 0
    ? previousTimeSeconds
    : 0;
  const safeDelta = Number.isFinite(deltaSeconds) && deltaSeconds > 0 ? deltaSeconds : 0;
  const safeSpeed = Number.isFinite(animationSpeed) && animationSpeed > 0 ? animationSpeed : 0;

  return previous + safeDelta * safeSpeed;
}

export function resolveOrbGpuShaderTime(timeSeconds: number): number {
  return normalizeOrbShaderTime(timeSeconds, ORB_SHADER_TIME_WRAP_SECONDS);
}

export function resolveOrbGpuOrganicTime(timeSeconds: number): number {
  return normalizeOrbShaderTime(timeSeconds, ORB_GPU_ORGANIC_TIME_WRAP_SECONDS);
}

export function resolveOrbGpuPaletteTime(timeSeconds: number): number {
  return normalizeOrbShaderTime(timeSeconds, ORB_GPU_PALETTE_TIME_WRAP_SECONDS);
}

export function resolveOrbGpuNoisePhase(noisePhase: number): number {
  return normalizeOrbShaderTime(noisePhase, ORB_GPU_NOISE_PHASE_WRAP);
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

function markRendererTier(canvas: HTMLCanvasElement, tier: 'canvas2d' | 'webgpu-main' | 'webgl-main' | 'webgl-worker') {
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
    if (requested === 'canvas' || requested === 'webgpu' || requested === 'webgl') return requested;
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
  if (override === 'webgpu') return true;
  if (override === 'webgl') return true;
  if (mode === 'canvas') return false;
  if (mode === 'webgpu') return true;
  if (mode === 'webgl') return true;
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
      delayMs: 0,
      preferIdle: false,
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

export function shouldPreferWorkerWebGLBeforeMainThreadWebGPU(
  forceCanonicalWebGL: boolean,
  size = Number.POSITIVE_INFINITY,
): boolean {
  return (
    forceCanonicalWebGL &&
    isPhoneLikeViewport() &&
    shouldUseWorkerWebGL(forceCanonicalWebGL, size)
  );
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
  onVisualError,
}: ValenceOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
  const workerRendererRef = useRef<OrbWorkerController | null>(null);
  const recoverCanonicalGpuLossRef = useRef<(allowRestoredContext?: boolean) => void>(() => {});
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const firstPaintReadyRef = useRef(false);
  const visualReadyRef = useRef(false);
  const visualErrorReportedRef = useRef(false);
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
  const onVisualErrorRef = useRef(onVisualError);
  onVisualErrorRef.current = onVisualError;
  const markVisualErrorRef = useRef<() => void>(() => {});
  markVisualErrorRef.current = () => {
    wrapperRef.current?.querySelectorAll('canvas').forEach((canvas) => canvas.remove());
    canvasElRef.current = null;
    setCtxFailed(true);
    if (visualErrorReportedRef.current) return;
    visualErrorReportedRef.current = true;
    onVisualErrorRef.current?.();
  };
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
    if (visualErrorReportedRef.current) return;
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

    if (
      shouldAnimateCanonicalOrb() &&
      Math.abs(valence - state.currentValence) > ORB_SUBTLE_TRANSITION_SHIMMER_DELTA
    ) {
      shimmerRef.current = Math.max(shimmerRef.current, ORB_SUBTLE_TRANSITION_SHIMMER);
    } else if (!shouldAnimateCanonicalOrb()) {
      shimmerRef.current = 0;
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
    const snapshotMotionPhase = runtimeSnapshot?.motionPhase;
    const snapshotNoisePhase = runtimeSnapshot?.noisePhase;
    const snapshotPulsePhase = runtimeSnapshot?.pulsePhase;
    const snapshotBreathPhase = runtimeSnapshot?.breathPhase;
    const initialMotionPhase =
      typeof snapshotMotionPhase === "number" && Number.isFinite(snapshotMotionPhase)
        ? snapshotMotionPhase
        : normalizeOrbShaderTime(
            initialTime * resolveOrbRotationSpeed(initialSmoothValence),
            ORB_ROTATION_PHASE_WRAP_RADIANS,
          );
    const initialNoisePhase =
      typeof snapshotNoisePhase === "number" && Number.isFinite(snapshotNoisePhase)
        ? snapshotNoisePhase
        : normalizeOrbShaderTime(initialTime * resolveOrbNoiseSpeed(initialSmoothValence));
    const initialPulsePhase =
      typeof snapshotPulsePhase === "number" && Number.isFinite(snapshotPulsePhase)
        ? snapshotPulsePhase
        : normalizeOrbShaderTime(
            initialTime * ORB_CANONICAL_PULSE_CYCLES_PER_SECOND,
            ORB_PULSE_PHASE_WRAP,
          );
    const initialBreathPhase =
      typeof snapshotBreathPhase === "number" && Number.isFinite(snapshotBreathPhase)
        ? snapshotBreathPhase
        : normalizeOrbShaderTime(
            initialTime / resolveOrbBreathPeriodSeconds(initialSmoothValence),
            ORB_PULSE_PHASE_WRAP,
          );

    targetValenceRef.current = valenceRef.current;
    smoothValenceRef.current = initialSmoothValence;
    stateRef.current = {
      targetValence: valenceRef.current,
      currentValence: initialCurrentValence,
      time: initialTime,
      motionPhase: initialMotionPhase,
      noisePhase: initialNoisePhase,
      pulsePhase: initialPulsePhase,
      breathPhase: initialBreathPhase,
      particles: createParticlePool(PARTICLE_COUNT, cx, cy, innerR, outerR),
      lastFrame: 0,
      lastWallFrame: 0,
    };
    const shouldAnimateOrb = shouldAnimateCanonicalOrb();
    if (!shouldAnimateOrb) {
      const stillTime = resolveReducedMotionOrbStillTime(stateRef.current.time);
      stateRef.current.time = stillTime;
      stateRef.current.pulsePhase = resolveOrbPulsePhaseAtTime(
        stillTime,
        animationSpeedRef.current,
      );
      stateRef.current.breathPhase = resolveOrbBreathPhaseAtTime(
        stillTime,
        initialSmoothValence,
        animationSpeedRef.current,
      );
    }

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
    const explicitWebGLOverride = rendererOverride === 'webgl' || rendererOverride === 'webgpu';
    const forceCanonicalWebGL =
      !debugCanvasFallbackAllowed &&
      (renderer === 'webgl' || renderer === 'webgpu' || rendererOverride === 'webgl' || rendererOverride === 'webgpu');
    const canUseCanonicalCanvasRecovery = !forceCanonicalWebGL || debugCanvasFallbackAllowed;
    let activeCanvas = createCanvas(size, canvasDpr);
    let glRenderer: OrbGLRenderer | null = null;
    let workerRenderer: OrbWorkerController | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;
    let webglEventCanvas: HTMLCanvasElement | null = null;
    let webglWorker: Worker | null = null;
    let nextWorkerRenderId = 0;
    let workerRenderInFlight = false;
    let latestWorkerPayload: OrbWorkerPayload | null = null;
    let lastWorkerPayload: OrbWorkerPayload | null = null;
    const workerProbePayloads = new Map<number, { payload: OrbWorkerPayload; postedAt: number }>();
    let forceWebGLStartupRecovered = false;
    let canonicalGpuLossRecoveryStarted = false;
    let canonicalGpuRecoveryAttemptTimes: number[] = [];
    let canonicalGpuRecoveryLifetimeAttempts = 0;
    let canonicalGpuRecoveryBudgetReported = false;
    let canonicalGpuRecoveryLifetimeBudgetReported = false;
    let canonicalRestoredContextBypassUsed = false;
    let canonicalGpuRecoveryRetryTimeoutId = 0;
    let canonicalWebGLContextRestorePending = false;
    let canonicalRestoredContextRetryPending = false;
    let recoverCanonicalGpuLoss = (_allowRestoredContext = false) => {};
    let clearWorkerWatchdogs = () => {};
    let resumeWorkerWatchdogs = () => {};
    let webglUpgradeStarted = false;
    let webglUpgradePendingUntilVisible = false;
    let armForcedWebGLFirstFrameTimeout = () => {};
    let mainRendererUpgradeGeneration = 0;
    const orbClockProbeEnabled =
      isOrbClockProbeAllowed(window.location) &&
      new URLSearchParams(window.location.search).get("orbClockProbe") === "true";
    let orbClockProbeFailed = false;
    let orbLifecycleProbeFailed = false;

    const publishOrbLifecycleProbe = (
      event: string,
      details?: OrbLifecycleProbeEvent["details"],
    ) => {
      if (!orbClockProbeEnabled || orbLifecycleProbeFailed) return;
      const sink = window.__zenOrbLifecycleProbeSink;
      if (!sink) return;

      try {
        sink({ at: performance.now(), event, ...(details ? { details } : {}) });
      } catch {
        orbLifecycleProbeFailed = true;
        recordCanonicalOrbFailure('lifecycle-probe');
      }
    };

    const publishOrbClockProbeSample = (
      source: OrbRuntimeProbeSource,
      payload: Pick<
        OrbWorkerPayload,
        "valence" | "time" | "motionPhase" | "noisePhase" | "pulsePhase" | "breathPhase"
      >,
      metadata: { renderedAt?: number; postedAt?: number; requestId?: number } = {},
    ) => {
      if (!orbClockProbeEnabled || orbClockProbeFailed) return;
      const sink = window.__zenOrbClockProbeSink;
      if (!sink) return;

      try {
        sink({
          source,
          rendererPolicy: renderer,
          rendererTier: canvasElRef.current?.getAttribute("data-orb-renderer-tier") ?? null,
          size,
          renderedValence: payload.valence,
          time: payload.time,
          motionPhase: payload.motionPhase,
          noisePhase: payload.noisePhase,
          pulsePhase: payload.pulsePhase,
          breathPhase: payload.breathPhase,
          renderedAt: metadata.renderedAt ?? performance.now(),
          ...(metadata.postedAt === undefined ? {} : { postedAt: metadata.postedAt }),
          ...(metadata.requestId === undefined ? {} : { requestId: metadata.requestId }),
        });
      } catch {
        orbClockProbeFailed = true;
        recordCanonicalOrbFailure('clock-probe');
      }
    };

    if (canUseCanonicalCanvasRecovery) {
      markRendererTier(activeCanvas, 'canvas2d');
      try {
        ctx2d = activeCanvas.getContext('2d', { willReadFrequently: false });
      } catch {
        recordCanonicalOrbFailure('canvas2d-probe');
        ctx2d = null;
      }

      if (!ctx2d && !forceCanonicalWebGL) {
        markVisualErrorRef.current();
        return;
      }
    }

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

    const resolveOrbGenesis = (timestamp: number): number =>
      shouldAnimateCanonicalOrb() ? computeGenesis(timestamp) : 1.0;

    // ── Touch state ──
    const computeTouch = (time: number): { x: number; y: number; age: number } => {
      const tc = touchRef.current;
      if (!tc) return { x: 0, y: 0, age: 0 };
      const age = resolveOrbWrappedTimeDelta(tc.startTime, time);
      if (age > 1.5) { touchRef.current = null; return { x: 0, y: 0, age: 0 }; }
      return { x: tc.x, y: tc.y, age };
    };

    // ── Render helpers ──
    const createMainGLPayload = (
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
      particles: Particle[],
      timestamp = performance.now(),
    ): Parameters<OrbGLRenderer['render']>[0] => {
      // P5: Color breathing — ±2° hue oscillation for organic life
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;

      return {
        valence: v,
        time: resolveOrbGpuShaderTime(t),
        organicTime: resolveOrbGpuOrganicTime(t),
        paletteTime: resolveOrbGpuPaletteTime(t),
        motionPhase,
        noisePhase: resolveOrbGpuNoisePhase(noisePhase),
        pulsePhase: stateRef.current?.pulsePhase ?? 0,
        breathPhase: stateRef.current?.breathPhase ?? 0,
        size,
        dpr,
        isDark: isDarkRead(),
        color,
        shape: getShapeParams(v),
        particles,
        genesis: resolveOrbGenesis(timestamp),
        touch: computeTouch(t),
        shimmer: shimmerRef.current,
      };
    };

    const publishMainGLPresentation = (
      canvas: HTMLCanvasElement | null,
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
    ) => {
      const rendererTier = canvas?.getAttribute("data-orb-renderer-tier");
      publishOrbClockProbeSample(rendererTier === "webgpu-main" ? "webgpu-main" : "webgl-main", {
        valence: v,
        time: t,
        motionPhase,
        noisePhase,
        pulsePhase: stateRef.current?.pulsePhase ?? 0,
        breathPhase: stateRef.current?.breathPhase ?? 0,
      });
      markVisualReadyRef.current();
    };

    const renderGL = (
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
      particles: Particle[],
      timestamp = performance.now(),
    ) => {
      const gl = glRendererRef.current;
      if (!gl) return;
      gl.render(createMainGLPayload(v, t, motionPhase, noisePhase, particles, timestamp));
      publishMainGLPresentation(canvasElRef.current, v, t, motionPhase, noisePhase);
    };

    const createWorkerPayload = (
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
      particles: Particle[],
      timestamp = performance.now(),
    ): OrbWorkerPayload => {
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;

      return {
        valence: v,
        time: resolveOrbGpuShaderTime(t),
        organicTime: resolveOrbGpuOrganicTime(t),
        paletteTime: resolveOrbGpuPaletteTime(t),
        motionPhase,
        noisePhase: resolveOrbGpuNoisePhase(noisePhase),
        pulsePhase: stateRef.current?.pulsePhase ?? 0,
        breathPhase: stateRef.current?.breathPhase ?? 0,
        size,
        dpr,
        isDark: isDarkRead(),
        color,
        shape: getShapeParams(v),
        particles,
        genesis: resolveOrbGenesis(timestamp),
        touch: computeTouch(t),
        shimmer: shimmerRef.current,
      };
    };

    const renderWorkerGL = (
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
      particles: Particle[],
      timestamp = performance.now(),
    ) => {
      workerRenderer?.render(createWorkerPayload(v, t, motionPhase, noisePhase, particles, timestamp));
    };

    const renderCanvas2D = (
      v: number,
      t: number,
      motionPhase: number,
      noisePhase: number,
      particles: Particle[],
      _timestamp?: number,
    ) => {
      if (!ctx2d) return;
      const effectiveDpr = Math.max(1, (canvasElRef.current?.width ?? size) / size);
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        motionPhase,
        noisePhase,
        breathPhase: stateRef.current?.breathPhase ?? 0,
        particles,
        size,
        dpr: effectiveDpr,
        isDark: isDarkRead(),
        shimmer: shimmerRef.current,
      });
      publishOrbClockProbeSample("canvas2d", {
        valence: v,
        time: t,
        motionPhase,
        noisePhase,
        pulsePhase: stateRef.current?.pulsePhase ?? 0,
        breathPhase: stateRef.current?.breathPhase ?? 0,
      });
      markVisualReadyRef.current();
    };

    const renderCanonicalCanvasFirstPaint = () => {
      const state = stateRef.current;
      if (!ctx2d || !state || visualReadyRef.current) return;

      try {
        renderCanvas2D(
          smoothValenceRef.current,
          state.time,
          state.motionPhase,
          state.noisePhase,
          state.particles,
        );
      } catch {
        recordCanonicalOrbFailure('canvas2d-first-paint');
      }
    };

    let renderPendingCanonicalFrame: typeof renderWorkerGL | null = null;
    const renderPendingWebGL: typeof renderWorkerGL = (...args) => {
      renderPendingCanonicalFrame?.(...args);
    };
    let render = glRenderer ? renderGL : (ctx2d ? renderCanvas2D : renderPendingWebGL);
    let disposed = false;
    let rafScheduled = false;

    // ── Fallback canvas for context loss recovery ──
    let fallbackCanvas: HTMLCanvasElement | null = null;
    /** Degrade to Canvas 2D only for non-forced/debug recovery; forced canonical surfaces stay WebGL-only. */
    const degradeToCanvas2D = () => {
      if (!canUseCanonicalCanvasRecovery) {
        render = renderPendingWebGL;
        markVisualErrorRef.current();
        return;
      }

      if (ctx2d && canvasElRef.current === activeCanvas) {
        activeCanvas.style.setProperty('transition', 'none', 'important');
        activeCanvas.style.setProperty('opacity', '1', 'important');
        render = renderCanvas2D;

        const state = stateRef.current;
        if (state) {
          renderCanvas2D(
            smoothValenceRef.current,
            state.time,
            state.motionPhase,
            state.noisePhase,
            state.particles,
          );
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
        recordCanonicalOrbFailure('canvas2d-recovery-probe');
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
        glRendererRef.current?.dispose();
        glRendererRef.current = null;
        workerRendererRef.current?.dispose();
        workerRendererRef.current = null;
        render = renderCanvas2D;

        const state = stateRef.current;
        if (state) {
          renderCanvas2D(
            smoothValenceRef.current,
            state.time,
            state.motionPhase,
            state.noisePhase,
            state.particles,
          );
        }
      } else {
        markVisualErrorRef.current();
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
      if (state) {
        state.lastFrame = 0;
        state.lastWallFrame = 0;
      }
    };

    const clearCanonicalGpuRecoveryRetry = () => {
      if (canonicalGpuRecoveryRetryTimeoutId !== 0) {
        window.clearTimeout(canonicalGpuRecoveryRetryTimeoutId);
        canonicalGpuRecoveryRetryTimeoutId = 0;
      }
    };

    const exhaustCanonicalGpuRecoveryLifetime = (source: string) => {
      clearCanonicalGpuRecoveryRetry();
      if (!canonicalGpuRecoveryLifetimeBudgetReported) {
        canonicalGpuRecoveryLifetimeBudgetReported = true;
        recordError(
          new Error('Canonical GPU recovery stopped after the lifetime attempt budget'),
          { component: 'ValenceOrb', action: 'canonical-gpu-recovery-lifetime-budget' },
        );
        publishOrbLifecycleProbe('canonical-gpu-recovery-lifetime-exhausted', {
          attempts: canonicalGpuRecoveryLifetimeAttempts,
          maxAttempts: ORB_GPU_RECOVERY_LIFETIME_MAX_ATTEMPTS,
          source,
        });
      }
      markVisualErrorRef.current();
    };

    const claimCanonicalGpuRecovery = (
      source: string,
      allowRestoredContext = false,
    ) => {
      if (canonicalGpuLossRecoveryStarted || disposed || !mountedRef.current) return false;
      if (
        canonicalGpuRecoveryLifetimeAttempts >=
        ORB_GPU_RECOVERY_LIFETIME_MAX_ATTEMPTS
      ) {
        exhaustCanonicalGpuRecoveryLifetime(source);
        return false;
      }

      const now = performance.now();
      canonicalGpuRecoveryAttemptTimes = canonicalGpuRecoveryAttemptTimes.filter(
        (attemptedAt) => now >= attemptedAt && now - attemptedAt < ORB_GPU_RECOVERY_WINDOW_MS,
      );
      if (canonicalGpuRecoveryAttemptTimes.length === 0) {
        canonicalGpuRecoveryBudgetReported = false;
        canonicalRestoredContextBypassUsed = false;
      }
      if (canonicalGpuRecoveryAttemptTimes.length >= ORB_GPU_RECOVERY_MAX_ATTEMPTS) {
        if (allowRestoredContext && !canonicalRestoredContextBypassUsed) {
          canonicalRestoredContextBypassUsed = true;
          publishOrbLifecycleProbe('canonical-gpu-recovery-restored-context', {
            source,
            windowMs: ORB_GPU_RECOVERY_WINDOW_MS,
          });
        } else {
          if (!canonicalGpuRecoveryBudgetReported) {
            canonicalGpuRecoveryBudgetReported = true;
            recordError(
              new Error('Canonical GPU recovery stopped after repeated context loss'),
              { component: 'ValenceOrb', action: 'canonical-gpu-recovery-budget' },
            );
            publishOrbLifecycleProbe('canonical-gpu-recovery-exhausted', {
              attempts: canonicalGpuRecoveryAttemptTimes.length,
              source,
              windowMs: ORB_GPU_RECOVERY_WINDOW_MS,
            });
          }
          return false;
        }
      }

      canonicalGpuRecoveryBudgetReported = false;
      clearCanonicalGpuRecoveryRetry();
      canonicalGpuRecoveryAttemptTimes.push(now);
      canonicalGpuRecoveryLifetimeAttempts += 1;
      canonicalGpuLossRecoveryStarted = true;
      publishOrbLifecycleProbe('canonical-gpu-recovery-claimed', {
        attempt: canonicalGpuRecoveryAttemptTimes.length,
        lifetimeAttempt: canonicalGpuRecoveryLifetimeAttempts,
        source,
      });
      return true;
    };

    const scheduleCanonicalGpuRecoveryRetry = (
      source: string,
      retry: () => void,
    ) => {
      if (
        canonicalGpuRecoveryLifetimeAttempts >=
        ORB_GPU_RECOVERY_LIFETIME_MAX_ATTEMPTS
      ) {
        exhaustCanonicalGpuRecoveryLifetime(source);
        return;
      }
      if (
        canonicalGpuRecoveryRetryTimeoutId !== 0 ||
        disposed ||
        !mountedRef.current
      ) {
        return;
      }

      const now = performance.now();
      const oldestAttemptAt = canonicalGpuRecoveryAttemptTimes[0] ?? now;
      const delayMs = Math.max(1, oldestAttemptAt + ORB_GPU_RECOVERY_WINDOW_MS - now);
      publishOrbLifecycleProbe('canonical-gpu-recovery-retry-scheduled', {
        delayMs,
        source,
      });
      canonicalGpuRecoveryRetryTimeoutId = window.setTimeout(() => {
        canonicalGpuRecoveryRetryTimeoutId = 0;
        if (disposed || !mountedRef.current) return;
        publishOrbLifecycleProbe('canonical-gpu-recovery-retry-start', { source });
        retry();
      }, delayMs);
    };

    const finishFailedCanonicalGpuRecovery = (source: string) => {
      const shouldRetryRestoredContext =
        canonicalGpuLossRecoveryStarted && canonicalRestoredContextRetryPending;
      const shouldRetry = canonicalGpuLossRecoveryStarted && forceCanonicalWebGL;
      canonicalGpuLossRecoveryStarted = false;
      if (shouldRetryRestoredContext) {
        canonicalRestoredContextRetryPending = false;
        publishOrbLifecycleProbe('canonical-gpu-restored-context-retry-start', { source });
        recoverCanonicalGpuLoss(true);
        return;
      }
      if (shouldRetry) {
        scheduleCanonicalGpuRecoveryRetry(source, recoverCanonicalGpuLoss);
      }
    };

    const renderReducedMotionStill = () => {
      const state = stateRef.current;
      if (!state) return;
      const selectedValence = valenceRef.current;
      state.targetValence = selectedValence;
      state.currentValence = selectedValence;
      targetValenceRef.current = selectedValence;
      smoothValenceRef.current = selectedValence;
      shimmerRef.current = 0;
      const stillTime = resolveReducedMotionOrbStillTime(state.time);
      state.time = stillTime;
      try {
        render(
          selectedValence,
          stillTime,
          state.motionPhase,
          state.noisePhase,
          state.particles,
        );
      } catch {
        recordCanonicalOrbFailure('reduced-motion-still');
        if (glRendererRef.current) {
          if (
            forceCanonicalWebGL ||
            canvasElRef.current?.dataset.orbRendererTier === 'webgpu-main'
          ) {
            recoverCanonicalGpuLoss();
            return;
          }

          glRendererRef.current.dispose();
          glRendererRef.current = null;
          glRenderer = null;
          if (canUseCanonicalCanvasRecovery) {
            degradeToCanvas2D();
          } else {
            render = renderPendingWebGL;
            markVisualErrorRef.current();
          }
        }
      }
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
      const frameWallNow = performance.now();

      const documentHidden = typeof document !== "undefined" && document.hidden;
      if (documentHidden || !isVisibleRef.current) {
        resetFrameClock();
        return;
      }

      // Runtime dopamine gate
      if (!shouldAnimateCanonicalOrb()) {
        renderReducedMotionStill();
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
      const frameInterval = resolveOrbFrameInterval(Boolean(glRendererRef.current || workerRenderer));
      if (!isOrbFrameDue(state.lastFrame, timestamp, frameInterval)) {
        requestNextFrame();
        return;
      }
      // Re-anchor instead of catching up after hidden tabs, reload restore, or long stalls.
      const isWorkerFrame = Boolean(workerRenderer);
      const dt = isWorkerFrame
        ? resolveOrbWorkerFrameDeltaSeconds(
            state.lastFrame,
            timestamp,
            state.lastWallFrame,
            frameWallNow,
          )
        : resolveOrbFrameDeltaSeconds(
            state.lastFrame,
            timestamp,
            state.lastWallFrame,
            frameWallNow,
          );
      const transitionDt = isWorkerFrame
        ? resolveOrbWorkerTransitionDeltaSeconds(
            state.lastFrame,
            timestamp,
            state.lastWallFrame,
            frameWallNow,
          )
        : resolveOrbTransitionDeltaSeconds(
            state.lastFrame,
            timestamp,
            state.lastWallFrame,
            frameWallNow,
          );
      state.lastFrame = timestamp;
      state.lastWallFrame = frameWallNow;

      // Shimmer decay: dt-based exponential (~0.8s half-life, frame-rate independent).
      // Keep it as a quiet target-change glow; delayed high-energy bursts read as
      // a sudden spin-up after the transition should already feel settled.
      shimmerRef.current *= Math.pow(0.08, transitionDt); // 0.08^(1/30) ≈ 0.92 per frame at 30fps
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
      const lerpRate = frameRateIndependentLerp(targetBaseLerp, transitionDt, 30);

      // Interpolate valence (exponential ease)
      state.currentValence += targetDelta * lerpRate;

      // P4: keep shader time stable while preserving subtle idle visual calm.
      const idleElapsed = frameWallNow - lastInteractionRef.current;
      const idleFactor = Math.max(0, Math.min(1, (idleElapsed - 8000) / 4000));
      state.time = resolveOrbShaderTime(state.time, dt, animationSpeedRef.current);

      // P5: Smoothed valence — organic flow between color/shape states
      // Lower factor → slow-breath settle. User feedback 2026-04-18:
      // "мягкость перехода от орба к орбу как раньше было" — restore very soft
      // transition between mood states, not snappy.
      const visualDelta = state.currentValence - smoothValenceRef.current;
      const { visualBaseLerp } = resolveOrbTransitionSettings(
        frameTransitionProfile,
        Math.abs(visualDelta),
      );
      const smoothLerp = frameRateIndependentLerp(visualBaseLerp, transitionDt, 60);
      smoothValenceRef.current += (state.currentValence - smoothValenceRef.current) * smoothLerp;
      state.motionPhase = resolveOrbMotionPhase(
        state.motionPhase,
        dt,
        smoothValenceRef.current,
        animationSpeedRef.current,
      );
      state.noisePhase = resolveOrbNoisePhase(
        state.noisePhase,
        dt,
        smoothValenceRef.current,
        animationSpeedRef.current,
      );
      state.pulsePhase = resolveOrbPulsePhase(
        state.pulsePhase,
        dt,
        animationSpeedRef.current,
      );
      state.breathPhase = resolveOrbBreathPhase(
        state.breathPhase,
        dt,
        smoothValenceRef.current,
        animationSpeedRef.current,
      );

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

      // Proactive context loss detection (iOS 17+ WKWebView — context lost without event)
      if (glRendererRef.current?.isContextLost()) {
        if (
          forceCanonicalWebGL ||
          canvasElRef.current?.dataset.orbRendererTier === 'webgpu-main'
        ) {
          recoverCanonicalGpuLoss();
          return;
        }
        glRendererRef.current.dispose();
        glRendererRef.current = null;
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          render = renderPendingWebGL;
          markVisualErrorRef.current();
        }
      }

      // Draw scene (skip when off-screen, catch errors to prevent loop death)
      if (isVisibleRef.current) {
        try {
          render(
            smoothValenceRef.current,
            state.time,
            state.motionPhase,
            state.noisePhase,
            state.particles,
            frameWallNow,
          );
        } catch {
          recordCanonicalOrbFailure('render');

          if (glRendererRef.current) {
            if (
              forceCanonicalWebGL ||
              canvasElRef.current?.dataset.orbRendererTier === 'webgpu-main'
            ) {
              recoverCanonicalGpuLoss();
              return;
            }

            // Optional WebGL surface can still degrade to Canvas 2D.
            glRendererRef.current.dispose();
            glRendererRef.current = null;
            if (canUseCanonicalCanvasRecovery) {
              degradeToCanvas2D();
            } else {
              render = renderPendingWebGL;
              markVisualErrorRef.current();
              return;
            }
          } else {
            // Canvas 2D render also threw — give up
            cancelNextFrame();
            markVisualErrorRef.current();
            return;
          }
        }
      }

      requestNextFrame();
    }

    // ── Context loss recovery (Law 22, Part 10) ──
    const handleContextLost = (e: Event) => {
      e.preventDefault();

      if (forceCanonicalWebGL) {
        canonicalWebGLContextRestorePending = true;
        recoverCanonicalGpuLoss();
        return;
      }

      cancelNextFrame();
      glRendererRef.current?.dispose();
      glRendererRef.current = null;

      // Cannot getContext('2d') on a WebGL-locked canvas — create a fresh one
      if (canUseCanonicalCanvasRecovery) {
        degradeToCanvas2D();
      } else {
        render = renderPendingWebGL;
        markVisualErrorRef.current();
      }

      // Restart RAF loop only when a non-forced/debug Canvas 2D recovery exists.
      if (ctx2d && shouldAnimateCanonicalOrb() && mountedRef.current) {
        requestNextFrame();
      }

      recordError(
        new Error('WebGL context lost — degraded to Canvas 2D'),
        { component: 'ValenceOrb' },
      );
    };

    const handleContextRestored = () => {
      if (forceCanonicalWebGL && canonicalWebGLContextRestorePending) {
        recoverCanonicalGpuLoss(true);
        return;
      }

      // Keep Canvas 2D after a context loss. Recompiling immediately can repeat
      // the same Chrome/GPU stall that caused the fallback in the first place.
      if (shouldAnimateCanonicalOrb() && mountedRef.current) {
        resetFrameClock();
        requestNextFrame();
      }
    };

    const attachWebGLListeners = (canvas: HTMLCanvasElement) => {
      if (webglEventCanvas && webglEventCanvas !== canvas) {
        webglEventCanvas.removeEventListener('webglcontextlost', handleContextLost);
        webglEventCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
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

    let staticRendererHealthcheckTimeoutId = 0;
    const clearStaticRendererHealthcheck = () => {
      if (staticRendererHealthcheckTimeoutId !== 0) {
        window.clearTimeout(staticRendererHealthcheckTimeoutId);
        staticRendererHealthcheckTimeoutId = 0;
      }
    };
    const scheduleStaticRendererHealthcheck = () => {
      clearStaticRendererHealthcheck();
      if (
        shouldAnimateCanonicalOrb() ||
        disposed ||
        !mountedRef.current ||
        document.hidden ||
        !isVisibleRef.current
      ) {
        return;
      }

      staticRendererHealthcheckTimeoutId = window.setTimeout(() => {
        staticRendererHealthcheckTimeoutId = 0;
        if (shouldAnimateCanonicalOrb() || disposed || !mountedRef.current) return;
        if (document.hidden || !isVisibleRef.current) {
          return;
        }
        if (workerRenderer) {
          return;
        }

        const rendererInstance = glRendererRef.current;
        if (!rendererInstance) {
          scheduleStaticRendererHealthcheck();
          return;
        }
        if (!rendererInstance.isContextLost()) {
          scheduleStaticRendererHealthcheck();
          return;
        }

        if (
          forceCanonicalWebGL ||
          canvasElRef.current?.dataset.orbRendererTier === 'webgpu-main'
        ) {
          recoverCanonicalGpuLoss();
          return;
        }

        rendererInstance.dispose();
        glRendererRef.current = null;
        glRenderer = null;
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          render = renderPendingWebGL;
          markVisualErrorRef.current();
        }
      }, ORB_WORKER_STATIC_HEALTHCHECK_MS);
    };

    const suspendRendererWatchdogs = () => {
      clearStaticRendererHealthcheck();
      clearWorkerWatchdogs();
      if (forceWebGLFirstFrameTimeoutId !== 0) {
        window.clearTimeout(forceWebGLFirstFrameTimeoutId);
        forceWebGLFirstFrameTimeoutId = 0;
      }
    };

    const resumeRendererWatchdogs = () => {
      if (disposed || !mountedRef.current || document.hidden || !isVisibleRef.current) return;
      resumeWorkerWatchdogs();
      if (!shouldAnimateCanonicalOrb() && !workerRenderer) {
        scheduleStaticRendererHealthcheck();
      }
      if (forceCanonicalWebGL && webglUpgradeStarted && !visualReadyRef.current) {
        armForcedWebGLFirstFrameTimeout();
      }
    };

    let animationAllowed = shouldAnimateCanonicalOrb();
    const syncAnimationPreference = () => {
      const nextAnimationAllowed = shouldAnimateCanonicalOrb();
      if (nextAnimationAllowed === animationAllowed) return;
      animationAllowed = nextAnimationAllowed;

      if (nextAnimationAllowed) {
        clearStaticRendererHealthcheck();
        restartAnimationClock();
        return;
      }

      pauseAnimationClock();
      renderReducedMotionStill();
      scheduleStaticRendererHealthcheck();
    };

    const handleVisibilityChange = () => {
      if (document.hidden) {
        pauseAnimationClock();
        suspendRendererWatchdogs();
        return;
      }

      restartAnimationClock();
      resumeRendererWatchdogs();
    };

    const handlePageHide = () => {
      pauseAnimationClock();
      suspendRendererWatchdogs();
    };

    const handlePageShow = () => {
      restartAnimationClock();
      resumeRendererWatchdogs();
    };

    document.addEventListener('visibilitychange', handleVisibilityChange);
    document.addEventListener('freeze', handlePageHide);
    document.addEventListener('resume', handlePageShow);
    window.addEventListener('pagehide', handlePageHide);
    window.addEventListener('pageshow', handlePageShow);
    window.addEventListener('dopamine-settings-change', syncAnimationPreference);
    const reducedMotionMedia = window.matchMedia?.('(prefers-reduced-motion: reduce)') ?? null;
    reducedMotionMedia?.addEventListener?.('change', syncAnimationPreference);
    reducedMotionMedia?.addListener?.(syncAnimationPreference);
    const animationPreferenceObserver = typeof MutationObserver === 'undefined'
      ? null
      : new MutationObserver(syncAnimationPreference);
    animationPreferenceObserver?.observe(document.documentElement, {
      attributes: true,
      attributeFilter: ['data-reduced-motion'],
    });

    const upgradeToWebGL = async (
      signal: AbortSignal,
      skipWebGPU = false,
    ) => {
      if (!shouldTryWebGL(renderer) || signal.aborted) return;

      let webglStartupRecoveryStarted = false;
      const shouldKeepCurrentVisibleCanvas = () => {
        if (canonicalGpuLossRecoveryStarted) return false;
        const visibleUpgradeAgeMs =
          performance.now() - (firstVisualReadyAtRef.current || visibleCanvasMountedAt);

        return shouldDropLateVisibleWebGLUpgrade({
          forceCanonicalWebGL,
          explicitWebGLOverride,
          visualReady: visualReadyRef.current,
          visibleCanvasAgeMs: visibleUpgradeAgeMs,
        });
      };

      const upgradeToMainThreadWebGL = async (
        webgpuOnly = false,
        skipWebGPU = false,
      ): Promise<boolean> => {
        const upgradeGeneration = ++mainRendererUpgradeGeneration;
        publishOrbLifecycleProbe("main-upgrade-start", {
          allowSyncRecovery: false,
          skipWebGPU,
          webgpuOnly,
        });
        const readinessTimeoutMs = forceCanonicalWebGL
          ? FORCED_WEBGL_READINESS_TIMEOUT_MS
          : WEBGL_READINESS_TIMEOUT_MS;
        let upgradeCanvas = createCanvas(size, dpr);
        let result: OrbGLBuildResult | null = null;
        let webGpuCandidateRenderer: OrbGLRenderer | null = null;
        let webGpuCandidateLost = false;
        if (!skipWebGPU) {
          result = await createOrbWebGPUAsync(upgradeCanvas, {
            signal,
            timeoutMs: readinessTimeoutMs,
            onContextLost: () => {
              webGpuCandidateLost = true;
              if (glRendererRef.current === webGpuCandidateRenderer) {
                recoverCanonicalGpuLoss();
              }
            },
          });
          if (result?.tier === 'webgpu') {
            webGpuCandidateRenderer = result.renderer;
          }
        }

        if (webgpuOnly && !result) return false;

        if (!result && !forceCanonicalWebGL && !probeWebGLWorks()) return false;

        if (!result && !signal.aborted) {
          const gl1Canvas = createCanvas(size, dpr);
          result = await createOrbGLAsync(gl1Canvas, {
            signal,
            timeoutMs: readinessTimeoutMs,
          });
          upgradeCanvas = gl1Canvas;
        }

        if (!result && !signal.aborted) {
          const gl2Canvas = createCanvas(size, dpr);
          result = await createOrbGL2Async(gl2Canvas, {
            signal,
            timeoutMs: readinessTimeoutMs,
          });
          upgradeCanvas = gl2Canvas;
        }

        if (
          signal.aborted ||
          !mountedRef.current ||
          forceWebGLStartupRecovered ||
          upgradeGeneration !== mainRendererUpgradeGeneration
        ) {
          result?.renderer.dispose();
          publishOrbLifecycleProbe("main-upgrade-aborted", {
            generationSuperseded: upgradeGeneration !== mainRendererUpgradeGeneration,
            mounted: mountedRef.current,
            signalAborted: signal.aborted,
          });
          return false;
        }
        if (!result) {
          publishOrbLifecycleProbe("main-upgrade-unavailable");
          return false;
        }
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
          publishOrbLifecycleProbe("main-upgrade-rejected", {
            tier: result.tier,
            visibleUpgradeAgeMs,
          });
          return false;
        }

        if (visibleUpgradeAgeMs > WEBGL_BUILD_BUDGET_MS) {
          rememberSlowWebGL(visibleUpgradeAgeMs);
        }

        if (shouldKeepCurrentVisibleCanvas()) {
          rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
          result.renderer.dispose();
          publishOrbLifecycleProbe("main-upgrade-kept-visible-canvas", {
            tier: result.tier,
          });
          return true;
        }

        const webGpuCandidateConnectedForValidation =
          result.tier === 'webgpu' && !wrapper.contains(upgradeCanvas);
        if (webGpuCandidateConnectedForValidation) {
          upgradeCanvas.style.opacity = '0';
          wrapper.appendChild(upgradeCanvas);
        }
        const removeUnpublishedWebGpuCandidate = () => {
          if (webGpuCandidateConnectedForValidation && wrapper.contains(upgradeCanvas)) {
            wrapper.removeChild(upgradeCanvas);
          }
        };
        const state = stateRef.current;
        if (!state) {
          removeUnpublishedWebGpuCandidate();
          result.renderer.dispose();
          return false;
        }

        let firstFrameTime = shouldAnimateCanonicalOrb()
          ? state.time
          : resolveReducedMotionOrbStillTime(state.time);
        let firstPresentationValidated = false;
        const firstPresentationDeadline =
          performance.now() + ORB_FIRST_VISIBLE_PRESENTATION_BUDGET_MS;
        try {
          while (
            !firstPresentationValidated &&
            performance.now() <= firstPresentationDeadline
          ) {
            const currentState = stateRef.current;
            if (!currentState || signal.aborted || !mountedRef.current) break;
            firstFrameTime = shouldAnimateCanonicalOrb()
              ? currentState.time
              : resolveReducedMotionOrbStillTime(currentState.time);
            const candidatePayload = createMainGLPayload(
              smoothValenceRef.current,
              firstFrameTime,
              currentState.motionPhase,
              currentState.noisePhase,
              currentState.particles,
            );
            if (candidatePayload.genesis <= 0.15) {
              if (!(await waitForNextOrbPresentationFrame(signal))) break;
              continue;
            }
            const renderResult = result.renderer.render(candidatePayload);
            firstPresentationValidated = renderResult !== false;
            if (firstPresentationValidated && result.renderer.waitForFirstPresentation) {
              firstPresentationValidated = await result.renderer.waitForFirstPresentation();
            }
            if (
              (result.tier === 'webgpu' && webGpuCandidateLost) ||
              result.renderer.isContextLost?.()
            ) {
              throw new Error('GPU renderer was lost before publication');
            }
            if (!firstPresentationValidated && candidatePayload.genesis > 0.15) {
              throw new Error('GPU first presentation remained transparent after genesis');
            }
            if (
              !firstPresentationValidated &&
              !(await waitForNextOrbPresentationFrame(signal))
            ) {
              break;
            }
          }
          if (!firstPresentationValidated) {
            throw new Error('GPU first presentation was not validated');
          }
        } catch {
          recordCanonicalOrbFailure(`${result.tier}-first-frame`);
          publishOrbLifecycleProbe("main-upgrade-first-frame-failed", {
            tier: result.tier,
          });
          removeUnpublishedWebGpuCandidate();
          result.renderer.dispose();

          if (result.tier === 'webgpu' && !skipWebGPU && !signal.aborted && mountedRef.current) {
            publishOrbLifecycleProbe("main-upgrade-webgpu-first-frame-fallback");
            return upgradeToMainThreadWebGL(false, true);
          }
          return false;
        }

        if (
          signal.aborted ||
          !mountedRef.current ||
          forceWebGLStartupRecovered ||
          upgradeGeneration !== mainRendererUpgradeGeneration
        ) {
          removeUnpublishedWebGpuCandidate();
          result.renderer.dispose();
          publishOrbLifecycleProbe("main-upgrade-first-frame-aborted", {
            generationSuperseded: upgradeGeneration !== mainRendererUpgradeGeneration,
            tier: result.tier,
          });
          return false;
        }

        if (shouldKeepCurrentVisibleCanvas()) {
          removeUnpublishedWebGpuCandidate();
          result.renderer.dispose();
          publishOrbLifecycleProbe("main-upgrade-kept-visible-canvas-after-first-frame", {
            tier: result.tier,
          });
          return true;
        }

        const previousCanvas = activeCanvas;
        markRendererTier(upgradeCanvas, result.tier === 'webgpu' ? 'webgpu-main' : 'webgl-main');
        glRenderer = result.renderer;
        glRendererRef.current = result.renderer;
        canvasElRef.current = upgradeCanvas;
        ctx2d = null;
        activeCanvas = upgradeCanvas;
        render = renderGL;

        if (result.tier !== 'webgpu') {
          attachWebGLListeners(upgradeCanvas);
        }

        if (webGpuCandidateConnectedForValidation) {
          if (previousCanvas !== upgradeCanvas && wrapper.contains(previousCanvas)) {
            wrapper.removeChild(previousCanvas);
          }
        } else if (wrapper.contains(previousCanvas)) {
          wrapper.replaceChild(upgradeCanvas, previousCanvas);
        } else {
          wrapper.appendChild(upgradeCanvas);
        }
        visibleCanvasMountedAt = performance.now();
        publishMainGLPresentation(
          upgradeCanvas,
          smoothValenceRef.current,
          firstFrameTime,
          state.motionPhase,
          state.noisePhase,
        );
        clearCanonicalGpuRecoveryRetry();
        canonicalWebGLContextRestorePending = false;
        canonicalRestoredContextRetryPending = false;
        canonicalGpuLossRecoveryStarted = false;
        publishOrbLifecycleProbe("main-upgrade-applied", {
          tier: result.tier === 'webgpu' ? 'webgpu-main' : 'webgl-main',
        });
        restartAnimationClock();
        if (!shouldAnimateCanonicalOrb()) {
          scheduleStaticRendererHealthcheck();
        }

        return true;
      };

      const recoverFromWebGLStartupFailure = () => {
        if (webglStartupRecoveryStarted || signal.aborted || !mountedRef.current) return;
        webglStartupRecoveryStarted = true;

        if (!forceCanonicalWebGL) {
          degradeToCanvas2D();
          return;
        }

        void (async () => {
          const recoveredWithWebGL = await upgradeToMainThreadWebGL(
            false,
            skipWebGPU,
          );
          if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
            finishFailedCanonicalGpuRecovery('main-startup-recovery');
            if (canUseCanonicalCanvasRecovery) {
              degradeToCanvas2D();
            } else {
              markVisualErrorRef.current();
            }
          }
        })();
      };

      const preferWorkerWebGLFirst = shouldPreferWorkerWebGLBeforeMainThreadWebGPU(
        forceCanonicalWebGL,
        size,
      );
      const recoveredWithWebGPU = preferWorkerWebGLFirst
        ? false
        : await upgradeToMainThreadWebGL(true, skipWebGPU);
      if (recoveredWithWebGPU) return;

      const recoverFromSynchronousWorkerSetupFailure = async (
        _error: unknown,
        action: string,
        failedWorker: Worker | null = null,
      ) => {
        recordCanonicalOrbFailure(action);
        failedWorker?.terminate();
        if (webglWorker === failedWorker) webglWorker = null;
        const recoveredWithWebGL = await upgradeToMainThreadWebGL(
          false,
          skipWebGPU,
        );
        if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
          finishFailedCanonicalGpuRecovery('worker-setup-recovery');
          if (canUseCanonicalCanvasRecovery) {
            degradeToCanvas2D();
          } else {
            markVisualErrorRef.current();
          }
        }
      };

      if ((renderer === 'auto' || renderer === 'webgpu' || renderer === 'webgl') && shouldUseWorkerWebGL(forceCanonicalWebGL, size)) {
        publishOrbLifecycleProbe("worker-upgrade-start", { size, skipWebGPU });
        const workerStartedAt = performance.now();
        const workerCanvas = createCanvas(size, dpr);
        if (forceCanonicalWebGL) {
          workerCanvas.style.opacity = '0';
          workerCanvas.style.transition = 'opacity 160ms ease-out';
        }
        markRendererTier(workerCanvas, 'webgl-worker');
        let offscreen: OffscreenCanvas;
        let worker: Worker;
        try {
          offscreen = workerCanvas.transferControlToOffscreen();
          worker = new Worker(new URL('./orbWorker.ts', import.meta.url), {
            type: 'module',
            name: 'zenflow-orb-renderer',
          });
        } catch (error) {
          await recoverFromSynchronousWorkerSetupFailure(
            error,
            'worker-webgl-construction',
          );
          return;
        }
        webglWorker = worker;
        mainRendererUpgradeGeneration += 1;
        nextWorkerRenderId = 0;
        workerRenderInFlight = false;
        latestWorkerPayload = null;
        lastWorkerPayload = null;
        let workerStartupTimeoutId = 0;
        let workerRenderAckTimeoutId = 0;
        let workerStaticHealthcheckTimeoutId = 0;
        let currentWorkerRequestId = 0;
        let currentWorkerRequestPostedAt = 0;
        let lastWorkerAckLatencyMs: number | null = null;
        let workerRenderedFrame = false;
        let workerFrameAwaitingVisibleConfirmation = false;
        let workerCanvasConnectedForValidation = false;
        let workerController: OrbWorkerController | null = null;

        const clearWorkerStartupTimeout = () => {
          if (workerStartupTimeoutId !== 0) {
            window.clearTimeout(workerStartupTimeoutId);
            workerStartupTimeoutId = 0;
          }
        };

        const clearWorkerRenderAckTimeout = () => {
          if (workerRenderAckTimeoutId !== 0) {
            window.clearTimeout(workerRenderAckTimeoutId);
            workerRenderAckTimeoutId = 0;
          }
        };

        const clearWorkerStaticHealthcheck = () => {
          if (workerStaticHealthcheckTimeoutId !== 0) {
            window.clearTimeout(workerStaticHealthcheckTimeoutId);
            workerStaticHealthcheckTimeoutId = 0;
          }
        };

        const clearCurrentWorkerWatchdogs = () => {
          clearWorkerStartupTimeout();
          clearWorkerRenderAckTimeout();
          clearWorkerStaticHealthcheck();
        };

        clearWorkerWatchdogs();
        clearWorkerWatchdogs = clearCurrentWorkerWatchdogs;

        const clearFailedWorkerState = () => {
          const failedController = workerRenderer;
          clearCurrentWorkerWatchdogs();
          worker.onmessage = null;
          worker.onerror = null;
          worker.terminate();
          if (webglWorker === worker) webglWorker = null;
          if (workerRendererRef.current === failedController) {
            workerRendererRef.current = null;
          }
          workerRenderer = null;
          renderPendingCanonicalFrame = null;
          workerRenderInFlight = false;
          currentWorkerRequestId = 0;
          currentWorkerRequestPostedAt = 0;
          workerFrameAwaitingVisibleConfirmation = false;
          latestWorkerPayload = null;
          lastWorkerPayload = null;
          workerProbePayloads.clear();
          if (
            workerCanvasConnectedForValidation &&
            activeCanvas !== workerCanvas &&
            wrapper.contains(workerCanvas)
          ) {
            wrapper.removeChild(workerCanvas);
          }
          workerCanvasConnectedForValidation = false;
          render = glRendererRef.current
            ? renderGL
            : (ctx2d ? renderCanvas2D : renderPendingWebGL);
        };

        const recoverFromWorkerRuntimeFailure = () => {
          if (
            canonicalGpuLossRecoveryStarted ||
            signal.aborted ||
            disposed ||
            !mountedRef.current
          ) {
            publishOrbLifecycleProbe("worker-runtime-recovery-skipped", {
              canonicalRecoveryStarted: canonicalGpuLossRecoveryStarted,
              disposed,
              mounted: mountedRef.current,
              signalAborted: signal.aborted,
            });
            return;
          }

          if (!forceCanonicalWebGL) {
            degradeToCanvas2D();
            restartAnimationClock();
            return;
          }

          if (!claimCanonicalGpuRecovery('worker-runtime')) {
            cancelNextFrame();
            render = renderPendingWebGL;
            resetFrameClock();
            scheduleCanonicalGpuRecoveryRetry(
              'worker-runtime',
              recoverFromWorkerRuntimeFailure,
            );
            return;
          }
          publishOrbLifecycleProbe("worker-runtime-recovery-start", {
            forceCanonicalWebGL,
          });
          cancelNextFrame();
          render = renderPendingWebGL;
          resetFrameClock();

          void (async () => {
            const recoveredWithWebGL = await upgradeToMainThreadWebGL(
              false,
              true,
            );
            publishOrbLifecycleProbe("worker-runtime-main-recovery-result", {
              recovered: recoveredWithWebGL,
            });
            if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
              publishOrbLifecycleProbe("worker-runtime-worker-retry-start");
              await upgradeToWebGL(signal, true);
            }
          })();
        };

        const handleWorkerFailure = (
          reason: string,
          action: string,
        ) => {
          const failedAfterVisibleFrame =
            activeCanvas === workerCanvas &&
            canvasElRef.current === workerCanvas &&
            visualReadyRef.current;

          publishOrbLifecycleProbe("worker-failure", {
            action,
            canonicalRecoveryStarted: canonicalGpuLossRecoveryStarted,
            failedAfterVisibleFrame,
            visualReady: visualReadyRef.current,
          });

          recordError(
            new Error('Canonical orb worker renderer failed'),
            { component: 'ValenceOrb', action },
          );
          clearFailedWorkerState();

          if (failedAfterVisibleFrame) {
            recoverFromWorkerRuntimeFailure();
          } else {
            recoverFromWebGLStartupFailure();
          }
        };

        const armWorkerStartupTimeout = () => {
          clearWorkerStartupTimeout();
          if (
            !forceCanonicalWebGL ||
            signal.aborted ||
            disposed ||
            !mountedRef.current ||
            workerRenderedFrame ||
            document.hidden ||
            !isVisibleRef.current
          ) {
            return;
          }

          workerStartupTimeoutId = window.setTimeout(() => {
            workerStartupTimeoutId = 0;
            if (
              signal.aborted ||
              disposed ||
              !mountedRef.current ||
              workerRenderedFrame ||
              document.hidden ||
              !isVisibleRef.current
            ) {
              return;
            }
            handleWorkerFailure(
              'Worker WebGL first frame timed out',
              'worker-webgl-startup-timeout',
            );
          }, ORB_WORKER_STARTUP_TIMEOUT_MS);
        };

        const armWorkerRenderAckTimeout = (requestId: number) => {
          clearWorkerRenderAckTimeout();
          currentWorkerRequestId = requestId;
          if (document.hidden || !isVisibleRef.current) return;
          const ackTimeoutMs = resolveOrbWorkerAckTimeoutMs(
            lastWorkerAckLatencyMs,
            !workerRenderedFrame,
          );
          workerRenderAckTimeoutId = window.setTimeout(() => {
            workerRenderAckTimeoutId = 0;
            if (
              signal.aborted ||
              disposed ||
              !mountedRef.current ||
              !workerRenderInFlight ||
              currentWorkerRequestId !== requestId
            ) {
              return;
            }

            if (document.hidden || !isVisibleRef.current) {
              return;
            }

            handleWorkerFailure(
              `Worker WebGL render acknowledgement timed out after ${ackTimeoutMs}ms`,
              'worker-webgl-render-timeout',
            );
          }, ackTimeoutMs);
        };

        const postWorkerRender = (payload: OrbWorkerPayload) => {
          if (signal.aborted || !mountedRef.current) return;
          clearWorkerStaticHealthcheck();
          workerRenderInFlight = true;
          const requestId = ++nextWorkerRenderId;
          const postedAt = performance.now();
          currentWorkerRequestPostedAt = postedAt;
          if (orbClockProbeEnabled) {
            workerProbePayloads.set(requestId, { payload, postedAt });
          }
          try {
            worker.postMessage({
              type: 'render',
              requestId,
              payload,
            });
          } catch {
            workerProbePayloads.delete(requestId);
            handleWorkerFailure(
              'Worker WebGL render post failed',
              'worker-webgl-render-send',
            );
            return;
          }
          armWorkerRenderAckTimeout(requestId);
        };

        const scheduleWorkerStaticHealthcheck = () => {
          clearWorkerStaticHealthcheck();
          if (
            signal.aborted ||
            disposed ||
            !mountedRef.current ||
            shouldAnimateCanonicalOrb() ||
            workerController === null ||
            workerRenderer !== workerController ||
            document.hidden ||
            !isVisibleRef.current
          ) {
            return;
          }

          workerStaticHealthcheckTimeoutId = window.setTimeout(() => {
            workerStaticHealthcheckTimeoutId = 0;
            if (
              signal.aborted ||
              disposed ||
              !mountedRef.current ||
              shouldAnimateCanonicalOrb() ||
              workerController === null ||
              workerRenderer !== workerController
            ) {
              return;
            }

            if (document.hidden || !isVisibleRef.current) {
              return;
            }

            const state = stateRef.current;
            if (!state) return;
            const healthcheckPayload = lastWorkerPayload;
            if (!healthcheckPayload) {
              scheduleWorkerStaticHealthcheck();
              return;
            }
            workerController.render(healthcheckPayload);
          }, ORB_WORKER_STATIC_HEALTHCHECK_MS);
        };

        const resumeCurrentWorkerWatchdogs = () => {
          if (
            signal.aborted ||
            disposed ||
            !mountedRef.current ||
            document.hidden ||
            !isVisibleRef.current ||
            webglWorker !== worker
          ) {
            return;
          }

          if (!workerRenderedFrame && workerController === null) {
            armWorkerStartupTimeout();
            return;
          }
          if (workerRenderInFlight && currentWorkerRequestId !== 0) {
            armWorkerRenderAckTimeout(currentWorkerRequestId);
            return;
          }
          if (
            workerFrameAwaitingVisibleConfirmation &&
            workerController &&
            lastWorkerPayload
          ) {
            workerFrameAwaitingVisibleConfirmation = false;
            workerRenderedFrame = false;
            workerController.render(lastWorkerPayload);
            return;
          }
          if (!shouldAnimateCanonicalOrb() && workerController === workerRenderer) {
            scheduleWorkerStaticHealthcheck();
          }
        };
        resumeWorkerWatchdogs = resumeCurrentWorkerWatchdogs;

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
          scheduleWorkerStaticHealthcheck();
        };

        worker.onmessage = (
          event: MessageEvent<{
            type: 'ready' | 'failed' | 'rendered' | 'unpresented';
            code?:
              | 'first-presentation-context-lost'
              | 'first-presentation-readback-error'
              | 'first-presentation-readback-exception'
              | 'first-presentation-transparent';
            reason?: string;
            requestId?: number;
          }>,
        ) => {
          if (signal.aborted || !mountedRef.current) return;

          if (event.data.type === 'rendered' || event.data.type === 'unpresented') {
            const renderedAt = performance.now();
            const presented = event.data.type === 'rendered';
            const requestId = event.data.requestId;
            if (!isActiveOrbWorkerRenderAck(
              requestId,
              currentWorkerRequestId,
              workerRenderInFlight,
            )) {
              return;
            }
            clearWorkerRenderAckTimeout();
            const ackLatencyMs = renderedAt - currentWorkerRequestPostedAt;
            if (Number.isFinite(ackLatencyMs) && ackLatencyMs > 0) {
              lastWorkerAckLatencyMs = lastWorkerAckLatencyMs === null
                ? ackLatencyMs
                : Math.max(ackLatencyMs, lastWorkerAckLatencyMs * 0.8);
            }
            currentWorkerRequestId = 0;
            currentWorkerRequestPostedAt = 0;
            if (!presented) {
              workerProbePayloads.delete(requestId);
              flushWorkerRender();
              return;
            }
            workerRenderedFrame = true;
            if (forceWebGLFirstFrameTimeoutId !== 0) {
              window.clearTimeout(forceWebGLFirstFrameTimeoutId);
              forceWebGLFirstFrameTimeoutId = 0;
            }
            const probePayload = workerProbePayloads.get(requestId);
            workerProbePayloads.delete(requestId);
            if (probePayload) {
              publishOrbClockProbeSample("webgl-worker", probePayload.payload, {
                renderedAt,
                postedAt: probePayload.postedAt,
                requestId,
              });
            }
            clearWorkerStartupTimeout();
            if (
              (document.hidden || !isVisibleRef.current) &&
              !visualReadyRef.current
            ) {
              workerFrameAwaitingVisibleConfirmation = true;
              publishOrbLifecycleProbe('worker-frame-deferred-until-visible');
              flushWorkerRender();
              return;
            }
            const appliesWorkerCanvas = activeCanvas !== workerCanvas || !wrapper.contains(workerCanvas);
            if (appliesWorkerCanvas) {
              if (shouldKeepCurrentVisibleCanvas()) {
                rememberSlowWebGL(performance.now() - visibleCanvasMountedAt);
                clearCurrentWorkerWatchdogs();
                worker.terminate();
                if (webglWorker === worker) webglWorker = null;
                if (workerRendererRef.current === workerRenderer) {
                  workerRendererRef.current = null;
                }
                workerRenderer = null;
                workerRenderInFlight = false;
                latestWorkerPayload = null;
                lastWorkerPayload = null;
                workerProbePayloads.clear();
                if (workerCanvasConnectedForValidation && wrapper.contains(workerCanvas)) {
                  wrapper.removeChild(workerCanvas);
                }
                workerCanvasConnectedForValidation = false;
                if (glRendererRef.current) {
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
            workerCanvasConnectedForValidation = false;
            workerRendererRef.current = workerRenderer;
            renderPendingCanonicalFrame = null;
            canvasElRef.current = workerCanvas;
            ctx2d = null;
            render = renderWorkerGL;
            const initialWorkerPaint = !visualReadyRef.current;
            const recoveredWorkerPaint = canonicalGpuLossRecoveryStarted;
            const shouldRestartAnimationClock = initialWorkerPaint || recoveredWorkerPaint;
            clearCanonicalGpuRecoveryRetry();
            canonicalWebGLContextRestorePending = false;
            canonicalRestoredContextRetryPending = false;
            canonicalGpuLossRecoveryStarted = false;
            if (appliesWorkerCanvas) {
              publishOrbLifecycleProbe("worker-upgrade-applied", {
                initial: initialWorkerPaint,
                recovery: recoveredWorkerPaint,
                size,
              });
            }
            markVisualReadyRef.current();
            if (shouldRestartAnimationClock) {
              restartAnimationClock();
            }
            flushWorkerRender();
            return;
          }

          if (event.data.type === 'failed') {
            const failureAction = event.data.code
              ? `worker-webgl-${event.data.code}`
              : 'worker-webgl';
            handleWorkerFailure(
              event.data.reason || 'Worker WebGL renderer failed',
              failureAction,
            );
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
              lastWorkerPayload = payload;
              if (workerRenderInFlight) {
                latestWorkerPayload = payload;
                return;
              }
              postWorkerRender(payload);
            },
            dispose() {
              clearCurrentWorkerWatchdogs();
              try {
                worker.postMessage({ type: 'dispose' });
              } catch {
                recordCanonicalOrbFailure('worker-webgl-dispose-send');
              } finally {
                worker.terminate();
              }
            },
          };

          workerController = controller;
          workerRenderer = controller;
          renderPendingCanonicalFrame = (
            v,
            t,
            motionPhase,
            noisePhase,
            particles,
            timestamp,
          ) => {
            controller.render(createWorkerPayload(
              v,
              t,
              motionPhase,
              noisePhase,
              particles,
              timestamp,
            ));
          };

          const state = stateRef.current;
          if (state) {
            const firstWorkerFrameTime = shouldAnimateCanonicalOrb()
              ? state.time
              : resolveReducedMotionOrbStillTime(state.time);
            controller.render(createWorkerPayload(
              smoothValenceRef.current,
              firstWorkerFrameTime,
              state.motionPhase,
              state.noisePhase,
              state.particles,
            ));
          }
        };

        worker.onerror = () => {
          handleWorkerFailure(
            activeCanvas === workerCanvas
              ? 'Worker WebGL renderer errored after first paint'
              : 'Worker WebGL renderer errored before first paint',
            'worker-webgl-error',
          );
        };

        armWorkerStartupTimeout();

        if (forceCanonicalWebGL && !wrapper.contains(workerCanvas)) {
          wrapper.appendChild(workerCanvas);
          workerCanvasConnectedForValidation = true;
        }

        try {
          worker.postMessage({ type: 'init', canvas: offscreen, size, dpr }, [offscreen]);
        } catch (error) {
          clearFailedWorkerState();
          await recoverFromSynchronousWorkerSetupFailure(
            error,
            'worker-webgl-init-send',
          );
        }
        return;
      }

      const recoveredWithWebGL = await upgradeToMainThreadWebGL(
        false,
        skipWebGPU,
      );
      if (!recoveredWithWebGL && !signal.aborted && mountedRef.current) {
        finishFailedCanonicalGpuRecovery('main-renderer-build');
        if (canUseCanonicalCanvasRecovery) {
          degradeToCanvas2D();
        } else {
          markVisualErrorRef.current();
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
    recoverCanonicalGpuLoss = (allowRestoredContext = false) => {
      if (
        webglUpgradeAbort.signal.aborted ||
        disposed ||
        !mountedRef.current
      ) {
        return;
      }

      if (canonicalGpuLossRecoveryStarted) {
        if (allowRestoredContext) {
          canonicalRestoredContextRetryPending = true;
          publishOrbLifecycleProbe('canonical-gpu-restored-context-retry-pending');
        }
        publishOrbLifecycleProbe('canonical-gpu-recovery-already-active');
        return;
      }

      if (allowRestoredContext) {
        canonicalRestoredContextRetryPending = false;
      }

      if (!claimCanonicalGpuRecovery('main-renderer', allowRestoredContext)) {
        cancelNextFrame();
        render = renderPendingWebGL;
        resetFrameClock();
        scheduleCanonicalGpuRecoveryRetry('main-renderer', recoverCanonicalGpuLoss);
        return;
      }
      recordError(
        new Error('Canonical GPU context lost; rebuilding the renderer'),
        { component: 'ValenceOrb', action: 'canonical-gpu-recovery' },
      );
      cancelNextFrame();
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      glRenderer = null;
      ctx2d = null;
      render = renderPendingWebGL;
      resetFrameClock();
      void upgradeToWebGL(webglUpgradeAbort.signal, true);
    };
    recoverCanonicalGpuLossRef.current = recoverCanonicalGpuLoss;
    let cancelWebGLUpgrade = () => {};
    armForcedWebGLFirstFrameTimeout = () => {
      if (
        !forceCanonicalWebGL ||
        !webglUpgradeStarted ||
        forceWebGLFirstFrameTimeoutId !== 0 ||
        document.hidden ||
        !isVisibleRef.current
      ) {
        return;
      }
      forceWebGLFirstFrameTimeoutId = window.setTimeout(
        recoverForcedWebGLFirstFrame,
        WEBGL_FORCED_FIRST_FRAME_TIMEOUT_MS,
      );
    };
    const recoverForcedWebGLFirstFrame = () => {
      forceWebGLFirstFrameTimeoutId = 0;
      if (
        !forceCanonicalWebGL ||
        forceWebGLStartupRecovered ||
        visualReadyRef.current ||
        webglUpgradeAbort.signal.aborted ||
        !mountedRef.current ||
        document.hidden ||
        !isVisibleRef.current
      ) {
        return;
      }

      forceWebGLStartupRecovered = true;
      mainRendererUpgradeGeneration += 1;
      cancelWebGLUpgrade();
      if (webglWorker) {
        webglWorker.onmessage = null;
        webglWorker.onerror = null;
        webglWorker.terminate();
      }
      webglWorker = null;
      renderPendingCanonicalFrame = null;
      workerRendererRef.current?.dispose();
      workerRendererRef.current = null;
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      workerRenderer = null;
      glRenderer = null;
      workerProbePayloads.clear();

      if (canUseCanonicalCanvasRecovery) {
        degradeToCanvas2D();
      } else {
        markVisualErrorRef.current();
      }
    };
    const startWebGLUpgradeWhenVisible = () => {
      if (webglUpgradeAbort.signal.aborted || webglUpgradeStarted) return;

      if (!isVisibleRef.current) {
        webglUpgradePendingUntilVisible = true;
        return;
      }

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
            pauseAnimationClock();
            suspendRendererWatchdogs();
          } else {
            restartAnimationClock();
            resumeRendererWatchdogs();
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
      clearStaticRendererHealthcheck();
      clearCanonicalGpuRecoveryRetry();
      clearWorkerWatchdogs();
      cancelWebGLUpgrade();
      cancelNextFrame();
      upgradeVisibilityObserver?.disconnect();
      document.removeEventListener('visibilitychange', handleVisibilityChange);
      document.removeEventListener('freeze', handlePageHide);
      document.removeEventListener('resume', handlePageShow);
      window.removeEventListener('pagehide', handlePageHide);
      window.removeEventListener('pageshow', handlePageShow);
      window.removeEventListener('dopamine-settings-change', syncAnimationPreference);
      reducedMotionMedia?.removeEventListener?.('change', syncAnimationPreference);
      reducedMotionMedia?.removeListener?.(syncAnimationPreference);
      animationPreferenceObserver?.disconnect();
      wrapper.removeEventListener('pointerdown', handlePointerDown);
      if (webglEventCanvas) {
        webglEventCanvas.removeEventListener('webglcontextlost', handleContextLost);
        webglEventCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      const activeWorkerRenderer = workerRendererRef.current;
      if (activeWorkerRenderer && activeWorkerRenderer === workerRenderer) {
        activeWorkerRenderer.dispose();
        workerRendererRef.current = null;
        workerRenderer = null;
        webglWorker = null;
      } else if (webglWorker) {
        webglWorker.onmessage = null;
        webglWorker.onerror = null;
        webglWorker.terminate();
        webglWorker = null;
      }
      glRendererRef.current?.dispose();
      glRendererRef.current = null;
      if (recoverCanonicalGpuLossRef.current === recoverCanonicalGpuLoss) {
        recoverCanonicalGpuLossRef.current = () => {};
      }
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
    if (canUseCanonicalCanvasRecovery) {
      renderCanonicalCanvasFirstPaint();
    }

    if (!shouldAnimateOrb && !forceCanonicalWebGL) {
      const stillTime = resolveReducedMotionOrbStillTime(stateRef.current.time);
      try {
        render(
          valenceRef.current,
          stillTime,
          stateRef.current.motionPhase,
          stateRef.current.noisePhase,
          stateRef.current.particles,
        );
      } catch {
        recordCanonicalOrbFailure('reduced-motion-first-frame');
      }
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
    } else {
      scheduleStaticRendererHealthcheck();
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
    const stillTime = resolveReducedMotionOrbStillTime(state.time);
    state.time = stillTime;
    state.targetValence = valence;
    state.currentValence = valence;
    targetValenceRef.current = valence;
    smoothValenceRef.current = valence;

    if (workerRendererRef.current) {
      workerRendererRef.current.render({
        valence,
        time: resolveOrbGpuShaderTime(stillTime),
        organicTime: resolveOrbGpuOrganicTime(stillTime),
        paletteTime: resolveOrbGpuPaletteTime(stillTime),
        motionPhase: state.motionPhase,
        noisePhase: resolveOrbGpuNoisePhase(state.noisePhase),
        pulsePhase: state.pulsePhase,
        breathPhase: state.breathPhase,
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
      try {
        glRendererRef.current.render({
          valence,
          time: resolveOrbGpuShaderTime(stillTime),
          organicTime: resolveOrbGpuOrganicTime(stillTime),
          paletteTime: resolveOrbGpuPaletteTime(stillTime),
          motionPhase: state.motionPhase,
          noisePhase: resolveOrbGpuNoisePhase(state.noisePhase),
          pulsePhase: state.pulsePhase,
          breathPhase: state.breathPhase,
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
      } catch {
        recordCanonicalOrbFailure('reduced-motion-valence');
        recoverCanonicalGpuLossRef.current();
        return;
      }
      markVisualReadyRef.current();
    } else {
      const rendererOverride = getRendererOverride();
      if (renderer === 'webgl' || renderer === 'webgpu' || rendererOverride === 'webgl' || rendererOverride === 'webgpu') return;
      const ctx = canvas.getContext('2d');
      if (!ctx) return;
      drawOrbScene(ctx, {
        valence,
        time: stillTime,
        motionPhase: state.motionPhase,
        noisePhase: state.noisePhase,
        breathPhase: state.breathPhase,
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
