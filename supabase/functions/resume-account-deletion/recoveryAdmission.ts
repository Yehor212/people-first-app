import { createJsonResponse } from "../_shared/http.ts";

export type RecoveryAdmission =
  | { state: "allowed" }
  | { state: "invalid" }
  | { state: "limited"; retryAfterSeconds: number };

function isExactAdmissionRow(value: unknown): value is Record<string, unknown> {
  if (value === null || typeof value !== "object" || Array.isArray(value)) {
    return false;
  }
  const keys = Object.keys(value).sort();
  return keys.length === 2 && keys[0] === "retry_after_seconds" && keys[1] === "state";
}

export function parseRecoveryAdmission(value: unknown): RecoveryAdmission | null {
  if (!Array.isArray(value) || value.length !== 1) return null;
  const row = value[0];
  if (!isExactAdmissionRow(row)) return null;

  if (row.state === "allowed" && row.retry_after_seconds === 0) {
    return { state: "allowed" };
  }
  if (row.state === "invalid" && row.retry_after_seconds === 0) {
    return { state: "invalid" };
  }
  if (
    row.state === "limited" &&
    typeof row.retry_after_seconds === "number" &&
    Number.isSafeInteger(row.retry_after_seconds) &&
    row.retry_after_seconds >= 1 &&
    row.retry_after_seconds <= 60
  ) {
    return {
      state: "limited",
      retryAfterSeconds: row.retry_after_seconds,
    };
  }
  return null;
}

export function createRecoveryAdmissionRejectionResponse(
  origin: string | null,
  admission: RecoveryAdmission
): Response | null {
  if (admission.state === "allowed") return null;
  if (admission.state === "invalid") {
    return createJsonResponse(origin, 404, {
      error: "Deletion operation not found",
    });
  }

  const response = createJsonResponse(origin, 429, {
    error: "Deletion retry temporarily limited",
  });
  response.headers.set("Retry-After", String(admission.retryAfterSeconds));
  return response;
}
