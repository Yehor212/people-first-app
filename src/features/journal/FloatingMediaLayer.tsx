/**
 * FloatingMediaLayer - gesture-first photos floating on the diary paper.
 *
 * The visible canvas stays chrome-free: the user sees the photo itself, not a
 * control rail. Pointer drag moves the photo, pinch resizes on touch, and
 * keyboard shortcuts keep the same recovery path for non-gesture users.
 */

import {
  useRef,
  useCallback,
  useState,
  useEffect,
  useLayoutEffect,
  memo,
  type Dispatch,
  type SetStateAction,
} from "react";
import { motion, useReducedMotion } from "framer-motion";
import type { JournalPhoto } from "./types";
import { getPhotoById } from "./journalStorage";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";

export interface PhotoLayout {
  x: number; // percentage of paper width (0-100)
  y: number; // percentage of paper height (0-100)
  width: number; // rendered width in px
}

interface FloatingMediaLayerProps {
  entryId: string;
  photoIds: string[];
  layout: Record<string, PhotoLayout>;
  onLayoutChange: Dispatch<SetStateAction<Record<string, PhotoLayout>>>;
  onReturnToGallery: (photoId: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  focusPhotoId?: string | null;
  onPhotoFocusHandled?: (photoId: string) => void;
}

interface ReadOnlyFloatingMediaLayerProps {
  photoIds: string[];
  layout: Record<string, PhotoLayout>;
}

const MIN_FLOATING_PHOTO_WIDTH = 80;
const MAX_FLOATING_PHOTO_WIDTH = 500;
const FLOATING_PHOTO_MIN_POSITION = 5;
const FLOATING_PHOTO_MOVE_STEP = 4;
const FLOATING_PHOTO_LARGE_MOVE_STEP = 10;
const FLOATING_PHOTO_RESIZE_STEP = 24;
const FLOATING_PHOTO_LARGE_RESIZE_STEP = 56;
const FLOATING_PHOTO_LONG_PRESS_MS = 650;
const FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE = 10;
const FLOATING_PHOTO_TAP_SIZE_STEPS = [160, 240, 320] as const;
const FLOATING_PHOTO_RENDERING_CLASS =
  "journal-floating-photo-rendering h-full w-full rounded-xl border border-white/10 object-cover [image-rendering:auto] shadow-lg shadow-black/35";

const clampPhotoWidth = (width: number) =>
  Math.max(MIN_FLOATING_PHOTO_WIDTH, Math.min(MAX_FLOATING_PHOTO_WIDTH, width));

const clampPhotoWidthForContainer = (width: number, containerWidth = 0) => {
  const maxWidth =
    containerWidth > 0
      ? Math.min(MAX_FLOATING_PHOTO_WIDTH, Math.max(MIN_FLOATING_PHOTO_WIDTH, containerWidth - 16))
      : MAX_FLOATING_PHOTO_WIDTH;
  return Math.max(MIN_FLOATING_PHOTO_WIDTH, Math.min(maxWidth, width));
};

const clampPercent = (
  value: number,
  min = FLOATING_PHOTO_MIN_POSITION,
  max = 100 - FLOATING_PHOTO_MIN_POSITION
) => Math.max(min, Math.min(max, value));

const getFloatingPhotoPositionBounds = (
  width: number,
  aspectRatio: number,
  containerWidth = 0,
  containerHeight = 0
) => {
  if (containerWidth <= 0 || containerHeight <= 0) {
    return {
      minX: FLOATING_PHOTO_MIN_POSITION,
      maxX: 100 - FLOATING_PHOTO_MIN_POSITION,
      minY: FLOATING_PHOTO_MIN_POSITION,
      maxY: 100 - FLOATING_PHOTO_MIN_POSITION,
    };
  }

  const height = width / aspectRatio;
  const xPad = Math.max(FLOATING_PHOTO_MIN_POSITION, (width / 2 / containerWidth) * 100);
  const yPad = Math.max(FLOATING_PHOTO_MIN_POSITION, (height / 2 / containerHeight) * 100);
  const minX = xPad >= 50 ? 50 : xPad;
  const minY = yPad >= 50 ? 50 : yPad;

  return {
    minX,
    maxX: xPad >= 50 ? 50 : 100 - xPad,
    minY,
    maxY: yPad >= 50 ? 50 : 100 - yPad,
  };
};

const getDistance = (a: { x: number; y: number }, b: { x: number; y: number }) =>
  Math.hypot(a.x - b.x, a.y - b.y);

const getFirstTwoPointers = (pointers: Map<number, { x: number; y: number }>) =>
  Array.from(pointers.values()).slice(0, 2);

const useElementSize = (ref: React.RefObject<HTMLElement>, observeKey?: unknown) => {
  const [size, setSize] = useState({ width: 0, height: 0 });

  useLayoutEffect(() => {
    const element = ref.current;
    if (!element) return;

    const update = () => {
      const rect = element.getBoundingClientRect();
      setSize({ width: rect.width, height: rect.height });
    };

    update();
    const frame = requestAnimationFrame(update);
    let secondFrame = 0;
    const firstDeferredFrame = requestAnimationFrame(() => {
      secondFrame = requestAnimationFrame(update);
    });
    const delayedUpdate = window.setTimeout(update, 250);

    const cleanupDeferredUpdates = () => {
      cancelAnimationFrame(frame);
      cancelAnimationFrame(firstDeferredFrame);
      if (secondFrame) cancelAnimationFrame(secondFrame);
      window.clearTimeout(delayedUpdate);
    };

    if (typeof ResizeObserver === "undefined") {
      window.addEventListener("resize", update);
      return () => {
        cleanupDeferredUpdates();
        window.removeEventListener("resize", update);
      };
    }

    const observer = new ResizeObserver(update);
    observer.observe(element);
    return () => {
      cleanupDeferredUpdates();
      observer.disconnect();
    };
  }, [ref, observeKey]);

  return size;
};

const FloatingPhoto = memo(function FloatingPhoto({
  photo,
  position,
  onPositionChange,
  onReturn,
  containerRef,
  focusPhotoId,
  onFocusHandled,
}: {
  photo: JournalPhoto;
  position: PhotoLayout;
  onPositionChange: (pos: PhotoLayout) => void;
  onReturn: () => void;
  containerRef: React.RefObject<HTMLDivElement>;
  focusPhotoId?: string | null;
  onFocusHandled?: (photoId: string) => void;
}) {
  const { t } = useLanguage();
  const ts = t;
  const prefersReducedMotion = useReducedMotion();
  const photoRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; width: number } | null>(null);
  const longPressTimerRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const longPressStartRef = useRef<{ x: number; y: number } | null>(null);
  const gestureMovedRef = useRef(false);
  const pendingDragLayoutRef = useRef<PhotoLayout | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const dragStartRef = useRef<{
    pointerId: number;
    pointerType: string;
    clientX: number;
    clientY: number;
    x: number;
    y: number;
  } | null>(null);
  const liveWidthRef = useRef(position.width);
  const [liveWidth, setLiveWidth] = useState(position.width);
  const [isPinching, setIsPinching] = useState(false);
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  const containerSize = useElementSize(containerRef, photo.id);

  const getContainerWidth = useCallback(() => {
    const measuredWidth = containerRef.current?.getBoundingClientRect().width ?? 0;
    return measuredWidth > 0 ? measuredWidth : containerSize.width;
  }, [containerRef, containerSize.width]);

  const getInteractiveWidth = useCallback(
    () => clampPhotoWidthForContainer(liveWidthRef.current, getContainerWidth()),
    [getContainerWidth]
  );

  const clampInteractiveWidth = useCallback(
    (width: number) => clampPhotoWidthForContainer(width, getContainerWidth()),
    [getContainerWidth]
  );

  useEffect(() => {
    const nextWidth = clampPhotoWidth(position.width);
    setLiveWidth(nextWidth);
    liveWidthRef.current = nextWidth;
  }, [position.width]);

  useEffect(() => {
    liveWidthRef.current = liveWidth;
  }, [liveWidth]);

  useEffect(
    () => () => {
      if (longPressTimerRef.current) clearTimeout(longPressTimerRef.current);
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
    },
    []
  );

  useEffect(() => {
    if (focusPhotoId !== photo.id) return;
    const frame = requestAnimationFrame(() => {
      photoRef.current?.focus({ preventScroll: true });
      onFocusHandled?.(photo.id);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusPhotoId, onFocusHandled, photo.id]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current) {
      clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressStartRef.current = null;
  }, []);

  const getPositionBounds = useCallback(
    (width: number) => {
      const container = containerRef.current;
      if (!container) return getFloatingPhotoPositionBounds(width, aspectRatio);

      const rect = container.getBoundingClientRect();
      const displayWidth = clampPhotoWidthForContainer(width, rect.width);
      return getFloatingPhotoPositionBounds(displayWidth, aspectRatio, rect.width, rect.height);
    },
    [aspectRatio, containerRef]
  );

  const clampPosition = useCallback(
    (next: PhotoLayout): PhotoLayout => {
      const width = clampPhotoWidth(next.width);
      const bounds = getPositionBounds(width);
      return {
        x: clampPercent(next.x, bounds.minX, bounds.maxX),
        y: clampPercent(next.y, bounds.minY, bounds.maxY),
        width,
      };
    },
    [getPositionBounds]
  );

  const commitLayout = useCallback(
    (next: PhotoLayout) => {
      const clamped = clampPosition(next);
      setLiveWidth(clamped.width);
      liveWidthRef.current = clamped.width;
      onPositionChange(clamped);
    },
    [clampPosition, onPositionChange]
  );

  const flushScheduledDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const pendingLayout = pendingDragLayoutRef.current;
    pendingDragLayoutRef.current = null;
    if (pendingLayout) commitLayout(pendingLayout);
  }, [commitLayout]);

