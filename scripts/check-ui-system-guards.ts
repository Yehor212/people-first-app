#!/usr/bin/env npx tsx

import * as fs from "node:fs";
import * as path from "node:path";
import { pathToFileURL } from "node:url";

import {
  checkContainment,
  inferMaterialComponentTags,
  normalizeUiGuardPath,
  type UiGuardFinding,
  type UiGuardInput,
} from "./ui-system-rules/containment";
import { checkMaterialOverload } from "./ui-system-rules/material-overload";
import { checkLayering } from "./ui-system-rules/layering";
import { checkTokenDrift } from "./ui-system-rules/token-drift";

export type { UiGuardFinding } from "./ui-system-rules/containment";

export interface UiGuardBaselineEntry {
  fingerprint: string;
  path: string;
  rule: string;
  rationale: string;
  owner: string;
  reviewDate: string;
  removalCondition: string;
}

export interface UiGuardBaseline {
  schemaVersion: 1;
  entries: UiGuardBaselineEntry[];
}

interface BaselinePartition {
  newFindings: UiGuardFinding[];
  baselinedFindings: UiGuardFinding[];
  staleBaselineEntries: UiGuardBaselineEntry[];
}

const BASELINE_ENTRY_KEYS = [
  "fingerprint",
  "owner",
  "path",
  "rationale",
  "removalCondition",
  "reviewDate",
  "rule",
].sort();
const SUPPORTED_RULES = new Set([
  "containment",
  "layering",
  "material-overload",
  "token-drift",
]);

function assertNonEmptyString(value: unknown, field: string, index: number): asserts value is string {
  if (typeof value !== "string" || value.trim() === "") {
    throw new Error(`UI-system baseline entry ${index} has an invalid ${field}`);
  }
}

export function validateBaseline(value: unknown): UiGuardBaseline {
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("UI-system baseline must be an object");
  }
  const candidate = value as Record<string, unknown>;
  if (candidate.schemaVersion !== 1 || !Array.isArray(candidate.entries)) {
    throw new Error("UI-system baseline must use schemaVersion 1 with an entries array");
  }
  const topLevelKeys = Object.keys(candidate).sort();
  if (JSON.stringify(topLevelKeys) !== JSON.stringify(["entries", "schemaVersion"])) {
    throw new Error("UI-system baseline contains unsupported top-level fields");
  }

  const seenFingerprints = new Set<string>();
  const entries = candidate.entries.map((rawEntry, index) => {
    if (!rawEntry || typeof rawEntry !== "object" || Array.isArray(rawEntry)) {
      throw new Error(`UI-system baseline entry ${index} must be an object`);
    }
    const entry = rawEntry as Record<string, unknown>;
    if (JSON.stringify(Object.keys(entry).sort()) !== JSON.stringify(BASELINE_ENTRY_KEYS)) {
      throw new Error(`UI-system baseline entry ${index} must contain exact review metadata`);
    }

    assertNonEmptyString(entry.fingerprint, "fingerprint", index);
    assertNonEmptyString(entry.path, "path", index);
    assertNonEmptyString(entry.rule, "rule", index);
    assertNonEmptyString(entry.rationale, "rationale", index);
    assertNonEmptyString(entry.owner, "owner", index);
    assertNonEmptyString(entry.reviewDate, "reviewDate", index);
    assertNonEmptyString(entry.removalCondition, "removalCondition", index);

    if (!/^[a-f0-9]{64}$/.test(entry.fingerprint)) {
      throw new Error(`UI-system baseline entry ${index} has an invalid fingerprint`);
    }
    if (normalizeUiGuardPath(entry.path) !== entry.path || !entry.path.startsWith("src/")) {
      throw new Error(`UI-system baseline entry ${index} has a non-canonical path`);
    }
    if (!SUPPORTED_RULES.has(entry.rule)) {
      throw new Error(`UI-system baseline entry ${index} has an unsupported rule`);
    }
    if (!/^\d{4}-\d{2}-\d{2}$/.test(entry.reviewDate)) {
      throw new Error(`UI-system baseline entry ${index} has an invalid reviewDate`);
    }
    const parsedReviewDate = new Date(`${entry.reviewDate}T00:00:00Z`);
    if (
      Number.isNaN(parsedReviewDate.getTime()) ||
      parsedReviewDate.toISOString().slice(0, 10) !== entry.reviewDate
    ) {
      throw new Error(`UI-system baseline entry ${index} has an invalid reviewDate`);
    }
    if (seenFingerprints.has(entry.fingerprint)) {
      throw new Error(`UI-system baseline contains duplicate fingerprint ${entry.fingerprint}`);
    }
    seenFingerprints.add(entry.fingerprint);

    return {
      fingerprint: entry.fingerprint,
      path: entry.path,
      rule: entry.rule,
      rationale: entry.rationale,
      owner: entry.owner,
      reviewDate: entry.reviewDate,
      removalCondition: entry.removalCondition,
    };
  });

  entries.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.rule.localeCompare(right.rule) ||
      left.fingerprint.localeCompare(right.fingerprint)
  );
  return { schemaVersion: 1, entries };
}

