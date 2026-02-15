/**
 * Share Card Renderer - Canvas 2D utilities for generating share card images
 * Replaces html2canvas with direct Canvas 2D drawing for instant, reliable rendering
 */

import { logger } from '@/lib/logger';

// Lazy-load DOMPurify (CJS) to avoid TDZ issues in shared chunks
let _DOMPurify: typeof import('dompurify').default | null = null;

async function getDOMPurify() {
  if (!_DOMPurify) {
    const mod = await import('dompurify');
    _DOMPurify = mod.default;
  }
  return _DOMPurify;
}

/**
 * Preload DOMPurify in the background
 */
export async function preloadShareCardAssets(): Promise<void> {
  try {
    await getDOMPurify();
    logger.log('[ShareCardRenderer] Assets preloaded successfully');
  } catch (error) {
    logger.warn('[ShareCardRenderer] Failed to preload:', error);
  }
}

/**
 * Sanitize user input text, stripping all HTML tags
 */
export function sanitizeText(text: string | undefined | null): string {
  if (!text) return '';
  if (!_DOMPurify) return text.replace(/<[^>]*>/g, '');
  return _DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Ensure DOMPurify is loaded before sanitizing
 */
export async function ensureSanitizer(): Promise<void> {
  await getDOMPurify();
}

// ============================================
// CANVAS 2D UTILITIES
// ============================================

/**
 * Create a canvas with the given dimensions and 2x scale for retina
 */
export function createCanvas(
  width: number,
  height: number
): [HTMLCanvasElement, CanvasRenderingContext2D] {
  const canvas = document.createElement('canvas');
  canvas.width = width * 2;
  canvas.height = height * 2;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas 2D context not available');

  ctx.scale(2, 2);
  return [canvas, ctx];
}

/**
 * Parse angle-based linear gradient into canvas gradient
 */
export function drawLinearGradient(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleDeg: number,
  colorStops: [number, string][]
): CanvasGradient {
  const rad = ((angleDeg - 90) * Math.PI) / 180;
  const cx = x + w / 2;
  const cy = y + h / 2;
  // CSS-spec gradient line length for non-square rects
  const len = (Math.abs(w * Math.sin(rad)) + Math.abs(h * Math.cos(rad))) / 2;
  const dx = Math.cos(rad) * len;
  const dy = Math.sin(rad) * len;
  const grad = ctx.createLinearGradient(cx - dx, cy - dy, cx + dx, cy + dy);
  for (const [offset, color] of colorStops) {
    grad.addColorStop(offset, color);
  }
  return grad;
}

/**
 * Fill a rectangle with a linear gradient
 */
export function fillGradientRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  angleDeg: number,
  colorStops: [number, string][]
): void {
  ctx.fillStyle = drawLinearGradient(ctx, x, y, w, h, angleDeg, colorStops);
  ctx.fillRect(x, y, w, h);
}

/**
 * Draw a rounded rectangle (fill + optional stroke)
 */
export function drawRoundedRect(
  ctx: CanvasRenderingContext2D,
  x: number,
  y: number,
  w: number,
  h: number,
  radius: number,
  fillStyle?: string | CanvasGradient,
  strokeStyle?: string,
  lineWidth?: number
): void {
  ctx.beginPath();
  // Polyfill for older Android WebViews (Chrome <112)
  if (ctx.roundRect) {
    ctx.roundRect(x, y, w, h, radius);
  } else {
    const r = Math.min(radius, w / 2, h / 2);
    ctx.moveTo(x + r, y);
    ctx.arcTo(x + w, y, x + w, y + h, r);
    ctx.arcTo(x + w, y + h, x, y + h, r);
    ctx.arcTo(x, y + h, x, y, r);
    ctx.arcTo(x, y, x + w, y, r);
    ctx.closePath();
  }
  if (fillStyle) {
    ctx.fillStyle = fillStyle;
    ctx.fill();
  }
  if (strokeStyle) {
    ctx.strokeStyle = strokeStyle;
    ctx.lineWidth = lineWidth || 1;
    ctx.stroke();
  }
}

interface TextOptions {
  font?: string;
  color?: string;
  align?: CanvasTextAlign;
  baseline?: CanvasTextBaseline;
  maxWidth?: number;
  direction?: CanvasDirection;
  shadow?: { color: string; blur: number; offsetX?: number; offsetY?: number };
  opacity?: number;
}

/**
 * Draw text on canvas with full options
 */
export function drawText(
  ctx: CanvasRenderingContext2D,
  text: string,
  x: number,
  y: number,
  options: TextOptions = {}
): void {
  ctx.save();
  if (options.font) ctx.font = options.font;
  if (options.color) ctx.fillStyle = options.color;
  if (options.align) ctx.textAlign = options.align;
  if (options.baseline) ctx.textBaseline = options.baseline;
  if (options.direction) ctx.direction = options.direction;
  if (options.opacity !== undefined) ctx.globalAlpha = options.opacity;
  if (options.shadow) {
    ctx.shadowColor = options.shadow.color;
    ctx.shadowBlur = options.shadow.blur;
    ctx.shadowOffsetX = options.shadow.offsetX || 0;
    ctx.shadowOffsetY = options.shadow.offsetY || 0;
  }
  if (options.maxWidth) {
    ctx.fillText(text, x, y, options.maxWidth);
  } else {
    ctx.fillText(text, x, y);
  }
  ctx.restore();
}

/**
 * Draw a radial gradient circle overlay (for background patterns)
 */
export function drawRadialOverlay(
  ctx: CanvasRenderingContext2D,
  cx: number,
  cy: number,
  radius: number,
  color: string
): void {
  const grad = ctx.createRadialGradient(cx, cy, 0, cx, cy, radius);
  grad.addColorStop(0, color);
  grad.addColorStop(1, 'transparent');
  ctx.fillStyle = grad;
  ctx.fillRect(cx - radius, cy - radius, radius * 2, radius * 2);
}

/**
 * Convert canvas to PNG Blob
 */
export function canvasToBlob(canvas: HTMLCanvasElement): Promise<Blob> {
  return new Promise((resolve, reject) => {
    canvas.toBlob(
      blob => {
        if (blob) resolve(blob);
        else reject(new Error('Failed to generate image'));
      },
      'image/png',
      1.0
    );
  });
}

/**
 * Measure text width for layout calculations
 */
export function measureText(
  ctx: CanvasRenderingContext2D,
  text: string,
  font: string
): number {
  ctx.save();
  ctx.font = font;
  const w = ctx.measureText(text).width;
  ctx.restore();
  return w;
}
