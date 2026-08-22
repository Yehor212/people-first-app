import { execFileSync, spawnSync } from "node:child_process";
import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";

import ts from "typescript";
import { describe, expect, it } from "vitest";

import { SENSITIVE_ADVERTISING_SCENARIOS } from "./sensitiveAdvertisingInventory";

const REPO_ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const APK = "android/app/build/outputs/apk/release/app-release-unsigned.apk";
const AAB = "android/app/build/outputs/bundle/release/app-release.aab";
const MERGED_MANIFEST =
  "android/app/build/intermediates/merged_manifests/release/processReleaseManifest/AndroidManifest.xml";

const EXCLUDED_TRANSITIONS = [
  "direct-entry",
  "navigation",
  "android-back",
  "overlay-close",
  "reload",
  "activity-recreation",
  "process-death-cold-launch",
  "offline",
  "permission-denied",
  "error-recovery",
] as const;

const FORBIDDEN_PRODUCTION_MODULES = [
  "src/contexts/AdContext.tsx",
  "src/lib/adController.ts",
  "src/lib/adConfig.ts",
  "src/components/ads/RewardedAdPrompt.tsx",
  "src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx",
] as const;

const FORBIDDEN_EXTERNAL_IMPORTS = [
  "@capacitor-community/admob",
  "google-mobile-ads",
  "user-messaging-platform",
] as const;

const FORBIDDEN_REACHABLE_PATTERNS = [
  ["ad-provider", /\bAdProvider\b/],
  ["ad-controller", /\badController\b/],
  ["ad-config", /\badConfig\b/],
  ["rewarded-prompt", /\bRewardedAdPrompt\b/],
  ["privacy-ad-copy", /Rewarded (?:videos|ads)|Google ad privacy|Review ad choices/i],
  ["ump-call", /\bConsentInformation\s*\.\s*(?:requestConsentInfoUpdate|canRequestAds)\b/],
  ["private-canary-fetch", /fetch\s*\([^)]*T177_PRIVATE_CANARY/],
  ["private-canary-beacon", /sendBeacon\s*\([^)]*T177_PRIVATE_CANARY/],
  ["private-canary-log", /(?:console|logger)\s*\.\s*(?:log|info|warn|error)\s*\([^)]*T177_PRIVATE_CANARY/],
] as const;

const FORBIDDEN_NATIVE_MARKERS = [
  /@capacitor-community\/admob/i,
  /capacitor-community-admob/i,
  /com\.google\.android\.gms\.ads\.(?!identifier\b)/i,
  /google\.android\.ump/i,
  /user-messaging-platform/i,
  /play-services-ads-identifier/i,
  /androidx\.privacysandbox\.ads/i,
  /android\.adservices\.AD_SERVICES_CONFIG/i,
  /android\.adservices\./i,
  /android\.ext\.adservices/i,
  /com\.google\.android\.gms\.permission\.AD_ID/i,
  /android\.permission\.ACCESS_ADSERVICES_/i,
] as const;

function absolute(relativePath: string): string {
  return path.join(REPO_ROOT, relativePath);
}

function normalizeRelative(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
}

function read(relativePath: string): string {
  return readFileSync(absolute(relativePath), "utf8");
}

function resolveInternalImport(fromFile: string, specifier: string): string | null {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const unresolved = specifier.startsWith("@/")
    ? path.join(REPO_ROOT, "src", specifier.slice(2))
    : path.resolve(path.dirname(fromFile), specifier);
  const candidates = [
    unresolved,
    ...SOURCE_EXTENSIONS.map((extension) => `${unresolved}${extension}`),
    ...SOURCE_EXTENSIONS.map((extension) => path.join(unresolved, `index${extension}`)),
  ];
  return candidates.find((candidate) => {
    try {
      return statSync(candidate).isFile();
    } catch {
      return false;
    }
  }) ?? null;
}

function parseSource(file: string, sourceText: string) {
  return ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
}

function collectModuleSpecifiers(file: string, sourceText = readFileSync(file, "utf8")): string[] {
  const specifiers = new Set<string>();
  const visit = (node: ts.Node) => {
    if (
      (ts.isImportDeclaration(node) || ts.isExportDeclaration(node)) &&
      node.moduleSpecifier &&
      ts.isStringLiteralLike(node.moduleSpecifier)
    ) {
      specifiers.add(node.moduleSpecifier.text);
    }
    if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      specifiers.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  };
  visit(parseSource(file, sourceText));
  return [...specifiers];
}

