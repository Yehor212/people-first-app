import { type ReactNode } from "react";
import {
  Group,
  Panel,
  Separator,
  usePanelRef,
  type PanelImperativeHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface PanelLayoutProps {
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  onLayoutChange?: (layout: Record<string, number>) => void;
  autoSaveId?: string;
  className?: string;
}

export function PanelLayout({
  orientation = "horizontal",
  children,
  onLayoutChange,
  autoSaveId,
  className,
}: PanelLayoutProps) {
  return (
    <Group
      orientation={orientation}
      onLayoutChange={onLayoutChange}
      autoSaveId={autoSaveId}
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
  collapsedSize,
  onCollapse,
  onExpand,
  panelRef,
}: LayoutPanelProps) {
  return (
    <Panel
      panelRef={panelRef}
      defaultSize={defaultSize}
      minSize={minSize}
      maxSize={maxSize}
      className={cn("overflow-y-auto", className)}
      collapsible={collapsible}
      collapsedSize={collapsedSize}
      onCollapse={onCollapse}
      onExpand={onExpand}
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
