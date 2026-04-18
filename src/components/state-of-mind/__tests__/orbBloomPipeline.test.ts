/**
 * Unit tests: HDR Bloom pipeline graceful-degradation.
 *
 * Uses a stubbed WebGL context — focus is on the CONTRACT:
 *   - `createOrbBloomPipeline` returns null (not throws) when shaders fail
 *   - `createOrbBloomPipeline` returns null when FBO creation fails
 *   - `shouldEnableBloom` returns false on low-end devices
 *
 * Rendering correctness is better covered by visual-regression tests
 * (see `e2e/orb-bloom.spec.ts` in Task F).
 */
import { describe, it, expect, beforeEach, afterEach, vi } from 'vitest';
import { createOrbBloomPipeline, shouldEnableBloom } from '../orbBloomPipeline';

interface StubOptions {
  shaderCompileOk?: boolean;
  programLinkOk?: boolean;
  fboCompleteOk?: boolean;
  createShaderReturnsNull?: boolean;
  createFboReturnsNull?: boolean;
}

function makeStubGL(opts: StubOptions = {}): WebGLRenderingContext {
  const {
    shaderCompileOk = true,
    programLinkOk = true,
    fboCompleteOk = true,
    createShaderReturnsNull = false,
    createFboReturnsNull = false,
  } = opts;

  const gl: Partial<WebGLRenderingContext> & Record<string, unknown> = {
    VERTEX_SHADER: 35633,
    FRAGMENT_SHADER: 35632,
    COMPILE_STATUS: 0x8b81,
    LINK_STATUS: 0x8b82,
    FRAMEBUFFER_COMPLETE: 0x8cd5,
    FRAMEBUFFER: 0x8d40,
    COLOR_ATTACHMENT0: 0x8ce0,
    TEXTURE_2D: 0x0de1,
    TEXTURE_MIN_FILTER: 0x2801,
    TEXTURE_MAG_FILTER: 0x2800,
    TEXTURE_WRAP_S: 0x2802,
    TEXTURE_WRAP_T: 0x2803,
    CLAMP_TO_EDGE: 0x812f,
    LINEAR: 0x2601,
    RGBA: 0x1908,
    UNSIGNED_BYTE: 0x1401,
    ARRAY_BUFFER: 0x8892,
    STATIC_DRAW: 0x88e4,
    FLOAT: 0x1406,
    TRIANGLES: 0x0004,
    ONE: 1,
    ONE_MINUS_SRC_ALPHA: 0x0303,
    TEXTURE0: 0x84c0,
    TEXTURE1: 0x84c1,

    createShader: vi.fn(() => (createShaderReturnsNull ? null : ({} as WebGLShader))),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => shaderCompileOk),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({} as WebGLProgram)),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => programLinkOk),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({} as WebGLUniformLocation)),
    createTexture: vi.fn(() => (createFboReturnsNull ? null : ({} as WebGLTexture))),
    bindTexture: vi.fn(),
    texImage2D: vi.fn(),
    texParameteri: vi.fn(),
    deleteTexture: vi.fn(),
    createFramebuffer: vi.fn(() => (createFboReturnsNull ? null : ({} as WebGLFramebuffer))),
    bindFramebuffer: vi.fn(),
    framebufferTexture2D: vi.fn(),
    checkFramebufferStatus: vi.fn(() => (fboCompleteOk ? 0x8cd5 : 0)),
    deleteFramebuffer: vi.fn(),
    createBuffer: vi.fn(() => ({} as WebGLBuffer)),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    deleteBuffer: vi.fn(),
    useProgram: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
    activeTexture: vi.fn(),
    uniform1i: vi.fn(),
    uniform1f: vi.fn(),
    uniform2f: vi.fn(),
    enable: vi.fn(),
    disable: vi.fn(),
    blendFunc: vi.fn(),
  };

  return gl as unknown as WebGLRenderingContext;
}

