/**
 * Unit tests for shareCardRenderer — Canvas 2D utilities
 */
import { describe, it, expect, vi, beforeEach } from 'vitest';
import {
  sanitizeText,
  createCanvas,
  drawLinearGradient,
  fillGradientRect,
  drawRoundedRect,
  drawText,
  drawRadialOverlay,
  canvasToBlob,
  measureText,
} from '../shareCardRenderer';

// ---- helpers to build mock context ----
function makeMockCtx(): CanvasRenderingContext2D {
  return {
    scale: vi.fn(),
    save: vi.fn(),
    restore: vi.fn(),
    beginPath: vi.fn(),
    closePath: vi.fn(),
    moveTo: vi.fn(),
    arcTo: vi.fn(),
    fill: vi.fn(),
    stroke: vi.fn(),
    fillRect: vi.fn(),
    fillText: vi.fn(),
    roundRect: vi.fn(),
    createLinearGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    createRadialGradient: vi.fn(() => ({ addColorStop: vi.fn() })),
    measureText: vi.fn(() => ({ width: 42 })),
    font: '',
    fillStyle: '',
    strokeStyle: '',
    lineWidth: 1,
    textAlign: 'start' as CanvasTextAlign,
    textBaseline: 'alphabetic' as CanvasTextBaseline,
    direction: 'ltr' as CanvasDirection,
    globalAlpha: 1,
    shadowColor: '',
    shadowBlur: 0,
    shadowOffsetX: 0,
    shadowOffsetY: 0,
  } as unknown as CanvasRenderingContext2D;
}

