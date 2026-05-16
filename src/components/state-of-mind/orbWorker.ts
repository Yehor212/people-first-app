/// <reference lib="webworker" />

import FRAG_SRC from './orbShader.frag?raw';

type GLContext = WebGLRenderingContext | WebGL2RenderingContext;

interface KHRParallelShaderCompile {
  COMPLETION_STATUS_KHR: number;
}

type ParticlePayload = {
  x: number;
  y: number;
  radius: number;
  alpha: number;
};

type OrbWorkerPayload = {
  valence: number;
  time: number;
  size: number;
  dpr: number;
  isDark: boolean;
  color: { h: number; s: number; l: number };
  shape: { m: number; n1: number; n2: number; n3: number };
  particles: ParticlePayload[];
  genesis: number;
  touch: { x: number; y: number; age: number };
  shimmer: number;
};

type WorkerMessage =
  | { type: 'init'; canvas: OffscreenCanvas; size: number; dpr: number }
  | { type: 'render'; payload: OrbWorkerPayload; requestId?: string }
  | { type: 'dispose' };

type OrbWorkerRenderer = {
  render: (params: OrbWorkerPayload) => void;
  dispose: () => void;
};

const workerScope = self as DedicatedWorkerGlobalScope;

const GL_OPTIONS: WebGLContextAttributes = {
  alpha: true,
  premultipliedAlpha: true,
  // Fullscreen triangle edges are shader-smoothed; MSAA adds context cost
  // without improving the canonical orb surface.
  antialias: false,
  preserveDrawingBuffer: false,
  depth: false,
  stencil: false,
  desynchronized: true,
  powerPreference: 'default',
};

