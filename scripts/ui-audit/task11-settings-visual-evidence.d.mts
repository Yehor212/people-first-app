export interface Task11ValidationInput {
  [key: string]: unknown;
}

export const TASK11_SUBJECT_HEAD: string;
export const TASK11_CANONICAL_RUNNER_ID: string;
export const TASK11_FIXED_CLOCK: string;
export const TASK11_OUTPUT_ROOT: string;
export const TASK11_BUILD_MANIFEST_EVIDENCE_PATH: string;
export const TASK11_SCENARIOS: readonly Readonly<Record<string, unknown>>[];

export function validateTask11ProductionContext(input: Task11ValidationInput): string[];
export function validateTask11CaptureSet(input: Task11ValidationInput): string[];
export function validateTask11RuntimeReceipt(input: Task11ValidationInput): string[];
