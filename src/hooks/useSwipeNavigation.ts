/**
 * useSwipeNavigation Hook
 *
 * Enables swipe gestures for tab navigation on mobile devices.
 * Swipe left/right to switch between tabs.
 *
 * Features:
 * - Minimum swipe distance threshold to prevent accidental triggers
 * - Velocity detection for fast swipes
 * - Respects horizontal scroll containers
 * - Haptic feedback on tab change
 */

import { useRef, useCallback, useEffect } from 'react';
import { hapticTap } from '@/lib/haptics';

export type SwipeDirection = 'left' | 'right' | null;

interface SwipeState {
  startX: number;
  startY: number;
  startTime: number;
  isTracking: boolean;
}

interface UseSwipeNavigationOptions<T extends string> {
  /** Current active tab */
  activeTab: T;
  /** Callback to change tab */
  onTabChange: (tab: T) => void;
  /** Ordered list of tabs (swipe moves through this order) */
  tabs: T[];
  /** Minimum swipe distance in pixels (default: 50) */
  threshold?: number;
  /** Minimum swipe velocity in px/ms (default: 0.3) */
  velocityThreshold?: number;
  /** Whether swipe navigation is enabled (default: true) */
  enabled?: boolean;
}

interface UseSwipeNavigationReturn {
  /** Props to spread on the container element */
  containerProps: {
    onTouchStart: (e: React.TouchEvent) => void;
    onTouchMove: (e: React.TouchEvent) => void;
    onTouchEnd: (e: React.TouchEvent) => void;
  };
  /** Ref to attach to the container element */
  containerRef: React.RefObject<HTMLDivElement>;
}

/**
 * Hook for swipe-based tab navigation
 *
 * @example
 * const { containerProps, containerRef } = useSwipeNavigation({
 *   activeTab,
 *   onTabChange: setActiveTab,
 *   tabs: ['home', 'garden', 'stats', 'settings'],
 * });
 *
 * return (
 *   <div ref={containerRef} {...containerProps}>
 *     {content}
 *   </div>
 * );
 */
export function useSwipeNavigation<T extends string>({
  activeTab,
  onTabChange,
  tabs,
  threshold = 50,
  velocityThreshold = 0.3,
  enabled = true,
}: UseSwipeNavigationOptions<T>): UseSwipeNavigationReturn {
  const containerRef = useRef<HTMLDivElement>(null);
  const swipeState = useRef<SwipeState>({
    startX: 0,
    startY: 0,
    startTime: 0,
    isTracking: false,
  });

  // Get next/previous tab
  const getAdjacentTab = useCallback(
    (direction: 'next' | 'prev'): T | null => {
      const currentIndex = tabs.indexOf(activeTab);
      if (currentIndex === -1) return null;

      if (direction === 'next') {
        return currentIndex < tabs.length - 1 ? tabs[currentIndex + 1] : null;
      } else {
        return currentIndex > 0 ? tabs[currentIndex - 1] : null;
      }
    },
    [activeTab, tabs]
  );

  // Check if element or its parents have horizontal scroll
  const hasHorizontalScroll = useCallback((element: HTMLElement | null): boolean => {
    while (element && element !== containerRef.current) {
      const style = window.getComputedStyle(element);
      const overflowX = style.overflowX;

      if (
        (overflowX === 'auto' || overflowX === 'scroll') &&
        element.scrollWidth > element.clientWidth
      ) {
        return true;
      }

      element = element.parentElement;
    }
    return false;
  }, []);

  const handleTouchStart = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled) return;

      // Don't intercept swipes starting on form elements
      const target = e.target as HTMLElement;
      const tagName = target.tagName.toLowerCase();
      if (['input', 'textarea', 'select'].includes(tagName) || target.isContentEditable) {
        return;
      }

      // Don't interfere with horizontal scrollable elements
      if (hasHorizontalScroll(target)) {
        swipeState.current.isTracking = false;
        return;
      }

      const touch = e.touches[0];

      // Ignore swipes starting from screen edges (Android system back gesture zones)
      const EDGE_ZONE = 20;
      if (touch.clientX < EDGE_ZONE || touch.clientX > window.innerWidth - EDGE_ZONE) {
        swipeState.current.isTracking = false;
        return;
      }

      swipeState.current = {
        startX: touch.clientX,
        startY: touch.clientY,
        startTime: Date.now(),
        isTracking: true,
      };
    },
    [enabled, hasHorizontalScroll]
  );

  const handleTouchMove = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeState.current.isTracking) return;

      const touch = e.touches[0];
      const deltaX = touch.clientX - swipeState.current.startX;
      const deltaY = touch.clientY - swipeState.current.startY;

      // If vertical movement is greater than horizontal, stop tracking
      // This allows normal vertical scrolling
      if (Math.abs(deltaY) > Math.abs(deltaX) * 1.5) {
        swipeState.current.isTracking = false;
      }
    },
    [enabled]
  );

  const handleTouchEnd = useCallback(
    (e: React.TouchEvent) => {
      if (!enabled || !swipeState.current.isTracking) return;

      const touch = e.changedTouches[0];
      const deltaX = touch.clientX - swipeState.current.startX;
      const deltaY = touch.clientY - swipeState.current.startY;
      const deltaTime = Date.now() - swipeState.current.startTime;

      // Reset tracking
      swipeState.current.isTracking = false;

      // Check if it's a horizontal swipe (not vertical scroll)
      if (Math.abs(deltaY) > Math.abs(deltaX)) {
        return;
      }

      // Check threshold
      const absX = Math.abs(deltaX);
      if (absX < threshold) {
        return;
      }

      // Check velocity (fast swipes should also work even if short)
      const velocity = absX / deltaTime;
      if (absX < threshold * 2 && velocity < velocityThreshold) {
        return;
      }

      // Determine direction and change tab
      // Swipe left = go to next tab (content moves left, next tab appears from right)
      // Swipe right = go to previous tab (content moves right, previous tab appears from left)
      const direction = deltaX > 0 ? 'prev' : 'next';
      const newTab = getAdjacentTab(direction);

      if (newTab) {
        hapticTap();
        onTabChange(newTab);
      }
    },
    [enabled, threshold, velocityThreshold, getAdjacentTab, onTabChange]
  );

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      swipeState.current.isTracking = false;
    };
  }, []);

  return {
    containerProps: {
      onTouchStart: handleTouchStart,
      onTouchMove: handleTouchMove,
      onTouchEnd: handleTouchEnd,
    },
    containerRef,
  };
}

export default useSwipeNavigation;
