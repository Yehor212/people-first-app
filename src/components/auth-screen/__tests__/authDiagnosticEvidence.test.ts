import { describe, expect, it } from "vitest";
import {
  buildAuthDiagnosticEvidence,
  serializeAuthDiagnosticEvidence,
} from "../authDiagnosticEvidence";

const AUTH_CANARY = "ZF_T172_AUTH_98e641ad";
const IDENTITY_CANARY = "identity+98e641ad@example.test";

describe("auth diagnostic evidence", () => {
  it("reconstructs the exported bytes from finite codes and a route label", () => {
    const privateError = new Error(IDENTITY_CANARY) as Error & { cause?: unknown };
    privateError.cause = new Error(AUTH_CANARY);
    const evidence = buildAuthDiagnosticEvidence({
      timestamp: "2026-08-12T12:00:00.000Z",
      isNative: false,
      redirectUrl: `https://example.test/people-first-app/orb/?code=${AUTH_CANARY}#${encodeURIComponent(IDENTITY_CANARY)}`,
      supabaseConfigured: true,
      error: privateError,
      debugInfo: `${AUTH_CANARY}:${IDENTITY_CANARY}`,
    });
    const serialized = serializeAuthDiagnosticEvidence(evidence);

    expect(evidence).toEqual({
      schemaVersion: 1,
      generatedAt: "2026-08-12T12:00:00.000Z",
      platform: "web",
      redirectRoute: "orb",
      supabaseConfigured: true,
      hasUserVisibleError: true,
      diagnosticCode: "auth_failure",
    });
    expect(serialized).not.toContain(AUTH_CANARY);
    expect(serialized).not.toContain(IDENTITY_CANARY);
    expect(serialized).not.toContain("example.test");
  });
});
