import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { createRequire } from "node:module";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
const {
  evidenceFailureCode,
  sanitizeEvidenceFailureClass,
  sanitizeEvidenceMethod,
  sanitizeEvidenceResourceType,
  sanitizeEvidenceRoute,
  sanitizeEvidenceUrl,
  sanitizeSyncHealthEvidenceSnapshot,
} = require("../lib/diagnostic-evidence-privacy.cjs");

const CANARY = "ZF_T172_AUTH_7f3c91b2";
const ENCODED = encodeURIComponent(CANARY);

const LIVE_EVIDENCE_SCRIPTS = [
  "activate-apple-auth-live.cjs",
  "check-facebook-auth-live.cjs",
  "check-journal-magic-link-proof-status.cjs",
  "check-sentry-status.cjs",
  "setup-sync-test-account.cjs",
  "smoke-interactive-auth-completion.cjs",
  "smoke-telegram-sync-drill.cjs",
];

describe("diagnostic evidence privacy boundary", () => {
  it("maps local, hosted, native, query, hash, and private-id URLs to finite routes", () => {
    expect(sanitizeEvidenceRoute(`https://example.test/orb/?code=${CANARY}#${ENCODED}`)).toBe("orb");
    expect(sanitizeEvidenceRoute(`/people-first-app/diary/?data=${ENCODED}`)).toBe("diary");
    expect(sanitizeEvidenceRoute("capacitor://localhost/settings/?state=secret")).toBe("settings");
    expect(sanitizeEvidenceRoute("tauri://localhost/")).toBe("home");
    expect(sanitizeEvidenceRoute(`/journal/${CANARY}`)).toBe("unknown");
    expect(sanitizeEvidenceUrl(`https://${CANARY}.invalid/oauth?token=${ENCODED}`)).toBe("route:unknown");
  });

  it("turns Error, cause, encoded, nested, and hostile values into one fixed code", () => {
    const hostile = new Proxy({}, { ownKeys: () => { throw new Error(CANARY); } });
    const value = new Error(CANARY, { cause: new Error(ENCODED) });
    (value as Error & { context?: unknown }).context = { nested: [hostile, CANARY] };

    expect(() => evidenceFailureCode(value)).not.toThrow();
    expect(evidenceFailureCode(value)).toBe("ZF_EVIDENCE_FAILURE");
    expect(JSON.stringify(evidenceFailureCode(value))).not.toContain(CANARY);
  });

  it("retains useful finite network classes and reconstructs sync evidence exactly", () => {
    expect(sanitizeEvidenceMethod("post")).toBe("POST");
    expect(sanitizeEvidenceResourceType("xhr")).toBe("xhr");
    expect(sanitizeEvidenceFailureClass("net::ERR_CONNECTION_REFUSED")).toBe("connection");
    expect(sanitizeEvidenceFailureClass("request timed out")).toBe("timeout");

    const snapshot = sanitizeSyncHealthEvidenceSnapshot({
      route: `/diary/?token=${CANARY}`,
      auth: CANARY,
      online: true,
      lastSeq: 7,
      queue: { pending: 1, criticalPending: 0, processing: false, lastProcessedAt: Number.MAX_VALUE, note: CANARY },
      receipts: [{ kind: "error", source: "runtime", at: Number.MAX_VALUE, route: `/orb?code=${CANARY}`, errorName: CANARY, nested: CANARY }],
      unexpectedPrivateField: CANARY,
    });
    const serialized = JSON.stringify(snapshot);
    expect(snapshot.route).toBe("diary");
    expect(snapshot.auth).toBe("unknown");
    expect(snapshot.queue.lastProcessedAt).toBe(0);
    expect(snapshot.receipts[0]).toEqual({ kind: "error", source: "runtime", at: 0, route: "orb" });
    expect(serialized).not.toContain(CANARY);
    expect(serialized).not.toContain("note");
    expect(serialized).not.toContain("unexpectedPrivateField");
  });

  it("keeps every serialized smoke sink behind the shared boundary", () => {
    const scripts = [
      "smoke-chrome-performance.cjs",
      "smoke-sync-health.cjs",
      "smoke-sync-account.cjs",
      "smoke-v2-splash.cjs",
      "smoke-public-auth-providers.cjs",
    ];

    for (const script of scripts) {
      const source = readFileSync(resolve(process.cwd(), "scripts", script), "utf8");
      expect(source, script).toContain("diagnostic-evidence-privacy.cjs");
      expect(source, script).not.toMatch(/\.push\(message\.text\(\)\)/);
      expect(source, script).not.toMatch(/error(?:\.stack|\.message)\s*\|\|\s*String\(error\)/);
    }
  });

  it("keeps the bounded live auth, sync, journal, and Sentry evidence scripts behind the shared boundary", () => {
    for (const script of LIVE_EVIDENCE_SCRIPTS) {
      const source = readFileSync(resolve(process.cwd(), "scripts", script), "utf8");
      expect(source, script).toContain("diagnostic-evidence-privacy.cjs");
      expect(source, script).not.toMatch(/error(?:\?\.|\.)(?:stack|message)\s*\|\|\s*String\(error\)/);
      expect(source, script).not.toMatch(/console\.(?:error|log)\(\s*(?:error\.message|message)\s*\)/);
      expect(source, script).not.toMatch(/printOutput\([^,]+,\s*child\.(?:stdout|stderr)\)/);
    }
  });

  it("does not retain arbitrary child or runtime fields in Sentry and interactive-auth evidence", () => {
    const { runSentryStatus } = require("../check-sentry-status.cjs") as {
      runSentryStatus: (input: {
        runner: () => { status: number; stdout: string; stderr: string; error?: Error };
      }) => { stdout: string; stderr: string };
    };
    const { sanitizeInteractiveAuthState } = require("../smoke-interactive-auth-completion.cjs") as {
      sanitizeInteractiveAuthState: (value: Record<string, unknown>) => Record<string, unknown>;
    };

    const sentry = runSentryStatus({
      runner: () => ({
        status: 0,
        stdout: `[sentry-readiness] PASS - ${CANARY}`,
        stderr: ENCODED,
        error: new Error(CANARY),
      }),
    });
    const auth = sanitizeInteractiveAuthState({
      provider: CANARY,
      reason: CANARY,
      providerError: ENCODED,
      finalUrl: `https://example.test/orb/?code=${CANARY}#${ENCODED}`,
      finalHost: CANARY,
      finalPath: `/${CANARY}`,
      appHost: CANARY,
      currentHost: CANARY,
      supabaseSessionKeys: [CANARY],
      completed: true,
    });

    expect(JSON.stringify({ sentry, auth })).not.toContain(CANARY);
    expect(JSON.stringify({ sentry, auth })).not.toContain(ENCODED);
    expect(auth).toMatchObject({ provider: "unknown", route: "orb", completed: true });
  });
});
