export const TASK9_EXPECTED_CAPTURE_IDS: readonly string[];

export interface Task9CaptureEvidence {
  id: string;
  path: string;
  sha256: string;
  sizeBytes: number;
  fixtureProvenance?: {
    kind?: string;
    source?: string;
    productionReachable?: boolean;
  };
}

export interface Task9ProductionEnvironment {
  CI?: string;
  ZENFLOW_PLAYWRIGHT_USE_LOCAL_SERVER?: string;
  ZENFLOW_PLAYWRIGHT_PREVIEW_DIR?: string;
  ZENFLOW_PLAYWRIGHT_LOCAL_PORT?: string;
}

export function validateTask9CaptureSet(options: {
  captures: Task9CaptureEvidence[];
  outputRoot: string;
  repositoryRoot: string;
}): string[];

export function validateTask9ProductionContext(options: {
  env: Task9ProductionEnvironment;
  baseURL?: string;
  configuredBaseURL?: string;
}): string[];
