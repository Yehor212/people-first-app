import { forwardRef, type ReactNode } from "react";
import {
  Group as PanelGroup,
  Panel,
  Separator as PanelResizeHandle,
  type ImperativePanelHandle,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

interface PanelLayoutProps {
  direction?: "horizontal" | "vertical";
  children: ReactNode;
  onLayout?: (sizes: number[]) => void;
  autoSaveId?: string;
  className?: string;
}

export function PanelLayout({
  direction = "horizontal",
  children,
  onLayout,
  autoSaveId,
  className,
}: PanelLayoutProps) {
  return (
    <PanelGroup
      direction={direction}
      onLayout={onLayout}
      autoSaveId={autoSaveId}
      className={cn("h-full", className)}
    >
      {children}
    </PanelGroup>
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
}

export const LayoutPanel = forwardRef<ImperativePanelHandle, LayoutPanelProps>(function LayoutPanel(
  {
    children,
    defaultSize,
    minSize = 15,
    maxSize = 70,
    className,
    collapsible,
    collapsedSize,
    onCollapse,
    onExpand,
  },
  ref
) {
  return (
    <Panel
      ref={ref}
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
});

export type { ImperativePanelHandle };

export function ResizeHandle() {
  return (
    <PanelResizeHandle className="group w-1.5 bg-transparent hover:bg-primary/20 transition-colors duration-150 flex items-center justify-center">
      <div className="w-0.5 h-8 rounded-full bg-border group-hover:bg-primary/50 transition-colors" />
    </PanelResizeHandle>
  );
}
