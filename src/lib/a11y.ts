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

import { nanoid } from 'nanoid';

// ============================================
// TYPES
// ============================================

export type AnnouncementPriority = 'polite' | 'assertive';

export interface FocusTrapOptions {
  /** Initial element to focus when trap is activated */
  initialFocus?: HTMLElement | null;
  /** Element to return focus to when trap is deactivated */
  returnFocus?: HTMLElement | null;
  /** Whether to auto-focus first focusable element */
  autoFocus?: boolean;
}

// ============================================
// CONSTANTS
// ============================================

const FOCUSABLE_SELECTORS = [
  'button:not([disabled])',
  'input:not([disabled])',
  'select:not([disabled])',
  'textarea:not([disabled])',
  'a[href]',
  '[tabindex]:not([tabindex="-1"])',
  '[contenteditable="true"]',
].join(', ');

// Live region element for screen reader announcements
let liveRegion: HTMLElement | null = null;

// ============================================
// SCREEN READER ANNOUNCEMENTS
// ============================================

/**
 * Initialize the live region for screen reader announcements
 * Should be called once when the app starts
 */
export function initLiveRegion(): void {
  if (liveRegion) return;

  liveRegion = document.createElement('div');
  liveRegion.setAttribute('aria-live', 'polite');
  liveRegion.setAttribute('aria-atomic', 'true');
  liveRegion.setAttribute('role', 'status');
  liveRegion.className = 'sr-only'; // Visually hidden but accessible
  liveRegion.style.cssText = `
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
  document.body.appendChild(liveRegion);
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
export function announce(message: string, priority: AnnouncementPriority = 'polite'): void {
  if (!liveRegion) {
    initLiveRegion();
  }

  if (!liveRegion) return;

  // Update priority if needed
  liveRegion.setAttribute('aria-live', priority);

  // Clear and set message (this triggers the announcement)
  liveRegion.textContent = '';

  // Use requestAnimationFrame to ensure the clear takes effect
  requestAnimationFrame(() => {
    if (liveRegion) {
      liveRegion.textContent = message;
    }
  });
}

/**
 * Announce a success message
 */
export function announceSuccess(message: string): void {
  announce(message, 'polite');
}

/**
 * Announce an error message (interrupts current speech)
 */
export function announceError(message: string): void {
  announce(message, 'assertive');
}

// ============================================
// FOCUS MANAGEMENT
// ============================================

/**
 * Get all focusable elements within a container
 */
export function getFocusableElements(container: HTMLElement): HTMLElement[] {
  const elements = container.querySelectorAll<HTMLElement>(FOCUSABLE_SELECTORS);
  return Array.from(elements).filter(el => {
    // Check if element is visible
    const style = window.getComputedStyle(el);
    return style.display !== 'none' && style.visibility !== 'hidden';
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
  const { initialFocus, returnFocus, autoFocus = true } = options;

  // Store the currently focused element to restore later
  const previouslyFocused = returnFocus || (document.activeElement as HTMLElement);

  // Get focusable elements
  const focusableElements = getFocusableElements(container);

  if (focusableElements.length === 0) {
    if (import.meta.env.DEV) {
      console.warn('[A11y] Focus trap: No focusable elements found in container');
    }
    return () => {};
  }

  const firstFocusable = focusableElements[0];
  const lastFocusable = focusableElements[focusableElements.length - 1];

  // Focus initial element
  if (autoFocus) {
    const elementToFocus = initialFocus || firstFocusable;
    elementToFocus?.focus();
  }

  // Handle Tab key to trap focus
  const handleKeyDown = (event: KeyboardEvent) => {
    if (event.key !== 'Tab') return;

    // Refresh focusable elements in case DOM changed
    const currentFocusable = getFocusableElements(container);
    if (currentFocusable.length === 0) return;

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

  container.addEventListener('keydown', handleKeyDown);

  // Return cleanup function
  return () => {
    container.removeEventListener('keydown', handleKeyDown);
    previouslyFocused?.focus();
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

export type NavigationDirection = 'next' | 'prev' | 'first' | 'last';

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
    case 'ArrowRight':
      if (horizontal) direction = 'next';
      break;
    case 'ArrowLeft':
      if (horizontal) direction = 'prev';
      break;
    case 'ArrowDown':
      if (vertical) direction = 'next';
      break;
    case 'ArrowUp':
      if (vertical) direction = 'prev';
      break;
    case 'Home':
      direction = 'first';
      break;
    case 'End':
      direction = 'last';
      break;
    default:
      return;
  }

  event.preventDefault();

  let newIndex = currentIndex;

  switch (direction) {
    case 'next':
      newIndex = loop
        ? (currentIndex + 1) % elements.length
        : Math.min(currentIndex + 1, elements.length - 1);
      break;
    case 'prev':
      newIndex = loop
        ? (currentIndex - 1 + elements.length) % elements.length
        : Math.max(currentIndex - 1, 0);
      break;
    case 'first':
      newIndex = 0;
      break;
    case 'last':
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
export function handleSelectionKeys(
  event: KeyboardEvent,
  onSelect: () => void
): void {
  if (event.key === ' ' || event.key === 'Enter') {
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
export function generateA11yId(prefix: string = 'a11y'): string {
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
  if (element.getAttribute('aria-hidden') === 'true') {
    return false;
  }

  // Check computed styles
  const style = window.getComputedStyle(element);
  if (style.display === 'none' || style.visibility === 'hidden') {
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
    role: 'option',
    'aria-selected': isSelected,
    tabIndex: isSelected ? 0 : -1,
    onClick: onSelect,
    onKeyDown: (e: KeyboardEvent) => handleSelectionKeys(e, onSelect),
  };
}

/**
 * Props for a button that toggles something
 */
export function getToggleButtonProps(
  isPressed: boolean,
  label: string
): Record<string, unknown> {
  return {
    'aria-pressed': isPressed,
    'aria-label': label,
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
