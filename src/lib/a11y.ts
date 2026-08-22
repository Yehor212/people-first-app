/**
 * Accessibility (A11y) Utilities
 * Part of v1.3.0 "Harmony" - WCAG 2.1 AA compliance
 *
 * Provides helpers for:
 * - Focus management (trapping, restoration)
 * - Screen reader announcements
 * - Keyboard navigation
 * - Unique ID generation
 */

import { nanoid } from "nanoid";
import { logger } from "@/lib/logger";
import { IS_DEV } from "@/lib/env";

// ============================================
// TYPES
// ============================================

export type AnnouncementPriority = "polite" | "assertive";

export interface FocusTrapOptions {
  /** Initial element to focus when trap is activated */
  initialFocus?: HTMLElement | null;
  /** Element to return focus to when trap is deactivated */
  returnFocus?: HTMLElement | null;
  /** Resolve a connected fallback when the original opener no longer exists */
  returnFocusFallback?: () => HTMLElement | null;
  /** Whether to auto-focus first focusable element */
  autoFocus?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const FOCUSABLE_SELECTORS = [
  "button:not([disabled])",
  "input:not([disabled])",
  "select:not([disabled])",
  "textarea:not([disabled])",
  "a[href]",
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(", ");

// Two separate live regions — one per priority (WCAG best practice).
// Some screen readers miss announcements when aria-live priority changes dynamically,
// so we create a dedicated region for each priority level.
let politeRegion: HTMLElement | null = null;
let assertiveRegion: HTMLElement | null = null;

// Backward-compatible alias used by initA11y() guard
let liveRegion: HTMLElement | null = null;

// ============================================
// SCREEN READER ANNOUNCEMENTS
// ============================================

/** Shared CSS for visually-hidden live regions */
const SR_ONLY_STYLE = `
  position: absolute;
  width: 1px;
  height: 1px;
  padding: 0;
  margin: -1px;
  overflow: hidden;
  clip: rect(0, 0, 0, 0);
  white-space: nowrap;
  border: 0;
`;

function createLiveRegion(id: string, priority: AnnouncementPriority): HTMLElement {
  const el = document.createElement("div");
  el.id = id;
  el.setAttribute("aria-live", priority);
  el.setAttribute("aria-atomic", "true");
  el.setAttribute("role", priority === "assertive" ? "alert" : "status");
  el.className = "sr-only";
  el.style.cssText = SR_ONLY_STYLE;
  document.body.appendChild(el);
  return el;
}

/**
 * Initialize the live regions for screen reader announcements.
 * Creates two regions: one polite (waits for silence) and one assertive (interrupts).
 * Should be called once when the app starts.
 */
export function initLiveRegion(): void {
  if (liveRegion) return; // Already initialized

  politeRegion = createLiveRegion("a11y-polite", "polite");
  assertiveRegion = createLiveRegion("a11y-assertive", "assertive");

  // Set backward-compatible guard so initLiveRegion() is idempotent
  liveRegion = politeRegion;
}

/**
 * Announce a message to screen readers
 *
 * @param message - The message to announce
 * @param priority - 'polite' waits for silence, 'assertive' interrupts
 *
 * @example
 * announce('Habit completed!', 'polite');
 * announce('Error: Please enter a valid email', 'assertive');
 */
export function announce(message: string, priority: AnnouncementPriority = "polite"): void {
  if (!politeRegion || !assertiveRegion) {
    initLiveRegion();
  }

  const region = priority === "assertive" ? assertiveRegion : politeRegion;
  if (!region) return;

  // Clear and set message (this triggers the announcement)
  region.textContent = "";

  // Use requestAnimationFrame to ensure the clear takes effect
  requestAnimationFrame(() => {
    if (region) {
      region.textContent = message;
    }
  });
}

/**
 * Announce a success message
 */
export function announceSuccess(message: string): void {
  announce(message, "polite");
}

/**
 * Announce an error message (interrupts current speech)
 */
export function announceError(message: string): void {
  announce(message, "assertive");
}

// ============================================
// FOCUS MANAGEMENT
// ============================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter((el) => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return style.display !== "none" && style.visibility !== "hidden";
  });
}

