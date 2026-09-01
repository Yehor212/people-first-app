#!/usr/bin/env node

import { existsSync } from "node:fs";
import { mkdir, readFile, readdir, writeFile } from "node:fs/promises";
import { dirname, extname, join, posix, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";

const STATUS = Object.freeze({
  VERIFIED: "VERIFIED",
  INFERENCE: "INFERENCE",
  ASSUMPTION: "ASSUMPTION",
  UNVERIFIED: "UNVERIFIED",
  NA: "N/A",
});

const PRODUCTION_ROOTS = [
  "src",
  "src/components",
  "src/pages",
  "src/features",
  "src/styles",
  "src/design-tokens",
  "public",
];

const PLATFORM_ROOTS = {
  android: "android/app/src/main",
  ios: "ios/App",
  desktop: "src-tauri",
};

const EXCLUDED_SEGMENTS = new Set([
  "node_modules",
  "dist",
  "output",
  ".codex-recovery",
  "__tests__",
  "__fixtures__",
  "fixtures",
  "test-fixtures",
  "generated",
  "coverage",
]);
const EXCLUDED_PATH_PREFIXES = [
  "src/dev/ui-system-preview",
  "android/app/src/main/assets/public",
  "ios/App/App/public",
  "ios/App/build",
  "ios/App/Pods",
  "ios/App/DerivedData",
  "ios/App/capacitor-cordova-ios-plugins",
  "src-tauri/target",
];
const EXCLUDED_EXACT_PATHS = new Set([
  "android/app/src/main/assets/capacitor.config.json",
  "android/app/src/main/assets/capacitor.plugins.json",
  "android/app/src/main/res/xml/config.xml",
  "ios/App/App/capacitor.config.json",
  "ios/App/App/config.xml",
  "src-tauri/gen/schemas/macOS-schema.json",
]);
const EXCLUDED_PATH_PATTERNS = [
  /(?:^|\/)xcuserdata(?:\/|$)/,
  /^src-tauri\/gen\/schemas\/.+ 2\.json$/,
];

const SOURCE_EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs"];
const RESOLVABLE_EXTENSIONS = [...SOURCE_EXTENSIONS, ".css", ".json"];
const GENERATED_INVENTORY_DOCUMENTS = new Set([
  "docs/audits/experience-quality/ui-system-inventory-2026-07-28.md",
  "docs/audits/experience-quality/ui-component-inventory-2026-07-28.md",
  "docs/audits/experience-quality/ui-state-coverage-2026-07-28.md",
]);
const SUPPORTED_LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const SUPPORTED_THEMES = ["paper", "ink", "oled", "auto", "high-contrast"];
const PRESENTATIONS = ["compact", "medium", "expanded"];

const SURFACE_PATTERNS = {
  route: /\b(?:Route|route|pathname|searchParams|NavV2Page)\b/,
  "deep-link": /(?:\b(?:deepLink|DeepLink|appUrlOpen)\b|zenflow:\/\/)/,
  dialog: /(?:role\s*=\s*["']dialog["']|\baria-modal\b|\b(?:Dialog|Modal)\b)/,
  sheet: /\b(?:Sheet|sheet|drawer|Drawer)\b/,
  menu: /(?:role\s*=\s*["']menu["']|\b(?:Menu|menu)\b)/,
  banner: /(?:\b(?:Banner|banner)\b|role\s*=\s*["'](?:status|alert)["'])/,
  "native-handoff": /\b(?:Capacitor|isNative|android|iOS|openGooglePlayStore|App\.addListener)\b/,
  "pwa-prompt": /\b(?:beforeinstallprompt|InstallBanner|promptInstall|serviceWorker|PWA)\b/,
  "desktop-entry": /\b(?:Tauri|VITE_DESKTOP_RUNTIME|DesktopDownload|src-tauri)\b/,
};
const COMPONENT_SURFACE_KINDS = new Set(["route", "dialog", "sheet", "menu", "banner"]);

const STATE_PATTERNS = {
  loading: /\b(?:loading|isLoading|pending|Suspense|fallback)\b/i,
  error: /(?:\b(?:error|failed|failure)\b|role\s*=\s*["']alert["'])/i,
  empty: /\b(?:empty|noResults|noData|length\s*===\s*0)\b/i,
  disabled: /\b(?:disabled|aria-disabled)\b/i,
  offline: /\b(?:offline|navigator\.onLine|serviceWorker)\b/i,
  success: /(?:\b(?:success|saved|complete)\b|role\s*=\s*["']status["'])/i,
  permission: /\b(?:permission|denied|granted)\b/i,
  authentication: /\b(?:signed-in|signed-out|auth|session)\b/i,
  "reduced-motion": /\b(?:prefers-reduced-motion|reduceMotion|motion-safe|motion-reduce)\b/i,
};

function normalizePath(path) {
  return path.split(sep).join("/");
}

function sortUnique(values) {
  return [...new Set(values)].sort((left, right) => left.localeCompare(right));
}

function isExcluded(relativePath) {
  const normalized = normalizePath(relativePath);
  const segments = normalized.split("/");
  return (
    EXCLUDED_EXACT_PATHS.has(normalized) ||
    EXCLUDED_PATH_PREFIXES.some(
      (prefix) => normalized === prefix || normalized.startsWith(`${prefix}/`)
    ) ||
    EXCLUDED_PATH_PATTERNS.some((pattern) => pattern.test(normalized)) ||
    segments.some((segment) => EXCLUDED_SEGMENTS.has(segment)) ||
    /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(normalized)
  );
}

async function walkFiles(repositoryRoot, relativeRoot, options = {}) {
  const absoluteRoot = join(repositoryRoot, relativeRoot);
  if (!existsSync(absoluteRoot)) return [];

  const result = [];
  async function visit(absoluteDirectory) {
    const entries = await readdir(absoluteDirectory, { withFileTypes: true });
    entries.sort((left, right) => left.name.localeCompare(right.name));
    for (const entry of entries) {
      const absolutePath = join(absoluteDirectory, entry.name);
      const relativePath = normalizePath(relative(repositoryRoot, absolutePath));
      if (options.exclude !== false && isExcluded(relativePath)) continue;
      if (entry.isDirectory()) {
        await visit(absolutePath);
      } else if (entry.isFile()) {
        result.push(relativePath);
      }
    }
  }
  await visit(absoluteRoot);
  return result;
}

async function readText(repositoryRoot, relativePath) {
  try {
    return await readFile(join(repositoryRoot, relativePath), "utf8");
  } catch {
    return "";
  }
}

function lineNumberAt(source, index) {
  return source.slice(0, index).split("\n").length;
}

function firstEvidence(source, pattern, path) {
  const match = source.match(pattern);
  return match ? `${path}:${lineNumberAt(source, match.index ?? 0)}` : null;
}

function evidenceOccurrences(source, pattern, path) {
  const flags = pattern.flags.includes("g") ? pattern.flags : `${pattern.flags}g`;
  const occurrencePattern = new RegExp(pattern.source, flags);
  const ordinalsByLine = new Map();
  return [...source.matchAll(occurrencePattern)].map((match) => {
    const line = lineNumberAt(source, match.index ?? 0);
    const ordinal = (ordinalsByLine.get(line) ?? 0) + 1;
    ordinalsByLine.set(line, ordinal);
    return {
      evidence: `${path}:${line}`,
      line,
      ordinal,
      matchedToken: match[0],
    };
  });
}

function extractImports(source) {
  const imports = [];
  const patterns = [
    /(?:import|export)\s+(?:[\s\S]*?\s+from\s+)?["']([^"']+)["']/g,
    /import\s*\(\s*["']([^"']+)["']\s*\)/g,
    /require\s*\(\s*["']([^"']+)["']\s*\)/g,
  ];
  for (const pattern of patterns) {
    for (const match of source.matchAll(pattern)) imports.push(match[1]);
  }
  return sortUnique(imports);
}

function resolveImport(repositoryRoot, importerPath, specifier, knownFiles) {
  if (!specifier.startsWith(".") && !specifier.startsWith("@/")) return null;
  const importerDirectory = posix.dirname(importerPath);
  const base = specifier.startsWith("@/")
    ? `src/${specifier.slice(2)}`
    : posix.normalize(posix.join(importerDirectory, specifier));
  const candidates = [
    base,
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${base}${extension}`),
    ...RESOLVABLE_EXTENSIONS.map((extension) => `${base}/index${extension}`),
  ];
  const resolvedPath = candidates.find((candidate) => knownFiles.has(candidate));
  if (!resolvedPath) return null;
  const absolute = resolve(repositoryRoot, resolvedPath);
  if (!absolute.startsWith(`${resolve(repositoryRoot)}${sep}`)) return null;
  return resolvedPath;
}

function extractExports(source, path) {
  const names = [];
  for (const match of source.matchAll(
    /export\s+(?:default\s+)?(?:async\s+)?(?:function|class|const|let|var)\s+([A-Za-z_$][\w$]*)/g
  )) {
    names.push(match[1]);
  }
  if (/export\s+default\b/.test(source) && names.length === 0) {
    names.push(`default:${posix.basename(path, extname(path))}`);
  }
  return sortUnique(names);
}

function classifyLayer(path) {
  const name = posix.basename(path).toLowerCase();
  if (
    path === "src/main.tsx" ||
    path === "src/App.tsx" ||
    path.startsWith("src/contexts/") ||
    /Provider\.tsx$/.test(path)
  ) {
    return "foundation";
  }
  if (path.startsWith("src/pages/")) return "screen";
  if (
    path.includes("/ui/") ||
    /(?:button|input|select|switch|slider|primitive|field|control)/.test(name)
  ) {
    return "primitive";
  }
  return "pattern";
}

function detectVariants(source) {
  const variants = [];
  for (const match of source.matchAll(
    /\b(?:variant|size|presentation)\s*[:=]\s*["']([^"']+)["']/g
  )) {
    variants.push(match[1]);
  }
  if (/\bcva\s*\(/.test(source)) variants.push("cva-configured");
  return sortUnique(variants).length > 0 ? sortUnique(variants) : [STATUS.UNVERIFIED];
}

function detectTokenDependencies(source) {
  return sortUnique([...source.matchAll(/var\(\s*(--[A-Za-z0-9-_]+)/g)].map((match) => match[1]));
}

function detectSemantics(source) {
  const semantics = [];
  const checks = {
    button: /<(?:button|Button)\b/,
    link: /<(?:a|Link)\b/,
    dialog: /(?:role\s*=\s*["']dialog["']|\baria-modal\b|\b(?:Dialog|Modal)\b)/,
    form: /<(?:form|input|select|textarea)\b/,
    navigation: /(?:<nav\b|role\s*=\s*["']navigation["'])/,
    main: /(?:<main\b|role\s*=\s*["']main["'])/,
    status: /role\s*=\s*["'](?:status|alert)["']/,
    heading: /<h[1-6]\b/,
    image: /<(?:img|Image)\b/,
    list: /<(?:ul|ol|li)\b/,
  };
  for (const [semantic, pattern] of Object.entries(checks)) {
    if (pattern.test(source)) semantics.push(semantic);
  }
  return semantics.length > 0 ? semantics : ["UNVERIFIED"];
}

function detectPlatformAssumptions(source) {
  const assumptions = [];
  if (/\b(?:window|document|navigator|Web|browser)\b/.test(source)) {
    assumptions.push("Web/PWA:INFERENCE");
  }
  if (/\b(?:Capacitor|isNative|isAndroid|android)\b/.test(source)) {
    assumptions.push("Android/Capacitor:INFERENCE");
  }
  if (/\b(?:iOS|ios|WKWebView)\b/.test(source)) assumptions.push("iOS/WKWebView:INFERENCE");
  if (/\b(?:Tauri|Desktop|VITE_DESKTOP_RUNTIME)\b/.test(source)) {
    assumptions.push("Desktop/Tauri:INFERENCE");
  }
  return assumptions.length > 0 ? assumptions : ["Cross-platform:ASSUMPTION"];
}

function collectReachable(entrypoints, graph) {
  const reachable = new Set();
  const pending = [...entrypoints];
  while (pending.length > 0) {
    const current = pending.pop();
    if (!current || reachable.has(current)) continue;
    reachable.add(current);
    for (const dependency of graph.get(current) ?? []) pending.push(dependency);
  }
  return reachable;
}

function detectSurfaceEvidence(path, source, context) {
  const entries = [];
  const matchedStates = Object.entries(STATE_PATTERNS)
    .filter(([, statePattern]) => statePattern.test(source))
    .map(([state]) => state);
  const tokenMatches = sortUnique(
    [...source.matchAll(/var\(\s*(--[A-Za-z0-9-_]+)/g)].map((match) => match[1])
  );
  const themeEvidence = firstEvidence(
    source,
    /\b(?:dark:|theme|data-theme|prefers-color-scheme)\b/i,
    path
  );
  const localeEvidence = firstEvidence(
    source,
    /\b(?:useTranslation|useI18n|t\(|i18n|locale|dir=["']rtl["'])\b/,
    path
  );
  for (const [kind, pattern] of Object.entries(SURFACE_PATTERNS)) {
    if (COMPONENT_SURFACE_KINDS.has(kind) && !context.isComponent) continue;
    for (const occurrence of evidenceOccurrences(source, pattern, path)) {
      const { evidence, line, ordinal, matchedToken } = occurrence;
      entries.push({
        candidateId: `candidate:${kind}:${path}:${line}:${ordinal}`,
        kind,
        candidateClass: COMPONENT_SURFACE_KINDS.has(kind)
          ? "UI_SOURCE_CANDIDATE"
          : "HANDOFF_SOURCE_CANDIDATE",
        path,
        evidence,
        matchedToken,
        status: STATUS.INFERENCE,
        routeOrEntry: STATUS.UNVERIFIED,
        sourceEntry: evidence,
        userJob: STATUS.UNVERIFIED,
        sharedPrimitives: context.isComponent ? [path] : [STATUS.UNVERIFIED],
        platforms: context.platformAssumptions,
        presentations: [STATUS.UNVERIFIED],
        themes: themeEvidence ? [`${STATUS.INFERENCE}:${themeEvidence}`] : [STATUS.UNVERIFIED],
        locales: localeEvidence ? [`${STATUS.INFERENCE}:${localeEvidence}`] : [STATUS.UNVERIFIED],
        inputs: [STATUS.UNVERIFIED],
        states: matchedStates.length > 0 ? matchedStates : [STATUS.UNVERIFIED],
        destructiveActions: [STATUS.UNVERIFIED],
        permissionDependencies: [STATUS.UNVERIFIED],
        systemDependencies: [STATUS.UNVERIFIED],
        behaviorTests: context.tests.length > 0 ? context.tests : [STATUS.UNVERIFIED],
        accessibilityTests: [STATUS.UNVERIFIED],
        knownSpecs: [STATUS.UNVERIFIED],
        visualEvidence: [STATUS.UNVERIFIED],
        blockers: [
          `Lexical ${kind} occurrence ${matchedToken} at ${evidence} has not been adjudicated into a mounted user-visible surface.`,
          "User job, action hierarchy, runtime prerequisites, task completion, and assistive-technology behavior are UNVERIFIED.",
        ],
        routeOrEntryPoint: STATUS.UNVERIFIED,
        primaryActions: [STATUS.UNVERIFIED],
        secondaryActions: [STATUS.UNVERIFIED],
        prerequisites: {
          data: STATUS.UNVERIFIED,
          auth: STATUS.UNVERIFIED,
          platform: context.platformAssumptions,
        },
        a11ySemantics: detectSemantics(source),
        owningComponents: context.isComponent ? [path] : [STATUS.UNVERIFIED],
        owningTokens: tokenMatches.length > 0 ? tokenMatches : [STATUS.UNVERIFIED],
        tests: context.tests.length > 0 ? context.tests : [STATUS.UNVERIFIED],
        runtimeEvidence: STATUS.UNVERIFIED,
        gaps: [
          "user job and action hierarchy",
          "data/auth/runtime prerequisites",
          "theme/locale/platform runtime coverage",
          "assistive-technology and user completion evidence",
        ],
      });
    }
  }
  return entries;
}

function detectStateEvidence(path, source) {
  const entries = [];
  for (const [state, pattern] of Object.entries(STATE_PATTERNS)) {
    const evidence = firstEvidence(source, pattern, path);
    if (evidence) {
      entries.push({
        state,
        path,
        evidence,
        sourceStatus: STATUS.VERIFIED,
        runtimeStatus: STATUS.UNVERIFIED,
      });
    }
  }
  return entries;
}

function existingLocators(repositoryRoot, locators) {
  return locators.filter((locator) => existsSync(join(repositoryRoot, locator.split(":", 1)[0])));
}

function makeSurfaceRow(repositoryRoot, definition) {
  const behaviorTests = existingLocators(repositoryRoot, definition.behaviorTests ?? []);
  const accessibilityTests = existingLocators(repositoryRoot, definition.accessibilityTests ?? []);
  const knownSpecs = existingLocators(repositoryRoot, definition.knownSpecs ?? []);
  return {
    routeOrEntry: definition.routeOrEntry,
    sourceEntry: definition.sourceEntry,
    userJob: definition.userJob,
    sharedPrimitives: definition.sharedPrimitives,
    platforms: definition.platforms,
    presentations: definition.presentations ?? PRESENTATIONS,
    themes: definition.themes ?? SUPPORTED_THEMES,
    locales: definition.locales ?? SUPPORTED_LOCALES,
    inputs: definition.inputs ?? ["touch", "pointer", "keyboard", "assistive-technology"],
    states: definition.states,
    destructiveActions: definition.destructiveActions ?? [],
    permissionDependencies: definition.permissionDependencies ?? [],
    systemDependencies: definition.systemDependencies ?? [],
    behaviorTests: behaviorTests.length > 0 ? behaviorTests : [STATUS.UNVERIFIED],
    accessibilityTests: accessibilityTests.length > 0 ? accessibilityTests : [STATUS.UNVERIFIED],
    knownSpecs: knownSpecs.length > 0 ? knownSpecs : [STATUS.UNVERIFIED],
    visualEvidence: [STATUS.UNVERIFIED],
    status: STATUS.UNVERIFIED,
    primaryAction: definition.primaryAction,
    secondaryActions: definition.secondaryActions ?? [],
    dataAuthPlatformPrerequisites: definition.dataAuthPlatformPrerequisites ?? [STATUS.UNVERIFIED],
    blockers: definition.blockers ?? [
      "Runtime mount, task completion, visual state, and assistive-technology behavior are UNVERIFIED.",
    ],
    evidenceBoundary:
      "The route and source entry are source-grounded; runtime visibility and user completion are UNVERIFIED.",
  };
}

async function collectAdjudicatedSurfaces(repositoryRoot) {
  const commonSpec = ["docs/ai/V2_FULLSCREEN_EDGE_TO_EDGE_CONTRACT.md"];
  const definitions = [
    {
      routeOrEntry: "/orb",
      sourceEntry: "src/hooks/useNavigationV2.ts:34",
      sourceMarker: '"/orb"',
      userJob: "Record the current emotional state and optionally hand it to Diary.",
      primaryAction: "Choose the current state and continue.",
      secondaryActions: ["Open Diary with the pending mood context.", "Adjust ambience."],
      sharedPrimitives: [
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        "src/pages/nav-v2/OrbPage.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["loading", "ready", "incomplete", "handoff-pending", "error", "reduced-motion"],
      behaviorTests: ["src/pages/nav-v2/__tests__/OrbPage.test.tsx"],
      accessibilityTests: ["src/pages/nav-v2/__tests__/OrbPage.test.tsx"],
      knownSpecs: commonSpec,
    },
    {
      routeOrEntry: "/habits",
      sourceEntry: "src/hooks/useNavigationV2.ts:35",
      sourceMarker: '"/habits"',
      userJob: "Review habits and record or manage habit progress.",
      primaryAction: "Act on a habit.",
      secondaryActions: ["Open habit details.", "Create or edit a habit."],
      sharedPrimitives: [
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        "src/pages/nav-v2/HabitsPage.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["loading", "empty", "ready", "completed", "error"],
      behaviorTests: ["src/pages/nav-v2/__tests__/HabitsPage.test.tsx"],
      accessibilityTests: ["src/pages/nav-v2/__tests__/HabitsPage.test.tsx"],
      knownSpecs: commonSpec,
    },
    {
      routeOrEntry: "/diary",
      sourceEntry: "src/hooks/useNavigationV2.ts:36",
      sourceMarker: '"/diary"',
      userJob: "Review journal history and write or continue a diary entry.",
      primaryAction: "Open or create a diary entry.",
      secondaryActions: ["Consume an Orb handoff.", "Search or review prior entries."],
      sharedPrimitives: [
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        "src/pages/nav-v2/DiaryPage.tsx",
        "src/features/journal/JournalModule.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["loading", "empty", "ready", "editing", "saving", "error", "locked"],
      destructiveActions: ["Delete journal entry", "Remove journal password"],
      behaviorTests: [
        "src/pages/nav-v2/__tests__/integration.orbToDiaryHandoff.test.tsx",
        "src/features/journal/__tests__/JournalModule.handoffBehavior.test.tsx",
      ],
      accessibilityTests: [
        "src/features/journal/__tests__/JournalStickerPackManager.a11y.test.tsx",
      ],
      knownSpecs: commonSpec,
    },
    {
      routeOrEntry: "/planning",
      sourceEntry: "src/hooks/useNavigationV2.ts:37",
      sourceMarker: '"/planning"',
      userJob: "Review and organize planned work and scheduled items.",
      primaryAction: "Review or change the current plan.",
      secondaryActions: ["Navigate planning views."],
      sharedPrimitives: [
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        "src/pages/nav-v2/planning/PlanningPage.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["loading", "empty", "ready", "error"],
      behaviorTests: ["src/pages/nav-v2/__tests__/PlanningPage.test.tsx"],
      accessibilityTests: ["src/pages/nav-v2/__tests__/PlanningPage.test.tsx"],
      knownSpecs: commonSpec,
    },
    {
      routeOrEntry: "/settings",
      sourceEntry: "src/hooks/useNavigationV2.ts:38",
      sourceMarker: '"/settings"',
      userJob: "Review and change infrequently adjusted ZenFlow preferences.",
      primaryAction: "Open a settings section.",
      secondaryActions: ["Return to the previous surface.", "Open support information."],
      sharedPrimitives: [
        "src/components/navigation-v2/NavV2Orchestrator.tsx",
        "src/pages/nav-v2/SettingsPage.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["overview", "detail", "loading", "disabled", "error"],
      behaviorTests: ["src/pages/nav-v2/__tests__/SettingsPage.test.tsx"],
      accessibilityTests: ["src/pages/nav-v2/settings/__tests__/SettingsTextReflow.test.tsx"],
      knownSpecs: commonSpec,
    },
    {
      routeOrEntry: "/desktop",
      sourceEntry: "src/pages/Index.tsx:49",
      sourceMarker: '"/desktop"',
      userJob: "Review the available signed ZenFlow Desktop download.",
      primaryAction: "Open the verified Desktop download when configured.",
      secondaryActions: ["Return to the web app."],
      sharedPrimitives: ["src/pages/Index.tsx", "src/pages/DesktopDownloadPage.tsx"],
      platforms: ["Web"],
      presentations: ["compact", "medium", "expanded"],
      states: ["loading", "available", "unavailable", "error"],
      systemDependencies: ["Signed Desktop release metadata"],
      behaviorTests: ["src/pages/__tests__/DesktopDownloadPage.test.tsx"],
      knownSpecs: ["docs/release/microsoft-store/README.md"],
    },
  ];

  const settingsDetails = [
    {
      id: "account",
      job: "Review account identity, sessions, backup status, and account actions.",
      primary: "Review or update the account state.",
      destructive: ["Sign out", "Delete account"],
      permissions: [],
    },
    {
      id: "appearance",
      job: "Choose theme, accent, contrast, and appearance behavior.",
      primary: "Apply an appearance preference.",
      destructive: [],
      permissions: [],
    },
    {
      id: "sound",
      job: "Adjust ZenFlow sound-comfort preferences.",
      primary: "Change sound-comfort settings.",
      destructive: [],
      permissions: [],
    },
    {
      id: "notifications",
      job: "Configure reminders and understand system notification settings.",
      primary: "Review or change reminder settings.",
      destructive: [],
      permissions: ["Native notification permission", "Platform notification settings"],
    },
    {
      id: "privacy",
      job: "Review and change privacy-related preferences.",
      primary: "Change a privacy preference.",
      destructive: ["Reset local data where exposed by the wired controls"],
      permissions: [],
    },
  ];
  for (const detail of settingsDetails) {
    definitions.push({
      routeOrEntry: `/settings?settingsSection=${detail.id}`,
      sourceEntry: "src/pages/nav-v2/settings/types.ts:11",
      sourceMarker: `"${detail.id}"`,
      userJob: detail.job,
      primaryAction: detail.primary,
      secondaryActions: ["Return to Settings overview."],
      sharedPrimitives: [
        "src/pages/nav-v2/SettingsPage.tsx",
        "src/pages/nav-v2/settings/V2SettingsControlDeck.tsx",
      ],
      platforms: ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"],
      states: ["overview", "detail", "saving", "success", "disabled", "error"],
      destructiveActions: detail.destructive,
      permissionDependencies: detail.permissions,
      behaviorTests: ["src/pages/nav-v2/__tests__/SettingsPage.test.tsx"],
      accessibilityTests: [
        "src/pages/nav-v2/settings/__tests__/SettingsTextReflow.test.tsx",
        "src/pages/nav-v2/settings/__tests__/SettingsLocalizedTextWrap.static.test.ts",
      ],
      knownSpecs: commonSpec,
    });
  }

  const sourceOnlySurfaceDefinitions = [
    {
      routeOrEntry: "android-layout:activity_main",
      sourcePath: "android/app/src/main/res/layout/activity_main.xml",
      platform: "Android",
      surfaceLabel: "Android activity layout",
    },
    {
      routeOrEntry: "android-layout:widget_mini",
      sourcePath: "android/app/src/main/res/layout/widget_mini.xml",
      platform: "Android",
      surfaceLabel: "Android mini widget layout",
    },
    {
      routeOrEntry: "android-layout:widget_small",
      sourcePath: "android/app/src/main/res/layout/widget_small.xml",
      platform: "Android",
      surfaceLabel: "Android small widget layout",
    },
    {
      routeOrEntry: "android-layout:widget_medium",
      sourcePath: "android/app/src/main/res/layout/widget_medium.xml",
      platform: "Android",
      surfaceLabel: "Android medium widget layout",
    },
    {
      routeOrEntry: "android-layout:widget_large",
      sourcePath: "android/app/src/main/res/layout/widget_large.xml",
      platform: "Android",
      surfaceLabel: "Android large widget layout",
    },
    {
      routeOrEntry: "/404.html",
      sourcePath: "public/404.html",
      platform: "Web/PWA",
      surfaceLabel: "public 404 document",
    },
    {
      routeOrEntry: "/delete-account.html",
      sourcePath: "public/delete-account.html",
      platform: "Web/PWA",
      surfaceLabel: "public account-deletion document",
    },
    {
      routeOrEntry: "/offline.html",
      sourcePath: "public/offline.html",
      platform: "Web/PWA",
      surfaceLabel: "public offline document",
    },
    {
      routeOrEntry: "/privacy.html",
      sourcePath: "public/privacy.html",
      platform: "Web/PWA",
      surfaceLabel: "public privacy document",
    },
    {
      routeOrEntry: "/privacy-policy.html",
      sourcePath: "public/privacy-policy.html",
      platform: "Web/PWA",
      surfaceLabel: "public privacy-policy document",
    },
    {
      routeOrEntry: "/terms.html",
      sourcePath: "public/terms.html",
      platform: "Web/PWA",
      surfaceLabel: "public terms document",
    },
  ];
  for (const sourceSurface of sourceOnlySurfaceDefinitions) {
    definitions.push({
      routeOrEntry: sourceSurface.routeOrEntry,
      sourceEntry: `${sourceSurface.sourcePath}:1`,
      sourceMarker: "<",
      userJob: STATUS.UNVERIFIED,
      primaryAction: STATUS.UNVERIFIED,
      secondaryActions: [STATUS.UNVERIFIED],
      sharedPrimitives: [sourceSurface.sourcePath],
      platforms: [sourceSurface.platform],
      presentations: [STATUS.UNVERIFIED],
      themes: [STATUS.UNVERIFIED],
      locales: [STATUS.UNVERIFIED],
      inputs: [STATUS.UNVERIFIED],
      states: [STATUS.UNVERIFIED],
      destructiveActions: [STATUS.UNVERIFIED],
      permissionDependencies: [STATUS.UNVERIFIED],
      systemDependencies: [STATUS.UNVERIFIED],
      behaviorTests: [],
      accessibilityTests: [],
      knownSpecs: [],
      dataAuthPlatformPrerequisites: [STATUS.UNVERIFIED],
      blockers: [
        `UNVERIFIED: ${sourceSurface.surfaceLabel} exists at ${sourceSurface.sourcePath}, but routing or native mounting, user intent, action completion, lifecycle states, visual output, and assistive-technology behavior were not executed.`,
      ],
    });
  }

  const rows = [];
  for (const definition of definitions) {
    const sourcePath = definition.sourceEntry.split(":", 1)[0];
    if (!existsSync(join(repositoryRoot, sourcePath))) continue;
    const source = await readText(repositoryRoot, sourcePath);
    if (!source.includes(definition.sourceMarker)) continue;
    rows.push(makeSurfaceRow(repositoryRoot, definition));
  }
  return rows.sort((left, right) => left.routeOrEntry.localeCompare(right.routeOrEntry));
}

function collectHandoffMappings(repositoryRoot) {
  const mappings = [
    {
      id: "android-auth-open-url",
      platform: "Android",
      nativeEntry: "android/app/src/main/AndroidManifest.xml:55-62",
      webEntry: "src/hooks/useDeepLinkHandler.ts:278-332",
      destination: "Authenticated app shell",
      evidenceLocators: [
        "android/app/src/main/AndroidManifest.xml:55-62",
        "src/hooks/useDeepLinkHandler.ts:278-332",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Android OAuth callback delivery, exact-session admission, and authenticated shell mount were not executed on a device.",
    },
    {
      id: "android-challenge-custom-scheme",
      platform: "Android",
      nativeEntry: "android/app/src/main/AndroidManifest.xml:64-72",
      webEntry: "src/hooks/useDeepLinkHandler.ts:98-130",
      destination: "Challenge invite modal",
      evidenceLocators: [
        "android/app/src/main/AndroidManifest.xml:64-72",
        "src/hooks/useDeepLinkHandler.ts:98-130",
        "src/hooks/useDeepLinkHandler.ts:334-349",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Android zenflow:// challenge delivery, challenge availability, invite decoding, and modal mount were not executed on a device.",
    },
    {
      id: "android-challenge-app-link",
      platform: "Android",
      nativeEntry: "android/app/src/main/AndroidManifest.xml:84-101",
      webEntry: "src/hooks/useDeepLinkHandler.ts:98-130",
      destination: "Challenge invite modal",
      evidenceLocators: [
        "android/app/src/main/AndroidManifest.xml:84-101",
        "src/hooks/useDeepLinkHandler.ts:98-130",
        "src/hooks/useDeepLinkHandler.ts:334-349",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Android verified HTTPS App Link association, link delivery, invite decoding, and challenge modal mount were not executed on a device.",
    },
    {
      id: "android-diary-editor",
      platform: "Android",
      nativeEntry: "android/app/src/main/AndroidManifest.xml:74-82",
      webEntry: "src/lib/deepLinks.ts:60-75",
      destination: "Diary editor at /diary",
      evidenceLocators: [
        "android/app/src/main/AndroidManifest.xml:74-82",
        "src/lib/deepLinks.ts:60-75",
        "src/lib/deepLinks.ts:113-124",
        "src/lib/deepLinks.ts:139-150",
        "src/components/navigation-v2/NavV2Orchestrator.tsx:199-209",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Android zenflow://diary/editor delivery through Capacitor, editor request ordering, and Diary editor mount were not executed on a device.",
    },
    {
      id: "android-diary-mood",
      platform: "Android",
      nativeEntry: "android/app/src/main/AndroidManifest.xml:74-82",
      webEntry: "src/lib/deepLinks.ts:60-75",
      destination: "Diary mood handoff at /diary",
      evidenceLocators: [
        "android/app/src/main/AndroidManifest.xml:74-82",
        "src/lib/deepLinks.ts:60-75",
        "src/lib/deepLinks.ts:113-124",
        "src/lib/deepLinks.ts:139-150",
        "src/components/navigation-v2/NavV2Orchestrator.tsx:199-209",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Android zenflow://diary/mood delivery through Capacitor and the resulting Diary mood-state mount were not executed on a device.",
    },
    {
      id: "ios-auth-open-url",
      platform: "iOS",
      nativeEntry: "ios/App/App/AppDelegate.swift:20-24",
      webEntry: "src/hooks/useDeepLinkHandler.ts:278-332",
      evidenceLocators: [
        "ios/App/App/Info.plist:230-238",
        "ios/App/App/AppDelegate.swift:20-24",
        "src/hooks/useDeepLinkHandler.ts:278-332",
      ],
      destination: "Authenticated app shell",
      status: STATUS.UNVERIFIED,
      blocker:
        "iOS custom-scheme OAuth delivery through application(open:), exact-session admission, and authenticated shell mount were not executed in WKWebView.",
    },
    {
      id: "ios-challenge-open-url",
      platform: "iOS",
      nativeEntry: "ios/App/App/AppDelegate.swift:20-24",
      webEntry: "src/hooks/useDeepLinkHandler.ts:98-130",
      destination: "Challenge invite modal",
      evidenceLocators: [
        "ios/App/App/Info.plist:230-238",
        "ios/App/App/AppDelegate.swift:20-24",
        "src/hooks/useDeepLinkHandler.ts:98-130",
        "src/hooks/useDeepLinkHandler.ts:334-349",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "iOS zenflow:// challenge delivery through application(open:), invite decoding, and modal mount were not executed in WKWebView.",
    },
    {
      id: "ios-challenge-universal-link",
      platform: "iOS",
      nativeEntry: "ios/App/App/AppDelegate.swift:26-30",
      webEntry: "src/hooks/useDeepLinkHandler.ts:98-130",
      destination: "Challenge invite modal",
      evidenceLocators: [
        "ios/App/App/AppDelegate.swift:26-30",
        "src/hooks/useDeepLinkHandler.ts:98-130",
        "src/hooks/useDeepLinkHandler.ts:334-349",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "iOS Universal Link association, application(continue:) delivery, invite decoding, and challenge modal mount were not executed in WKWebView.",
    },
    {
      id: "ios-diary-editor-open-url",
      platform: "iOS",
      nativeEntry: "ios/App/App/AppDelegate.swift:20-24",
      webEntry: "src/lib/deepLinks.ts:60-75",
      destination: "Diary editor at /diary",
      evidenceLocators: [
        "ios/App/App/Info.plist:230-238",
        "ios/App/App/AppDelegate.swift:20-24",
        "src/lib/deepLinks.ts:60-75",
        "src/lib/deepLinks.ts:113-124",
        "src/lib/deepLinks.ts:139-150",
        "src/components/navigation-v2/NavV2Orchestrator.tsx:199-209",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "iOS zenflow://diary/editor delivery through application(open:) and Capacitor, editor request ordering, and Diary editor mount were not executed in WKWebView.",
    },
    {
      id: "ios-diary-mood-open-url",
      platform: "iOS",
      nativeEntry: "ios/App/App/AppDelegate.swift:20-24",
      webEntry: "src/lib/deepLinks.ts:60-75",
      destination: "Diary mood handoff at /diary",
      evidenceLocators: [
        "ios/App/App/Info.plist:230-238",
        "ios/App/App/AppDelegate.swift:20-24",
        "src/lib/deepLinks.ts:60-75",
        "src/lib/deepLinks.ts:113-124",
        "src/lib/deepLinks.ts:139-150",
        "src/components/navigation-v2/NavV2Orchestrator.tsx:199-209",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "iOS zenflow://diary/mood delivery through application(open:) and Capacitor and the resulting Diary mood-state mount were not executed in WKWebView.",
    },
    {
      id: "desktop-launch",
      platform: "Desktop/Tauri",
      nativeEntry: "src-tauri/tauri.conf.json:6-10",
      webEntry: "src/main.tsx:664-675",
      destination: "/",
      evidenceLocators: [
        "src-tauri/tauri.conf.json:6-10",
        "src/main.tsx:664-675",
        "src/pages/Index.tsx",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Tauri frontendDist startup, first render, and interactive shell were not executed in a packaged Desktop window.",
    },
    {
      id: "pwa-install",
      platform: "PWA",
      nativeEntry: "src/hooks/usePwaInstall.ts:30-60",
      webEntry: "src/components/InstallBanner.tsx:6-40",
      destination: "Install prompt",
      evidenceLocators: [
        "src/hooks/usePwaInstall.ts:30-60",
        "src/components/InstallBanner.tsx:6-40",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "beforeinstallprompt eligibility, user choice, installed display mode, and banner dismissal were not executed in an install-capable browser.",
    },
    {
      id: "pwa-launch",
      platform: "PWA",
      nativeEntry: "public/manifest.webmanifest:1",
      webEntry: "src/main.tsx:664-675",
      destination: "/",
      evidenceLocators: [
        "public/manifest.webmanifest:1",
        "src/main.tsx:664-675",
        "src/pages/Index.tsx",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Manifest start_url scope, installed launch, first render, and interactive shell were not executed in standalone display mode.",
    },
    {
      id: "pwa-offline",
      platform: "PWA",
      nativeEntry: "public/offline.html:69-71",
      webEntry: "src/components/OfflineBanner.tsx:230-304",
      destination: "Offline recovery surface",
      evidenceLocators: [
        "public/offline.html:69-71",
        "src/components/OfflineBanner.tsx:230-304",
        "src/sw.ts:309-327",
      ],
      status: STATUS.UNVERIFIED,
      blocker:
        "Offline fallback selection, pending-write preservation, retry recovery, and accessible announcement were not executed in an installed PWA.",
    },
    {
      id: "pwa-update",
      platform: "PWA",
      nativeEntry: "src/main.tsx:205-223",
      webEntry: "src/components/UpdatePrompt.tsx:30-160",
      destination: "Update prompt",
      evidenceLocators: ["src/main.tsx:205-223", "src/components/UpdatePrompt.tsx:30-160"],
      status: STATUS.UNVERIFIED,
      blocker:
        "Service-worker update delivery, prompt visibility, dismissal policy, reload continuity, and stale-client recovery were not executed in an installed PWA.",
    },
  ];
  return mappings
    .map((mapping) => ({
      ...mapping,
      evidenceLocators: existingLocators(repositoryRoot, mapping.evidenceLocators),
    }))
    .sort((left, right) => left.id.localeCompare(right.id));
}

async function collectEvidenceRoots(repositoryRoot) {
  const allSourceFiles = await walkFiles(repositoryRoot, "src", { exclude: false });
  return {
    auditDocs: (await walkFiles(repositoryRoot, "docs/audits/experience-quality")).filter(
      (path) => !GENERATED_INVENTORY_DOCUMENTS.has(path)
    ),
    e2e: await walkFiles(repositoryRoot, "e2e", { exclude: false }),
    sourceTests: allSourceFiles.filter(
      (path) =>
        path.includes("/__tests__/") || /\.(?:test|spec)\.(?:ts|tsx|js|jsx|mjs|cjs)$/.test(path)
    ),
    specifications: await walkFiles(repositoryRoot, "docs/superpowers/specs"),
  };
}

async function collectPlatformRoots(repositoryRoot) {
  const result = {};
  for (const [platform, root] of Object.entries(PLATFORM_ROOTS)) {
    const files = await walkFiles(repositoryRoot, root);
    const entryPattern =
      platform === "android"
        ? /(?:AndroidManifest\.xml|MainActivity\.(?:java|kt))$/
        : platform === "ios"
          ? /(?:AppDelegate\.swift|Info\.plist)$/
          : /(?:src\/main\.rs|src\/lib\.rs|tauri\.conf\.json)$/;
    result[platform] = {
      status: files.length > 0 ? STATUS.VERIFIED : STATUS.NA,
      evidence: files,
      entrypoints: files.filter((path) => entryPattern.test(path)),
      runtimeStatus: STATUS.UNVERIFIED,
    };
  }
  return result;
}

function collectDtcgTokens(node, segments = [], inheritedType = STATUS.UNVERIFIED, records = []) {
  if (!node || typeof node !== "object" || Array.isArray(node)) return records;
  const tokenType = typeof node.$type === "string" ? node.$type : inheritedType;
  if (Object.hasOwn(node, "$value") && segments.length > 0) {
    records.push({
      id: segments.join("."),
      tokenType,
      value: node.$value,
      description: typeof node.$description === "string" ? node.$description : STATUS.UNVERIFIED,
    });
  }
  for (const [key, value] of Object.entries(node)) {
    if (key.startsWith("$") || key.startsWith("_")) continue;
    collectDtcgTokens(value, [...segments, key], tokenType, records);
  }
  return records;
}

function findTokenRuntimeUsages(graphSources, identifiers) {
  const usages = [];
  for (const [path, source] of [...graphSources.entries()].sort(([left], [right]) =>
    left.localeCompare(right)
  )) {
    if (identifiers.some((identifier) => identifier && source.includes(identifier))) {
      usages.push(path);
    }
  }
  return usages;
}

async function collectTokenInventory(repositoryRoot, productionFiles, graphSources) {
  const tokenSources = productionFiles.filter((path) => path.startsWith("src/design-tokens/"));
  const styleFiles = productionFiles.filter(
    (path) => path.startsWith("src/styles/") || path.endsWith(".css")
  );
  const generatedCandidates = ["src/generated/tokens.css", "src/generated/tokens.ts"].filter(
    (path) => existsSync(join(repositoryRoot, path))
  );
  const aliases = [];
  const cssTokenRecords = [];
  const rawColorExceptions = [];
  const zIndex = [];
  for (const path of styleFiles) {
    const source = await readText(repositoryRoot, path);
    for (const match of source.matchAll(/(--[A-Za-z0-9-_]+)\s*:\s*([^;}\n]+)/g)) {
      aliases.push({
        token: match[1],
        evidence: `${path}:${lineNumberAt(source, match.index ?? 0)}`,
      });
      const value = match[2].trim();
      cssTokenRecords.push({
        id: match[1],
        sourcePath: `${path}:${lineNumberAt(source, match.index ?? 0)}`,
        generatedOutputs: [],
        semanticRole: match[1].replace(/^--/, "").split("-")[0] || STATUS.UNVERIFIED,
        themeMappings: /(?:paper|ink|oled|dark|light)/i.test(match[1])
          ? [match[1]]
          : [STATUS.UNVERIFIED],
        runtimeUsages: findTokenRuntimeUsages(graphSources, [`var(${match[1]}`, match[1]]),
        rawValueExceptions: /var\(/.test(value)
          ? []
          : [{ value, status: STATUS.INFERENCE, review: "Owner exception decision required." }],
        status: STATUS.VERIFIED,
        value,
        tokenType: "css-custom-property",
      });
    }
    for (const match of source.matchAll(/(?:#[0-9a-fA-F]{3,8}\b|rgba?\(|hsla?\()/g)) {
      rawColorExceptions.push({
        value: match[0],
        evidence: `${path}:${lineNumberAt(source, match.index ?? 0)}`,
        status: STATUS.INFERENCE,
        owner: STATUS.UNVERIFIED,
      });
    }
  }
  const zIndexSources = productionFiles.filter(
    (path) => SOURCE_EXTENSIONS.includes(extname(path)) || path.endsWith(".css")
  );
  for (const path of zIndexSources) {
    const source = await readText(repositoryRoot, path);
    for (const match of source.matchAll(/\bz-(?:\[[^\]]+\]|\d+)\b/g)) {
      zIndex.push({
        value: match[0],
        evidence: `${path}:${lineNumberAt(source, match.index ?? 0)}`,
      });
    }
  }
  const dtcgRecords = [];
  for (const path of tokenSources.filter((candidate) => candidate.endsWith(".json"))) {
    const source = await readText(repositoryRoot, path);
    try {
      const payload = JSON.parse(source);
      for (const token of collectDtcgTokens(payload)) {
        const cssIdentifier = `--${token.id.replaceAll(".", "-")}`;
        dtcgRecords.push({
          id: token.id,
          sourcePath: path,
          generatedOutputs: generatedCandidates,
          semanticRole: token.id.split(".")[0] || STATUS.UNVERIFIED,
          themeMappings: token.id.startsWith("color.theme.")
            ? [token.id.split(".")[2]]
            : [STATUS.UNVERIFIED],
          runtimeUsages: findTokenRuntimeUsages(graphSources, [
            cssIdentifier,
            `"${token.id}"`,
            `'${token.id}'`,
          ]),
          rawValueExceptions: [],
          status: STATUS.VERIFIED,
          value: token.value,
          tokenType: token.tokenType,
          description: token.description,
        });
      }
    } catch {
      dtcgRecords.push({
        id: `parse-error:${path}`,
        sourcePath: path,
        generatedOutputs: [],
        semanticRole: STATUS.UNVERIFIED,
        themeMappings: [STATUS.UNVERIFIED],
        runtimeUsages: [],
        rawValueExceptions: [],
        status: STATUS.UNVERIFIED,
        blocker: "Token JSON could not be parsed.",
      });
    }
  }
  return {
    sources: tokenSources,
    generatedOutputs: generatedCandidates,
    records: [...dtcgRecords, ...cssTokenRecords].sort((left, right) =>
      `${left.id}:${left.sourcePath}`.localeCompare(`${right.id}:${right.sourcePath}`)
    ),
    aliases,
    rawColorExceptions,
    zIndex,
  };
}

function inferAssetPurpose(path) {
  if (/^android\/app\/src\/main\/res\/layout[^/]*\//.test(path)) {
    return "Android native layout resource; runtime semantics and visibility UNVERIFIED.";
  }
  if (/\.lottie\.json$/i.test(path)) {
    return "Motion asset; exact semantic purpose and runtime use UNVERIFIED.";
  }
  if (path.startsWith("src/assets/") && /(?:^|\/)manifest\.json$/i.test(path)) {
    return "Asset manifest; exact semantic purpose and runtime use UNVERIFIED.";
  }
  if (
    /favicon|apple-touch|pwa-|ic_launcher|AppIcon|(?:^|\/)(?:app-?)?icon(?:[-_.\/]|$)|Logo/i.test(
      path
    )
  ) {
    return "Application identity or install metadata (INFERENCE from path).";
  }
  if (/sounds?\//i.test(path)) return "Sound or ambience asset (INFERENCE from path).";
  if (/privacy|terms|delete-account/i.test(path)) {
    return "Legal, privacy, or account-support surface (INFERENCE from path).";
  }
  if (/\.(?:png|jpe?g|webp|svg|gif|avif)$/i.test(path)) {
    return "Visual asset; exact semantic purpose UNVERIFIED.";
  }
  return STATUS.UNVERIFIED;
}

function isEligibleAssetPath(path) {
  return (
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
  );
}

function assetPlatformSurfaces(path) {
  if (path.startsWith("android/")) return ["Android"];
  if (path.startsWith("ios/")) return ["iOS"];
  if (path.startsWith("src-tauri/")) return ["Desktop/Tauri"];
  if (path.endsWith(".webmanifest")) return ["PWA"];
  return ["Web", "PWA", "Android WebView", "iOS WKWebView", "Desktop/Tauri"];
}

async function collectAssets(repositoryRoot) {
  const candidates = (
    await Promise.all(
      [
        "public",
        "src/assets",
        PLATFORM_ROOTS.android,
        PLATFORM_ROOTS.ios,
        PLATFORM_ROOTS.desktop,
      ].map((root) => walkFiles(repositoryRoot, root))
    )
  ).flat();
  const assetFiles = sortUnique(candidates.filter(isEligibleAssetPath));
  const extensionCounts = {};
  for (const path of assetFiles) {
    const extension = extname(path).toLowerCase() || "[no extension]";
    extensionCounts[extension] = (extensionCounts[extension] ?? 0) + 1;
  }
  const noticeCandidates = ["THIRD_PARTY_NOTICES", "THIRD_PARTY_NOTICES.md"].filter((path) =>
    existsSync(join(repositoryRoot, path))
  );
  const records = [];
  for (const path of assetFiles) {
    const source = /\.(?:svg|html|json|webmanifest|txt|xml|storyboard|xib)$/i.test(path)
      ? await readText(repositoryRoot, path)
      : "";
    const viewBox = source.match(/\bviewBox=["']([^"']+)["']/i)?.[1];
    const filenameSize = posix.basename(path).match(/(\d+x\d+|\d{2,4})(?=\D|$)/)?.[1];
    const strokeFill = /\.svg$/i.test(path)
      ? [
          /\bstroke=/.test(source) ? "stroke-present" : "stroke-UNVERIFIED",
          /\bfill=/.test(source) ? "fill-present" : "fill-UNVERIFIED",
        ].join(", ")
      : STATUS.NA;
    records.push({
      id: path,
      path,
      sourceAuthorLicense: STATUS.UNVERIFIED,
      semanticPurpose: inferAssetPurpose(path),
      platformSurfaces: assetPlatformSurfaces(path),
      sizeOrViewBox: viewBox ?? filenameSize ?? STATUS.UNVERIFIED,
      strokeFillLanguage: strokeFill,
      opticalAdjustment: STATUS.UNVERIFIED,
      rtlRule: STATUS.UNVERIFIED,
      accessibilityTreatment: STATUS.UNVERIFIED,
      themeVariants: [STATUS.UNVERIFIED],
      testEvidence: [STATUS.UNVERIFIED],
      disposition: "KEEP",
      sourceStatus: STATUS.VERIFIED,
      licenseStatus: STATUS.UNVERIFIED,
      provenanceStatus: STATUS.UNVERIFIED,
      reviewBlocker:
        "Source author/license, semantic use, RTL, accessibility treatment, and release rights require per-asset review.",
    });
  }
  return {
    files: assetFiles,
    records: records.sort((left, right) => left.path.localeCompare(right.path)),
    extensionCounts,
    licenseStatus: noticeCandidates.length > 0 ? STATUS.INFERENCE : STATUS.UNVERIFIED,
    licenseEvidence: noticeCandidates,
    provenanceStatus: STATUS.UNVERIFIED,
  };
}

async function collectLibraries(repositoryRoot, graphSources) {
  const packageSource = await readText(repositoryRoot, "package.json");
  let packageJson = {};
  try {
    packageJson = JSON.parse(packageSource);
  } catch {
    packageJson = {};
  }
  const dependencies = {
    ...(packageJson.dependencies ?? {}),
    ...(packageJson.devDependencies ?? {}),
  };
  const icons = Object.entries(dependencies)
    .filter(([name]) => /icon|lucide|phosphor|heroicons/i.test(name))
    .map(([name, version]) => ({ name, version, evidence: "package.json" }));
  const motion = Object.entries(dependencies)
    .filter(([name]) => /motion|lottie|three|gsap/i.test(name))
    .map(([name, version]) => ({ name, version, evidence: "package.json" }));
  for (const [path, source] of graphSources) {
    if (/framer-motion|@lottiefiles|lottie-react/.test(source)) {
      motion.push({ name: "source motion usage", version: STATUS.NA, evidence: path });
    }
  }
  return {
    icons: icons.sort((left, right) =>
      `${left.name}:${left.evidence}`.localeCompare(`${right.name}:${right.evidence}`)
    ),
    motion: motion.sort((left, right) =>
      `${left.name}:${left.evidence}`.localeCompare(`${right.name}:${right.evidence}`)
    ),
  };
}

export async function collectUiInventory({ repositoryRoot, subjectSha = STATUS.UNVERIFIED }) {
  const root = resolve(repositoryRoot);
  const explicitProductionFiles = ["src/index.css"].filter((path) => existsSync(join(root, path)));
  const productionFiles = sortUnique([
    ...(
      await Promise.all(PRODUCTION_ROOTS.map((productionRoot) => walkFiles(root, productionRoot)))
    ).flat(),
    ...explicitProductionFiles,
  ]);
  const componentPaths = productionFiles.filter(
    (path) => path.startsWith("src/") && path.endsWith(".tsx")
  );

  const graphFiles = (await walkFiles(root, "src")).filter((path) =>
    SOURCE_EXTENSIONS.includes(extname(path))
  );
  const graphSources = new Map();
  await Promise.all(
    graphFiles.map(async (path) => {
      graphSources.set(path, await readText(root, path));
    })
  );
  const knownFiles = new Set(graphFiles);
  const graph = new Map();
  for (const path of graphFiles) {
    const source = graphSources.get(path) ?? "";
    graph.set(
      path,
      sortUnique(
        extractImports(source)
          .map((specifier) => resolveImport(root, path, specifier, knownFiles))
          .filter(Boolean)
      )
    );
  }

  const entrypoints = graphFiles.filter(
    (path) => path === "src/main.tsx" || path === "src/App.tsx"
  );
  const layerCandidates = graphFiles.filter((path) =>
    /\/(?:ModalLayer|OverlayLayer|AuthGate)\.tsx$/.test(path)
  );
  const reachable = collectReachable(entrypoints, graph);
  const evidenceRoots = await collectEvidenceRoots(root);
  const testSources = new Map();
  await Promise.all(
    evidenceRoots.sourceTests.map(async (path) => {
      testSources.set(path, await readText(root, path));
    })
  );
  const testEvidenceByComponent = new Map(componentPaths.map((path) => [path, []]));
  for (const [testPath, testSource] of testSources) {
    for (const specifier of extractImports(testSource)) {
      const imported = resolveImport(root, testPath, specifier, knownFiles);
      if (imported && testEvidenceByComponent.has(imported)) {
        testEvidenceByComponent.get(imported).push(testPath);
      }
    }
  }

  const reverseImports = new Map(componentPaths.map((path) => [path, []]));
  for (const [importer, imports] of graph) {
    for (const imported of imports) {
      if (reverseImports.has(imported)) reverseImports.get(imported).push(importer);
    }
  }

  const components = componentPaths.map((path) => {
    const source = graphSources.get(path) ?? "";
    const isReachable = reachable.has(path);
    const exports = extractExports(source, path);
    const semantics = detectSemantics(source);
    const componentStates = Object.entries(STATE_PATTERNS)
      .filter(([, pattern]) => pattern.test(source))
      .map(([state]) => state);
    const usageLocators = sortUnique(reverseImports.get(path) ?? []);
    const testLocators = sortUnique(testEvidenceByComponent.get(path) ?? []);
    return {
      symbol: exports.join(", ") || posix.basename(path, extname(path)),
      path,
      semanticRole: semantics.join(", "),
      variants: detectVariants(source),
      states: componentStates.length > 0 ? componentStates : [STATUS.UNVERIFIED],
      tokenDependencies:
        detectTokenDependencies(source).length > 0
          ? detectTokenDependencies(source)
          : [STATUS.UNVERIFIED],
      duplicateCandidates: [STATUS.UNVERIFIED],
      owners: [STATUS.UNVERIFIED],
      usageLocators: usageLocators.length > 0 ? usageLocators : [STATUS.UNVERIFIED],
      platformAssumptions: detectPlatformAssumptions(source),
      testLocators: testLocators.length > 0 ? testLocators : [STATUS.UNVERIFIED],
      disposition: "keep",
      dispositionReview:
        "Safe default only. Consolidation, replacement, or retirement requires owner intent plus structural, runtime, and visual equivalence evidence.",
      layer: classifyLayer(path),
      exports,
      semantics,
      usages: usageLocators,
      tests: testLocators,
      reachability: isReachable ? STATUS.VERIFIED : STATUS.UNVERIFIED,
      reachabilityEvidence: isReachable
        ? entrypoints.includes(path)
          ? `entrypoint:${path}`
          : `production-import-graph:${path}`
        : "No path from the declared production entrypoints was found.",
      reachabilityReview: isReachable ? "STATICALLY_REACHABLE" : "REACHABILITY_REVIEW_REQUIRED",
      consolidationStatus: STATUS.UNVERIFIED,
    };
  });

  const surfaceCandidates = [];
  const states = [];
  for (const [path, source] of graphSources) {
    surfaceCandidates.push(
      ...detectSurfaceEvidence(path, source, {
        isComponent: componentPaths.includes(path),
        platformAssumptions: detectPlatformAssumptions(source),
        tests: sortUnique(testEvidenceByComponent.get(path) ?? []),
      })
    );
    if (componentPaths.includes(path)) states.push(...detectStateEvidence(path, source));
  }

  const surfaces = await collectAdjudicatedSurfaces(root);
  const handoffMappings = collectHandoffMappings(root);
  const tokens = await collectTokenInventory(root, productionFiles, graphSources);
  const assets = await collectAssets(root);
  const libraries = await collectLibraries(root, graphSources);
  const platforms = await collectPlatformRoots(root);
  platforms.web = {
    status: existsSync(join(root, "src/main.tsx")) ? STATUS.VERIFIED : STATUS.NA,
    evidence: existsSync(join(root, "src/main.tsx")) ? ["src/main.tsx"] : [],
    runtimeStatus: STATUS.UNVERIFIED,
    entrypoints: existsSync(join(root, "src/main.tsx")) ? ["src/main.tsx"] : [],
  };
  platforms.pwa = {
    status: productionFiles.some((path) => path.endsWith(".webmanifest"))
      ? STATUS.VERIFIED
      : STATUS.UNVERIFIED,
    evidence: productionFiles.filter((path) => path.endsWith(".webmanifest")),
    runtimeStatus: STATUS.UNVERIFIED,
    entrypoints: productionFiles.filter((path) => path.endsWith(".webmanifest")),
  };

  const boundedRuntimeReceiptPath =
    subjectSha === STATUS.UNVERIFIED
      ? null
      : `output/ui-system-audit/${subjectSha}/after/task15-controlled/runtime-capture.json`;
  let boundedRuntimeEvidence = null;
  if (boundedRuntimeReceiptPath && existsSync(join(root, boundedRuntimeReceiptPath))) {
    const receipt = JSON.parse(await readFile(join(root, boundedRuntimeReceiptPath), "utf8"));
    boundedRuntimeEvidence = {
      receiptPath: boundedRuntimeReceiptPath,
      sidecarPath: `${boundedRuntimeReceiptPath}.sha256`,
      evidenceBoundary: receipt.evidenceBoundary ?? STATUS.UNVERIFIED,
      sourceDiffSha256: receipt.sourceDiffSha256 ?? STATUS.UNVERIFIED,
      sourceDiffCommand: receipt.sourceDiffCommand ?? STATUS.UNVERIFIED,
      checks: Array.isArray(receipt.checks)
        ? receipt.checks.map((check) => ({
            id: check.id ?? STATUS.UNVERIFIED,
            status: check.status ?? STATUS.UNVERIFIED,
            locale: check.locale ?? STATUS.UNVERIFIED,
            theme: check.theme ?? STATUS.UNVERIFIED,
            boundary: check.boundary ?? "No additional bounded claim.",
          }))
        : [],
    };
  }

  return {
    schemaVersion: 1,
    subjectSha,
    statusVocabulary: Object.values(STATUS),
    scope: {
      productionRoots: PRODUCTION_ROOTS,
      nativeDesktopRoots: PLATFORM_ROOTS,
      excludedSegments: [...EXCLUDED_SEGMENTS].sort(),
      excludedPathPrefixes: [...EXCLUDED_PATH_PREFIXES].sort(),
      excludedExactPaths: [...EXCLUDED_EXACT_PATHS].sort(),
      excludedPathPatterns: EXCLUDED_PATH_PATTERNS.map((pattern) => pattern.source).sort(),
    },
    summary: {
      productionFiles: productionFiles.length,
      productionTsxFiles: components.length,
      reachableComponents: components.filter(
        (component) => component.reachability === STATUS.VERIFIED
      ).length,
      reviewComponents: components.filter((component) => component.reachability !== STATUS.VERIFIED)
        .length,
      surfaceRows: surfaces.length,
      surfaceCandidateRows: surfaceCandidates.length,
      stateEvidenceRows: states.length,
    },
    graph: {
      entrypoints,
      layerCandidates,
      edges: [...graph.entries()]
        .flatMap(([from, imports]) => imports.map((to) => ({ from, to })))
        .sort((left, right) =>
          `${left.from}:${left.to}`.localeCompare(`${right.from}:${right.to}`)
        ),
      reachable: sortUnique([...reachable]),
    },
    coverage: {
      productionTsx: componentPaths,
      classifiedComponentPaths: components.map((component) => component.path),
      productionTsxUnclassified: componentPaths.filter(
        (path) => !components.some((component) => component.path === path)
      ),
    },
    components,
    surfaces,
    surfaceCandidates: surfaceCandidates.sort((left, right) =>
      left.candidateId.localeCompare(right.candidateId)
    ),
    handoffMappings,
    states: states.sort((left, right) =>
      `${left.state}:${left.evidence}`.localeCompare(`${right.state}:${right.evidence}`)
    ),
    evidenceRoots,
    platforms,
    boundedRuntimeEvidence,
    tokens,
    assets,
    libraries,
  };
}

function markdownTable(headers, rows) {
  const escape = (value) =>
    String(value ?? "")
      .replaceAll("|", "\\|")
      .replaceAll("\n", " ");
  return [
    `| ${headers.map(escape).join(" | ")} |`,
    `| ${headers.map(() => "---").join(" | ")} |`,
    ...rows.map((row) => `| ${row.map(escape).join(" | ")} |`),
  ].join("\n");
}

function renderSystemDocument(inventory) {
  const layerCounts = Object.fromEntries(
    ["foundation", "primitive", "pattern", "screen"].map((layer) => [
      layer,
      inventory.components.filter((component) => component.layer === layer).length,
    ])
  );
  const surfaceCounts = Object.entries(
    inventory.surfaceCandidates.reduce((counts, surface) => {
      counts[surface.kind] = (counts[surface.kind] ?? 0) + 1;
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right));

  return `# ZenFlow UI System Inventory — 2026-07-28

Subject SHA: \`${inventory.subjectSha}\`

## Evidence contract

This is a source inventory, not browser, native-device, assistive-technology, visual-quality, ownership, license, provenance, consolidation, or release proof. Statuses are \`${inventory.statusVocabulary.join(
    "`, `"
  )}\`. A source path can be VERIFIED while runtime behavior remains UNVERIFIED.

## Scope and exclusions

- Production roots: ${inventory.scope.productionRoots.map((path) => `\`${path}\``).join(", ")}.
- Native/Desktop roots: ${Object.values(inventory.scope.nativeDesktopRoots)
    .map((path) => `\`${path}\``)
    .join(", ")}.
- Excluded from production component counts by segment: ${inventory.scope.excludedSegments
    .map((segment) => `\`${segment}\``)
    .join(", ")}.
- Explicit development/generated path-prefix exclusions: ${inventory.scope.excludedPathPrefixes
    .map((path) => `\`${path}/**\``)
    .join(", ")}.
- Exact generated file exclusions: ${inventory.scope.excludedExactPaths
    .map((path) => `\`${path}\``)
    .join(", ")}.
- Generated path-pattern exclusions: ${inventory.scope.excludedPathPatterns
    .map((pattern) => `\`/${pattern}/\``)
    .join(", ")}.
- Test/spec evidence is indexed separately and never upgrades runtime status.

## Foundation → Primitive → Pattern → Screen

\`\`\`text
Foundation (${layerCounts.foundation})
└─ Primitive (${layerCounts.primitive})
   └─ Pattern (${layerCounts.pattern})
      └─ Screen (${layerCounts.screen})
\`\`\`

The arrows describe the review hierarchy, not a proven one-way dependency rule. Similar appearance alone is not consolidation evidence.

## Production graph

- Entrypoints: ${inventory.graph.entrypoints.map((path) => `\`${path}\``).join(", ") || "N/A"}.
- Layer candidates that are not reachability roots: ${
    inventory.graph.layerCandidates.map((path) => `\`${path}\``).join(", ") || "N/A"
  }.
- Import edges: ${inventory.graph.edges.length}.
- Reachable component files: ${inventory.summary.reachableComponents}/${inventory.summary.productionTsxFiles}.
- Components requiring reachability review: ${inventory.summary.reviewComponents}.
- Production TSX omitted from classification: ${inventory.coverage.productionTsxUnclassified.length}.

## Source-grounded surface inventory

These rows are grounded in ZenFlow's navigation, Settings, Android layout, and public HTML sources. Blocker-backed native/public rows preserve unknown user jobs rather than treating source existence as proof of runtime mounting or task completion.

${markdownTable(
  [
    "routeOrEntry",
    "sourceEntry",
    "userJob",
    "sharedPrimitives[]",
    "platforms[]",
    "presentations[]",
    "themes[]",
    "locales[]",
    "inputs[]",
    "states[]",
    "destructiveActions[]",
    "permissionDependencies[]",
    "systemDependencies[]",
    "behaviorTests[]",
    "accessibilityTests[]",
    "knownSpecs[]",
    "visualEvidence[]",
    "status",
  ],
  inventory.surfaces.map((surface) => [
    surface.routeOrEntry,
    surface.sourceEntry,
    surface.userJob,
    surface.sharedPrimitives.join(", "),
    surface.platforms.join(", "),
    surface.presentations.join(", "),
    surface.themes.join(", "),
    surface.locales.join(", "),
    surface.inputs.join(", "),
    surface.states.join(", "),
    surface.destructiveActions.join(", ") || "N/A",
    surface.permissionDependencies.join(", ") || "N/A",
    surface.systemDependencies.join(", ") || "N/A",
    surface.behaviorTests.join(", "),
    surface.accessibilityTests.join(", "),
    surface.knownSpecs.join(", "),
    surface.visualEvidence.join(", "),
    `${surface.status}; ${surface.blockers.join(" ")}`,
  ])
)}

## Cross-language platform handoff mappings

Native/PWA source existence is not reachability proof. Every mapping remains blocked until the named runtime path executes.

${markdownTable(
  [
    "ID",
    "Platform",
    "Native/PWA entry",
    "Web entry",
    "Destination",
    "Evidence locators",
    "Status",
    "Blocker",
  ],
  inventory.handoffMappings.map((mapping) => [
    mapping.id,
    mapping.platform,
    mapping.nativeEntry,
    mapping.webEntry,
    mapping.destination,
    mapping.evidenceLocators.join(", "),
    mapping.status,
    mapping.blocker,
  ])
)}

## Lexical surface candidates

${markdownTable(
  ["Kind", "Source rows", "Status", "Runtime"],
  surfaceCounts.map(([kind, count]) => [
    kind,
    count,
    "INFERENCE from lexical source match",
    "UNVERIFIED",
  ])
)}

## Detailed lexical candidates

Each row is an unadjudicated lexical candidate with the complete \`UiSurfaceRow\` evidence shape and a stable ID. It is not proof of a route, mount, user-visible surface, or successful task. Unknown user jobs remain \`UNVERIFIED\`; the blocker names the missing adjudication.

${markdownTable(
  [
    "candidateId",
    "matchedToken",
    "routeOrEntry",
    "sourceEntry",
    "userJob",
    "sharedPrimitives[]",
    "platforms[]",
    "presentations[]",
    "themes[]",
    "locales[]",
    "inputs[]",
    "states[]",
    "destructiveActions[]",
    "permissionDependencies[]",
    "systemDependencies[]",
    "behaviorTests[]",
    "accessibilityTests[]",
    "knownSpecs[]",
    "visualEvidence[]",
    "status",
    "blocker",
  ],
  inventory.surfaceCandidates.map((surface) => [
    surface.candidateId,
    surface.matchedToken,
    surface.routeOrEntry,
    surface.sourceEntry,
    surface.userJob,
    surface.sharedPrimitives.join(", "),
    surface.platforms.join(", "),
    surface.presentations.join(", "),
    surface.themes.join(", "),
    surface.locales.join(", "),
    surface.inputs.join(", "),
    surface.states.join(", "),
    surface.destructiveActions.join(", "),
    surface.permissionDependencies.join(", "),
    surface.systemDependencies.join(", "),
    surface.behaviorTests.join(", "),
    surface.accessibilityTests.join(", "),
    surface.knownSpecs.join(", "),
    surface.visualEvidence.join(", "),
    surface.status,
    surface.blockers.join(" "),
  ])
)}

## Platform roots

${markdownTable(
  ["Platform", "Source status", "Evidence count", "Entry points", "Runtime status"],
  Object.entries(inventory.platforms).map(([platform, evidence]) => [
    platform,
    evidence.status,
    evidence.evidence.length,
    evidence.entrypoints.length > 0
      ? evidence.entrypoints.map((path) => `\`${path}\``).join(", ")
      : "N/A",
    evidence.runtimeStatus,
  ])
)}

## UiTokenRow ledger

${markdownTable(
  [
    "id",
    "sourcePath",
    "generatedOutputs[]",
    "semanticRole",
    "themeMappings[]",
    "runtimeUsages[]",
    "rawValueExceptions[]",
    "status",
  ],
  inventory.tokens.records.map((token) => [
    token.id,
    token.sourcePath,
    token.generatedOutputs.join(", ") || "N/A",
    token.semanticRole,
    token.themeMappings.join(", "),
    token.runtimeUsages.join(", ") || "UNVERIFIED",
    token.rawValueExceptions.length > 0
      ? token.rawValueExceptions
          .map((exception) => `${exception.value}:${exception.status}`)
          .join(", ")
      : "N/A",
    token.status,
  ])
)}

## Token/CSS exceptions and generated outputs

- Token source files: ${inventory.tokens.sources.map((path) => `\`${path}\``).join(", ") || "N/A"}.
- Generated token outputs: ${
    inventory.tokens.generatedOutputs.map((path) => `\`${path}\``).join(", ") || "N/A"
  }.
- CSS custom-property definitions: ${inventory.tokens.aliases.length}.
- Raw color occurrences requiring an owner-reviewed exception decision: ${
    inventory.tokens.rawColorExceptions.length
  }; ownership is UNVERIFIED.
- Z-index utility occurrences in scanned production source/style roots: ${inventory.tokens.zIndex.length}.

## UiAssetRow ledger

${markdownTable(
  [
    "id",
    "path",
    "sourceAuthorLicense",
    "semanticPurpose",
    "platformSurfaces[]",
    "sizeOrViewBox",
    "strokeFillLanguage",
    "opticalAdjustment",
    "rtlRule",
    "accessibilityTreatment",
    "themeVariants[]",
    "testEvidence[]",
    "disposition",
  ],
  inventory.assets.records.map((asset) => [
    asset.id,
    asset.path,
    asset.sourceAuthorLicense,
    asset.semanticPurpose,
    asset.platformSurfaces.join(", "),
    asset.sizeOrViewBox,
    asset.strokeFillLanguage,
    asset.opticalAdjustment,
    asset.rtlRule,
    asset.accessibilityTreatment,
    asset.themeVariants.join(", "),
    asset.testEvidence.join(", "),
    `${asset.disposition}; ${asset.reviewBlocker}`,
  ])
)}

## Libraries and evidence boundary

- Eligible cross-platform asset records: ${inventory.assets.files.length}.
- License notice evidence: ${inventory.assets.licenseStatus}${
    inventory.assets.licenseEvidence.length
      ? ` via ${inventory.assets.licenseEvidence.map((path) => `\`${path}\``).join(", ")}`
      : ""
  }; per-asset license mapping remains UNVERIFIED.
- Icon libraries: ${
    inventory.libraries.icons.map((item) => `${item.name}@${item.version}`).join(", ") || "N/A"
  }.
- Motion libraries/source usages: ${inventory.libraries.motion.length}.

## Consolidation boundary

Every unadjudicated production component uses the safe \`keep\` disposition. No component is marked for consolidation, replacement, retirement, or deletion from naming, proximity, lexical similarity, or static reachability.
`;
}

function renderComponentDocument(inventory) {
  return `# ZenFlow UI Component Inventory — 2026-07-28

Subject SHA: \`${inventory.subjectSha}\`

Every production \`src/**/*.tsx\` file outside the declared test/fixture/generated/recovery/output exclusions receives one row. \`VERIFIED\` reachability means only a literal static/dynamic import path from \`src/main.tsx\` or \`src/App.tsx\`; computed imports and runtime registration remain UNVERIFIED.

${markdownTable(
  [
    "symbol",
    "path",
    "semanticRole",
    "variants[]",
    "states[]",
    "tokenDependencies[]",
    "duplicateCandidates[]",
    "owners[]",
    "usageLocators[]",
    "platformAssumptions[]",
    "testLocators[]",
    "disposition",
    "Layer",
    "Reachability",
    "Review blocker",
  ],
  inventory.components.map((component) => [
    component.symbol,
    component.path,
    component.semanticRole,
    component.variants.join(", "),
    component.states.join(", "),
    component.tokenDependencies.join(", "),
    component.duplicateCandidates.join(", "),
    component.owners.join(", "),
    component.usageLocators.join(", "),
    component.platformAssumptions.join(", "),
    component.testLocators.join(", "),
    component.disposition,
    component.layer,
    `${component.reachability}: ${component.reachabilityEvidence}`,
    component.dispositionReview,
  ])
)}

## Disposition rule

- \`keep\`: safe default for every unadjudicated production source.
- \`consolidate | replace | retire\`: permitted only after owner intent and structural, runtime, accessibility, platform, and visual-equivalence evidence.
- Static unreachability never authorizes deletion or retirement.
`;
}

function renderStateDocument(inventory) {
  const stateCounts = Object.entries(
    inventory.states.reduce((counts, state) => {
      counts[state.state] = (counts[state.state] ?? 0) + 1;
      return counts;
    }, {})
  ).sort(([left], [right]) => left.localeCompare(right));
  const boundedRuntime = inventory.boundedRuntimeEvidence;
  const boundedRuntimeSection = boundedRuntime
    ? `## Fresh bounded runtime evidence

Receipt: \`${boundedRuntime.receiptPath}\`

Sidecar: \`${boundedRuntime.sidecarPath}\`
Source snapshot: \`${boundedRuntime.sourceDiffSha256}\`

${markdownTable(
  ["Check", "Status", "Locale", "Theme", "Boundary"],
  boundedRuntime.checks.map((check) => [
    check.id,
    check.status,
    check.locale,
    check.theme,
    check.boundary,
  ])
)}

Web runtime is PASS for the six listed controlled Chrome checks only. Installed PWA, Android, iOS, Desktop, assistive technology, and human acceptance remain UNVERIFIED.
`
    : `## Fresh bounded runtime evidence

No hash-bound runtime receipt was resolved for this subject; runtime remains UNVERIFIED.
`;
  return `# ZenFlow UI State Coverage — 2026-07-28

Subject SHA: \`${inventory.subjectSha}\`

Product-wide runtime state remains UNVERIFIED. Each VERIFIED source row below proves only that a source pattern exists at the cited path and line.

${boundedRuntimeSection}

## State evidence summary

${markdownTable(
  ["State", "Source rows", "Source status", "Runtime status"],
  stateCounts.map(([state, count]) => [state, count, "VERIFIED", "UNVERIFIED"])
)}

## Evidence roots

${markdownTable(
  ["Evidence class", "Files", "What it proves"],
  Object.entries(inventory.evidenceRoots).map(([kind, paths]) => [
    kind,
    paths.length,
    "Source/test/spec existence only; execution and runtime remain UNVERIFIED",
  ])
)}

## Platform state matrix

${markdownTable(
  ["Platform", "Source evidence", "Runtime", "Required follow-up"],
  Object.entries(inventory.platforms).map(([platform, evidence]) => [
    platform === "desktop"
      ? "Desktop"
      : platform === "ios"
        ? "iOS"
        : platform === "android"
          ? "Android"
          : platform,
    `${evidence.status} (${evidence.evidence.length} files)`,
    evidence.runtimeStatus,
    platform === "web"
      ? "Browser keyboard, screen reader, forced colors, zoom/reflow"
      : platform === "pwa"
        ? "Installed display modes, offline/update/install prompts"
        : platform === "android"
          ? "TalkBack, Back, font/display size, permissions and native handoffs"
          : platform === "ios"
            ? "VoiceOver, Dynamic Type, Reduce Motion, safe areas and WKWebView"
            : "Keyboard/screen reader, forced colors, resize and native handoffs",
  ])
)}

## Detailed source evidence

${markdownTable(
  ["State", "Evidence", "Source", "Runtime"],
  inventory.states.map((state) => [
    state.state,
    `\`${state.evidence}\``,
    state.sourceStatus,
    state.runtimeStatus,
  ])
)}

