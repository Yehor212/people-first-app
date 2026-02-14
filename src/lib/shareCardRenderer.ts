/**
 * Share Card Renderer - html2canvas wrapper for DOM-to-image conversion
 * Extracts the common rendering pattern used by all share card generators
 */

import { logger } from '@/lib/logger';

// Lazy load html2canvas (~480KB) only when needed
let html2canvasModule: typeof import('html2canvas').default | null = null;

async function getHtml2Canvas() {
  if (!html2canvasModule) {
    const module = await import('html2canvas');
    html2canvasModule = module.default;
  }
  return html2canvasModule;
}

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
 * Preload html2canvas + DOMPurify in the background
 */
export async function preloadShareCardAssets(): Promise<void> {
  try {
    await Promise.all([getHtml2Canvas(), getDOMPurify()]);
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
  if (!_DOMPurify) return text;
  return _DOMPurify.sanitize(text, { ALLOWED_TAGS: [] });
}

/**
 * Ensure DOMPurify is loaded before sanitizing
 */
export async function ensureSanitizer(): Promise<void> {
  await getDOMPurify();
}

/**
 * Create a styled span element with safe text content
 */
export function createStyledSpan(text: string, style?: string): HTMLSpanElement {
  const span = document.createElement('span');
  span.textContent = sanitizeText(text);
  if (style) span.style.cssText = style;
  return span;
}

/**
 * Render a DOM element to a PNG Blob using html2canvas
 */
export async function renderCardToBlob(
  element: HTMLElement,
  width: number,
  height: number
): Promise<Blob> {
  element.style.position = 'fixed';
  element.style.left = '-9999px';
  element.style.top = '0';
  document.body.appendChild(element);

  try {
    const html2canvas = await getHtml2Canvas();
    const canvas = await html2canvas(element, {
      width,
      height,
      scale: 2,
      backgroundColor: null,
      logging: false,
    });

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
  } finally {
    document.body.removeChild(element);
  }
}
