import { readFileSync, readdirSync, statSync } from "node:fs";
import { extname, join, resolve } from "node:path";
import { describe, expect, it } from "vitest";

function readSources(root: string, extensions: Set<string>): string {
  const files: string[] = [];
  const visit = (directory: string) => {
    for (const name of readdirSync(directory)) {
      const path = join(directory, name);
      if (statSync(path).isDirectory()) {
        if (name === "__tests__") continue;
        visit(path);
      } else if (extensions.has(extname(path)) && !/\.test\.[^.]+$/.test(name)) {
        files.push(path);
      }
    }
  };
  visit(root);
  return files.sort().map((path) => readFileSync(path, "utf8")).join("\n");
}

describe("native diagnostic privacy source contract", () => {
  it("keeps arbitrary Android exception messages and throwables out of bridge/log sinks", () => {
    const source = readSources(
      resolve(process.cwd(), "android/app/src/main/java"),
      new Set([".java"]),
    );

    expect(source).not.toMatch(/\.getMessage\s*\(/);
    expect(source).not.toMatch(/Log\.[vd iwe]\([^;\n]*,\s*[A-Za-z_$][\w$]*\s*\);/);
    expect(source).not.toMatch(/printStackTrace\s*\(/);
  });

  it("keeps arbitrary iOS error descriptions out of bridge/log sinks", () => {
    const source = readSources(
      resolve(process.cwd(), "ios/App/App"),
      new Set([".swift", ".m", ".mm"]),
    );

    expect(source).not.toContain("localizedDescription");
    expect(source).not.toContain("SecCopyErrorMessageString");
    expect(source).not.toMatch(/\b(?:NSLog|print)\s*\(/);
  });

  it("returns only finite biometric bridge codes and leaves visible copy to localized TypeScript", () => {
    const android = readSources(
      resolve(process.cwd(), "android/app/src/main/java"),
      new Set([".java"]),
    );
    const ios = readSources(
      resolve(process.cwd(), "ios/App/App"),
      new Set([".swift"]),
    );
    const editor = readFileSync(
      resolve(process.cwd(), "src/features/journal/JournalEntryEditor.tsx"),
      "utf8",
    );

    const allowed = [
      "biometric_unavailable",
      "biometric_failed",
      "biometric_not_enrolled",
      "biometric_canceled",
    ];
    for (const code of allowed) expect(`${android}\n${ios}`).toContain(code);
    expect(android).not.toContain("errString.toString()");
    const androidFailureArguments = [...android.matchAll(/resolveFailure\(call,\s*([^;)]+(?:\([^)]*\))?)\s*\);/g)]
      .map((match) => match[1].replace(/\s+/g, " ").trim());
    expect(androidFailureArguments.length).toBeGreaterThan(0);
    expect(androidFailureArguments.every((argument) =>
      /^(?:ERROR_(?:UNAVAILABLE|FAILED|NOT_ENROLLED|CANCELED)|availabilityMessage\(status\)|keychainErrorMessage\(error\)|promptErrorCode\(errorCode\))$/.test(argument)
    )).toBe(true);
    expect(android).toMatch(
      /private String promptErrorCode\(int errorCode\)[\s\S]*?\? ERROR_CANCELED\s*:\s*ERROR_FAILED;/,
    );
    const iosErrorValues = [...ios.matchAll(/"error"\s*:\s*([^,\n]+)/g)]
      .map((match) => match[1].trim());
    expect(iosErrorValues.length).toBeGreaterThan(0);
    expect(iosErrorValues.every((value) =>
      /^(?:errorUnavailable|errorFailed|self\.keychainErrorMessage\((?:status|error)\))$/.test(value)
    )).toBe(true);
    expect(editor).not.toContain("result.error || ts.authUnexpectedError");
    expect(editor).toContain("ts.journalBiometricFailed");
  });

  it("uses a fixed desktop runtime failure code instead of formatting the Tauri error", () => {
    const source = readFileSync(
      resolve(process.cwd(), "src-tauri/src/main.rs"),
      "utf8",
    );

    expect(source).not.toContain(".expect(");
    expect(source).toContain("ZF_TAURI_RUNTIME_FAILED");
  });

  it("keeps external Crashlytics collection off by default and clears retained web diagnostics at account boundaries", () => {
    const manifest = readFileSync(
      resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );
    const databaseBoundary = readFileSync(
      resolve(process.cwd(), "src/storage/db.ts"),
      "utf8",
    );

    expect(manifest).toMatch(
      /android:name="firebase_crashlytics_collection_enabled"\s+android:value="false"/,
    );
    expect(databaseBoundary).toContain("SK.ERROR_LOG");
    expect(databaseBoundary).toContain("SK.CRASH_LOG");
  });

  it("registers the transient diagnostic buffer with the production account-boundary reset", () => {
    const bufferSource = readFileSync(
      resolve(process.cwd(), "src/lib/errorBuffer.ts"),
      "utf8",
    );
    const runtimeBoundary = readFileSync(
      resolve(process.cwd(), "src/storage/accountBoundaryRuntime.ts"),
      "utf8",
    );
    const databaseBoundary = readFileSync(
      resolve(process.cwd(), "src/storage/db.ts"),
      "utf8",
    );

    expect(bufferSource).toContain(
      "registerAccountBoundaryRuntimeReset(clearBufferedDiagnostics)",
    );
    expect(runtimeBoundary).toContain("for (const reset of accountBoundaryResets)");
    expect(databaseBoundary).toContain("resetAccountBoundaryRuntimeState()");
  });

  it("prunes retained diagnostics during startup without waiting for another crash", () => {
    const source = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");

    expect(source).toContain("pruneRetainedBoundaryDiagnostics()");
    expect(source).toContain("pruneRetainedCrashReports()");
  });

  it("suppresses the browser default raw error and rejection console sinks after bounded capture", () => {
    const source = readFileSync(resolve(process.cwd(), "src/main.tsx"), "utf8");
    const unhandledRejectionHandler = source.match(
      /window\.addEventListener\("unhandledrejection",[\s\S]*?\n\}\);/,
    )?.[0];
    const errorHandler = source.match(
      /window\.addEventListener\("error",[\s\S]*?\n\}\);/,
    )?.[0];

    expect(unhandledRejectionHandler).toBeDefined();
    expect(errorHandler).toBeDefined();
    expect(unhandledRejectionHandler).toContain("event.preventDefault();");
    expect(errorHandler).toContain("event.preventDefault();");
    expect(unhandledRejectionHandler!.indexOf("event.preventDefault();")).toBeLessThan(
      unhandledRejectionHandler!.indexOf("const reason"),
    );
    expect(errorHandler!.indexOf("event.preventDefault();")).toBeLessThan(
      errorHandler!.indexOf("const message"),
    );
  });

  it("keeps direct console calls inside reviewed fixed-code or development-only boundaries", () => {
    const sources = [
      "src/lib/logger.ts",
      "src/lib/crashReporting.ts",
      "src/observability/reportWebVitals.ts",
      "src/observability/initLongTaskObserverDev.ts",
      "src/lib/diagnosticConsole.ts",
    ];
    const allConsoleFiles = readSources(
      resolve(process.cwd(), "src"),
      new Set([".ts", ".tsx"]),
    );
    const reviewed = sources.map((path) =>
      readFileSync(resolve(process.cwd(), path), "utf8"),
    ).join("\n");

    expect(allConsoleFiles.match(/console\.(?:log|warn|error|info|debug)\s*\(/g)?.length ?? 0)
      .toBe(reviewed.match(/console\.(?:log|warn|error|info|debug)\s*\(/g)?.length ?? 0);
    expect(readFileSync(resolve(process.cwd(), sources[2]), "utf8"))
      .toContain("if (!import.meta.env.DEV) return;");
    expect(readFileSync(resolve(process.cwd(), sources[3]), "utf8"))
      .toContain("if (!import.meta.env.DEV) return;");
  });
});
