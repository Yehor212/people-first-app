import { mkdtemp, mkdir, readFile, readdir, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join, relative, sep } from "node:path";
import { afterEach, describe, expect, it } from "vitest";

const temporaryRoots: string[] = [];

async function writeFixture(root: string, relativePath: string, content: string) {
  const absolutePath = join(root, relativePath);
  await mkdir(dirname(absolutePath), { recursive: true });
  await writeFile(absolutePath, content, "utf8");
}

function normalizePath(path: string) {
  return path.split(sep).join("/");
}

function isIgnoredGeneratedPlatformPath(path: string) {
  const normalized = normalizePath(path);
  const ignoredPrefixes = [
    "android/app/src/main/assets/public",
    "ios/App/App/public",
    "ios/App/build",
    "ios/App/Pods",
    "ios/App/DerivedData",
    "ios/App/capacitor-cordova-ios-plugins",
    "src-tauri/target",
  ];
  const ignoredExactPaths = new Set([
    "android/app/src/main/assets/capacitor.config.json",
    "android/app/src/main/assets/capacitor.plugins.json",
    "android/app/src/main/res/xml/config.xml",
    "ios/App/App/capacitor.config.json",
    "ios/App/App/config.xml",
    "src-tauri/gen/schemas/macOS-schema.json",
  ]);

  return (
    ignoredExactPaths.has(normalized) ||
    ignoredPrefixes.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    ) ||
    /(?:^|\/)xcuserdata(?:\/|$)/.test(normalized) ||
    /^src-tauri\/gen\/schemas\/.+ 2\.json$/.test(normalized)
  );
}

async function readSourceRange(
  root: string,
  relativePath: string,
  startLine: number,
  endLine = startLine
) {
  const source = await readFile(join(root, relativePath), "utf8");
  return source
    .split(/\r?\n/)
    .slice(startLine - 1, endLine)
    .join("\n");
}

async function walkFixtureFiles(root: string, relativeRoot: string): Promise<string[]> {
  const absoluteRoot = join(root, relativeRoot);
  try {
    const entries = await readdir(absoluteRoot, { withFileTypes: true });
    const nested = await Promise.all(
      entries.map(async (entry) => {
        const relativePath = join(relativeRoot, entry.name);
        return entry.isDirectory()
          ? walkFixtureFiles(root, relativePath)
          : [normalizePath(relative(root, join(root, relativePath)))];
      })
    );
    return nested.flat().sort((left, right) => left.localeCompare(right));
  } catch {
    return [];
  }
}

async function expectedEligibleAssetPaths(root: string): Promise<string[]> {
  const files = (
    await Promise.all(
      ["public", "src/assets", "android/app/src/main", "ios/App", "src-tauri"].map((path) =>
        walkFixtureFiles(root, path)
      )
    )
  ).flat();
  return [...new Set(files)]
    .filter((path) => !isIgnoredGeneratedPlatformPath(path))
    .filter(
      (path) =>
        path.startsWith("public/") ||
        path.startsWith("src/assets/") ||
        /^android\/app\/src\/main\/(?:assets\/|res\/(?:drawable[^/]*|layout[^/]*|mipmap[^/]*|raw[^/]*)\/)/.test(
          path
        ) ||
        (path.startsWith("ios/App/") &&
          (path.includes(".xcassets/") ||
            path.includes("/Resources/") ||
            /\.(?:storyboard|xib)$/.test(path))) ||
        /^src-tauri\/(?:icons|resources)\//.test(path)
    )
    .sort((left, right) => left.localeCompare(right));
}

