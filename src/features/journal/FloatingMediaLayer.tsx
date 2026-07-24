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
import * as RadixContextMenu from "@radix-ui/react-context-menu";
import type { JournalPhoto } from "./types";
import { getPhotoById } from "./journalStorage";
import {
  MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH,
  normalizeJournalPhotoDescription,
} from "./photoLayout";
import { logger } from "@/lib/logger";
import { useLanguage } from "@/contexts/LanguageContext";
import { useBackHandler } from "@/hooks/useBackHandler";
import { formatLocalizedNumber } from "@/lib/timeUtils";
import { interpolate } from "@/lib/utils";
import type { Language } from "@/i18n/translations";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

export interface PhotoLayout {
  x: number; // percentage of paper width (0-100)
  y: number; // percentage of paper height (0-100)
  width: number; // rendered width in px
  description?: string; // optional user-authored screen-reader text
}

interface FloatingMediaLayerProps {
  entryId: string;
  photoIds: string[];
  layout: Record<string, PhotoLayout>;
  onLayoutChange: Dispatch<SetStateAction<Record<string, PhotoLayout>>>;
  onLayoutCommit?: () => void;
  onReturnToGallery: (photoId: string) => void;
  containerRef: React.RefObject<HTMLDivElement>;
  focusPhotoId?: string | null;
  onPhotoFocusHandled?: (photoId: string) => void;
}

interface ReadOnlyFloatingMediaLayerProps {
  entryId: string;
  photoIds: string[];
  layout: Record<string, PhotoLayout>;
}

const MIN_FLOATING_PHOTO_WIDTH = 120;
const MAX_FLOATING_PHOTO_WIDTH = 500;
const FLOATING_PHOTO_MIN_POSITION = 5;
const FLOATING_PHOTO_MOVE_STEP = 4;
const FLOATING_PHOTO_LARGE_MOVE_STEP = 10;
const FLOATING_PHOTO_RESIZE_STEP = 24;
const FLOATING_PHOTO_LARGE_RESIZE_STEP = 56;
const FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE = 10;
const FLOATING_PHOTO_LONG_PRESS_MS = 650;
const FLOATING_PHOTO_RENDERING_CLASS =
  "journal-floating-photo-rendering rounded-xl border border-white/10 object-cover [image-rendering:auto] shadow-lg shadow-black/35";

const clonePointerEvent = (event: PointerEvent) => {
  const init: PointerEventInit = {
    bubbles: true,
    cancelable: true,
    composed: true,
    pointerId: event.pointerId,
    pointerType: event.pointerType,
    isPrimary: event.isPrimary,
    clientX: event.clientX,
    clientY: event.clientY,
    button: event.button,
    buttons: event.buttons,
    pressure: event.pressure,
    width: event.width,
    height: event.height,
    ctrlKey: event.ctrlKey,
    shiftKey: event.shiftKey,
    altKey: event.altKey,
    metaKey: event.metaKey,
  };
  if (typeof PointerEvent === "function") return new PointerEvent(event.type, init);

  const fallback = new MouseEvent(event.type, init);
  Object.defineProperties(fallback, {
    pointerId: { value: event.pointerId },
    pointerType: { value: event.pointerType },
    isPrimary: { value: event.isPrimary },
    pressure: { value: event.pressure },
    width: { value: event.width },
    height: { value: event.height },
  });
  return fallback;
};

const isolateDirectionalToken = (value: string, language: Language) =>
  language === "ar" || language === "he" ? `\u2066${value}\u2069` : value;

const isolateDirectionalText = (value: string, language: Language) =>
  language === "ar" || language === "he" ? `\u2068${value}\u2069` : value;

const getSafeDevicePixelRatio = () => {
  if (typeof window === "undefined") return 1;
  const ratio = window.devicePixelRatio;
  return Number.isFinite(ratio) && ratio > 0 ? Math.max(1, ratio) : 1;
};

const clampPhotoWidthForDensity = (width: number, sourcePixelWidth = 0) => {
  const densityMaxWidth =
    sourcePixelWidth > 0
      ? Math.max(1, Math.floor(sourcePixelWidth / getSafeDevicePixelRatio()))
      : MAX_FLOATING_PHOTO_WIDTH;
  const maxWidth = Math.min(MAX_FLOATING_PHOTO_WIDTH, densityMaxWidth);
  const minWidth = Math.min(MIN_FLOATING_PHOTO_WIDTH, maxWidth);
  return Math.max(minWidth, Math.min(maxWidth, width));
};

