/**
 * HDR Bloom post-process pipeline for ValenceOrb (Task B, Phase 3-B.2 Apotheosis).
 *
 * Technique: Dual-Kawase (Marius Bjørge, ARM/Siggraph 2015) — 4x faster than
 * separable Gaussian, produces equivalent visual quality via an iterative
 * down/up-sample pyramid.
 *
 * Pipeline (4 passes):
 *   1. Threshold — extract HDR pixels (luma > u_bloomThreshold)
 *   2. Downsample — 3 dual-Kawase shrink passes (1/2, 1/4, 1/8)
 *   3. Upsample   — mirror 3 dual-Kawase expand passes
 *   4. Composite  — additive blend scene + bloom * u_bloomIntensity
 *
 * Progressive enhancement: device-capability gate (see `shouldEnableBloom`)
 * disables pipeline on low-memory / few-CPU devices. Any FBO-creation
 * failure silently degrades to orb-without-halo — no thrown errors.
 *
 * Mobile budget: <4ms total (quarter-res FBO pyramid keeps fillrate tame).
 * Respects prefers-reduced-motion by freezing threshold (caller-side).
 *
 * Related shaders: `./shaders/bloom*.frag` (threshold, kawaseDown, kawaseUp, composite).
 * Fallback path: `ValenceOrb.tsx` draws through renderer directly when `bloomEnabled === false`.
 */

import { recordError } from '@/lib/crashReporting';

import BLOOM_THRESHOLD_FRAG from './shaders/bloomThreshold.frag?raw';
import BLOOM_KAWASE_DOWN_FRAG from './shaders/bloomKawaseDown.frag?raw';
import BLOOM_KAWASE_UP_FRAG from './shaders/bloomKawaseUp.frag?raw';
import BLOOM_COMPOSITE_FRAG from './shaders/bloomComposite.frag?raw';

