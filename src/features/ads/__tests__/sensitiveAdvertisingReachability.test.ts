import { existsSync, readFileSync, statSync } from "node:fs";
import path from "node:path";
import ts from "typescript";
import { describe, expect, it } from "vitest";
import { SENSITIVE_ADVERTISING_SCENARIOS } from "../sensitiveAdvertisingInventory";

const REPO_ROOT = process.cwd();
const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"] as const;
const FORBIDDEN_PRODUCTION_MODULES = [
  "src/contexts/AdContext.tsx",
  "src/lib/adController.ts",
  "src/lib/adConfig.ts",
  "src/components/ads/RewardedAdPrompt.tsx",
  "src/pages/nav-v2/settings/V2SettingsPrivacyPanel.tsx",
] as const;
const FORBIDDEN_EXTERNAL_AD_IMPORTS = [
  "@capacitor-community/admob",
  "google-mobile-ads",
  "user-messaging-platform",
] as const;
const FORBIDDEN_REACHABLE_AD_PATTERNS = [
  ["ad-provider", /\bAdProvider\b/],
  ["ad-controller", /\badController\b/],
  ["ad-config", /\badConfig\b/],
  ["rewarded-prompt", /\bRewardedAdPrompt\b/],
  ["privacy-ad-panel", /\bV2SettingsPrivacyPanel\b/],
  ["native-admob-call", /\bAdMob\s*\.(?:initialize|prepareRewardVideoAd|showRewardVideoAd)\s*\(/],
  ["ump-call", /\bConsentInformation\s*\.(?:requestConsentInfoUpdate|canRequestAds)\b/],
] as const;

const REQUIRED_NATIVE_PLUGIN_ALLOWLIST = [
  "@capacitor-community/safe-area",
  "@capacitor/app",
  "@capacitor/browser",
  "@capacitor/filesystem",
  "@capacitor/haptics",
  "@capacitor/local-notifications",
  "@capacitor/push-notifications",
  "@capacitor/share",
  "@capacitor/splash-screen",
  "@capgo/capacitor-social-login",
] as const;

const NATIVE_AD_REACHABILITY_FILES = [
  "android/capacitor.settings.gradle",
  "android/app/capacitor.build.gradle",
  "android/app/build.gradle",
  "android/app/src/main/AndroidManifest.xml",
  "android/app/proguard-rules.pro",
  "ios/App/CapApp-SPM/Package.swift",
  "ios/App/CapApp-SPM/Package.resolved",
  "ios/App/App.xcodeproj/project.xcworkspace/xcshareddata/swiftpm/Package.resolved",
  "ios/App/App/Info.plist",
  "ios/App/App.xcodeproj/project.pbxproj",
  "ios/debug.xcconfig",
] as const;

const FORBIDDEN_NATIVE_AD_MARKERS = [
  "@capacitor-community/admob",
  "capacitor-community-admob",
  "CapacitorCommunityAdmob",
  "GoogleMobileAds",
  "GoogleUserMessagingPlatform",
  "swift-package-manager-google-mobile-ads",
  "swift-package-manager-google-user-messaging-platform",
  "GADApplicationIdentifier",
  "SKAdNetworkItems",
  "MobileAdsInitProvider",
  "com.google.android.gms.ads.APPLICATION_ID",
  "play-services-ads-identifier",
  "androidx.privacysandbox.ads",
  "ZENFLOW_ADMOB_ANDROID_APP_ID",
  "ZENFLOW_ADMOB_IOS_APP_ID",
] as const;

const REQUIRED_REMOVED_NATIVE_AD_PERMISSIONS = [
  "com.google.android.gms.permission.AD_ID",
  "android.permission.ACCESS_ADSERVICES_ATTRIBUTION",
  "android.permission.ACCESS_ADSERVICES_AD_ID",
  "android.permission.ACCESS_ADSERVICES_CUSTOM_AUDIENCE",
  "android.permission.ACCESS_ADSERVICES_TOPICS",
] as const;

function normalizeRelative(file: string): string {
  return path.relative(REPO_ROOT, file).split(path.sep).join("/");
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

function collectModuleSpecifiers(
  file: string,
  sourceText = readFileSync(file, "utf8"),
): string[] {
  const sourceFile = ts.createSourceFile(
    file,
    sourceText,
    ts.ScriptTarget.Latest,
    true,
    file.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
  );
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

  visit(sourceFile);
  return [...specifiers];
}

function buildProductionImportGraph(entry = "src/main.tsx"): Map<string, readonly string[]> {
  const graph = new Map<string, readonly string[]>();
  const pending = [path.join(REPO_ROOT, entry)];
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
  const pending: Array<{ module: string; path: readonly string[] }> = [
    { module: "src/main.tsx", path: ["src/main.tsx"] },
  ];
  const visited = new Set<string>();

  while (pending.length > 0) {
    const current = pending.shift();
    if (!current || visited.has(current.module)) continue;
    visited.add(current.module);
    if (current.module === target) return current.path;
    for (const dependency of graph.get(current.module) ?? []) {
      pending.push({ module: dependency, path: [...current.path, dependency] });
    }
  }

  return null;
}

function findReachableAdvertisingCapabilities(
  graph: ReadonlyMap<string, readonly string[]>,
  readSource: (relativePath: string) => string = (relativePath) =>
    readFileSync(path.join(REPO_ROOT, relativePath), "utf8"),
) {
  return [...graph.keys()].flatMap((relativePath) => {
    const sourceText = readSource(relativePath);
    const absolutePath = path.join(REPO_ROOT, relativePath);
    const importViolations = collectModuleSpecifiers(
      absolutePath,
      sourceText,
    )
      .filter((specifier) =>
        FORBIDDEN_EXTERNAL_AD_IMPORTS.some((forbidden) => specifier.includes(forbidden)),
      )
      .map((specifier) => ({ relativePath, capability: "external-ad-import", evidence: specifier }));
    const sourceFile = ts.createSourceFile(
      absolutePath,
      sourceText,
      ts.ScriptTarget.Latest,
      true,
      absolutePath.endsWith("x") ? ts.ScriptKind.TSX : ts.ScriptKind.TS,
    );
    const nativeAdBindings = new Set<string>();
    sourceFile.forEachChild((node) => {
      const moduleSpecifier = ts.isImportDeclaration(node) ? node.moduleSpecifier : null;
      if (
        !ts.isImportDeclaration(node) ||
        !moduleSpecifier ||
        !ts.isStringLiteralLike(moduleSpecifier) ||
        !FORBIDDEN_EXTERNAL_AD_IMPORTS.some((forbidden) =>
          moduleSpecifier.text.includes(forbidden),
        )
      ) return;
      if (node.importClause?.name) nativeAdBindings.add(node.importClause.name.text);
      const bindings = node.importClause?.namedBindings;
      if (bindings && ts.isNamespaceImport(bindings)) nativeAdBindings.add(bindings.name.text);
      if (bindings && ts.isNamedImports(bindings)) {
        for (const element of bindings.elements) nativeAdBindings.add(element.name.text);
      }
    });
    const boundCallViolations = [...nativeAdBindings].flatMap((binding) => {
      const escapedBinding = binding.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      return [
        ["native-admob-initialize", "initialize"],
        ["native-admob-request", "prepareRewardVideoAd"],
        ["native-admob-show", "showRewardVideoAd"],
      ].flatMap(([capability, method]) =>
        new RegExp(`\\b${escapedBinding}\\s*\\.\\s*${method}\\s*\\(`).test(sourceText)
          ? [{ relativePath, capability, evidence: `${binding}.${method}` }]
          : [],
      );
    });
    const patternViolations = FORBIDDEN_REACHABLE_AD_PATTERNS.filter(([, pattern]) =>
      pattern.test(sourceText),
    ).map(([capability]) => ({ relativePath, capability, evidence: capability }));
    return [...importViolations, ...boundCallViolations, ...patternViolations];
  });
}

describe("T177 sensitive advertising production reachability", () => {
  const productionGraph = buildProductionImportGraph();

  it("binds every canonical excluded state to a current production source locator", () => {
    const missingBindings = SENSITIVE_ADVERTISING_SCENARIOS.flatMap((scenario) => {
      const absolutePath = path.join(REPO_ROOT, scenario.sourcePath);
      if (!existsSync(absolutePath)) return [{ ...scenario, issue: "missing-source" }];
      const sourceText = readFileSync(absolutePath, "utf8");
      return sourceText.includes(scenario.sourceNeedle)
        ? []
        : [{ ...scenario, issue: "missing-needle" }];
    });

    expect(SENSITIVE_ADVERTISING_SCENARIOS).toHaveLength(63);
    expect(new Set(SENSITIVE_ADVERTISING_SCENARIOS.map(({ id }) => id)).size).toBe(63);
    expect(missingBindings).toEqual([]);
  });

  it("keeps the negative-control legacy modules present while tracing the real app entry", () => {
    expect(productionGraph.has("src/main.tsx")).toBe(true);
    expect(productionGraph.has("src/pages/Index.tsx")).toBe(true);
    for (const legacyModule of FORBIDDEN_PRODUCTION_MODULES) {
      expect(existsSync(path.join(REPO_ROOT, legacyModule)), legacyModule).toBe(true);
    }
  });

  it("keeps the single production root graph free of prompt, copy, controller, initialize, request, and show capabilities", () => {
    const moduleViolations = FORBIDDEN_PRODUCTION_MODULES.flatMap((target) => {
      const importPath = findImportPath(productionGraph, target);
      return importPath ? [{ target, importPath }] : [];
    });
    const capabilityViolations = findReachableAdvertisingCapabilities(productionGraph);

    expect({ moduleViolations, capabilityViolations }).toEqual({
      moduleViolations: [],
      capabilityViolations: [],
    });
  });

  it("detects renamed direct-package initialize/request/show capabilities as a negative control", () => {
    const fixturePath = "src/negative-controls/renamedBridge.ts";
    const fixtureSource = [
      'import { AdMob as PrivateMomentBridge } from "@capacitor-community/admob";',
      "void PrivateMomentBridge.initialize();",
      "void PrivateMomentBridge.prepareRewardVideoAd({});",
      "void PrivateMomentBridge.showRewardVideoAd();",
      "void ConsentInformation.requestConsentInfoUpdate();",
    ].join("\n");
    const fixtureGraph = new Map([[fixturePath, []]]);
    const violations = findReachableAdvertisingCapabilities(fixtureGraph, () => fixtureSource);

    expect(violations.map(({ capability }) => capability)).toEqual(
      expect.arrayContaining([
        "external-ad-import",
        "native-admob-initialize",
        "native-admob-request",
        "native-admob-show",
        "ump-call",
      ]),
    );
  });

  it.each(SENSITIVE_ADVERTISING_SCENARIOS)(
    "detects every forbidden capability when injected at source-bound state $id",
    (scenario) => {
      const fixtureSource = [
        readFileSync(path.join(REPO_ROOT, scenario.sourcePath), "utf8"),
        'import { AdMob as PrivateMomentBridge } from "@capacitor-community/admob";',
        "void PrivateMomentBridge.initialize();",
        "void PrivateMomentBridge.prepareRewardVideoAd({});",
        "void PrivateMomentBridge.showRewardVideoAd();",
        "void ConsentInformation.requestConsentInfoUpdate();",
        "void AdProvider; void adController; void adConfig; void RewardedAdPrompt; void V2SettingsPrivacyPanel;",
      ].join("\n");
      const fixtureGraph = new Map([[scenario.sourcePath, []]]);
      const capabilities = findReachableAdvertisingCapabilities(
        fixtureGraph,
        () => fixtureSource,
      ).map(({ capability }) => capability);

      expect(capabilities).toEqual(
        expect.arrayContaining([
          "external-ad-import",
          "ad-provider",
          "ad-controller",
          "ad-config",
          "rewarded-prompt",
          "privacy-ad-panel",
          "native-admob-initialize",
          "native-admob-request",
          "native-admob-show",
          "ump-call",
        ]),
      );
    },
  );

  it("excludes the advertising SDK from generated Android and iOS plugin graphs", () => {
    const capacitorConfig = readFileSync(path.join(REPO_ROOT, "capacitor.config.ts"), "utf8");
    for (const plugin of REQUIRED_NATIVE_PLUGIN_ALLOWLIST) {
      expect(capacitorConfig, `missing native plugin allowlist entry: ${plugin}`).toContain(`"${plugin}"`);
    }
    expect(capacitorConfig).not.toContain("@capacitor-community/admob");

    const androidBuild = readFileSync(path.join(REPO_ROOT, "android/app/build.gradle"), "utf8");
    expect(androidBuild).not.toContain("com.google.firebase:firebase-analytics");

    const androidManifest = readFileSync(
      path.join(REPO_ROOT, "android/app/src/main/AndroidManifest.xml"),
      "utf8",
    );
    for (const permission of REQUIRED_REMOVED_NATIVE_AD_PERMISSIONS) {
      const escapedPermission = permission.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
      expect(androidManifest, `missing fail-closed removal for ${permission}`).toMatch(
        new RegExp(
          `<uses-permission\\s+android:name=["']${escapedPermission}["']\\s+tools:node=["']remove["']\\s*/>`,
        ),
      );
    }

    const violations = NATIVE_AD_REACHABILITY_FILES.flatMap((relativePath) => {
      const sourceText = readFileSync(path.join(REPO_ROOT, relativePath), "utf8");
      return FORBIDDEN_NATIVE_AD_MARKERS.filter((marker) => sourceText.includes(marker)).map(
        (marker) => ({ relativePath, marker }),
      );
    });

    expect(violations).toEqual([]);
  });
});