export function shouldScanUiFile(filePath: string): boolean {
  const normalized = normalizeUiGuardPath(filePath);
  if (!/\.(?:jsx|tsx)$/.test(normalized)) return false;
  if (!normalized.startsWith("src/")) return false;
  if (
    /(?:^|\/)(?:__tests__|__fixtures__|fixtures|generated|dev)(?:\/|$)/.test(normalized) ||
    /\.(?:spec|test)\.[jt]sx$/.test(normalized) ||
    /\.(?:recovery-copy|bak|orig)\.[jt]sx$/.test(normalized) ||
    normalized.startsWith("src/lib/data-visualization/") ||
    normalized.startsWith("src/assets/canonical/")
  ) {
    return false;
  }
  return true;
}

function walkUiFiles(repositoryRoot: string): UiGuardInput[] {
  const srcRoot = path.join(repositoryRoot, "src");
  const files: UiGuardInput[] = [];

  const walk = (directory: string) => {
    for (const entry of fs.readdirSync(directory, { withFileTypes: true })) {
      const absolutePath = path.join(directory, entry.name);
      if (entry.isDirectory()) {
        walk(absolutePath);
        continue;
      }
      const relativePath = normalizeUiGuardPath(path.relative(repositoryRoot, absolutePath));
      if (!shouldScanUiFile(relativePath)) continue;
      files.push({
        path: relativePath,
        source: fs.readFileSync(absolutePath, "utf8"),
      });
    }
  };

  walk(srcRoot);
  return files.sort((left, right) => left.path.localeCompare(right.path));
}

export function collectUiGuardFindings(files: UiGuardInput[]): UiGuardFinding[] {
  const materialComponentTags = inferMaterialComponentTags(files);
  const findings = files.flatMap((file) => [
    ...checkContainment({ ...file, materialComponentTags }),
    ...checkLayering(file),
    ...checkMaterialOverload(file),
    ...checkTokenDrift(file),
  ]);
  return findings.sort(
    (left, right) =>
      left.path.localeCompare(right.path) ||
      left.line - right.line ||
      left.rule.localeCompare(right.rule) ||
      left.fingerprint.localeCompare(right.fingerprint)
  );
}

export function partitionBaseline(
  findings: UiGuardFinding[],
  baseline: UiGuardBaseline
): BaselinePartition {
  const findingsByFingerprint = new Map(
    findings.map((finding) => [finding.fingerprint, finding] as const)
  );
  const baselineByFingerprint = new Map(
    baseline.entries.map((entry) => [entry.fingerprint, entry] as const)
  );

  const baselinedFindings = findings.filter((finding) => {
    const entry = baselineByFingerprint.get(finding.fingerprint);
    return Boolean(
      entry &&
        entry.path === finding.path &&
        entry.rule === finding.rule &&
        entry.rationale === finding.rationale
    );
  });
  const baselinedFingerprints = new Set(
    baselinedFindings.map((finding) => finding.fingerprint)
  );
  const newFindings = findings.filter(
    (finding) => !baselinedFingerprints.has(finding.fingerprint)
  );
  const staleBaselineEntries = baseline.entries.filter((entry) => {
    const finding = findingsByFingerprint.get(entry.fingerprint);
    return (
      !finding ||
      finding.path !== entry.path ||
      finding.rule !== entry.rule ||
      finding.rationale !== entry.rationale
    );
  });

  return { newFindings, baselinedFindings, staleBaselineEntries };
}