function buildProductionImportGraph(entry = "src/main.tsx"): Map<string, readonly string[]> {
  const graph = new Map<string, readonly string[]>();
  const pending = [absolute(entry)];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const file = pending.pop();
    if (!file || visited.has(file)) continue;
    visited.add(file);
    const dependencies = collectModuleSpecifiers(file)
      .map((specifier) => resolveInternalImport(file, specifier))
      .filter((dependency): dependency is string => dependency !== null);
    graph.set(normalizeRelative(file), dependencies.map(normalizeRelative).sort());
    pending.push(...dependencies);
  }
  return graph;
}

function findImportPath(
  graph: ReadonlyMap<string, readonly string[]>,
  target: string,
): readonly string[] | null {
  const pending: Array<{ module: string; route: readonly string[] }> = [
    { module: "src/main.tsx", route: ["src/main.tsx"] },
  ];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current.module)) continue;
    visited.add(current.module);
    if (current.module === target) return current.route;
    for (const dependency of graph.get(current.module) ?? []) {
      pending.push({ module: dependency, route: [...current.route, dependency] });
    }
  }
  return null;
}

function findReachableCapabilities(
  graph: ReadonlyMap<string, readonly string[]>,
  sourceReader: (relativePath: string) => string = read,
) {
  return [...graph.keys()].flatMap((relativePath) => {
    const sourceText = sourceReader(relativePath);
    const sourceFile = parseSource(absolute(relativePath), sourceText);
    const bindings = new Set<string>();
    const aliases = new Map<string, string>();
    const externalImports: Array<{ capability: string; evidence: string }> = [];

    sourceFile.forEachChild((node) => {
      if (ts.isImportDeclaration(node) && ts.isStringLiteralLike(node.moduleSpecifier)) {
        const specifier = node.moduleSpecifier.text;
        if (FORBIDDEN_EXTERNAL_IMPORTS.some((value) => specifier.includes(value))) {
          externalImports.push({ capability: "external-ad-import", evidence: specifier });
          const clause = node.importClause;
          if (clause?.name) bindings.add(clause.name.text);
          if (clause?.namedBindings && ts.isNamespaceImport(clause.namedBindings)) {
            bindings.add(clause.namedBindings.name.text);
          }
          if (clause?.namedBindings && ts.isNamedImports(clause.namedBindings)) {
            for (const element of clause.namedBindings.elements) bindings.add(element.name.text);
          }
        }
      }
      if (ts.isVariableStatement(node)) {
        for (const declaration of node.declarationList.declarations) {
          if (
            ts.isIdentifier(declaration.name) &&
            declaration.initializer &&
            ts.isIdentifier(declaration.initializer)
          ) aliases.set(declaration.name.text, declaration.initializer.text);
        }
      }
    });

    let changed = true;
    while (changed) {
      changed = false;
      for (const [alias, target] of aliases) {
        if (bindings.has(target) && !bindings.has(alias)) {
          bindings.add(alias);
          changed = true;
        }
      }
    }

    const boundCalls = [...bindings].flatMap((binding) =>
      [
        ["native-admob-initialize", "initialize"],
        ["native-admob-request", "prepareRewardVideoAd"],
        ["native-admob-show", "showRewardVideoAd"],
      ].flatMap(([capability, method]) =>
        new RegExp(`\\b${binding}\\s*\\.\\s*${method}\\s*\\(`).test(sourceText)
          ? [{ capability, evidence: `${binding}.${method}` }]
          : [],
      ),
    );
    const patternHits = FORBIDDEN_REACHABLE_PATTERNS.flatMap(([capability, pattern]) =>
      pattern.test(sourceText) ? [{ capability, evidence: capability }] : [],
    );
    return [...externalImports, ...boundCalls, ...patternHits].map((violation) => ({
      relativePath,
      ...violation,
    }));
  });
}

function command(commandName: string, args: string[]): string {
  return execFileSync(commandName, args, { cwd: REPO_ROOT, maxBuffer: 256 * 1024 * 1024 })
    .toString("utf8");
}

function searchAllowNoMatch(args: string[]): string {
  const result = spawnSync("rg", args, {
    cwd: REPO_ROOT,
    encoding: "utf8",
    maxBuffer: 256 * 1024 * 1024,
  });
  if (result.status !== 0 && result.status !== 1) {
    throw new Error(`rg failed with status ${result.status}: ${result.stderr}`);
  }
  return result.stdout;
}

function nativeMarkerHits(label: string, text: string) {
  return FORBIDDEN_NATIVE_MARKERS.flatMap((pattern) =>
    pattern.test(text) ? [{ label, marker: pattern.source }] : [],
  );
}

