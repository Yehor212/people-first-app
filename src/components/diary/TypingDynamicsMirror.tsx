/**
 * TypingDynamicsMirror — 24px mini-orb reflecting typing energy.
 *
 * A simplified variant of ValenceOrb purpose-built for 24px rendering.
 * Uses a stripped-down GLSL shader: superformula SDF + color + breathing +
 * glass transparency + Fresnel rim + GGX specular. No caustics, particles,
 * volumetric rays, concentric rings, iridescence, or hope sparkle.
 *
 * Renders at 30 FPS to save GPU budget. Falls back to a static CSS
 * radial-gradient div when WebGL is unavailable or prefers-reduced-motion
 * is active.
 *
 * @see docs/tasks/epics/epic-8-emotional-canvas/stories/EP8_US002-typing-dynamics-mirror/tasks/T1-design-definition.md
 */

import { useRef, useEffect, useState, memo, useMemo } from 'react';
import { valenceToHSL } from '@/components/state-of-mind/colorUtils';
import { recordError } from '@/lib/crashReporting';
import type { TypingDynamics } from '@/hooks/useTypingDynamics';
import { MINI_VERT_SRC, MINI_VERT_SRC_300, MINI_FRAG_SRC, MINI_FRAG_SRC_300 } from './miniOrbShader';

// ── Constants ──

/** CSS size in pixels */
const ORB_SIZE = 24;
/** Max device pixel ratio for canvas */
const MAX_DPR = 2.0;
/** Frame interval for 30 FPS */
const FRAME_INTERVAL_MS = 1000 / 30;
/** Fixed neutral valence for color derivation */
const NEUTRAL_VALENCE = 0.0;
const MINI_TARGET_LERP = 0.034;
const MINI_TAIL_DISTANCE = 0.08;
const MINI_TAIL_MULTIPLIER = 0.5;

// ── Shader Sources ──

// ── HSL to RGB ──

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hSector = h / 60;
  const x = c * (1 - Math.abs((hSector % 2) - 1));
  const m = ln - c / 2;

  let r = 0, g = 0, b = 0;
  if (hSector < 1) { r = c; g = x; }
  else if (hSector < 2) { r = x; g = c; }
  else if (hSector < 3) { g = c; b = x; }
  else if (hSector < 4) { g = x; b = c; }
  else if (hSector < 5) { r = x; b = c; }
  else { r = c; b = x; }

  return [r + m, g + m, b + m];
}

// ── WebGL Mini Renderer ──

interface MiniGLRenderer {
  render: (params: {
    time: number;
    brightness: number;
    shapeM: number;
    shapeN1: number;
    breathPeriod: number;
    color: { h: number; s: number; l: number };
    isDark: boolean;
    dpr: number;
  }) => void;
  dispose: () => void;
  isContextLost: () => boolean;
}

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

function compileShader(gl: GLContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;
  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const log = gl.getShaderInfoLog(shader);
    recordError(
      new Error(`Mini-orb shader compile failed: ${log?.slice(0, 200) ?? 'unknown'}`),
      { component: 'TypingDynamicsMirror' },
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function buildMiniRenderer(gl: GLContext, vertSrc: string, fragSrc: string): MiniGLRenderer | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }

  const program = gl.createProgram();
  if (!program) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const log = gl.getProgramInfoLog(program);
    recordError(
      new Error(`Mini-orb program link failed: ${log?.slice(0, 200) ?? 'unknown'}`),
      { component: 'TypingDynamicsMirror' },
    );
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  // Fullscreen triangle
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');

  const loc = {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uColor: gl.getUniformLocation(program, 'uColor'),
    uBrightness: gl.getUniformLocation(program, 'uBrightness'),
    uShapeM: gl.getUniformLocation(program, 'uShapeM'),
    uShapeN1: gl.getUniformLocation(program, 'uShapeN1'),
    uBreathPeriod: gl.getUniformLocation(program, 'uBreathPeriod'),
    uIsDark: gl.getUniformLocation(program, 'uIsDark'),
  };

  return {
    render(params) {
      const w = ORB_SIZE * params.dpr;
      const h = w;
      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);
      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.uniform2f(loc.uResolution, w, h);
      gl.uniform1f(loc.uTime, params.time);
      gl.uniform1f(loc.uBrightness, params.brightness);
      gl.uniform1f(loc.uShapeM, params.shapeM);
      gl.uniform1f(loc.uShapeN1, params.shapeN1);
      gl.uniform1f(loc.uBreathPeriod, params.breathPeriod);
      gl.uniform1f(loc.uIsDark, params.isDark ? 1.0 : 0.0);

      const [r, g, b] = hslToRgb(params.color.h, params.color.s, params.color.l);
      gl.uniform3f(loc.uColor, r, g, b);

      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(aPosition);
      gl.vertexAttribPointer(aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);
    },
    dispose() {
      gl.deleteProgram(program);
      gl.deleteShader(vs);
      gl.deleteShader(fs);
      if (vbo) gl.deleteBuffer(vbo);
      gl.getExtension('WEBGL_lose_context')?.loseContext();
    },
    isContextLost() {
      return gl.isContextLost();
    },
  };
}

