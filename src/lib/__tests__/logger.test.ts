import { beforeEach, describe, expect, it, vi } from "vitest";
import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import ts from "typescript";

vi.mock("@/lib/env", () => ({ IS_DEV: true }));

import { logger } from "@/lib/logger";
import {
  diagnosticCodeFrom,
  sanitizeDiagnosticLogArgs,
  sanitizeDiagnosticRoute,
  toDiagnosticError,
} from "@/lib/diagnosticPrivacy";

const consoleSpy = {
  log: vi.spyOn(console, "log").mockImplementation(() => {}),
  warn: vi.spyOn(console, "warn").mockImplementation(() => {}),
  error: vi.spyOn(console, "error").mockImplementation(() => {}),
};

beforeEach(() => {
  vi.clearAllMocks();
});

describe("fixed-code logger", () => {
  it("assigns every literal production logger call a finite subsystem code", () => {
    const sourceFiles: string[] = [];
    const visit = (directory: string) => {
      for (const name of readdirSync(directory)) {
        const path = join(directory, name);
        if (statSync(path).isDirectory()) {
          if (name !== "__tests__") visit(path);
        } else if ([".ts", ".tsx"].includes(extname(path)) && !/\.test\.[^.]+$/.test(name)) {
          sourceFiles.push(path);
        }
      }
    };
    visit(resolve(process.cwd(), "src"));

    const missing: string[] = [];
    const unstructured: string[] = [];
    for (const path of sourceFiles) {
      const source = readFileSync(path, "utf8");
      const sourceFile = ts.createSourceFile(path, source, ts.ScriptTarget.Latest, true);
      const visitCall = (node: ts.Node): void => {
        if (
          ts.isCallExpression(node) &&
          ts.isPropertyAccessExpression(node.expression) &&
          ts.isIdentifier(node.expression.expression) &&
          node.expression.expression.text === "logger" &&
          ["error", "warn", "log", "info"].includes(node.expression.name.text)
        ) {
          const first = node.arguments[0];
          const text = first && (ts.isStringLiteralLike(first) || ts.isTemplateExpression(first))
            ? (ts.isTemplateExpression(first) ? first.head.text : first.text)
            : null;
          const subsystem = text?.match(/^\[([A-Za-z0-9][A-Za-z0-9 _-]{0,31})\]/)?.[1];
          const location = sourceFile.getLineAndCharacterOfPosition(node.getStart(sourceFile));
          const evidence = `${path}:${location.line + 1}`;
          if (!subsystem) unstructured.push(evidence);
          else if (diagnosticCodeFrom(`[${subsystem}]`, "ZF_RUNTIME_ERROR") === "ZF_RUNTIME_ERROR") {
            missing.push(`${evidence}:${subsystem}`);
          }
        }
        ts.forEachChild(node, visitCall);
      };
      visitCall(sourceFile);
    }

    expect(missing).toEqual([]);
    expect(unstructured).toEqual([]);
    expect(diagnosticCodeFrom("[AuthScreen]", "ZF_RUNTIME_ERROR")).toBe("ZF_AUTHSCREEN_DIAGNOSTIC");
    expect(diagnosticCodeFrom("[JournalSettings]", "ZF_RUNTIME_ERROR")).toBe("ZF_JOURNALSETTINGS_DIAGNOSTIC");
    expect(diagnosticCodeFrom("[OrbPage]", "ZF_RUNTIME_ERROR")).toBe("ZF_ORBPAGE_DIAGNOSTIC");
    expect(diagnosticCodeFrom("[StorageErrorBanner]", "ZF_RUNTIME_ERROR")).toBe("ZF_STORAGEERRORBANNER_DIAGNOSTIC");
  });

  it("maps only finite cross-platform route labels and drops queries, hashes, and ids", () => {
    const canary = "ZF_T172_ROUTE_5K9M2V7R4Q8N";
    expect(sanitizeDiagnosticRoute(`https://example.test/orb/?code=${canary}#${canary}`)).toBe("orb");
    expect(sanitizeDiagnosticRoute(`https://yehor212.github.io/people-first-app/orb/?data=${canary}`)).toBe("orb");
    expect(sanitizeDiagnosticRoute("https://yehor212.github.io/people-first-app/")).toBe("home");
    expect(sanitizeDiagnosticRoute(`capacitor://localhost/diary?token=${canary}`)).toBe("diary");
    expect(sanitizeDiagnosticRoute(`tauri://localhost/settings?state=${canary}`)).toBe("settings");
    expect(sanitizeDiagnosticRoute(`https://example.test/planning?state=${canary}`)).toBe("planning");
    expect(sanitizeDiagnosticRoute(`https://example.test/orb/${canary}?code=${canary}`)).toBe("unknown");
    expect(sanitizeDiagnosticRoute(`https://yehor212.github.io/people-first-app/orb/${canary}`)).toBe("unknown");
    expect(sanitizeDiagnosticRoute(`file:///private/${canary}/index.html?code=${canary}`)).toBe("unknown");
    expect(sanitizeDiagnosticRoute(`/journal/${canary}?code=${canary}`)).toBe("unknown");
  });
  it("uses a fixed fallback code for an unstructured message", () => {
    logger.log("hello");
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_RUNTIME_DIAGNOSTIC");
  });

  it("derives a stable code from a bracketed subsystem", () => {
    logger.log("[Main] started");
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_MAIN_DIAGNOSTIC");
  });

  it("preserves only known fixed subsystem codes across the last-line console guard", () => {
    expect(sanitizeDiagnosticLogArgs(["ZF_STORAGE_DIAGNOSTIC"], "ZF_FRAMEWORK_CONSOLE_ERROR"))
      .toEqual(["ZF_STORAGE_DIAGNOSTIC"]);
    expect(sanitizeDiagnosticLogArgs(["ZF_PRIVATE_CANARY_DIAGNOSTIC"], "ZF_FRAMEWORK_CONSOLE_ERROR"))
      .toEqual(["ZF_FRAMEWORK_CONSOLE_ERROR"]);
  });

  it("rejects caller-controlled fallback and Error codes at the fixed-code boundary", () => {
    const canary = "ZF_T172_PRIVATE_FALLBACK_9K4M7Q2R";

    expect(diagnosticCodeFrom("unstructured", canary)).toBe("ZF_RUNTIME_DIAGNOSTIC");
    expect(sanitizeDiagnosticLogArgs(["unstructured"], canary)).toEqual([
      "ZF_RUNTIME_DIAGNOSTIC",
    ]);
    expect(toDiagnosticError(new Error(canary), canary).message).toBe("ZF_RUNTIME_ERROR");
  });

  it("does not derive a diagnostic code from an arbitrary bracketed private value", () => {
    const bracketCanary = "ZF_T172_PRIV_6Q9M4K2R8P7D";

    logger.error(`[${bracketCanary}] failed`);

    expect(consoleSpy.error).toHaveBeenCalledWith("ZF_RUNTIME_ERROR");
    expect(JSON.stringify(consoleSpy.error.mock.calls)).not.toContain(bracketCanary);
  });

  it("redacts unlabelled primitive values that cannot be allowlisted", () => {
    logger.log("[Main] count", 42, true);
    expect(consoleSpy.log).toHaveBeenCalledWith(
      "ZF_MAIN_DIAGNOSTIC",
      "[REDACTED]",
      "[REDACTED]",
    );
  });

  it("exposes logger.info through the same boundary", () => {
    logger.info("[Migration] complete", 2);
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_MIGRATION_DIAGNOSTIC", "[REDACTED]");
  });

  it("uses the same fixed-code boundary for warnings", () => {
    logger.warn("[Network] retry");
    expect(consoleSpy.warn).toHaveBeenCalledWith("ZF_NETWORK_DIAGNOSTIC");
  });

  it("uses a fixed error code for an unstructured error string", () => {
    logger.error("something broke");
    expect(consoleSpy.error).toHaveBeenCalledWith("ZF_RUNTIME_ERROR");
  });

  it("converts Error objects into error name and stack fingerprint metadata", () => {
    logger.error(new Error("oops"));
    expect(consoleSpy.error).toHaveBeenCalledWith(
      "ZF_RUNTIME_ERROR",
      expect.objectContaining({
        error_name: "Error",
        stack_fingerprint: "stack-present",
      }),
    );
  });

  it("does not expose private nested Error, cause, or context values to console", () => {
    const diaryCanary = "ZF_T172_DIARY_7H2K9Q4M6P8R";
    const habitCanary = "ZF_T172_HABIT_4N8C2V7X5L3D";
    const authCanary = "ZF_T172_AUTH_9B6W3J8S2F5K";
    const identityCanary = "ZF_T172_IDENTITY_5M7R2Q9T4C8P";
    const error = new Error(diaryCanary) as Error & { cause?: unknown };
    error.cause = new Error(authCanary);

    logger.error("[Main] diagnostic boundary failure", error, {
      note: habitCanary,
      nested: [{ userId: identityCanary }],
    });

    const serialized = JSON.stringify(consoleSpy.error.mock.calls);
    for (const canary of [diaryCanary, habitCanary, authCanary, identityCanary]) {
      expect(serialized).not.toContain(canary);
    }
    expect(serialized).toContain("ZF_MAIN_DIAGNOSTIC");
  });

  it("is total for hostile getters, proxies, AggregateError, and cyclic metadata", () => {
    const canary = "ZF_T172_HOSTILE_4c19e7a2";
    const hostileError = Object.create(Error.prototype) as Error;
    Object.defineProperties(hostileError, {
      name: { get: () => { throw new Error(canary); } },
      stack: { get: () => { throw new Error(encodeURIComponent(canary)); } },
    });
    const hostileProxy = new Proxy({}, {
      getPrototypeOf: () => { throw new Error(canary); },
      ownKeys: () => { throw new Error(canary); },
    });
    const cyclic: Record<string, unknown> = { source: "react" };
    cyclic.metadata = cyclic;
    const AggregateErrorCtor = (globalThis as unknown as {
      AggregateError: new (errors: Iterable<unknown>, message?: string) => Error;
    }).AggregateError;
    const aggregate = new AggregateErrorCtor([new Error(canary)], canary) as Error & { cause?: unknown };
    aggregate.cause = hostileError;

    expect(() => logger.error("[Main] hostile", hostileError, hostileProxy, cyclic, aggregate)).not.toThrow();
    const serialized = JSON.stringify(consoleSpy.error.mock.calls);
    expect(serialized).toContain("ZF_MAIN_DIAGNOSTIC");
    expect(serialized).not.toContain(canary);
    expect(serialized).not.toContain(encodeURIComponent(canary));
  });

  it("uses a fixed sync code", () => {
    logger.sync("pull complete");
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", undefined);
  });

  it("preserves allowlisted sync metadata", () => {
    logger.sync("status", { count: 5, status: "ok" });
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", {
      count: 5,
      status: "ok",
    });
  });

  it("redacts identity, token, email, and recovery-secret fields", () => {
    logger.sync("test", {
      user_id: "u-1",
      token: "token-value",
      email: "private@example.test",
      recoverySecret: "private-secret",
    });
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", {
      user_id: "[REDACTED]",
      token: "[REDACTED]",
      email: "[REDACTED]",
      recoverySecret: "[REDACTED]",
    });
  });

  it("redacts arbitrary nested objects", () => {
    logger.sync("test", { metadata: { source: "react", userId: "u-1" } });
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", {
      metadata: { source: "react", userId: "[REDACTED]" },
    });
  });

  it("redacts arbitrary string metadata while retaining numeric counts", () => {
    logger.sync("test", { label: "private prose", items: 3 });
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", {
      label: "[REDACTED]",
      items: 3,
    });
  });

  it("redacts content-derived numeric fields while preserving bounded operational metadata", () => {
    logger.sync("test", {
      habitLength: 48,
      totalHabits: 7,
      responseBodyBytes: 1_024,
      count: 5,
      duration: 12.5,
      bytes: Number.MAX_VALUE,
      route: "orb",
    });

    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_SYNC_DIAGNOSTIC", {
      redacted_field_0: "[REDACTED]",
      totalHabits: "[REDACTED]",
      responseBodyBytes: "[REDACTED]",
      count: 5,
      duration: 12.5,
      bytes: "[REDACTED]",
      route: "orb",
    });
  });

  it("does not retain private canaries embedded in metadata keys", () => {
    const privateKey = ["ZF_T172", "IDENTITY_KEY", "8D4K2M7Q9P6R"].join("_");
    const numericIdentityCanary = 8_742_691_357;

    logger.sync("test", {
      metadata: { [privateKey]: "ordinary-value" },
      status: privateKey,
      [privateKey]: numericIdentityCanary,
    });

    const serialized = JSON.stringify(consoleSpy.log.mock.calls);
    expect(serialized).not.toContain(privateKey);
    expect(serialized).not.toContain(String(numericIdentityCanary));
  });

  it("uses a fixed auth code", () => {
    logger.auth("login success");
    expect(consoleSpy.log).toHaveBeenCalledWith("ZF_AUTH_DIAGNOSTIC");
  });
});
