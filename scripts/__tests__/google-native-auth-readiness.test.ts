import { spawnSync } from "node:child_process";
import { mkdtempSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";

const script = "scripts/check-google-native-auth-readiness.cjs";
const now = "2026-08-25T01:30:00.000Z";

const validEvidence = {
  schemaVersion: 1,
  status: "VERIFIED",
  observedAt: "2026-08-25T01:00:00.000Z",
  googleCloudProjectId: "vibemeter",
  packageName: "com.zenflow.app",
  webClientId:
    "830119095963-krjibmbag0tuastn4sk0sf58m1c4v4qa.apps.googleusercontent.com",
  androidOAuthClients: [
    {
      name: "ZenFlow Android (Release)",
      clientId:
        "830119095963-su0i64bdemaf8tqv2pq1qvhljipjagiv.apps.googleusercontent.com",
      signingRole: "upload",
      sha1: "2D:76:82:17:D0:39:43:8B:68:27:A1:F2:00:2F:0D:58:E8:EA:10:8F",
      status: "VERIFIED",
    },
    {
      name: "ZenFlow Android (Google Play)",
      clientId:
        "830119095963-play-signing-fixture.apps.googleusercontent.com",
      signingRole: "play-app-signing",
      sha1: "93:F9:95:0E:A3:31:0F:B4:B7:81:FC:E1:BD:70:61:8B:C7:7C:BA:A0",
      status: "VERIFIED",
    },
  ],
};

function runCheck(
  evidence: Record<string, unknown>,
  envOverrides: Record<string, string> = {},
) {
  const directory = mkdtempSync(join(tmpdir(), "zenflow-google-auth-"));
  const evidencePath = join(directory, "evidence.json");
  writeFileSync(evidencePath, JSON.stringify(evidence));

  return spawnSync(process.execPath, [script, "--strict"], {
    cwd: process.cwd(),
    env: {
      ...process.env,
      ZENFLOW_GOOGLE_NATIVE_AUTH_EVIDENCE_FILE: evidencePath,
      ZENFLOW_GOOGLE_NATIVE_AUTH_NOW: now,
      ...envOverrides,
    },
    encoding: "utf8",
  });
}

describe("check-google-native-auth-readiness", () => {
  it("passes only with distinct verified upload and Play App Signing OAuth clients", () => {
    const result = runCheck(validEvidence);

    expect(result.status).toBe(0);
    expect(result.stdout).toContain(
      "PASS Google Play App Signing OAuth registration is verified for com.zenflow.app",
    );
  });

  it("rejects an upload-key client reused as the Play App Signing client", () => {
    const uploadClient = validEvidence.androidOAuthClients[0];
    const result = runCheck({
      ...validEvidence,
      androidOAuthClients: [
        uploadClient,
        { ...validEvidence.androidOAuthClients[1], sha1: uploadClient.sha1 },
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "FAIL Upload and Play App Signing OAuth clients use the same SHA-1",
    );
  });

  it("rejects pending console evidence", () => {
    const result = runCheck({
      ...validEvidence,
      status: "UNVERIFIED_PENDING_CREATE",
      androidOAuthClients: [
        validEvidence.androidOAuthClients[0],
        {
          ...validEvidence.androidOAuthClients[1],
          clientId: "",
          status: "PENDING_CREATE",
        },
      ],
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "FAIL Google native auth console evidence is not VERIFIED",
    );
  });

  it("rejects evidence for a different Android package", () => {
    const result = runCheck({ ...validEvidence, packageName: "com.example.other" });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "FAIL Google native auth evidence package does not match com.zenflow.app",
    );
  });

  it("rejects stale console evidence", () => {
    const result = runCheck({ ...validEvidence, observedAt: "2026-06-01T00:00:00.000Z" });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain("FAIL Google native auth console evidence is stale");
  });

  it("rejects a release gate that requires but omits the Google Web client ID", () => {
    const result = runCheck(validEvidence, {
      ZENFLOW_GOOGLE_WEB_CLIENT_REQUIRED: "true",
      VITE_GOOGLE_WEB_CLIENT_ID: "",
    });

    expect(result.status).toBe(1);
    expect(result.stdout).toContain(
      "FAIL VITE_GOOGLE_WEB_CLIENT_ID is required for the Android release build",
    );
  });

  it("accepts a required Google Web client ID only when it matches console evidence", () => {
    const result = runCheck(validEvidence, {
      ZENFLOW_GOOGLE_WEB_CLIENT_REQUIRED: "true",
      VITE_GOOGLE_WEB_CLIENT_ID: validEvidence.webClientId,
    });

    expect(result.status).toBe(0);
  });
});
