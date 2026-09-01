import { execFileSync } from "node:child_process";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { extname, resolve } from "node:path";

import {
  APPROVED_VISUAL_BASELINE_ID,
  type VisualProofViolation,
  VISUAL_QUALITY_CONTRACT_PATH,
} from "./visual-quality-proof-shared";
import { validateVisualProofPacket } from "./visual-quality-proof-gate";

const SCHEMA_PATH = "docs/ai/visual-quality/visual-proof-packet.schema.json";
const BASELINE_PATH = "docs/ai/visual-quality/approved-baselines/contact-v8-layered.json";
const PROOFS_DIR = "docs/ai/visual-quality/proofs";
const APPROVAL_STATEMENT =
  "Превосходно. Я полностью одобряю эту модель и анимацию. Впредь все модели и анимации ZenFlow должны делаться в таком же или более высоком качестве.";

const APPROVED_BASELINE = Object.freeze({
  master: Object.freeze({
    path: "/Users/yehor/.codex/visualizations/2026/08/30/people-first-bedtime-organic-v3/out/contact-v8-layered/bedtime-bear-contact-v8-layered-master.tgs",
    sha256: "1d9ec0fe08bbeea17e2a513e54e2abf10054e6ac861f1390ff9c712556508a9a",
    bytes: 3270243,
    portable: false,
  }),
  preview: Object.freeze({
    path: "docs/ai/visual-quality/evidence/contact-v8-layered-preview.mp4",
    sha256: "53f357a59b6ae64018ba9ec02da889f366428caa7e6a788d5dbdecc7f32f0ee5",
    bytes: 275932,
    portable: true,
  }),
  frameBoard: Object.freeze({
    path: "docs/ai/visual-quality/evidence/contact-v8-layered-contact-sheet.png",
    sha256: "cffe1c1e101ff8f6fcc916e8920778558bcfd81787ae1efec2635b2aa63da107",
    bytes: 900996,
    portable: true,
  }),
  criticReport: Object.freeze({
    path: "docs/ai/visual-quality/approved-baselines/contact-v8-layered-critic.md",
    sha256: "ef3b89fe7591b5a38c284c568a1d7ca25cfc883e5777e75f75249badaddcdbab",
    bytes: 5176,
    portable: true,
  }),
});

function normalizePath(value: string): string {
  return value.replace(/\\/g, "/").replace(/^\.\//, "");
}

function violation(
  file: string,
  rule: string,
  detail: string,
  severity: VisualProofViolation["severity"] = "HIGH"
): VisualProofViolation {
  return { file, line: 1, rule, detail, severity };
}

function readJsonObject(file: string): Record<string, unknown> {
  const value: unknown = JSON.parse(readFileSync(file, "utf8"));
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    throw new Error("JSON root must be an object");
  }
  return value as Record<string, unknown>;
}

export function findUncoveredGovernedVisualPaths(
  changedPaths: string[],
  coveredPaths: Set<string>
): string[] {
  const governedExtensions = new Set([
    ".tgs",
    ".lottie",
    ".riv",
    ".glb",
    ".gltf",
    ".fbx",
    ".usdz",
    ".mp4",
    ".webm",
    ".mov",
    ".apng",
    ".gif",
  ]);
  return changedPaths
    .map(normalizePath)
    .filter((file) => {
      if (
        file.startsWith("docs/ai/visual-quality/") ||
        file.includes("/__tests__/") ||
        /\.(?:test|spec)\.[^.]+$/.test(file)
      ) {
        return false;
      }
      const extension = extname(file).toLowerCase();
      const generatedStill =
        [".png", ".jpg", ".jpeg", ".webp", ".svg"].includes(extension) &&
        /(?:animation|motion|model|sticker|generated|render|lottie|tgs|3d)/i.test(file);
      return (
        (governedExtensions.has(extension) ||
          file.toLowerCase().endsWith(".lottie.json") ||
          generatedStill) &&
        !coveredPaths.has(file)
      );
    })
    .sort();
}

