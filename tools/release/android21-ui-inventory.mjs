#!/usr/bin/env node

import { createHash } from "node:crypto";
import { existsSync, mkdirSync, readFileSync, readdirSync, statSync, writeFileSync } from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const toolDir = dirname(fileURLToPath(import.meta.url));
const root = resolve(toolDir, "../..");
const srcRoot = join(root, "src");
const canonicalPath = join(root, "docs/release/android-2.1-ui-inventory.json");
const ENTRY = "src/main.tsx";
const NAV = "src/hooks/useNavigationV2.ts";
const ORCHESTRATOR = "src/components/navigation-v2/NavV2Orchestrator.tsx";
const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const PLATFORMS = ["web", "pwa", "android", "ios", "desktop"];
const EXTENSIONS = [".ts", ".tsx", ".js", ".jsx", ".mjs", ".cjs", ".css"];
const TEST_PATH = /(?:^|\/)(?:__tests__|test|tests|e2e)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const DEV_PATH = /(?:^|\/)__dev(?:__)?(?:\/|$)/;
const NAMED_OVERLAY = /(?:Modal|Dialog|Sheet|Overlay|Takeover|Palette|Viewer|Picker|Panel|Layer)$/;
const NAMED_DATA =
  /(?:Calendar|Heatmap|Timeline|Schedule|WeeklyReport|Leaderboard|Stats|Chart|Grid|Table)/;
const CONTENT_TAG =
  /(?:^|\.)(?:DialogContent|AlertDialogContent|SheetContent|DrawerContent|PopoverContent|DropdownMenuContent|SelectContent|ContextMenuContent|HoverCardContent|TooltipContent|CommandDialog|DialogMotionContent|SheetMotionContent)$/;
const PRIMITIVE_CONTENT =
  /(?:Dialog|AlertDialog|Sheet|Drawer|Popover|DropdownMenu|Select|ContextMenu|HoverCard|Tooltip)Primitive\.Content$/;
