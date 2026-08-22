#!/usr/bin/env node

import { readFileSync, readdirSync, statSync } from "node:fs";
import { dirname, extname, join, relative, resolve } from "node:path";
import { fileURLToPath } from "node:url";

const toolDirectory = dirname(fileURLToPath(import.meta.url));
const projectRoot = resolve(toolDirectory, "../..");
const sourceRoot = join(projectRoot, "src");
const inventoryPath = join(
  projectRoot,
  "docs/release/android-2.1-reflow-inventory.json",
);

const FIXED_CLASS_PATTERN =
  /className\s*=\s*(?:"[^"]*\bfixed\b[^"]*"|'[^']*\bfixed\b[^']*'|\{`[^`]*\bfixed\b[^`]*`\}|\{[^}]{0,600}\bfixed\b[^}]{0,600}\})/s;
const FIXED_STYLE_PATTERN = /position\s*:\s*(?:["']fixed["']|fixed)\b/;
const DATA_STRUCTURE_PATTERN =
  /<table\b|role\s*=\s*["']grid["']|grid-cols-7|gridAutoColumns|overflow-x-(?:auto|scroll)|\bmin-w-max\b/;
const DATA_OWNER_NAME_PATTERN =
  /(?:Calendar|Heatmap|Timeline|Schedule|WeeklyReport|Leaderboard|Stats|Chart|Grid|Table)/;

const forcedCandidates = new Map([
  ["src/components/auth-screen/AuthScreen.tsx", ["entry-layout-host"]],
  ["src/components/LanguageSelector.tsx", ["entry-choice-grid"]],
  [
    "src/components/StorageIncidentBanner.tsx",
    ["fixed-overlay-or-notification-owner", "entry-flow-incident"],
  ],
]);

const calendarComponentEvidence = {
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "named keyboard-focusable component-local horizontal scroll; production component exercised in the retained harness",
  safeAreaOwner:
    "N/A at the embedded component boundary; signed-in route safe-area ownership remains UNVERIFIED",
  androidBackOwner: "N/A: embedded non-modal data surface",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he and API 36 Hebrew component checks passed; signed-in route remains UNVERIFIED",
  evidence: [
    "e2e/calendar-reflow.spec.ts: 3/3 tests PASS, including 32/32 locale/viewport states and LTR/RTL keyboard focus/scroll",
    "8 locales x narrow 200%, short portrait, landscape, and split-window: document overflow 0; two named internal regions; minimum day target >=49.14px; month navigation targets >=48px; no prohibited intra-word fragmentation",
    "API 36 Chrome component harness: Hebrew RTL, 32px root text, document overflow 0, two overflowing internal regions, minimum day target 98.28px",
    "output/android21/t153-calendar-reflow/browser-matrix.json",
    "output/android21/t153-calendar-reflow/native-api36/he-api36-facts.json",
  ],
  rejectionCriteria:
    "Reject page-level horizontal overflow, hidden columns without one named internal scroll owner, fragmented localized words, targets below the applicable 44 CSS-px Web or 48dp Android contract, invisible keyboard focus, or a signed-in-route/platform claim without fresh route evidence",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const globalScheduleBarComponentEvidence = {
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "N/A: finite current/next schedule summary reflows inside the action; no horizontal scroll owner is needed",
  safeAreaOwner:
    "N/A at the embedded component boundary; exact signed-in route safe-area ownership remains UNVERIFIED",
  androidBackOwner: "N/A: embedded non-modal schedule action",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he wrapping and arrow mirroring passed on Web; API 36 Hebrew component proof passed; signed-in route remains UNVERIFIED",
  evidence: [
    "e2e/global-schedule-bar-reflow.spec.ts: 2/2 tests PASS after a retained 32/32 clipping RED, including visible Hebrew RTL keyboard focus",
    "8 locales x narrow 200%, short portrait, landscape, and split-window: document/title overflow 0; no ellipsis, nowrap, out-of-bounds title, or intra-word fragmentation; minimum action target 66px; console errors 0",
    "API 36 Chrome component harness: Hebrew RTL, 32px root text, document overflow 0, title overflow 0, title inside the action, 341.52px minimum target and mirrored arrow matrix",
    "output/android21/t153-global-schedule-bar-reflow/browser-matrix.json",
    "output/android21/t153-global-schedule-bar-reflow/he-narrow-200-keyboard-focus.png",
    "output/android21/t153-global-schedule-bar-reflow/native-api36/he-api36-facts.json",
    "output/android21/t153-global-schedule-bar-reflow/native-api36/he-api36-device-chrome.png",
  ],
  rejectionCriteria:
    "Reject ellipsis or hidden event identity, title/arrow outside the action, page-level horizontal overflow, intra-word fragmentation, targets below the applicable 44 CSS-px Web or 48dp Android contract, wrong RTL arrow direction, or a signed-in-route/platform claim without fresh route evidence",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const habitStreakTimelineComponentEvidence = {
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "N/A: the bounded five-row history reflows vertically; enclosing signed-in sheet scrolling remains UNVERIFIED",
  safeAreaOwner:
    "N/A at the embedded component boundary; exact signed-in Habit detail route safe-area ownership remains UNVERIFIED",
  androidBackOwner: "N/A: embedded non-modal read-only data surface",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he geometry and isolated date endpoints passed on Web and API 36; signed-in route remains UNVERIFIED",
  evidence: [
    "e2e/habit-streak-timeline-reflow.spec.ts: 1/1 test PASS after retained 32-state overflow/fragmentation RED",
    "8 locales x narrow 200%, short portrait, landscape, and split-window: document/component overflow 0; out-of-bounds text, summary/row collisions, intra-word fragmentation, and console errors 0; ten semantic bidi-isolated date endpoints per state",
    "API 36 Chrome component harness: Hebrew RTL, 32px root text, document/component overflow 0, text outside card 0, five rows and ten time[dir=auto] endpoints with unicode-bidi:isolate",
    "output/android21/t153-habit-streak-timeline-reflow/browser-matrix-red.json",
    "output/android21/t153-habit-streak-timeline-reflow/browser-matrix-green.json",
    "output/android21/t153-habit-streak-timeline-reflow/native-api36/he-api36-facts.json",
    "output/android21/t153-habit-streak-timeline-reflow/native-api36/he-api36-device-chrome.png",
  ],
  rejectionCriteria:
    "Reject page/component horizontal overflow, localized summary or history text outside the card, colliding metadata, character-by-character date fragmentation, missing bidi isolation/semantic dates, or a signed-in-route/platform claim without fresh route evidence",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const leaderboardEntryRowComponentEvidence = {
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "N/A: each finite leaderboard row reflows vertically without horizontal scrolling; the enclosing signed-in list remains UNVERIFIED",
  safeAreaOwner:
    "N/A at the embedded row boundary; exact signed-in modal safe-area ownership remains UNVERIFIED",
  androidBackOwner: "N/A: embedded non-modal data row",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he logical rank/name order and bidi-isolated score metadata passed on Web and API 36; signed-in route remains UNVERIFIED",
  evidence: [
    "e2e/leaderboard-entry-row-reflow.spec.ts: 1/1 PASS over 32 locale/viewport states after a retained overflow/fragmentation RED",
    "8 locales x narrow 200%, short portrait, landscape, and split-window: document/card/row overflow 0; out-of-bounds text, child collisions, localized word fragmentation, wrong logical order, and console errors 0",
    "The settled untouched narrow-200 RED exposed Ukrainian and Hebrew score units, a Japanese current-user badge, and mid-word Ukrainian/French best-label fragmentation",
    "API 36 Chrome component harness: Hebrew RTL, 32px root text, document/card/row overflow 0, text outside card 0, five rows, one current-user marker, and logical rank-before-name order",
    "output/android21/t153-leaderboard-entry-row-reflow/browser-matrix-red.json",
    "output/android21/t153-leaderboard-entry-row-reflow/browser-matrix-green.json",
    "output/android21/t153-leaderboard-entry-row-reflow/native-api36/he-api36-facts.json",
    "output/android21/t153-leaderboard-entry-row-reflow/native-api36/he-api36-device-chrome.png",
  ],
  rejectionCriteria:
    "Reject page/card/row horizontal overflow, clipped participant identity or score metadata, direct-child collision, mid-word localized-label fragmentation, wrong RTL rank/name order, hidden text, or a signed-in-route/platform claim without fresh route evidence",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const participantsLeaderboardComponentEvidence = {
  route: "signed-in challenge details; exact authenticated caller route remains UNVERIFIED",
  trigger:
    "conditional ParticipantsLeaderboard render; production component is covered through an isolated cloud-service boundary, while exact signed-in caller state remains UNVERIFIED",
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "focusable component-local region owns bounded vertical scrolling; its nested participant list reflows without horizontal scrolling in the component matrix",
  safeAreaOwner:
    "N/A at the embedded component boundary; exact signed-in challenge surface safe-area ownership remains UNVERIFIED",
  androidBackOwner: "N/A: embedded non-modal participant list",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he logical rank/name order, bidi-isolated progress and current-user copy passed on Web and API 36; signed-in route remains UNVERIFIED",
  evidence: [
    "e2e/participants-leaderboard-reflow.spec.ts: 1/1 PASS over 32 locale/viewport states after retained horizontal, word-fragmentation, vertical-clipping, scroll-focus and semantics RED evidence",
    "The untouched narrow-200 matrix exposed 3-5px row overflow and out-of-card progress in all eight locales, fragmented the localized heading in six locales, left the vertical scroller unreachable by keyboard and supplied no list semantics",
    "An intermediate visual RED proved a 280px first row was cut by the fixed 200px scroll viewport; the rem-scaled viewport now keeps the full first row visible while preserving the original 200px height at 100% text",
    "8 locales x narrow 200%, short portrait, landscape and split window: document/card/row overflow 0; header/row word fragmentation, out-of-bounds text, child collisions, wrong logical order and console errors 0; region/list/listitem and completion-status semantics present",
    "API 36 Chrome component harness: Hebrew RTL, 32px root text, 412x783 viewport, document/card/five-row overflow 0, text outside card 0, first 236px row fully visible in the 400px scroller, one current-user marker, two named completion statuses and correct logical rank/name order",
    "API 36 software-GPU diagnostic smooth scroll sampled 68 intervals: p50 16.7ms, p95/max 33.4ms, 10 over 33ms and 0 over 50ms; this is diagnostic component evidence, not a physical-device or universal motion PASS",
    "output/android21/t153-participants-leaderboard-reflow/browser-matrix-red.json",
    "output/android21/t153-participants-leaderboard-reflow/browser-matrix-red-vertical.json",
    "output/android21/t153-participants-leaderboard-reflow/browser-matrix-green.json",
    "output/android21/t153-participants-leaderboard-reflow/native-api36/he-api36-facts.json",
    "output/android21/t153-participants-leaderboard-reflow/native-api36/he-api36-device-chrome.png",
  ],
  rejectionCriteria:
    "Reject page/card/row horizontal overflow, a row taller than its initial scroll viewport at 200% text, fragmented localized heading copy, clipped participant identity/progress/status, a non-focusable overflow region, missing list/status semantics, wrong RTL rank/name order, or a signed-in/platform claim without fresh route evidence",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const languageSelectorComponentEvidence = {
  evidenceStatus: "PASS_COMPONENT_MATRIX",
  scrollOwner:
    "public-entry document flow scrolls vertically; all eight choices and Continue remain reachable without horizontal scrolling",
  safeAreaOwner:
    "shared entry-gate safe-area and block-end clearance contract; installed Capacitor cutout/system-bar proof remains UNVERIFIED",
  androidBackOwner:
    "N/A at the non-modal first-run component boundary; installed APK root-exit/Back policy remains UNVERIFIED",
  rtlRisk:
    "LOW_COMPONENT_MATRIX: ar/he bidi, wrapping, focus and API 36 Hebrew component checks passed; installed APK and assistive-technology proof remain UNVERIFIED",
  evidence: [
    "e2e/language-selector-reflow.spec.ts: 1/1 PASS over 32 locale/viewport states after a retained clipping RED",
    "8 locales x narrow 200%, short portrait, landscape, and split-window: document/component overflow 0; no out-of-bounds or fragmented language names, collisions, or console errors; all options and Continue meet the scoped target contract",
    "The untouched narrow-200 RED put Ukrainian outside all eight option cards, fragmented Japanese, and hid Spanish/German title text beyond the clipped screen edge",
    "e2e/storage-incident-reflow.spec.ts: 5/5 PASS for the adjacent AuthScreen title/incident flow in en/es/de/ar/he at 320px and 200% text",
    "API 36 Chrome component harness: Hebrew RTL, 200% root text, document/component overflow 0, all text inside inline bounds, eight choices, one selected choice, and Continue fully visible after vertical scroll",
    "output/android21/t153-language-selector-reflow/browser-matrix-red.json",
    "output/android21/t153-language-selector-reflow/browser-matrix-green.json",
    "output/android21/t153-language-selector-reflow/he-api36-device-facts.json",
    "output/android21/t153-language-selector-reflow/he-api36-device-chrome.png",
    "output/android21/t153-language-selector-reflow/he-api36-device-chrome-action.png",
  ],
  rejectionCriteria:
    "Reject page/component horizontal overflow, language labels or title text outside their owner, arbitrary intra-word fragmentation outside the locale-scoped title fallback, colliding choices, unreachable Continue, targets below the applicable 44 CSS-px Web or 48dp Android contract, incorrect RTL direction/focus, or an installed-app/platform claim without fresh runtime proof",
  platformStatus: {
    web: "PASS_COMPONENT_MATRIX_32",
    pwa: "UNVERIFIED",
    android: "PASS_API36_CHROME_COMPONENT_ONLY",
    ios: "UNVERIFIED",
    desktop: "UNVERIFIED",
  },
};

const evidenceOverrides = new Map([
  ["src/components/GlobalScheduleBar.tsx", globalScheduleBarComponentEvidence],
  ["src/components/LanguageSelector.tsx", languageSelectorComponentEvidence],
  ["src/components/habit-hub/HabitStreakTimeline.tsx", habitStreakTimelineComponentEvidence],
  ["src/components/leaderboard/LeaderboardEntryRow.tsx", leaderboardEntryRowComponentEvidence],
  [
    "src/components/challenges/ParticipantsLeaderboard.tsx",
    participantsLeaderboardComponentEvidence,
  ],
  ["src/components/stats/CalendarGrid.tsx", calendarComponentEvidence],
  ["src/components/stats/HabitCalendar.tsx", calendarComponentEvidence],
]);

function walk(directory) {
  return readdirSync(directory)
    .sort()
    .flatMap((entry) => {
      const absolute = join(directory, entry);
      if (statSync(absolute).isDirectory()) {
        if (entry === "__tests__") return [];
        return walk(absolute);
      }
      return [absolute];
    });
}

function toProjectPath(absolute) {
  return relative(projectRoot, absolute).split("\\").join("/");
}

function ownerFromSource(source) {
  return source.split("/").at(-1).replace(/\.(?:tsx|css)$/, "");
}

function routeFor(source) {
  if (source.includes("auth-screen/") || source.endsWith("LanguageSelector.tsx")) {
    return "public entry flow";
  }
  if (source.includes("features/journal/") || source.includes("Diary")) {
    return "signed-in Journal/Diary";
  }
  if (source.includes("nav-v2/habits/") || source.includes("habit-hub/")) {
    return "signed-in V2 Habits";
  }
  if (source.includes("schedule/") || source.includes("Schedule")) {
    return "signed-in Schedule/Planning";
  }
  if (
    source.includes("stats/") ||
    source.includes("Stats") ||
    source.includes("WeeklyReport") ||
    source.includes("leaderboard/")
  ) {
    return "signed-in Insights/Progress";
  }
  if (source.includes("navigation-v2/") || source.includes("NavV2")) {
    return "shared V2 navigation shell";
  }
  if (source.includes("components/ui/")) {
    return "shared overlay primitive; all routes that invoke it";
  }
  if (
    source.endsWith("SplashScreen.tsx") ||
    source.endsWith("UpdatePrompt.tsx") ||
    source.endsWith("OfflineBanner.tsx") ||
    source.endsWith("StorageIncidentBanner.tsx")
  ) {
    return "public and signed-in application shell";
  }
  return "signed-in application shell; exact caller route UNVERIFIED";
}

function triggerFor(source) {
  const owner = ownerFromSource(source);
  const known = {
    StorageIncidentBanner: "active storage incident selected by StorageErrorBanner",
    OfflineBanner: "offline or blocked-sync state",
    UpdatePrompt: "service-worker update readiness",
    NotificationPermission: "notification-permission education flow",
    SplashScreen: "native/web startup gate",
    LanguageSelector: "first-run locale selection",
    AuthScreen: "unauthenticated entry after locale selection",
    HabitActionSheet: "habit action menu",
    HabitCreateSheet: "create-habit action",
    EventDetailsModal: "selected schedule event",
    AddEventModal: "add-schedule-event action",
  };
  return known[owner] ?? `conditional ${owner} render; exact caller state UNVERIFIED`;
}

function classify(source, sourceText, kinds) {
  const nonInteractive =
    /pointer-events-none|aria-hidden=["']true["']/.test(sourceText) &&
    !/<button\b|role=["']dialog["']/.test(sourceText);
  const hasLocalScroll = /overflow-(?:y-|x-)?(?:auto|scroll)/.test(sourceText);
  const hasSafeArea =
    /safe-(?:top|bottom|left|right|inline)|safe-area-inset|var\(--safe/.test(sourceText);
  const hasBackOwner =
    /useBackHandler|onOpenChange|Dialog\.|Drawer\.|Sheet\.|role=["']dialog["']/.test(
      sourceText,
    );
  const hasLogicalDirection =
    /\b(?:start|end|ps|pe)-|rtl:|dir=|margin-inline|padding-inline/.test(sourceText);
  const hasPhysicalDirection = /\b(?:left|right)-|\bleft:|\bright:/.test(sourceText);
  const isEntryIncident = source.endsWith("StorageIncidentBanner.tsx");
  const isEntryHost = source.endsWith("auth-screen/AuthScreen.tsx");

  const row = {
    id: source
      .replace(/^src\//, "")
      .replace(/\.(?:tsx|css)$/, "")
      .replace(/[^a-zA-Z0-9]+/g, "-")
      .toLowerCase(),
    owner: ownerFromSource(source),
    source,
    kinds,
    route: routeFor(source),
    trigger: triggerFor(source),
    scrollOwner: nonInteractive
      ? "N/A: non-interactive visual layer"
      : hasLocalScroll
        ? "component-local overflow container detected; runtime reachability UNVERIFIED"
        : "UNVERIFIED: no component-local overflow owner detected",
    safeAreaOwner: hasSafeArea
      ? "component uses ZenFlow/environment safe-area tokens"
      : nonInteractive
        ? "N/A: non-interactive visual layer"
        : "UNVERIFIED: no local safe-area token detected",
    androidBackOwner: nonInteractive
      ? "N/A: non-interactive visual layer"
      : hasBackOwner
        ? "component or shared primitive Back/dismiss contract detected; runtime LIFO UNVERIFIED"
        : "UNVERIFIED: no local Android Back owner detected",
    rtlRisk: hasPhysicalDirection
      ? hasLogicalDirection
        ? "MEDIUM: mixed logical and physical direction tokens"
        : "HIGH: physical left/right tokens require RTL runtime proof"
      : hasLogicalDirection
        ? "MEDIUM: logical-direction contract detected; RTL runtime proof still required"
        : "MEDIUM: no explicit directional contract detected",
    evidenceStatus:
      isEntryIncident || isEntryHost ? "PASS_NAMED_ENTRY_MATRIX" : "UNVERIFIED",
    evidence:
      isEntryIncident || isEntryHost
        ? [
            "Chromium 320 CSS px at 200% text: en/ar/he 3/3",
            "API 36 Hebrew entry instrumentation 1/1 with panel-incident-footer geometry",
            "output/android21/t151-entry-storage/native-api36/hebrew-storage-incident.png",
          ]
        : [
            `static discovery: ${kinds.join(" + ")}`,
            "No fresh retained runtime capture is attributed to this row",
          ],
    rejectionCriteria: nonInteractive
      ? "Must not intercept input, alter reading order, or create viewport overflow"
      : "Reject clipping, page-level horizontal overflow, obscured focus/action, unreachable dismiss/retry, unsafe-area collision, wrong LIFO Back, or RTL/bidi collision",
    platformStatus: {
      web: isEntryIncident || isEntryHost ? "PASS_NAMED_ENTRY_MATRIX" : "UNVERIFIED",
      pwa: "UNVERIFIED",
      android: isEntryIncident || isEntryHost ? "PASS_API36_HEBREW_ENTRY" : "UNVERIFIED",
      ios: "UNVERIFIED",
      desktop: "UNVERIFIED",
    },
  };

  const override = evidenceOverrides.get(source);
  return override
    ? {
        ...row,
        ...override,
        platformStatus: { ...row.platformStatus, ...override.platformStatus },
      }
    : row;
}

export function discoverInventory() {
  const bySource = new Map();

  for (const absolute of walk(sourceRoot)) {
    const extension = extname(absolute);
    if (extension !== ".tsx" && extension !== ".css") continue;
    const source = toProjectPath(absolute);
    if (/\.(?:test|spec)\./.test(source) || source.includes("/__dev/")) continue;
    const sourceText = readFileSync(absolute, "utf8");
    const kinds = [];
    if (FIXED_CLASS_PATTERN.test(sourceText) || FIXED_STYLE_PATTERN.test(sourceText)) {
      kinds.push("fixed-overlay-or-notification-owner");
    }
    if (
      DATA_STRUCTURE_PATTERN.test(sourceText) ||
      DATA_OWNER_NAME_PATTERN.test(ownerFromSource(source))
    ) {
      kinds.push("table-grid-or-two-dimensional-surface");
    }
    if (kinds.length > 0) bySource.set(source, kinds);
  }

  for (const [source, kinds] of forcedCandidates) {
    const current = bySource.get(source) ?? [];
    bySource.set(source, [...new Set([...current, ...kinds])]);
  }

  const surfaces = [...bySource.entries()]
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([source, kinds]) =>
      classify(source, readFileSync(join(projectRoot, source), "utf8"), kinds),
    );

  return {
    schemaVersion: 1,
    feature: "002-android-2-1-connected-release",
    generatedOn: "2026-08-11",
    scope: {
      fixedDiscovery:
        "production .tsx className/style fixed declarations and .css position:fixed rules",
      dataDiscovery:
        "literal tables/grids, horizontal data scrollers, and named calendar/heatmap/timeline/schedule/stats/chart/grid/table owners",
      exclusions: [
        "tests and test helpers",
        "non-UI .ts fixed-code terminology",
        "production reachability not proven solely by source presence",
      ],
    },
    summary: {
      surfaceOwners: surfaces.length,
      fixedOwners: surfaces.filter((row) =>
        row.kinds.includes("fixed-overlay-or-notification-owner"),
      ).length,
      dataOwners: surfaces.filter((row) =>
        row.kinds.includes("table-grid-or-two-dimensional-surface"),
      ).length,
      namedEntryPassRows: surfaces.filter(
        (row) => row.evidenceStatus === "PASS_NAMED_ENTRY_MATRIX",
      ).length,
      componentMatrixPassRows: surfaces.filter(
        (row) => row.evidenceStatus === "PASS_COMPONENT_MATRIX",
      ).length,
      unverifiedRows: surfaces.filter((row) => row.evidenceStatus === "UNVERIFIED").length,
    },
    globalUnverified: [
      "signed-in private-route visual matrix",
      "installed PWA runtime",
      "physical Android devices",
      "iOS/WKWebView",
      "Desktop/Tauri",
      "human assistive-technology and artistic acceptance",
    ],
    surfaces,
  };
}

function validateInventory(expected, actual) {
  const errors = [];
  if (actual?.schemaVersion !== 1) errors.push("schemaVersion must equal 1");
  if (!Array.isArray(actual?.surfaces)) errors.push("surfaces must be an array");
  if (errors.length > 0) return errors;

  const requiredFields = [
    "id",
    "owner",
    "source",
    "kinds",
    "route",
    "trigger",
    "scrollOwner",
    "safeAreaOwner",
    "androidBackOwner",
    "rtlRisk",
    "evidenceStatus",
    "evidence",
    "rejectionCriteria",
    "platformStatus",
  ];
  const actualBySource = new Map();
  for (const row of actual.surfaces) {
    if (actualBySource.has(row.source)) errors.push(`duplicate source row: ${row.source}`);
    actualBySource.set(row.source, row);
    for (const field of requiredFields) {
      if (!(field in row)) errors.push(`${row.source ?? "unknown"}: missing ${field}`);
    }
  }

  const expectedSources = expected.surfaces.map((row) => row.source).sort();
  const actualSources = [...actualBySource.keys()].sort();
  for (const source of expectedSources) {
    if (!actualBySource.has(source)) errors.push(`uncovered source candidate: ${source}`);
  }
  for (const source of actualSources) {
    if (!expectedSources.includes(source)) errors.push(`stale inventory source: ${source}`);
  }
  for (const expectedRow of expected.surfaces) {
    const actualRow = actualBySource.get(expectedRow.source);
    if (!actualRow) continue;
    const expectedKinds = [...expectedRow.kinds].sort().join("|");
    const actualKinds = [...(actualRow.kinds ?? [])].sort().join("|");
    if (expectedKinds !== actualKinds) {
      errors.push(`${expectedRow.source}: kinds drift (${actualKinds} != ${expectedKinds})`);
    }
    if (actualRow.evidenceStatus !== expectedRow.evidenceStatus) {
      errors.push(
        `${expectedRow.source}: evidenceStatus drift (${actualRow.evidenceStatus} != ${expectedRow.evidenceStatus})`,
      );
    }
    if (
      JSON.stringify(actualRow.platformStatus) !== JSON.stringify(expectedRow.platformStatus)
    ) {
      errors.push(`${expectedRow.source}: platformStatus drift`);
    }
    if (evidenceOverrides.has(expectedRow.source)) {
      for (const field of [
        "route",
        "trigger",
        "scrollOwner",
        "safeAreaOwner",
        "androidBackOwner",
        "rtlRisk",
        "evidence",
        "rejectionCriteria",
      ]) {
        if (JSON.stringify(actualRow[field]) !== JSON.stringify(expectedRow[field])) {
          errors.push(`${expectedRow.source}: ${field} drift`);
        }
      }
    }
  }
  if (actual.surfaces.length !== expected.surfaces.length) {
    errors.push(
      `surface count drift (${actual.surfaces.length} != ${expected.surfaces.length})`,
    );
  }
  for (const [key, value] of Object.entries(expected.summary)) {
    if (actual.summary?.[key] !== value) {
      errors.push(`summary.${key} drift (${actual.summary?.[key]} != ${value})`);
    }
  }
  return errors;
}

const mode = process.argv[2] ?? "--check";
const expected = discoverInventory();

if (mode === "--print") {
  process.stdout.write(`${JSON.stringify(expected, null, 2)}\n`);
} else if (mode === "--check") {
  let actual;
  try {
    actual = JSON.parse(readFileSync(inventoryPath, "utf8"));
  } catch (error) {
    console.error(`[android21-reflow-inventory] cannot read inventory: ${error.message}`);
    process.exit(1);
  }
  const errors = validateInventory(expected, actual);
  if (errors.length > 0) {
    for (const error of errors) console.error(`[android21-reflow-inventory] ${error}`);
    process.exit(1);
  }
  console.log(
    `[android21-reflow-inventory] PASS ${actual.summary.surfaceOwners} owners; ` +
      `${actual.summary.fixedOwners} fixed; ${actual.summary.dataOwners} data/reflow`,
  );
} else {
  console.error("Usage: node tools/release/android21-reflow-inventory.mjs --check|--print");
  process.exit(2);
}