const clampPhotoWidthForContainer = (
  width: number,
  containerWidth = 0,
  sourcePixelWidth = 0,
) => {
  const containerMaxWidth =
    containerWidth > 0
      ? Math.min(MAX_FLOATING_PHOTO_WIDTH, Math.max(MIN_FLOATING_PHOTO_WIDTH, containerWidth - 16))
      : MAX_FLOATING_PHOTO_WIDTH;
  const densityMaxWidth = clampPhotoWidthForDensity(
    MAX_FLOATING_PHOTO_WIDTH,
    sourcePixelWidth,
  );
  const maxWidth = Math.min(containerMaxWidth, densityMaxWidth);
  const minWidth = Math.min(MIN_FLOATING_PHOTO_WIDTH, maxWidth);
  return Math.max(minWidth, Math.min(maxWidth, width));
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
  onInteractionCommit,
  onReturn,
  onDecodeError,
  onBeginTapPlacement,
  onCancelTapPlacement,
  isTapPlacementActive,
  containerRef,
  focusPhotoId,
  onFocusHandled,
  photoNumber,
  photoTotal,
}: {
  photo: JournalPhoto;
  position: PhotoLayout;
  onPositionChange: (pos: PhotoLayout) => void;
  onInteractionCommit?: () => void;
  onReturn: () => void;
  onDecodeError: (photoId: string) => void;
  onBeginTapPlacement: () => void;
  onCancelTapPlacement: () => void;
  isTapPlacementActive: boolean;
  containerRef: React.RefObject<HTMLDivElement>;
  focusPhotoId?: string | null;
  onFocusHandled?: (photoId: string) => void;
  photoNumber: number;
  photoTotal: number;
}) {
  const { t, language } = useLanguage();
  const ts = t;
  const photoRef = useRef<HTMLDivElement>(null);
  const activePointersRef = useRef(new Map<number, { x: number; y: number }>());
  const pinchStartRef = useRef<{ distance: number; width: number } | null>(null);
  const gestureMovedRef = useRef(false);
  const pendingDragLayoutRef = useRef<PhotoLayout | null>(null);
  const pendingDragInteractionRef = useRef<"dragging" | "resizing">("dragging");
  const previewLayoutRef = useRef<PhotoLayout | null>(null);
  const gestureStartLayoutRef = useRef<PhotoLayout | null>(null);
  const dragFrameRef = useRef<number | null>(null);
  const longPressTimerRef = useRef<number | null>(null);
  const longPressOriginRef = useRef<{ x: number; y: number } | null>(null);
  const pointerFallbackCleanupsRef = useRef(new Map<number, () => void>());
  const forwardedPointerEventsRef = useRef(new WeakSet<Event>());
  const terminalPointerHandlerRef = useRef<
    (pointerId: number, type: "pointerup" | "pointercancel") => void
  >(() => undefined);
  const latestCommittedLayoutRef = useRef(position);
  const resizeStartRef = useRef<{
    pointerId: number;
    clientX: number;
    clientY: number;
    width: number;
    x: number;
    y: number;
    inlineDirection: 1 | -1;
  } | null>(null);
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
  const [contextMenuOpen, setContextMenuOpen] = useState(false);
  const [contextMenuGeneration, setContextMenuGeneration] = useState(0);
  const [descriptionDialogOpen, setDescriptionDialogOpen] = useState(false);
  const [resizeDialogOpen, setResizeDialogOpen] = useState(false);
  const [isPointerResizing, setIsPointerResizing] = useState(false);
  const [descriptionDraft, setDescriptionDraft] = useState(position.description ?? "");
  const [interactionStatus, setInteractionStatus] = useState("");
  const wasTapPlacementActiveRef = useRef(false);
  const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
  const containerSize = useElementSize(containerRef, photo.id);
  const localizedPhotoNumber = isolateDirectionalToken(
    formatLocalizedNumber(photoNumber, language),
    language
  );
  const localizedPhotoTotal = isolateDirectionalToken(
    formatLocalizedNumber(photoTotal, language),
    language
  );
  const restorePhotoFocus = useCallback(() => {
    requestAnimationFrame(() => photoRef.current?.focus({ preventScroll: true }));
  }, []);
  const closeContextMenu = useCallback(() => {
    setContextMenuOpen(false);
    setContextMenuGeneration((generation) => generation + 1);
    restorePhotoFocus();
  }, [restorePhotoFocus]);
  const closeDescriptionDialog = useCallback(() => setDescriptionDialogOpen(false), []);
  const closeResizeDialog = useCallback(() => setResizeDialogOpen(false), []);

  useBackHandler(contextMenuOpen, closeContextMenu);
  useBackHandler(descriptionDialogOpen, closeDescriptionDialog);
  useBackHandler(resizeDialogOpen, closeResizeDialog);

  const getContainerWidth = useCallback(() => {
    const measuredWidth = containerRef.current?.getBoundingClientRect().width ?? 0;
    return measuredWidth > 0 ? measuredWidth : containerSize.width;
  }, [containerRef, containerSize.width]);

  const getInteractiveWidth = useCallback(
    () => clampPhotoWidthForContainer(liveWidthRef.current, getContainerWidth(), photo.width),
    [getContainerWidth, photo.width]
  );

  const clampInteractiveWidth = useCallback(
    (width: number) => clampPhotoWidthForContainer(width, getContainerWidth(), photo.width),
    [getContainerWidth, photo.width]
  );

  useEffect(() => {
    const nextWidth = clampPhotoWidthForDensity(position.width, photo.width);
    setLiveWidth(nextWidth);
    liveWidthRef.current = nextWidth;
    latestCommittedLayoutRef.current = { ...position, width: nextWidth };
    if (!descriptionDialogOpen) setDescriptionDraft(position.description ?? "");
  }, [descriptionDialogOpen, photo.width, position]);

  useEffect(() => {
    liveWidthRef.current = liveWidth;
  }, [liveWidth]);

  const clearLongPressTimer = useCallback(() => {
    if (longPressTimerRef.current !== null) {
      window.clearTimeout(longPressTimerRef.current);
      longPressTimerRef.current = null;
    }
    longPressOriginRef.current = null;
  }, []);

  const clearPointerFallback = useCallback((pointerId: number) => {
    pointerFallbackCleanupsRef.current.get(pointerId)?.();
  }, []);

  const clearAllPointerFallbacks = useCallback(() => {
    for (const cleanup of [...pointerFallbackCleanupsRef.current.values()]) cleanup();
  }, []);

  useEffect(
    () => () => {
      if (dragFrameRef.current !== null) cancelAnimationFrame(dragFrameRef.current);
      clearLongPressTimer();
      clearAllPointerFallbacks();
    },
    [clearAllPointerFallbacks, clearLongPressTimer]
  );

  useEffect(() => {
    if (wasTapPlacementActiveRef.current && !isTapPlacementActive) {
      photoRef.current?.focus({ preventScroll: true });
    }
    wasTapPlacementActiveRef.current = isTapPlacementActive;
  }, [isTapPlacementActive]);

  useEffect(() => {
    if (focusPhotoId !== photo.id) return;
    const frame = requestAnimationFrame(() => {
      photoRef.current?.focus({ preventScroll: true });
      onFocusHandled?.(photo.id);
    });
    return () => cancelAnimationFrame(frame);
  }, [focusPhotoId, onFocusHandled, photo.id]);

  const getPositionBounds = useCallback(
    (width: number) => {
      const container = containerRef.current;
      if (!container) return getFloatingPhotoPositionBounds(width, aspectRatio);

      const rect = container.getBoundingClientRect();
      const displayWidth = clampPhotoWidthForContainer(width, rect.width, photo.width);
      const interactiveHeight = Math.max(48, displayWidth / aspectRatio);
      return getFloatingPhotoPositionBounds(
        displayWidth,
        displayWidth / interactiveHeight,
        rect.width,
        rect.height
      );
    },
    [aspectRatio, containerRef, photo.width]
  );

  const clampPosition = useCallback(
    (next: PhotoLayout): PhotoLayout => {
      const width = clampPhotoWidthForDensity(next.width, photo.width);
      const bounds = getPositionBounds(width);
      return {
        x: clampPercent(next.x, bounds.minX, bounds.maxX),
        y: clampPercent(next.y, bounds.minY, bounds.maxY),
        width,
        ...(normalizeJournalPhotoDescription(next.description)
          ? { description: normalizeJournalPhotoDescription(next.description) }
          : {}),
      };
    },
    [getPositionBounds, photo.width]
  );

  const describeLayout = useCallback(
    (next: PhotoLayout) => {
      const x = isolateDirectionalToken(
        `${formatLocalizedNumber(Math.round(next.x), language)}%`,
        language
      );
      const y = isolateDirectionalToken(
        `${formatLocalizedNumber(Math.round(next.y), language)}%`,
        language
      );
      const width = isolateDirectionalToken(
        `${formatLocalizedNumber(Math.round(next.width), language)} px`,
        language
      );
      return interpolate(
        ts.diaryPhotoLayoutStatus ||
          "Photo {current} of {total}. Position {x}, {y}. Width {width}.",
        {
          current: localizedPhotoNumber,
          total: localizedPhotoTotal,
          x,
          y,
          width,
        }
      );
    },
    [language, localizedPhotoNumber, localizedPhotoTotal, ts.diaryPhotoLayoutStatus]
  );

  const clearPreviewTransform = useCallback(() => {
    previewLayoutRef.current = null;
    const target = photoRef.current;
    if (!target) return;
    target.style.transform = "";
    target.style.transformOrigin = "";
    delete target.dataset.photoInteraction;
  }, []);

  const previewLayout = useCallback(
    (next: PhotoLayout, interaction: "dragging" | "resizing" = "dragging") => {
      const start = gestureStartLayoutRef.current ?? latestCommittedLayoutRef.current;
      const clamped = clampPosition({ ...start, ...next });
      const target = photoRef.current;
      const container = containerRef.current;
      if (!target || !container) return;

      const containerRect = container.getBoundingClientRect();
      if (containerRect.width <= 0 || containerRect.height <= 0) return;
      const startWidth = clampPhotoWidthForContainer(
        start.width,
        containerRect.width,
        photo.width,
      );
      const nextWidth = clampPhotoWidthForContainer(
        clamped.width,
        containerRect.width,
        photo.width,
      );
      const translateX = ((clamped.x - start.x) / 100) * containerRect.width;
      const translateY = ((clamped.y - start.y) / 100) * containerRect.height;
      const scale = startWidth > 0 ? nextWidth / startWidth : 1;

      if (!previewLayoutRef.current) {
        target.dataset.photoInteraction = interaction;
        target.style.transformOrigin = "center";
      }
      previewLayoutRef.current = clamped;
      liveWidthRef.current = clamped.width;
      target.style.transform = `translate3d(${translateX}px, ${translateY}px, 0) scale(${scale})`;
    },
    [clampPosition, containerRef, photo.width]
  );

  const commitPreviewLayout = useCallback(
    (announce = false) => {
      const preview = previewLayoutRef.current;
      if (!preview) return;
      latestCommittedLayoutRef.current = preview;
      liveWidthRef.current = preview.width;
      setLiveWidth(preview.width);
      onPositionChange(preview);
      onInteractionCommit?.();
      if (announce) setInteractionStatus(describeLayout(preview));
    },
    [describeLayout, onInteractionCommit, onPositionChange]
  );

  useLayoutEffect(() => {
    const preview = previewLayoutRef.current;
    if (!preview) return;
    const positionCaughtUp =
      Math.abs(position.x - preview.x) < 0.001 &&
      Math.abs(position.y - preview.y) < 0.001 &&
      Math.abs(position.width - preview.width) < 0.001;
    if (positionCaughtUp) clearPreviewTransform();
  }, [clearPreviewTransform, position]);

  const commitLayout = useCallback(
    (next: PhotoLayout, announce = false) => {
      const clamped = clampPosition({ ...latestCommittedLayoutRef.current, ...next });
      clearPreviewTransform();
      setLiveWidth(clamped.width);
      liveWidthRef.current = clamped.width;
      latestCommittedLayoutRef.current = clamped;
      onPositionChange(clamped);
      onInteractionCommit?.();
      if (announce) setInteractionStatus(describeLayout(clamped));
    },
    [clampPosition, clearPreviewTransform, describeLayout, onInteractionCommit, onPositionChange]
  );

  const saveDescription = useCallback(() => {
    const description = normalizeJournalPhotoDescription(descriptionDraft);
    commitLayout({
      ...latestCommittedLayoutRef.current,
      description,
    });
    setDescriptionDialogOpen(false);
  }, [commitLayout, descriptionDraft]);

  const flushScheduledDrag = useCallback(() => {
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    const pendingLayout = pendingDragLayoutRef.current;
    pendingDragLayoutRef.current = null;
    if (pendingLayout) previewLayout(pendingLayout, pendingDragInteractionRef.current);
  }, [previewLayout]);

  const scheduleDragLayout = useCallback(
    (next: PhotoLayout, interaction: "dragging" | "resizing" = "dragging") => {
      pendingDragLayoutRef.current = next;
      pendingDragInteractionRef.current = interaction;
      if (dragFrameRef.current !== null) return;
      dragFrameRef.current = requestAnimationFrame(() => {
        dragFrameRef.current = null;
        const pendingLayout = pendingDragLayoutRef.current;
        pendingDragLayoutRef.current = null;
        if (pendingLayout) previewLayout(pendingLayout, pendingDragInteractionRef.current);
      });
    },
    [previewLayout]
  );

  const commitWidth = useCallback(
    (width: number, announce = false) => {
      commitLayout({ ...latestCommittedLayoutRef.current, width }, announce);
    },
    [commitLayout]
  );

  const moveTo = useCallback(
    (x: number, y: number, announce = false) => {
      commitLayout({ x, y, width: liveWidthRef.current }, announce);
    },
    [commitLayout]
  );

  const moveBy = useCallback(
    (dx: number, dy: number, announce = false) => {
      const rendered = clampPosition(latestCommittedLayoutRef.current);
      moveTo(rendered.x + dx, rendered.y + dy, announce);
    },
    [clampPosition, moveTo]
  );

  const openPhotoActions = useCallback((clientX?: number, clientY?: number) => {
    const target = photoRef.current;
    if (!target) return;
    const rect = target.getBoundingClientRect();
    target.dispatchEvent(
      new MouseEvent("contextmenu", {
        bubbles: true,
        cancelable: true,
        clientX: clientX ?? rect.left + rect.width / 2,
        clientY: clientY ?? rect.top + rect.height / 2,
      })
    );
  }, []);

  const handlePhotoClick = useCallback(
    (e: React.MouseEvent<HTMLDivElement>) => {
      if (e.detail > 1) return;
      if (gestureMovedRef.current) {
        gestureMovedRef.current = false;
        return;
      }
      openPhotoActions(e.clientX, e.clientY);
    },
    [openPhotoActions]
  );

  const handleMoveKeyDown = useCallback(
    (e: React.KeyboardEvent) => {
      if (
        e.key === "Enter" ||
        e.key === " " ||
        e.key === "Spacebar" ||
        e.key === "ContextMenu" ||
        (e.shiftKey && e.key === "F10")
      ) {
        e.preventDefault();
        e.stopPropagation();
        openPhotoActions();
        return;
      }

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
        moveTo(50, 50, true);
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
        commitWidth(clampInteractiveWidth(nextWidth), true);
        return;
      }
      if (dx === 0 && dy === 0) return;

      e.preventDefault();
      e.stopPropagation();
      moveBy(dx, dy, true);
    },
    [
      clampInteractiveWidth,
      commitWidth,
      getInteractiveWidth,
      moveBy,
      moveTo,
      onReturn,
      openPhotoActions,
    ]
  );

  const cancelActiveGesture = useCallback(() => {
    const hasActiveGesture =
      dragFrameRef.current !== null ||
      pendingDragLayoutRef.current !== null ||
      activePointersRef.current.size > 0 ||
      dragStartRef.current !== null ||
      resizeStartRef.current !== null ||
      pinchStartRef.current !== null ||
      gestureStartLayoutRef.current !== null;
    if (!hasActiveGesture) return;
    if (dragFrameRef.current !== null) {
      cancelAnimationFrame(dragFrameRef.current);
      dragFrameRef.current = null;
    }
    pendingDragLayoutRef.current = null;
    clearLongPressTimer();
    activePointersRef.current.clear();
    dragStartRef.current = null;
    resizeStartRef.current = null;
    pinchStartRef.current = null;
    gestureStartLayoutRef.current = null;
    const committedWidth = clampPhotoWidthForDensity(
      latestCommittedLayoutRef.current.width,
      photo.width,
    );
    liveWidthRef.current = committedWidth;
    setLiveWidth(committedWidth);
    setIsPinching(false);
    setIsPointerResizing(false);
    clearPreviewTransform();
    clearAllPointerFallbacks();
  }, [clearAllPointerFallbacks, clearLongPressTimer, clearPreviewTransform, photo.width]);

  const startPointerFallback = useCallback(
    (pointerId: number, target: HTMLElement) => {
      clearPointerFallback(pointerId);
      let active = true;
      const cleanup = () => {
        if (!active) return;
        active = false;
        window.removeEventListener("pointermove", forwardOutsideEvent, true);
        window.removeEventListener("pointerup", forwardOutsideEvent, true);
        window.removeEventListener("pointercancel", forwardOutsideEvent, true);
        pointerFallbackCleanupsRef.current.delete(pointerId);
      };
      const forwardToTarget = (event: PointerEvent) => {
        const forwarded = clonePointerEvent(event);
        forwardedPointerEventsRef.current.add(forwarded);
        target.dispatchEvent(forwarded);
      };
      const forwardOutsideEvent = (event: PointerEvent) => {
        if (event.pointerId !== pointerId || forwardedPointerEventsRef.current.has(event)) return;
        const terminal = event.type === "pointerup" || event.type === "pointercancel";
        if (terminal) {
          terminalPointerHandlerRef.current(pointerId, event.type);
          cleanup();
          return;
        }
        if (event.composedPath().includes(target)) {
          return;
        }
        if (!target.isConnected) {
          cleanup();
          cancelActiveGesture();
          return;
        }
        forwardToTarget(event);
      };

      pointerFallbackCleanupsRef.current.set(pointerId, cleanup);
      window.addEventListener("pointermove", forwardOutsideEvent, true);
      window.addEventListener("pointerup", forwardOutsideEvent, true);
      window.addEventListener("pointercancel", forwardOutsideEvent, true);
    },
    [cancelActiveGesture, clearPointerFallback]
  );

  const handlePointerDown = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      onCancelTapPlacement();
      gestureMovedRef.current = false;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      if (activePointersRef.current.size === 1) {
        const rendered = clampPosition(latestCommittedLayoutRef.current);
        gestureStartLayoutRef.current = {
          ...rendered,
          width: latestCommittedLayoutRef.current.width,
        };
        dragStartRef.current = {
          pointerId: e.pointerId,
          pointerType: e.pointerType,
          clientX: e.clientX,
          clientY: e.clientY,
          x: rendered.x,
          y: rendered.y,
        };
        if (e.pointerType === "touch") {
          clearLongPressTimer();
          longPressOriginRef.current = { x: e.clientX, y: e.clientY };
          longPressTimerRef.current = window.setTimeout(() => {
            longPressTimerRef.current = null;
            const target = photoRef.current;
            if (!target || activePointersRef.current.size !== 1 || gestureMovedRef.current) return;
            target.dispatchEvent(
              new MouseEvent("contextmenu", {
                bubbles: true,
                cancelable: true,
                clientX: e.clientX,
                clientY: e.clientY,
              })
            );
          }, FLOATING_PHOTO_LONG_PRESS_MS);
        }
      }
      if (e.pointerType !== "touch") {
        if (typeof e.currentTarget.setPointerCapture === "function") {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            // The scoped fallback below keeps the gesture alive.
          }
        }
        startPointerFallback(e.pointerId, e.currentTarget);
      }

      const points = getFirstTwoPointers(activePointersRef.current);
      if (points.length === 2) {
        clearLongPressTimer();
        gestureMovedRef.current = true;
        dragStartRef.current = null;
        if (typeof e.currentTarget.setPointerCapture === "function") {
          try {
            e.currentTarget.setPointerCapture(e.pointerId);
          } catch {
            startPointerFallback(e.pointerId, e.currentTarget);
          }
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
    [
      clampPosition,
      clearLongPressTimer,
      getInteractiveWidth,
      onCancelTapPlacement,
      startPointerFallback,
    ]
  );

  const handlePointerMove = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      if (contextMenuOpen) return;
      if (!activePointersRef.current.has(e.pointerId)) return;
      activePointersRef.current.set(e.pointerId, { x: e.clientX, y: e.clientY });
      const points = getFirstTwoPointers(activePointersRef.current);
      const longPressOrigin = longPressOriginRef.current;
      if (
        longPressOrigin &&
        Math.hypot(e.clientX - longPressOrigin.x, e.clientY - longPressOrigin.y) >
          FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE
      ) {
        clearLongPressTimer();
      }
      const start = pinchStartRef.current;
      if (points.length === 2 && start) {
        e.stopPropagation();
        const distance = Math.max(1, getDistance(points[0], points[1]));
        const nextWidth = clampInteractiveWidth(start.width * (distance / start.distance));
        const gestureStart = gestureStartLayoutRef.current ?? latestCommittedLayoutRef.current;
        scheduleDragLayout({ ...gestureStart, width: nextWidth });
        return;
      }

      const dragStart = dragStartRef.current;
      const container = containerRef.current;
      if (!dragStart || dragStart.pointerId !== e.pointerId || !container || isPinching) return;
      const dxPx = e.clientX - dragStart.clientX;
      const dyPx = e.clientY - dragStart.clientY;
      const moveTolerance =
        dragStart.pointerType === "touch" ? FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE : 0;
      if (Math.hypot(dxPx, dyPx) <= moveTolerance) return;
      gestureMovedRef.current = true;

      e.stopPropagation();
      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) return;
      scheduleDragLayout({
        x: dragStart.x + (dxPx / rect.width) * 100,
        y: dragStart.y + (dyPx / rect.height) * 100,
        width: liveWidthRef.current,
      });
    },
    [
      clampInteractiveWidth,
      clearLongPressTimer,
      containerRef,
      contextMenuOpen,
      isPinching,
      scheduleDragLayout,
    ]
  );

  const finishPointerGestureById = useCallback(
    (pointerId: number) => {
      if (
        !activePointersRef.current.has(pointerId) &&
        dragStartRef.current?.pointerId !== pointerId
      ) {
        return;
      }
      flushScheduledDrag();
      clearLongPressTimer();
      activePointersRef.current.delete(pointerId);
      if (dragStartRef.current?.pointerId === pointerId) dragStartRef.current = null;
      const gestureComplete = activePointersRef.current.size === 0 || isPinching;
      const shouldCommit = gestureComplete && gestureMovedRef.current && previewLayoutRef.current;

      if (gestureComplete) {
        activePointersRef.current.clear();
        dragStartRef.current = null;
        pinchStartRef.current = null;
        gestureStartLayoutRef.current = null;
        setIsPinching(false);
        if (shouldCommit) commitPreviewLayout(true);
        else clearPreviewTransform();
      }
    },
    [
      clearLongPressTimer,
      clearPreviewTransform,
      commitPreviewLayout,
      flushScheduledDrag,
      isPinching,
    ]
  );

  const finishPointerGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      finishPointerGestureById(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      clearPointerFallback(e.pointerId);
    },
    [
      clearPointerFallback,
      finishPointerGestureById,
    ]
  );

  const cancelPointerGesture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      gestureMovedRef.current = true;
      cancelActiveGesture();
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      clearPointerFallback(e.pointerId);
    },
    [cancelActiveGesture, clearPointerFallback]
  );

  const handleLostPointerCapture = useCallback(
    (e: React.PointerEvent<HTMLDivElement>) => {
      const activeDrag = dragStartRef.current?.pointerId === e.pointerId;
      const activeResize = resizeStartRef.current?.pointerId === e.pointerId;
      if (!activeDrag && !activeResize && !activePointersRef.current.has(e.pointerId)) return;
      flushScheduledDrag();
      clearLongPressTimer();
      activePointersRef.current.clear();
      dragStartRef.current = null;
      resizeStartRef.current = null;
      pinchStartRef.current = null;
      gestureStartLayoutRef.current = null;
      setIsPinching(false);
      setIsPointerResizing(false);
      clearPointerFallback(e.pointerId);
      if (gestureMovedRef.current && previewLayoutRef.current) commitPreviewLayout(true);
      else clearPreviewTransform();
    },
    [
      clearLongPressTimer,
      clearPointerFallback,
      clearPreviewTransform,
      commitPreviewLayout,
      flushScheduledDrag,
    ]
  );

  const handleResizePointerDown = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      if (e.pointerType === "touch") return;
      e.preventDefault();
      e.stopPropagation();
      onCancelTapPlacement();
      const current = clampPosition(latestCommittedLayoutRef.current);
      gestureStartLayoutRef.current = { ...current, width: getInteractiveWidth() };
      resizeStartRef.current = {
        pointerId: e.pointerId,
        clientX: e.clientX,
        clientY: e.clientY,
        width: getInteractiveWidth(),
        x: current.x,
        y: current.y,
        inlineDirection: language === "ar" || language === "he" ? -1 : 1,
      };
      gestureMovedRef.current = false;
      setIsPointerResizing(true);
      if (typeof e.currentTarget.setPointerCapture === "function") {
        try {
          e.currentTarget.setPointerCapture(e.pointerId);
        } catch {
          // The scoped fallback below keeps the gesture alive.
        }
      }
      startPointerFallback(e.pointerId, e.currentTarget);
    },
    [clampPosition, getInteractiveWidth, language, onCancelTapPlacement, startPointerFallback]
  );

  const handleResizePointerMove = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      const start = resizeStartRef.current;
      if (!start || start.pointerId !== e.pointerId) return;
      e.preventDefault();
      e.stopPropagation();
      const inlineDelta = (e.clientX - start.clientX) * start.inlineDirection;
      const blockDelta = e.clientY - start.clientY;
      const delta = Math.abs(inlineDelta) >= Math.abs(blockDelta) ? inlineDelta : blockDelta;
      const width = clampInteractiveWidth(start.width + delta);
      if (Math.abs(width - start.width) < 0.5) return;
      gestureMovedRef.current = true;
      scheduleDragLayout({ x: start.x, y: start.y, width }, "resizing");
    },
    [clampInteractiveWidth, scheduleDragLayout]
  );

  const finishResizePointerById = useCallback(
    (pointerId: number) => {
      const start = resizeStartRef.current;
      if (!start || start.pointerId !== pointerId) return;
      flushScheduledDrag();
      resizeStartRef.current = null;
      gestureStartLayoutRef.current = null;
      setIsPointerResizing(false);
      if (gestureMovedRef.current && previewLayoutRef.current) commitPreviewLayout(true);
      else clearPreviewTransform();
    },
    [clearPreviewTransform, commitPreviewLayout, flushScheduledDrag]
  );

  const handleResizePointerUp = useCallback(
    (e: React.PointerEvent<HTMLSpanElement>) => {
      e.preventDefault();
      e.stopPropagation();
      finishResizePointerById(e.pointerId);
      try {
        e.currentTarget.releasePointerCapture(e.pointerId);
      } catch {
        // Pointer capture may already be released by the browser.
      }
      clearPointerFallback(e.pointerId);
    },
    [clearPointerFallback, finishResizePointerById]
  );

  useLayoutEffect(() => {
    terminalPointerHandlerRef.current = (pointerId, type) => {
      if (type === "pointercancel") {
        cancelActiveGesture();
        return;
      }
      if (resizeStartRef.current?.pointerId === pointerId) {
        finishResizePointerById(pointerId);
        return;
      }
      finishPointerGestureById(pointerId);
    };
  }, [cancelActiveGesture, finishPointerGestureById, finishResizePointerById]);

  useEffect(() => {
    const cancelOnVisibilityLoss = () => {
      if (document.visibilityState === "hidden") cancelActiveGesture();
    };
    window.addEventListener("blur", cancelActiveGesture);
    window.addEventListener("pagehide", cancelActiveGesture);
    document.addEventListener("visibilitychange", cancelOnVisibilityLoss);
    return () => {
      window.removeEventListener("blur", cancelActiveGesture);
      window.removeEventListener("pagehide", cancelActiveGesture);
      document.removeEventListener("visibilitychange", cancelOnVisibilityLoss);
    };
  }, [cancelActiveGesture]);

  const handleContextMenuOpenChange = useCallback(
    (open: boolean) => {
      setContextMenuOpen(open);
      clearLongPressTimer();
      if (!open) {
        restorePhotoFocus();
        return;
      }
      cancelActiveGesture();
    },
    [cancelActiveGesture, clearLongPressTimer, restorePhotoFocus]
  );

  const displayWidth = clampPhotoWidthForContainer(liveWidth, containerSize.width, photo.width);
  const visualHeight = displayWidth / aspectRatio;
  const displayHeight = Math.max(48, visualHeight);
  const displayBounds = getFloatingPhotoPositionBounds(
    displayWidth,
    displayWidth / displayHeight,
    containerSize.width,
    containerSize.height
  );
  const interactionLabel = interpolate(
    position.description
      ? ts.diaryPhotoInteractionLabelWithDescription ||
          "Photo {current} of {total}: {description}. Move and resize it. Activate for options."
      : ts.diaryPhotoInteractionLabel ||
          "Photo {current} of {total}. Move and resize it. Activate for options.",
    {
      current: localizedPhotoNumber,
      total: localizedPhotoTotal,
      description: position.description
        ? isolateDirectionalText(position.description, language)
        : "",
    }
  );
  const interactionInstructions =
    ts.diaryPhotoGestureInstructions ||
    "Drag to move and pinch to resize. Activate for options. Press Home to center, use arrow keys to move, plus or minus to resize, and Delete to return to the gallery.";
  const instructionId = `floating-photo-instructions-${photo.id}`;

  return (
    <>
      <RadixContextMenu.Root key={contextMenuGeneration} onOpenChange={handleContextMenuOpenChange}>
        <RadixContextMenu.Trigger asChild>
          <div
            ref={photoRef}
            onKeyDown={handleMoveKeyDown}
            onPointerDown={handlePointerDown}
            onPointerMove={handlePointerMove}
            onPointerUp={finishPointerGesture}
            onPointerCancel={cancelPointerGesture}
            onLostPointerCapture={handleLostPointerCapture}
            onClick={handlePhotoClick}
            role="button"
            tabIndex={0}
            aria-haspopup="menu"
            aria-keyshortcuts="Enter Space Shift+F10"
            aria-label={interactionLabel}
            aria-describedby={instructionId}
            data-floating-photo-id={photo.id}
            data-tap-placement-active={isTapPlacementActive ? "true" : undefined}
            className={`group/photo absolute pointer-events-auto touch-none gpu-layer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/70 focus-visible:ring-offset-2 focus-visible:ring-offset-background/70 ${
              isPointerResizing ? "cursor-nwse-resize" : "cursor-grab active:cursor-grabbing"
            } ${
              isTapPlacementActive
                ? "ring-2 ring-primary/70 ring-offset-2 ring-offset-background/70"
                : ""
            }`}
            style={{
              left: `${clampPercent(position.x, displayBounds.minX, displayBounds.maxX)}%`,
              top: `${clampPercent(position.y, displayBounds.minY, displayBounds.maxY)}%`,
              width: displayWidth,
              height: displayHeight,
              marginLeft: -(displayWidth / 2),
              marginTop: -(displayHeight / 2),
              touchAction: "none",
            }}
          >
            <span id={instructionId} className="sr-only">
              {interactionInstructions}
            </span>
            {interactionStatus ? (
              <span role="status" aria-live="polite" aria-atomic="true" className="sr-only">
                {interactionStatus}
              </span>
            ) : null}
            <img
              src={photo.data || photo.thumbnail}
              alt=""
              className={`${FLOATING_PHOTO_RENDERING_CLASS} absolute left-1/2 top-1/2 select-none -translate-x-1/2 -translate-y-1/2 motion-safe:transition-[box-shadow,filter]`}
              style={{ width: displayWidth, height: visualHeight }}
              draggable={false}
              decoding="async"
              onError={() => onDecodeError(photo.id)}
            />
            <span
              data-testid="journal-photo-resize-handle"
              aria-hidden="true"
              onPointerDown={handleResizePointerDown}
              onPointerMove={handleResizePointerMove}
              onPointerUp={handleResizePointerUp}
              onPointerCancel={(event) => {
                event.preventDefault();
                event.stopPropagation();
                gestureMovedRef.current = true;
                cancelActiveGesture();
              }}
              className="absolute bottom-0 end-0 hidden size-12 cursor-nwse-resize touch-none items-end justify-end p-1.5 opacity-0 transition-opacity [@media(hover:hover)_and_(pointer:fine)]:flex [@media(hover:hover)_and_(pointer:fine)]:group-hover/photo:opacity-100"
            >
              <span className="block size-2.5 rounded-full border border-primary/70 bg-background/90 shadow-sm" />
            </span>
          </div>
        </RadixContextMenu.Trigger>
        <RadixContextMenu.Portal>
          <RadixContextMenu.Content
            className="z-[75] min-w-[180px] rounded-lg border border-border/20 bg-card/95 p-1.5 shadow-lg backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)] motion-safe:animate-in motion-safe:fade-in motion-safe:zoom-in-95 motion-safe:duration-150"
            onKeyDownCapture={(event) => {
              if (event.key !== "Escape") return;
              event.preventDefault();
              event.stopPropagation();
              closeContextMenu();
            }}
            onCloseAutoFocus={(event) => {
              event.preventDefault();
              restorePhotoFocus();
            }}
          >
            <RadixContextMenu.Item
              onSelect={onBeginTapPlacement}
              className="flex min-h-12 cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted motion-safe:transition-colors"
            >
              {ts.diaryPhotoMove || "Move photo"}
            </RadixContextMenu.Item>
            <RadixContextMenu.Item
              onSelect={() => setResizeDialogOpen(true)}
              className="flex min-h-12 cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted motion-safe:transition-colors"
            >
              {ts.diaryPhotoResize || "Resize photo"}
            </RadixContextMenu.Item>
            <RadixContextMenu.Item
              onSelect={() => {
                setDescriptionDraft(position.description ?? "");
                setDescriptionDialogOpen(true);
              }}
              className="flex min-h-12 cursor-pointer items-center rounded-lg px-3 py-2 text-sm outline-none data-[highlighted]:bg-muted motion-safe:transition-colors"
            >
              {ts.diaryPhotoDescribe || "Describe photo"}
            </RadixContextMenu.Item>
            <RadixContextMenu.Item
              onSelect={onReturn}
              className="flex min-h-12 cursor-pointer items-center rounded-lg px-3 py-2 text-sm text-destructive outline-none data-[highlighted]:bg-muted motion-safe:transition-colors"
            >
              {ts.diaryPhotoReturn || "Return photo to gallery"}
            </RadixContextMenu.Item>
          </RadixContextMenu.Content>
        </RadixContextMenu.Portal>
      </RadixContextMenu.Root>
      <Dialog open={descriptionDialogOpen} onOpenChange={setDescriptionDialogOpen}>
        <DialogContent
          className="w-[min(100%-1.5rem,30rem)]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restorePhotoFocus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{ts.diaryPhotoDescribe || "Describe photo"}</DialogTitle>
            <DialogDescription>
              {ts.diaryPhotoDescriptionHelp ||
                "Describe what matters in this photo for screen readers. Leave blank if it adds no meaning."}
            </DialogDescription>
          </DialogHeader>
          <form
            onSubmit={(event) => {
              event.preventDefault();
              saveDescription();
            }}
            className="grid min-w-0 gap-4"
          >
            <label
              htmlFor={`journal-photo-description-${photo.id}`}
              className="grid min-w-0 gap-2 text-sm font-medium text-foreground"
            >
              {ts.diaryPhotoDescriptionLabel || "Photo description"}
              <textarea
                id={`journal-photo-description-${photo.id}`}
                value={descriptionDraft}
                onChange={(event) => setDescriptionDraft(event.target.value)}
                maxLength={MAX_JOURNAL_PHOTO_DESCRIPTION_LENGTH}
                rows={4}
                dir="auto"
                className="min-h-28 w-full resize-y rounded-lg border border-border bg-background px-3 py-2 text-base text-foreground outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              />
            </label>
            <DialogFooter>
              <button
                type="button"
                onClick={closeDescriptionDialog}
                className="min-h-12 rounded-lg border border-border px-4 py-2 text-sm font-medium text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {ts.cancel || "Cancel"}
              </button>
              <button
                type="submit"
                className="min-h-12 rounded-lg bg-primary px-4 py-2 text-sm font-semibold text-primary-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60 focus-visible:ring-offset-2"
              >
                {ts.save || "Save"}
              </button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>
      <Dialog open={resizeDialogOpen} onOpenChange={setResizeDialogOpen}>
        <DialogContent
          className="w-[min(100%-1.5rem,30rem)]"
          onCloseAutoFocus={(event) => {
            event.preventDefault();
            restorePhotoFocus();
          }}
        >
          <DialogHeader>
            <DialogTitle>{ts.diaryPhotoResize || "Resize photo"}</DialogTitle>
            <DialogDescription className="sr-only">{interactionInstructions}</DialogDescription>
          </DialogHeader>
          <div
            className="grid grid-cols-2 gap-2"
            role="group"
            aria-label={ts.diaryPhotoResize || "Resize photo"}
          >
            {[
              [ts.diaryPhotoSizeSmall || "Small", 120],
              [ts.diaryPhotoSizeMedium || "Medium", 220],
              [ts.diaryPhotoSizeLarge || "Large", 340],
              [
                ts.diaryPhotoSizeFull || "Full width",
                Math.max(MIN_FLOATING_PHOTO_WIDTH, getContainerWidth() - 32),
              ],
            ].map(([label, width]) => (
              <button
                key={String(label)}
                type="button"
                onClick={() => {
                  commitWidth(clampInteractiveWidth(Number(width)), true);
                  setResizeDialogOpen(false);
                }}
                className="min-h-12 rounded-lg border border-border bg-background px-3 py-2 text-sm font-medium text-foreground hover:bg-muted focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/60"
              >
                {label}
              </button>
            ))}
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
});