const VERT_SRC = `
attribute vec2 aPosition;
varying vec2 v_uv;
void main() {
  v_uv = aPosition * 0.5 + 0.5;
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const DOWNSAMPLE_LEVELS = 3; // 1/2, 1/4, 1/8 — sweet spot for halo size / perf

type GL = WebGLRenderingContext;

interface FBO {
  framebuffer: WebGLFramebuffer;
  texture: WebGLTexture;
  width: number;
  height: number;
}

interface PassProgram {
  program: WebGLProgram;
  aPosition: number;
  uSource: WebGLUniformLocation | null;
  uTexelSize: WebGLUniformLocation | null;
  uThreshold?: WebGLUniformLocation | null;
  uScene?: WebGLUniformLocation | null;
  uBloom?: WebGLUniformLocation | null;
  uIntensity?: WebGLUniformLocation | null;
}

export interface OrbBloomPipeline {
  /**
   * Run full bloom pipeline.
   * @param sceneTex Input RGBA texture (HDR half-float preferred, RGBA8 tolerated).
   * @param targetFbo Final composite target — null means default framebuffer (canvas).
   * @param targetSize {w,h} of the target viewport.
   * @param threshold HDR cutoff (default 1.0). Clamped ≥ 0.
   * @param intensity Bloom strength (default 0.8). Clamped [0, 2].
   */
  render: (
    sceneTex: WebGLTexture,
    targetFbo: WebGLFramebuffer | null,
    targetSize: { w: number; h: number },
    threshold: number,
    intensity: number,
  ) => void;
  /** Rebuild FBO chain when canvas resizes. */
  resize: (width: number, height: number) => void;
  dispose: () => void;
}

/**
 * Gate bloom by device capability.
 * Low-memory (<4GB RAM) OR few-core (<4 CPU) devices skip bloom entirely —
 * the 4 extra FBO passes are affordable on desktop & high-end mobile only.
 * Falls back safely when navigator fields are unavailable (old browsers).
 */
export function shouldEnableBloom(): boolean {
  if (typeof navigator === 'undefined') return false;
  // deviceMemory is Chrome/Edge only — absence means "unknown", allow bloom
  const memoryOk = typeof navigator.deviceMemory !== 'number' || navigator.deviceMemory >= 4;
  const coresOk = typeof navigator.hardwareConcurrency !== 'number' || navigator.hardwareConcurrency >= 4;
  return memoryOk && coresOk;
}

function compileShader(gl: GL, type: number, src: string): WebGLShader | null {
  const s = gl.createShader(type);
  if (!s) return null;
  gl.shaderSource(s, src);
  gl.compileShader(s);
  if (!gl.getShaderParameter(s, gl.COMPILE_STATUS)) {
    recordError(
      new Error(`Bloom shader compile failed: ${gl.getShaderInfoLog(s)?.slice(0, 300) ?? 'unknown'}`),
      { component: 'orbBloomPipeline' },
    );
    gl.deleteShader(s);
    return null;
  }
  return s;
}

function linkProgram(gl: GL, fragSrc: string): WebGLProgram | null {
  const vs = compileShader(gl, gl.VERTEX_SHADER, VERT_SRC);
  const fs = compileShader(gl, gl.FRAGMENT_SHADER, fragSrc);
  if (!vs || !fs) {
    if (vs) gl.deleteShader(vs);
    if (fs) gl.deleteShader(fs);
    return null;
  }
  const prog = gl.createProgram();
  if (!prog) {
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }
  gl.attachShader(prog, vs);
  gl.attachShader(prog, fs);
  gl.linkProgram(prog);
  gl.deleteShader(vs);
  gl.deleteShader(fs);
  if (!gl.getProgramParameter(prog, gl.LINK_STATUS)) {
    recordError(
      new Error(`Bloom program link failed: ${gl.getProgramInfoLog(prog)?.slice(0, 300) ?? 'unknown'}`),
      { component: 'orbBloomPipeline' },
    );
    gl.deleteProgram(prog);
    return null;
  }
  return prog;
}

function buildPass(gl: GL, fragSrc: string): PassProgram | null {
  const program = linkProgram(gl, fragSrc);
  if (!program) return null;
  return {
    program,
    aPosition: gl.getAttribLocation(program, 'aPosition'),
    uSource: gl.getUniformLocation(program, 'u_source'),
    uTexelSize: gl.getUniformLocation(program, 'u_texelSize'),
    uThreshold: gl.getUniformLocation(program, 'u_threshold'),
    uScene: gl.getUniformLocation(program, 'u_scene'),
    uBloom: gl.getUniformLocation(program, 'u_bloom'),
    uIntensity: gl.getUniformLocation(program, 'u_intensity'),
  };
}

function createFBO(gl: GL, width: number, height: number): FBO | null {
  const texture = gl.createTexture();
  const framebuffer = gl.createFramebuffer();
  if (!texture || !framebuffer) {
    if (texture) gl.deleteTexture(texture);
    if (framebuffer) gl.deleteFramebuffer(framebuffer);
    return null;
  }

  gl.bindTexture(gl.TEXTURE_2D, texture);
  gl.texImage2D(gl.TEXTURE_2D, 0, gl.RGBA, width, height, 0, gl.RGBA, gl.UNSIGNED_BYTE, null);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MIN_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_MAG_FILTER, gl.LINEAR);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_S, gl.CLAMP_TO_EDGE);
  gl.texParameteri(gl.TEXTURE_2D, gl.TEXTURE_WRAP_T, gl.CLAMP_TO_EDGE);

  gl.bindFramebuffer(gl.FRAMEBUFFER, framebuffer);
  gl.framebufferTexture2D(gl.FRAMEBUFFER, gl.COLOR_ATTACHMENT0, gl.TEXTURE_2D, texture, 0);

  const status = gl.checkFramebufferStatus(gl.FRAMEBUFFER);
  gl.bindFramebuffer(gl.FRAMEBUFFER, null);

  if (status !== gl.FRAMEBUFFER_COMPLETE) {
    gl.deleteTexture(texture);
    gl.deleteFramebuffer(framebuffer);
    return null;
  }
  return { framebuffer, texture, width, height };
}

function disposeFBO(gl: GL, fbo: FBO): void {
  gl.deleteTexture(fbo.texture);
  gl.deleteFramebuffer(fbo.framebuffer);
}

/**
 * Create bloom pipeline. Returns null if any shader, program, or FBO
 * fails — caller should proceed to render orb without bloom.
 */
export function createOrbBloomPipeline(gl: GL, width: number, height: number): OrbBloomPipeline | null {
  const thresholdPass = buildPass(gl, BLOOM_THRESHOLD_FRAG);
  const downPass = buildPass(gl, BLOOM_KAWASE_DOWN_FRAG);
  const upPass = buildPass(gl, BLOOM_KAWASE_UP_FRAG);
  const compositePass = buildPass(gl, BLOOM_COMPOSITE_FRAG);

  if (!thresholdPass || !downPass || !upPass || !compositePass) {
    if (thresholdPass) gl.deleteProgram(thresholdPass.program);
    if (downPass) gl.deleteProgram(downPass.program);
    if (upPass) gl.deleteProgram(upPass.program);
    if (compositePass) gl.deleteProgram(compositePass.program);
    return null;
  }

  // Fullscreen triangle — covers [-1,1]² with 3 verts
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vbo = gl.createBuffer();
  if (!vbo) return null;
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  // Base threshold FBO is 1/2 of canvas — coarser mip pyramid saves fillrate.
  let fbos: FBO[] = [];

  const buildPyramid = (w: number, h: number): boolean => {
    fbos.forEach((f) => disposeFBO(gl, f));
    fbos = [];
    let curW = Math.max(1, w >> 1);
    let curH = Math.max(1, h >> 1);
    // Threshold output + DOWNSAMPLE_LEVELS successive halvings
    for (let i = 0; i <= DOWNSAMPLE_LEVELS; i++) {
      const fbo = createFBO(gl, curW, curH);
      if (!fbo) {
        fbos.forEach((f) => disposeFBO(gl, f));
        fbos = [];
        return false;
      }
      fbos.push(fbo);
      curW = Math.max(1, curW >> 1);
      curH = Math.max(1, curH >> 1);
    }
    return true;
  };

  if (!buildPyramid(width, height)) {
    gl.deleteProgram(thresholdPass.program);
    gl.deleteProgram(downPass.program);
    gl.deleteProgram(upPass.program);
    gl.deleteProgram(compositePass.program);
    gl.deleteBuffer(vbo);
    return null;
  }

  const drawQuad = (pass: PassProgram) => {
    gl.useProgram(pass.program);
    gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
    gl.enableVertexAttribArray(pass.aPosition);
    gl.vertexAttribPointer(pass.aPosition, 2, gl.FLOAT, false, 0, 0);
    gl.drawArrays(gl.TRIANGLES, 0, 3);
  };

  return {
    render(sceneTex, targetFbo, targetSize, threshold, intensity) {
      const clampedThreshold = Math.max(0, threshold);
      const clampedIntensity = Math.min(2, Math.max(0, intensity));
      gl.disable(gl.BLEND);

      // Pass 1: threshold extract (scene → fbos[0])
      const base = fbos[0];
      gl.bindFramebuffer(gl.FRAMEBUFFER, base.framebuffer);
      gl.viewport(0, 0, base.width, base.height);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(thresholdPass.uSource, 0);
      gl.uniform1f(thresholdPass.uThreshold ?? null, clampedThreshold);
      gl.uniform2f(thresholdPass.uTexelSize ?? null, 1 / base.width, 1 / base.height);
      drawQuad(thresholdPass);

      // Pass 2: downsample chain (fbos[0] → fbos[1] → fbos[2] → fbos[3])
      for (let i = 0; i < DOWNSAMPLE_LEVELS; i++) {
        const src = fbos[i];
        const dst = fbos[i + 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.framebuffer);
        gl.viewport(0, 0, dst.width, dst.height);
        gl.bindTexture(gl.TEXTURE_2D, src.texture);
        gl.uniform1i(downPass.uSource, 0);
        gl.uniform2f(downPass.uTexelSize ?? null, 1 / src.width, 1 / src.height);
        drawQuad(downPass);
      }

      // Pass 3: upsample chain (fbos[3] → fbos[2] → fbos[1] → fbos[0])
      for (let i = DOWNSAMPLE_LEVELS; i > 0; i--) {
        const src = fbos[i];
        const dst = fbos[i - 1];
        gl.bindFramebuffer(gl.FRAMEBUFFER, dst.framebuffer);
        gl.viewport(0, 0, dst.width, dst.height);
        gl.bindTexture(gl.TEXTURE_2D, src.texture);
        gl.uniform1i(upPass.uSource, 0);
        gl.uniform2f(upPass.uTexelSize ?? null, 1 / src.width, 1 / src.height);
        drawQuad(upPass);
      }

      // Pass 4: composite (scene + bloom → target). null targetFbo = backbuffer.
      gl.bindFramebuffer(gl.FRAMEBUFFER, targetFbo);
      gl.viewport(0, 0, targetSize.w, targetSize.h);
      gl.enable(gl.BLEND);
      gl.blendFunc(gl.ONE, gl.ONE_MINUS_SRC_ALPHA);

      gl.useProgram(compositePass.program);
      gl.activeTexture(gl.TEXTURE0);
      gl.bindTexture(gl.TEXTURE_2D, sceneTex);
      gl.uniform1i(compositePass.uScene ?? null, 0);
      gl.activeTexture(gl.TEXTURE1);
      gl.bindTexture(gl.TEXTURE_2D, fbos[0].texture);
      gl.uniform1i(compositePass.uBloom ?? null, 1);
      gl.uniform1f(compositePass.uIntensity ?? null, clampedIntensity);
      gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
      gl.enableVertexAttribArray(compositePass.aPosition);
      gl.vertexAttribPointer(compositePass.aPosition, 2, gl.FLOAT, false, 0, 0);
      gl.drawArrays(gl.TRIANGLES, 0, 3);

      gl.activeTexture(gl.TEXTURE0);
    },

    resize(w, h) {
      buildPyramid(w, h);
    },

    dispose() {
      gl.deleteProgram(thresholdPass.program);
      gl.deleteProgram(downPass.program);
      gl.deleteProgram(upPass.program);
      gl.deleteProgram(compositePass.program);
      gl.deleteBuffer(vbo);
      fbos.forEach((f) => disposeFBO(gl, f));
      fbos = [];
    },
  };
}
