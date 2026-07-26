import { PRODUCT_DISPOSITIONS, SUBJECT_IDS } from "./schemas.mjs";

const MAX_RECORDS = 100_000;
const MAX_REFERENCES = 32;
const MAX_TRIGGERS = 16;
const DIRECT_EVIDENCE_CLASSES = new Set([
  "AUTHORITATIVE_EXTERNAL",
  "DIRECT_LOCAL",
  "DIRECT_RUNTIME",
  "HUMAN_RESEARCH",
]);
const SAFE_ID = /^[A-Za-z0-9][A-Za-z0-9._:-]{0,127}$/u;

const MAPPED_FIELDS = new Set([
  "candidateId",
  "subjectId",
  "outcome",
  "capabilityIds",
  "evidenceIds",
]);
const EXCLUDED_FIELDS = new Set([
  "candidateId",
  "subjectId",
  "outcome",
  "reason",
  "evidenceIds",
  "reviewer",
  "owner",
  "invalidationTriggers",
]);
const BLOCKED_FIELDS = new Set([
  "candidateId",
  "subjectId",
  "outcome",
  "blocker",
  "owner",
  "evidenceIds",
]);

export const EXCLUSION_REASONS = Object.freeze([
  "AUDIT_INFRASTRUCTURE",
  "DUPLICATE_REFERENCE",
  "GENERATED_DERIVATIVE",
  "PRIVACY_REDACTED_UNVERIFIED",
  "TEST_OR_FIXTURE_ONLY",
  "THIRD_PARTY_MANAGED",
]);

export function validateInventoryReconciliation(input) {
  const errors = new Set();
  if (!isPlainObject(input)) {
    return resultWith(errors, ["reconciliation input must be a plain object"]);
  }

  const candidates = boundedArray(input.candidates, "candidates", errors);
  const capabilities = boundedArray(input.capabilities, "capabilities", errors);
  const evidence = boundedArray(input.evidence, "evidence", errors);
  const reconciliations = boundedArray(input.reconciliations, "reconciliations", errors);

  const candidateIndex = indexUnique(candidates, "candidateId", "candidate", errors);
  const capabilityIndex = indexUnique(capabilities, "capabilityId", "capability", errors);
  const evidenceIndex = indexUnique(evidence, "evidenceId", "evidence", errors);

  validateSubjectRecords(candidates, "candidate", "candidateId", errors);
  validateSubjectRecords(capabilities, "capability", "capabilityId", errors);
  validateSubjectRecords(evidence, "evidence", "evidenceId", errors);

  const reconciliationCounts = new Map();
  const normalizedByCandidate = new Map();

  for (let index = 0; index < reconciliations.length; index += 1) {
    const row = reconciliations[index];
    if (!isPlainObject(row)) {
      errors.add(`reconciliation at index ${index} must be an object`);
      continue;
    }

    const label = safeLabel(row.candidateId, `index ${index}`);
    if (!isSafeId(row.candidateId)) {
      errors.add(`reconciliation ${label} has invalid candidateId`);
      continue;
    }

    const seenCount = (reconciliationCounts.get(row.candidateId) ?? 0) + 1;
    reconciliationCounts.set(row.candidateId, seenCount);
    if (seenCount > 1) {
      errors.add(`duplicate reconciliation for candidate ${row.candidateId}`);
    }

    const candidateRecord = candidateIndex.byId.get(row.candidateId);
    if (!candidateRecord) {
      errors.add(`reconciliation references orphan candidate ${row.candidateId}`);
      continue;
    }

    let valid = true;
    const report = (message) => {
      errors.add(message);
      valid = false;
    };

    if (candidateIndex.duplicateIds.has(row.candidateId)) {
      report(`reconciliation references ambiguous duplicate candidate ${row.candidateId}`);
    }
    if (!SUBJECT_IDS.includes(candidateRecord.subjectId)) {
      report(`candidate ${row.candidateId} cannot be reconciled with an invalid subjectId`);
    }
    if (row.subjectId !== candidateRecord.subjectId) {
      report(
        `cross-subject reconciliation for candidate ${row.candidateId}: ${safeLabel(
          row.subjectId,
          "missing subject"
        )} does not match ${candidateRecord.subjectId}`
      );
    }

    let normalized = null;
    if (row.outcome === "MAPPED") {
      normalized = validateMapping(row, candidateRecord, capabilityIndex, evidenceIndex, report);
    } else if (row.outcome === "EXCLUDED") {
      normalized = validateExclusion(row, candidateRecord, evidenceIndex, report);
    } else if (row.outcome === "BLOCKED") {
      normalized = validateBlocked(row, candidateRecord, evidenceIndex, report);
    } else {
      report(`reconciliation ${row.candidateId} has unknown outcome`);
    }

    if (valid && normalized) {
      normalizedByCandidate.set(row.candidateId, normalized);
    } else {
      normalizedByCandidate.delete(row.candidateId);
    }
  }

  const rows = [];
  for (const candidateRecord of candidateIndex.byId.values()) {
    const count = reconciliationCounts.get(candidateRecord.candidateId) ?? 0;
    const normalized = normalizedByCandidate.get(candidateRecord.candidateId);
    if (
      count !== 1 ||
      candidateIndex.duplicateIds.has(candidateRecord.candidateId) ||
      !normalized
    ) {
      errors.add(
        `candidate ${candidateRecord.candidateId} is unreconciled by exactly one valid outcome`
      );
      continue;
    }
    rows.push(normalized);
  }
  rows.sort((left, right) => compareText(left.candidateId, right.candidateId));

  const counts = {
    enumerated: candidateIndex.byId.size,
    mapped: rows.filter((row) => row.outcome === "MAPPED").length,
    excluded: rows.filter((row) => row.outcome === "EXCLUDED").length,
    blocked: rows.filter((row) => row.outcome === "BLOCKED").length,
    unclassified: candidateIndex.byId.size - rows.length,
    unreconciled: candidateIndex.byId.size - rows.length,
  };

  if (counts.blocked > 0) {
    errors.add(`audit closure remains blocked by ${counts.blocked} BLOCKED reconciliation(s)`);
  }

  return {
    ok: errors.size === 0,
    errors: [...errors].sort(compareText),
    rows,
    counts,
  };
}

