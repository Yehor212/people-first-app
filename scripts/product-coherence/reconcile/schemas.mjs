import { ENUMERATOR_IDS } from "../inventory-v2/constants.mjs";

const MAX_ERRORS = 200;

export function validateReconciliationInput(input) {
  const errors = [];
  if (!isObject(input)) return { errors: ["reconciliation input must be an object"], inventory: undefined };
  const { inventory } = input;
  if (!isObject(inventory) || typeof inventory.subjectId !== "string" || !Array.isArray(inventory.candidates)) {
    return { errors: ["reconciliation requires an inventory with subjectId and candidates"], inventory: undefined };
  }
  const candidateById = new Map();
  for (const candidate of inventory.candidates) {
    if (!isObject(candidate) || !nonBlank(candidate.candidateId)) {
      addError(errors, "inventory contains a candidate without a stable candidateId");
      continue;
    }
    if (candidate.subjectId !== inventory.subjectId) {
      addError(errors, `candidate ${candidate.candidateId} does not match inventory subject`);
    }
    if (!ENUMERATOR_IDS.includes(candidate.enumerator)) {
      addError(errors, `candidate ${candidate.candidateId} has an unknown enumerator`);
    }
    if (candidateById.has(candidate.candidateId)) {
      addError(errors, `duplicate inventory candidate ${candidate.candidateId}`);
    } else {
      candidateById.set(candidate.candidateId, candidate);
    }
  }
  return { errors, inventory, candidateById };
}

export function addError(errors, message) {
  if (errors.length < MAX_ERRORS) errors.push(message);
}

export function nonBlank(value) {
  return typeof value === "string" && value.trim().length > 0;
}

export function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}
