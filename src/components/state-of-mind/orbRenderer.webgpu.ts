/**
 * ─── Phase 3-B.2 Orb Apotheosis — WebGPU scaffold ───────────────────────────
 *
 * Q3=б: WebGPU primary + WebGL fallback. This module provides:
 *   1. `detectWebGPUSupport()` — fast adapter probe with 2s timeout.
 *   2. `createOrbRendererWebGPU(canvas)` — STUB that returns `null` so ValenceOrb
 *      silently falls through to the proven WebGL2/WebGL1/Canvas2D chain.
 *
 * Full WGSL port of the 620-LOC fragment shader is deferred to Phase 3-B.3 /
 * Task D. Today's job: plumbing. This keeps the detection pipeline ready and
 * avoids the classic "one-shot rewrite that blocks everything" failure mode.
 *
 * Capacitor-iOS + Safari<17 reality: WebGPU availability will be ~0% until
 * iOS 18 rollout completes. WebGL path stays authoritative. No regressions.
 *
 * Law 22 (progressive enhancement): probe highest tier first, degrade silently.
 * Law 5 (loud failure): detection errors are logged to recordError, but NEVER
 * thrown out to the render loop.
 */

import { recordError } from '@/lib/crashReporting';

/**
 * Async WebGPU availability probe.
 *
 * Checks:
 *   1. `navigator.gpu` exists (browser has the API surface).
 *   2. `requestAdapter()` resolves within 2s (hardware present + driver happy).
 *   3. Adapter returns non-null (some browsers expose `navigator.gpu` but fail
 *      at adapter request — e.g. GPU blocklisted, sandboxed in iframe).
 *
 * Never throws. Returns `false` on any failure path.
 */
export async function detectWebGPUSupport(): Promise<boolean> {
  // SSR / non-browser guard
  if (typeof navigator === 'undefined') return false;
  // TS-safe feature detection
  const gpu = (navigator as Navigator & { gpu?: GPU }).gpu;
  if (!gpu) return false;

  try {
    const timeoutPromise = new Promise<null>((resolve) => {
      setTimeout(() => resolve(null), 2000);
    });
    const adapterPromise = gpu.requestAdapter().catch(() => null);
    const adapter = await Promise.race([adapterPromise, timeoutPromise]);
    return adapter !== null && adapter !== undefined;
  } catch (err) {
    recordError(err, { component: 'ValenceOrb', action: 'detectWebGPUSupport' });
    return false;
  }
}

/**
 * Renderer interface parity with OrbGLRenderer so the wrapper can hold either.
 * Duplicated intentionally — avoids a circular import on orbShader.ts.
 */
export interface OrbWebGPURenderer {
  render: (params: unknown) => void;
  dispose: () => void;
  isContextLost: () => boolean;
}

/**
 * Build a WebGPU renderer for the given canvas.
 *
 * STUB: returns `null`. Phase 3-B.3 will implement:
 *   - context = canvas.getContext('webgpu')
 *   - adapter = await navigator.gpu.requestAdapter({ powerPreference: 'low-power' })
 *   - device  = await adapter.requestDevice()
 *   - shaderModule = device.createShaderModule({ code: WGSL_SRC })
 *   - pipeline = device.createRenderPipeline(...)
 *   - uniform buffer, bind group, render pass
 *
 * Until then: return null → ValenceOrb tries createOrbGL2 → createOrbGL → Canvas 2D.
 * Callers MUST treat null as "unsupported" not "error".
 */
export function createOrbRendererWebGPU(canvas: HTMLCanvasElement): OrbWebGPURenderer | null {
  // Early return prevents unused-param lint (scaffold only)
  if (!canvas) return null;
  // NOTE Phase 3-B.3: materialize the WebGPU pipeline. For now, silent fallthrough.
  return null;
}
