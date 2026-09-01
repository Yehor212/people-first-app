import { lstatSync, readFileSync, realpathSync } from "node:fs";
import { isAbsolute, relative, resolve, sep } from "node:path";

import { validateProofArtifacts } from "./visual-quality-artifact-validator";
import {
  APPROVED_VISUAL_BASELINE_ID,
  CRITIC_DIMENSIONS,
  isRecord,
  makeVisualProofViolation as makeViolation,
  normalizeProofPath,
  REQUIRED_PLATFORMS,
  REQUIRED_RECEIPTS,
  REQUIRED_STATUSES,
  type StatusName,
  STATUS_VALUES,
  statusOf,
  type VisualProofPacket,
  type VisualProofViolation,
  VISUAL_QUALITY_CONTRACT_PATH,
} from "./visual-quality-proof-shared";

export type { VisualProofViolation } from "./visual-quality-proof-shared";

function readPacket(rootDir: string, packetPath: string): VisualProofPacket {
  const root = realpathSync(rootDir);
  const unresolved = resolve(packetPath);
  const stat = lstatSync(unresolved);
  const absolute = realpathSync(unresolved);
  if (absolute !== root && !absolute.startsWith(`${root}${sep}`)) {
    throw new Error("packet resolves outside the repository root");
  }
  if (!stat.isFile() || stat.isSymbolicLink())
    throw new Error("packet must be a regular non-symlink file");
  const parsed: unknown = JSON.parse(readFileSync(absolute, "utf8"));
  if (!isRecord(parsed)) throw new Error("packet root must be a JSON object");
  return parsed;
}