describe('shareCardRenderer', () => {
  // ==========================================
  // sanitizeText
  // ==========================================
  describe('sanitizeText', () => {
    it('returns empty string for null', () => {
      expect(sanitizeText(null)).toBe('');
    });

    it('returns empty string for undefined', () => {
      expect(sanitizeText(undefined)).toBe('');
    });

    it('returns empty string for empty string', () => {
      expect(sanitizeText('')).toBe('');
    });

    it('strips HTML tags via regex fallback when DOMPurify is not loaded', () => {
      expect(sanitizeText('<b>bold</b> text')).toBe('bold text');
    });

    it('strips nested HTML tags', () => {
      expect(sanitizeText('<div><span>hello</span></div>')).toBe('hello');
    });

    it('preserves plain text without tags', () => {
      expect(sanitizeText('no tags here')).toBe('no tags here');
    });
  });

  // ==========================================
  // createCanvas
  // ==========================================
  describe('createCanvas', () => {
    beforeEach(() => {
      // jsdom provides a minimal canvas; patch getContext
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockImplementation(() => makeMockCtx());
    });

    it('creates canvas with 2x retina dimensions', () => {
      const [canvas] = createCanvas(200, 300);
      expect(canvas.width).toBe(400);
      expect(canvas.height).toBe(600);
    });

    it('calls ctx.scale(2, 2) for retina', () => {
      const [, ctx] = createCanvas(100, 100);
      expect(ctx.scale).toHaveBeenCalledWith(2, 2);
    });

    it('throws when context is unavailable', () => {
      vi.spyOn(HTMLCanvasElement.prototype, 'getContext').mockReturnValue(null);
      expect(() => createCanvas(10, 10)).toThrow('Canvas 2D context not available');
    });
  });

  // ==========================================
  // drawLinearGradient
  // ==========================================
  describe('drawLinearGradient', () => {
    it('creates a gradient and adds color stops', () => {
      const addColorStop = vi.fn();
      const ctx = makeMockCtx();
      (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mockReturnValue({ addColorStop });

      const stops: [number, string][] = [
        [0, '#000'],
        [1, '#fff'],
      ];
      drawLinearGradient(ctx, 0, 0, 100, 100, 180, stops);

      expect(ctx.createLinearGradient).toHaveBeenCalledTimes(1);
      expect(addColorStop).toHaveBeenCalledTimes(2);
      expect(addColorStop).toHaveBeenCalledWith(0, '#000');
      expect(addColorStop).toHaveBeenCalledWith(1, '#fff');
    });

    it('returns the created gradient object', () => {
      const gradObj = { addColorStop: vi.fn() };
      const ctx = makeMockCtx();
      (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mockReturnValue(gradObj);
      const result = drawLinearGradient(ctx, 0, 0, 50, 50, 90, []);
      expect(result).toBe(gradObj);
    });
  });

  // ==========================================
  // fillGradientRect
  // ==========================================
  describe('fillGradientRect', () => {
    it('sets fillStyle to gradient and fills rect', () => {
      const gradObj = { addColorStop: vi.fn() };
      const ctx = makeMockCtx();
      (ctx.createLinearGradient as ReturnType<typeof vi.fn>).mockReturnValue(gradObj);

      fillGradientRect(ctx, 10, 20, 100, 200, 45, [[0, 'red']]);

      expect(ctx.fillStyle).toBe(gradObj);
      expect(ctx.fillRect).toHaveBeenCalledWith(10, 20, 100, 200);
    });
  });

  // ==========================================
  // drawRoundedRect
  // ==========================================
  describe('drawRoundedRect', () => {
    it('uses roundRect when available', () => {
      const ctx = makeMockCtx();
      drawRoundedRect(ctx, 0, 0, 100, 50, 8, '#fff');
      expect(ctx.roundRect).toHaveBeenCalledWith(0, 0, 100, 50, 8);
      expect(ctx.fill).toHaveBeenCalled();
    });

    it('falls back to arcTo when roundRect is missing', () => {
      const ctx = makeMockCtx();
      // Remove roundRect to simulate older browser
      (ctx as Partial<CanvasRenderingContext2D>).roundRect = undefined;
      drawRoundedRect(ctx, 0, 0, 100, 50, 8, '#fff');
      expect(ctx.arcTo).toHaveBeenCalled();
      expect(ctx.closePath).toHaveBeenCalled();
    });

    it('applies strokeStyle and lineWidth when provided', () => {
      const ctx = makeMockCtx();
      drawRoundedRect(ctx, 0, 0, 80, 40, 4, undefined, 'blue', 2);
      expect(ctx.strokeStyle).toBe('blue');
      expect(ctx.lineWidth).toBe(2);
      expect(ctx.stroke).toHaveBeenCalled();
    });

    it('does not fill when fillStyle is omitted', () => {
      const ctx = makeMockCtx();
      drawRoundedRect(ctx, 0, 0, 80, 40, 4, undefined, 'blue');
      expect(ctx.fill).not.toHaveBeenCalled();
    });
  });

  // ==========================================
  // drawText
  // ==========================================
  describe('drawText', () => {
    it('saves and restores context', () => {
      const ctx = makeMockCtx();
      drawText(ctx, 'hello', 10, 20);
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });

    it('applies font, color, and align options', () => {
      const ctx = makeMockCtx();
      drawText(ctx, 'hi', 0, 0, { font: '16px sans-serif', color: 'red', align: 'center' });
      expect(ctx.font).toBe('16px sans-serif');
      expect(ctx.fillStyle).toBe('red');
      expect(ctx.textAlign).toBe('center');
    });

    it('uses maxWidth overload of fillText when provided', () => {
      const ctx = makeMockCtx();
      drawText(ctx, 'long text', 0, 0, { maxWidth: 100 });
      expect(ctx.fillText).toHaveBeenCalledWith('long text', 0, 0, 100);
    });

    it('applies shadow options', () => {
      const ctx = makeMockCtx();
      drawText(ctx, 'shadow', 0, 0, {
        shadow: { color: 'rgba(0,0,0,0.5)', blur: 4, offsetX: 1, offsetY: 2 },
      });
      expect(ctx.shadowColor).toBe('rgba(0,0,0,0.5)');
      expect(ctx.shadowBlur).toBe(4);
      expect(ctx.shadowOffsetX).toBe(1);
      expect(ctx.shadowOffsetY).toBe(2);
    });

    it('applies opacity', () => {
      const ctx = makeMockCtx();
      drawText(ctx, 'faded', 0, 0, { opacity: 0.5 });
      expect(ctx.globalAlpha).toBe(0.5);
    });
  });

  // ==========================================
  // drawRadialOverlay
  // ==========================================
  describe('drawRadialOverlay', () => {
    it('creates radial gradient and fills bounding rect', () => {
      const addColorStop = vi.fn();
      const ctx = makeMockCtx();
      (ctx.createRadialGradient as ReturnType<typeof vi.fn>).mockReturnValue({ addColorStop });

      drawRadialOverlay(ctx, 50, 50, 100, 'rgba(255,0,0,0.3)');

      expect(ctx.createRadialGradient).toHaveBeenCalledWith(50, 50, 0, 50, 50, 100);
      expect(addColorStop).toHaveBeenCalledWith(0, 'rgba(255,0,0,0.3)');
      expect(addColorStop).toHaveBeenCalledWith(1, 'transparent');
      expect(ctx.fillRect).toHaveBeenCalledWith(-50, -50, 200, 200);
    });
  });

  // ==========================================
  // canvasToBlob
  // ==========================================
  describe('canvasToBlob', () => {
    it('resolves with blob when toBlob succeeds', async () => {
      const fakeBlob = new Blob(['test'], { type: 'image/png' });
      const canvas = document.createElement('canvas');
      vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => { if (cb) cb(fakeBlob); });

      const result = await canvasToBlob(canvas);
      expect(result).toBe(fakeBlob);
    });

    it('rejects when toBlob returns null', async () => {
      const canvas = document.createElement('canvas');
      vi.spyOn(canvas, 'toBlob').mockImplementation((cb) => { if (cb) cb(null as unknown as Blob); });

      await expect(canvasToBlob(canvas)).rejects.toThrow('Failed to generate image');
    });
  });

  // ==========================================
  // measureText
  // ==========================================
  describe('measureText', () => {
    it('returns width from ctx.measureText', () => {
      const ctx = makeMockCtx();
      (ctx.measureText as ReturnType<typeof vi.fn>).mockReturnValue({ width: 123 });
      const w = measureText(ctx, 'test', '14px Arial');
      expect(w).toBe(123);
      expect(ctx.font).toBe('14px Arial');
    });

    it('saves and restores context', () => {
      const ctx = makeMockCtx();
      measureText(ctx, 'a', '12px mono');
      expect(ctx.save).toHaveBeenCalled();
      expect(ctx.restore).toHaveBeenCalled();
    });
  });
});
