export interface UiAutomatorBounds {
  bottom: number;
  left: number;
  right: number;
  top: number;
}

export interface UiAutomatorNode {
  bounds: UiAutomatorBounds | null;
  className: string;
  clickable: boolean;
  contentDescription: string;
  enabled: boolean;
  resourceId: string;
  scrollable: boolean;
  text: string;
  visibleToUser: boolean;
}

export interface UiNodeSelector {
  clickable?: boolean;
  contentDescription?: string;
  contentDescriptionIncludes?: string;
  text?: string;
  textIncludes?: string;
}

export interface AndroidDayCompositorSurface {
  canvas: {
    height: number;
    motionModel: string | null;
    width: number;
  } | null;
  largeEffectDisplays: Record<string, string | null>;
  largeEffectsCanvasCount: number;
  rendererState: string | null;
}

export function parseUiAutomatorNodes(xml: string): UiAutomatorNode[];
export function listVisibleClickableNodes(nodes: UiAutomatorNode[]): UiAutomatorNode[];
export function findVisibleScrollableNode(nodes: UiAutomatorNode[]): UiAutomatorNode | undefined;
export function sliderJourneyPoints(bounds: UiAutomatorBounds, edgeInset?: number): {
  negative: { x: number; y: number };
  neutral: { x: number; y: number };
  positive: { x: number; y: number };
};
export function verticalSwipeWithinBounds(
  bounds: UiAutomatorBounds,
  direction: "up" | "down",
): {
  from: { x: number; y: number };
  to: { x: number; y: number };
};
export interface ClickableNodeInventoryEntry extends UiAutomatorNode {
  label: string;
  route: string;
  capturedAtMs: number;
  status: "PASS" | "FAIL" | "NOT_REPRODUCIBLE" | "N/A" | "UNVERIFIED";
  actionLabel?: string;
}
export function createClickableNodeInventory(
  nodes: UiAutomatorNode[],
  input: { route: string; capturedAtMs: number },
): ClickableNodeInventoryEntry[];
export function reconcileClickableNode(
  inventory: ClickableNodeInventoryEntry[],
  input: {
    bounds: UiAutomatorBounds;
    label: string;
    status: ClickableNodeInventoryEntry["status"];
  },
): ClickableNodeInventoryEntry[];
export function findVisibleUiNode(
  nodes: UiAutomatorNode[],
  selector: UiNodeSelector,
): UiAutomatorNode | undefined;
export function findVisibleClickableUiNode(
  nodes: UiAutomatorNode[],
  selector: Omit<UiNodeSelector, "clickable">,
): UiAutomatorNode | undefined;
export function centerOfBounds(bounds: UiAutomatorBounds): {
  x: number;
  y: number;
};
export function shouldCaptureJourneyScreenshots(argv: string[]): boolean;
export function getRefineJourneyRequiredTexts(): string[];
export function assertJourneyScenario(
  value: string,
): "orb-slider-refine" | "drawer-theme" | "full-route-cycle";
export function calculateClockSync(input: {
  hostMonotonicStartedAtMs: number;
  hostMonotonicEndedAtMs: number;
  hostWallClockStartedAtMs: number;
  deviceUptimeSeconds: number;
}): {
  deviceUptimeMs: number;
  hostMonotonicMidpointMs: number;
  hostWallClockMidpointMs: number;
  uncertaintyMs: number;
};
export function runTimedJourneyStep<TEntry extends Record<string, unknown>, TResult>(input: {
  clock?: () => number;
  wallClock?: () => number;
  entry: TEntry;
  execute: () => TResult | Promise<TResult>;
}): Promise<TEntry & {
  startedAtMs: number;
  endedAtMs: number;
  startedAtWallClockMs: number;
  endedAtWallClockMs: number;
  result: TResult;
}>;
export function hasIsolatedAndroidDayCompositor(
  surface: AndroidDayCompositorSurface | null,
): boolean;