describe("T177-R sensitive/private advertising exclusion", () => {
  const productionGraph = buildProductionImportGraph();

  it("binds all 63 excluded states and lifecycle transitions to current source", () => {
    const missingBindings = SENSITIVE_ADVERTISING_SCENARIOS.flatMap((scenario) => {
      if (!existsSync(absolute(scenario.sourcePath))) return [{ ...scenario, issue: "missing-source" }];
      return read(scenario.sourcePath).includes(scenario.sourceNeedle)
        ? []
        : [{ ...scenario, issue: "missing-needle" }];
    });
    expect(SENSITIVE_ADVERTISING_SCENARIOS).toHaveLength(63);
    expect(new Set(SENSITIVE_ADVERTISING_SCENARIOS.map(({ id }) => id)).size).toBe(63);
    expect(EXCLUDED_TRANSITIONS).toEqual([
      "direct-entry", "navigation", "android-back", "overlay-close", "reload",
      "activity-recreation", "process-death-cold-launch", "offline", "permission-denied",
      "error-recovery",
    ]);
    expect(missingBindings).toEqual([]);
  });

  it("keeps every prompt, copy, provider, controller, import, init, request and show path unreachable", () => {
    const moduleViolations = FORBIDDEN_PRODUCTION_MODULES.flatMap((target) => {
      const route = findImportPath(productionGraph, target);
      return route ? [{ target, route }] : [];
    });
    expect({ moduleViolations, capabilityViolations: findReachableCapabilities(productionGraph) })
      .toEqual({ moduleViolations: [], capabilityViolations: [] });
  });

  it.each(SENSITIVE_ADVERTISING_SCENARIOS)(
    "detects renamed/import-indirected capabilities and private canary sinks at $id",
    (scenario) => {
      const fixture = [
        read(scenario.sourcePath),
        'import { AdMob as PrivateMomentBridge } from "@capacitor-community/admob";',
        "const HiddenBridge = PrivateMomentBridge;",
        "void HiddenBridge.initialize();",
        "void HiddenBridge.prepareRewardVideoAd({});",
        "void HiddenBridge.showRewardVideoAd();",
        "void ConsentInformation.requestConsentInfoUpdate();",
        "void AdProvider; void adController; void adConfig; void RewardedAdPrompt;",
        'fetch("https://invalid.example/T177_PRIVATE_CANARY");',
        'navigator.sendBeacon("/T177_PRIVATE_CANARY", "opaque");',
        'logger.error("T177_PRIVATE_CANARY");',
      ].join("\n");
      const capabilities = findReachableCapabilities(
        new Map([[scenario.sourcePath, []]]),
        () => fixture,
      ).map(({ capability }) => capability);
      expect(capabilities).toEqual(expect.arrayContaining([
        "external-ad-import",
        "ad-provider",
        "ad-controller",
        "ad-config",
        "rewarded-prompt",
        "native-admob-initialize",
        "native-admob-request",
        "native-admob-show",
        "ump-call",
        "private-canary-fetch",
        "private-canary-beacon",
        "private-canary-log",
      ]));
    },
  );

  it("rejects normal source, bundle, Capacitor assets, merged manifest, APK and AAB ad surfaces", () => {
    for (const required of ["dist", "android/app/src/main/assets/public", MERGED_MANIFEST, APK, AAB]) {
      expect(existsSync(absolute(required)), required).toBe(true);
    }
    expect(read("android/app/build.gradle")).not.toContain("com.google.firebase:firebase-analytics");
    expect(read("capacitor.config.ts")).toContain("facebook: false");
    expect(read("src/components/auth-screen/useAuthHandlers.ts")).toContain(
      'handleOAuthSignIn("facebook")',
    );

    const bundleText = searchAllowNoMatch([
      "-n", "-i", "AdProvider|RewardedAdPrompt|Google ad privacy|@capacitor-community/admob|T177_PRIVATE_CANARY|privacyAdsHint|adWatchToEarn|adPrivacyOptions",
      "dist/assets", "android/app/src/main/assets/public/assets",
    ]);
    expect(bundleText).toBe("");

    const mergedManifest = read(MERGED_MANIFEST);
    const apkManifest = command("apkanalyzer", ["manifest", "print", absolute(APK)]);
    const apkPackages = command("apkanalyzer", ["dex", "packages", absolute(APK)]);
    const aabEntries = command("unzip", ["-Z1", absolute(AAB)]);
    const violations = [
      ...nativeMarkerHits("merged-manifest", mergedManifest),
      ...nativeMarkerHits("apk-manifest", apkManifest),
      ...nativeMarkerHits("apk-dex", apkPackages),
      ...nativeMarkerHits("aab-entries", aabEntries),
    ];
    expect(violations).toEqual([]);
  });
});