const FIXED = /(?:^|[\s"'\x60])fixed(?:[\s"'\x60:[\]-]|$)/;
const DATA =
  /<table\b|role\s*=\s*["'](?:table|grid|treegrid)["']|grid-cols-7|gridAutoColumns|\bmin-w-max\b/;
const HORIZONTAL = /overflow-x-(?:auto|scroll)|overscroll-x-contain|snap-x/;
const NON_OWNER_REFERENCES = [
  {
    path: "src/components/canvas/MindMapCanvas.tsx",
    token: "target.closest('button, input, [role=\"dialog\"]')",
    fact: "The token is an event-delegation guard that observes nested dialogs; this component does not render that dialog selector.",
  },
  {
    path: "src/components/navigation-v2/ThemeToggleV2.tsx",
    token: 'target.closest(\'[role="dialog"][aria-modal="true"]\')',
    fact: "The token detects whether the theme action is inside another owner dialog; it does not render a dialog.",
  },
];

function rel(path) {
  return relative(root, path).split("\\").join("/");
}

function abs(path) {
  if (
    typeof path !== "string" ||
    !path.startsWith("src/") ||
    path.includes("..") ||
    !/^src\/[a-zA-Z0-9_./-]+$/.test(path)
  ) {
    throw new Error("SOURCE_PATH_OUTSIDE_SRC " + String(path));
  }
  const resolved = resolve(root, path);
  if (resolved !== srcRoot && !resolved.startsWith(srcRoot + sep)) {
    throw new Error("SOURCE_PATH_OUTSIDE_SRC " + path);
  }
  return resolved;
}

function read(path) {
  return readFileSync(abs(path), "utf8");
}

function digest(text) {
  return createHash("sha256").update(text).digest("hex");
}

function slug(text) {
  return text
    .replace(/^src\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function walk(dir) {
  return readdirSync(dir)
    .sort()
    .flatMap((name) => {
      const path = join(dir, name);
      return statSync(path).isDirectory() ? walk(path) : [path];
    });
}

function resolveModule(from, specifier) {
  const clean = specifier.split(/[?#]/, 1)[0];
  let base;
  if (clean.startsWith("@/")) base = join(srcRoot, clean.slice(2));
  else if (clean.startsWith(".")) base = resolve(dirname(abs(from)), clean);
  else return null;
  if (extname(base) && !EXTENSIONS.includes(extname(base))) return null;
  const candidates = extname(base)
    ? [base]
    : [
        ...EXTENSIONS.map((extension) => base + extension),
        ...EXTENSIONS.map((extension) => join(base, "index" + extension)),
      ];
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  );
  return found ? rel(found) : null;
}

function parsed(path, text) {
  const kind = path.endsWith(".tsx")
    ? ts.ScriptKind.TSX
    : path.endsWith(".jsx")
      ? ts.ScriptKind.JSX
      : path.endsWith(".js") || path.endsWith(".mjs")
        ? ts.ScriptKind.JS
        : ts.ScriptKind.TS;
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, kind);
}

function imports(path, text) {
  if (path.endsWith(".css")) return [];
  const file = parsed(path, text);
  const found = new Set();
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause?.namedBindings;
      const allNamedType =
        clause &&
        !clause.name &&
        named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((element) => element.isTypeOnly);
      if (!clause?.isTypeOnly && !allNamedType) found.add(node.moduleSpecifier.text);
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.add(node.moduleSpecifier.text);
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.add(node.arguments[0].text);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return [...found];
}

function graph(entries) {
  const edges = new Map();
  const reachable = new Set();
  const queue = [...entries];
  while (queue.length) {
    const path = queue.shift();
    if (
      !path ||
      reachable.has(path) ||
      TEST_PATH.test(path) ||
      DEV_PATH.test(path) ||
      !existsSync(abs(path))
    ) {
      continue;
    }
    reachable.add(path);
    const dependencies = [
      ...new Set(
        imports(path, read(path))
          .map((specifier) => resolveModule(path, specifier))
          .filter(Boolean)
          .filter((item) => !TEST_PATH.test(item) && !DEV_PATH.test(item))
      ),
    ].sort();
    edges.set(path, dependencies);
    queue.push(...dependencies);
  }
  return { edges, reachable };
}

function importPath(edges, entry, target) {
  if (entry === target) return [entry];
  const queue = [[entry]];
  const seen = new Set([entry]);
  while (queue.length) {
    const path = queue.shift();
    for (const next of edges.get(path.at(-1)) ?? []) {
      if (seen.has(next)) continue;
      const candidate = [...path, next];
      if (next === target) return candidate;
      seen.add(next);
      queue.push(candidate);
    }
  }
  return [];
}

function line(file, position) {
  return file.getLineAndCharacterOfPosition(position).line + 1;
}

function tokenAt(text, number) {
  return (text.split(/\r?\n/)[number - 1]?.trim() ?? "").slice(0, 220);
}

function locator(file, text, number, kind, token) {
  return { file, line: number, kind, token: token || tokenAt(text, number) };
}

function componentFor(node, file) {
  let current = node;
  while (current) {
    if (ts.isFunctionDeclaration(current) && current.name) {
      return { name: current.name.text, node: current };
    }
    if (ts.isFunctionExpression(current) || ts.isArrowFunction(current)) {
      if (ts.isVariableDeclaration(current.parent)) {
        return { name: current.parent.name.getText(file), node: current };
      }
      if (ts.isCallExpression(current.parent) && ts.isVariableDeclaration(current.parent.parent)) {
        return {
          name: current.parent.parent.name.getText(file),
          node: current,
        };
      }
    }
    current = current.parent;
  }
  return { name: "module", node: file };
}

function conditions(node, file) {
  const values = [];
  let current = node.parent;
  while (current && values.length < 4) {
    if (ts.isConditionalExpression(current)) {
      values.push(current.condition.getText(file));
    } else if (
      ts.isBinaryExpression(current) &&
      current.operatorToken.kind === ts.SyntaxKind.AmpersandAmpersandToken
    ) {
      values.push(current.left.getText(file));
    } else if (ts.isIfStatement(current)) {
      values.push(current.expression.getText(file));
    }
    if (
      ts.isFunctionDeclaration(current) ||
      ts.isFunctionExpression(current) ||
      ts.isArrowFunction(current)
    ) {
      break;
    }
    current = current.parent;
  }
  return [...new Set(values.map((value) => value.slice(0, 220)))];
}

function classifyJsx(node, file, path) {
  const opening = ts.isJsxElement(node) ? node.openingElement : node;
  const tag = opening.tagName.getText(file);
  const text = opening.getText(file);
  const component = componentFor(node, file);
  const roleMatch = text.match(
    /\brole\s*=\s*(?:["'](dialog|alertdialog|table|grid|treegrid)["']|\{\s*["'](dialog|alertdialog|table|grid|treegrid)["']\s*\})/
  );
  const role = roleMatch?.[1] || roleMatch?.[2] || "";
  const kinds = [];
  let primary = "";
  if (
    role === "dialog" ||
    role === "alertdialog" ||
    /\baria-modal\s*=\s*(?:["']true["']|\{\s*true\s*\})/.test(text)
  ) {
    primary = role === "alertdialog" ? "alert-dialog" : "dialog";
    kinds.push(primary);
  }
  if (CONTENT_TAG.test(tag) || PRIMITIVE_CONTENT.test(tag)) {
    const lower = tag.toLowerCase();
    const kind = lower.includes("sheet")
      ? "sheet"
      : lower.includes("drawer")
        ? "drawer"
        : lower.includes("tooltip")
          ? "tooltip"
          : lower.includes("popover")
            ? "popover"
            : lower.includes("menu") || lower.includes("select")
              ? "menu"
              : "dialog";
    kinds.push(kind);
    primary ||= kind;
  }
  const table =
    tag.toLowerCase() === "table" || role === "table" || role === "grid" || role === "treegrid";
  if (table) {
    const kind = tag.toLowerCase() === "table" || role === "table" ? "table" : "data-grid";
    kinds.push(kind);
    primary ||= kind;
  } else if (
    DATA.test(text) ||
    (HORIZONTAL.test(text) && NAMED_DATA.test(component.name + " " + path))
  ) {
    kinds.push("data-grid");
    primary ||= "data-grid";
  }
  if (FIXED.test(text)) {
    kinds.push("fixed-overlay-or-takeover");
    primary ||= "fixed-overlay-or-takeover";
  }
  if (!primary) return null;
  return {
    position: opening.getStart(file),
    end: node.getEnd(),
    componentName: component.name,
    componentNode: component.node,
    conditions: conditions(node, file),
    tag,
    markerText: text,
    kinds: [...new Set(kinds)],
    primary,
  };
}

function candidates(path) {
  const text = read(path);
  const file = parsed(path, text);
  const result = [];
  const portals = [];
  function visit(node) {
    if (ts.isJsxElement(node) || ts.isJsxSelfClosingElement(node)) {
      const candidate = classifyJsx(node, file, path);
      if (candidate) result.push(candidate);
    }
    if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "createPortal"
    ) {
      portals.push(node);
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  for (const portal of portals) {
    const owner = componentFor(portal, file);
    const ownerAlreadyHasSurface = result.some(
      (candidate) =>
        candidate.componentName === owner.name &&
        !candidate.kinds.every((kind) => ["table", "data-grid", "data-grid-owner"].includes(kind))
    );
    if (
      !ownerAlreadyHasSurface &&
      !result.some(
        (candidate) =>
          candidate.position >= portal.getStart(file) && candidate.end <= portal.getEnd()
      )
    ) {
      result.push({
        position: portal.getStart(file),
        end: portal.getEnd(),
        componentName: owner.name,
        componentNode: owner.node,
        conditions: conditions(portal, file),
        tag: "createPortal",
        markerText: "createPortal",
        kinds: ["portal-overlay"],
        primary: "portal-overlay",
      });
    }
  }
  const merged = new Set();
  for (const outer of result) {
    if (outer.kinds.length !== 1 || outer.kinds[0] !== "fixed-overlay-or-takeover") {
      continue;
    }
    const inner = result.find(
      (candidate) =>
        candidate !== outer &&
        candidate.componentName === outer.componentName &&
        candidate.position > outer.position &&
        candidate.end <= outer.end &&
        candidate.kinds.some((kind) =>
          ["dialog", "alert-dialog", "sheet", "drawer", "popover", "menu", "tooltip"].includes(kind)
        )
    );
    if (!inner) continue;
    inner.kinds = [...new Set([...inner.kinds, ...outer.kinds])];
    inner.additionalMarkers = [
      ...(inner.additionalMarkers ?? []),
      {
        position: outer.position,
        tag: outer.tag,
      },
    ];
    merged.add(outer);
  }
  if (merged.size) {
    for (let index = result.length - 1; index >= 0; index -= 1) {
      if (merged.has(result[index])) result.splice(index, 1);
    }
  }
  const base = path
    .split("/")
    .at(-1)
    .replace(/\.[^.]+$/, "");
  const namedOverlay = NAMED_OVERLAY.test(base);
  const namedData = NAMED_DATA.test(base);
  if (namedOverlay || namedData) {
    const covered = result.some((candidate) =>
      namedOverlay
        ? candidate.kinds.some((kind) => !["table", "data-grid"].includes(kind))
        : candidate.kinds.includes("table") || candidate.kinds.includes("data-grid")
    );
    if (!covered) {
      result.push({
        position: 0,
        end: 1,
        componentName: base,
        componentNode: file,
        conditions: [],
        tag: base,
        markerText: base,
        kinds: [namedOverlay ? "named-overlay-owner" : "data-grid-owner"],
        primary: namedOverlay ? "named-overlay-owner" : "data-grid-owner",
      });
    }
  }
  result.sort(
    (left, right) => left.position - right.position || left.primary.localeCompare(right.primary)
  );
  const ordinals = new Map();
  return result.map((candidate) => {
    const key = candidate.componentName + ":" + candidate.primary;
    const ordinal = (ordinals.get(key) ?? 0) + 1;
    ordinals.set(key, ordinal);
    return { ...candidate, ordinal, path, text, file };
  });
}

function evidence(path, text, start, end, patterns) {
  const lines = text.split(/\r?\n/);
  const result = [];
  for (let number = Math.max(1, start); number <= Math.min(end, lines.length); number += 1) {
    if (!patterns.some((pattern) => pattern.test(lines[number - 1]))) continue;
    const item = tokenAt(text, number);
    if (item) result.push(locator(path, text, number, "source-token", item));
  }
  return result;
}

function state(found, unresolved) {
  return found.length
    ? { sourceStatus: "PASS", evidence: found, runtimeStatus: "UNVERIFIED" }
    : {
        sourceStatus: "UNVERIFIED",
        evidence: [],
        runtimeStatus: "UNVERIFIED",
        unresolved,
      };
}

function platformMatrix(route) {
  return Object.fromEntries(
    PLATFORMS.map((platform) => [
      platform,
      {
        applicability: "APPLICABLE",
        sourceReachability:
          platform === "web" ? "PASS_STATIC_SHARED_WEB_SOURCE" : "PASS_STATIC_SHARED_SOURCE_ONLY",
        runtime: "UNVERIFIED",
        routeScope: route.scope,
      },
    ])
  );
}

function ownerLayer(path, chain) {
  const owners = [
    ["src/components/ModalLayer.tsx", "ModalLayer"],
    ["src/components/OverlayLayer.tsx", "OverlayLayer"],
    ["src/components/navigation-v2/V2ProgressionModalLayer.tsx", "V2ProgressionModalLayer"],
    ["src/components/navigation-v2/V2MindfulMomentLayer.tsx", "V2MindfulMomentLayer"],
    ["src/features/journal/JournalModule.tsx", "DiaryFeatureLayer"],
    [ORCHESTRATOR, "NavV2Orchestrator"],
    ["src/App.tsx", "AppRoot"],
  ];
  for (const [source, name] of owners) {
    if (path === source || chain.includes(source)) return name;
  }
  return "component-local";
}

function routeFor(path, destinations, chain) {
  const names = destinations
    .filter((item) => item.reachable.has(path))
    .map((item) => item.destination);
  if (names.length) {
    return {
      scope: names.length === 5 ? "all-five-destinations" : "destination-subtree",
      destinations: names,
    };
  }
  if (chain.includes(ORCHESTRATOR)) {
    return { scope: "shared-five-destination-shell", destinations: [] };
  }
  if (chain.includes("src/App.tsx") || path.includes("/auth/") || path.includes("AuthGate")) {
    return { scope: "global-entry-or-auth-shell", destinations: [] };
  }
  return { scope: "production-app-shell", destinations: [] };
}

const PATTERNS = {
  open: [
    /\bopen\s*=/,
    /\bonOpenChange\s*=/,
    /\b(?:isOpen|show[A-Z]\w*|selected[A-Z]\w*|active[A-Z]\w*)\b/,
    /\baria-modal\s*=/,
  ],
  exit: [
    /\bon(?:Close|Dismiss|Cancel|Back|OpenChange|EscapeKeyDown|PointerDownOutside|InteractOutside)\s*=/,
    /\bhandle(?:Close|Dismiss|Cancel|Back|Exit)\b/,
    /\bset[A-Za-z0-9]*(?:Open|Show|Modal|Sheet|Dialog)\s*\(\s*(?:false|null)\s*\)/,
    /\b(?:key|event\.key)\s*={2,3}\s*["']Escape["']/,
    /\bwindow\.history\.back\s*\(/,
    /\baria-label\s*=\s*(?:\{[^}]*(?:close|back|dismiss|cancel)[^}]*\}|["'][^"']*(?:close|back|dismiss|cancel)[^"']*["'])/i,
  ],
  back: [
    /\bregisterModalCloseCallback\b/,
    /\buseBackHandler\b/,
    /\buseModalKeyboard\b/,
    /\bonOpenChange\s*=/,
    /\bhandleBack\b/,
  ],
  escape: [
    /\bEscape\b/,
    /\bonEscapeKeyDown\s*=/,
    /\buseModalKeyboard\b/,
    /\buseKeyboardShortcuts\b/,
  ],
  outside: [
    /\bon(?:PointerDownOutside|InteractOutside)\s*=/,
    /\bevent\.target\s*={2,3}\s*event\.currentTarget\b/,
    /\bonClick\s*=\s*\{[^}]*(?:Close|Dismiss|Cancel)/,
    /\bDialogOverlay\b|\bSheetOverlay\b/,
  ],
  focusEntry: [
    /\.focus\s*\(/,
    /\bautoFocus\b/,
    /\bonOpenAutoFocus\b/,
    /\binitialFocus\b/,
    /\btabIndex\s*=/,
  ],
  focusTrap: [
    /\buseModalKeyboard\b/,
    /\bFocusScope\b/,
    /\btrapFocus\b/,
    /\baria-modal\s*=/,
    /\bDialogContent\b|\bAlertDialogContent\b|\bSheetContent\b/,
  ],
  focusRestore: [
    /\brestoreFocus\b/,
    /\bonCloseAutoFocus\b/,
    /\btriggerRef\b/,
    /\bpreviouslyFocused\b/,
    /\.focus\s*\(\s*\{\s*preventScroll/,
  ],
  scroll: [
    /\boverflow-(?:x-|y-)?(?:auto|scroll)\b/,
    /\buseBodyScrollLock\b/,
    /\bdocument\.body\.style\.overflow\b/,
    /\boverscroll-(?:contain|none|x-contain|y-contain)\b/,
    /\btouch-pan-[xy]\b/,
  ],
  ime: [
    /<input\b/,
    /<textarea\b/,
    /\bcontentEditable\b/,
    /\bvisualViewport\b/,
    /\bkeyboard\b/i,
    /\bime\b/i,
  ],
  safeArea: [
    /--safe-(?:top|bottom|left|right|inline-start|inline-end)/,
    /safe-area-inset-/,
    /\bv2-edge-to-edge-surface\b/,
    /\bsafe-(?:top|bottom|left|right)\b/,
  ],
  reflow: [
    /\bmax-w-/,
    /\bmin-w-0\b/,
    /\b(?:sm|md|lg|xl):/,
    /\boverflow-(?:x-|y-)?(?:auto|scroll)\b/,
    /\bflex-wrap\b/,
    /\bgrid-cols-/,
    /\bmax-h-/,
  ],
  rtl: [/\brtl:/, /\bdir\s*=/, /\b(?:ps|pe|ms|me|start|end)-/, /\bunicode-bidi\b/, /\bisolate\b/],
  physical: [/\b(?:left|right)-/, /\b(?:left|right)\s*:/],
  copy: [/\buseLanguage\s*\(/, /\b(?:t|tx)\.[A-Za-z0-9_]+/, /\b(?:t|tx)\[[^\]]+\]/, /\bi18n\b/],
  motion: [
    /\bmotion-(?:safe|reduce):/,
    /\buseShouldAnimate\b/,
    /\bprefers-reduced-motion\b/,
    /\breducedMotion\b/,
  ],
  interactive: [/<button\b/, /<input\b/, /<textarea\b/, /\bonClick\s*=/, /\bonKeyDown\s*=/],
};

function surfaceRow(candidate, main, destinationGraphs) {
  const path = candidate.path;
  const text = candidate.text;
  const markerLine = line(candidate.file, candidate.position);
  const start = line(candidate.file, candidate.componentNode.getStart(candidate.file));
  const end = line(candidate.file, candidate.componentNode.getEnd());
  const surfaceEnd = line(candidate.file, candidate.end);
  const contextStart = Math.max(start, markerLine - 200);
  const contextEnd = Math.min(end, surfaceEnd + 200);
  const chain = importPath(main.edges, ENTRY, path);
  const route = routeFor(path, destinationGraphs, chain);
  const local = (key) => evidence(path, text, markerLine, surfaceEnd, PATTERNS[key]);
  const nearby = (key) => evidence(path, text, contextStart, contextEnd, PATTERNS[key]);
  const limitedLocal = (key, limit = 8) => local(key).slice(0, limit);
  const limitedNearby = (key, limit = 6) => nearby(key).slice(0, limit);
  const open = limitedNearby("open");
  const exits = local("exit");
  const back = limitedNearby("back");
  const escape = limitedNearby("escape");
  const outside = limitedLocal("outside");
  const focusEntry = limitedNearby("focusEntry");
  const focusTrap = limitedNearby("focusTrap");
  const focusRestore = limitedNearby("focusRestore");
  const scroll = limitedLocal("scroll");
  const ime = limitedLocal("ime");
  const safeArea = limitedNearby("safeArea");
  const reflow = limitedLocal("reflow");
  const rtl = limitedLocal("rtl");
  const physical = limitedLocal("physical");
  const copy = limitedNearby("copy");
  const motion = limitedNearby("motion");
  const interactiveEvidence = limitedLocal("interactive");
  const dataOnly = candidate.kinds.every((kind) =>
    ["table", "data-grid", "data-grid-owner"].includes(kind)
  );
  const interactive = !dataOnly || interactiveEvidence.length > 0;
  const ownerLocator =
    path + "#" + candidate.componentName + "#" + candidate.primary + "#" + candidate.ordinal;
  const markerToken =
    candidate.tag === "createPortal"
      ? "createPortal"
      : candidate.primary === "named-overlay-owner" || candidate.primary === "data-grid-owner"
        ? tokenAt(text, markerLine)
        : "<" + candidate.tag;
  const exitItems =
    dataOnly && !interactive
      ? [
          {
            kind: "N/A",
            sourceStatus: "N/A",
            rationale: "Non-modal read-only data surface has no takeover exit.",
            evidence: [],
          },
        ]
      : exits.length
        ? exits.map((item) => ({
            kind: /Escape/.test(item.token)
              ? "escape"
              : /Back|history\.back/i.test(item.token)
                ? "back"
                : /PointerDownOutside|InteractOutside|event\.target/.test(item.token)
                  ? "outside-tap"
                  : "visible-or-state-exit",
            sourceStatus: "PASS",
            evidence: [item],
            runtimeStatus: "UNVERIFIED",
          }))
        : [
            {
              kind: "unresolved",
              sourceStatus: "UNVERIFIED",
              evidence: [],
              runtimeStatus: "UNVERIFIED",
              unresolved:
                "No close/dismiss/cancel/Back/Escape token was found in the enclosing owner; route to T182/T187.",
            },
          ];
  return {
    id: "t181-" + slug(ownerLocator),
    ownerLocator,
    component: candidate.componentName,
    source: {
      file: path,
      sha256: digest(text),
      locators: [
        locator(path, text, markerLine, "surface-marker", markerToken),
        ...(candidate.additionalMarkers ?? []).map((item) =>
          locator(
            path,
            text,
            line(candidate.file, item.position),
            "merged-surface-part",
            "<" + item.tag
          )
        ),
        locator(path, text, start, "component-owner"),
      ],
      productionImportPath: chain.map((item, index) => ({
        file: item,
        relation:
          index === 0
            ? "production-entry"
            : index === chain.length - 1
              ? "surface-owner"
              : "runtime-import",
      })),
    },
    surfaceKinds: candidate.kinds,
    route: {
      destination: route.destinations.length === 1 ? route.destinations[0] : null,
      destinations: route.destinations,
      scope: route.scope,
    },
    productionTrigger: {
      sourceStatus: candidate.conditions.length ? "PASS" : "UNVERIFIED",
      conditions: candidate.conditions,
      evidence: [locator(path, text, markerLine, "surface-marker", markerToken)],
      unresolved: candidate.conditions.length
        ? null
        : "Exact user action or state transition requires T190 runtime traversal.",
    },
    ownerLayer: {
      name: ownerLayer(path, chain),
      sourceStatus: "PASS",
      importPath: chain,
    },
    openState: state(
      open,
      "No explicit open/show/selected state token was found in the enclosing owner."
    ),
    exits: {
      scope:
        "All statically detected close, dismiss, cancel, Back, Escape and outside-interaction tokens in the exact JSX surface subtree are retained; bounded nearby owner context supplements handler ownership, and runtime activation is not inferred.",
      items: exitItems,
    },
    androidBack: {
      ...state(
        back,
        dataOnly && !interactive
          ? "N/A for a non-modal data surface."
          : "No local/shared Android Back token was found; route to T182."
      ),
      applicability: dataOnly && !interactive ? "N/A" : "APPLICABLE",
    },
    predictiveBack: {
      applicability: dataOnly && !interactive ? "N/A" : "APPLICABLE_ANDROID",
      sourceStatus: "UNVERIFIED",
      evidence: back,
      runtimeStatus: "UNVERIFIED_T182",
    },
    escape: {
      ...state(
        escape,
        dataOnly && !interactive
          ? "N/A for a non-modal data surface."
          : "No Escape ownership token was found; route to T182/T187."
      ),
      applicability: dataOnly && !interactive ? "N/A" : "APPLICABLE_WEB_DESKTOP",
    },
    outsideTap: {
      ...state(
        outside,
        dataOnly && !interactive
          ? "N/A for a non-modal data surface."
          : "Outside-tap behavior is not declared locally."
      ),
      applicability: dataOnly && !interactive ? "N/A" : "CONDITIONAL",
    },
    focus: {
      entry: state(focusEntry, "Initial focus target is not statically explicit."),
      trap: state(
        focusTrap,
        dataOnly && !interactive
          ? "N/A for a non-modal data surface."
          : "Focus trap ownership is not statically explicit."
      ),
      restore: state(
        focusRestore,
        dataOnly && !interactive
          ? "N/A for a non-modal data surface."
          : "Focus restoration target is not statically explicit."
      ),
      runtimeStatus: "UNVERIFIED_T187_T188",
    },
    scrollOwnership: state(scroll, "No component-local scroll or scroll-lock token was found."),
    ime: {
      applicability: ime.length ? "APPLICABLE" : "CONDITIONAL",
      ...state(
        ime,
        "No input/textarea/visualViewport/keyboard token was found; nested IME effects remain unverified."
      ),
      runtimeStatus: "UNVERIFIED_T183_T184",
    },
    safeAreaEdgeToEdge: {
      ...state(
        safeArea,
        "No local safe-area token was found; enclosing shell ownership requires T184."
      ),
      runtimeStatus: "UNVERIFIED_T184",
    },
    reflowDesktopWidth: {
      ...state(
        reflow,
        "No local responsive/reflow token was found; adaptive behavior remains unverified."
      ),
      runtimeStatus: "UNVERIFIED_T185_T187",
    },
    rtlBidi: {
      ...state(
        rtl,
        "No local logical-direction/bidi token was found; locale runtime remains unverified."
      ),
      physicalDirectionEvidence: physical,
      runtimeStatus: "UNVERIFIED_T186",
    },
    copyOwner: {
      allEightLocales: LOCALES,
      localeFiles: LOCALES.map((locale) => ({
        locale,
        file: "src/i18n/languages/" + locale + ".ts",
        sourceStatus: existsSync(abs("src/i18n/languages/" + locale + ".ts")) ? "PASS" : "FAIL",
      })),
      sourceStatus: copy.length ? "PASS" : "UNVERIFIED",
      evidence: copy,
      runtimeStatus: "UNVERIFIED_T186",
    },
    reducedMotion: {
      ...state(
        motion,
        "No local reduced-motion token was found; global AnimationGate still requires T187 runtime proof."
      ),
      runtimeStatus: "UNVERIFIED_T187",
    },
    platformImpact: platformMatrix(route),
    platformDomainImpact: {
      platforms: PLATFORMS,
      domain: "navigation-accessibility-reflow",
      affectedOwner: ownerLocator,
    },
    evidenceStatus: {
      sourceReachability: "PASS",
      ownershipSchema: "PASS",
      runtime: "UNVERIFIED",
      humanAssistiveTechnology: "UNVERIFIED",
      culturalReview: "UNVERIFIED",
      visualCraft: "UNVERIFIED",
    },
    evidence: [
      {
        type: "local-file",
        locator: path + ":" + markerLine,
        sha256: digest(text),
      },
      {
        type: "local-command",
        command: "node tools/release/android21-ui-inventory.mjs --check",
        proves: "source reachability, coverage, uniqueness and freshness only",
      },
    ],
    verification: {
      run: [
        "static production import traversal",
        "source hash and locator validation",
        "mandatory ownership schema validation",
      ],
      skipped: [
        "authenticated private-route browser traversal",
        "installed PWA",
        "Android predictive Back and IME device matrix",
        "iOS/WKWebView",
        "Desktop/Tauri runtime",
        "human TalkBack, cultural and visual-craft review",
      ],
    },
    unresolvedRisk:
      "Static ownership does not prove event ordering, reachability, focus, reflow, native Back, locale semantics or human usability.",
    verdict: "GO",
    verdictScope:
      "T181 static inventory row inclusion only; T182-T190 and release remain STOP/UNVERIFIED.",
  };
}

function parseDestinations() {
  const navText = read(NAV);
  const orchestratorText = read(ORCHESTRATOR);
  const pagesBlock = navText.match(/NAV_V2_PAGES[^=]*=\s*\[([^\]]+)\]\s*as const/);
  if (!pagesBlock) throw new Error("FIVE_DESTINATION_SOURCE NAV_V2_PAGES missing");
  const names = [...pagesBlock[1].matchAll(/["']([^"']+)["']/g)].map((match) => match[1]);
  if (names.length !== 5 || new Set(names).size !== 5) {
    throw new Error("FIVE_DESTINATION_SOURCE expected five unique destinations");
  }
  const pathBlock = navText.match(/const PAGE_TO_PATH:[^{]+\{([\s\S]*?)\n\};/);
  if (!pathBlock) throw new Error("FIVE_DESTINATION_SOURCE PAGE_TO_PATH missing");
  const paths = new Map(
    [...pathBlock[1].matchAll(/(\w+)\s*:\s*["']([^"']+)["']/g)].map((match) => [match[1], match[2]])
  );
  return names.map((destination) => {
    const label = destination[0].toUpperCase() + destination.slice(1);
    const loader = new RegExp(
      "const\\s+load" +
        label +
        "Page\\s*=\\s*[\\s\\S]{0,180}?import\\(\\s*[\"']([^\"']+)[\"']\\s*\\)"
    );
    const match = orchestratorText.match(loader);
    if (!match) throw new Error("FIVE_DESTINATION_SOURCE loader missing " + destination);
    const module = resolveModule(ORCHESTRATOR, match[1]);
    if (!module || !paths.get(destination)) {
      throw new Error("FIVE_DESTINATION_SOURCE unresolved " + destination);
    }
    return { destination, label, path: paths.get(destination), module };
  });
}

function sourceToken(file, token) {
  return { file, kind: "source-token", token };
}

function destinationRow(contract, main) {
  const text = read(contract.module);
  const navText = read(NAV);
  const orchestratorText = read(ORCHESTRATOR);
  const routeToken = contract.destination + ': "' + contract.path + '"';
  const routeLine = navText.split(/\r?\n/).findIndex((item) => item.includes(routeToken)) + 1;
  const loaderToken = "load" + contract.label + "Page";
  const loaderLine =
    orchestratorText.split(/\r?\n/).findIndex((item) => item.includes(loaderToken)) + 1;
  const route = {
    scope: "primary-five-destination",
    destinations: [contract.destination],
  };
  const chain = importPath(main.edges, ENTRY, contract.module);
  const unverified = (message, task) => ({
    sourceStatus: "UNVERIFIED",
    evidence: [],
    runtimeStatus: "UNVERIFIED_" + task,
    unresolved: message,
  });
  return {
    id: "t181-destination-" + contract.destination,
    ownerLocator: ORCHESTRATOR + "#NAV_V2_ROUTE_LOADERS#" + contract.destination,
    component: contract.label + "Page",
    source: {
      file: contract.module,
      sha256: digest(text),
      locators: [
        locator(NAV, navText, routeLine, "route-map", routeToken),
        locator(ORCHESTRATOR, orchestratorText, loaderLine, "lazy-route-loader", loaderToken),
      ],
      productionImportPath: chain.map((file) => ({
        file,
        relation: "runtime-import",
      })),
    },
    surfaceKinds: ["primary-destination"],
    route: {
      destination: contract.destination,
      destinations: [contract.destination],
      path: contract.path,
      scope: route.scope,
    },
    productionTrigger: {
      sourceStatus: "PASS",
      conditions: [
        'setActivePage("' + contract.destination + '")',
        "direct route " + contract.path,
      ],
      evidence: [locator(NAV, navText, routeLine, "route-map", routeToken)],
      unresolved: null,
    },
    ownerLayer: {
      name: "NavV2Orchestrator",
      sourceStatus: "PASS",
      importPath: chain,
    },
    openState: {
      sourceStatus: "PASS",
      evidence: [locator(NAV, navText, routeLine, "active-route-state", routeToken)],
      runtimeStatus: "UNVERIFIED",
    },
    exits: {
      scope: "Primary destination exits through history/popstate or another exact destination.",
      items: [
        {
          kind: "navigation-change",
          sourceStatus: "PASS",
          evidence: [sourceToken(NAV, "setActivePage")],
          runtimeStatus: "UNVERIFIED",
        },
        {
          kind: "history-popstate",
          sourceStatus: "PASS",
          evidence: [sourceToken(NAV, "popstate")],
          runtimeStatus: "UNVERIFIED",
        },
      ],
    },
    androidBack: {
      applicability: "APPLICABLE",
      sourceStatus: "PASS",
      evidence: [
        sourceToken(ORCHESTRATOR, "registerModalCloseCallback"),
        sourceToken(NAV, "handleBackButton"),
      ],
      runtimeStatus: "UNVERIFIED_T182",
    },
    predictiveBack: {
      applicability: "APPLICABLE_ANDROID",
      sourceStatus: "UNVERIFIED",
      evidence: [],
      runtimeStatus: "UNVERIFIED_T182",
    },
    escape: {
      applicability: "CONDITIONAL_NESTED_OVERLAY_ONLY",
      sourceStatus: "PASS",
      evidence: [sourceToken(ORCHESTRATOR, "escape:")],
      runtimeStatus: "UNVERIFIED_T182_T187",
    },
    outsideTap: {
      applicability: "N/A_PRIMARY_DESTINATION",
      sourceStatus: "N/A",
      evidence: [],
      runtimeStatus: "N/A",
    },
    focus: {
      entry: unverified("Destination entry focus requires route traversal.", "T187_T190"),
      trap: {
        sourceStatus: "N/A",
        evidence: [],
        runtimeStatus: "N/A",
        unresolved: "Primary destination is not itself modal.",
      },
      restore: unverified("Return focus requires route traversal.", "T187_T190"),
      runtimeStatus: "UNVERIFIED_T187_T188_T190",
    },
    scrollOwnership: unverified(
      "Nested route surfaces own scrolling; runtime ownership requires T185/T190.",
      "T185_T190"
    ),
    ime: {
      applicability: "CONDITIONAL",
      ...unverified("Nested inputs require lifecycle/device proof.", "T183_T184"),
    },
    safeAreaEdgeToEdge: {
      sourceStatus: "PASS",
      evidence: [sourceToken(ORCHESTRATOR, "v2-edge-to-edge-surface")],
      runtimeStatus: "UNVERIFIED_T184",
    },
    reflowDesktopWidth: {
      sourceStatus: "PASS",
      evidence: [sourceToken(ORCHESTRATOR, "data-nav-layout")],
      runtimeStatus: "UNVERIFIED_T185_T187_T190",
    },
    rtlBidi: {
      sourceStatus: "PASS",
      evidence: [sourceToken(ORCHESTRATOR, "ps-[72px]")],
      physicalDirectionEvidence: [],
      runtimeStatus: "UNVERIFIED_T186",
    },
    copyOwner: {
      allEightLocales: LOCALES,
      localeFiles: LOCALES.map((locale) => ({
        locale,
        file: "src/i18n/languages/" + locale + ".ts",
        sourceStatus: "PASS",
      })),
      sourceStatus: "PASS",
      evidence: [sourceToken(ORCHESTRATOR, "useLanguage")],
      runtimeStatus: "UNVERIFIED_T186",
    },
    reducedMotion: {
      sourceStatus: "PASS",
      evidence: [sourceToken(NAV, "morph()")],
      runtimeStatus: "UNVERIFIED_T187",
    },
    platformImpact: platformMatrix(route),
    platformDomainImpact: {
      platforms: PLATFORMS,
      domain: "five-destination-navigation-accessibility-reflow",
      affectedOwner: ORCHESTRATOR + "#NAV_V2_ROUTE_LOADERS#" + contract.destination,
    },
    evidenceStatus: {
      sourceReachability: "PASS",
      ownershipSchema: "PASS",
      runtime: "UNVERIFIED",
      humanAssistiveTechnology: "UNVERIFIED",
      culturalReview: "UNVERIFIED",
      visualCraft: "UNVERIFIED",
    },
    evidence: [
      { type: "local-file", locator: contract.module, sha256: digest(text) },
      {
        type: "local-command",
        command: "node tools/release/android21-ui-inventory.mjs --check",
        proves: "exact five-destination source contract and import reachability only",
      },
    ],
    verification: {
      run: ["exact NAV_V2_PAGES/PAGE_TO_PATH/loader parse", "static production import traversal"],
      skipped: [
        "complete five-destination runtime journey T190",
        "human TalkBack/cultural/visual review T188",
      ],
    },
    unresolvedRisk:
      "Static destination ownership does not prove nested runtime state, lifecycle, Back, focus, IME, layout or locale behavior.",
    verdict: "GO",
    verdictScope:
      "T181 static destination inventory only; T182-T190 and release remain STOP/UNVERIFIED.",
  };
}

function exclusionRow(path, rows, reason) {
  const text = read(path);
  const firstLine = line(rows[0].file, rows[0].position);
  return {
    id: "t181-exclusion-" + slug(path),
    source: {
      file: path,
      sha256: digest(text),
      locators: rows.map((row) =>
        locator(
          path,
          text,
          line(row.file, row.position),
          "excluded-candidate-marker",
          row.tag === "createPortal"
            ? "createPortal"
            : row.markerText.includes("<" + row.tag)
              ? "<" + row.tag
              : tokenAt(text, line(row.file, row.position))
        )
      ),
    },
    candidateKinds: [...new Set(rows.flatMap((row) => row.kinds))],
    reason,
    proof: [
      {
        type: "source-classification",
        locator: path + ":" + firstLine,
        fact:
          reason === "test-only"
            ? "Path is a test/spec/__tests__ source."
            : reason === "development-only"
              ? "Path is under __dev__."
              : "No static runtime import path exists from src/main.tsx.",
      },
      { type: "negative-import-path", entry: ENTRY, resolvedPath: [] },
    ],
    platformImpact: Object.fromEntries(
      PLATFORMS.map((platform) => [
        platform,
        {
          applicability: "EXCLUDED_FROM_PRODUCTION_INVENTORY",
          runtime: "NOT_CLAIMED",
        },
      ])
    ),
    platformDomainImpact: {
      platforms: PLATFORMS,
      domain: "excluded-source-reachability",
      affectedOwner: path,
    },
    verification: {
      run: ["source path classification", "static production import traversal"],
      skipped: ["tree-shaken bundle-symbol proof", "runtime reachability"],
    },
    unresolvedRisk:
      reason === "unreachable-production-source"
        ? "A new runtime import will promote this source to a required inventory row."
        : "Excluded test/development code is not production evidence.",
    verdict: "GO",
    verdictScope: "T181 exclusion classification only.",
  };
}

function referenceExclusion(reference) {
  const text = read(reference.path);
  const number = text.split(/\r?\n/).findIndex((item) => item.includes(reference.token)) + 1;
  return {
    id: "t181-exclusion-" + slug(reference.path) + "-selector-reference",
    source: {
      file: reference.path,
      sha256: digest(text),
      locators: [
        locator(reference.path, text, number, "non-owner-selector-reference", reference.token),
      ],
    },
    candidateKinds: ["non-owner-selector-reference"],
    reason: "selector-reference-only",
    proof: [
      {
        type: "ast-and-source-classification",
        locator: reference.path + ":" + number,
        fact: reference.fact,
      },
      {
        type: "production-import-path",
        entry: ENTRY,
        classification: "reachable observer, not a rendered surface owner",
      },
    ],
    platformImpact: Object.fromEntries(
      PLATFORMS.map((platform) => [
        platform,
        {
          applicability: "EXCLUDED_FROM_SURFACE_OWNER_ROWS",
          runtime: "NOT_CLAIMED",
        },
      ])
    ),
    platformDomainImpact: {
      platforms: PLATFORMS,
      domain: "excluded-non-owner-reference",
      affectedOwner: reference.path,
    },
    verification: {
      run: ["AST JSX candidate scan", "exact source token inspection"],
      skipped: ["runtime traversal"],
    },
    unresolvedRisk:
      "A future rendered overlay in this file will become a required owner row through deterministic candidate discovery.",
    verdict: "GO",
    verdictScope: "T181 non-owner reference classification only.",
  };
}

function findings(surfaces) {
  const definitions = [
    {
      id: "T182_ANDROID_BACK_SOURCE_GAPS",
      task: "T182",
      predicate: (row) =>
        row.androidBack.applicability === "APPLICABLE" &&
        row.androidBack.sourceStatus === "UNVERIFIED",
      failure:
        "Interactive takeovers without a detected Back owner require LIFO/predictive Back reproduction.",
    },
    {
      id: "T187_FOCUS_RESTORE_SOURCE_GAPS",
      task: "T187",
      predicate: (row) =>
        row.focus.restore.sourceStatus === "UNVERIFIED" && row.androidBack.applicability !== "N/A",
      failure:
        "Interactive takeovers without a detected focus restore target require keyboard/AT proof.",
    },
    {
      id: "T184_SAFE_AREA_SOURCE_GAPS",
      task: "T184",
      predicate: (row) =>
        row.safeAreaEdgeToEdge.sourceStatus === "UNVERIFIED" &&
        !row.surfaceKinds.every((kind) => ["table", "data-grid", "data-grid-owner"].includes(kind)),
      failure:
        "Overlay/takeover rows without local safe-area tokens require shell/device geometry proof.",
    },
    {
      id: "T186_RTL_BIDI_SOURCE_GAPS",
      task: "T186",
      predicate: (row) => row.rtlBidi.sourceStatus === "UNVERIFIED",
      failure: "Rows without local logical-direction/bidi tokens require eight-locale RTL proof.",
    },
    {
      id: "T187_REDUCED_MOTION_SOURCE_GAPS",
      task: "T187",
      predicate: (row) => row.reducedMotion.sourceStatus === "UNVERIFIED",
      failure: "Rows without local reduced-motion tokens require global/runtime motion proof.",
    },
  ];
  const sourceGapFindings = definitions
    .map((definition) => {
      const affectedRows = surfaces.filter(definition.predicate);
      return {
        id: definition.id,
        task: definition.task,
        failure: definition.failure,
        evidence: [
          ...affectedRows.map((row) => ({
            type: "local-file",
            inventoryRowId: row.id,
            locator: row.evidence[0].locator,
            sha256: row.evidence[0].sha256,
          })),
          {
            type: "local-command",
            command: "node tools/release/android21-ui-inventory.mjs --check",
            proves: "source-token gap classification only",
          },
        ],
        platformDomainImpact: {
          platforms: PLATFORMS,
          domain: "navigation-accessibility-reflow",
        },
        verification: {
          run: ["static source token inventory"],
          skipped: ["runtime/device/human validation"],
        },
        unresolvedRisk:
          "A source gap is a routing signal, not proof that runtime behavior is broken.",
        verdict: affectedRows.length ? "STOP" : "GO",
        verdictScope: affectedRows.length
          ? definition.task + " runtime closure; T181 may still reach local GO"
          : definition.task + " source-gap scan only",
        affectedRowCount: affectedRows.length,
      };
    })
    .filter((item) => item.affectedRowCount > 0);
  const iconPath = "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx";
  const iconText = read(iconPath);
  const iconToken = '<Check className="h-4 w-4" />';
  const iconLine = iconText.split(/\r?\n/).findIndex((item) => item.includes(iconToken)) + 1;
  const iconFinding = {
    id: "T187_SETTINGS_DECORATIVE_ICON_ARIA_HIDDEN",
    task: "T187",
    failure:
      "The selected settings choice Check icon is decorative inside a labelled button but lacks aria-hidden=true.",
    evidence: [
      {
        type: "local-file",
        locator: iconPath + ":" + iconLine,
        token: iconToken,
        sha256: digest(iconText),
      },
      {
        type: "local-command",
        command:
          "node scripts/a11y-icons-audit.cjs --file=src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx --json",
        result: "decorative=1, iconOnly=0",
      },
    ],
    platformDomainImpact: {
      platforms: PLATFORMS,
      domain: "settings-accessibility-semantics",
    },
    verification: {
      run: ["static icon semantics audit", "exact source locator inspection"],
      skipped: ["screen-reader runtime and named human review"],
    },
    unresolvedRisk:
      "Assistive technology may announce redundant icon semantics; T181 does not authorize a production UI fix.",
    verdict: "STOP",
    verdictScope:
      "T187 remediation and human/runtime closure; T181 static inventory may still reach local GO.",
    affectedRowCount: 1,
  };
  return [...sourceGapFindings, iconFinding];
}

export function discoverInventory() {
  const contracts = parseDestinations();
  const main = graph([ENTRY]);
  const destinationGraphs = contracts.map((contract) => ({
    destination: contract.destination,
    ...graph([contract.module]),
  }));
  const included = [];
  const exclusions = [];
  const candidateFiles = [];

  for (const absolute of walk(srcRoot)) {
    const path = rel(absolute);
    if (!/\.[jt]sx$/.test(path)) continue;
    const rows = candidates(path);
    if (!rows.length) continue;
    candidateFiles.push(path);
    if (TEST_PATH.test(path)) exclusions.push(exclusionRow(path, rows, "test-only"));
    else if (DEV_PATH.test(path)) {
      exclusions.push(exclusionRow(path, rows, "development-only"));
    } else if (!main.reachable.has(path)) {
      exclusions.push(exclusionRow(path, rows, "unreachable-production-source"));
    } else included.push(...rows);
  }
  exclusions.push(...NON_OWNER_REFERENCES.map(referenceExclusion));

  const surfaces = included
    .sort(
      (left, right) =>
        left.path.localeCompare(right.path) ||
        left.position - right.position ||
        left.primary.localeCompare(right.primary)
    )
    .map((candidate) => surfaceRow(candidate, main, destinationGraphs));
  const destinations = contracts.map((contract) => destinationRow(contract, main));
  exclusions.sort((left, right) => left.source.file.localeCompare(right.source.file));
  const kindCounts = {};
  for (const row of surfaces) {
    for (const kind of row.surfaceKinds) {
      kindCounts[kind] = (kindCounts[kind] ?? 0) + 1;
    }
  }
  const destinationCounts = Object.fromEntries(
    contracts.map((contract) => [
      contract.destination,
      surfaces.filter((row) => row.route.destinations.includes(contract.destination)).length,
    ])
  );
  const followUpFindings = findings(surfaces);

  return {
    schemaVersion: 1,
    task: {
      id: "T181",
      feature: "002-android-2-1-connected-release",
      title: "Current overlay, table and five-destination ownership inventory",
      sourceBase: "13ca51a80d23220574deba762851fe5a32372e46",
      generatedOn: "2026-08-12",
      taskStatus: "LOCAL_GO",
      taskStatusScope:
        "T181 source-owned inventory and validator only; runtime and release are not approved.",
      releaseStatus: "STOP",
    },
    scope: {
      productionEntry: ENTRY,
      sourceTraversal:
        "Static runtime imports, re-exports and literal dynamic imports from src/main.tsx; test and __dev__ paths are excluded with proof.",
      included:
        "Every production-reachable detected JSX dialog, alertdialog, sheet, drawer, popover, menu, tooltip, fixed overlay/takeover, portal-only owner, semantic table/grid and named two-dimensional data owner.",
      candidateRules: {
        overlays: [
          "role=dialog or role=alertdialog",
          "aria-modal=true",
          "shared Content overlay primitives",
          "fixed JSX surfaces",
          "portal-only owners",
          "named Modal/Dialog/Sheet/Overlay/Takeover/Palette/Viewer/Picker/Panel/Layer owners",
        ],
        tablesAndGrids: [
          "table or role=table/grid/treegrid",
          "seven-column or gridAutoColumns data structures",
          "named Calendar/Heatmap/Timeline/Schedule/WeeklyReport/Leaderboard/Stats/Chart/Grid/Table owners",
          "named data owners with horizontal data scroll",
        ],
      },
      privacy:
        "Route/component identifiers, hashes and bounded source tokens only; no user content, credentials, screenshots or runtime logs.",
      canonicalOrb:
        "UNCHANGED and outside T181 visual scope; only ownership reachability may be listed.",
    },
    exactFiveDestinationContract: {
      source: NAV,
      owner: ORCHESTRATOR,
      destinations: contracts.map((contract) => contract.destination),
      count: contracts.length,
    },
    summary: {
      productionReachableModules: main.reachable.size,
      candidateFilesScanned: candidateFiles.length,
      surfaceRows: surfaces.length,
      destinationRows: destinations.length,
      exclusionRows: exclusions.length,
      exclusionTestOnly: exclusions.filter((row) => row.reason === "test-only").length,
      exclusionDevelopmentOnly: exclusions.filter((row) => row.reason === "development-only")
        .length,
      exclusionUnreachableProductionSource: exclusions.filter(
        (row) => row.reason === "unreachable-production-source"
      ).length,
      exclusionSelectorReferenceOnly: exclusions.filter(
        (row) => row.reason === "selector-reference-only"
      ).length,
      kindCounts,
      destinationSurfaceCounts: destinationCounts,
      sourceReachabilityPassRows: surfaces.length + destinations.length,
      runtimePassRows: 0,
      humanPassRows: 0,
      followUpFindingCount: followUpFindings.length,
    },
    platformMatrix: Object.fromEntries(
      PLATFORMS.map((platform) => [
        platform,
        {
          sourceApplicability: "PASS",
          runtime: "UNVERIFIED",
          release: "STOP",
          reason:
            "Shared source path is inventoried, but platform runtime was not executed by T181.",
        },
      ])
    ),
    humanRuntimeUnverified: [
      "authenticated/private route reachability",
      "installed PWA behavior",
      "Android gesture/three-button/predictive Back, IME, process death and adaptive windows",
      "iOS/WKWebView behavior",
      "Desktop/Tauri behavior",
      "TalkBack and other named human assistive-technology review",
      "cultural/linguistic acceptance for all eight locales",
      "visual/artistic/craft acceptance",
    ],
    destinations,
    surfaces,
    exclusions,
    followUpFindings,
    evidenceLedger: {
      findings:
        "All discovered owner rows and negative-reachability exclusions are serialized above.",
      fileSourceEvidence: [ENTRY, NAV, ORCHESTRATOR],
      platformDomainImpact:
        "Web/PWA/Android/iOS/Desktop source applicability is explicit per row; runtime is UNVERIFIED.",
      verificationRun: [
        "deterministic static runtime import graph",
        "candidate discovery",
        "source SHA-256 and locator binding",
        "coverage, duplicate, stale-owner and schema validation",
      ],
      verificationSkipped: [
        "browser/device traversal where source cannot prove behavior",
        "human/cultural/visual acceptance",
      ],
      remainingRisk:
        "T182-T190 must execute runtime, accessibility, locale, lifecycle, adaptive-window and human matrices.",
      verdict: "GO",
      verdictScope: "T181 local static inventory only; Android 2.1 release remains STOP.",
    },
  };
}

const REQUIRED = [
  "id",
  "ownerLocator",
  "component",
  "source.file",
  "source.sha256",
  "source.locators",
  "route.destination",
  "route.destinations",
  "route.scope",
  "productionTrigger",
  "ownerLayer",
  "openState",
  "exits",
  "androidBack",
  "predictiveBack",
  "escape",
  "outsideTap",
  "focus.entry",
  "focus.trap",
  "focus.restore",
  "scrollOwnership",
  "ime",
  "safeAreaEdgeToEdge",
  "reflowDesktopWidth",
  "rtlBidi",
  "copyOwner",
  "reducedMotion",
  "platformImpact",
  "platformDomainImpact",
  "evidenceStatus",
  "evidence",
  "verification",
  "unresolvedRisk",
  "verdict",
];

function hasPath(value, path) {
  let current = value;
  for (const part of path.split(".")) {
    if (current === null || typeof current !== "object" || !(part in current)) {
      return false;
    }
    current = current[part];
  }
  return current !== undefined;
}

function validateSource(row, errors) {
  const path = row?.source?.file;
  if (!path || !existsSync(abs(path))) {
    errors.push("STALE_SOURCE_FILE " + (path || row?.id || "unknown"));
    return;
  }
  const text = read(path);
  if (row.source.sha256 !== digest(text)) {
    errors.push("STALE_SOURCE_HASH " + path);
  }
  for (const item of row.source.locators ?? []) {
    const locatorFile = item.file || path;
    if (!existsSync(abs(locatorFile))) {
      errors.push("STALE_SOURCE_LOCATOR " + locatorFile);
      continue;
    }
    if (!item.token || !read(locatorFile).includes(item.token)) {
      errors.push(
        "STALE_SOURCE_LOCATOR " +
          locatorFile +
          ":" +
          (item.line ?? "unknown") +
          " token=" +
          (item.token || "<empty>")
      );
    }
  }
}

function humanPass(row) {
  return (
    row?.evidenceStatus?.humanAssistiveTechnology === "PASS" ||
    row?.evidenceStatus?.culturalReview === "PASS" ||
    row?.evidenceStatus?.visualCraft === "PASS" ||
    row?.verification?.humanAssistiveTechnology === "PASS"
  );
}

function validate(expected, actual) {
  const errors = [];
  if (actual?.schemaVersion !== 1) errors.push("MISSING_FIELD schemaVersion=1");
  for (const key of ["surfaces", "destinations", "exclusions"]) {
    if (!Array.isArray(actual?.[key])) errors.push("MISSING_FIELD " + key);
  }
  if (errors.length) return errors;

  const expectedDestinations = expected.destinations.map((row) => row.route.destination);
  const actualDestinations = actual.destinations.map((row) => row?.route?.destination);
  if (
    JSON.stringify(expectedDestinations) !== JSON.stringify(actualDestinations) ||
    JSON.stringify(expectedDestinations) !==
      JSON.stringify(actual.exactFiveDestinationContract?.destinations)
  ) {
    errors.push(
      "FIVE_DESTINATION_CONTRACT expected=" +
        expectedDestinations.join(",") +
        " actual=" +
        actualDestinations.join(",")
    );
  }

  const ids = new Set();
  const owners = new Set();
  for (const row of [...actual.destinations, ...actual.surfaces]) {
    if (ids.has(row.id)) errors.push("DUPLICATE_ID " + row.id);
    ids.add(row.id);
    if (owners.has(row.ownerLocator)) {
      errors.push("DUPLICATE_OWNER_LOCATOR " + row.ownerLocator);
    }
    owners.add(row.ownerLocator);
    for (const path of REQUIRED) {
      if (!hasPath(row, path)) {
        errors.push("MISSING_FIELD " + (row.id || "unknown") + " " + path);
      }
    }
    for (const platform of PLATFORMS) {
      if (!row?.platformImpact?.[platform]) {
        errors.push("PLATFORM_MATRIX " + (row.id || "unknown") + " missing " + platform);
      }
    }
    if (humanPass(row)) {
      errors.push("UNSUPPORTED_HUMAN_PASS " + (row.id || "unknown"));
    }
    validateSource(row, errors);
  }

  const expectedOwners = new Set(expected.surfaces.map((row) => row.ownerLocator));
  const actualOwners = new Set(actual.surfaces.map((row) => row.ownerLocator));
  for (const owner of expectedOwners) {
    if (!actualOwners.has(owner)) errors.push("MISSING_DISCOVERED_OWNER " + owner);
  }
  for (const owner of actualOwners) {
    if (!expectedOwners.has(owner)) errors.push("STALE_DISCOVERED_OWNER " + owner);
  }

  const expectedExclusions = new Set(expected.exclusions.map((row) => row.source.file));
  const actualExclusions = new Set(actual.exclusions.map((row) => row?.source?.file));
  for (const path of expectedExclusions) {
    if (!actualExclusions.has(path)) errors.push("MISSING_EXCLUSION " + path);
  }
  for (const row of actual.exclusions) {
    if (!Array.isArray(row.proof) || !row.proof.length) {
      errors.push("EXCLUSION_WITHOUT_PROOF " + (row?.source?.file || row?.id || "unknown"));
    }
    validateSource(row, errors);
  }

  for (const [key, value] of Object.entries(expected.summary)) {
    if (JSON.stringify(actual.summary?.[key]) !== JSON.stringify(value)) {
      errors.push(
        "SUMMARY_DRIFT " +
          key +
          " actual=" +
          JSON.stringify(actual.summary?.[key]) +
          " expected=" +
          JSON.stringify(value)
      );
    }
  }
  for (const platform of PLATFORMS) {
    if (!actual?.platformMatrix?.[platform]) {
      errors.push("PLATFORM_MATRIX top-level missing " + platform);
    }
  }
  if (actual.summary?.runtimePassRows !== 0 || actual.summary?.humanPassRows !== 0) {
    errors.push("UNSUPPORTED_HUMAN_PASS summary");
  }
  if (!errors.length && JSON.stringify(actual) !== JSON.stringify(expected)) {
    errors.push("INVENTORY_DRIFT deterministic generated inventory differs");
  }
  return errors;
}

function summary(inventory) {
  return (
    inventory.summary.surfaceRows +
    " surfaces; " +
    inventory.summary.destinationRows +
    " destinations; " +
    inventory.summary.exclusionRows +
    " exclusions; " +
    inventory.summary.productionReachableModules +
    " reachable modules"
  );
}

const mode = process.argv.includes("--write")
  ? "write"
  : process.argv.includes("--print")
    ? "print"
    : "check";
let expected;
try {
  expected = discoverInventory();
} catch (error) {
  console.error(
    "FAIL android21-ui-inventory SOURCE_DISCOVERY " +
      (error instanceof Error ? error.message : String(error))
  );
  process.exit(2);
}

if (mode === "write") {
  mkdirSync(dirname(canonicalPath), { recursive: true });
  writeFileSync(canonicalPath, JSON.stringify(expected, null, 2) + "\n", "utf8");
  console.log("WROTE android21-ui-inventory " + rel(canonicalPath) + "; " + summary(expected));
} else if (mode === "print") {
  process.stdout.write(JSON.stringify(expected, null, 2) + "\n");
} else {
  let actual;
  try {
    actual = process.argv.includes("--stdin")
      ? JSON.parse(readFileSync(0, "utf8"))
      : JSON.parse(readFileSync(canonicalPath, "utf8"));
  } catch (error) {
    console.error(
      "FAIL android21-ui-inventory INVENTORY_READ " +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
  const errors = validate(expected, actual);
  if (errors.length) {
    for (const error of errors) console.error("FAIL android21-ui-inventory " + error);
    process.exit(1);
  }
  console.log(
    "PASS android21-ui-inventory " +
      summary(actual) +
      "; runtime=UNVERIFIED; human=UNVERIFIED; release=STOP"
  );
}