function gitChangedPaths(rootDir: string): string[] {
  const run = (args: string[]) =>
    execFileSync("git", args, { cwd: rootDir, encoding: "utf8" }).split(/\r?\n/).filter(Boolean);
  const result = new Set<string>();
  const configuredBase = process.env.ZENFLOW_VISUAL_BASE_SHA;
  if (configuredBase) {
    if (!/^[a-f0-9]{7,40}$/i.test(configuredBase) || /^0+$/.test(configuredBase)) {
      throw new Error("ZENFLOW_VISUAL_BASE_SHA is not a usable Git object id");
    }
    run(["diff", "--diff-filter=ACMRTUXB", "--name-only", `${configuredBase}...HEAD`]).forEach(
      (file) => result.add(file)
    );
  } else {
    const base = execFileSync("git", ["merge-base", "origin/main", "HEAD"], {
      cwd: rootDir,
      encoding: "utf8",
    }).trim();
    run(["diff", "--diff-filter=ACMRTUXB", "--name-only", `${base}...HEAD`]).forEach((file) =>
      result.add(file)
    );
  }
  run(["diff", "--diff-filter=ACMRTUXB", "--name-only"]).forEach((file) => result.add(file));
  run(["diff", "--cached", "--diff-filter=ACMRTUXB", "--name-only"]).forEach((file) =>
    result.add(file)
  );
  run(["ls-files", "--others", "--exclude-standard"]).forEach((file) => result.add(file));
  return [...result];
}

function validateSchema(rootDir: string): VisualProofViolation[] {
  try {
    const schema = readJsonObject(resolve(rootDir, SCHEMA_PATH));
    const required = Array.isArray(schema.required) ? schema.required : [];
    if (
      schema.$schema !== "https://json-schema.org/draft/2020-12/schema" ||
      schema.type !== "object" ||
      !required.includes("humanApproval") ||
      !required.includes("platformMatrix")
    ) {
      throw new Error("schema identity or required proof fields drifted");
    }
    return [];
  } catch (error) {
    return [
      violation(
        SCHEMA_PATH,
        "visual-proof-schema",
        `Proof schema is unavailable or malformed: ${error instanceof Error ? error.message : String(error)}`,
        "CRITICAL"
      ),
    ];
  }
}

export function validateApprovedVisualBaseline(rootDir: string): VisualProofViolation[] {
  const baselineAbsolute = resolve(rootDir, BASELINE_PATH);
  const violations = validateVisualProofPacket(rootDir, baselineAbsolute);
  if (violations.length > 0) return violations;
  try {
    const packet = readJsonObject(baselineAbsolute);
    const artifacts = Array.isArray(packet.artifacts)
      ? (packet.artifacts as Array<Record<string, unknown>>)
      : [];
    const byRole = new Map(artifacts.map((artifact) => [String(artifact.role), artifact]));
    const exact = [
      ["master", APPROVED_BASELINE.master],
      ["preview", APPROVED_BASELINE.preview],
      ["frame-board", APPROVED_BASELINE.frameBoard],
      ["critic-report", APPROVED_BASELINE.criticReport],
    ] as const;
    const statuses = packet.statuses as Record<string, Record<string, unknown>> | undefined;
    const approval = packet.humanApproval as Record<string, unknown> | undefined;
    const telegram = packet.telegram as Record<string, Record<string, unknown>> | undefined;
    const scope = Array.isArray(approval?.scope) ? approval.scope : [];
    const expectedScope = ["Artistic-Craft", "Motion", "Model"];
    if (
      packet.id !== APPROVED_VISUAL_BASELINE_ID ||
      exact.some(([role, expected]) => {
        const actual = byRole.get(role);
        return Object.entries(expected).some(([key, value]) => actual?.[key] !== value);
      }) ||
      statuses?.["Artistic-Craft"]?.status !== "PASS" ||
      statuses?.Motion?.status !== "PASS" ||
      statuses?.Model?.status !== "PASS" ||
      statuses?.["Visual Runtime"]?.status !== "UNVERIFIED" ||
      approval?.source !== "direct-user" ||
      approval?.approvedArtifactRole !== "preview" ||
      approval?.artifactSha256 !== APPROVED_BASELINE.preview.sha256 ||
      approval?.statement !== APPROVAL_STATEMENT ||
      scope.length !== expectedScope.length ||
      expectedScope.some((name) => !scope.includes(name)) ||
      telegram?.compactDelivery?.artisticParityStatus !== "UNVERIFIED" ||
      telegram?.compactDelivery?.humanApprovalInherited !== false
    ) {
      return [
        violation(
          BASELINE_PATH,
          "visual-proof-baseline-drift",
          "Approved contact-v8-layered trust anchor or approval scope drifted.",
          "CRITICAL"
        ),
      ];
    }
    return [];
  } catch (error) {
    return [
      violation(
        BASELINE_PATH,
        "visual-proof-baseline-drift",
        `Approved baseline cannot be inspected: ${error instanceof Error ? error.message : String(error)}`,
        "CRITICAL"
      ),
    ];
  }
}