const ReadOnlyFloatingPhoto = memo(function ReadOnlyFloatingPhoto({
  photo,
  position,
  containerSize,
  accessibleLabel,
  onDecodeError,
}: {
  photo: JournalPhoto;
  position: PhotoLayout;
  containerSize: { width: number; height: number };
  accessibleLabel: string;
  onDecodeError: (photoId: string) => void;
}) {
  const width = clampPhotoWidthForContainer(position.width, containerSize.width, photo.width);
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
      data-readonly-floating-photo-id={photo.id}
      data-photo-layout-x={position.x}
      data-photo-layout-y={position.y}
      data-photo-layout-width={position.width}
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
        alt={position.description || accessibleLabel}
        className={`${FLOATING_PHOTO_RENDERING_CLASS} h-full w-full`}
        draggable={false}
        loading="eager"
        decoding="async"
        onError={() => onDecodeError(photo.id)}
      />
    </div>
  );
});

function useFloatingPhotos(
  entryId: string,
  photoIds: string[],
  layout: Record<string, PhotoLayout>,
) {
  const [photos, setPhotos] = useState<JournalPhoto[]>([]);
  const [storageFailedPhotoCount, setStorageFailedPhotoCount] = useState(0);
  const [decodeFailedPhotoIds, setDecodeFailedPhotoIds] = useState<Set<string>>(
    () => new Set(),
  );
  const [loadAttempt, setLoadAttempt] = useState(0);
  const floatingIdKey = photoIds.filter((id) => layout[id]).join("\u0000");

  useEffect(() => {
    const floatingIds = floatingIdKey ? floatingIdKey.split("\u0000") : [];
    if (floatingIds.length === 0) {
      setPhotos([]);
      setStorageFailedPhotoCount(0);
      setDecodeFailedPhotoIds(new Set());
      return;
    }
    let cancelled = false;
    void Promise.allSettled(
      floatingIds.map((photoId) => getPhotoById(photoId, entryId)),
    ).then((results) => {
      if (cancelled) return;
      const failedCount = results.filter(
        (result) => result.status === "rejected" || !result.value,
      ).length;
      if (failedCount > 0) {
        logger.warn(
          "[FloatingMediaLayer]",
          `${failedCount} floating photo(s) could not be displayed`
        );
      }
      setStorageFailedPhotoCount(failedCount);
      setPhotos(
        results.flatMap((result) =>
          result.status === "fulfilled" && result.value ? [result.value] : []
        )
      );
    });
    return () => {
      cancelled = true;
    };
  }, [entryId, floatingIdKey, loadAttempt]);

  const reportDecodeError = useCallback((photoId: string) => {
    setDecodeFailedPhotoIds((current) => {
      if (current.has(photoId)) return current;
      const next = new Set(current);
      next.add(photoId);
      return next;
    });
  }, []);
  const retry = useCallback(() => {
    setDecodeFailedPhotoIds(new Set());
    setLoadAttempt((attempt) => attempt + 1);
  }, []);
  return {
    photos,
    failedPhotoCount: storageFailedPhotoCount + decodeFailedPhotoIds.size,
    loadAttempt,
    reportDecodeError,
    retry,
  };
}

