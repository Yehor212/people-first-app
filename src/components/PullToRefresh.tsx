/**
 * Pull to Refresh Component
 *
 * Mobile-friendly gesture to refresh content by pulling down.
 * Works on both web and native (Capacitor) platforms.
 */

import { useState, useRef, useCallback, type ReactNode } from 'react';
import { RefreshCw } from 'lucide-react';
import { cn } from '@/lib/utils';
import { haptics } from '@/lib/haptics';

interface PullToRefreshProps {
  /** Async function to call when refresh is triggered */
  onRefresh: () => Promise<void>;
  /** Content to wrap */
  children: ReactNode;
  /** Whether pull-to-refresh is enabled (default: true) */
  enabled?: boolean;
  /** Custom className for the container */
  className?: string;
}

const THRESHOLD = 80; // Pixels to pull before triggering refresh
const MAX_PULL = 120; // Maximum pull distance

export function PullToRefresh({
  onRefresh,
  children,
  enabled = true,
  className,
}: PullToRefreshProps) {
  const [refreshing, setRefreshing] = useState(false);
  const [pullDistance, setPullDistance] = useState(0);
  const startY = useRef(0);
  const containerRef = useRef<HTMLDivElement>(null);

  const handleTouchStart = useCallback((e: React.TouchEvent) => {
    if (!enabled || refreshing) return;

    // Only start tracking if we're at the top of the scroll container
    const container = containerRef.current;
    if (container && container.scrollTop === 0) {
      startY.current = e.touches[0].clientY;
    }
  }, [enabled, refreshing]);

  const handleTouchMove = useCallback((e: React.TouchEvent) => {
    if (!enabled || refreshing || startY.current === 0) return;

    const currentY = e.touches[0].clientY;
    const distance = currentY - startY.current;

    // Only track downward pulls
    if (distance > 0) {
      // Apply resistance to make it feel natural
      const resistedDistance = Math.min(distance * 0.5, MAX_PULL);
      setPullDistance(resistedDistance);

      // Haptic feedback when crossing threshold
      if (resistedDistance >= THRESHOLD && pullDistance < THRESHOLD) {
        void haptics.light();
      }
    }
  }, [enabled, refreshing, pullDistance]);

  const handleTouchEnd = useCallback(async () => {
    if (!enabled || refreshing) return;

    if (pullDistance >= THRESHOLD) {
      setRefreshing(true);
      void haptics.medium();

      try {
        await onRefresh();
      } finally {
        setRefreshing(false);
      }
    }

    // Reset
    setPullDistance(0);
    startY.current = 0;
  }, [enabled, refreshing, pullDistance, onRefresh]);

  // Calculate indicator opacity and rotation based on pull distance
  const progress = Math.min(pullDistance / THRESHOLD, 1);
  const rotation = progress * 180;

  return (
    <div
      ref={containerRef}
      className={cn('relative overflow-auto', className)}
      onTouchStart={handleTouchStart}
      onTouchMove={handleTouchMove}
      onTouchEnd={handleTouchEnd}
    >
      {/* Pull indicator */}
      <div
        className="absolute left-0 right-0 flex items-center justify-center overflow-hidden transition-all duration-150 ease-out"
        style={{
          height: refreshing ? 48 : pullDistance,
          top: 0,
          zIndex: 10,
        }}
      >
        <div
          className={cn(
            'flex items-center justify-center w-10 h-10 rounded-full bg-primary/10',
            refreshing && 'animate-pulse'
          )}
          style={{
            opacity: refreshing ? 1 : progress,
            transform: `rotate(${refreshing ? 0 : rotation}deg)`,
          }}
        >
          <RefreshCw
            className={cn(
              'w-5 h-5 text-primary',
              refreshing && 'animate-spin'
            )}
          />
        </div>
      </div>

      {/* Content with offset during pull */}
      <div
        className="transition-transform duration-150 ease-out"
        style={{
          transform: `translateY(${refreshing ? 48 : pullDistance}px)`,
        }}
      >
        {children}
      </div>
    </div>
  );
}
