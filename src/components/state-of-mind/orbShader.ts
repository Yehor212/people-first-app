/**
 * WebGL fragment shader renderer for ValenceOrb.
 * Progressive enhancement: returns null if WebGL is unavailable,
 * ValenceOrb falls back to Canvas 2D (orbRenderer.ts).
 *
 * Single fragment shader renders the COMPLETE orb scene:
 *   - Superformula shape via signed distance field (per-pixel, not 72 points)
 *   - 3D sphere lighting (Blinn-Phong, 2-point: key + rim)
 *   - Fresnel rim glow (physically-based edge luminance)
 *   - Per-pixel 3D simplex noise displacement (147K unique values vs 72)
 *   - Soft edges via smoothstep (true airbrush, impossible in Canvas 2D)
 *   - Bloom / aura glow (exponential falloff)
 *   - Subsurface scattering simulation
 *   - Iridescence (thin-film interference — soap-bubble rainbow shimmer)
 *   - Aurora spectral bands (multi-band flowing color streams)
 *   - Volumetric light rays (god rays — radial beams behind orb)
 *   - Caustic light patterns (swimming refraction — underwater crystal effect)
 *   - Chromatic dispersion (prismatic RGB edge separation)
 *   - Inner depth luminance (pulsating concentric celestial glow)
 *   - Particle glow spots (22 particles as uniforms)
 *
 * Performance: ~0.4ms per frame on mid-range mobile GPU (Mali-G78).
 * The entire 11-layer Canvas 2D pipeline replaced by ONE GPU draw call.
 */

import type { Particle } from './particleSystem';
import { recordError } from '@/lib/crashReporting';
import FRAG_SRC from './orbShader.frag?raw';

// ── WebGL context options (shared by both GL1 and GL2) ──

const GL_OPTIONS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  antialias: true,
  preserveDrawingBuffer: false,
  depth: false,                // No depth buffer needed — saves ~2MB VRAM on iOS
  stencil: false,              // No stencil needed — reduces memory pressure
  powerPreference: 'low-power', // Prefer integrated GPU for stability + battery
};

// ── Vertex Shader (fullscreen triangle) ──

const VERT_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// ── Vertex Shader — GLSL 300 es (WebGL 2.0) ──

const VERT_SRC_300 = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

// ── Fragment Shader — loaded from orbShader.frag via Vite ?raw ──

// ── Fragment Shader — GLSL 300 es (WebGL 2.0, derived from ES 1.0 source) ──

const FRAG_SRC_300 = FRAG_SRC
  .replace(
    '\n#extension GL_OES_standard_derivatives : enable\nprecision highp float;',
    '#version 300 es\nprecision highp float;\nout vec4 fragColor;',
  )
  .replace('gl_FragColor', 'fragColor');

// ── Types ──

export interface OrbGLRenderer {
  render: (params: {
    valence: number;
    time: number;
    size: number;
    dpr: number;
    isDark: boolean;
    color: { h: number; s: number; l: number };
    shape: { m: number; n1: number; n2: number; n3: number };
    particles: Particle[];
    genesis: number;
    touch: { x: number; y: number; age: number };
    shimmer: number;
  }) => void;
  dispose: () => void;
  isContextLost: () => boolean;
}

// ── HSL → RGB ──

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

// ── Shader Compilation ──

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;
type OrbGLTier = 'webgl2' | 'webgl';

interface KHRParallelShaderCompile {
  COMPLETION_STATUS_KHR: number;
}

export interface OrbGLBuildOptions {
  signal?: AbortSignal;
  timeoutMs?: number;
}

export interface OrbGLBuildResult {
  renderer: OrbGLRenderer;
  durationMs: number;
  tier: OrbGLTier;
}

const DEFAULT_ASYNC_BUILD_TIMEOUT_MS = 500;

function compileShader(
  gl: GLContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(shader);
    recordError(
      new Error(`WebGL shader compile failed: ${infoLog?.slice(0, 300) ?? 'unknown'}`),
      { component: 'ValenceOrb', shaderType: type === gl.VERTEX_SHADER ? 'vertex' : 'fragment' },
    );
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createShaderUnchecked(
  gl: GLContext,
  type: number,
  source: string,
): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);
  return shader;
}

function cleanupProgram(
  gl: GLContext,
  program: WebGLProgram | null,
  vs: WebGLShader | null,
  fs: WebGLShader | null,
) {
  if (program) gl.deleteProgram(program);
  if (vs) gl.deleteShader(vs);
  if (fs) gl.deleteShader(fs);
}