function validateMapping(row, candidateRecord, capabilityIndex, evidenceIndex, report) {
  validateClosedFields(row, MAPPED_FIELDS, `mapping ${row.candidateId}`, report);

  const capabilityIds = validateReferenceArray(
    row.capabilityIds,
    `mapping ${row.candidateId}`,
    report,
    "capability"
  );
  const evidenceIds = validateEvidenceReferences(
    row.evidenceIds,
    `mapping ${row.candidateId}`,
    candidateRecord,
    evidenceIndex,
    report
  );

  if (capabilityIds) {
    for (const capabilityId of capabilityIds) {
      if (capabilityIndex.duplicateIds.has(capabilityId)) {
        report(`mapping ${row.candidateId} references ambiguous capability ${capabilityId}`);
        continue;
      }
      const capability = capabilityIndex.byId.get(capabilityId);
      if (!capability) {
        report(`mapping ${row.candidateId} references unknown capability ${capabilityId}`);
        continue;
      }
      if (!SUBJECT_IDS.includes(capability.subjectId)) {
        report(`mapping ${row.candidateId} references capability with invalid subjectId`);
      } else if (capability.subjectId !== candidateRecord.subjectId) {
        report(`cross-subject mapping ${row.candidateId} references capability ${capabilityId}`);
      }
      if (!PRODUCT_DISPOSITIONS.includes(capability.productDisposition)) {
        report(`capability ${capabilityId} has invalid productDisposition`);
      } else if (capability.productDisposition === "BLOCKED_UNVERIFIED") {
        report(
          `mapping ${row.candidateId} must use a BLOCKED reconciliation for capability ${capabilityId}`
        );
      }
    }
  }

  if (!capabilityIds || !evidenceIds) return null;
  return {
    candidateId: row.candidateId,
    subjectId: candidateRecord.subjectId,
    outcome: "MAPPED",
    capabilityIds,
    evidenceIds,
  };
}