const GL_OPTIONS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: false, // not needed at 24px
  preserveDrawingBuffer: false,
  depth: false,
  stencil: false,
  powerPreference: 'low-power',
};

function createMiniGL(canvas: HTMLCanvasElement): MiniGLRenderer | null {
  try {
    const gl2 = canvas.getContext('webgl2', GL_OPTIONS);
    if (gl2) {
      const renderer = buildMiniRenderer(gl2, MINI_VERT_SRC_300, MINI_FRAG_SRC_300);
      if (renderer) return renderer;
    }
  } catch { /* fall through */ }

  try {
    const gl = canvas.getContext('webgl', GL_OPTIONS);
    if (gl) return buildMiniRenderer(gl, MINI_VERT_SRC, MINI_FRAG_SRC);
  } catch { /* fall through */ }

  return null;
}

// ── Uniform Mapping ──

interface TargetUniforms {
  brightness: number;
  shapeN1: number;
  shapeM: number;
  breathPeriod: number;
}

function mapDynamicsToUniforms(dynamics: TypingDynamics): TargetUniforms {
  // WPM -> brightness: clamp(wpm/60, 0.3, 1.0)
  const brightness = Math.max(0.3, Math.min(1.0, dynamics.wpm / 60));

  // rhythmRegularity -> smoothness: n1 1.4 (erratic) to 2.5 (steady)
  const shapeN1 = 1.4 + dynamics.rhythmRegularity * 1.1;

  // backspaceRate -> spikiness: m 5 (clean) to 8 (heavy editing)
  const shapeM = 5 + Math.min(1.0, dynamics.backspaceRate / 0.3) * 3;

  // isPaused -> breathing rate: 2s (active) to 6s (paused)
  const breathPeriod = dynamics.isPaused ? 6.0 : 2.0;

  return { brightness, shapeN1, shapeM, breathPeriod };
}

function miniOrbLerpRate(delta: number, dt: number): number {
  const tailScale = Math.abs(delta) < MINI_TAIL_DISTANCE ? MINI_TAIL_MULTIPLIER : 1;
  return 1 - Math.pow(1 - MINI_TARGET_LERP * tailScale, dt * 30);
}

// ── Reduced Motion Check (reactive) ──

function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(() => {
    if (typeof window === 'undefined') return false;
    return window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  });

  useEffect(() => {
    const mql = window.matchMedia('(prefers-reduced-motion: reduce)');
    const onChange = (e: MediaQueryListEvent) => setReduced(e.matches);
    mql.addEventListener('change', onChange);
    return () => mql.removeEventListener('change', onChange);
  }, []);

  return reduced;
}

// ── Props ──

interface TypingDynamicsMirrorProps {
  /** Current typing dynamics from useTypingDynamics hook */
  dynamics: TypingDynamics;
}

/**
 * 24px mini-orb that mirrors the writer's typing energy in real time.
 *
 * Maps typing speed, rhythm, editing intensity, and pause state to
 * visual properties of a simplified superformula SDF orb rendered via WebGL.
 *
 * Non-interactive (`pointer-events: none`, `aria-hidden`). Falls back to
 * a CSS radial-gradient when WebGL is unavailable or reduced motion is preferred.
 *
 * @param dynamics - Real-time typing dynamics from `useTypingDynamics`
 */