/**
 * Create a focus trap within a container
 * Keeps focus cycling within the container until deactivated
 *
 * @returns Cleanup function to deactivate the trap
 *
 * @example
 * const deactivate = createFocusTrap(modalElement, {
 *   initialFocus: closeButton,
 *   returnFocus: triggerButton,
 * });
 * // Later: deactivate();
 */
export function createFocusTrap(
  container: HTMLElement,
  options: FocusTrapOptions = {}
): () => void {
  const { initialFocus, returnFocus, returnFocusFallback, autoFocus = true } = options;

  // Store the currently focused element to restore later
  const previouslyFocused = returnFocus || (document.activeElement as HTMLElement);

  const focusableElements = getFocusableElements(container);
  const hadTabIndex = container.hasAttribute("tabindex");
  const originalTabIndex = container.getAttribute("tabindex");
  if (focusableElements.length === 0 && !hadTabIndex) {
    container.setAttribute("tabindex", "-1");
  }

  if (focusableElements.length === 0 && IS_DEV) {
    logger.warn("[A11y] Focus trap: No focusable elements found in container");
  }

  if (focusableElements.length === 0) {
    if (IS_DEV) {
      logger.log("[A11y] Focus trap: Using the dialog surface during its busy state");
    }
  }

  const firstFocusable = focusableElements[0] ?? container;

  // Focus initial element
  if (autoFocus) {
    const elementToFocus = initialFocus?.isConnected ? initialFocus : firstFocusable;
    elementToFocus?.focus();
  }

  // Handle Tab key to trap focus
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== "Tab") return;

    // Refresh focusable elements in case DOM changed
    const currentFocusable = getFocusableElements(container);
    if (currentFocusable.length === 0) {
      event.preventDefault();
      container.focus();
      return;
    }

    const first = currentFocusable[0];
    const last = currentFocusable[currentFocusable.length - 1];

    if (event.shiftKey) {
      // Shift + Tab: go backwards
      if (document.activeElement === first) {
        event.preventDefault();
        last.focus();
      }
    } else {
      // Tab: go forwards
      if (document.activeElement === last) {
        event.preventDefault();
        first.focus();
      }
    }
  };

  container.addEventListener("keydown", handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener("keydown", handleKeyDown);
    if (!hadTabIndex) {
      container.removeAttribute("tabindex");
    } else if (originalTabIndex !== null) {
      container.setAttribute("tabindex", originalTabIndex);
    }
    const fallback = returnFocusFallback?.();
    const target = previouslyFocused?.isConnected
      ? previouslyFocused
      : fallback?.isConnected
        ? fallback
        : null;
    target?.focus({ preventScroll: true });
  };
}

/**
 * Move focus to a specific element with optional announcement
 */
export function moveFocus(element: HTMLElement | null, announcement?: string): void {
  if (!element) return;

  element.focus();

  if (announcement) {
    announce(announcement);
  }
}

// ============================================
// KEYBOARD NAVIGATION
// ============================================

export type NavigationDirection = "next" | "prev" | "first" | "last";

/**
 * Handle arrow key navigation within a list of elements
 *
 * @example
 * const handleKeyDown = (e: KeyboardEvent) => {
 *   handleArrowNavigation(e, buttons, currentIndex, setCurrentIndex);
 * };
 */
