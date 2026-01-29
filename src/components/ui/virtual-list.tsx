/**
 * VirtualList - Performant virtualized list component
 * Part of v1.5.0 Intelligence & Speed
 *
 * Uses @tanstack/react-virtual for efficient rendering of large lists
 */

import { useRef, ReactNode } from 'react';
import { useVirtualizer } from '@tanstack/react-virtual';
import { cn } from '@/lib/utils';

// ============================================
// TYPES
// ============================================

interface VirtualListProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  className?: string;
  containerClassName?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

interface VirtualGridProps<T> {
  items: T[];
  renderItem: (item: T, index: number) => ReactNode;
  itemHeight: number;
  columns: number;
  gap?: number;
  className?: string;
  containerClassName?: string;
  overscan?: number;
  getItemKey?: (item: T, index: number) => string | number;
}

// ============================================
// VIRTUAL LIST (1 column)
// ============================================

export function VirtualList<T>({
  items,
  renderItem,
  itemHeight,
  className,
  containerClassName,
  overscan = 5,
  getItemKey,
}: VirtualListProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  const virtualizer = useVirtualizer({
    count: items.length,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight,
    overscan,
    getItemKey: getItemKey
      ? (index) => getItemKey(items[index], index)
      : undefined,
  });

  const virtualItems = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', containerClassName)}
    >
      <div
        className={cn('relative w-full', className)}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualItems.map((virtualItem) => {
          const item = items[virtualItem.index];
          return (
            <div
              key={virtualItem.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualItem.size}px`,
                transform: `translateY(${virtualItem.start}px)`,
              }}
            >
              {renderItem(item, virtualItem.index)}
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// VIRTUAL GRID (multiple columns)
// ============================================

export function VirtualGrid<T>({
  items,
  renderItem,
  itemHeight,
  columns,
  gap = 12,
  className,
  containerClassName,
  overscan = 3,
  getItemKey,
}: VirtualGridProps<T>) {
  const parentRef = useRef<HTMLDivElement>(null);

  // Calculate number of rows
  const rowCount = Math.ceil(items.length / columns);

  const virtualizer = useVirtualizer({
    count: rowCount,
    getScrollElement: () => parentRef.current,
    estimateSize: () => itemHeight + gap,
    overscan,
  });

  const virtualRows = virtualizer.getVirtualItems();

  return (
    <div
      ref={parentRef}
      className={cn('overflow-auto', containerClassName)}
    >
      <div
        className={cn('relative w-full', className)}
        style={{
          height: `${virtualizer.getTotalSize()}px`,
        }}
      >
        {virtualRows.map((virtualRow) => {
          const rowIndex = virtualRow.index;
          const startIndex = rowIndex * columns;
          const rowItems = items.slice(startIndex, startIndex + columns);

          return (
            <div
              key={virtualRow.key}
              className="absolute top-0 left-0 w-full"
              style={{
                height: `${virtualRow.size - gap}px`,
                transform: `translateY(${virtualRow.start}px)`,
              }}
            >
              <div
                className="grid h-full"
                style={{
                  gridTemplateColumns: `repeat(${columns}, minmax(0, 1fr))`,
                  gap: `${gap}px`,
                }}
              >
                {rowItems.map((item, colIndex) => {
                  const index = startIndex + colIndex;
                  return (
                    <div
                      key={getItemKey ? getItemKey(item, index) : index}
                      className="h-full"
                    >
                      {renderItem(item, index)}
                    </div>
                  );
                })}
                {/* Fill empty columns in last row */}
                {rowItems.length < columns &&
                  Array.from({ length: columns - rowItems.length }).map((_, i) => (
                    <div key={`empty-${i}`} className="h-full" />
                  ))}
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}

// ============================================
// THRESHOLD FOR VIRTUALIZATION
// ============================================

/**
 * Threshold for when to use virtualization
 * Below this count, regular rendering is more efficient
 */
export const VIRTUALIZATION_THRESHOLD = 50;

/**
 * Helper to determine if virtualization should be used
 */
export function shouldVirtualize(itemCount: number): boolean {
  return itemCount >= VIRTUALIZATION_THRESHOLD;
}