export const FloatingMediaLayer = memo(function FloatingMediaLayer({
  entryId,
  photoIds,
  layout,
  onLayoutChange,
  onLayoutCommit,
  onReturnToGallery,
  containerRef,
  focusPhotoId,
  onPhotoFocusHandled,
}: FloatingMediaLayerProps) {
  const { t } = useLanguage();
  const {
    photos,
    failedPhotoCount,
    loadAttempt,
    reportDecodeError,
    retry,
  } = useFloatingPhotos(entryId, photoIds, layout);
  const [placementPhotoId, setPlacementPhotoId] = useState<string | null>(null);
  const placementPointerRef = useRef<{ pointerId: number; x: number; y: number } | null>(null);
  const placementReturnFocusRef = useRef<HTMLElement | null>(null);
  const cancelTapPlacement = useCallback(() => {
    placementPointerRef.current = null;
    setPlacementPhotoId(null);
    const returnTarget = placementReturnFocusRef.current;
    placementReturnFocusRef.current = null;
    if (returnTarget?.isConnected) returnTarget.focus();
  }, []);
  const beginTapPlacementForPhoto = useCallback((photoId: string) => {
    const photoTarget = Array.from(
      document.querySelectorAll<HTMLElement>("[data-floating-photo-id]"),
    ).find((element) => element.dataset.floatingPhotoId === photoId);
    placementReturnFocusRef.current =
      photoTarget ?? (document.activeElement instanceof HTMLElement ? document.activeElement : null);
    setPlacementPhotoId(photoId);
  }, []);

  useBackHandler(Boolean(placementPhotoId), cancelTapPlacement);

  useEffect(() => {
    if (!placementPhotoId) return;
    const cancelOnEscape = (event: KeyboardEvent) => {
      if (event.key !== "Escape") return;
      event.preventDefault();
      event.stopImmediatePropagation();
      cancelTapPlacement();
    };
    const cancelWhenHidden = () => {
      if (document.hidden) cancelTapPlacement();
    };
    document.addEventListener("keydown", cancelOnEscape, true);
    document.addEventListener("visibilitychange", cancelWhenHidden);
    window.addEventListener("pagehide", cancelTapPlacement);
    window.addEventListener("blur", cancelTapPlacement);
    return () => {
      document.removeEventListener("keydown", cancelOnEscape, true);
      document.removeEventListener("visibilitychange", cancelWhenHidden);
      window.removeEventListener("pagehide", cancelTapPlacement);
      window.removeEventListener("blur", cancelTapPlacement);
    };
  }, [cancelTapPlacement, placementPhotoId]);

  useEffect(() => {
    if (placementPhotoId && (!layout[placementPhotoId] || !photoIds.includes(placementPhotoId))) {
      cancelTapPlacement();
    }
  }, [cancelTapPlacement, layout, photoIds, placementPhotoId]);

  const commitTapPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!placementPhotoId) return;
      if (event.target instanceof Element && event.target.closest("[data-floating-photo-id]")) {
        return;
      }

      const container = containerRef.current;
      const photo = photos.find((item) => item.id === placementPhotoId);
      const currentPosition = layout[placementPhotoId];
      if (!container || !photo || !currentPosition) {
        cancelTapPlacement();
        return;
      }

      const rect = container.getBoundingClientRect();
      if (rect.width <= 0 || rect.height <= 0) {
        cancelTapPlacement();
        return;
      }

      event.preventDefault();
      event.stopPropagation();
      const aspectRatio = photo.width && photo.height ? photo.width / photo.height : 4 / 3;
      const width = clampPhotoWidthForContainer(
        currentPosition.width,
        rect.width,
        photo.width,
      );
      const bounds = getFloatingPhotoPositionBounds(width, aspectRatio, rect.width, rect.height);
      const x = ((event.clientX - rect.left) / rect.width) * 100;
      const y = ((event.clientY - rect.top) / rect.height) * 100;
      onLayoutChange((current) => {
        const saved = current[placementPhotoId];
        if (!saved) return current;
        return {
          ...current,
          [placementPhotoId]: {
            ...saved,
            x: clampPercent(x, bounds.minX, bounds.maxX),
            y: clampPercent(y, bounds.minY, bounds.maxY),
            width: saved.width,
          },
        };
      });
      onLayoutCommit?.();
      cancelTapPlacement();
    },
    [
      cancelTapPlacement,
      containerRef,
      layout,
      onLayoutChange,
      onLayoutCommit,
      photos,
      placementPhotoId,
    ]
  );

  const beginTapPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      if (!placementPhotoId) return;
      if (event.target instanceof Element && event.target.closest("[data-floating-photo-id]")) {
        return;
      }
      placementPointerRef.current = {
        pointerId: event.pointerId,
        x: event.clientX,
        y: event.clientY,
      };
      try {
        event.currentTarget.setPointerCapture(event.pointerId);
      } catch {
        // Pointer capture is best-effort across embedded WebViews.
      }
    },
    [placementPhotoId]
  );

  const trackTapPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = placementPointerRef.current;
      if (!start || start.pointerId !== event.pointerId) return;
      if (
        getDistance(start, { x: event.clientX, y: event.clientY }) <=
        FLOATING_PHOTO_TOUCH_MOVE_TOLERANCE
      ) {
        return;
      }
      placementPointerRef.current = null;
      cancelTapPlacement();
    },
    [cancelTapPlacement]
  );

  const finishTapPlacement = useCallback(
    (event: React.PointerEvent<HTMLDivElement>) => {
      const start = placementPointerRef.current;
      placementPointerRef.current = null;
      if (!start || start.pointerId !== event.pointerId) return;
      commitTapPlacement(event);
    },
    [commitTapPlacement]
  );

  const cancelPendingTapPlacement = useCallback(() => {
    placementPointerRef.current = null;
    cancelTapPlacement();
  }, [cancelTapPlacement]);

  if (photos.length === 0 && failedPhotoCount === 0) return null;

  return (
    <div
      className={`absolute inset-0 z-20 overflow-hidden ${
        placementPhotoId ? "pointer-events-auto cursor-crosshair" : "pointer-events-none"
      }`}
      data-testid="floating-media-layer"
      data-placement-photo-id={placementPhotoId || undefined}
      onPointerDown={beginTapPlacement}
      onPointerMove={trackTapPlacement}
      onPointerUp={finishTapPlacement}
      onPointerCancel={cancelPendingTapPlacement}
      onLostPointerCapture={cancelPendingTapPlacement}
    >
      {failedPhotoCount > 0 && (
        <div
          role="status"
          className="pointer-events-auto absolute start-1/2 top-3 z-30 flex max-w-[min(90%,30rem)] -translate-x-1/2 rtl:translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-center text-sm text-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]"
        >
          <span>
            {t.journalPhotoLoadError ||
              "Some photos could not be shown. Your entry was not changed."}
          </span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-12 min-w-12 items-center rounded-lg px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            {t.journalPhotoLoadRetry || "Try loading photos again"}
          </button>
        </div>
      )}
      {placementPhotoId && (
        <div
          className="pointer-events-auto absolute left-1/2 top-3 z-30 flex max-w-[min(90%,32rem)] -translate-x-1/2 items-center gap-2 rounded-lg border border-border/30 bg-card/90 p-1.5 ps-3 text-sm font-medium text-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]"
          onPointerDown={(event) => event.stopPropagation()}
          onPointerUp={(event) => event.stopPropagation()}
        >
          <span role="status" aria-live="polite" aria-atomic="true" className="min-w-0">
            {t.diaryPhotoTapDestination || "Photo selected. Tap where you want to place it."}
          </span>
          <button
            type="button"
            className="inline-flex min-h-12 min-w-12 shrink-0 items-center justify-center rounded-lg px-3 text-primary hover:bg-primary/10 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
            onClick={(event) => {
              event.stopPropagation();
              cancelTapPlacement();
            }}
          >
            {t.cancel || "Cancel"}
          </button>
        </div>
      )}
      {photos.map((photo, index) => {
        const pos = layout[photo.id];
        if (!pos) return null;
        return (
          <FloatingPhoto
            key={`${photo.id}:${loadAttempt}`}
            photo={photo}
            position={pos}
            onPositionChange={(newPos) => {
              onLayoutChange((current) => ({ ...current, [photo.id]: newPos }));
            }}
            onInteractionCommit={onLayoutCommit}
            onReturn={() => {
              onReturnToGallery(photo.id);
              onLayoutCommit?.();
            }}
            onDecodeError={reportDecodeError}
            onBeginTapPlacement={() => beginTapPlacementForPhoto(photo.id)}
            onCancelTapPlacement={cancelTapPlacement}
            isTapPlacementActive={placementPhotoId === photo.id}
            containerRef={containerRef}
            focusPhotoId={focusPhotoId}
            onFocusHandled={onPhotoFocusHandled}
            photoNumber={index + 1}
            photoTotal={photos.length}
          />
        );
      })}
    </div>
  );
});