export function handleArrowNavigation(
  event: KeyboardEvent,
  elements: HTMLElement[],
  currentIndex: number,
  onNavigate: (newIndex: number) => void,
  options: { horizontal?: boolean; vertical?: boolean; loop?: boolean } = {}
): void {
  const { horizontal = true, vertical = true, loop = true } = options;

  let direction: NavigationDirection | null = null;

  // Determine direction from key
  switch (event.key) {
    case "ArrowRight":
      if (horizontal) direction = "next";
      break;
    case "ArrowLeft":
      if (horizontal) direction = "prev";
      break;
    case "ArrowDown":
      if (vertical) direction = "next";
      break;
    case "ArrowUp":
      if (vertical) direction = "prev";
      break;
    case "Home":
      direction = "first";
      break;
    case "End":
      direction = "last";
      break;
    default:
      return;
  }

  event.preventDefault();

  let newIndex = currentIndex;

  switch (direction) {
    case "next":
      newIndex = loop
        ? (currentIndex + 1) % elements.length
        : Math.min(currentIndex + 1, elements.length - 1);
      break;
    case "prev":
      newIndex = loop
        ? (currentIndex - 1 + elements.length) % elements.length
        : Math.max(currentIndex - 1, 0);
      break;
    case "first":
      newIndex = 0;
      break;
    case "last":
      newIndex = elements.length - 1;
      break;
  }

  if (newIndex !== currentIndex) {
    onNavigate(newIndex);
    elements[newIndex]?.focus();
  }
}

/**
 * Handle selection with Space/Enter keys
 */
export function handleSelectionKeys(event: KeyboardEvent, onSelect: () => void): void {
  if (event.key === " " || event.key === "Enter") {
    event.preventDefault();
    onSelect();
  }
}

// ============================================
// UNIQUE ID GENERATION
// ============================================

/**
 * Generate a unique ID for accessibility purposes
 * Useful for linking labels with inputs, descriptions with elements, etc.
 *
 * @example
 * const inputId = generateA11yId('mood-input');
 * // Returns: 'mood-input-a1b2c3d4'
 */
export function generateA11yId(prefix: string = "a11y"): string {
  return `${prefix}-${nanoid(8)}`;
}

/**
 * Generate a pair of IDs for label/input relationship
 *
 * @example
 * const { inputId, labelId } = generateLabelledPair('habit-name');
 * <label id={labelId} htmlFor={inputId}>Name</label>
 * <input id={inputId} aria-labelledby={labelId} />
 */
export function generateLabelledPair(prefix: string): { inputId: string; labelId: string } {
  const id = nanoid(8);
  return {
    inputId: `${prefix}-input-${id}`,
    labelId: `${prefix}-label-${id}`,
  };
}

// ============================================
// VISIBILITY HELPERS
// ============================================

/**
 * Check if an element is visible to screen readers
 * (not hidden by aria-hidden, display:none, visibility:hidden)
 */
export function isAccessible(element: HTMLElement): boolean {
  // Check aria-hidden
  if (element.getAttribute("aria-hidden") === "true") {
    return false;
  }

  // Check computed styles
  const style = window.getComputedStyle(element);
  if (style.display === "none" || style.visibility === "hidden") {
    return false;
  }

  // Check parent visibility
  const parent = element.parentElement;
  if (parent && parent !== document.body) {
    return isAccessible(parent);
  }

  return true;
}

// ============================================
// HOOKS HELPERS (for React components)
// ============================================

/**
 * Props to spread on elements for keyboard-selectable items
 *
 * @example
 * <div {...getSelectableProps(isSelected, () => setSelected(true))}>
 *   Option 1
 * </div>
 */
export function getSelectableProps(
  isSelected: boolean,
  onSelect: () => void
): Record<string, unknown> {
  return {
    role: "option",
    "aria-selected": isSelected,
    tabIndex: isSelected ? 0 : -1,
    onClick: onSelect,
    onKeyDown: (e: KeyboardEvent) => handleSelectionKeys(e, onSelect),
  };
}

/**
 * Props for a button that toggles something
 */
export function getToggleButtonProps(isPressed: boolean, label: string): Record<string, unknown> {
  return {
    "aria-pressed": isPressed,
    "aria-label": label,
  };
}

// ============================================
// INITIALIZATION
// ============================================

/**
 * Initialize all a11y features
 * Call this once when the app starts
 */
export function initA11y(): void {
  initLiveRegion();
}

export default {
  announce,
  announceSuccess,
  announceError,
  createFocusTrap,
  moveFocus,
  handleArrowNavigation,
  handleSelectionKeys,
  generateA11yId,
  generateLabelledPair,
  getFocusableElements,
  isAccessible,
  getSelectableProps,
  getToggleButtonProps,
  initA11y,
};
