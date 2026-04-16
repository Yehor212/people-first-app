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

// ── Constants ──

/** CSS size in pixels */
const ORB_SIZE = 24;
/** Max device pixel ratio for canvas */
const MAX_DPR = 2.0;
/** Frame interval for 30 FPS */
const FRAME_INTERVAL_MS = 1000 / 30;
/** Fixed neutral valence for color derivation */
const NEUTRAL_VALENCE = 0.0;

// ── Shader Sources ──

const MINI_VERT_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const MINI_VERT_SRC_300 = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

/**
 * Simplified fragment shader for 24px mini-orb.
 * Keeps: superformula SDF, color, breathing, glass transparency, Fresnel rim, GGX specular.
 * Removes: caustics, particles, volumetric rays, concentric rings, iridescence, hope sparkle.
 */
const MINI_FRAG_SRC = `
precision highp float;

uniform vec2 uResolution;
uniform float uTime;
uniform vec3 uColor;
uniform float uBrightness;
uniform float uShapeM;
uniform float uShapeN1;
uniform float uBreathPeriod;
uniform float uIsDark;

// ── Simplex noise (minimal — single octave for 24px) ──
vec3 mod289v3(vec3 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 mod289v4(vec4 x) { return x - floor(x * (1.0 / 289.0)) * 289.0; }
vec4 permute(vec4 x) { return mod289v4((x * 34.0 + 1.0) * x); }
vec4 taylorInvSqrt(vec4 r) { return 1.79284291400159 - 0.85373472095314 * r; }

float snoise(vec3 v) {
  const vec2 C = vec2(1.0 / 6.0, 1.0 / 3.0);
  const vec4 D = vec4(0.0, 0.5, 1.0, 2.0);
  vec3 i = floor(v + dot(v, C.yyy));
  vec3 x0 = v - i + dot(i, C.xxx);
  vec3 g = step(x0.yzx, x0.xyz);
  vec3 l = 1.0 - g;
  vec3 i1 = min(g, l.zxy);
  vec3 i2 = max(g, l.zxy);
  vec3 x1 = x0 - i1 + C.xxx;
  vec3 x2 = x0 - i2 + C.yyy;
  vec3 x3 = x0 - D.yyy;
  i = mod289v3(i);
  vec4 p = permute(permute(permute(
    i.z + vec4(0.0, i1.z, i2.z, 1.0))
  + i.y + vec4(0.0, i1.y, i2.y, 1.0))
  + i.x + vec4(0.0, i1.x, i2.x, 1.0));
  float n_ = 0.142857142857;
  vec3 ns = n_ * D.wyz - D.xzx;
  vec4 j = p - 49.0 * floor(p * ns.z * ns.z);
  vec4 x_ = floor(j * ns.z);
  vec4 y_ = floor(j - 7.0 * x_);
  vec4 x = x_ * ns.x + ns.yyyy;
  vec4 y = y_ * ns.x + ns.yyyy;
  vec4 h = 1.0 - abs(x) - abs(y);
  vec4 b0 = vec4(x.xy, y.xy);
  vec4 b1 = vec4(x.zw, y.zw);
  vec4 s0 = floor(b0) * 2.0 + 1.0;
  vec4 s1 = floor(b1) * 2.0 + 1.0;
  vec4 sh = -step(h, vec4(0.0));
  vec4 a0 = b0.xzyw + s0.xzyw * sh.xxyy;
  vec4 a1 = b1.xzyw + s1.xzyw * sh.zzww;
  vec3 p0 = vec3(a0.xy, h.x);
  vec3 p1 = vec3(a0.zw, h.y);
  vec3 p2 = vec3(a1.xy, h.z);
  vec3 p3 = vec3(a1.zw, h.w);
  vec4 norm = taylorInvSqrt(vec4(dot(p0, p0), dot(p1, p1), dot(p2, p2), dot(p3, p3)));
  p0 *= norm.x; p1 *= norm.y; p2 *= norm.z; p3 *= norm.w;
  vec4 m = max(0.6 - vec4(dot(x0, x0), dot(x1, x1), dot(x2, x2), dot(x3, x3)), 0.0);
  m = m * m;
  return 42.0 * dot(m * m, vec4(dot(p0, x0), dot(p1, x1), dot(p2, x2), dot(p3, x3)));
}

// ── Superformula ──
float superformula(float theta, float m, float n1, float n2, float n3) {
  float a = m * theta * 0.25;
  float t1 = pow(abs(cos(a)), n2);
  float t2 = pow(abs(sin(a)), n3);
  float sum = t1 + t2;
  if (sum < 0.0000001) return 1.0;
  return pow(sum, -1.0 / n1);
}

void main() {
  vec2 uv = gl_FragCoord.xy / uResolution;
  vec2 center = uv - 0.5;
  float dist = length(center);
  float angle = atan(center.y, center.x);

  // Breathing animation
  float breathPhase = fract(uTime / uBreathPeriod);
  float breathInhale = smoothstep(0.0, 0.333, breathPhase);
  float breathExhale = 1.0 - smoothstep(0.417, 0.833, breathPhase);
  float breathPause = step(0.833, breathPhase);
  float breathCurve = min(breathInhale, breathExhale) * (1.0 - breathPause);
  float breath = 1.0 + breathCurve * 0.05 - 0.025;

  // Slow rotation
  float rotation = uTime * 0.03;
  float rotAngle = angle + rotation;

  // Single-octave noise displacement (simplified for 24px)
  float ca = cos(rotAngle);
  float sa = sin(rotAngle);
  float nv = snoise(vec3(ca * 2.5 + uTime * 0.3, sa * 2.5 + uTime * 0.21, 10.0));
  float noiseDisp = nv * 0.005;

  // Superformula shape — n2/n3 derived from n1 for simplicity
  float n2 = mix(1.25, 2.0, (uShapeN1 - 1.4) / 1.1);
  float n3 = n2;
  float sf = superformula(rotAngle, uShapeM, uShapeN1, n2, n3);
  float baseR = 0.30;
  float shapeR = baseR * sf * breath * (1.0 + noiseDisp);

  // SDF + soft edge
  float sdf = dist - shapeR;
  float edge = 1.0 - smoothstep(-0.02, 0.02, sdf);

  // 3D normal (sphere approximation)
  float normalZ = sqrt(max(0.001, 1.0 - clamp(dist * dist / (shapeR * shapeR), 0.0, 1.0)));
  vec3 normal = normalize(vec3(center * 2.0, normalZ));

  // Lighting
  vec3 lightDir = normalize(vec3(-0.4, 0.4, 1.0));
  vec3 viewDir = vec3(0.0, 0.0, 1.0);
  float diff = max(dot(normal, lightDir), 0.0);

  // GGX specular (white — glass reflects light)
  vec3 halfDir = normalize(lightDir + viewDir);
  float roughness = 0.28;
  float a2 = roughness * roughness;
  a2 = a2 * a2;
  float NdotH = max(dot(normal, halfDir), 0.0);
  float denom = NdotH * NdotH * (a2 - 1.0) + 1.0;
  float ggxD = a2 / (3.14159 * denom * denom);
  float specF = 0.08 + 0.92 * pow(1.0 - max(dot(halfDir, viewDir), 0.0), 5.0);
  vec3 specular = vec3(1.0) * ggxD * specF * 0.55;

  // Fresnel rim
  float fresnel = pow(1.0 - max(dot(normal, viewDir), 0.0), 4.2);
  float fresnelStr = uIsDark > 0.5 ? 0.70 : 0.55;

  // Apply brightness from typing speed
  vec3 baseColor = uColor * uBrightness;

  // Compose
  vec3 ambient = baseColor * 0.30;
  vec3 diffuse = baseColor * diff * 0.55;
  vec3 rim = mix(baseColor, vec3(1.0), 0.40) * fresnel * fresnelStr;
  vec3 litColor = ambient + diffuse + specular + rim;

  // Glass transparency (bright center, transparent edge)
  float glassDepth = exp(-dist * dist / (shapeR * shapeR * 0.18)) * 0.65 + 0.05;
  float glassEdge = edge * glassDepth;

  // Luminous core
  float coreGlow = exp(-dist * dist / (shapeR * shapeR * 0.10)) * 0.20;
  vec3 coreColor = mix(baseColor * 1.1, vec3(1.0), 0.30);
  litColor += coreColor * coreGlow;

  // Aura glow
  float aura = exp(-dist * 2.8) * 0.12 * (uIsDark > 0.5 ? 1.15 : 1.0);
  float bloom = exp(-dist * 5.0) * 0.05;

  vec3 finalColor = litColor * glassEdge + baseColor * aura + vec3(1.0) * bloom * 0.2;
  float finalAlpha = clamp(glassEdge + aura + bloom, 0.0, 1.0);

  // Vignette
  float vignette = 1.0 - smoothstep(0.42, 0.52, dist);
  finalAlpha *= vignette;

  // Kill sub-threshold alpha
  finalAlpha *= smoothstep(0.0, 0.015, finalAlpha);

  // ACES tone mapping
  float tmA = 2.51; float tmB = 0.03; float tmC = 2.43; float tmD = 0.59; float tmE = 0.14;
  finalColor = clamp((finalColor * (tmA * finalColor + tmB)) / (finalColor * (tmC * finalColor + tmD) + tmE), 0.0, 1.0);

  // Premultiplied alpha
  gl_FragColor = vec4(finalColor * finalAlpha, finalAlpha);
}
`;

const MINI_FRAG_SRC_300 = MINI_FRAG_SRC
  .replace(
    '\nprecision highp float;',
    '#version 300 es\nprecision highp float;\nout vec4 fragColor;',
  )
  .replace('gl_FragColor', 'fragColor');

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

      // Exponential interpolation (0.5s settle — same pattern as ValenceOrb)
      const lerpRate = 1 - Math.pow(1 - 0.06, dt * 30);
      const cur = currentRef.current;
      const tgt = targetRef.current;

      cur.brightness += (tgt.brightness - cur.brightness) * lerpRate;
      cur.shapeN1 += (tgt.shapeN1 - cur.shapeN1) * lerpRate;
      cur.shapeM += (tgt.shapeM - cur.shapeM) * lerpRate;
      cur.breathPeriod += (tgt.breathPeriod - cur.breathPeriod) * lerpRate;

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
