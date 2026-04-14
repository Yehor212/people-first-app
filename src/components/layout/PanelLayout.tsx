import { useCallback, useRef, type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelImperativeHandle,
  type PanelSize,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface PanelLayoutProps {
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  onLayoutChange?: (layout: Record<string, number>) => void;
  className?: string;
}

export function PanelLayout({
  orientation = "horizontal",
  children,
  onLayoutChange,
  className,
}: PanelLayoutProps) {
  return (
    <Group
      orientation={orientation}
      onLayoutChange={onLayoutChange}
      className={cn("h-full", className)}
    >
      {children}
    </Group>
  );
}

interface LayoutPanelProps {
  children: ReactNode;
  defaultSize: number;
  minSize?: number;
  maxSize?: number;
  className?: string;
  collapsible?: boolean;
  collapsedSize?: number;
  onCollapse?: () => void;
  onExpand?: () => void;
  panelRef?: ReturnType<typeof usePanelRef>;
}

export function LayoutPanel({
  children,
  defaultSize,
  minSize = 15,
  maxSize = 70,
  className,
  collapsible,
  collapsedSize = 0,
  onCollapse,
  onExpand,
  panelRef,
}: LayoutPanelProps) {
  const wasCollapsedRef = useRef(false);

  const handleResize = useCallback(
    (size: PanelSize) => {
      const currentPct = typeof size === "object" ? size.sizePercentage : size;
      const isNowCollapsed = currentPct <= (collapsedSize ?? 0);

      if (isNowCollapsed && !wasCollapsedRef.current) {
        wasCollapsedRef.current = true;
        onCollapse?.();
      } else if (!isNowCollapsed && wasCollapsedRef.current) {
        wasCollapsedRef.current = false;
        onExpand?.();
      }
    },
    [collapsedSize, onCollapse, onExpand]
  );

  return (
    <Panel
      panelRef={panelRef}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      className={cn("overflow-y-auto", className)}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      onResize={handleResize}
    >
      {children}
    </Panel>
  );
}

export { usePanelRef };
export type { PanelImperativeHandle };

export function ResizeHandle() {
  return (
    <Separator className="group w-1.5 bg-transparent hover:bg-primary/20 transition-colors duration-150 flex items-center justify-center">
      <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
    </Separator>
  );
}