export function validateRepositoryVisualQualityGate(rootDir: string): VisualProofViolation[] {
  const violations: VisualProofViolation[] = [];
  for (const requiredPath of [VISUAL_QUALITY_CONTRACT_PATH, SCHEMA_PATH, BASELINE_PATH]) {
    if (!existsSync(resolve(rootDir, requiredPath))) {
      violations.push(
        violation(
          requiredPath,
          "visual-proof-routing",
          `Required visual quality contract file is missing: ${requiredPath}`,
          "CRITICAL"
        )
      );
    }
  }
  for (const route of [
    "AGENTS.md",
    "docs/ai/VISUAL_INTEGRITY_CRITIC_PROTOCOL.md",
    "scripts/rag/corpus-manifest.json",
  ]) {
    const absolute = resolve(rootDir, route);
    if (
      !existsSync(absolute) ||
      !readFileSync(absolute, "utf8").includes(VISUAL_QUALITY_CONTRACT_PATH)
    ) {
      violations.push(
        violation(
          route,
          "visual-proof-routing",
          `Routing must reference ${VISUAL_QUALITY_CONTRACT_PATH}.`
        )
      );
    }
  }
  if (existsSync(resolve(rootDir, SCHEMA_PATH))) violations.push(...validateSchema(rootDir));
  if (existsSync(resolve(rootDir, BASELINE_PATH))) {
    violations.push(...validateApprovedVisualBaseline(rootDir));
  }

  const coveredPaths = new Set<string>();
  const proofsAbsolute = resolve(rootDir, PROOFS_DIR);
  if (existsSync(proofsAbsolute)) {
    for (const name of readdirSync(proofsAbsolute).filter((entry) => entry.endsWith(".json"))) {
      const proofPath = resolve(proofsAbsolute, name);
      const proofViolations = validateVisualProofPacket(rootDir, proofPath);
      violations.push(...proofViolations);
      if (proofViolations.length === 0) {
        const packet = readJsonObject(proofPath);
        if (Array.isArray(packet.coveredPaths)) {
          packet.coveredPaths
            .filter((value): value is string => typeof value === "string")
            .map(normalizePath)
            .forEach((value) => coveredPaths.add(value));
        }
      }
    }
  }
  try {
    for (const uncovered of findUncoveredGovernedVisualPaths(
      gitChangedPaths(rootDir),
      coveredPaths
    )) {
      violations.push(
        violation(
          uncovered,
          "visual-proof-missing-packet",
          "Changed model, animation, sticker, or generated visual asset is not covered by a valid proof packet.",
          "CRITICAL"
        )
      );
    }
  } catch (error) {
    violations.push(
      violation(
        ".git",
        "visual-proof-change-scope",
        `Cannot establish changed visual asset scope: ${error instanceof Error ? error.message : String(error)}`,
        "CRITICAL"
      )
    );
  }
  return violations;
}
