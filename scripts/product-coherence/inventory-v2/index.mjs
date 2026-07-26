import { createHash } from "node:crypto";

import { SUBJECT_IDS } from "../schemas.mjs";
import { INVENTORY_V2_SCHEMA_VERSION, INVENTORY_V2_LIMITS } from "./constants.mjs";
import { enumerateFactsFromFiles, summarizeFacts } from "./enumerators.mjs";
import { collectSafeInventoryFiles, compareText } from "./safe-fs.mjs";

export async function enumerateProductCoherenceInventory({ rootDirectory, subjectId, limits } = {}) {
  if (!SUBJECT_IDS.includes(subjectId)) {
    throw new Error(`inventory-v2 subject must be one of ${SUBJECT_IDS.join(", ")}`);
  }
  if (typeof rootDirectory !== "string" || rootDirectory.length === 0) {
    throw new Error("inventory-v2 rootDirectory is required");
  }
  const files = await collectSafeInventoryFiles(rootDirectory, normalizeLimits(limits));
  const candidates = enumerateFactsFromFiles(files).map((fact) => ({
    candidateId: candidateIdFor(subjectId, fact),
    subjectId,
    ...fact,
  }));
  candidates.sort((left, right) => compareText(left.candidateId, right.candidateId));
  if (candidates.length > (limits?.maxCandidates ?? INVENTORY_V2_LIMITS.maxCandidates)) {
    throw new Error("inventory-v2 candidate limit exceeded");
  }
  return {
    schemaVersion: INVENTORY_V2_SCHEMA_VERSION,
    subjectId,
    candidates,
    summary: summarizeFacts(candidates),
  };
}

export function candidateIdFor(subjectId, fact) {
  const digest = createHash("sha256")
    .update(`${subjectId}\u0000${fact.enumerator}\u0000${fact.type}\u0000${fact.path}\u0000${fact.symbol}`)
    .digest("hex");
  return `pci2-${digest}`;
}

function normalizeLimits(limits) {
  if (limits === undefined) return INVENTORY_V2_LIMITS;
  if (!limits || typeof limits !== "object") throw new Error("inventory-v2 limits must be an object");
  const normalized = { ...INVENTORY_V2_LIMITS };
  for (const key of Object.keys(INVENTORY_V2_LIMITS)) {
    if (limits[key] === undefined) continue;
    if (!Number.isSafeInteger(limits[key]) || limits[key] <= 0) {
      throw new Error(`inventory-v2 ${key} must be a positive safe integer`);
    }
    normalized[key] = limits[key];
  }
  return normalized;
}