export const ReadOnlyFloatingMediaLayer = memo(function ReadOnlyFloatingMediaLayer({
  entryId,
  photoIds,
  layout,
}: ReadOnlyFloatingMediaLayerProps) {
  const layerRef = useRef<HTMLDivElement>(null);
  const { t, language } = useLanguage();
  const {
    photos,
    failedPhotoCount,
    loadAttempt,
    reportDecodeError,
    retry,
  } = useFloatingPhotos(entryId, photoIds, layout);
  const containerSize = useElementSize(layerRef, photos.length);

  if (photos.length === 0 && failedPhotoCount === 0) return null;

  return (
    <div
      ref={layerRef}
      className="absolute inset-0 z-10 pointer-events-none overflow-hidden"
      data-testid="readonly-floating-media-layer"
    >
      {failedPhotoCount > 0 && (
        <div
          role="status"
          className="pointer-events-auto absolute start-1/2 top-3 z-30 flex max-w-[min(90%,30rem)] -translate-x-1/2 rtl:translate-x-1/2 flex-wrap items-center justify-center gap-2 rounded-lg border border-border/60 bg-card/95 px-3 py-2 text-center text-sm text-foreground shadow-sm backdrop-blur-xl [-webkit-backdrop-filter:blur(24px)]"
        >
          <span>
            {t.journalPhotoLoadError ||
              "Some photos could not be shown. Your entry was not changed."}
          </span>
          <button
            type="button"
            onClick={retry}
            className="inline-flex min-h-12 min-w-12 items-center rounded-lg px-3 font-medium text-primary underline-offset-4 hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary/45"
          >
            {t.journalPhotoLoadRetry || "Try loading photos again"}
          </button>
        </div>
      )}
      {photos.map((photo, index) => {
        const pos = layout[photo.id];
        if (!pos) return null;
        return (
          <ReadOnlyFloatingPhoto
            key={`${photo.id}:${loadAttempt}`}
            photo={photo}
            position={pos}
            containerSize={containerSize}
            accessibleLabel={interpolate(t.journalPhotoPosition || "Photo {current} of {total}", {
              current: isolateDirectionalToken(
                formatLocalizedNumber(index + 1, language),
                language
              ),
              total: isolateDirectionalToken(
                formatLocalizedNumber(photos.length, language),
                language
              ),
            })}
            onDecodeError={reportDecodeError}
          />
        );
      })}
    </div>
  );
});
