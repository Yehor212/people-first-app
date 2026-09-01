export interface VisualProofViolation {
  file: string;
  line: number;
  rule: string;
  detail: string;
  severity: "CRITICAL" | "HIGH" | "MEDIUM";
}

export type StatusName = "PASS" | "FAIL" | "UNVERIFIED" | "SKIP";

export interface ArtifactRecord {
  role?: unknown;
  path?: unknown;
  sha256?: unknown;
  bytes?: unknown;
  portable?: unknown;
}

export interface VisualProofPacket {
  schemaVersion?: unknown;
  packetType?: unknown;
  id?: unknown;
  coveredPaths?: unknown;
  contract?: unknown;
  baseline?: Record<string, unknown>;
  brief?: Record<string, unknown>;
  provenance?: Record<string, unknown>;
  target?: Record<string, unknown>;
  artifacts?: unknown;
  technicalReceipts?: unknown;
  visualIntegrityCritic?: Record<string, unknown>;
  statuses?: Record<string, unknown>;
  humanApproval?: Record<string, unknown>;
  telegram?: Record<string, unknown>;
  platformMatrix?: unknown;
}

export const VISUAL_QUALITY_CONTRACT_PATH = "docs/ai/VISUAL_MODEL_ANIMATION_QUALITY_GATE.md";
export const APPROVED_VISUAL_BASELINE_ID = "contact-v8-layered";

export const REQUIRED_RECEIPTS = [
  "schema-parse",
  "dimensions",
  "fps",
  "duration",
  "frame-count",
  "loop",
  "target-size",
  "codec-alpha",
  "supported-features",
  "bounds",
  "render-decode",
] as const;

export const REQUIRED_PLATFORMS = [
  "Web/Vite",
  "PWA",
  "Android/Capacitor",
  "iOS/WKWebView",
  "Desktop/Tauri",
  "Telegram/export",
  "Accessibility/reduced motion",
  "Performance",
  "Security/Privacy",
  "Testing",
  "Operations",
] as const;

export const REQUIRED_STATUSES = [
  "Technical",
  "Visual Runtime",
  "Artistic-Craft",
  "Motion",
  "Model",
  "Plan",
] as const;

export const CRITIC_DIMENSIONS = [
  "briefFit",
  "visualClarity",
  "craftNeatness",
  "modelIntegrity",
  "motionIntegrity",
  "styleMatch",
  "evidenceQuality",
  "templateAudit",
] as const;

export const STATUS_VALUES = new Set<StatusName>(["PASS", "FAIL", "UNVERIFIED", "SKIP"]);
export const HASH_PATTERN = /^[a-f0-9]{64}$/;

export function isRecord(value: unknown): value is Record<string, unknown> {
  return Boolean(value) && typeof value === "object" && !Array.isArray(value);
}

export function normalizeProofPath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

export function makeVisualProofViolation(
  file: string,
  rule: string,
  detail: string,
  severity: VisualProofViolation["severity"] = "HIGH"
): VisualProofViolation {
  return { file, line: 1, rule, detail, severity };
}

export function statusOf(value: unknown): StatusName | null {
  if (!isRecord(value) || !STATUS_VALUES.has(value.status as StatusName)) return null;
  return value.status as StatusName;
}