async function createFixtureRepository() {
  const root = await mkdtemp(join(tmpdir(), "zenflow-ui-inventory-"));
  temporaryRoots.push(root);

  const files: Record<string, string> = {
    "src/main.tsx": 'import App from "./App";\nvoid App;\n',
    "src/App.tsx": [
      'import { UsedButton } from "./components/UsedButton";',
      'import { RoutePage } from "./pages/RoutePage";',
      'const LazyPanel = import("./components/LazyPanel");',
      "export default function App() {",
      "  return <main><UsedButton /><RoutePage />{String(LazyPanel)}</main>;",
      "}",
    ].join("\n"),
    "src/components/UsedButton.tsx":
      'export function UsedButton() { return <button className="z-50" type="button">Use</button>; }\n',
    "src/components/LazyPanel.tsx":
      'export function LazyPanel() { return <section role="dialog">Lazy</section>; }\n',
    "src/components/OverlayLayer.tsx": [
      'import { OverlayOnly } from "./OverlayOnly";',
      "export function OverlayLayer() { return <OverlayOnly />; }",
    ].join("\n"),
    "src/components/OverlayOnly.tsx": [
      "export function OverlayOnly() {",
      "  return <>",
      '    <div role="dialog">First</div><div role="dialog">Second</div>',
      '    <div role="menu">Menu</div>',
      '    <div role="status">Status</div>',
      '    <div role="alert">Alert</div>',
      "  </>;",
      "}",
    ].join("\n"),
    "src/components/Orphan.tsx":
      'export function Orphan() { return <aside aria-label="orphan">Orphan</aside>; }\n',
    "src/components/__tests__/UsedButton.test.tsx":
      'import { UsedButton } from "../UsedButton"; void UsedButton;\n',
    "src/components/CoLocated.test.tsx":
      "export function CoLocatedTestOnly() { return <div>test only</div>; }\n",
    "src/components/fixtures/FakeProductionCard.tsx":
      "export function FakeProductionCard() { return <div>fixture only</div>; }\n",
    "src/dev/ui-system-preview/UiSystemPreview.tsx":
      "export function UiSystemPreview() { return <main>development preview only</main>; }\n",
    "src/pages/RoutePage.tsx":
      'export function RoutePage() { return <nav aria-label="Route"><a href="/settings">Settings</a></nav>; }\n',
    "src/pages/InstallPrompt.tsx":
      "export function InstallPrompt() { return <button>Install app</button>; }\n",
    "src/features/journal/JournalSheet.tsx":
      'export function JournalSheet() { return <div role="dialog" data-sheet>Journal</div>; }\n',
    "src/contexts/FixtureProvider.tsx":
      "export function FixtureProvider({ children }) { return <section>{children}</section>; }\n",
    "src/lib/motion/components/FixtureMotion.tsx":
      "export function FixtureMotion() { return <span>motion</span>; }\n",
    "src/i18n/en.ts":
      'export const translations = { banner: "Dialog banner copy is not a mounted surface" };\n',
    "src/styles/theme.css": ":root { --color-surface: #fff; }\n",
    "src/index.css": ":root { --root-surface: #fff; }\n",
    "src/design-tokens/tokens.json": '{"color":{"surface":{"value":"#fff"}}}\n',
    "src/generated/GeneratedCard.tsx":
      "export function GeneratedCard() { return <div>generated</div>; }\n",
    "public/manifest.webmanifest": '{"name":"Fixture PWA"}\n',
    "public/icons/app.png": "fixture-binary-placeholder\n",
    "public/icons/app.svg": '<svg viewBox="0 0 24 24"></svg>\n',
    "public/404.html": "<!doctype html><title>Not found</title>\n",
    "public/delete-account.html": "<!doctype html><title>Delete account</title>\n",
    "public/offline.html": "<!doctype html><title>Offline</title><button>Retry</button>\n",
    "public/privacy.html": "<!doctype html><title>Privacy</title>\n",
    "public/privacy-policy.html": "<!doctype html><title>Privacy policy</title>\n",
    "public/terms.html": "<!doctype html><title>Terms</title>\n",
    "src/assets/habit-icons/fixture/reduced.svg": '<svg viewBox="0 0 24 24"></svg>\n',
    "src/assets/habit-icons/fixture/idle.lottie.json": '{"v":"5.10.0"}\n',
    "src/assets/habit-icons/manifest.json": '{"assets":[]}\n',
    "android/app/src/main/AndroidManifest.xml": "<manifest />\n",
    "android/app/src/main/assets/runtime.json": "{}\n",
    "android/app/src/main/res/drawable/widget_background.xml": "<shape />\n",
    "android/app/src/main/res/layout/activity_main.xml":
      '<WebView android:layout_width="match_parent" />\n',
    "android/app/src/main/res/layout/widget_mini.xml": "<LinearLayout />\n",
    "android/app/src/main/res/layout/widget_small.xml": "<LinearLayout />\n",
    "android/app/src/main/res/layout/widget_medium.xml": "<LinearLayout />\n",
    "android/app/src/main/res/layout/widget_large.xml": "<LinearLayout />\n",
    "android/app/src/main/res/mipmap-hdpi/ic_launcher.png": "fixture\n",
    "android/app/src/main/res/raw/reminder.mp3": "fixture\n",
    "ios/App/App/AppDelegate.swift": "import UIKit\n",
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/Contents.json": "{}\n",
    "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png": "fixture\n",
    "ios/App/App/Base.lproj/LaunchScreen.storyboard": "<document />\n",
    "ios/App/App/Resources/privacy-shield.svg": "<svg />\n",
    "src-tauri/src/main.rs": "fn main() {}\n",
    "src-tauri/icons/icon.png": "fixture\n",
    "src-tauri/resources/tray.svg": "<svg />\n",
    "src-tauri/target/debug/build/generated.rs": "fn generated() {}\n",
    "e2e/settings.spec.ts": "test('settings route', async () => {});\n",
    "docs/superpowers/specs/settings.md": "# Settings specification\n",
    "docs/audits/experience-quality/existing.md": "# Existing audit\n",
    "dist/assets/GeneratedBundle.tsx":
      "export function GeneratedBundle() { return <div>bundle</div>; }\n",
    "output/screenshots/Result.tsx": "export function Result() { return <div>output</div>; }\n",
  };

  await Promise.all(
    Object.entries(files).map(([relativePath, content]) =>
      writeFixture(root, relativePath, content)
    )
  );
  return root;
}