  const scheduleDragLayout = useCallback(
    (next: PhotoLayout) => {
      pendingDragLayoutRef.current = next;
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pendingLayout = pendingDragLayoutRef.current;
        pendingDragLayoutRef.current = null;
        if (pendingLayout) commitLayout(pendingLayout);
      });
    },
    [commitLayout]
  );

  const commitWidth = useCallback(
    (width: number) => {
      commitLayout({ ...position, width });
    },
    [commitLayout, position]
  );

  const moveTo = useCallback(
    (x: number, y: number) => {
      commitLayout({ x, y, width: liveWidthRef.current });
    },
    [commitLayout]
  );

  const moveBy = useCallback(
    (dx: number, dy: number) => {
      moveTo(position.x + dx, position.y + dy);
    },
    [moveTo, position.x, position.y]
  );

  const cycleTapSize = useCallback(() => {
    const current = getInteractiveWidth();
    const largestVisibleStep = clampInteractiveWidth(MAX_FLOATING_PHOTO_WIDTH);
    const nextWidth =
      FLOATING_PHOTO_TAP_SIZE_STEPS.find(
        (width) => width > current + 8 && width <= largestVisibleStep
      ) ||
      FLOATING_PHOTO_TAP_SIZE_STEPS[0];
    commitWidth(clampInteractiveWidth(nextWidth));
  }, [clampInteractiveWidth, commitWidth, getInteractiveWidth]);

  const handlePhotoClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.detail > 1) return;
      if (gestureMovedRef.current) {
        gestureMovedRef.current = false;
        return;
      }
      cycleTapSize();
    },
    [cycleTapSize]
  );

  const handleMoveKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      const moveStep = e.shiftKey ? FLOATING_PHOTO_LARGE_MOVE_STEP : FLOATING_PHOTO_MOVE_STEP;
      const resizeStep = e.shiftKey ? FLOATING_PHOTO_LARGE_RESIZE_STEP : FLOATING_PHOTO_RESIZE_STEP;
      let dx = 0;
      let dy = 0;
      let nextWidth: number | null = null;
      const currentResizeWidth = getInteractiveWidth();

      if (e.key === "ArrowRight") dx = moveStep;
      if (e.key === "ArrowLeft") dx = -moveStep;
      if (e.key === "ArrowUp") dy = -moveStep;
      if (e.key === "ArrowDown") dy = moveStep;
      if (e.key === "+" || e.key === "=" || e.key === "PageUp")
        nextWidth = currentResizeWidth + resizeStep;
      if (e.key === "-" || e.key === "_" || e.key === "PageDown")
        nextWidth = currentResizeWidth - resizeStep;
      if (e.key === "Home") {
        e.preventDefault();
        e.stopPropagation();
        moveTo(50, 50);
        return;
      }
      if (e.key === "Backspace" || e.key === "Delete") {
        e.preventDefault();
        e.stopPropagation();
        onReturn();
        return;
      }
      if (nextWidth !== null) {
        e.preventDefault();
        e.stopPropagation();
        commitWidth(clampInteractiveWidth(nextWidth));
        return;
      }
      if (dx === 0 && dy === 0) return;

      e.preventDefault();
      e.stopPropagation();
      moveBy(dx, dy);
    },
    [clampInteractiveWidth, commitWidth, getInteractiveWidth, moveBy, moveTo, onReturn]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      gestureMovedRef.current = false;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointersRef.current.size === 1) {
        dragStartRef.current = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          x: position.x,
          y: position.y,
        };
      }
      if (e.pointerType === "touch" && activePointersRef.current.size === 1) {
        longPressStartRef.current = { x: e.clientX, y: e.clientY };
        longPressTimerRef.current = setTimeout(() => {
          longPressTimerRef.current = null;
          longPressStartRef.current = null;
          dragStartRef.current = null;
          onReturn();
        }, FLOATING_PHOTO_LONG_PRESS_MS);
      }
      if (e.pointerType !== "touch") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Pointer capture is best-effort across embedded WebViews.
        }
      }

      const points = getFirstTwoPointers(activePointersRef.current);
      if (points.length === 2) {
        gestureMovedRef.current = true;
        clearLongPressTimer();
        dragStartRef.current = null;
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // Pointer capture is best-effort across embedded WebViews.
        }
        pinchStartRef.current = {
          distance: Math.max(1, getDistance(points[0], points[1])),
          width: getInteractiveWidth(),
        };
        setIsPinching(true);
        e.preventDefault();
        e.stopPropagation();
      }
    },
    [clearLongPressTimer, getInteractiveWidth, onReturn, position.x, position.y]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (!activePointersRef.current.has(e.pointerId)) return;
      const longPressStart = longPressStartRef.current;
      if (
        longPressStart &&
        getDistance(longPressStart, { x: e.clientX, y: e.clientY }) >
          FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE
      ) {
        gestureMovedRef.current = true;
        clearLongPressTimer();
      }
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const points = getFirstTwoPointers(activePointersRef.current);
      const start = pinchStartRef.current;
      if (points.length === 2 && start) {
        e.preventDefault();
        e.stopPropagation();
        const distance = Math.max(1, getDistance(points[0], points[1]));
        const nextWidth = clampInteractiveWidth(start.width * (distance / start.distance));
        liveWidthRef.current = nextWidth;
        setLiveWidth(nextWidth);
        return;
      }

      const dragStart = dragStartRef.current;
      const container = containerRef.current;
      if (!dragStart || dragStart.pointerId !== e.pointerId || !container || isPinching) return;
      const dxPx = e.clientX - dragStart.clientX;
      const dyPx = e.clientY - dragStart.clientY;
      if (Math.hypot(dxPx, dyPx) > FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE) {
        gestureMovedRef.current = true;
      }

      e.preventDefault();
      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      scheduleDragLayout({
        x: dragStart.x + (dxPx / rect.width) * 100,
        y: dragStart.y + (dyPx / rect.height) * 100,
        width: liveWidthRef.current,
      });
    },
    [clampInteractiveWidth, clearLongPressTimer, containerRef, isPinching, scheduleDragLayout]
  );

  const finishPointerGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      clearLongPressTimer();
      flushScheduledDrag();
      activePointersRef.current.delete(e.pointerId);
      if (dragStartRef.current?.pointerId === e.pointerId) dragStartRef.current = null;
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }

      if (isPinching && activePointersRef.current.size < 2) {
        setIsPinching(false);
        pinchStartRef.current = null;
        commitWidth(liveWidthRef.current);
      }
    },
    [clearLongPressTimer, commitWidth, flushScheduledDrag, isPinching]
  );

  const displayWidth = clampPhotoWidthForContainer(liveWidth, containerSize.width);
  const displayHeight = displayWidth / aspectRatio;
  const displayBounds = getFloatingPhotoPositionBounds(
    displayWidth,
    aspectRatio,
    containerSize.width,
    containerSize.height
  );
  const interactionLabel = [
    ts.diaryPhotoMove || "Move photo",
    ts.diaryPhotoResize || "Resize photo",
  ]
    .filter(Boolean)
    .join(". ");
  const interactionInstructions =
    ts.diaryPhotoGestureInstructions ||
    "Drag to move. Tap to change size. Pinch also resizes. Press Home to center. Use arrow keys to move, plus or minus to resize, and Delete to return to the gallery. On touch, press and hold to return the photo to the gallery.";
  const instructionId = `floating-photo-instructions-${photo.id}`;

  return (
    <motion.div
      ref={photoRef}
      onKeyDown={handleMoveKeyDown}
      onPointerDown={handlePointerDown}
      onPointerMove={handlePointerMove}
      onPointerUp={finishPointerGesture}
      onPointerCancel={finishPointerGesture}
      onClick={handlePhotoClick}
      role="group"
      tabIndex={0}
      aria-label={interactionLabel}
      aria-describedby={instructionId}
      data-floating-photo-id={photo.id}
      onContextMenu={(e) => e.preventDefault()}
      className="absolute pointer-events-auto cursor-grab touch-none active:cursor-grabbing gpu-layer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background/70"
      style={{
        left: `${clampPercent(position.x, displayBounds.minX, displayBounds.maxX)}%`,
        top: `${clampPercent(position.y, displayBounds.minY, displayBounds.maxY)}%`,
        width: displayWidth,
        height: displayHeight,
        marginLeft: -(displayWidth / 2),
        marginTop: -(displayHeight / 2),
        touchAction: "none",
      }}
      whileTap={prefersReducedMotion ? undefined : { scale: 0.985 }}
    >
      <span id={instructionId} className="sr-only">
        {interactionInstructions}
      </span>
      <img
        src={photo.data || photo.thumbnail}
        alt=""
        className={`${FLOATING_PHOTO_RENDERING_CLASS} select-none motion-safe:transition-[box-shadow,filter]`}
        draggable={false}
        decoding="async"
      />
    </motion.div>
  );
});