function buildReport(findings: UiGuardFinding[], baseline: UiGuardBaseline) {
  const partition = partitionBaseline(findings, baseline);
  return {
    schemaVersion: 1,
    mode: "report-only" as const,
    summary: {
      total: findings.length,
      high: findings.filter((finding) => finding.severity === "high").length,
      medium: findings.filter((finding) => finding.severity === "medium").length,
      low: findings.filter((finding) => finding.severity === "low").length,
      new: partition.newFindings.length,
      baselined: partition.baselinedFindings.length,
      staleBaseline: partition.staleBaselineEntries.length,
    },
    findings: findings.map((finding) => ({
      ...finding,
      baselineStatus: partition.baselinedFindings.some(
        (baselined) => baselined.fingerprint === finding.fingerprint
      )
        ? ("reviewed-existing" as const)
        : ("new" as const),
    })),
    staleBaselineEntries: partition.staleBaselineEntries,
  };
}

export function renderUiGuardJson(
  findings: UiGuardFinding[],
  baseline: UiGuardBaseline
): string {
  return `${JSON.stringify(buildReport(findings, baseline), null, 2)}\n`;
}

export function renderUiGuardHumanReport(
  findings: UiGuardFinding[],
  baseline: UiGuardBaseline
): string {
  const report = buildReport(findings, baseline);
  const lines = [
    "ZENFLOW UI-SYSTEM GUARD REPORT",
    "MODE: report-only (no CI blocking decision)",
    `TOTAL: ${report.summary.total} | HIGH: ${report.summary.high} | MEDIUM: ${report.summary.medium} | LOW: ${report.summary.low}`,
    `NEW: ${report.summary.new} | REVIEWED EXISTING: ${report.summary.baselined} | STALE BASELINE: ${report.summary.staleBaseline}`,
    "",
  ];

  for (const finding of report.findings) {
    lines.push(
      `[${finding.severity.toUpperCase()}] ${finding.rule} ${finding.path}:${finding.line}`,
      `  fingerprint: ${finding.fingerprint}`,
      `  baseline: ${finding.baselineStatus}`,
      `  rationale: ${finding.rationale}`
    );
  }
  if (report.staleBaselineEntries.length > 0) {
    lines.push("", "STALE BASELINE ENTRIES");
    for (const entry of report.staleBaselineEntries) {
      lines.push(`  ${entry.rule} ${entry.path} ${entry.fingerprint}`);
    }
  }
  lines.push("", "REPORT_ONLY: findings remain visible but do not set a blocking exit code.");
  return `${lines.join("\n")}\n`;
}

function readBaseline(baselinePath: string): UiGuardBaseline {
  return validateBaseline(JSON.parse(fs.readFileSync(baselinePath, "utf8")));
}

export function runUiSystemGuardCli(argv = process.argv.slice(2)): number {
  const repositoryRoot = process.cwd();
  if (argv.includes("--baseline")) {
    throw new Error(
      "UI-system guard does not accept --baseline; it uses config/ui-system-guard-baseline.json"
    );
  }
  const formatIndex = argv.indexOf("--format");
  const format = formatIndex >= 0 ? argv[formatIndex + 1] : "human";
  if (format !== "human" && format !== "json") {
    throw new Error("UI-system guard --format must be human or json");
  }
  const baselinePath = path.join(repositoryRoot, "config/ui-system-guard-baseline.json");

  const findings = collectUiGuardFindings(walkUiFiles(repositoryRoot));
  const baseline = readBaseline(baselinePath);
  const output =
    format === "json"
      ? renderUiGuardJson(findings, baseline)
      : renderUiGuardHumanReport(findings, baseline);
  process.stdout.write(output);
  return 0;
}

const isDirectExecution =
  typeof process.argv[1] === "string" &&
  import.meta.url === pathToFileURL(path.resolve(process.argv[1])).href;

if (isDirectExecution) {
  try {
    process.exitCode = runUiSystemGuardCli();
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    process.stderr.write(`UI_SYSTEM_GUARD_INTERNAL_ERROR: ${message}\n`);
    process.exitCode = 2;
  }
}
