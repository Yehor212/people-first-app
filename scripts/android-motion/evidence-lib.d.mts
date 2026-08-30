export interface HashedArtifactFile {
  path: string;
  bytes: number;
  sha256: string;
}

export interface HashedArtifact {
  kind: "file" | "directory";
  fileCount: number;
  bytes: number;
  sha256: string;
  files: HashedArtifactFile[];
}

export interface SourceEvidenceArtifact {
  path: string;
  bytes: number;
  sha256: string;
}

export interface SourceEvidenceDirtyPath {
  path: string;
  status: string;
  sha256?: string;
}

export interface SourceEvidence {
  gitHead: string;
  stagedDiffSha256: string;
  unstagedDiffSha256: string;
  dirtyPaths: SourceEvidenceDirtyPath[];
  buildInputs: SourceEvidenceArtifact[];
  untrackedInputs: SourceEvidenceArtifact[];
}

export interface OrbProbeSample {
  source: string;
  renderedAt: number;
  postedAt?: number;
  requestId?: number;
  [key: string]: unknown;
}

export interface OrbProbeSummary {
  frameCount: number;
  elapsedMs: number;
  presentedCadenceHz: number;
  gapsOver100Ms: number;
  frameIntervalP95Ms: number | null;
  frameIntervalP99Ms: number | null;
  workerAckCount: number;
  workerAckP95Ms: number | null;
  workerAckP99Ms: number | null;
  sources: string[];
}

export interface LayerViewport {
  width: number;
  height: number;
  devicePixelRatio?: number;
}

export interface LayerAttributionInputLayer {
  layerId: string;
  parentLayerId?: string;
  backendNodeId?: number;
  width: number;
  height: number;
  drawsContent?: boolean;
  paintCount?: number;
  invisible?: boolean;
}

export interface LayerAttributionNode {
  selector?: string;
  styles?: Record<string, unknown>;
}

export interface AttributedDrawingLayer {
  layerId: string;
  parentLayerId?: string;
  backendNodeId?: number;
  selector: string | null;
  width: number;
  height: number;
  estimatedPixels: number;
  paintCount: number;
  invisible: boolean;
  reasons: string[];
  styles: Record<string, unknown>;
}

export interface LayerAttributionSummary {
  layerCount: number;
  drawingLayerCount: number;
  totalLayerPixels: number;
  totalDrawingPixels: number;
  totalLayerAreaRatio: number;
  totalDrawingAreaRatio: number;
  largestDrawingLayers: AttributedDrawingLayer[];
}

export interface LocalAppWebViewTarget {
  type: "page";
  url: string;
  webSocketDebuggerUrl: string;
  [key: string]: unknown;
}

export function buildStyleExperimentExpression(input: { css: string; id: string }): string;
export function validateDomExperimentSource(source: string): string;
export function selectLocalAppWebViewTarget(targets: unknown[]): LocalAppWebViewTarget;
export function buildLocalBenchmarkRoute(targetUrl: string, requestedPath: string): string;
export function parseCurrentWebViewProvider(state: string): {
  packageName: string;
  version: string;
} | null;
export function parseWebViewDevtoolsSocket(procNetUnix: string, pid: number): string;
export function mapWithConcurrency<T, R>(
  values: T[],
  concurrency: number,
  mapper: (value: T, index: number) => R | Promise<R>,
): Promise<R[]>;
export function waitForChildExit(
  child: {
    exitCode: number | null;
    signalCode: string | null;
    once: (event: string, listener: (...args: any[]) => void) => unknown;
    removeListener?: (event: string, listener: (...args: any[]) => void) => unknown;
    kill: (signal?: string) => unknown;
  },
  timeoutMs: number,
): Promise<{ code: number | null; signal: string | null }>;

export function median(values: number[]): number;
export function medianAbsoluteDeviation(values: number[]): number;
export interface SceneTransitionSample {
  at: number;
  nodes: Record<string, { visible: boolean; [key: string]: unknown }>;
}
export interface SceneTransitionSummary {
  complete: boolean;
  disappearanceSamplesAfterComplete: number;
  firstAllVisibleAtMs: number | null;
  firstAnyVisibleAtMs: number | null;
  firstVisibleAtMs: Record<string, number | null>;
  longestPartialSceneMs: number;
  missingSelectors: string[];
  popInSpreadMs: number | null;
  sampleCount: number;
}
export function summarizeSceneTransitionSamples(
  samples: SceneTransitionSample[],
  requiredSelectors: string[],
): SceneTransitionSummary;
export function hashPath(inputPath: string): Promise<HashedArtifact>;
export function buildSourceEvidence(input: {
  root: string;
  gitHead: string;
  stagedDiffSha256: string;
  unstagedDiffSha256: string;
  dirtyPaths: Array<{ path: string; status: string }>;
  buildInputPaths: string[];
}): Promise<SourceEvidence>;
export function summarizeOrbProbeSamples(samples: OrbProbeSample[]): OrbProbeSummary;
export function summarizeLayerAttribution(input: {
  viewport: LayerViewport;
  layers: LayerAttributionInputLayer[];
  nodesByBackendId?: Record<string, LayerAttributionNode>;
  reasonsByLayerId?: Record<string, string[]>;
}): LayerAttributionSummary;
export function validateEvidenceLedger<T>(ledger: T): T;
export function validateRunEnvironmentEvidence<T>(environment: T): T;
export function assertRunArtifactIdentity<T extends {
  expectedSha256: string;
  sourceSha256: string;
  installedBeforeSha256: string;
  installedAfterSha256: string;
  packageName: string;
  versionName: string;
  versionCode: number;
}>(identity: T): T;
export function parseTraceProcessorCsv(csv: string): Array<Record<string, string>>;
export function buildTraceSummaryQueries(packageName: string): {
  frameTimeline: string;
  webViewDraw: string;
  threadCpu: string;
};