function validateExclusion(row, candidateRecord, evidenceIndex, report) {
  validateClosedFields(row, EXCLUDED_FIELDS, `exclusion ${row.candidateId}`, report);

  if (!EXCLUSION_REASONS.includes(row.reason)) {
    report(`exclusion ${row.candidateId} has invalid bounded reason`);
  }
  if (!isBoundedText(row.reviewer, 128)) {
    report(`exclusion ${row.candidateId} requires a bounded reviewer`);
  }
  if (!isBoundedText(row.owner, 128)) {
    report(`exclusion ${row.candidateId} requires a bounded owner`);
  }

  const evidenceIds = validateEvidenceReferences(
    row.evidenceIds,
    `exclusion ${row.candidateId}`,
    candidateRecord,
    evidenceIndex,
    report
  );
  const invalidationTriggers = validateTriggers(row, report);

  if (!evidenceIds || !invalidationTriggers) return null;
  return {
    candidateId: row.candidateId,
    subjectId: candidateRecord.subjectId,
    outcome: "EXCLUDED",
    reason: row.reason,
    evidenceIds,
    reviewer: row.reviewer,
    owner: row.owner,
    invalidationTriggers,
  };
}

function validateBlocked(row, candidateRecord, evidenceIndex, report) {
  validateClosedFields(row, BLOCKED_FIELDS, `BLOCKED ${row.candidateId}`, report);

  if (!isBoundedText(row.blocker)) {
    report(`BLOCKED ${row.candidateId} requires a bounded blocker`);
  }
  if (!isBoundedText(row.owner, 128)) {
    report(`BLOCKED ${row.candidateId} requires a bounded blocker owner`);
  }
  const evidenceIds = validateEvidenceReferences(
    row.evidenceIds,
    `BLOCKED ${row.candidateId}`,
    candidateRecord,
    evidenceIndex,
    report
  );

  if (!evidenceIds) return null;
  return {
    candidateId: row.candidateId,
    subjectId: candidateRecord.subjectId,
    outcome: "BLOCKED",
    blocker: row.blocker,
    owner: row.owner,
    evidenceIds,
  };
}

function validateEvidenceReferences(value, label, candidateRecord, evidenceIndex, report) {
  const evidenceIds = validateReferenceArray(value, `${label} direct evidence`, report, "evidence");
  if (!evidenceIds) return null;

  for (const evidenceId of evidenceIds) {
    if (evidenceIndex.duplicateIds.has(evidenceId)) {
      report(`${label} references ambiguous direct evidence ${evidenceId}`);
      continue;
    }
    const evidence = evidenceIndex.byId.get(evidenceId);
    if (!evidence) {
      report(`${label} references unknown direct evidence ${evidenceId}`);
      continue;
    }
    if (!SUBJECT_IDS.includes(evidence.subjectId)) {
      report(`${label} references direct evidence with invalid subjectId`);
    } else if (evidence.subjectId !== candidateRecord.subjectId) {
      report(`cross-subject direct evidence ${evidenceId} for ${candidateRecord.candidateId}`);
    }
    if (!DIRECT_EVIDENCE_CLASSES.has(evidence.evidenceClass)) {
      report(`${label} requires direct evidence, not ${evidence.evidenceClass}`);
    }
  }
  return evidenceIds;
}

function validateReferenceArray(value, label, report, referenceLabel = "reference") {
  if (!Array.isArray(value) || value.length === 0) {
    report(`${label} IDs must contain at least one reference`);
    return null;
  }
  if (value.length > MAX_REFERENCES) {
    report(`${label} IDs exceed reference limit`);
    return null;
  }

  let valid = true;
  for (const reference of value) {
    if (!isSafeId(reference)) {
      report(`${label} has an invalid ${referenceLabel} ID`);
      valid = false;
    }
  }
  for (const duplicate of duplicates(value)) {
    report(`${label} has duplicate ${referenceLabel} ${duplicate}`);
    valid = false;
  }
  return valid ? [...value].sort(compareText) : null;
}

