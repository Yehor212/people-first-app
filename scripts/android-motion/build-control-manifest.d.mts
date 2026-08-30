import type {
  ClickableNodeInventoryEntry,
  UiAutomatorBounds,
} from "./run-real-user-journey.mjs";

export type ControlStatus =
  | "PASS"
  | "FAIL"
  | "BLOCKED"
  | "UNVERIFIED"
  | "NOT_APPLICABLE";

export interface AndroidMotionControlRow {
  controlId: string;
  route: string;
  state: string;
  role: string;
  accessibleName: string;
  resourceId: string | null;
  bounds: UiAutomatorBounds;
  interaction: "tap" | "toggle" | "drag";
  transitionClass:
    | "none"
    | "press"
    | "route"
    | "drawer"
    | "sheet"
    | "modal"
    | "theme"
    | "ime"
    | "system";
  dataAuthority: "empty-state";
  mandatory: boolean;
  discoveredAt: string;
  exercisedRunIds: string[];
  status: ControlStatus;
  exclusionReason: string | null;
}

export interface AndroidControlManifest {
  schemaVersion: 1;
  generatedAt: string;
  artifactSha256: string;
  sourceJourney: { path: string; bytes: number; sha256: string };
  runId: string;
  scenario: string;
  locale: string;
  motion: string;
  controls: AndroidMotionControlRow[];
  coverage: ReturnType<typeof summarizeControlCoverage>;
}

export function summarizeControlCoverage(
  controls: AndroidMotionControlRow[],
): {
  discovered: number;
  duplicateControlIds: number;
  exercisedPass: number;
  mandatoryBlocked: number;
  mandatoryDiscovered: number;
  mandatoryFail: number;
  mandatoryUnverified: number;
  notApplicable: number;
  percent: number;
};

export function buildControlManifest(input: {
  artifactSha256: string;
  generatedAt?: string;
  inventories: Array<{ route: string; nodes: ClickableNodeInventoryEntry[] }>;
  locale: string;
  motion: string;
  runId: string;
  scenario: string;
  sourceJourney: { path: string; bytes: number; sha256: string };
}): AndroidControlManifest;

export function validateControlManifest<T extends AndroidControlManifest>(
  manifest: T,
  options?: { requireComplete?: boolean },
): T;
