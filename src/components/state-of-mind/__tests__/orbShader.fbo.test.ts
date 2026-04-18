/**
 * Integration test: `OrbGLRenderer.render()` new `targetFramebuffer` param
 * (Phase 3-B.2 Apotheosis Task B wiring).
 *
 * Verifies the contract between bloom pipeline and the main orb renderer:
 *   - null/undefined target → render to backbuffer (legacy behavior preserved)
 *   - explicit FBO target → render to that FBO so bloom can sample it
 *   - WebGL1 and WebGL2 paths both expose `.gl` (shared-context requirement)
 *
 * Mocks WebGL at the getContext level — enough surface to let `buildRenderer`
 * succeed without a real GPU.
 */
import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import { createOrbGL, createOrbGL2 } from '../orbShader';

/** Build a mock GL context that satisfies buildRenderer's API surface. */
function makeMockGL() {
  const noop = () => undefined;
  const gl: Record<string, unknown> = {
    // enums
    VERTEX_SHADER: 0,
    FRAGMENT_SHADER: 1,
    COMPILE_STATUS: 2,
    LINK_STATUS: 3,
    ARRAY_BUFFER: 4,
    STATIC_DRAW: 5,
    FLOAT: 6,
    TRIANGLES: 7,
    BLEND: 8,
    ONE: 9,
    ONE_MINUS_SRC_ALPHA: 10,
    FRAMEBUFFER: 11,
    COLOR_BUFFER_BIT: 12,
    // methods
    createShader: vi.fn(() => ({})),
    shaderSource: vi.fn(),
    compileShader: vi.fn(),
    getShaderParameter: vi.fn(() => true),
    getShaderInfoLog: vi.fn(() => ''),
    deleteShader: vi.fn(),
    createProgram: vi.fn(() => ({})),
    attachShader: vi.fn(),
    linkProgram: vi.fn(),
    getProgramParameter: vi.fn(() => true),
    getProgramInfoLog: vi.fn(() => ''),
    deleteProgram: vi.fn(),
    useProgram: vi.fn(),
    getAttribLocation: vi.fn(() => 0),
    getUniformLocation: vi.fn(() => ({})),
    createBuffer: vi.fn(() => ({})),
    bindBuffer: vi.fn(),
    bufferData: vi.fn(),
    enableVertexAttribArray: vi.fn(),
    vertexAttribPointer: vi.fn(),
    deleteBuffer: vi.fn(),
    drawArrays: vi.fn(),
    viewport: vi.fn(),
    clearColor: vi.fn(),
    clear: vi.fn(),
    enable: vi.fn(),
    blendFunc: vi.fn(),
    bindFramebuffer: vi.fn(),
    uniform1f: vi.fn(),
    uniform1i: vi.fn(),
    uniform2f: vi.fn(),
    uniform3f: vi.fn(),
    uniform4fv: vi.fn(),
    getExtension: vi.fn(() => ({ loseContext: noop })),
    isContextLost: vi.fn(() => false),
  };
  return gl;
}

let originalGetContext: typeof HTMLCanvasElement.prototype.getContext;

beforeEach(() => {
  originalGetContext = HTMLCanvasElement.prototype.getContext;
});
afterEach(() => {
  HTMLCanvasElement.prototype.getContext = originalGetContext;
});

describe('orbShader — targetFramebuffer contract (Task B wiring)', () => {
  it('WebGL1 renderer exposes .gl and binds null FBO when target unset', () => {
    const mockGL = makeMockGL();
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === 'webgl') return mockGL as unknown as WebGLRenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const canvas = document.createElement('canvas');
    const r = createOrbGL(canvas);
    expect(r).not.toBeNull();
    expect(r!.gl).toBe(mockGL);

    r!.render({
      valence: 0, time: 0, size: 192, dpr: 1,
      isDark: false, color: { h: 180, s: 50, l: 50 },
      shape: { m: 6, n1: 1, n2: 1, n3: 1 },
      particles: [], genesis: 1, touch: { x: 0, y: 0, age: 0 }, shimmer: 0,
    });

    // Default (no target) → bindFramebuffer called with null.
    const bindCalls = mockGL.bindFramebuffer.mock.calls;
    expect(bindCalls[0][1]).toBeNull();
  });

  it('binds the supplied targetFramebuffer when provided (bloom scene FBO)', () => {
    const mockGL = makeMockGL();
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === 'webgl') return mockGL as unknown as WebGLRenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const canvas = document.createElement('canvas');
    const r = createOrbGL(canvas);
    const fakeFbo = {} as WebGLFramebuffer;

    r!.render({
      valence: 0, time: 0, size: 192, dpr: 1,
      isDark: false, color: { h: 180, s: 50, l: 50 },
      shape: { m: 6, n1: 1, n2: 1, n3: 1 },
      particles: [], genesis: 1, touch: { x: 0, y: 0, age: 0 }, shimmer: 0,
      targetFramebuffer: fakeFbo,
      targetWidth: 384,
      targetHeight: 384,
    });

    const bindCalls = mockGL.bindFramebuffer.mock.calls;
    expect(bindCalls[0][1]).toBe(fakeFbo);

    // Viewport must use provided targetWidth/Height, not size*dpr default.
    const viewportCalls = mockGL.viewport.mock.calls;
    expect(viewportCalls[0]).toEqual([0, 0, 384, 384]);
  });

  it('WebGL2 renderer also exposes .gl (shared-context requirement)', () => {
    const mockGL = makeMockGL();
    HTMLCanvasElement.prototype.getContext = vi.fn((type: string) => {
      if (type === 'webgl2') return mockGL as unknown as WebGL2RenderingContext;
      return null;
    }) as unknown as typeof HTMLCanvasElement.prototype.getContext;

    const canvas = document.createElement('canvas');
    const r = createOrbGL2(canvas);
    expect(r).not.toBeNull();
    expect(r!.gl).toBe(mockGL);
  });
});
