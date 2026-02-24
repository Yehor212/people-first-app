/**
 * useDiaryImages — Image CRUD + 2-layer position tracking.
 *
 * Architecture:
 * - Inert placeholder `<div data-image-id>` lives in contenteditable text flow
 * - Interactive DiaryImageBlock lives in a sibling overlay (pointer-events: none)
 * - Position sync: placeholder getBoundingClientRect → overlay absolute positioning
 * - Recalculation via rAF on: scroll, input, resize (ResizeObserver)
 *
 * Memory-safe: all listeners + observers + rAF cleaned up in useEffect returns.
 */

import { useState, useCallback, useRef, useEffect } from 'react';
import { nanoid } from 'nanoid';
import { logger } from '@/lib/logger';
import { MAX_DIARY_IMAGES } from '../types';

export interface ImageInfo {
  id: string;
  src: string;           // base64 data URL
  naturalWidth: number;
  naturalHeight: number;
  scale: number;
  position: { top: number; left: number; width: number; height: number };
}

export interface DiaryImagesReturn {
  images: ImageInfo[];
  insertImage: (file: File) => Promise<void>;
  removeImage: (id: string) => void;
  updateImageScale: (id: string, scale: number) => void;
  recalculatePositions: () => void;
  handleDrop: (e: React.DragEvent) => void;
  handleDragOver: (e: React.DragEvent) => void;
  fileInputRef: React.RefObject<HTMLInputElement | null>;
}

export function useDiaryImages(
  editorRef: React.RefObject<HTMLDivElement | null>,
  scrollContainerRef: React.RefObject<HTMLDivElement | null>,
  onContentChange: () => void,
): DiaryImagesReturn {
  const [images, setImages] = useState<ImageInfo[]>([]);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const positionRafRef = useRef(0);

  // ── Position recalculation (rAF-batched) ──

  const recalculatePositions = useCallback(() => {
    cancelAnimationFrame(positionRafRef.current);
    positionRafRef.current = requestAnimationFrame(() => {
      const container = scrollContainerRef.current;
      const editor = editorRef.current;
      if (!container || !editor) return;

      const containerRect = container.getBoundingClientRect();

      setImages(prev => {
        let changed = false;
        const next = prev.map(img => {
          const placeholder = editor.querySelector(`[data-image-id="${img.id}"]`);
          if (!placeholder) return img;

          const rect = placeholder.getBoundingClientRect();
          const newPos = {
            top: rect.top - containerRect.top + container.scrollTop,
            left: rect.left - containerRect.left,
            width: rect.width,
            height: rect.height,
          };

          // Only update if position actually changed (avoid re-renders)
          if (
            newPos.top !== img.position.top ||
            newPos.left !== img.position.left ||
            newPos.width !== img.position.width ||
            newPos.height !== img.position.height
          ) {
            changed = true;
            return { ...img, position: newPos };
          }
          return img;
        });
        return changed ? next : prev;
      });
    });
  }, [scrollContainerRef, editorRef]);

  // ── Scroll + resize listeners for position sync ──

  useEffect(() => {
    const container = scrollContainerRef.current;
    if (!container) return;

    const onScroll = () => recalculatePositions();
    container.addEventListener('scroll', onScroll, { passive: true });

    const ro = new ResizeObserver(() => recalculatePositions());
    ro.observe(container);

    return () => {
      container.removeEventListener('scroll', onScroll);
      ro.disconnect();
      cancelAnimationFrame(positionRafRef.current);
    };
  }, [scrollContainerRef, recalculatePositions]);

  // ── Insert image from File ──

  const insertImage = useCallback(async (file: File) => {
    if (images.length >= MAX_DIARY_IMAGES) {
      logger.warn('[DiaryImages] Max images reached');
      return;
    }

    const id = nanoid(10);

    // Read file as data URL
    const dataUrl = await new Promise<string>((resolve, reject) => {
      const reader = new FileReader();
      reader.onload = () => resolve(reader.result as string);
      reader.onerror = () => reject(reader.error);
      reader.readAsDataURL(file);
    });

    // Get natural dimensions
    const dims = await new Promise<{ w: number; h: number }>((resolve) => {
      const img = new Image();
      img.onload = () => resolve({ w: img.naturalWidth, h: img.naturalHeight });
      img.onerror = () => resolve({ w: 300, h: 200 });
      img.src = dataUrl;
    });

    // Insert inert placeholder into contenteditable at cursor
    const editor = editorRef.current;
    if (editor) {
      editor.focus();
      const placeholderHeight = Math.min(300, Math.round(dims.h * (300 / dims.w)));
      const html = `<div data-image-id="${id}" contenteditable="false" class="diary-img-placeholder" style="height:${placeholderHeight}px;"><br></div>`;
      document.execCommand('insertHTML', false, html);
    }

    // Add to state
    setImages(prev => [...prev, {
      id,
      src: dataUrl,
      naturalWidth: dims.w,
      naturalHeight: dims.h,
      scale: 1,
      position: { top: 0, left: 0, width: 0, height: 0 },
    }]);

    onContentChange();
    requestAnimationFrame(() => recalculatePositions());
  }, [images.length, editorRef, onContentChange, recalculatePositions]);

  // ── Remove image ──

  const removeImage = useCallback((id: string) => {
    // Remove placeholder from DOM
    const editor = editorRef.current;
    if (editor) {
      const placeholder = editor.querySelector(`[data-image-id="${id}"]`);
      placeholder?.remove();
      onContentChange();
    }
    setImages(prev => prev.filter(img => img.id !== id));
  }, [editorRef, onContentChange]);

  // ── Update scale ──

  const updateImageScale = useCallback((id: string, scale: number) => {
    const clamped = Math.max(0.5, Math.min(3, scale));
    setImages(prev => prev.map(img =>
      img.id === id ? { ...img, scale: clamped } : img,
    ));
  }, []);

  // ── Drag & drop ──

  const handleDragOver = useCallback((e: React.DragEvent) => {
    if (e.dataTransfer.types.includes('Files')) {
      e.preventDefault();
      e.dataTransfer.dropEffect = 'copy';
    }
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    const files = Array.from(e.dataTransfer.files).filter(f => f.type.startsWith('image/'));
    if (files.length > 0) {
      void insertImage(files[0]);
    }
  }, [insertImage]);

  return {
    images,
    insertImage,
    removeImage,
    updateImageScale,
    recalculatePositions,
    handleDrop,
    handleDragOver,
    fileInputRef,
  };
}