function validateTriggers(row, report) {
  if (
    !Array.isArray(row.invalidationTriggers) ||
    row.invalidationTriggers.length === 0 ||
    row.invalidationTriggers.length > MAX_TRIGGERS
  ) {
    report(`exclusion ${row.candidateId} requires bounded invalidation triggers`);
    return null;
  }

  let valid = true;
  for (const trigger of row.invalidationTriggers) {
    if (!isBoundedText(trigger, 256)) {
      report(`exclusion ${row.candidateId} has invalid invalidation trigger`);
      valid = false;
    }
  }
  if (duplicates(row.invalidationTriggers).length > 0) {
    report(`exclusion ${row.candidateId} repeats an invalidation trigger`);
    valid = false;
  }
  return valid ? [...row.invalidationTriggers].sort(compareText) : null;
}

function validateClosedFields(row, allowedFields, label, report) {
  for (const field of Object.keys(row)) {
    if (!allowedFields.has(field)) {
      report(`${label} has unexpected field ${field}`);
    }
  }
}

function validateSubjectRecords(records, label, idField, errors) {
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!isPlainObject(record)) {
      errors.add(`${label} at index ${index} must be an object`);
      continue;
    }
    const recordId = record[idField];
    if (!isSafeId(recordId)) errors.add(`${label} at index ${index} has invalid ${idField}`);
    if (!SUBJECT_IDS.includes(record.subjectId)) {
      errors.add(`${label} ${safeLabel(recordId, `index ${index}`)} has invalid subjectId`);
    }
  }
}

function indexUnique(records, idField, label, errors) {
  const byId = new Map();
  const duplicateIds = new Set();
  for (let index = 0; index < records.length; index += 1) {
    const record = records[index];
    if (!isPlainObject(record) || !isSafeId(record[idField])) continue;
    const id = record[idField];
    if (byId.has(id)) {
      errors.add(`duplicate ${label} ID ${id}`);
      duplicateIds.add(id);
    } else {
      byId.set(id, record);
    }
  }
  return { byId, duplicateIds };
}

function boundedArray(value, label, errors) {
  if (!Array.isArray(value)) {
    errors.add(`${label} must be an array`);
    return [];
  }
  if (value.length > MAX_RECORDS) {
    errors.add(`${label} exceeds record limit`);
    return value.slice(0, MAX_RECORDS);
  }
  return value;
}

function duplicates(values) {
  const seen = new Set();
  const repeated = new Set();
  for (const value of values) {
    if (seen.has(value)) repeated.add(value);
    else seen.add(value);
  }
  return [...repeated].sort(compareText);
}

function isBoundedText(value, maximum = 256) {
  return (
    typeof value === "string" &&
    value.length > 0 &&
    value.length <= maximum &&
    value === value.trim() &&
    !/[\u0000\r\n]/u.test(value)
  );
}

function isSafeId(value) {
  return typeof value === "string" && SAFE_ID.test(value);
}

function isPlainObject(value) {
  return (
    value !== null &&
    typeof value === "object" &&
    !Array.isArray(value) &&
    Object.getPrototypeOf(value) === Object.prototype
  );
}

function safeLabel(value, fallback) {
  return isSafeId(value) ? value : fallback;
}

function compareText(left, right) {
  return Buffer.compare(Buffer.from(String(left), "utf8"), Buffer.from(String(right), "utf8"));
}

function resultWith(errors, messages) {
  for (const message of messages) errors.add(message);
  return {
    ok: false,
    errors: [...errors].sort(compareText),
    rows: [],
    counts: {
      enumerated: 0,
      mapped: 0,
      excluded: 0,
      blocked: 0,
      unclassified: 0,
      unreconciled: 0,
    },
  };
}
