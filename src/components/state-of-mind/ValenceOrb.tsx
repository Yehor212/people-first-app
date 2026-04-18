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
import { hapticTap, hapticMedium, hapticSelection } from '@/lib/haptics';
import {
  createParticlePool,
  updateParticles,
  burstParticles,
  createVariantPool,
  updateVariantParticles,
  drawVariantParticles,
  VARIANT_COUNTS,
  type ParticleVariant,
} from './particleSystem';
import { drawOrbScene, getShapeParams } from './orbRenderer';
import { valenceToHSL } from './colorUtils';
import { createOrbGL2, createOrbGL } from './orbShader';
import { createOrbBloomPipeline, shouldEnableBloom } from './orbBloomPipeline';
import {
  breathRateForValence,
  breathAmpForValence,
  computeMergeEnvelope,
  pickBlob2SpawnUV,
  MERGE_TOTAL_MS,
  LONG_PRESS_MS,
  LONG_PRESS_SLOP_PX,
} from './orbInteractionHelpers';
import { useThemeStore } from '@/stores/themeStore';
import type { Particle } from './particleSystem';
import type { OrbGLRenderer } from './orbShader';
import type { OrbBloomPipeline } from './orbBloomPipeline';

/** Map theme to particle variant. Called at mount and on theme change. */
function themeToVariant(theme: 'paper' | 'ink' | 'oled'): ParticleVariant {
  if (theme === 'paper') return 'pollen';
  if (theme === 'ink') return 'wisps';
  return 'embers';
}

// Module-level: genesis plays only once per browser session
let genesisPlayed = false;

interface ValenceOrbProps {
  /** Current valence value (-1.0 to 1.0) */
  valence: number;
  /** Size in px (width = height). If omitted, reads CSS clamp(160px, 22vw, 280px) from DOM. */
  size?: number;
  /**
   * Phase 3-B.2: Apple Intelligence shimmer intensity (0..1, default 0.5).
   * Automatically set to 0 when prefers-reduced-motion: reduce (Law 9).
   */
  shimmerStrength?: number;
  /**
   * Phase 3-B.2: enable HDR-ready output so Task B's bloom post-process can threshold
   * bright core pixels. When false, final color clamps to [0,1] (legacy behavior).
   */
  hdrEnabled?: boolean;
  /**
   * Phase 3-B.2 Task B: enable HDR bloom halo post-process.
   * - `undefined` (default) — auto-detect via `shouldEnableBloom()` (device capability gate)
   * - `true` — force-enable (respects capability gate anyway, can still degrade to null)
   * - `false` — force-disable (skip bloom regardless of capability)
   * Reduced-motion users render with bloom intensity 0 (halo frozen at threshold,
   * still visible as a static glow — not jarring like a fully-off disc).
   */
  bloomEnabled?: boolean;
}

const WEBGL_FRAME_INTERVAL = 1000 / 60; // 60fps for WebGL (shader is <1ms)
const CANVAS_FRAME_INTERVAL = 1000 / 30; // 30fps for Canvas 2D fallback
const PARTICLE_COUNT = 22;

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