const ReadOnlyFloatingPhoto = memo(function ReadOnlyFloatingPhoto({
  photo,
  position,
  containerSize,
}: {
  photo: JournalPhoto;
  position: PhotoLayout;
  containerSize: { width: number; height: number };
}) {
  const width = clampPhotoWidthForContainer(position.width, containerSize.width);
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  const displayHeight = width / aspectRatio;
  const bounds = getFloatingPhotoPositionBounds(
    width,
    aspectRatio,
    containerSize.width,
    containerSize.height
  );

  return (
    <div
      className="absolute pointer-events-none"
      style={{
        left: `${clampPercent(position.x, bounds.minX, bounds.maxX)}%`,
        top: `${clampPercent(position.y, bounds.minY, bounds.maxY)}%`,
        width,
        height: displayHeight,
        marginLeft: -(width / 2),
        marginTop: -(displayHeight / 2),
      }}
    >
      <img
        src={photo.data || photo.thumbnail}
        alt=""
        className={FLOATING_PHOTO_RENDERING_CLASS}
        draggable={false}
        loading="lazy"
        decoding="async"
      />
    </div>
  );
});

function useFloatingPhotos(photoIds: string[], layout: Record<string, PhotoLayout>) {
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const floatingIdKey = photoIds.filter((id) => layout[id]).join("\u0000");

  useEffect(() => {
    const floatingIds = floatingIdKey ? floatingIdKey.split("\u0000") : [];
    if (floatingIds.length === 0) {
      setPhotos([]);
      return;
    }
    let cancelled = false;
    Promise.all(floatingIds.map((photoId) => getPhotoById(photoId)))
      .then((items) => {
        if (cancelled) return;
        setPhotos(items.filter((photo): photo is JournalPhoto => Boolean(photo)));
      })
      .catch((err) => {
        if (cancelled) return;
        logger.warn("[FloatingMediaLayer] Failed to load photos:", err);
        setPhotos([]);
      });
    return () => {
      cancelled = true;
    };
  }, [floatingIdKey]);

  return photos;
}