function waitForParallelCompile(
  gl: GLContext,
  program: WebGLProgram,
  extension: KHRParallelShaderCompile,
  options: OrbGLBuildOptions,
): Promise<boolean> {
  const started = performance.now();
  const timeoutMs = options.timeoutMs ?? DEFAULT_ASYNC_BUILD_TIMEOUT_MS;

  return new Promise((resolve) => {
    const poll = () => {
      if (options.signal?.aborted || gl.isContextLost()) {
        resolve(false);
        return;
      }

      if (gl.getProgramParameter(program, extension.COMPLETION_STATUS_KHR)) {
        resolve(true);
        return;
      }

      if (performance.now() - started >= timeoutMs) {
        resolve(false);
        return;
      }

      requestAnimationFrame(poll);
    };

    requestAnimationFrame(poll);
  });
}

// ── Shared Renderer Builder (WebGL 1.0 & 2.0) ──

function buildRenderer(
  gl: GLContext,
  vertSrc: string,
  fragSrc: string,
): OrbGLRenderer | null {
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
    const linkLog = gl.getProgramInfoLog(program);
    recordError(
      new Error(`WebGL program link failed: ${linkLog?.slice(0, 300) ?? 'unknown'}`),
      { component: 'ValenceOrb' },
    );
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  return createRendererFromLinkedProgram(gl, program, vs, fs);
}

