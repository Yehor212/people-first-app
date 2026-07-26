import { ENUMERATOR_IDS } from "../inventory-v2/constants.mjs";
import { addError, isObject, nonBlank, validateReconciliationInput } from "./schemas.mjs";

export function reconcileInventoryCandidates(input) {
  const validation = validateReconciliationInput(input);
  const errors = [...validation.errors];
  if (!validation.inventory) return { ok: false, errors, rows: [] };

  const { inventory, candidateById } = validation;
  const capabilities = indexCapabilities(input.capabilities, inventory.subjectId, errors);
  const evidence = indexEvidence(input.evidence, inventory.subjectId, errors);
  const classifications = new Map();
  classifyCapabilityMappings(
    input.capabilityMappings,
    inventory.subjectId,
    candidateById,
    capabilities,
    classifications,
    errors,
  );
  classifyExclusions(input.exclusions, inventory.subjectId, candidateById, evidence, classifications, errors);

  for (const candidate of candidateById.values()) {
    if (!classifications.has(candidate.candidateId)) {
      addError(errors, `candidate ${candidate.candidateId} is unclassified`);
    }
  }
  const rows = buildRows(inventory.subjectId, candidateById, classifications);
  return {
    ok: errors.length === 0 && rows.every((row) => row.unclassifiedCandidateCount === 0),
    errors,
    rows,
  };
}

export function assertInventoryClosure(reconciliation) {
  if (!reconciliation?.ok) {
    const detail = reconciliation?.errors?.join("; ") || "unknown reconciliation failure";
    throw new Error(`inventory reconciliation is not closed: ${detail}`);
  }
  if (reconciliation.rows.some((row) => row.unclassifiedCandidateCount !== 0)) {
    throw new Error("inventory reconciliation is not closed: unclassified candidates remain");
  }
  return reconciliation;
}

export function reconcileInventorySet(input) {
  if (!isObject(input) || !Array.isArray(input.inventories)) {
    return { ok: false, errors: ["reconciliation set requires an inventories array"], rows: [] };
  }
  const errors = [];
  const rows = [];
  const seenSubjects = new Set();
  for (const inventory of input.inventories) {
    const subjectId = inventory?.subjectId;
    if (!nonBlank(subjectId)) {
      addError(errors, "reconciliation set contains an inventory without a subjectId");
      continue;
    }
    if (seenSubjects.has(subjectId)) {
      addError(errors, `reconciliation set contains duplicate inventory subject ${subjectId}`);
      continue;
    }
    seenSubjects.add(subjectId);
    const result = reconcileInventoryCandidates({
      inventory,
      capabilities: selectSubjectRows(input.capabilities, subjectId),
      evidence: selectSubjectRows(input.evidence, subjectId),
      capabilityMappings: selectSubjectRows(input.capabilityMappings, subjectId),
      exclusions: selectSubjectRows(input.exclusions, subjectId),
    });
    rows.push(...result.rows);
    for (const error of result.errors) addError(errors, `${subjectId}: ${error}`);
  }
  return { ok: errors.length === 0 && rows.every((row) => row.unclassifiedCandidateCount === 0), errors, rows };
}

function selectSubjectRows(rows, subjectId) {
  return Array.isArray(rows) ? rows.filter((row) => row?.subjectId === subjectId) : rows;
}

function indexCapabilities(capabilities, subjectId, errors) {
  const indexed = new Set();
  if (!Array.isArray(capabilities)) {
    addError(errors, "reconciliation capabilities must be an array");
    return indexed;
  }
  for (const capability of capabilities) {
    if (!isObject(capability) || !nonBlank(capability.capabilityId) || !nonBlank(capability.subjectId)) {
      addError(errors, "capability mapping target must provide subjectId and capabilityId");
      continue;
    }
    if (capability.subjectId !== subjectId) {
      addError(errors, `capability ${capability.capabilityId} is not in the inventory subject`);
      continue;
    }
    indexed.add(capability.capabilityId);
  }
  return indexed;
}