const VERT_SRC = `
attribute vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const VERT_SRC_300 = `#version 300 es
in vec2 aPosition;
void main() {
  gl_Position = vec4(aPosition, 0.0, 1.0);
}`;

const FRAG_SRC_300 = FRAG_SRC
  .replace(
    '\n#extension GL_OES_standard_derivatives : enable\nprecision highp float;',
    '#version 300 es\nprecision highp float;\nout vec4 fragColor;',
  )
  .replace('gl_FragColor', 'fragColor');

let renderer: OrbWorkerRenderer | null = null;
let pendingRender: Extract<WorkerMessage, { type: 'render' }> | null = null;
let initGeneration = 0;
let disposed = false;

function hslToRgb(h: number, s: number, l: number): [number, number, number] {
  const sn = s / 100;
  const ln = l / 100;
  const c = (1 - Math.abs(2 * ln - 1)) * sn;
  const hSector = h / 60;
  const x = c * (1 - Math.abs((hSector % 2) - 1));
  const m = ln - c / 2;

  let r = 0;
  let g = 0;
  let b = 0;
  if (hSector < 1) {
    r = c;
    g = x;
  } else if (hSector < 2) {
    r = x;
    g = c;
  } else if (hSector < 3) {
    g = c;
    b = x;
  } else if (hSector < 4) {
    g = x;
    b = c;
  } else if (hSector < 5) {
    r = x;
    b = c;
  } else {
    r = c;
    b = x;
  }

  return [r + m, g + m, b + m];
}

function compileShader(gl: GLContext, type: number, source: string): WebGLShader | null {
  const shader = gl.createShader(type);
  if (!shader) return null;

  gl.shaderSource(shader, source);
  gl.compileShader(shader);

  if (!gl.getShaderParameter(shader, gl.COMPILE_STATUS)) {
    gl.deleteShader(shader);
    return null;
  }
  return shader;
}

function createShaderUnchecked(gl: GLContext, type: number, source: string): WebGLShader | null {
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
  timeoutMs = 8000,
): Promise<boolean> {
  const started = performance.now();

  return new Promise((resolve) => {
    const poll = () => {
      if (disposed || gl.isContextLost()) {
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

      workerScope.setTimeout(poll, 16);
    };

    workerScope.setTimeout(poll, 0);
  });
}

function buildRenderer(
  gl: GLContext,
  vertSrc: string,
  fragSrc: string,
): OrbWorkerRenderer | null {
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
    gl.deleteProgram(program);
    gl.deleteShader(vs);
    gl.deleteShader(fs);
    return null;
  }

  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
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

      for (let i = 0; i < 22; i += 1) {
        if (i < particles.length) {
          const p = particles[i];
          particleData[i * 4] = p.x / size;
          particleData[i * 4 + 1] = 1.0 - p.y / size;
          particleData[i * 4 + 2] = p.radius / size;
          particleData[i * 4 + 3] = p.alpha;
        } else {
          particleData[i * 4 + 3] = 0;
        }
      }
      gl.uniform4fv(loc.uParticles, particleData);

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
  };
}

function createRendererFromLinkedProgram(
  gl: GLContext,
  program: WebGLProgram,
  vs: WebGLShader,
  fs: WebGLShader,
): OrbWorkerRenderer | null {
  const vertices = new Float32Array([-1, -1, 3, -1, -1, 3]);
  const vbo = gl.createBuffer();
  gl.bindBuffer(gl.ARRAY_BUFFER, vbo);
  gl.bufferData(gl.ARRAY_BUFFER, vertices, gl.STATIC_DRAW);

  const aPosition = gl.getAttribLocation(program, 'aPosition');
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

      for (let i = 0; i < 22; i += 1) {
        if (i < particles.length) {
          const p = particles[i];
          particleData[i * 4] = p.x / size;
          particleData[i * 4 + 1] = 1.0 - p.y / size;
          particleData[i * 4 + 2] = p.radius / size;
          particleData[i * 4 + 3] = p.alpha;
        } else {
          particleData[i * 4 + 3] = 0;
        }
      }
      gl.uniform4fv(loc.uParticles, particleData);

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
  };
}

async function buildRendererAsync(
  gl: GLContext,
  vertSrc: string,
  fragSrc: string,
): Promise<OrbWorkerRenderer | null> {
  const parallelCompile = gl.getExtension(
    'KHR_parallel_shader_compile',
  ) as KHRParallelShaderCompile | null;

  if (!parallelCompile) {
    return buildRenderer(gl, vertSrc, fragSrc);
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

  const completed = await waitForParallelCompile(gl, program, parallelCompile);
  if (!completed) {
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getShaderParameter(vs, gl.COMPILE_STATUS)) {
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getShaderParameter(fs, gl.COMPILE_STATUS)) {
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  if (!gl.getProgramParameter(program, gl.LINK_STATUS)) {
    cleanupProgram(gl, program, vs, fs);
    return null;
  }

  return createRendererFromLinkedProgram(gl, program, vs, fs);
}

async function createRenderer(canvas: OffscreenCanvas): Promise<OrbWorkerRenderer | null> {
  // Cold-start stability beats API tier here. The canonical fragment shader is
  // authored for WebGL1 and WebGL2 derives from it; trying WebGL1 first avoids
  // Chrome/WebView WebGL2 pipeline stalls without changing the orb visual.
  const gl = canvas.getContext('webgl', GL_OPTIONS);
  if (gl) {
    gl.getExtension('OES_standard_derivatives');
    const glRenderer = await buildRendererAsync(gl, VERT_SRC, FRAG_SRC);
    if (glRenderer) return glRenderer;
  }

  const gl2 = canvas.getContext('webgl2', GL_OPTIONS);
  if (!gl2) return null;
  return await buildRendererAsync(gl2, VERT_SRC_300, FRAG_SRC_300);
}

async function handleWorkerMessage(message: WorkerMessage) {
  if (message.type === 'dispose') {
    disposed = true;
    pendingRender = null;
    renderer?.dispose();
    renderer = null;
    workerScope.close();
    return;
  }

  if (disposed) return;

  if (message.type === 'render') {
    if (!renderer) {
      pendingRender = message;
      return;
    }

    renderer.render(message.payload);
    if (message.requestId) {
      workerScope.postMessage({ type: 'rendered', requestId: message.requestId });
    }
    return;
  }

  if (message.type === 'init') {
    const generation = ++initGeneration;
    disposed = false;
    try {
      const nextRenderer = await createRenderer(message.canvas);
      if (disposed || generation !== initGeneration) {
        nextRenderer?.dispose();
        return;
      }

      if (!nextRenderer) {
        workerScope.postMessage({ type: 'failed', reason: 'WebGL worker renderer unavailable' });
        return;
      }

      renderer = nextRenderer;
      workerScope.postMessage({ type: 'ready' });
      if (pendingRender) {
        const renderMessage = pendingRender;
        pendingRender = null;
        renderer.render(renderMessage.payload);
        if (renderMessage.requestId) {
          workerScope.postMessage({
            type: 'rendered',
            requestId: renderMessage.requestId,
          });
        }
      }
    } catch (error) {
      workerScope.postMessage({
        type: 'failed',
        reason: error instanceof Error ? error.message : String(error),
      });
    }
  }
}

workerScope.onmessage = (event: MessageEvent<WorkerMessage>) => {
  void handleWorkerMessage(event.data);
};