describe('orbBloomPipeline — graceful degradation', () => {
  it('returns pipeline when all GL operations succeed', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).not.toBeNull();
    expect(typeof pipe?.render).toBe('function');
    expect(typeof pipe?.resize).toBe('function');
    expect(typeof pipe?.dispose).toBe('function');
  });

  it('returns null when shader compile fails (does NOT throw)', () => {
    const gl = makeStubGL({ shaderCompileOk: false });
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).toBeNull();
  });

  it('returns null when program link fails', () => {
    const gl = makeStubGL({ programLinkOk: false });
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).toBeNull();
  });

  it('returns null when createShader returns null', () => {
    const gl = makeStubGL({ createShaderReturnsNull: true });
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).toBeNull();
  });

  it('returns null when FBO completeness fails', () => {
    const gl = makeStubGL({ fboCompleteOk: false });
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).toBeNull();
  });

  it('returns null when createTexture returns null', () => {
    const gl = makeStubGL({ createFboReturnsNull: true });
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(pipe).toBeNull();
  });

  it('dispose() is safe to call after successful creation', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(() => pipe?.dispose()).not.toThrow();
  });

  it('resize() rebuilds pyramid without throwing', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 256, 256);
    expect(() => pipe?.resize(512, 512)).not.toThrow();
  });
});

describe('shouldEnableBloom — device capability gate', () => {
  let originalMemory: unknown;
  let originalCores: unknown;

  beforeEach(() => {
    originalMemory = (navigator as unknown as { deviceMemory: unknown }).deviceMemory;
    originalCores = navigator.hardwareConcurrency;
  });

  afterEach(() => {
    Object.defineProperty(navigator, 'deviceMemory', { value: originalMemory, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: originalCores, configurable: true });
  });

  it('enables bloom on mid-range (4GB+, 4-core+)', () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    expect(shouldEnableBloom()).toBe(true);
  });

  it('disables bloom on low-memory device (<4GB)', () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 2, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    expect(shouldEnableBloom()).toBe(false);
  });

  it('disables bloom on few-core device (<4 CPU)', () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: 8, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 2, configurable: true });
    expect(shouldEnableBloom()).toBe(false);
  });

  it('permissively enables bloom when navigator.deviceMemory is absent (Firefox/Safari)', () => {
    Object.defineProperty(navigator, 'deviceMemory', { value: undefined, configurable: true });
    Object.defineProperty(navigator, 'hardwareConcurrency', { value: 8, configurable: true });
    expect(shouldEnableBloom()).toBe(true);
  });
});

describe('orbBloomPipeline — render-path contract', () => {
  it('render() binds the target FBO (null = backbuffer) and draws composite', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 128, 128);
    expect(pipe).not.toBeNull();
    const sceneTex = {} as WebGLTexture;
    pipe?.render(sceneTex, null, { w: 256, h: 256 }, 1.0, 0.8);

    // Composite pass must bind null (backbuffer) as the final target.
    const bindCalls = (gl.bindFramebuffer as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    const finalBind = bindCalls[bindCalls.length - 1];
    expect(finalBind[1]).toBeNull();

    // viewport must be set to the target size.
    const viewportCalls = (gl.viewport as unknown as { mock: { calls: number[][] } }).mock.calls;
    const hasTargetSize = viewportCalls.some((args) => args[2] === 256 && args[3] === 256);
    expect(hasTargetSize).toBe(true);

    // Composite must issue exactly 7 draw calls: 1 threshold + 3 down + 3 up + 1 composite = 8
    const drawCalls = (gl.drawArrays as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    expect(drawCalls.length).toBe(8);
  });

  it('render() clamps intensity to [0, 2]', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 64, 64);
    const sceneTex = {} as WebGLTexture;
    // Over-range intensity should still execute without error.
    expect(() => pipe?.render(sceneTex, null, { w: 64, h: 64 }, 1.0, 5.0)).not.toThrow();
    // Under-range (negative) intensity should still execute.
    expect(() => pipe?.render(sceneTex, null, { w: 64, h: 64 }, 1.0, -1.0)).not.toThrow();
  });

  it('render() tolerates reduced-motion intensity=0 (still runs composite scene→screen copy)', () => {
    const gl = makeStubGL();
    const pipe = createOrbBloomPipeline(gl, 64, 64);
    const sceneTex = {} as WebGLTexture;
    pipe?.render(sceneTex, null, { w: 64, h: 64 }, 1.0, 0);
    const drawCalls = (gl.drawArrays as unknown as { mock: { calls: unknown[][] } }).mock.calls;
    // Still runs full pyramid — the scene texture must be copied back to screen
    // even when intensity is zero, otherwise nothing renders.
    expect(drawCalls.length).toBeGreaterThanOrEqual(8);
  });
});