function createRendererFromLinkedProgram(
  gl: GLContext,
  program: WebGLProgram,
  vs: WebGLShader,
  fs: WebGLShader,
): OrbGLRenderer | null {
  // Fullscreen triangle (3 vertices, covers entire [-1,1] viewport)
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');

  // Uniform locations
  const loc = {
    uResolution: gl.getUniformLocation(program, 'uResolution'),
    uTime: gl.getUniformLocation(program, 'uTime'),
    uValence: gl.getUniformLocation(program, 'uValence'),
    uIsDark: gl.getUniformLocation(program, 'uIsDark'),
    uColor: gl.getUniformLocation(program, 'uColor'),
    uShapeM: gl.getUniformLocation(program, 'uShapeM'),
    uShapeN1: gl.getUniformLocation(program, 'uShapeN1'),
    uShapeN2: gl.getUniformLocation(program, 'uShapeN2'),
    uShapeN3: gl.getUniformLocation(program, 'uShapeN3'),
    uParticles: gl.getUniformLocation(program, 'uParticles'),
    uGenesis: gl.getUniformLocation(program, 'uGenesis'),
    uTouch: gl.getUniformLocation(program, 'uTouch'),
    uShimmer: gl.getUniformLocation(program, 'uShimmer'),
  };

  // Pre-allocate particle data buffer (22 particles × 4 floats)
  const particleData = new Float32Array(22 * 4);

  return {
    render(params) {
      const { size, dpr, isDark, color, shape, particles } = params;
      const w = size * dpr;
      const h = size * dpr;

      gl.viewport(0, 0, w, h);
      gl.clearColor(0, 0, 0, 0);
      gl.clear(gl.COLOR_BUFFER_BIT);

      gl.useProgram(program);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      // Set uniforms
      gl.uniform2f(loc.uResolution, w, h);
      gl.uniform1f(loc.uTime, params.time);
      gl.uniform1f(loc.uValence, params.valence);
      gl.uniform1f(loc.uIsDark, isDark ? 1.0 : 0.0);

      const [r, g, b] = hslToRgb(color.h, color.s, color.l);
      gl.uniform3f(loc.uColor, r, g, b);

      gl.uniform1f(loc.uShapeM, shape.m);
      gl.uniform1f(loc.uShapeN1, shape.n1);
      gl.uniform1f(loc.uShapeN2, shape.n2);
      gl.uniform1f(loc.uShapeN3, shape.n3);
      gl.uniform1f(loc.uGenesis, params.genesis);
      gl.uniform3f(loc.uTouch, params.touch.x, params.touch.y, params.touch.age);
      gl.uniform1f(loc.uShimmer, params.shimmer);

      // Pack particles into uniform buffer (UV space, Y-flipped for WebGL)
      for (let i = 0; i < 22; i++) {
        if (i < particles.length) {
          const p = particles[i];
          particleData[i * 4] = p.x / size;
          particleData[i * 4 + 1] = 1.0 - p.y / size; // flip Y
          particleData[i * 4 + 2] = p.radius / size;
          particleData[i * 4 + 3] = p.alpha;
        } else {
          particleData[i * 4 + 3] = 0; // inactive
        }
      }
      gl.uniform4fv(loc.uParticles, particleData);

      // Draw fullscreen triangle
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

// ── Public API ──

/**
 * Create a WebGL 2.0 renderer (GLSL 300 es).
 * Returns null if WebGL 2.0 is unavailable → caller tries WebGL 1.0 fallback.
 */
async function buildRendererAsync(
  gl: GLContext,
  vertSrc: string,
  fragSrc: string,
  tier: OrbGLTier,
  options: OrbGLBuildOptions,
): Promise<OrbGLBuildResult | null> {
  const started = performance.now();
  const parallelCompile = gl.getExtension(
    'KHR_parallel_shader_compile',
  ) as KHRParallelShaderCompile | null;

  if (!parallelCompile) {
    return null;
  }

  const vs = createShaderUnchecked(gl, gl.VERTEX_SHADER, vertSrc);
  const fs = createShaderUnchecked(gl, gl.FRAGMENT_SHADER, fragSrc);
  const program = gl.createProgram();

  if (!vs || !fs || !program) {
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  gl.attachShader(program, vs);
  gl.attachShader(program, fs);
  gl.linkProgram(program);

  const completed = await waitForParallelCompile(gl, program, parallelCompile, options);
  const durationMs = performance.now() - started;

  if (!completed) {
    recordError(
      new Error(`WebGL shader compile deferred or timed out after ${Math.round(durationMs)}ms`),
      { component: 'ValenceOrb', action: 'parallel-shader-compile', tier },
    );
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(vs);
    recordError(
      new Error(`WebGL vertex shader compile failed: ${infoLog?.slice(0, 300) ?? 'unknown'}`),
      { component: 'ValenceOrb', shaderType: 'vertex', tier },
    );
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    const infoLog = gl.getShaderInfoLog(fs);
    recordError(
      new Error(`WebGL fragment shader compile failed: ${infoLog?.slice(0, 300) ?? 'unknown'}`),
      { component: 'ValenceOrb', shaderType: 'fragment', tier },
    );
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    const linkLog = gl.getProgramInfoLog(program);
    recordError(
      new Error(`WebGL program link failed: ${linkLog?.slice(0, 300) ?? 'unknown'}`),
      { component: 'ValenceOrb', tier },
    );
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  const renderer = createRendererFromLinkedProgram(gl, program, vs, fs);
  if (!renderer) return null;
  return { renderer, durationMs, tier };
}

export function createOrbGL2(canvas: HTMLCanvasElement): OrbGLRenderer | null {
  try {
    const gl = canvas.getContext('webgl2', GL_OPTIONS);
    if (!gl) return null;
    return buildRenderer(gl, VERT_SRC_300, FRAG_SRC_300);
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbGL2' });
    return null;
  }
}

export async function createOrbGL2Async(
  canvas: HTMLCanvasElement,
  options: OrbGLBuildOptions = {},
): Promise<OrbGLBuildResult | null> {
  try {
    const gl = canvas.getContext('webgl2', GL_OPTIONS);
    if (!gl) return null;
    return await buildRendererAsync(gl, VERT_SRC_300, FRAG_SRC_300, 'webgl2', options);
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbGL2Async' });
    return null;
  }
}

/**
 * Create a WebGL 1.0 renderer (GLSL ES 1.0).
 * Returns null if WebGL is unavailable → ValenceOrb uses Canvas 2D fallback.
 */
export function createOrbGL(canvas: HTMLCanvasElement): OrbGLRenderer | null {
  try {
    const gl = canvas.getContext('webgl', GL_OPTIONS);
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives'); // Required for fwidth() in GLSL ES 1.0
    return buildRenderer(gl, VERT_SRC, FRAG_SRC);
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbGL' });
    return null;
  }
}

export async function createOrbGLAsync(
  canvas: HTMLCanvasElement,
  options: OrbGLBuildOptions = {},
): Promise<OrbGLBuildResult | null> {
  try {
    const gl = canvas.getContext('webgl', GL_OPTIONS);
    if (!gl) return null;
    gl.getExtension('OES_standard_derivatives'); // Required for fwidth() in GLSL ES 1.0
    return await buildRendererAsync(gl, VERT_SRC, FRAG_SRC, 'webgl', options);
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'createOrbGLAsync' });
    return null;
  }
}