export const FloatingMediaLayer = memo(function FloatingMediaLayer({
  photoIds,
  layout,
  onLayoutChange,
  onReturnToGallery,
  containerRef,
  focusPhotoId,
  onPhotoFocusHandled,
}: FloatingMediaLayerProps) {
  const photos = useFloatingPhotos(photoIds, layout);

  if (photos.length === 0) return null;

  return (
    <div className="absolute inset-0 z-20 pointer-events-none overflow-hidden">
      {photos.map((photo) => {
        const pos = layout[photo.id];
        if (!pos) return null;
        return (
          <FloatingPhoto
            key={photo.id}
            photo={photo}
            position={pos}
            onPositionChange={(newPos) => {
              onLayoutChange((current) => ({ ...current, [photo.id]: newPos }));
            }}
            onReturn={() => onReturnToGallery(photo.id)}
            containerRef={containerRef}
            focusPhotoId={focusPhotoId}
            onFocusHandled={onPhotoFocusHandled}
          />
        );
      })}
    </div>
  );
});

export const ReadOnlyFloatingMediaLayer = memo(function ReadOnlyFloatingMediaLayer({
  photoIds,
  layout,
}: ReadOnlyFloatingMediaLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const photos = useFloatingPhotos(photoIds, layout);
  const containerSize = useElementSize(layerRef, photos.length);

  if (photos.length === 0) return null;

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      data-testid="readonly-floating-media-layer"
    >
      {photos.map((photo) => {
        const pos = layout[photo.id];
        if (!pos) return null;
        return (
          <ReadOnlyFloatingPhoto
            key={photo.id}
            photo={photo}
            position={pos}
            containerSize={containerSize}
          />
        );
      })}
    </div>
  );
});