## Honest gaps

- Computed imports, reflection, plugin registration, feature flags and remote configuration may create false orphan candidates.
- Test filenames and source assertions are not proof that a test ran or that a user can complete the state.
- Browser, PWA, Android, iOS and Desktop runtime behavior is UNVERIFIED by this collector.
- Native-speaker, disabled-user, cultural, ownership, license and provenance acceptance is UNVERIFIED.
`;
}

export function renderInventoryDocuments(inventory) {
  return {
    system: renderSystemDocument(inventory),
    components: renderComponentDocument(inventory),
    states: renderStateDocument(inventory),
  };
}

export async function writeInventoryDocuments({ repositoryRoot, documents }) {
  const targets = {
    system: "docs/audits/experience-quality/ui-system-inventory-2026-07-28.md",
    components: "docs/audits/experience-quality/ui-component-inventory-2026-07-28.md",
    states: "docs/audits/experience-quality/ui-state-coverage-2026-07-28.md",
  };
  await mkdir(join(repositoryRoot, "docs/audits/experience-quality"), { recursive: true });
  for (const [kind, target] of Object.entries(targets)) {
    await writeFile(join(repositoryRoot, target), documents[kind], "utf8");
  }
  return targets;
}

function parseCliArguments(argv) {
  const result = {
    writeDocs: false,
    repositoryRoot: process.cwd(),
    subjectSha: STATUS.UNVERIFIED,
  };
  for (let index = 0; index < argv.length; index += 1) {
    const argument = argv[index];
    if (argument === "--write-docs") result.writeDocs = true;
    else if (argument === "--root") result.repositoryRoot = argv[++index];
    else if (argument === "--subject-sha") result.subjectSha = argv[++index];
    else throw new Error(`Unknown argument: ${argument}`);
  }
  return result;
}

async function main() {
  const options = parseCliArguments(process.argv.slice(2));
  const inventory = await collectUiInventory(options);
  if (options.writeDocs) {
    const targets = await writeInventoryDocuments({
      repositoryRoot: resolve(options.repositoryRoot),
      documents: renderInventoryDocuments(inventory),
    });
    process.stdout.write(
      `${JSON.stringify({ status: STATUS.VERIFIED, summary: inventory.summary, targets }, null, 2)}\n`
    );
    return;
  }
  process.stdout.write(`${JSON.stringify(inventory, null, 2)}\n`);
}

const isCli = process.argv[1] && resolve(process.argv[1]) === fileURLToPath(import.meta.url);
if (isCli) {
  main().catch((error) => {
    process.stderr.write(`${error instanceof Error ? error.stack : String(error)}\n`);
    process.exitCode = 1;
  });
}