export const ValenceOrb = memo(function ValenceOrb({
  valence,
  size = 192,
  shimmerStrength = 0.5,
  hdrEnabled = false,
  bloomEnabled,
}: ValenceOrbProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const isVisibleRef = useRef(true);
  const glRendererRef = useRef<OrbGLRenderer | null>(null);
  // Phase 3-B.2 Task B: HDR bloom pipeline + scene-capture FBO.
  // Owned by this effect; disposed on unmount / resize together with renderer.
  const bloomPipelineRef = useRef<OrbBloomPipeline | null>(null);
  const sceneFboRef = useRef<{ framebuffer: WebGLFramebuffer; texture: WebGLTexture } | null>(null);
  const canvasElRef = useRef<HTMLCanvasElement | null>(null);
  const [ctxFailed, setCtxFailed] = useState(false);
  const genesisStartRef = useRef(0);
  const touchRef = useRef<{ x: number; y: number; startTime: number } | null>(null);
  const shimmerRef = useRef(0); // P3: 1.0→0 decaying flash on large valence change
  const prevStableValenceRef = useRef(0); // P3: last settled valence for delta detection
  const lastInteractionRef = useRef(performance.now()); // P4: idle awareness
  const smoothValenceRef = useRef(valence); // P5: smoothed valence for organic color/shape flow
  // Phase 3-B.2: responsive size read from CSS var (debounced via ResizeObserver)
  const effectiveSizeRef = useRef(size);
  // Phase 3-B.2 Task E: theme-aware particle layer (separate 2D canvas above orb)
  const particleCanvasRef = useRef<HTMLCanvasElement | null>(null);
  const particleCtxRef = useRef<CanvasRenderingContext2D | null>(null);
  const variantPoolRef = useRef<Particle[]>([]);
  const currentVariantRef = useRef<ParticleVariant>('pollen');
  // Read theme as reactive value — effect below respawns pool on change
  const appliedTheme = useThemeStore((s) => s.appliedTheme);
  // Phase 3-B.2: independent shimmer clock (pauses on reduced-motion)
  const shimmerTimeRef = useRef(0);
  const iridPhaseRef = useRef(0);
  // Phase 3-B.2: shimmerStrength mirrored to ref so prop changes propagate per-frame
  // without re-initializing the rAF effect (pipeline + FBOs must stay stable).
  const shimmerStrengthRef = useRef(shimmerStrength);
  useEffect(() => {
    shimmerStrengthRef.current = shimmerStrength;
  }, [shimmerStrength]);
  // Phase 3-B.2 Task D: metaball-merge state machine + runtime snapshot.
  //   phase: 'rest' | 'pressing' | 'merging' | 'collapsing' (collapsing = tail of envelope)
  //   pressStart: performance.now() at pointerdown — used to detect 600ms threshold
  //   pressOriginClient: {x,y} client coords for 8px-slop cancellation
  //   mergeStart: performance.now() when long-press threshold fires
  //   blob2UV: UV-space spawn target (sticky through the sequence)
  const mergeStateRef = useRef<{
    phase: 'rest' | 'pressing' | 'merging' | 'collapsing';
    pressStart: number;
    pressOriginClient: { x: number; y: number };
    mergeStart: number;
    blob2UV: { x: number; y: number };
  }>({
    phase: 'rest',
    pressStart: 0,
    pressOriginClient: { x: 0, y: 0 },
    mergeStart: 0,
    blob2UV: { x: 0.5, y: 0.5 },
  });

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
  if (stateRef.current) {
    stateRef.current.targetValence = valence;
    lastInteractionRef.current = performance.now(); // P4: slider change = interaction
  }

  // Law 18: track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // IntersectionObserver: pause RAF when off-screen
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const observer = new IntersectionObserver(
      ([entry]) => { isVisibleRef.current = entry.isIntersecting; },
      { threshold: 0 },
    );
    observer.observe(wrapper);
    return () => observer.disconnect();
  }, []);

  // Phase 3-B.2: responsive size observation (debounced 100ms to avoid thrash on resize).
  // Callers that pass an explicit size prop still "win" via the effectiveSizeRef init;
  // the observer only updates when the DOM box changes (rotate, CSS var re-eval).
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper || typeof ResizeObserver === 'undefined') {
      effectiveSizeRef.current = size;
      return;
    }

    let debounceId: number | undefined;
    effectiveSizeRef.current = size; // seed with prop until first observation

    const observer = new ResizeObserver((entries) => {
      const entry = entries[0];
      if (!entry) return;
      const measured = Math.round(entry.contentRect.width);
      if (measured < 80) return; // guard against zero-size during unmount
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      debounceId = window.setTimeout(() => {
        // Clamp to shader-supported range [160, 280] to match CSS clamp(160px,22vw,280px).
        effectiveSizeRef.current = Math.max(160, Math.min(280, measured));
      }, 100);
    });
    observer.observe(wrapper);
    return () => {
      if (debounceId !== undefined) window.clearTimeout(debounceId);
      observer.disconnect();
    };
  }, [size]);

  // Phase 3-B.2 Task E: theme-aware particle layer (pollen/wisps/embers).
  // Separate 2D canvas above the orb canvas — additive blend reads better
  // above the shader than below it. Mount once; update pool on theme change.
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    const cx = size / 2;
    const cy = size / 2;
    const outerR = size * 0.42;

    // Create canvas and attach above orb (absolute position, pointer-events none)
    const pc = createCanvas(size, dpr);
    pc.style.position = 'absolute';
    pc.style.inset = '0';
    pc.style.pointerEvents = 'none';
    pc.style.zIndex = '1';
    const pctx = pc.getContext('2d', { willReadFrequently: false });
    if (!pctx) return;

    particleCanvasRef.current = pc;
    particleCtxRef.current = pctx;
    wrapper.appendChild(pc);

    // Perf auto-degrade: halve count when bloom capability gate says low-end
    const lowEnd = !shouldEnableBloom();
    const variant = themeToVariant(appliedTheme);
    const baseCount = variant === 'legacy' ? 20 : VARIANT_COUNTS[variant];
    const count = lowEnd ? Math.floor(baseCount * 0.5) : baseCount;

    variantPoolRef.current = createVariantPool(variant, count, cx, cy, outerR);
    currentVariantRef.current = variant;

    return () => {
      if (wrapper.contains(pc)) wrapper.removeChild(pc);
      particleCanvasRef.current = null;
      particleCtxRef.current = null;
      variantPoolRef.current = [];
    };
  }, [size, appliedTheme]);

  // Main canvas + animation setup
  useEffect(() => {
    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);

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

    let activeCanvas: HTMLCanvasElement;
    let glRenderer: OrbGLRenderer | null = null;
    let ctx2d: CanvasRenderingContext2D | null = null;

    // Functional probe: verify WebGL actually renders pixels
    // (WKWebView/in-app browsers may return a context that produces no output)
    const webglWorks = probeWebGLWorks();

    if (webglWorks) {
      // Attempt 1: WebGL 2.0
      const gl2Canvas = createCanvas(size, dpr);
      const gl2Renderer = createOrbGL2(gl2Canvas);

      if (gl2Renderer) {
        glRenderer = gl2Renderer;
        activeCanvas = gl2Canvas;
      } else {
        // Attempt 2: WebGL 1.0 on a FRESH canvas
        // (gl2Canvas may be locked to webgl2 if getContext succeeded but shader failed)
        const gl1Canvas = createCanvas(size, dpr);
        const gl1Renderer = createOrbGL(gl1Canvas);

        if (gl1Renderer) {
          glRenderer = gl1Renderer;
          activeCanvas = gl1Canvas;
        }
      }
    }

    // Canvas 2D fallback (always tried if WebGL skipped or failed)
    if (!glRenderer) {
      const c2dCanvas = createCanvas(size, dpr);
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

    glRendererRef.current = glRenderer;
    canvasElRef.current = activeCanvas;
    wrapper.appendChild(activeCanvas);

    // ── Phase 3-B.2 Task B: HDR Bloom pipeline setup ──
    // Gate by prop + capability. Fails-null silently → orb still renders.
    // Pipeline shares the renderer's GL context (HTML spec forbids a second
    // context on the same canvas). Reduced-motion is handled per-frame below
    // (intensity → 0) so toggling the OS setting mid-session Just Works.
    // Resolve bloom intent: explicit false wins; otherwise capability gate.
    const bloomIntentAllowed = bloomEnabled !== false && (bloomEnabled === true || shouldEnableBloom());
    if (glRenderer && bloomIntentAllowed) {
      const gl = glRenderer.gl;
      const fbW = size * dpr;
      const fbH = size * dpr;

      // Create scene-capture FBO (RGBA8 — universal support).
      // The shader's >1.0 HDR values will clip here; acceptable compromise —
      // half-float FBOs require an extension check that varies across iOS/Safari.
      const sceneTexture = gl.createTexture();
      const sceneFramebuffer = gl.createFramebuffer();
      if (sceneTexture && sceneFramebuffer) {
        gl.bindTexture(gl.TEXTURE_2D, sceneTexture);
        gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, fbW, fbH, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
        gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);
        gl.bindFramebuffer(gl.FRAMEBUFFER, sceneFramebuffer);
        gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, sceneTexture, 0);
        const sceneFboOk = gl.checkFramebufferStatus(gl.FRAMEBUFFER) === gl.FRAMEBUFFER_COMPLETE;
        gl.bindFramebuffer(gl.FRAMEBUFFER, null);

        if (sceneFboOk) {
          const pipeline = createOrbBloomPipeline(gl, fbW, fbH);
          if (pipeline) {
            sceneFboRef.current = { framebuffer: sceneFramebuffer, texture: sceneTexture };
            bloomPipelineRef.current = pipeline;
          } else {
            // Pipeline build failed → dispose stray scene FBO, proceed without bloom.
            gl.deleteTexture(sceneTexture);
            gl.deleteFramebuffer(sceneFramebuffer);
          }
        } else {
          gl.deleteTexture(sceneTexture);
          gl.deleteFramebuffer(sceneFramebuffer);
        }
      } else {
        if (sceneTexture) gl.deleteTexture(sceneTexture);
        if (sceneFramebuffer) gl.deleteFramebuffer(sceneFramebuffer);
      }
    }

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

    // Phase 3-B.2: reduced-motion check — freeze shimmer phase at 0, allow static render
    const reducedMotion = () =>
      typeof window !== 'undefined' &&
      window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;

    // ── Render helpers ──
    const renderGL = (v: number, t: number, particles: Particle[], timestamp = performance.now()) => {
      const gl = glRendererRef.current;
      if (!gl) return;
      // P5: Color breathing — ±2° hue oscillation for organic life
      const color = valenceToHSL(v);
      color.h = (color.h + Math.sin(t * 0.5) * 2 + 360) % 360;
      // Phase 3-B.2: a11y — reduced-motion freezes shimmer at phase 0 (no animation)
      const rm = reducedMotion();
      const effectiveShimmerStrength = rm ? 0 : shimmerStrengthRef.current;
      // Phase 3-B.2 Task B: route render through scene FBO when bloom is live.
      const pipeline = bloomPipelineRef.current;
      const sceneFbo = sceneFboRef.current;
      const bloomActive = pipeline !== null && sceneFbo !== null;
      const fbW = size * dpr;
      const fbH = size * dpr;
      // Phase 3-B.2 Task D: reactive breath driven by current (smoothed) valence.
      // Reduced-motion: pass 0 for rate/amp so shader falls back to legacy static
      // (valence-adaptive, non-reactive) breath and avoids coupling amplitude to UX.
      const reactiveBreathRate = rm ? 0 : breathRateForValence(v);
      const reactiveBreathAmp = rm ? 0 : breathAmpForValence(v);
      // Phase 3-B.2 Task D: metaball merge envelope. 'rest' phase → zero uniforms →
      // shader branches out via `if (uMergeProgress > 0.0)` → zero ALU cost.
      const ms = mergeStateRef.current;
      let mergeProgress = 0;
      let mergeBlob2Scale = 0;
      let mergePulse = 0;
      let mergeBlob2Pos = { x: 0.5, y: 0.5 };
      if (ms.phase === 'merging' || ms.phase === 'collapsing') {
        const tElapsed = timestamp - ms.mergeStart;
        const env = computeMergeEnvelope(tElapsed);
        mergeProgress = env.progress;
        mergeBlob2Scale = env.blob2Scale;
        mergePulse = env.pulse;
        // Lerp blob2 from spawn UV toward center (0.5, 0.5) via `converge`.
        mergeBlob2Pos = {
          x: ms.blob2UV.x + (0.5 - ms.blob2UV.x) * env.converge,
          y: ms.blob2UV.y + (0.5 - ms.blob2UV.y) * env.converge,
        };
        // When envelope returns to 0, return to rest state.
        if (tElapsed >= MERGE_TOTAL_MS) ms.phase = 'rest';
      }
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
        // Phase 3-B.2 Apotheosis
        orbSize: effectiveSizeRef.current,
        shimmerStrength: effectiveShimmerStrength,
        shimmerTime: rm ? 0 : shimmerTimeRef.current,
        thickness: 0.5,
        iridBandPhase: rm ? 0 : iridPhaseRef.current,
        hdrEnabled,
        // Phase 3-B.2 Task B: redirect to scene FBO when bloom is active.
        targetFramebuffer: bloomActive ? sceneFbo.framebuffer : null,
        targetWidth: fbW,
        targetHeight: fbH,
        // Phase 3-B.2 Task D: reactive breath + metaball merge uniforms.
        breathRate: reactiveBreathRate,
        breathAmp: reactiveBreathAmp,
        mergeProgress,
        mergeBlob2Pos,
        mergeBlob2Scale,
        mergePulse,
      });
      // Phase 3-B.2 Task B: composite bloom halo onto on-screen backbuffer.
      // Reduced-motion path passes intensity 0 → halo frozen at threshold-only
      // static glow (we still run the pipeline for the scene→screen copy;
      // skipping it would show nothing since the orb went to an off-screen FBO).
      if (bloomActive) {
        const intensity = rm ? 0 : 0.8;
        pipeline.render(sceneFbo.texture, null, { w: fbW, h: fbH }, 1.0, intensity);
      }
    };

    const renderCanvas2D = (v: number, t: number, particles: Particle[], _timestamp?: number) => {
      if (!ctx2d) return;
      drawOrbScene(ctx2d, {
        valence: v,
        time: t,
        particles,
        size,
        dpr,
        isDark: isDarkRead(),
        shimmer: shimmerRef.current,
      });
    };

    let render = glRenderer ? renderGL : renderCanvas2D;

    // ── Fallback canvas for context loss recovery ──
    let fallbackCanvas: HTMLCanvasElement | null = null;

    /** Degrade to Canvas 2D on a fresh canvas (WebGL canvas is locked) */
    const degradeToCanvas2D = () => {
      // Phase 3-B.2 Task B: tear down bloom pipeline — its GL context is lost.
      // Silently swallow any errors — the context is already dead.
      const pipeline = bloomPipelineRef.current;
      if (pipeline) {
        try { pipeline.dispose(); } catch { /* context lost — dispose is best-effort */ }
        bloomPipelineRef.current = null;
      }
      sceneFboRef.current = null;

      fallbackCanvas = createCanvas(size, dpr);
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
      const frameInterval = glRendererRef.current ? WEBGL_FRAME_INTERVAL : CANVAS_FRAME_INTERVAL;
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

      // P3: Slow interpolation during shimmer (dramatic metamorphosis)
      // dt-based: 1 - (1 - rate)^(dt*30) ensures same visual speed at any fps
      const baseLerp = shimmerRef.current > 0.1 ? 0.02 : 0.06;
      const lerpRate = 1 - Math.pow(1 - baseLerp, dt * 30);

      // Interpolate valence (exponential ease)
      state.currentValence += (state.targetValence - state.currentValence) * lerpRate;

      // ── P4: Idle awareness (meditative slowdown after 8s inactivity) ──
      const idleElapsed = timestamp - lastInteractionRef.current;
      const idleFactor = Math.max(0, Math.min(1, (idleElapsed - 8000) / 4000));

      state.time += dt * (1 - idleFactor * 0.4); // idle → 40% slower internal time

      // Phase 3-B.2: advance Apple Intelligence shimmer clock + iridescence phase.
      // Reduced-motion: renderGL() passes 0 regardless; we still advance the ref so
      // when user turns reduced-motion off mid-session, phase is continuous.
      shimmerTimeRef.current += dt;
      iridPhaseRef.current = (iridPhaseRef.current + dt * 0.015) % 1.0;

      // P5: Smoothed valence — organic flow between color/shape states
      // Factor 0.12 per frame → ~130ms settle time. Responsive on drag, visible on tap.
      const smoothLerp = 1 - Math.pow(1 - 0.12, dt * 60);
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

        // Phase 3-B.2 Task E: theme-variant particle layer update + draw.
        // dt-scaled (frame-rate independent), skipped under reduced-motion.
        const variant = currentVariantRef.current;
        const variantPool = variantPoolRef.current;
        const pctx = particleCtxRef.current;
        const pcanvas = particleCanvasRef.current;
        if (variant !== 'legacy' && variantPool.length > 0 && pctx && pcanvas) {
          const rmForParticles =
            typeof window !== 'undefined' &&
            window.matchMedia?.('(prefers-reduced-motion: reduce)').matches === true;
          if (!rmForParticles) {
            updateVariantParticles(variantPool, variant, cx, cy, outerR, dt);
          }
          // Always clear + redraw (static frame on reduced-motion)
          pctx.setTransform(1, 0, 0, 1, 0, 0);
          pctx.clearRect(0, 0, pcanvas.width, pcanvas.height);
          drawVariantParticles(pctx, variantPool, variant, dpr);
        }
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
      // Re-probe WebGL on the original canvas (it gets its context back)
      const restored = createOrbGL2(activeCanvas) ?? createOrbGL(activeCanvas);
      if (restored) {
        glRendererRef.current = restored;
        ctx2d = null;
        render = renderGL;

        // Remove fallback canvas, show original
        activeCanvas.style.display = '';
        if (fallbackCanvas && wrapper.contains(fallbackCanvas)) {
          wrapper.removeChild(fallbackCanvas);
          fallbackCanvas = null;
        }
      }
      // Restart RAF loop
      if (shouldAnimate() && mountedRef.current) {
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    // Only attach WebGL event listeners if we're using WebGL
    if (glRenderer) {
      activeCanvas.addEventListener('webglcontextlost', handleContextLost);
      activeCanvas.addEventListener('webglcontextrestored', handleContextRestored);
    }

    // ── Touch + long-press handler (P2 + Task D) ──
    // Long-press state machine (600ms): rest → pressing → merging → collapsing → rest.
    // Cancel conditions (handled in pointermove/up/cancel):
    //   • pointer moved >8px      → scroll, not press
    //   • pointer lifted <600ms   → tap, not press
    //   • pointer canceled        → OS yanked the gesture
    let longPressTimer: number | undefined;
    const resetPressTimer = () => {
      if (longPressTimer !== undefined) {
        window.clearTimeout(longPressTimer);
        longPressTimer = undefined;
      }
    };
    // Reduced-motion check reuses the existing closure-scoped helper.
    const handlePointerDown = (e: PointerEvent) => {
      const rect = activeCanvas.getBoundingClientRect();
      const x = (e.clientX - rect.left) / rect.width;
      const y = 1.0 - (e.clientY - rect.top) / rect.height; // flip Y for WebGL UV
      const state = stateRef.current;
      if (!state) return;
      touchRef.current = { x, y, startTime: state.time };
      lastInteractionRef.current = performance.now();
      void hapticTap();

      // Arm the long-press timer only when not already animating a merge
      const ms = mergeStateRef.current;
      if (ms.phase !== 'rest') return;
      ms.phase = 'pressing';
      ms.pressStart = performance.now();
      ms.pressOriginClient = { x: e.clientX, y: e.clientY };
      resetPressTimer();
      longPressTimer = window.setTimeout(() => {
        // Timer fired → confirm we're still pressing (move/up would have cleared phase)
        if (mergeStateRef.current.phase !== 'pressing') return;
        // Reduced-motion path: silent orb pulse + haptic only, no shader merge
        if (reducedMotion()) {
          mergeStateRef.current.phase = 'rest';
          void hapticMedium();
          return;
        }
        mergeStateRef.current.blob2UV = pickBlob2SpawnUV();
        mergeStateRef.current.mergeStart = performance.now();
        mergeStateRef.current.phase = 'merging';
        void hapticMedium(); // 600ms threshold haptic
        // Selection haptic at merge peak (~800ms after start) — pulse midpoint
        window.setTimeout(() => { void hapticSelection(); }, 900);
      }, LONG_PRESS_MS);
    };
    const cancelPress = () => {
      resetPressTimer();
      if (mergeStateRef.current.phase === 'pressing') {
        mergeStateRef.current.phase = 'rest';
      }
    };
    const handlePointerMove = (e: PointerEvent) => {
      const ms = mergeStateRef.current;
      if (ms.phase !== 'pressing') return;
      const dx = e.clientX - ms.pressOriginClient.x;
      const dy = e.clientY - ms.pressOriginClient.y;
      if (Math.hypot(dx, dy) > LONG_PRESS_SLOP_PX) cancelPress();
    };
    const handlePointerUp = () => {
      if (mergeStateRef.current.phase === 'pressing') cancelPress();
    };
    // passive: true — never blocks scroll/swipe gestures
    wrapper.addEventListener('pointerdown', handlePointerDown, { passive: true });
    wrapper.addEventListener('pointermove', handlePointerMove, { passive: true });
    wrapper.addEventListener('pointerup', handlePointerUp, { passive: true });
    wrapper.addEventListener('pointercancel', cancelPress, { passive: true });

    // ── Cleanup ──
    const cleanup = () => {
      cancelAnimationFrame(rafRef.current);
      resetPressTimer();
      mergeStateRef.current.phase = 'rest';
      wrapper.removeEventListener('pointerdown', handlePointerDown);
      wrapper.removeEventListener('pointermove', handlePointerMove);
      wrapper.removeEventListener('pointerup', handlePointerUp);
      wrapper.removeEventListener('pointercancel', cancelPress);
      if (glRenderer) {
        activeCanvas.removeEventListener('webglcontextlost', handleContextLost);
        activeCanvas.removeEventListener('webglcontextrestored', handleContextRestored);
      }
      // Phase 3-B.2 Task B: dispose bloom pipeline + scene FBO BEFORE the renderer
      // (they share its GL context; disposing the renderer loses WEBGL_lose_context).
      const pipeline = bloomPipelineRef.current;
      const sceneFbo = sceneFboRef.current;
      const glForBloom = glRendererRef.current?.gl;
      if (pipeline) {
        pipeline.dispose();
        bloomPipelineRef.current = null;
      }
      if (sceneFbo && glForBloom) {
        glForBloom.deleteTexture(sceneFbo.texture);
        glForBloom.deleteFramebuffer(sceneFbo.framebuffer);
      }
      sceneFboRef.current = null;
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

    rafRef.current = requestAnimationFrame(loop);

    return cleanup;
    // Phase 3-B.2 Task B: bloomEnabled / hdrEnabled changes require re-init
    // (pipeline + scene FBO depend on these flags being stable for the lifetime
    // of the renderer). shimmerStrength is read via ref (shimmerStrengthRef) so
    // prop updates don't trigger re-init but are picked up per-frame.
  }, [size, bloomEnabled, hdrEnabled]);

  // Update static frame when valence changes and animations are off
  useEffect(() => {
    if (shouldAnimate()) return;

    const canvas = canvasElRef.current;
    if (!canvas) return;
    const state = stateRef.current;
    if (!state) return;

    const dpr = Math.min(window.devicePixelRatio || 1, 2);
    state.currentValence = valence;

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
      style={{ width: size, height: size, touchAction: 'manipulation' }}
      aria-hidden="true"
    />
  );
});