export const TypingDynamicsMirror = memo(function TypingDynamicsMirror({
  dynamics,
}: TypingDynamicsMirrorProps) {
  const wrapperRef = useRef<HTMLDivElement>(null);
  const rafRef = useRef(0);
  const mountedRef = useRef(true);
  const glRef = useRef<MiniGLRenderer | null>(null);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const [webglFailed, setWebglFailed] = useState(false);

  // Current interpolated uniforms (mutable ref to avoid re-renders)
  const currentRef = useRef<TargetUniforms>({
    brightness: 0.3,
    shapeN1: 2.0,
    shapeM: 6,
    breathPeriod: 6.0,
  });
  const timeRef = useRef(0);
  const lastFrameRef = useRef(0);

  // Keep target in sync with prop (no re-render)
  const targetRef = useRef<TargetUniforms>(mapDynamicsToUniforms(dynamics));
  targetRef.current = mapDynamicsToUniforms(dynamics);

  // Derive color once from theme (neutral valence)
  const orbColor = useMemo(() => valenceToHSL(NEUTRAL_VALENCE), []);

  // Check reduced motion preference (reactive — responds to live toggle)
  const reducedMotion = useReducedMotion();

  // Track mounted state
  useEffect(() => {
    mountedRef.current = true;
    return () => { mountedRef.current = false; };
  }, []);

  // Main WebGL setup + animation loop
  useEffect(() => {
    if (reducedMotion) return;

    const wrapper = wrapperRef.current;
    if (!wrapper) return;

    const dpr = Math.min(window.devicePixelRatio || 1, MAX_DPR);
    const physicalSize = Math.round(ORB_SIZE * dpr);

    // Create canvas
    const canvas = document.createElement('canvas');
    canvas.width = physicalSize;
    canvas.height = physicalSize;
    canvas.style.width = `${ORB_SIZE}px`;
    canvas.style.height = `${ORB_SIZE}px`;
    canvas.setAttribute('aria-hidden', 'true');

    // Try WebGL
    const gl = createMiniGL(canvas);
    if (!gl) {
      setWebglFailed(true);
      return;
    }

    glRef.current = gl;
    canvasRef.current = canvas;
    wrapper.appendChild(canvas);

    const isDarkRead = () => document.documentElement.classList.contains('dark');

    // Animation loop (30 FPS)
    const loop = (timestamp: number) => {
      if (!mountedRef.current) return;

      const elapsed = timestamp - lastFrameRef.current;
      if (elapsed < FRAME_INTERVAL_MS) {
        rafRef.current = requestAnimationFrame(loop);
        return;
      }

      const dt = Math.min(elapsed / 1000, 0.1);
      lastFrameRef.current = timestamp;
      timeRef.current += dt;

      // Frame-rate independent interpolation with a softer final tail, matching the shared orb feel.
      const cur = currentRef.current;
      const tgt = targetRef.current;

      const brightnessDelta = tgt.brightness - cur.brightness;
      const shapeN1Delta = tgt.shapeN1 - cur.shapeN1;
      const shapeMDelta = tgt.shapeM - cur.shapeM;
      const breathPeriodDelta = tgt.breathPeriod - cur.breathPeriod;

      cur.brightness += brightnessDelta * miniOrbLerpRate(brightnessDelta, dt);
      cur.shapeN1 += shapeN1Delta * miniOrbLerpRate(shapeN1Delta, dt);
      cur.shapeM += shapeMDelta * miniOrbLerpRate(shapeMDelta, dt);
      cur.breathPeriod += breathPeriodDelta * miniOrbLerpRate(breathPeriodDelta, dt);

      // Proactive context loss detection
      if (glRef.current?.isContextLost()) {
        glRef.current.dispose();
        glRef.current = null;
        setWebglFailed(true);
        return;
      }

      try {
        glRef.current?.render({
          time: timeRef.current,
          brightness: cur.brightness,
          shapeM: cur.shapeM,
          shapeN1: cur.shapeN1,
          breathPeriod: cur.breathPeriod,
          color: orbColor,
          isDark: isDarkRead(),
          dpr,
        });
      } catch (err) {
        recordError(err, { component: 'TypingDynamicsMirror', action: 'render' });
        glRef.current?.dispose();
        glRef.current = null;
        setWebglFailed(true);
        return;
      }

      rafRef.current = requestAnimationFrame(loop);
    };

    // Context loss/restore handlers
    const handleContextLost = (e: Event) => {
      e.preventDefault();
      cancelAnimationFrame(rafRef.current);
      glRef.current?.dispose();
      glRef.current = null;
      setWebglFailed(true);
      recordError(
        new Error('Mini-orb WebGL context lost — falling back to CSS'),
        { component: 'TypingDynamicsMirror' },
      );
    };

    const handleContextRestored = () => {
      const restored = createMiniGL(canvas);
      if (restored) {
        glRef.current = restored;
        setWebglFailed(false);
        rafRef.current = requestAnimationFrame(loop);
      }
    };

    canvas.addEventListener('webglcontextlost', handleContextLost);
    canvas.addEventListener('webglcontextrestored', handleContextRestored);

    rafRef.current = requestAnimationFrame(loop);

    return () => {
      cancelAnimationFrame(rafRef.current);
      canvas.removeEventListener('webglcontextlost', handleContextLost);
      canvas.removeEventListener('webglcontextrestored', handleContextRestored);
      glRef.current?.dispose();
      glRef.current = null;
      canvasRef.current = null;
      if (wrapper.contains(canvas)) {
        wrapper.removeChild(canvas);
      }
    };
  }, [reducedMotion, orbColor]);

  // Fallback: reduced motion or WebGL failure -> CSS radial gradient
  if (reducedMotion || webglFailed) {
    const brightness = Math.max(0.3, Math.min(0.8, dynamics.wpm / 60));
    return (
      <div
        ref={wrapperRef}
        className="pointer-events-none"
        style={{ width: ORB_SIZE, height: ORB_SIZE }}
        aria-hidden="true"
      >
        <div
          className="rounded-full"
          style={{
            width: ORB_SIZE,
            height: ORB_SIZE,
            opacity: brightness,
            background: `radial-gradient(circle at 35% 35%,
              hsl(var(--primary) / 0.5),
              hsl(var(--primary) / 0.25) 50%,
              hsl(var(--primary) / 0.08) 80%,
              transparent)`,
          }}
        />
      </div>
    );
  }

  return (
    <div
      ref={wrapperRef}
      className="pointer-events-none"
      style={{ width: ORB_SIZE, height: ORB_SIZE }}
      aria-hidden="true"
    />
  );
});
