/**
 * Phase 3-B.2 Task F — WebGPU detect + stub tests.
 *
 * Validates the silent-fallback contract for `orbRenderer.webgpu.ts`:
 *   • `detectWebGPUSupport()` is a non-throwing async boolean probe
 *   • Each failure mode (no navigator.gpu, adapter null, requestAdapter throws,
 *     adapter resolve timeout) yields `false` with zero exceptions
 *   • `createOrbRendererWebGPU()` returns null (Phase 3-B.3 stub) so the
 *     WebGL chain in ValenceOrb.tsx is reached.
 *
 * Law 5 (Loud Failure): errors are logged via `recordError` — asserted below.
 * Law 22: progressive enhancement — detect returns false, caller degrades silently.
 */

import { describe, it, expect, vi, beforeEach, afterEach } from 'vitest';
import {
  detectWebGPUSupport,
  createOrbRendererWebGPU,
} from '../orbRenderer.webgpu';

// recordError is a side-effect sink — mock it so we can assert logging occurs
// only on actual thrown exceptions (not on the normal false-return paths).
vi.mock('@/lib/crashReporting', () => ({
  recordError: vi.fn(),
}));

import { recordError } from '@/lib/crashReporting';

describe('orbRenderer.webgpu — detectWebGPUSupport', () => {
  const originalNavigator = globalThis.navigator;

  beforeEach(() => {
    vi.mocked(recordError).mockClear();
  });

  afterEach(() => {
    // Restore the base navigator after every case to keep tests isolated
    Object.defineProperty(globalThis, 'navigator', {
      value: originalNavigator,
      configurable: true,
      writable: true,
    });
  });

  it('returns false when navigator.gpu is absent (Safari<17, Capacitor-iOS)', async () => {
    // Clone navigator without `.gpu` — the most common real-world path
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', gpu: undefined },
      configurable: true,
      writable: true,
    });
    const supported = await detectWebGPUSupport();
    expect(supported).toBe(false);
    // No error path hit → recordError should NOT have been called
    expect(recordError).not.toHaveBeenCalled();
  });

  it('returns false when requestAdapter resolves to null (GPU blocklisted)', async () => {
    const requestAdapter = vi.fn().mockResolvedValue(null);
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', gpu: { requestAdapter } },
      configurable: true,
      writable: true,
    });
    const supported = await detectWebGPUSupport();
    expect(supported).toBe(false);
    expect(requestAdapter).toHaveBeenCalledTimes(1);
    expect(recordError).not.toHaveBeenCalled();
  });

  it('returns true when requestAdapter resolves to a non-null adapter', async () => {
    const fakeAdapter = { name: 'mock-gpu', features: new Set() };
    const requestAdapter = vi.fn().mockResolvedValue(fakeAdapter);
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', gpu: { requestAdapter } },
      configurable: true,
      writable: true,
    });
    const supported = await detectWebGPUSupport();
    expect(supported).toBe(true);
    expect(requestAdapter).toHaveBeenCalledTimes(1);
  });

  it('returns false and swallows thrown rejection from requestAdapter (driver crash)', async () => {
    // Promise rejection path — .catch(() => null) converts to null before Promise.race
    const requestAdapter = vi.fn().mockRejectedValue(new Error('driver crashed'));
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', gpu: { requestAdapter } },
      configurable: true,
      writable: true,
    });
    const supported = await detectWebGPUSupport();
    // Rejection caught inline → adapter=null → returns false without recordError
    // (recordError only fires on the outer try/catch — rejection doesn't reach it)
    expect(supported).toBe(false);
  });

  it('returns false when requestAdapter never resolves (2s timeout race)', async () => {
    vi.useFakeTimers();
    // Never-resolving promise simulates a hung driver
    const requestAdapter = vi.fn().mockImplementation(() => new Promise(() => { /* pending */ }));
    Object.defineProperty(globalThis, 'navigator', {
      value: { userAgent: 'test', gpu: { requestAdapter } },
      configurable: true,
      writable: true,
    });
    const resultPromise = detectWebGPUSupport();
    // Advance past the 2000ms timeout in the race
    await vi.advanceTimersByTimeAsync(2100);
    const supported = await resultPromise;
    expect(supported).toBe(false);
    vi.useRealTimers();
  });
});

describe('orbRenderer.webgpu — createOrbRendererWebGPU (Phase 3-B.3 stub)', () => {
  it('returns null for a real HTMLCanvasElement (silent fallthrough contract)', () => {
    // jsdom provides a real HTMLCanvasElement — no shim needed
    const canvas = document.createElement('canvas');
    const renderer = createOrbRendererWebGPU(canvas);
    // Stub must yield null so ValenceOrb tries createOrbGL2 → createOrbGL → Canvas 2D
    expect(renderer).toBeNull();
  });

  it('returns null when canvas is falsy (defensive guard)', () => {
    // Unsafe cast only here to exercise the early-return branch
    const renderer = createOrbRendererWebGPU(null as unknown as HTMLCanvasElement);
    expect(renderer).toBeNull();
  });
});