export function validateVisualProofPacket(
  rootDir: string,
  packetPath: string
): VisualProofViolation[] {
  const displayPath = normalizeProofPath(relative(rootDir, packetPath));
  const violations: VisualProofViolation[] = [];
  let packet: VisualProofPacket;
  try {
    packet = readPacket(rootDir, packetPath);
  } catch (error) {
    return [
      makeViolation(
        displayPath,
        "visual-proof-malformed",
        `Proof packet is unavailable or malformed: ${error instanceof Error ? error.message : String(error)}`,
        "CRITICAL"
      ),
    ];
  }

  if (
    packet.schemaVersion !== 1 ||
    !["approved-baseline", "candidate-proof"].includes(String(packet.packetType)) ||
    typeof packet.id !== "string" ||
    packet.id.length < 3 ||
    packet.contract !== VISUAL_QUALITY_CONTRACT_PATH
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-schema",
        "Packet identity or contract binding is invalid."
      )
    );
  }
  if (
    packet.baseline?.id !== APPROVED_VISUAL_BASELINE_ID ||
    packet.baseline?.comparisonRequired !== true
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-baseline",
        "Approved baseline comparison is required."
      )
    );
  }
  if (
    typeof packet.brief?.goal !== "string" ||
    !Array.isArray(packet.brief?.nonGoals) ||
    packet.brief.nonGoals.length === 0
  ) {
    violations.push(
      makeViolation(displayPath, "visual-proof-brief", "Brief goal and non-goals are required.")
    );
  }
  if (
    typeof packet.provenance?.classification !== "string" ||
    packet.provenance?.ownerAuthorization !== true ||
    !Array.isArray(packet.provenance?.evidence) ||
    !Array.isArray(packet.provenance?.limitations)
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-provenance",
        "Source provenance, authorization, evidence, and limitations are required."
      )
    );
  }
  const target = packet.target;
  if (
    !target ||
    typeof target.format !== "string" ||
    typeof target.deliveryProfile !== "string" ||
    [target.width, target.height, target.fps, target.frames, target.durationMs].some(
      (value) => !Number.isFinite(value) || Number(value) <= 0
    ) ||
    typeof target.loop !== "boolean" ||
    typeof target.codec !== "string" ||
    typeof target.alpha !== "boolean"
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-target",
        "Target format and measurable media facts are incomplete."
      )
    );
  } else if (
    Math.abs(Number(target.durationMs) - (Number(target.frames) / Number(target.fps)) * 1000) > 1
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-target",
        "Duration, frame count, and FPS are inconsistent."
      )
    );
  }

  const artifactValidation = validateProofArtifacts(
    rootDir,
    displayPath,
    packet.packetType,
    packet.artifacts,
    target
  );
  violations.push(...artifactValidation.violations);
  const { artifactsByRole } = artifactValidation;

  const receipts = Array.isArray(packet.technicalReceipts) ? packet.technicalReceipts : [];
  for (const check of REQUIRED_RECEIPTS) {
    const receipt = receipts.find((value) => isRecord(value) && value.check === check);
    if (
      !isRecord(receipt) ||
      !STATUS_VALUES.has(receipt.status as StatusName) ||
      typeof receipt.evidence !== "string" ||
      receipt.evidence.length === 0
    ) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-receipt",
          `Missing or invalid technical receipt: ${check}`
        )
      );
    }
  }

  const critic = packet.visualIntegrityCritic;
  const criticDimensions = isRecord(critic?.dimensions) ? critic.dimensions : {};
  if (
    !critic ||
    !STATUS_VALUES.has(critic.status as StatusName) ||
    typeof critic.reviewer !== "string" ||
    typeof critic.evidence !== "string" ||
    typeof critic.artifactRole !== "string"
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-critic",
        "A visual-integrity-critic report is required."
      )
    );
  } else if (artifactsByRole.get(critic.artifactRole)?.path !== critic.evidence) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-critic",
        "Visual-integrity-critic evidence must match its hash-bound artifact role."
      )
    );
  }
  for (const dimension of CRITIC_DIMENSIONS) {
    if (!STATUS_VALUES.has(criticDimensions[dimension] as StatusName)) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-critic",
          `Critic dimension is missing: ${dimension}`
        )
      );
    }
  }

  const statusMap = packet.statuses ?? {};
  for (const name of REQUIRED_STATUSES) {
    const row = statusMap[name];
    if (
      statusOf(row) === null ||
      !isRecord(row) ||
      typeof row.evidence !== "string" ||
      row.evidence.length === 0
    ) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-status",
          `Required status row is missing or invalid: ${name}`
        )
      );
    }
  }
  if (
    statusOf(statusMap.Technical) === "PASS" &&
    REQUIRED_RECEIPTS.some((check) =>
      receipts.every(
        (value) => !isRecord(value) || value.check !== check || value.status !== "PASS"
      )
    )
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-status",
        "Technical PASS requires every mandatory receipt to be PASS."
      )
    );
  }
  if (
    critic?.status === "PASS" &&
    CRITIC_DIMENSIONS.some((dimension) => criticDimensions[dimension] !== "PASS")
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-critic",
        "Critic PASS requires every critic dimension to be PASS."
      )
    );
  }
  const humanApproval = packet.humanApproval ?? {};
  const approvedDimensions = ["Artistic-Craft", "Motion", "Model"].filter(
    (name) => statusOf(statusMap[name]) === "PASS"
  );
  if (approvedDimensions.length > 0) {
    const role = humanApproval.approvedArtifactRole;
    const artifact = typeof role === "string" ? artifactsByRole.get(role) : undefined;
    const scope = Array.isArray(humanApproval.scope) ? humanApproval.scope : [];
    if (
      humanApproval.status !== "PASS" ||
      humanApproval.source !== "direct-user" ||
      !artifact ||
      humanApproval.artifactSha256 !== artifact.sha256 ||
      typeof humanApproval.statement !== "string" ||
      humanApproval.statement.length === 0 ||
      typeof humanApproval.reviewedOn !== "string" ||
      approvedDimensions.some((name) => !scope.includes(name))
    ) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-human-approval",
          "Artistic, motion, or model PASS requires direct artifact-hash-bound human approval."
        )
      );
    }
  }

  const compact = isRecord(packet.telegram?.compactDelivery) ? packet.telegram.compactDelivery : {};
  if (
    packet.telegram?.masterQualityArtifactRole !== "master" ||
    !STATUS_VALUES.has(compact.technicalStatus as StatusName) ||
    !STATUS_VALUES.has(compact.artisticParityStatus as StatusName) ||
    compact.humanApprovalInherited !== false ||
    typeof compact.reason !== "string"
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-scope",
        "Telegram master and compact delivery scopes must remain explicit and non-inherited."
      )
    );
  }
  if (compact.artisticParityStatus === "PASS") {
    const compactRole = compact.artifactRole;
    const separateApproval = isRecord(compact.humanApproval) ? compact.humanApproval : {};
    const compactArtifact =
      typeof compactRole === "string" ? artifactsByRole.get(compactRole) : undefined;
    if (
      !compactArtifact ||
      separateApproval.status !== "PASS" ||
      separateApproval.source !== "direct-user" ||
      separateApproval.artifactSha256 !== compactArtifact.sha256
    ) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-scope",
          "Compact Telegram artistic parity PASS needs its own artifact-bound human review."
        )
      );
    }
  }
  if (
    compact.technicalStatus === "PASS" &&
    (typeof compact.artifactRole !== "string" || !artifactsByRole.has(compact.artifactRole))
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-scope",
        "Compact Telegram technical PASS needs its own hash-bound artifact."
      )
    );
  }

  const platformRows = Array.isArray(packet.platformMatrix) ? packet.platformMatrix : [];
  for (const platform of REQUIRED_PLATFORMS) {
    const row = platformRows.find((value) => isRecord(value) && value.platform === platform);
    if (
      !isRecord(row) ||
      !STATUS_VALUES.has(row.status as StatusName) ||
      typeof row.evidence !== "string" ||
      row.evidence.length === 0
    ) {
      violations.push(
        makeViolation(
          displayPath,
          "visual-proof-platform",
          `Platform/domain row is missing or invalid: ${platform}`
        )
      );
    }
  }
  if (
    packet.packetType === "candidate-proof" &&
    (!Array.isArray(packet.coveredPaths) || packet.coveredPaths.length === 0)
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-coverage",
        "Candidate packet must identify at least one governed artifact path."
      )
    );
  } else if (
    Array.isArray(packet.coveredPaths) &&
    (new Set(packet.coveredPaths).size !== packet.coveredPaths.length ||
      packet.coveredPaths.some(
        (value) =>
          typeof value !== "string" || isAbsolute(value) || value.split(/[\\/]/).includes("..")
      ))
  ) {
    violations.push(
      makeViolation(
        displayPath,
        "visual-proof-coverage",
        "Covered paths must be unique repository-relative paths."
      )
    );
  }

  return violations;
}