function indexEvidence(evidence, subjectId, errors) {
  const indexed = new Set();
  if (!Array.isArray(evidence)) {
    addError(errors, "reconciliation evidence must be an array");
    return indexed;
  }
  for (const record of evidence) {
    if (!isObject(record) || !nonBlank(record.evidenceId) || !nonBlank(record.subjectId)) {
      addError(errors, "reconciliation evidence record must provide subjectId and evidenceId");
      continue;
    }
    if (record.subjectId !== subjectId) continue;
    indexed.add(record.evidenceId);
  }
  return indexed;
}

function classifyCapabilityMappings(mappings, subjectId, candidates, capabilities, classifications, errors) {
  if (!Array.isArray(mappings)) {
    addError(errors, "capabilityMappings must be an array");
    return;
  }
  for (const mapping of mappings) {
    if (!isObject(mapping) || !nonBlank(mapping.candidateId) || !nonBlank(mapping.capabilityId) || !nonBlank(mapping.subjectId)) {
      addError(errors, "capability mapping must provide subjectId, candidateId, and capabilityId");
      continue;
    }
    if (mapping.subjectId !== subjectId) {
      addError(errors, `capability mapping for ${mapping.candidateId} must use the candidate subject`);
      continue;
    }
    if (!candidates.has(mapping.candidateId)) {
      addError(errors, `capability mapping references unknown candidate ${mapping.candidateId}`);
      continue;
    }
    if (!capabilities.has(mapping.capabilityId)) {
      addError(errors, `capability mapping references missing same-subject capability ${mapping.capabilityId}`);
      continue;
    }
    classify(mapping.candidateId, "CAPABILITY", classifications, errors);
  }
}

function classifyExclusions(exclusions, subjectId, candidates, evidence, classifications, errors) {
  if (!Array.isArray(exclusions)) {
    addError(errors, "exclusions must be an array");
    return;
  }
  for (const exclusion of exclusions) {
    if (!isObject(exclusion) || !nonBlank(exclusion.candidateId) || !nonBlank(exclusion.subjectId)) {
      addError(errors, "exclusion must provide subjectId and candidateId");
      continue;
    }
    if (exclusion.subjectId !== subjectId) {
      addError(errors, `exclusion for ${exclusion.candidateId} must use the candidate subject`);
      continue;
    }
    if (!candidates.has(exclusion.candidateId)) {
      addError(errors, `exclusion references unknown candidate ${exclusion.candidateId}`);
      continue;
    }
    if (!nonBlank(exclusion.reason) || !Array.isArray(exclusion.evidenceIds) || exclusion.evidenceIds.length === 0 || !exclusion.evidenceIds.every(nonBlank)) {
      addError(errors, `exclusion for ${exclusion.candidateId} requires a reason and evidence IDs`);
      continue;
    }
    for (const evidenceId of exclusion.evidenceIds) {
      if (!evidence.has(evidenceId)) {
        addError(errors, `exclusion for ${exclusion.candidateId} references missing same-subject evidence ${evidenceId}`);
      }
    }
    if (!exclusion.evidenceIds.every((evidenceId) => evidence.has(evidenceId))) continue;
    classify(exclusion.candidateId, "EXCLUSION", classifications, errors);
  }
}

function classify(candidateId, kind, classifications, errors) {
  if (classifications.has(candidateId)) {
    addError(errors, `candidate ${candidateId} is classified more than once`);
    return;
  }
  classifications.set(candidateId, kind);
}

function buildRows(subjectId, candidates, classifications) {
  return ENUMERATOR_IDS.map((enumerator) => {
    const forEnumerator = [...candidates.values()].filter((candidate) => candidate.enumerator === enumerator);
    let capabilityMappedCount = 0;
    let excludedCandidateCount = 0;
    let unclassifiedCandidateCount = 0;
    for (const candidate of forEnumerator) {
      const classification = classifications.get(candidate.candidateId);
      if (classification === "CAPABILITY") capabilityMappedCount += 1;
      else if (classification === "EXCLUSION") excludedCandidateCount += 1;
      else unclassifiedCandidateCount += 1;
    }
    return {
      subjectId,
      enumerator,
      candidateCount: forEnumerator.length,
      capabilityMappedCount,
      excludedCandidateCount,
      unclassifiedCandidateCount,
    };
  });
}
