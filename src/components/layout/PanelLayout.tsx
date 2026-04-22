import {
  Children,
  isValidElement,
  useCallback,
  useRef,
  type ReactNode,
} from "react";
import {
  Group,
  Panel,
  Separator,
  useGroupRef as useResizableGroupRef,
  usePanelRef,
  type Layout as ResizableLayout,
  type PanelImperativeHandle,
  type PanelSize,
} from "react-resizable-panels";
import { cn } from "@/lib/utils";

export type Layout = ResizableLayout;
type LayoutInput = Layout | number[];

export interface GroupImperativeHandle {
  getLayout(): Layout;
  setLayout(layout: LayoutInput): void;
}

interface CompatibleGroupRef {
  current: GroupImperativeHandle;
  _internalRef: ReturnType<typeof useResizableGroupRef>;
}

interface PanelLayoutProps {
  orientation?: "horizontal" | "vertical";
  children: ReactNode;
  defaultLayout?: LayoutInput;
  onLayoutChange?: (layout: Layout) => void;
  className?: string;
  autoSaveId?: string;
  groupRef?: CompatibleGroupRef;
}

interface LayoutPanelProps {
  id?: string;
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

function normalizeLayout(
  currentLayout: Layout,
  requestedLayout: LayoutInput,
): Layout {
  const currentKeys = Object.keys(currentLayout);

  if (currentKeys.length === 0) {
    return Array.isArray(requestedLayout) ? {} : requestedLayout;
  }

  if (Array.isArray(requestedLayout)) {
    return currentKeys.reduce<Layout>((nextLayout, key, index) => {
      nextLayout[key] = requestedLayout[index] ?? currentLayout[key];
      return nextLayout;
    }, {});
  }

  const normalizedLayout: Layout = { ...currentLayout };
  const unmatchedValues: number[] = [];

  for (const [requestedKey, value] of Object.entries(requestedLayout)) {
    if (requestedKey in currentLayout) {
      normalizedLayout[requestedKey] = value;
    } else {
      unmatchedValues.push(value);
    }
  }

  if (unmatchedValues.length === 0) {
    return normalizedLayout;
  }

  const unassignedKeys = currentKeys.filter(
    (key) => !(key in requestedLayout),
  );

  unassignedKeys.forEach((key, index) => {
    const nextValue = unmatchedValues[index];
    if (typeof nextValue === "number") {
      normalizedLayout[key] = nextValue;
    }
  });

  return normalizedLayout;
}

function getBaseLayoutFromChildren(children: ReactNode): Layout | null {
  const baseLayout: Layout = {};
  let hasPanels = false;
  let hasPanelWithoutId = false;

  Children.forEach(children, (child) => {
    if (!isValidElement(child)) {
      return;
    }

    if (
      typeof child.props !== "object" ||
      child.props === null ||
      !("defaultSize" in child.props) ||
      typeof child.props.defaultSize !== "number"
    ) {
      return;
    }

    if (typeof child.props.id !== "string") {
      hasPanelWithoutId = true;
      return;
    }

    hasPanels = true;
    baseLayout[child.props.id] = child.props.defaultSize;
  });

  return hasPanels && !hasPanelWithoutId ? baseLayout : null;
}

export function useGroupRef(): CompatibleGroupRef {
  const internalRef = useResizableGroupRef();
  const compatibleRef = useRef<CompatibleGroupRef | null>(null);

  if (!compatibleRef.current) {
    compatibleRef.current = {
      current: {
        getLayout: () => internalRef.current?.getLayout() ?? {},
        setLayout: (requestedLayout) => {
          const group = internalRef.current;
          if (!group) {
            return;
          }

          const currentLayout = group.getLayout();
          group.setLayout(normalizeLayout(currentLayout, requestedLayout));
        },
      },
      _internalRef: internalRef,
    };
  }

  return compatibleRef.current;
}

export function PanelLayout({
  orientation = "horizontal",
  children,
  defaultLayout,
  onLayoutChange,
  className,
  autoSaveId: _autoSaveId,
  groupRef,
}: PanelLayoutProps) {
  const baseLayout = getBaseLayoutFromChildren(children);
  const resolvedDefaultLayout =
    defaultLayout && baseLayout
      ? normalizeLayout(baseLayout, defaultLayout)
      : undefined;

  return (
    <Group
      orientation={orientation}
      defaultLayout={resolvedDefaultLayout}
      onLayoutChange={onLayoutChange}
      className={cn("h-full", className)}
      groupRef={groupRef?._internalRef}
    >
      {children}
    </Group>
  );
}

export function LayoutPanel({
  id,
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
      const currentPct = typeof size === "object" ? size.asPercentage : size;
      const isNowCollapsed = currentPct <= (collapsedSize ?? 0);

      if (isNowCollapsed && !wasCollapsedRef.current) {
        wasCollapsedRef.current = true;
        onCollapse?.();
      } else if (!isNowCollapsed && wasCollapsedRef.current) {
        wasCollapsedRef.current = false;
        onExpand?.();
      }
    },
    [collapsedSize, onCollapse, onExpand],
  );

  return (
    <Panel
      id={id}
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
    <Separator className="group flex w-1.5 items-center justify-center bg-transparent motion-safe:transition-colors motion-safe:duration-150 hover:bg-primary/20">
      <div className="h-8 w-0.5 rounded-full bg-border motion-safe:transition-colors group-hover:bg-primary/50" />
    </Separator>
  );
}
