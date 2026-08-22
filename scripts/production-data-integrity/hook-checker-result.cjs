"use strict";

const CHECKER_TIMEOUT_MS = 10000;

function classifyCheckerProcessResult(result, timeoutMs = CHECKER_TIMEOUT_MS) {
  if (!result?.error) return null;
  if (result.error.code === "ETIMEDOUT") {
    return {
      kind: "error",
      code: "CHECKER_TIMEOUT",
      reason: `checker timed out after ${timeoutMs}ms`,
    };
  }
  return {
    kind: "error",
    code: "CHECKER_ERROR",
    reason: "checker process could not run",
  };
}

module.exports = {
  CHECKER_TIMEOUT_MS,
  classifyCheckerProcessResult,
};