async function loadCollector() {
  const collectorPath = "../ui-audit/collect-ui-inventory.mjs";
  try {
    return await import(/* @vite-ignore */ collectorPath);
  } catch (error) {
    expect.fail(`UI inventory collector must be importable: ${String(error)}`);
  }
}

afterEach(async () => {
  await Promise.all(temporaryRoots.splice(0).map((root) => rm(root, { recursive: true })));
});

describe("collectUiInventory", () => {
  it("counts every production TSX component while excluding tests, fixtures, the dedicated development preview, generated bundles, and output", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();

    const inventory = await collector.collectUiInventory({ repositoryRoot });
    const componentPaths = inventory.components.map(
      (component: { path: string }) => component.path
    );

    expect(componentPaths).toEqual([
      "src/App.tsx",
      "src/components/LazyPanel.tsx",
      "src/components/Orphan.tsx",
      "src/components/OverlayLayer.tsx",
      "src/components/OverlayOnly.tsx",
      "src/components/UsedButton.tsx",
      "src/contexts/FixtureProvider.tsx",
      "src/features/journal/JournalSheet.tsx",
      "src/lib/motion/components/FixtureMotion.tsx",
      "src/main.tsx",
      "src/pages/InstallPrompt.tsx",
      "src/pages/RoutePage.tsx",
    ]);
    expect(componentPaths).not.toContain("src/components/__tests__/UsedButton.test.tsx");
    expect(componentPaths).not.toContain("src/components/CoLocated.test.tsx");
    expect(componentPaths).not.toContain("src/components/fixtures/FakeProductionCard.tsx");
    expect(componentPaths).not.toContain("src/dev/ui-system-preview/UiSystemPreview.tsx");
    expect(componentPaths).not.toContain("src/generated/GeneratedCard.tsx");
    expect(componentPaths).not.toContain("dist/assets/GeneratedBundle.tsx");
    expect(componentPaths).not.toContain("output/screenshots/Result.tsx");
    expect(inventory.summary.productionTsxFiles).toBe(12);
    expect(inventory.coverage.productionTsxUnclassified).toEqual([]);
    expect(
      inventory.surfaceCandidates.map((surface: { path: string }) => surface.path)
    ).not.toContain("src/i18n/en.ts");
    expect(
      inventory.components.find(
        (component: { path: string }) => component.path === "src/contexts/FixtureProvider.tsx"
      )
    ).toMatchObject({ layer: "foundation", disposition: "keep" });
  });

  it("builds reachability only from actual app roots and keeps unmounted layer candidates under review", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();

    const inventory = await collector.collectUiInventory({ repositoryRoot });
    const byPath = new Map(
      inventory.components.map((component: { path: string }) => [component.path, component])
    );

    expect(inventory.graph.entrypoints).toEqual(["src/App.tsx", "src/main.tsx"]);
    expect(inventory.graph.layerCandidates).toEqual(["src/components/OverlayLayer.tsx"]);
    expect(byPath.get("src/components/UsedButton.tsx")).toMatchObject({
      reachability: "VERIFIED",
      disposition: "keep",
    });
    expect(byPath.get("src/components/LazyPanel.tsx")).toMatchObject({
      reachability: "VERIFIED",
      disposition: "keep",
    });
    expect(byPath.get("src/components/OverlayLayer.tsx")).toMatchObject({
      reachability: "UNVERIFIED",
      disposition: "keep",
    });
    expect(byPath.get("src/components/OverlayOnly.tsx")).toMatchObject({
      reachability: "UNVERIFIED",
      disposition: "keep",
    });
    expect(byPath.get("src/components/Orphan.tsx")).toMatchObject({
      reachability: "UNVERIFIED",
      disposition: "keep",
    });
  });

  it("records test/spec coverage roots and native or desktop entries without upgrading them to runtime proof", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();

    const inventory = await collector.collectUiInventory({ repositoryRoot });

    expect(inventory.evidenceRoots).toEqual({
      auditDocs: ["docs/audits/experience-quality/existing.md"],
      e2e: ["e2e/settings.spec.ts"],
      sourceTests: [
        "src/components/__tests__/UsedButton.test.tsx",
        "src/components/CoLocated.test.tsx",
      ],
      specifications: ["docs/superpowers/specs/settings.md"],
    });
    expect(inventory.platforms.android).toMatchObject({
      status: "VERIFIED",
      evidence: expect.arrayContaining(["android/app/src/main/AndroidManifest.xml"]),
      entrypoints: ["android/app/src/main/AndroidManifest.xml"],
      runtimeStatus: "UNVERIFIED",
    });
    expect(inventory.platforms.ios).toMatchObject({
      status: "VERIFIED",
      evidence: expect.arrayContaining(["ios/App/App/AppDelegate.swift"]),
      entrypoints: ["ios/App/App/AppDelegate.swift"],
      runtimeStatus: "UNVERIFIED",
    });
    expect(inventory.platforms.desktop).toMatchObject({
      status: "VERIFIED",
      evidence: expect.arrayContaining(["src-tauri/src/main.rs"]),
      entrypoints: ["src-tauri/src/main.rs"],
      runtimeStatus: "UNVERIFIED",
    });
    expect(inventory.platforms.desktop.evidence).not.toContain(
      "src-tauri/target/debug/build/generated.rs"
    );
    expect(inventory.tokens.aliases).toContainEqual({
      token: "--root-surface",
      evidence: "src/index.css:1",
    });
    expect(inventory.tokens.zIndex).toContainEqual({
      value: "z-50",
      evidence: "src/components/UsedButton.tsx:1",
    });
  });

  it("emits every mandatory component, token, asset, and candidate field without unsafe dispositions", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();
    const inventory = await collector.collectUiInventory({ repositoryRoot });

    const requiredSurfaceFields = [
      "routeOrEntry",
      "sourceEntry",
      "userJob",
      "sharedPrimitives",
      "platforms",
      "presentations",
      "themes",
      "locales",
      "inputs",
      "states",
      "destructiveActions",
      "permissionDependencies",
      "systemDependencies",
      "behaviorTests",
      "accessibilityTests",
      "knownSpecs",
      "visualEvidence",
      "status",
    ];
    for (const surface of inventory.surfaces) {
      expect(Object.keys(surface)).toEqual(expect.arrayContaining(requiredSurfaceFields));
    }
    const candidateIds = new Set<string>();
    for (const candidate of inventory.surfaceCandidates) {
      expect(Object.keys(candidate)).toEqual(
        expect.arrayContaining([
          "candidateId",
          "matchedToken",
          "blockers",
          ...requiredSurfaceFields,
        ])
      );
      expect(candidate.candidateId).toMatch(/^candidate:/);
      expect(candidate.blockers.length).toBeGreaterThan(0);
      expect(candidate.userJob).toBe("UNVERIFIED");
      expect(candidateIds.has(candidate.candidateId)).toBe(false);
      candidateIds.add(candidate.candidateId);
      const sourceLine = await readSourceRange(
        repositoryRoot,
        candidate.path,
        Number(candidate.evidence.match(/:(\d+)$/)?.[1])
      );
      expect(sourceLine).toContain(candidate.matchedToken);
    }
    const requiredComponentFields = [
      "symbol",
      "path",
      "semanticRole",
      "variants",
      "states",
      "tokenDependencies",
      "duplicateCandidates",
      "owners",
      "usageLocators",
      "platformAssumptions",
      "testLocators",
      "disposition",
    ];
    for (const component of inventory.components) {
      expect(Object.keys(component)).toEqual(expect.arrayContaining(requiredComponentFields));
      expect(["keep", "consolidate", "replace", "retire"]).toContain(component.disposition);
    }
    expect(inventory.tokens.records.length).toBeGreaterThan(0);
    for (const token of inventory.tokens.records) {
      expect(Object.keys(token)).toEqual(
        expect.arrayContaining([
          "id",
          "sourcePath",
          "generatedOutputs",
          "semanticRole",
          "themeMappings",
          "runtimeUsages",
          "rawValueExceptions",
          "status",
        ])
      );
    }
    expect(inventory.assets.records.length).toBeGreaterThan(0);
    for (const asset of inventory.assets.records) {
      expect(Object.keys(asset)).toEqual(
        expect.arrayContaining([
          "id",
          "path",
          "sourceAuthorLicense",
          "semanticPurpose",
          "platformSurfaces",
          "sizeOrViewBox",
          "strokeFillLanguage",
          "opticalAdjustment",
          "rtlRule",
          "accessibilityTreatment",
          "themeVariants",
          "testEvidence",
          "disposition",
        ])
      );
    }
  });

  it("records every lexical surface occurrence without treating it as an adjudicated surface", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();
    const inventory = await collector.collectUiInventory({ repositoryRoot });
    const occurrenceCandidates = inventory.surfaceCandidates
      .filter(
        (candidate: { path: string; matchedToken?: string }) =>
          candidate.path === "src/components/OverlayOnly.tsx" &&
          candidate.matchedToken?.startsWith('role="')
      )
      .map(
        (candidate: {
          candidateId: string;
          kind: string;
          evidence: string;
          matchedToken: string;
          userJob: string;
          status: string;
          blockers: string[];
        }) => ({
          candidateId: candidate.candidateId,
          kind: candidate.kind,
          evidence: candidate.evidence,
          matchedToken: candidate.matchedToken,
          userJob: candidate.userJob,
          status: candidate.status,
          blocker: candidate.blockers[0],
        })
      );

    expect(occurrenceCandidates).toEqual([
      {
        candidateId: "candidate:banner:src/components/OverlayOnly.tsx:5:1",
        kind: "banner",
        evidence: "src/components/OverlayOnly.tsx:5",
        matchedToken: 'role="status"',
        userJob: "UNVERIFIED",
        status: "INFERENCE",
        blocker:
          'Lexical banner occurrence role="status" at src/components/OverlayOnly.tsx:5 has not been adjudicated into a mounted user-visible surface.',
      },
      {
        candidateId: "candidate:banner:src/components/OverlayOnly.tsx:6:1",
        kind: "banner",
        evidence: "src/components/OverlayOnly.tsx:6",
        matchedToken: 'role="alert"',
        userJob: "UNVERIFIED",
        status: "INFERENCE",
        blocker:
          'Lexical banner occurrence role="alert" at src/components/OverlayOnly.tsx:6 has not been adjudicated into a mounted user-visible surface.',
      },
      {
        candidateId: "candidate:dialog:src/components/OverlayOnly.tsx:3:1",
        kind: "dialog",
        evidence: "src/components/OverlayOnly.tsx:3",
        matchedToken: 'role="dialog"',
        userJob: "UNVERIFIED",
        status: "INFERENCE",
        blocker:
          'Lexical dialog occurrence role="dialog" at src/components/OverlayOnly.tsx:3 has not been adjudicated into a mounted user-visible surface.',
      },
      {
        candidateId: "candidate:dialog:src/components/OverlayOnly.tsx:3:2",
        kind: "dialog",
        evidence: "src/components/OverlayOnly.tsx:3",
        matchedToken: 'role="dialog"',
        userJob: "UNVERIFIED",
        status: "INFERENCE",
        blocker:
          'Lexical dialog occurrence role="dialog" at src/components/OverlayOnly.tsx:3 has not been adjudicated into a mounted user-visible surface.',
      },
      {
        candidateId: "candidate:menu:src/components/OverlayOnly.tsx:4:1",
        kind: "menu",
        evidence: "src/components/OverlayOnly.tsx:4",
        matchedToken: 'role="menu"',
        userJob: "UNVERIFIED",
        status: "INFERENCE",
        blocker:
          'Lexical menu occurrence role="menu" at src/components/OverlayOnly.tsx:4 has not been adjudicated into a mounted user-visible surface.',
      },
    ]);
    expect(
      inventory.surfaces.some(
        (surface: { sourceEntry: string }) =>
          surface.sourceEntry === "src/components/OverlayOnly.tsx:3"
      )
    ).toBe(false);
  });

  it("records native layouts and public HTML as blocker-backed surface rows", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();
    const inventory = await collector.collectUiInventory({ repositoryRoot });
    const requiredSurfaceEntries = [
      "android-layout:activity_main",
      "android-layout:widget_large",
      "android-layout:widget_medium",
      "android-layout:widget_mini",
      "android-layout:widget_small",
      "/404.html",
      "/delete-account.html",
      "/offline.html",
      "/privacy-policy.html",
      "/privacy.html",
      "/terms.html",
    ];
    const byEntry = new Map(
      inventory.surfaces.map((surface: { routeOrEntry: string }) => [surface.routeOrEntry, surface])
    );

    expect([...byEntry.keys()].sort()).toEqual(requiredSurfaceEntries.sort());
    for (const entry of requiredSurfaceEntries) {
      expect(byEntry.get(entry)).toEqual(
        expect.objectContaining({
          routeOrEntry: entry,
          status: "UNVERIFIED",
          userJob: "UNVERIFIED",
          blockers: expect.arrayContaining([expect.stringContaining("UNVERIFIED")]),
        })
      );
    }
  });

  it("maps every eligible cross-platform asset exactly, including motion assets", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();
    const inventory = await collector.collectUiInventory({ repositoryRoot });

    const expected = await expectedEligibleAssetPaths(repositoryRoot);
    expect(inventory.assets.files).toEqual(expected);
    expect(inventory.assets.records.map((asset: { path: string }) => asset.path)).toEqual(expected);
    const assetIds = inventory.assets.records.map((asset: { id: string }) => asset.id);
    expect(new Set(assetIds).size).toBe(assetIds.length);
    expect(assetIds).toEqual(expected);
    expect(inventory.assets.records).toContainEqual(
      expect.objectContaining({
        path: "src/assets/habit-icons/fixture/idle.lottie.json",
        sourceAuthorLicense: "UNVERIFIED",
        rtlRule: "UNVERIFIED",
        accessibilityTreatment: "UNVERIFIED",
        disposition: "KEEP",
      })
    );
    expect(
      inventory.assets.records.find(
        (asset: { path: string }) => asset.path === "src/assets/habit-icons/fixture/reduced.svg"
      )?.semanticPurpose
    ).toBe("Visual asset; exact semantic purpose UNVERIFIED.");
    expect(
      inventory.assets.records.find(
        (asset: { path: string }) => asset.path === "src/assets/habit-icons/manifest.json"
      )?.semanticPurpose
    ).toBe("Asset manifest; exact semantic purpose and runtime use UNVERIFIED.");
    expect(
      inventory.assets.records.find(
        (asset: { path: string }) =>
          asset.path === "android/app/src/main/res/layout/activity_main.xml"
      )?.semanticPurpose
    ).toBe("Android native layout resource; runtime semantics and visibility UNVERIFIED.");
    expect(collector.renderInventoryDocuments(inventory).system).toContain(
      `Eligible cross-platform asset records: ${expected.length}.`
    );
  });

  it("collects independently with deterministic results", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();

    const first = await collector.collectUiInventory({ repositoryRoot, subjectSha: "fixture-sha" });
    const second = await collector.collectUiInventory({
      repositoryRoot,
      subjectSha: "fixture-sha",
    });

    expect(second).toEqual(first);
    expect(collector.renderInventoryDocuments(second)).toEqual(
      collector.renderInventoryDocuments(first)
    );
  });

  it("ignores generated native build and sync outputs without dropping tracked platform sources", async () => {
    const collector = await loadCollector();
    const repositoryRoot = await createFixtureRepository();
    const subjectSha = "fixture-generated-output-sha";

    const beforeGeneratedOutputs = await collector.collectUiInventory({
      repositoryRoot,
      subjectSha,
    });

    await Promise.all([
      writeFixture(
        repositoryRoot,
        "android/app/src/main/assets/public/assets/generated.js",
        "generated web bundle\n"
      ),
      writeFixture(
        repositoryRoot,
        "android/app/src/main/assets/capacitor.config.json",
        '{"generated":true}\n'
      ),
      writeFixture(
        repositoryRoot,
        "android/app/src/main/assets/capacitor.plugins.json",
        '{"generated":true}\n'
      ),
      writeFixture(repositoryRoot, "android/app/src/main/res/xml/config.xml", "<generated />\n"),
      writeFixture(repositoryRoot, "ios/App/App/public/assets/generated.js", "generated bundle\n"),
      writeFixture(repositoryRoot, "ios/App/App/capacitor.config.json", '{"generated":true}\n'),
      writeFixture(repositoryRoot, "ios/App/App/config.xml", "<generated />\n"),
      writeFixture(repositoryRoot, "ios/App/build/DerivedSources/generated.swift", "generated\n"),
      writeFixture(repositoryRoot, "ios/App/Pods/Generated/Plugin.swift", "generated\n"),
      writeFixture(
        repositoryRoot,
        "src-tauri/gen/schemas/macOS-schema.json",
        '{"generated":true}\n'
      ),
      writeFixture(
        repositoryRoot,
        "src-tauri/gen/schemas/desktop-schema 2.json",
        '{"generated":true}\n'
      ),
    ]);

    const afterGeneratedOutputs = await collector.collectUiInventory({
      repositoryRoot,
      subjectSha,
    });

    expect(afterGeneratedOutputs).toEqual(beforeGeneratedOutputs);
    expect(beforeGeneratedOutputs.platforms.android.evidence).toContain(
      "android/app/src/main/AndroidManifest.xml"
    );
    expect(beforeGeneratedOutputs.platforms.ios.evidence).toContain(
      "ios/App/App/AppDelegate.swift"
    );
    expect(beforeGeneratedOutputs.platforms.desktop.evidence).toContain("src-tauri/src/main.rs");
    expect(beforeGeneratedOutputs.assets.files).toEqual(
      expect.arrayContaining([
        "android/app/src/main/res/layout/activity_main.xml",
        "ios/App/App/Assets.xcassets/AppIcon.appiconset/AppIcon.png",
        "src-tauri/icons/icon.png",
      ])
    );
  });

  it("covers real production TSX, canonical routes, settings details, handoffs, and checked-in bytes", async () => {
    const collector = await loadCollector();
    const repositoryRoot = process.cwd();
    const inventory = await collector.collectUiInventory({
      repositoryRoot,
      subjectSha: "e5016f156497a9d3e55578b773294bf56adce58e",
    });
    const independentInventory = await collector.collectUiInventory({
      repositoryRoot,
      subjectSha: "e5016f156497a9d3e55578b773294bf56adce58e",
    });
    const routes = new Set(
      inventory.surfaces.map((surface: { routeOrEntry: string }) => surface.routeOrEntry)
    );

    expect(inventory.coverage.productionTsxUnclassified).toEqual([]);
    expect(inventory.surfaces).toHaveLength(22);
    for (const surface of inventory.surfaces) {
      expect(Object.keys(surface)).toEqual(
        expect.arrayContaining([
          "routeOrEntry",
          "sourceEntry",
          "userJob",
          "sharedPrimitives",
          "platforms",
          "presentations",
          "themes",
          "locales",
          "inputs",
          "states",
          "destructiveActions",
          "permissionDependencies",
          "systemDependencies",
          "behaviorTests",
          "accessibilityTests",
          "knownSpecs",
          "visualEvidence",
          "status",
        ])
      );
    }
    for (const route of ["/orb", "/habits", "/diary", "/planning", "/settings", "/desktop"]) {
      expect(routes).toContain(route);
    }
    for (const detail of ["account", "appearance", "sound", "notifications", "privacy"]) {
      expect(routes).toContain(`/settings?settingsSection=${detail}`);
    }
    for (const platformEntry of [
      "android-layout:activity_main",
      "android-layout:widget_large",
      "android-layout:widget_medium",
      "android-layout:widget_mini",
      "android-layout:widget_small",
      "/404.html",
      "/delete-account.html",
      "/offline.html",
      "/privacy-policy.html",
      "/privacy.html",
      "/terms.html",
    ]) {
      expect(routes).toContain(platformEntry);
      const surface = inventory.surfaces.find(
        (candidate: { routeOrEntry: string }) => candidate.routeOrEntry === platformEntry
      );
      expect(surface).toMatchObject({
        routeOrEntry: platformEntry,
        userJob: "UNVERIFIED",
        status: "UNVERIFIED",
        blockers: expect.arrayContaining([expect.stringContaining("UNVERIFIED")]),
      });
    }
    expect(inventory.handoffMappings.map((mapping: { id: string }) => mapping.id)).toEqual([
      "android-auth-open-url",
      "android-challenge-app-link",
      "android-challenge-custom-scheme",
      "android-diary-editor",
      "android-diary-mood",
      "desktop-launch",
      "ios-auth-open-url",
      "ios-challenge-open-url",
      "ios-challenge-universal-link",
      "ios-diary-editor-open-url",
      "ios-diary-mood-open-url",
      "pwa-install",
      "pwa-launch",
      "pwa-offline",
      "pwa-update",
    ]);
    expect(
      inventory.handoffMappings
        .filter((mapping: { id: string }) => mapping.id.includes("challenge"))
        .map((mapping: { destination: string }) => mapping.destination)
    ).toEqual([
      "Challenge invite modal",
      "Challenge invite modal",
      "Challenge invite modal",
      "Challenge invite modal",
    ]);
    const diaryMappings = inventory.handoffMappings.filter((mapping: { id: string }) =>
      mapping.id.includes("diary")
    );
    expect(diaryMappings.map((mapping: { destination: string }) => mapping.destination)).toEqual([
      "Diary editor at /diary",
      "Diary mood handoff at /diary",
      "Diary editor at /diary",
      "Diary mood handoff at /diary",
    ]);
    for (const mapping of diaryMappings) {
      expect(mapping.evidenceLocators).toEqual(
        expect.arrayContaining([
          "src/lib/deepLinks.ts:60-75",
          "src/lib/deepLinks.ts:113-124",
          "src/lib/deepLinks.ts:139-150",
          "src/components/navigation-v2/NavV2Orchestrator.tsx:199-209",
        ])
      );
    }
    const authMappings = inventory.handoffMappings.filter((mapping: { id: string }) =>
      mapping.id.includes("auth")
    );
    for (const mapping of authMappings) {
      expect(mapping.webEntry).toBe("src/hooks/useDeepLinkHandler.ts:278-332");
      expect(mapping.evidenceLocators).toContain("src/hooks/useDeepLinkHandler.ts:278-332");
    }
    const challengeMappings = inventory.handoffMappings.filter((mapping: { id: string }) =>
      mapping.id.includes("challenge")
    );
    for (const mapping of challengeMappings) {
      expect(mapping.webEntry).toBe("src/hooks/useDeepLinkHandler.ts:98-130");
      expect(mapping.evidenceLocators).toEqual(
        expect.arrayContaining([
          "src/hooks/useDeepLinkHandler.ts:98-130",
          "src/hooks/useDeepLinkHandler.ts:334-349",
        ])
      );
    }
    expect(
      challengeMappings.find(
        (mapping: { id: string }) => mapping.id === "android-challenge-app-link"
      )
    ).toMatchObject({
      nativeEntry: "android/app/src/main/AndroidManifest.xml:84-101",
      evidenceLocators: expect.arrayContaining(["android/app/src/main/AndroidManifest.xml:84-101"]),
    });
    const pwaMappings = inventory.handoffMappings.filter((mapping: { id: string }) =>
      mapping.id.startsWith("pwa-")
    );
    expect(pwaMappings.map((mapping: { id: string }) => mapping.id)).toEqual([
      "pwa-install",
      "pwa-launch",
      "pwa-offline",
      "pwa-update",
    ]);
    expect(new Set(pwaMappings.map((mapping: { blocker: string }) => mapping.blocker)).size).toBe(
      4
    );
    const pwaOfflineMapping = pwaMappings.find(
      (mapping: { id: string }) => mapping.id === "pwa-offline"
    );
    expect(pwaOfflineMapping?.evidenceLocators).toContain("src/sw.ts:309-327");
    expect(pwaOfflineMapping?.evidenceLocators).not.toContain("src/main.tsx:561-580");
    expect(await readSourceRange(repositoryRoot, "src/lib/deepLinks.ts", 60, 75)).toContain(
      'const validRoutes = ["mood", "editor"]'
    );
    expect(await readSourceRange(repositoryRoot, "src/lib/deepLinks.ts", 113, 124)).toContain(
      "dispatchDeepLinkEvent(data)"
    );
    expect(await readSourceRange(repositoryRoot, "src/hooks/useDeepLinkHandler.ts", 98, 130)).toEqual(
      expect.stringContaining('parsedUrl.hostname === "zenflow.app"')
    );
    expect(
      await readSourceRange(
        repositoryRoot,
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        199,
        209
      )
    ).toContain('data.route === "editor"');
    expect(
      await readSourceRange(repositoryRoot, "android/app/src/main/AndroidManifest.xml", 64, 72)
    ).toContain('android:host="challenge"');
    const androidChallengeAppLinkSource = await readSourceRange(
      repositoryRoot,
      "android/app/src/main/AndroidManifest.xml",
      84,
      101
    );
    expect(androidChallengeAppLinkSource).toContain('android:path="/challenge"');
    expect(androidChallengeAppLinkSource).toContain('android:pathPrefix="/challenge/"');
    expect(
      await readSourceRange(repositoryRoot, "ios/App/App/AppDelegate.swift", 20, 24)
    ).toContain("open url");
    expect(
      await readSourceRange(repositoryRoot, "ios/App/App/AppDelegate.swift", 26, 30)
    ).toContain("continue userActivity");

    const rendered = collector.renderInventoryDocuments(inventory);
    expect(collector.renderInventoryDocuments(independentInventory)).toEqual(rendered);
    expect(rendered.system).toContain("| routeOrEntry | sourceEntry | userJob |");
    expect(rendered.system).toContain(
      "| id | sourcePath | generatedOutputs[] | semanticRole | themeMappings[] |"
    );
    expect(rendered.system).toContain(
      "| id | path | sourceAuthorLicense | semanticPurpose | platformSurfaces[] |"
    );
    expect(rendered.components).toContain("| symbol | path | semanticRole | variants[] |");
    expect(inventory.boundedRuntimeEvidence).toBeNull();
    expect(rendered.states).toContain("Fresh bounded runtime evidence");
    expect(rendered.states).toContain(
      "No hash-bound runtime receipt was resolved for this subject; runtime remains UNVERIFIED."
    );
    for (const candidate of inventory.surfaceCandidates) {
      expect(rendered.system).toContain(`| ${candidate.candidateId} |`);
      expect(rendered.system).toContain(candidate.blockers[0]);
    }
    expect(inventory.assets.files).toEqual(await expectedEligibleAssetPaths(repositoryRoot));
    expect(inventory.assets.records.map((asset: { id: string }) => asset.id)).toEqual(
      inventory.assets.files
    );
    expect(new Set(inventory.assets.records.map((asset: { id: string }) => asset.id)).size).toBe(
      inventory.assets.records.length
    );
    for (const document of Object.values(rendered) as string[]) {
      expect(document.length).toBeGreaterThan(100);
      expect(document).not.toContain("/Users/");
    }
  }, 60_000);
});
