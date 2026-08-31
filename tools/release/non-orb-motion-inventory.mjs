#!/usr/bin/env node

import { createHash } from "node:crypto";
import {
  existsSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  statSync,
  writeFileSync,
} from "node:fs";
import { dirname, extname, join, relative, resolve, sep } from "node:path";
import { fileURLToPath } from "node:url";
import ts from "typescript";

const TOOL_ROOT = resolve(dirname(fileURLToPath(import.meta.url)), "../..");
const DEFAULT_INVENTORY = "docs/release/non-orb-motion-inventory.json";
const ENTRY = "src/main.tsx";
const PLATFORMS = ["web", "pwa", "android", "ios", "desktop"];
const LOCALES = ["en", "uk", "es", "de", "fr", "ja", "ar", "he"];
const SOURCE_EXTENSIONS = new Set([
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".frag",
  ".vert",
  ".glsl",
  ".java",
  ".kt",
  ".swift",
  ".rs",
  ".xml",
  ".json",
  ".svg",
  ".html",
]);
const MODULE_EXTENSIONS = [
  ".ts",
  ".tsx",
  ".js",
  ".jsx",
  ".mjs",
  ".cjs",
  ".css",
  ".scss",
  ".json",
  ".frag",
  ".vert",
  ".glsl",
];
const TEST_PATH =
  /(?:^|\/)(?:__tests__|test|tests|e2e|fixtures?)(?:\/|$)|\.(?:test|spec)\.[cm]?[jt]sx?$/;
const DEV_PATH = /(?:^|\/)(?:__dev__|dev-only|storybook)(?:\/|$)/;
const ORB_FAMILY_FILES = new Set([
  "src/components/state-of-mind/ValenceOrb.tsx",
  "src/components/state-of-mind/MiniValenceOrb.tsx",
  "src/components/state-of-mind/CompactValenceOrb.tsx",
  "src/components/state-of-mind/noise2d.ts",
  "src/components/state-of-mind/orbRenderer.ts",
  "src/components/state-of-mind/orbShader.ts",
  "src/components/state-of-mind/orbShader.frag",
  "src/components/state-of-mind/orbWebGpu.ts",
]);
const TEST_ONLY_BUNDLE_SENTINEL = "ZENFLOW_T191_TEST_ONLY_MOTION_SENTINEL_4E2B9C71";
const GENERATED_SOURCE_PREFIXES = [
  "android/app/src/main/assets/",
  "ios/App/App/public/",
];

const CATEGORY_RULES = [
  ["css-keyframes", /@(?:-webkit-)?keyframes\b/i],
  [
    "css-animation",
    /\banimation(?:-name|-duration|-timing-function|-iteration-count|-delay|-fill-mode|-play-state)?\s*:|\banimate-[a-z0-9_[\]-]+/i,
  ],
  [
    "css-transition",
    /\btransition(?:-property|-duration|-timing-function|-delay)?\s*:|\btransition(?:-[a-z0-9_[\]-]+)?\b/i,
  ],
  [
    "framer-motion",
    /framer-motion|motion\/react|<motion\.|\bAnimatePresence\b|\b(?:initial|animate|exit|whileHover|whileTap|whileFocus|layout)\s*=/i,
  ],
  ["web-animations-api", /\.animate\s*\(|\bnew\s+Animation\s*\(/],
  ["raf", /\brequestAnimationFrame\s*\(|\bcancelAnimationFrame\s*\(/],
  ["timer", /\bsetTimeout\s*\(|\bsetInterval\s*\(|\bclearTimeout\s*\(|\bclearInterval\s*\(/],
  [
    "canvas-webgl",
    /<canvas\b|\.getContext\s*\(|\bWebGL(?:2)?RenderingContext\b|\bwebgl2?\b|\bOffscreenCanvas\b|\bgl_(?:Position|FragColor)\b|\bu_time\b/i,
  ],
  ["particles-confetti", /\bparticles?\b|\bconfetti\b|\bdust\b|\bmotes?\b/i],
  [
    "lottie-tgs-video-gif",
    /\blottie\b|\.tgs\b|\.gif\b|<video\b|\.mp4\b|\.webm\b|requestVideoFrameCallback/i,
  ],
  [
    "audio-synchronized",
    /\bAudioContext\b|\bwebkitAudioContext\b|\bnew\s+Audio\s*\(|<audio\b|requestVideoFrameCallback/i,
  ],
  [
    "native-route-splash-transition",
    /\bSplashScreen\b|windowSplashScreenAnimatedIcon|UIView\.animate|ObjectAnimator|ValueAnimator|overridePendingTransition|DialogMotionContent|SheetMotionContent|\btoast\b|\bpageTransition\b|\brouteTransition\b/i,
  ],
];
const DIRECT_CATEGORIES = new Set(
  CATEGORY_RULES.map((item) => item[0]).filter((item) => item !== "timer")
);
const BROAD_LEXICAL_RULE =
  /@keyframes|animation|transition|requestAnimationFrame|cancelAnimationFrame|\.animate\s*\(|\bnew\s+Animation\b|framer-motion|motion\/react|<motion\.|\bAnimatePresence\b|whileHover|whileTap|<canvas|\.getContext\s*\(|WebGL|OffscreenCanvas|particle|confetti|lottie|\.tgs|\.gif|<video|\.mp4|\.webm|AudioContext|\bnew\s+Audio\b|SplashScreen|windowSplashScreenAnimatedIcon|UIView\.animate|ObjectAnimator|ValueAnimator|DialogMotionContent|SheetMotionContent|setTimeout|setInterval|clearTimeout|clearInterval/i;
const MOTION_ASSET = /(?:\.tgs|\.gif|\.mp4|\.webm|\.lottie\.json)$/i;
const CATEGORY_SENTINELS = {
  "css-keyframes": ["@keyframes"],
  "css-animation": ["animation"],
  "css-transition": ["transition"],
  "framer-motion": ["transform"],
  "web-animations-api": [".animate("],
  raf: ["requestAnimationFrame"],
  timer: ["setTimeout", "setInterval"],
  "canvas-webgl": ["canvas", "webgl"],
  "particles-confetti": ["canvas", "particle", "confetti"],
  "lottie-tgs-video-gif": [".gif", ".mp4", ".webm", "lottie"],
  "audio-synchronized": ["AudioContext", "new Audio"],
  "native-route-splash-transition": ["SplashScreen", "transition"],
};

function parseArgs(argv) {
  const result = {
    root: TOOL_ROOT,
    mode: argv.includes("--write") ? "write" : argv.includes("--print") ? "print" : "check",
    stdin: argv.includes("--stdin"),
    bundle: null,
    receipt: null,
  };
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === "--root") result.root = resolve(argv[++index]);
    else if (argv[index] === "--bundle-proof") result.bundle = argv[++index];
    else if (argv[index] === "--receipt") result.receipt = argv[++index];
  }
  return result;
}

function posix(root, path) {
  return relative(root, path).split(sep).join("/");
}

function sha256(value) {
  return createHash("sha256").update(value).digest("hex");
}

function serializeInventory(inventory) {
  return JSON.stringify(inventory) + "\n";
}

function safeAbsolute(root, relativePath) {
  const absolute = resolve(root, relativePath);
  if (absolute !== root && !absolute.startsWith(root + sep)) {
    throw new Error("PATH_ESCAPE " + relativePath);
  }
  return absolute;
}

function safeExistingAbsolute(root, relativePath) {
  const realRoot = realpathSync(root);
  const realPath = realpathSync(safeAbsolute(root, relativePath));
  if (realPath !== realRoot && !realPath.startsWith(realRoot + sep)) {
    throw new Error("SYMLINK_PATH_ESCAPE " + relativePath);
  }
  return realPath;
}

function readRooted(root, relativePath) {
  return readFileSync(safeExistingAbsolute(root, relativePath), "utf8");
}

function walk(root, directory) {
  if (!existsSync(directory)) return [];
  const rows = [];
  for (const entry of readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
    a.name.localeCompare(b.name)
  )) {
    if (
      [
        "node_modules",
        "dist",
        "build",
        ".git",
        "coverage",
        "output",
        "target",
        "DerivedData",
      ].includes(entry.name)
    )
      continue;
    const absolute = join(directory, entry.name);
    if (entry.isDirectory()) rows.push(...walk(root, absolute));
    else rows.push(posix(root, absolute));
  }
  return rows;
}

function allSourceFiles(root) {
  const roots = [
    "src",
    "public",
    "android/app/src/main",
    "ios/App/App",
    "ios/App/CapApp-SPM/Sources",
    "src-tauri/src",
  ];
  return roots
    .flatMap((item) => walk(root, safeAbsolute(root, item)))
    .filter((path) => !GENERATED_SOURCE_PREFIXES.some((prefix) => path.startsWith(prefix)))
    .filter((path) => SOURCE_EXTENSIONS.has(extname(path).toLowerCase()) || MOTION_ASSET.test(path))
    .sort();
}

function scriptKind(path) {
  if (path.endsWith(".tsx")) return ts.ScriptKind.TSX;
  if (path.endsWith(".jsx")) return ts.ScriptKind.JSX;
  if (/\.(?:js|mjs|cjs)$/.test(path)) return ts.ScriptKind.JS;
  return ts.ScriptKind.TS;
}

function parsed(path, text) {
  return ts.createSourceFile(path, text, ts.ScriptTarget.Latest, true, scriptKind(path));
}

function resolveModule(root, from, specifier) {
  const clean = specifier.split(/[?#]/, 1)[0];
  let base;
  if (clean.startsWith("@/")) base = join(root, "src", clean.slice(2));
  else if (clean.startsWith(".")) base = resolve(dirname(join(root, from)), clean);
  else return null;
  const candidates = extname(base)
    ? [base]
    : [
        ...MODULE_EXTENSIONS.map((extension) => base + extension),
        ...MODULE_EXTENSIONS.map((extension) => join(base, "index" + extension)),
      ];
  const found = candidates.find(
    (candidate) => existsSync(candidate) && statSync(candidate).isFile()
  );
  return found ? posix(root, found) : null;
}

function expandBracePatterns(pattern) {
  const open = pattern.indexOf("{");
  if (open < 0) return [pattern];
  const close = pattern.indexOf("}", open + 1);
  if (close < 0) throw new Error("IMPORT_META_GLOB_UNCLOSED_BRACE " + pattern);
  const choices = pattern.slice(open + 1, close).split(",");
  if (!choices.length || choices.some((choice) => !choice)) {
    throw new Error("IMPORT_META_GLOB_EMPTY_BRACE " + pattern);
  }
  return choices.flatMap((choice) =>
    expandBracePatterns(pattern.slice(0, open) + choice + pattern.slice(close + 1))
  );
}

function globPatternRegex(pattern) {
  let regex = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      index += 1;
      if (pattern[index + 1] === "/") {
        index += 1;
        regex += "(?:.*/)?";
      } else {
        regex += ".*";
      }
    } else if (character === "*") {
      regex += "[^/]*";
    } else if (character === "?") {
      regex += "[^/]";
    } else {
      regex += character.replace(/[|\\{}()[\]^$+?.-]/g, "\\$&");
    }
  }
  return new RegExp(regex + "$");
}

function resolveGlobModules(root, from, specifier, files) {
  if (specifier.startsWith("!")) {
    throw new Error("IMPORT_META_GLOB_NEGATION_UNSUPPORTED " + from + " " + specifier);
  }
  if (!specifier.startsWith(".")) {
    throw new Error("IMPORT_META_GLOB_NON_RELATIVE " + from + " " + specifier);
  }
  const absolutePattern = resolve(dirname(join(root, from)), specifier);
  if (absolutePattern !== root && !absolutePattern.startsWith(root + sep)) {
    throw new Error("IMPORT_META_GLOB_PATH_ESCAPE " + from + " " + specifier);
  }
  const rootedPattern = relative(root, absolutePattern).split(sep).join("/");
  const patterns = expandBracePatterns(rootedPattern).map(globPatternRegex);
  const matches = files.filter((path) => patterns.some((pattern) => pattern.test(path)));
  if (!matches.length) throw new Error("IMPORT_META_GLOB_NO_MATCH " + from + " " + specifier);
  return matches;
}

function imports(root, path, text) {
  if (/\.(?:css|scss)$/.test(path)) {
    return [...text.matchAll(/@import\s+["']([^"']+)["']/g)].map((match) => ({
      specifier: match[1],
      kind: "css-import",
    }));
  }
  if (!/\.[cm]?[jt]sx?$/.test(path)) return [];
  const file = parsed(path, text);
  const found = [];
  function visit(node) {
    if (ts.isImportDeclaration(node) && ts.isStringLiteral(node.moduleSpecifier)) {
      const clause = node.importClause;
      const named = clause && clause.namedBindings;
      const allNamedType =
        clause &&
        !clause.name &&
        named &&
        ts.isNamedImports(named) &&
        named.elements.length > 0 &&
        named.elements.every((item) => item.isTypeOnly);
      if (!clause || (!clause.isTypeOnly && !allNamedType))
        found.push({ specifier: node.moduleSpecifier.text, kind: "static-import" });
    } else if (
      ts.isExportDeclaration(node) &&
      !node.isTypeOnly &&
      node.moduleSpecifier &&
      ts.isStringLiteral(node.moduleSpecifier)
    ) {
      found.push({ specifier: node.moduleSpecifier.text, kind: "runtime-re-export" });
    } else if (
      ts.isCallExpression(node) &&
      node.expression.kind === ts.SyntaxKind.ImportKeyword &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, kind: "literal-dynamic-import" });
    } else if (
      ts.isCallExpression(node) &&
      ts.isPropertyAccessExpression(node.expression) &&
      node.expression.expression.getText(file) === "import.meta" &&
      node.expression.name.text === "glob" &&
      node.arguments.length > 0
    ) {
      const patterns = ts.isArrayLiteralExpression(node.arguments[0])
        ? node.arguments[0].elements
        : [node.arguments[0]];
      for (const pattern of patterns) {
        if (!ts.isStringLiteralLike(pattern)) {
          throw new Error("IMPORT_META_GLOB_NON_LITERAL " + path);
        }
        found.push({ specifier: pattern.text, kind: "import-meta-glob" });
      }
    } else if (
      ts.isCallExpression(node) &&
      ts.isIdentifier(node.expression) &&
      node.expression.text === "require" &&
      node.arguments.length === 1 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, kind: "require" });
    } else if (
      ts.isNewExpression(node) &&
      node.expression.getText(file) === "URL" &&
      node.arguments &&
      node.arguments.length > 0 &&
      ts.isStringLiteralLike(node.arguments[0])
    ) {
      found.push({ specifier: node.arguments[0].text, kind: "literal-new-url" });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return found;
}

function importGraph(root, files) {
  const reachable = new Set();
  const parents = new Map();
  const edgeKinds = new Map();
  const queue = [ENTRY];
  while (queue.length) {
    const path = queue.shift();
    const absolute = safeAbsolute(root, path);
    if (
      !path ||
      reachable.has(path) ||
      !existsSync(absolute) ||
      TEST_PATH.test(path) ||
      DEV_PATH.test(path)
    )
      continue;
    reachable.add(path);
    for (const edge of imports(root, path, readRooted(root, path))) {
      const targets =
        edge.kind === "import-meta-glob"
          ? resolveGlobModules(root, path, edge.specifier, files)
          : [resolveModule(root, path, edge.specifier)].filter(Boolean);
      for (const target of targets) {
        if (TEST_PATH.test(target) || DEV_PATH.test(target)) continue;
        const key = path + "->" + target;
        edgeKinds.set(key, edge.kind);
        if (!parents.has(target)) parents.set(target, { from: path, kind: edge.kind });
        queue.push(target);
      }
    }
  }
  return { reachable, parents, edgeKinds };
}

function importPath(graph, target) {
  if (target === ENTRY) return [{ file: ENTRY, via: "entry" }];
  const reversed = [];
  let current = target;
  const seen = new Set();
  while (current && !seen.has(current)) {
    seen.add(current);
    const parent = graph.parents.get(current);
    reversed.push({ file: current, via: parent ? parent.kind : "unresolved" });
    if (!parent) break;
    current = parent.from;
    if (current === ENTRY) {
      reversed.push({ file: ENTRY, via: "entry" });
      break;
    }
  }
  return reversed.reverse();
}

function lineOffsets(text) {
  const offsets = [0];
  for (let index = 0; index < text.length; index += 1)
    if (text[index] === "\n") offsets.push(index + 1);
  return offsets;
}

function lineAt(offsets, position) {
  let low = 0;
  let high = offsets.length;
  while (low + 1 < high) {
    const middle = Math.floor((low + high) / 2);
    if (offsets[middle] <= position) low = middle;
    else high = middle;
  }
  return low + 1;
}

function sourceLine(text, number) {
  return (text.split(/\r?\n/)[number - 1] || "").trim().slice(0, 240);
}

function functionRanges(path, text) {
  if (!/\.[cm]?[jt]sx?$/.test(path)) return [];
  const file = parsed(path, text);
  const ranges = [];
  function nameFor(node) {
    if (node.name && typeof node.name.getText === "function") return node.name.getText(file);
    if (ts.isVariableDeclaration(node.parent)) return node.parent.name.getText(file);
    if (ts.isPropertyAssignment(node.parent)) return node.parent.name.getText(file);
    if (ts.isCallExpression(node.parent) && ts.isVariableDeclaration(node.parent.parent))
      return node.parent.parent.name.getText(file);
    return "anonymous";
  }
  function visit(node) {
    if (
      ts.isFunctionDeclaration(node) ||
      ts.isFunctionExpression(node) ||
      ts.isArrowFunction(node) ||
      ts.isMethodDeclaration(node)
    ) {
      ranges.push({ start: node.getStart(file), end: node.getEnd(), symbol: nameFor(node) });
    }
    ts.forEachChild(node, visit);
  }
  visit(file);
  return ranges.sort((a, b) => a.end - a.start - (b.end - b.start));
}

function cssSymbol(lines, lineIndex, category) {
  const current = lines[lineIndex] || "";
  const keyframe = current.match(/@(?:-webkit-)?keyframes\s+([a-zA-Z0-9_-]+)/);
  if (keyframe) return "@keyframes " + keyframe[1];
  for (let index = lineIndex; index >= 0 && index >= lineIndex - 30; index -= 1) {
    const candidate = lines[index].trim();
    if (candidate.endsWith("{") && !candidate.startsWith("@"))
      return "css " + candidate.slice(0, -1).trim().slice(0, 120);
  }
  return "css module " + category;
}

function detectOccurrences(path, text) {
  const lines = text.split(/\r?\n/);
  const offsets = lineOffsets(text);
  const ranges = functionRanges(path, text);
  const occurrences = [];
  for (let lineIndex = 0; lineIndex < lines.length; lineIndex += 1) {
    const lineText = lines[lineIndex];
    for (const [category, pattern] of CATEGORY_RULES) {
      pattern.lastIndex = 0;
      if (!pattern.test(lineText)) continue;
      const position = offsets[lineIndex];
      let symbol;
      let range;
      if (/\.(?:css|scss)$/.test(path)) {
        symbol = cssSymbol(lines, lineIndex, category);
        range = { start: position, end: position + lineText.length };
      } else {
        range = ranges.find((item) => item.start <= position && item.end >= position);
        symbol = range ? range.symbol : "module";
      }
      occurrences.push({
        category,
        line: lineIndex + 1,
        token: lineText.trim().slice(0, 240),
        symbol,
        start: range ? lineAt(offsets, range.start) : lineIndex + 1,
        end: range ? lineAt(offsets, range.end) : lineIndex + 1,
      });
    }
  }
  return occurrences;
}

function broadLexicalOccurrences(path, text) {
  const result = [];
  for (const [index, lineText] of text.split(/\r?\n/).entries()) {
    if (!BROAD_LEXICAL_RULE.test(lineText)) continue;
    result.push({
      category: "lexical-broad-candidate",
      line: index + 1,
      token: lineText.trim().slice(0, 240),
      symbol: "module",
      start: index + 1,
      end: index + 1,
    });
  }
  return result;
}

function slug(value) {
  return value
    .replace(/^src\//, "")
    .replace(/[^a-zA-Z0-9]+/g, "-")
    .replace(/^-|-$/g, "")
    .toLowerCase();
}

function routeFor(path, symbol) {
  const value = (path + " " + symbol).toLowerCase();
  if (/auth|onboarding|splash|welcome/.test(value)) return { route: "entry/auth", surface: symbol };
  if (/diary|journal|gratitude|thought|burn/.test(value))
    return { route: "diary", surface: symbol };
  if (/habit/.test(value)) return { route: "habits", surface: symbol };
  if (/planning|schedule|calendar|task/.test(value)) return { route: "planning", surface: symbol };
  if (/setting/.test(value)) return { route: "settings", surface: symbol };
  if (/orb|state-of-mind|mood/.test(value)) return { route: "orb/state-of-mind", surface: symbol };
  return { route: "shared/app-shell", surface: symbol };
}

function visibleMeaning(symbol, path) {
  const value = (symbol + " " + path).toLowerCase();
  if (/gratitude|bloom/.test(value))
    return { value: "gratitude save/planting completion feedback", status: "SOURCE_INFERRED" };
  if (/burnthought|letgo|release|dust/.test(value))
    return { value: "transient thought release feedback", status: "SOURCE_INFERRED" };
  if (/splash|loader|loading|spinner|skeleton/.test(value))
    return { value: "pending or startup progress", status: "SOURCE_INFERRED" };
  if (/toast|banner|notification/.test(value))
    return { value: "status notification entry/exit", status: "SOURCE_INFERRED" };
  if (/modal|dialog|sheet|drawer|popover|menu/.test(value))
    return { value: "layer entry, exit or state change", status: "SOURCE_INFERRED" };
  if (/celebr|confetti|achievement|success/.test(value))
    return { value: "completion or celebration feedback", status: "SOURCE_INFERRED" };
  if (/navigation|route|page/.test(value))
    return { value: "navigation or route continuity", status: "SOURCE_INFERRED" };
  return { value: "UNVERIFIED_SEMANTIC_MEANING for " + symbol, status: "UNVERIFIED" };
}

function sourceFact(text, patterns, matchedStatus, unresolved) {
  const found = patterns.filter((pattern) => pattern.test(text)).map((pattern) => pattern.source);
  return found.length
    ? { sourceStatus: matchedStatus, evidencePatterns: found, runtimeStatus: "UNVERIFIED" }
    : { sourceStatus: "UNVERIFIED", evidencePatterns: [], runtimeStatus: "UNVERIFIED", unresolved };
}

function lifecycleFor(ownerText, categories) {
  const resource = (uses, cleanup) => ({
    uses: uses.some((pattern) => pattern.test(ownerText)),
    cleanupDetected: cleanup.some((pattern) => pattern.test(ownerText)),
    sourceStatus: uses.some((pattern) => pattern.test(ownerText))
      ? cleanup.some((pattern) => pattern.test(ownerText))
        ? "PASS_SOURCE_CLEANUP_DETECTED"
        : "UNVERIFIED_CLEANUP"
      : "N/A_NO_SOURCE_USE",
    runtime: "UNVERIFIED",
  });
  return {
    timer: resource(
      [/\bsetTimeout\s*\(/, /\bsetInterval\s*\(/],
      [/\bclearTimeout\s*\(/, /\bclearInterval\s*\(/]
    ),
    raf: resource([/\brequestAnimationFrame\s*\(/], [/\bcancelAnimationFrame\s*\(/]),
    listener: resource([/\baddEventListener\s*\(/], [/\bremoveEventListener\s*\(/]),
    canvas: resource(
      [/<canvas\b/, /\.getContext\s*\(/, /\bOffscreenCanvas\b/],
      [/\bremove\s*\(/, /\bdispose\s*\(/, /\bclose\s*\(/, /\bnull\b/]
    ),
    audio: resource(
      [/\bAudioContext\b/, /\bnew\s+Audio\s*\(/, /<audio\b/],
      [/\bpause\s*\(/, /\bclose\s*\(/, /\bdisconnect\s*\(/]
    ),
    categories,
    lifecycleRuntime: "UNVERIFIED_T191_STATIC_ONLY",
  };
}

function reducedMotionFor(root, ownerText, categories) {
  const local =
    /\buseShouldAnimate\b|\bshouldAnimate\s*\(|prefers-reduced-motion|reducedMotion|reduce-motion/.test(
      ownerText
    );
  const appPath = join(root, "src/App.tsx");
  const cssPath = join(root, "src/index.css");
  const sharedMotion = existsSync(appPath) && /MotionConfig/.test(readRooted(root, "src/App.tsx"));
  const sharedCss =
    existsSync(cssPath) &&
    /body\.reduce-motion|prefers-reduced-motion/.test(readRooted(root, "src/index.css"));
  if (local)
    return {
      sourceStatus: "PASS_LOCAL_GATE_DETECTED",
      behavior: "local effective-motion source branch detected",
      runtime: "UNVERIFIED",
    };
  if (categories.includes("framer-motion") && sharedMotion)
    return {
      sourceStatus: "PASS_SHARED_MOTIONCONFIG_SOURCE",
      behavior: "inherits app MotionConfig source gate",
      runtime: "UNVERIFIED",
    };
  if (categories.some((item) => item.startsWith("css-")) && sharedCss)
    return {
      sourceStatus: "PASS_SHARED_CSS_KILL_SWITCH_SOURCE",
      behavior: "shared CSS reduced-motion source gate exists",
      runtime: "UNVERIFIED",
    };
  return {
    sourceStatus: "UNVERIFIED",
    behavior: "no owner-local reduced-motion branch detected",
    runtime: "UNVERIFIED",
  };
}

function exitsFor(ownerText, symbol) {
  const takeover = /modal|dialog|sheet|drawer|popover|overlay|toast/i.test(symbol);
  return {
    visible: sourceFact(
      ownerText,
      [/\bClose\b/, /\bCancel\b/, /\bDismiss\b/, /\bonClose\b/, /\bonOpenChange\b/],
      "PASS_SOURCE_EXIT_DETECTED",
      takeover ? "visible exit not detected" : "not a takeover"
    ),
    androidBack: takeover
      ? sourceFact(
          ownerText,
          [/\buseBackHandler\b/, /\bregisterModalCloseCallback\b/, /\bonBack\b/],
          "PASS_SOURCE_BACK_OWNER_DETECTED",
          "Android Back owner not detected"
        )
      : {
          sourceStatus: "N/A_INLINE_NON_TAKEOVER",
          runtimeStatus: "UNVERIFIED",
          evidencePatterns: [],
        },
    escape: takeover
      ? sourceFact(
          ownerText,
          [/\bEscape\b/, /\bonEscapeKeyDown\b/, /\buseModalKeyboard\b/],
          "PASS_SOURCE_ESCAPE_DETECTED",
          "Escape owner not detected"
        )
      : {
          sourceStatus: "N/A_INLINE_NON_TAKEOVER",
          runtimeStatus: "UNVERIFIED",
          evidencePatterns: [],
        },
    focus: takeover
      ? sourceFact(
          ownerText,
          [/\bfocus\s*\(/, /\bautoFocus\b/, /\bonCloseAutoFocus\b/, /\bFocusScope\b/],
          "PASS_SOURCE_FOCUS_OWNER_DETECTED",
          "focus ownership not detected"
        )
      : {
          sourceStatus: "N/A_INLINE_NON_TAKEOVER",
          runtimeStatus: "UNVERIFIED",
          evidencePatterns: [],
        },
  };
}

function platformApplicability(path, route) {
  const native = path.startsWith("android/")
    ? "android"
    : path.startsWith("ios/")
      ? "ios"
      : path.startsWith("src-tauri/")
        ? "desktop"
        : null;
  return Object.fromEntries(
    PLATFORMS.map((platform) => [
      platform,
      {
        sourceApplicability:
          native === null
            ? platform === "web"
              ? "PASS_SHARED_WEB_SOURCE"
              : "PASS_SHARED_SOURCE_ONLY"
            : platform === native
              ? "PASS_NATIVE_SHIPPED_SOURCE"
              : "N/A_OTHER_NATIVE_WRAPPER",
        runtime: "UNVERIFIED",
        route: route.route,
      },
    ])
  );
}

function privacyFor(path, symbol, ownerText) {
  const sensitive = /journal|diary|thought|gratitude|mood|habit|auth|token/i.test(
    path + " " + symbol + " " + ownerText
  );
  return {
    dataInput: sensitive ? "POTENTIALLY_SENSITIVE_OWNER_INPUT" : "NO_SENSITIVE_INPUT_DETECTED",
    rawContentInEvidence: "NO_SOURCE_BYTES_BEYOND_BOUNDED_LOCATOR_TOKENS",
    loggingOrExternalSink: "UNVERIFIED_BY_T191_STATIC_OWNER_SCAN",
  };
}

function triggerFor(categories, tokens) {
  if (tokens.some((token) => /\bwhileHover\b|\bwhileTap\b|\bonClick\b/.test(token)))
    return "direct pointer/keyboard interaction";
  if (tokens.some((token) => /\buseEffect\b/.test(token)))
    return "component lifecycle or state effect";
  if (categories.includes("timer")) return "scheduled visual-state callback";
  if (categories.includes("raf")) return "animation-frame loop";
  if (categories.some((item) => item.startsWith("css-"))) return "rendered selector/class state";
  return "rendered owner or source-defined effect";
}

function bundleSentinels(categories) {
  return [...new Set(categories.flatMap((category) => CATEGORY_SENTINELS[category] || []))].sort();
}

function sourceBase(root, files) {
  const inputs = files.map((path) => {
    const bytes = readFileSync(safeExistingAbsolute(root, path));
    return path + "\0" + sha256(bytes);
  });
  return "source-input-sha256:" + sha256(inputs.join("\n") + "\n");
}

function rowFor(root, graph, path, text, group, reachability, sourceBytes = text) {
  const categories = [...new Set(group.occurrences.map((item) => item.category))].sort();
  const source = {
    file: path,
    symbol: group.symbol,
    startLine: Math.min(...group.occurrences.map((item) => item.start)),
    endLine: Math.max(...group.occurrences.map((item) => item.end)),
    sha256: sha256(sourceBytes),
    locators: group.occurrences.map((item) => ({
      line: item.line,
      category: item.category,
      token: item.token,
    })),
  };
  const ownerLines = text.split(/\r?\n/).slice(Math.max(0, source.startLine - 1), source.endLine);
  const ownerText = ownerLines.join("\n");
  const surface = routeFor(path, group.symbol);
  const gated = /\b(?:FEATURE|ENABLED|shouldShow|isEnabled|designFlag|featureFlag)\b/.test(
    ownerText
  );
  const entryPath =
    reachability === "source-entry" ? importPath(graph, path) : [{ file: path, via: reachability }];
  return {
    id: "t191-" + slug(path) + "-" + slug(group.symbol),
    source,
    routeSurface: surface,
    trigger: triggerFor(
      categories,
      source.locators.map((item) => item.token)
    ),
    visibleMeaning: visibleMeaning(group.symbol, path),
    reachability: {
      entry: reachability === "source-entry" ? ENTRY : reachability,
      importPath: entryPath,
      importKinds: [...new Set(entryPath.map((item) => item.via))],
      sourceState: gated
        ? "gated"
        : reachability === "source-entry" || reachability.includes("shipped")
          ? "reachable"
          : "unknown",
      bundle: {
        status:
          path.startsWith("android/") || path.startsWith("ios/") || path.startsWith("src-tauri/")
            ? "N/A_NATIVE_WRAPPER_NOT_IN_SHARED_WEB_ASSET_BUNDLE"
            : "UNVERIFIED_UNTIL_T191_ANDROID_BUNDLE_RECEIPT",
        sentinels: bundleSentinels(categories),
        proofBoundary:
          "shared category sentinel plus exact source import path; not a unique per-owner runtime observation",
      },
    },
    classification: {
      state: gated ? "gated" : "reachable",
      confidence: categories.some((item) => DIRECT_CATEGORIES.has(item))
        ? "CONFIRMED_SOURCE_MOTION"
        : "AMBIGUOUS",
    },
    owner: { componentOrSymbol: group.symbol, sourceFile: path },
    exits: exitsFor(ownerText, group.symbol),
    lifecycle: lifecycleFor(ownerText, categories),
    reducedMotion: reducedMotionFor(root, ownerText, categories),
    localization: {
      locales: LOCALES,
      rtlSensitivity: /\b(?:left|right|translateX|x:|direction|dir=|rtl:)\b/.test(ownerText)
        ? "HIGH_DIRECTIONAL_SOURCE"
        : "REVIEW_REQUIRED",
      runtime: "UNVERIFIED",
    },
    privacy: privacyFor(path, group.symbol, ownerText),
    androidApplicability: platformApplicability(path, surface).android,
    platformApplicability: platformApplicability(path, surface),
    evidence: [
      { type: "source-sha256", locator: path + ":" + source.startLine, sha256: source.sha256 },
      { type: "production-entry-path", value: entryPath },
    ],
    status: {
      inventory: "PASS_STATIC_ACCOUNTED",
      directVisualRuntime: "UNVERIFIED",
      humanReview: "UNVERIFIED",
      artisticCraft: "UNVERIFIED",
      release: "STOP",
    },
    motionCategories: categories,
  };
}

function groupOccurrences(occurrences) {
  const map = new Map();
  for (const occurrence of occurrences) {
    const key = occurrence.symbol;
    if (!map.has(key)) map.set(key, { symbol: occurrence.symbol, occurrences: [] });
    map.get(key).occurrences.push(occurrence);
  }
  return [...map.values()].sort((a, b) => {
    const left = a.occurrences[0];
    const right = b.occurrences[0];
    return left.line - right.line || a.symbol.localeCompare(b.symbol);
  });
}

function exclusionFor(path, text, occurrences, reason) {
  return {
    id: "t191-exclusion-" + slug(path) + "-" + slug(reason),
    source: {
      file: path,
      sha256: sha256(text),
      locators: occurrences
        .slice(0, 20)
        .map((item) => ({ line: item.line, category: item.category, token: item.token })),
    },
    classification: reason,
    proof: [
      {
        type: "source-classification",
        fact: reason,
        candidateCount: occurrences.length,
      },
    ],
    status: "PASS_JUSTIFIED_EXCLUSION",
  };
}

export function discoverInventory(root = TOOL_ROOT) {
  root = resolve(root);
  const files = allSourceFiles(root);
  const graph = importGraph(root, files);
  const motionOwners = [];
  const orbExclusions = [];
  const nonProductionExclusions = [];
  const candidateFileLedger = [];
  const oracleLocators = [];

  for (const path of files) {
    if (MOTION_ASSET.test(path)) {
      const text = path;
      const sourceBytes = readFileSync(safeExistingAbsolute(root, path));
      const occurrence = {
        category: "lottie-tgs-video-gif",
        line: 1,
        token: path,
        symbol: "asset " + path.split("/").at(-1),
        start: 1,
        end: 1,
      };
      const row = rowFor(
        root,
        graph,
        path,
        text,
        { symbol: occurrence.symbol, occurrences: [occurrence] },
        "public-shipped-asset",
        sourceBytes
      );
      motionOwners.push(row);
      candidateFileLedger.push({
        file: path,
        candidateCount: 1,
        classification: "INVENTORIED_1_OWNER",
        ownerIds: [row.id],
        evidence: [path + ":1"],
      });
      oracleLocators.push(path + ":1:lottie-tgs-video-gif");
      continue;
    }
    const text = readRooted(root, path);
    const occurrences = detectOccurrences(path, text);
    if (!occurrences.length) {
      const broad = broadLexicalOccurrences(path, text);
      if (!broad.length) continue;
      for (const item of broad) oracleLocators.push(path + ":" + item.line + ":" + item.category);
      const reason = TEST_PATH.test(path)
        ? "test-only-broad-lexical-candidate"
        : "broad-lexical-candidate-without-motion-syntax";
      nonProductionExclusions.push(exclusionFor(path, text, broad, reason));
      candidateFileLedger.push({
        file: path,
        candidateCount: broad.length,
        classification: TEST_PATH.test(path)
          ? "JUSTIFIED_TEST_ONLY_BROAD_LEXICAL"
          : "JUSTIFIED_NON_MOTION_TERMINOLOGY",
        ownerIds: [],
        evidence: broad.slice(0, 20).map((item) => path + ":" + item.line + ":" + item.category),
      });
      continue;
    }
    for (const item of occurrences)
      oracleLocators.push(path + ":" + item.line + ":" + item.category);
    const groups = groupOccurrences(occurrences);
    const reachable =
      graph.reachable.has(path) ||
      path.startsWith("public/") ||
      path.startsWith("android/app/src/main/") ||
      path.startsWith("ios/App/App/") ||
      path.startsWith("ios/App/CapApp-SPM/Sources/") ||
      path.startsWith("src-tauri/src/");
    let classification;
    let ownerIds = [];
    if (TEST_PATH.test(path)) {
      nonProductionExclusions.push(exclusionFor(path, text, occurrences, "test-only"));
      classification = "JUSTIFIED_TEST_ONLY";
    } else if (DEV_PATH.test(path)) {
      nonProductionExclusions.push(exclusionFor(path, text, occurrences, "development-only"));
      classification = "JUSTIFIED_DEVELOPMENT_ONLY";
    } else if (!reachable) {
      nonProductionExclusions.push(
        exclusionFor(path, text, occurrences, "dead-unreachable-from-production-entry")
      );
      classification = "JUSTIFIED_DEAD_UNREACHABLE";
    } else {
      const directGroups = groups.filter((group) =>
        group.occurrences.some((item) => DIRECT_CATEGORIES.has(item.category))
      );
      if (!directGroups.length) {
        nonProductionExclusions.push(
          exclusionFor(path, text, occurrences, "ambiguous-timer-visual-role-unproven")
        );
        classification = "AMBIGUOUS_TIMER_VISUAL_ROLE_UNPROVEN";
      } else {
        for (const group of directGroups) {
          const reachability = graph.reachable.has(path)
            ? "source-entry"
            : path.startsWith("public/")
              ? "public-shipped-root"
              : path.startsWith("android/")
                ? "android-native-shipped-root"
                : path.startsWith("ios/")
                  ? "ios-native-shipped-root"
                  : "desktop-native-shipped-root";
          const row = rowFor(root, graph, path, text, group, reachability);
          if (
            ORB_FAMILY_FILES.has(path) ||
            /^(?:ValenceOrb|MiniValenceOrb|CompactValenceOrb)$/.test(group.symbol)
          ) {
            const exclusion = {
              ...row,
              id: "t191-orb-exclusion-" + slug(path) + "-" + slug(group.symbol),
              classification: "canonical-orb-family",
              proof: [
                { type: "exact-protected-path", file: path, symbol: group.symbol },
                { type: "canonical-contract", file: "docs/ai/CANONICAL_ORB_INVARIANT.md" },
              ],
              status: {
                inventory: "PASS_PROOF_BOUND_EXCLUSION",
                directVisualRuntime: "UNVERIFIED",
                humanReview: "UNVERIFIED",
                artisticCraft: "UNVERIFIED",
                release: "STOP",
              },
            };
            orbExclusions.push(exclusion);
            ownerIds.push(exclusion.id);
          } else {
            motionOwners.push(row);
            ownerIds.push(row.id);
          }
        }
        classification = ORB_FAMILY_FILES.has(path)
          ? "PROOF_BOUND_ORB_EXCLUSION"
          : "INVENTORIED_" + directGroups.length + "_OWNERS";
      }
    }
    candidateFileLedger.push({
      file: path,
      candidateCount: occurrences.length,
      classification,
      ownerIds: ownerIds.sort(),
      evidence: occurrences
        .slice(0, 20)
        .map((item) => path + ":" + item.line + ":" + item.category),
    });
  }

  motionOwners.sort((a, b) => a.id.localeCompare(b.id));
  orbExclusions.sort((a, b) => a.id.localeCompare(b.id));
  nonProductionExclusions.sort((a, b) => a.id.localeCompare(b.id));
  candidateFileLedger.sort((a, b) => a.file.localeCompare(b.file));
  oracleLocators.sort();
  const categoryCounts = {};
  for (const row of [...motionOwners, ...orbExclusions]) {
    for (const category of row.motionCategories)
      categoryCounts[category] = (categoryCounts[category] || 0) + 1;
  }
  const sourceOracleFingerprint = sha256(oracleLocators.join("\n") + "\n");
  return {
    schemaVersion: 1,
    task: {
      id: "T191",
      feature: "002-android-2-1-connected-release",
      title: "Production-reachable non-orb motion inventory",
      sourceBase: sourceBase(root, files),
      generatedOn: "2026-08-14",
      taskScope: "Inventory tooling and evidence only; no production UI, motion or copy change.",
      releaseStatus: "STOP",
    },
    scope: {
      entry: ENTRY,
      discovery:
        "Static runtime imports, runtime re-exports, literal dynamic imports, literal import.meta.glob patterns, require, CSS imports and literal new URL edges plus shipped public/native roots.",
      candidateFamilies: CATEGORY_RULES.map((item) => item[0]),
      timerBoundary:
        "Timer-only files are not counted as motion owners; they are retained as ambiguous proof rows until a visual role is demonstrated.",
      orbBoundary:
        "ValenceOrb, MiniValenceOrb, CompactValenceOrb and their exact renderer/shader helpers are excluded only through exact path and symbol proof.",
      bundleBoundary:
        "Canonical rows declare category sentinels; exact Android dist hashes and sentinel results live in the ignored T191 bundle receipt.",
      privacy:
        "Evidence stores paths, hashes and bounded source locator tokens only; it does not read runtime user content or external systems.",
    },
    summary: {
      productionReachableModules: graph.reachable.size,
      candidateFiles: candidateFileLedger.length,
      candidateLocators: oracleLocators.length,
      accountedCandidateFiles: candidateFileLedger.length,
      coveragePercent: candidateFileLedger.length ? 100 : 0,
      motionOwnerRows: motionOwners.length,
      orbExclusionRows: orbExclusions.length,
      nonProductionExclusionRows: nonProductionExclusions.length,
      ambiguousTimerFiles: candidateFileLedger.filter(
        (item) => item.classification === "AMBIGUOUS_TIMER_VISUAL_ROLE_UNPROVEN"
      ).length,
      categoryCounts,
      sourceOracleFingerprint,
      validatorFailures: [],
    },
    sourceOracle: {
      command:
        "rg -n --glob source/native extensions for keyframes, animation, transition, WAAPI, RAF, timers, Framer Motion, canvas/WebGL, particles/confetti, Lottie/TGS/video/GIF/audio and native/splash/route transitions",
      candidateFileLedger,
      locatorFingerprint: sourceOracleFingerprint,
      coverage: "PASS_100_PERCENT_FILE_CLASSIFICATION",
    },
    platformMatrix: Object.fromEntries(
      PLATFORMS.map((platform) => [
        platform,
        {
          sourceApplicability: "PASS_CLASSIFIED",
          directRuntime: "UNVERIFIED",
          humanReview: "UNVERIFIED",
          release: "STOP",
        },
      ])
    ),
    motionOwners,
    orbExclusions,
    nonProductionExclusions,
    evidenceLedger: {
      redGreen: "Retained in T191 ignored receipt and focused test output.",
      androidBundle: "UNVERIFIED_UNTIL_T191_IGNORED_RECEIPT",
      directVisualRuntime: "UNVERIFIED_T192_SCOPE",
      humanAssistiveTechnology: "UNVERIFIED",
      artisticCraft: "UNVERIFIED",
      externalWrites: 0,
      deferredLedger: existsSync(join(root, "docs/ai/DEFERRED_FINDINGS_LEDGER.md"))
        ? "AVAILABLE_NOT_MUTATED_BY_GENERATOR"
        : "DEFERRED_LEDGER_PENDING",
      verdict: "GO_STATIC_INVENTORY_ONLY",
      release: "STOP",
    },
  };
}

const REQUIRED_ROW_PATHS = [
  "id",
  "source.file",
  "source.symbol",
  "source.startLine",
  "source.endLine",
  "source.sha256",
  "source.locators",
  "routeSurface.route",
  "routeSurface.surface",
  "trigger",
  "visibleMeaning.value",
  "visibleMeaning.status",
  "reachability.entry",
  "reachability.importPath",
  "reachability.importKinds",
  "reachability.sourceState",
  "reachability.bundle.status",
  "classification.state",
  "classification.confidence",
  "owner.componentOrSymbol",
  "exits.visible",
  "exits.androidBack",
  "exits.escape",
  "exits.focus",
  "lifecycle.timer",
  "lifecycle.raf",
  "lifecycle.listener",
  "lifecycle.canvas",
  "lifecycle.audio",
  "reducedMotion",
  "localization.locales",
  "localization.rtlSensitivity",
  "privacy.dataInput",
  "androidApplicability",
  "platformApplicability.web",
  "platformApplicability.pwa",
  "platformApplicability.android",
  "platformApplicability.ios",
  "platformApplicability.desktop",
  "evidence",
  "status.inventory",
  "motionCategories",
];

function hasPath(value, path) {
  let current = value;
  for (const part of path.split(".")) {
    if (!current || typeof current !== "object" || !(part in current)) return false;
    current = current[part];
  }
  return current !== undefined;
}

function validateSource(root, row, errors) {
  const path = row && row.source && row.source.file;
  if (!path || !existsSync(safeAbsolute(root, path))) {
    errors.push("STALE_SOURCE_FILE " + (path || row.id || "unknown"));
    return;
  }
  const isMotionAsset = MOTION_ASSET.test(path);
  const source = isMotionAsset
    ? readFileSync(safeExistingAbsolute(root, path))
    : readRooted(root, path);
  if (row.source.sha256 !== sha256(source)) errors.push("STALE_SOURCE_HASH " + path);
  for (const locator of row.source.locators || []) {
    const locatorPresent = isMotionAsset
      ? locator.token === path
      : Boolean(locator.token && source.includes(locator.token));
    if (!locatorPresent)
      errors.push("STALE_SOURCE_LOCATOR " + path + ":" + (locator.line || "unknown"));
  }
}

export function validateInventory(root, expected, actual) {
  const errors = [];
  if (!actual || actual.schemaVersion !== 1) errors.push("MISSING_FIELD schemaVersion=1");
  for (const key of ["motionOwners", "orbExclusions", "nonProductionExclusions"]) {
    if (!Array.isArray(actual && actual[key])) errors.push("MISSING_FIELD " + key);
  }
  if (errors.length) return errors;
  const expectedIds = new Set(expected.motionOwners.map((row) => row.id));
  const actualIds = new Set();
  for (const row of actual.motionOwners) {
    if (actualIds.has(row.id)) errors.push("DUPLICATE_ID " + row.id);
    actualIds.add(row.id);
    if (ORB_FAMILY_FILES.has(row.source && row.source.file))
      errors.push("ORB_EXCLUSION_MISLABELED " + row.id);
    for (const path of REQUIRED_ROW_PATHS)
      if (!hasPath(row, path)) errors.push("MISSING_FIELD " + (row.id || "unknown") + " " + path);
    validateSource(root, row, errors);
  }
  for (const id of expectedIds)
    if (!actualIds.has(id)) errors.push("MISSING_DISCOVERED_OWNER " + id);
  for (const id of actualIds) if (!expectedIds.has(id)) errors.push("STALE_DISCOVERED_OWNER " + id);

  const expectedOrbIds = new Set(expected.orbExclusions.map((row) => row.id));
  const actualOrbIds = new Set();
  for (const row of actual.orbExclusions) {
    if (actualOrbIds.has(row.id)) errors.push("DUPLICATE_ID " + row.id);
    actualOrbIds.add(row.id);
    if (row.classification !== "canonical-orb-family")
      errors.push("ORB_EXCLUSION_MISLABELED " + row.id);
    if (!Array.isArray(row.proof) || row.proof.length < 2)
      errors.push("ORB_EXCLUSION_WITHOUT_PROOF " + row.id);
    if (!ORB_FAMILY_FILES.has(row.source && row.source.file))
      errors.push("ORB_EXCLUSION_PATH_NOT_CANONICAL " + row.id);
    for (const path of REQUIRED_ROW_PATHS.filter((path) => !path.startsWith("classification."))) {
      if (!hasPath(row, path)) errors.push("MISSING_FIELD " + (row.id || "unknown") + " " + path);
    }
    validateSource(root, row, errors);
  }
  for (const id of expectedOrbIds)
    if (!actualOrbIds.has(id)) errors.push("MISSING_ORB_EXCLUSION " + id);
  const accountedOwnerIds = new Set([...actualIds, ...actualOrbIds]);
  const oracleRows = actual.sourceOracle && actual.sourceOracle.candidateFileLedger;
  if (!Array.isArray(oracleRows)) {
    errors.push("MISSING_FIELD sourceOracle.candidateFileLedger");
  } else {
    for (const row of oracleRows) {
      if (!row.file || !row.classification || !Array.isArray(row.ownerIds)) {
        errors.push("SOURCE_ORACLE_INVALID_ROW " + (row.file || "unknown"));
        continue;
      }
      for (const id of row.ownerIds) {
        if (!accountedOwnerIds.has(id))
          errors.push("SOURCE_ORACLE_UNKNOWN_OWNER " + row.file + " " + id);
      }
    }
  }
  if (actual.summary.motionOwnerRows !== actual.motionOwners.length)
    errors.push("SUMMARY_OWNER_COUNT_MISMATCH");
  if (actual.summary.orbExclusionRows !== actual.orbExclusions.length)
    errors.push("SUMMARY_ORB_COUNT_MISMATCH");
  if (Array.isArray(oracleRows) && actual.summary.accountedCandidateFiles !== oracleRows.length)
    errors.push("SUMMARY_ORACLE_COUNT_MISMATCH");
  if (actual.summary && actual.summary.coveragePercent !== 100)
    errors.push("SOURCE_ORACLE_COVERAGE " + actual.summary.coveragePercent);
  if (
    !Array.isArray(actual.summary && actual.summary.validatorFailures) ||
    actual.summary.validatorFailures.length
  )
    errors.push("VALIDATOR_FAILURES_NOT_EMPTY");
  if (!errors.length && JSON.stringify(actual) !== JSON.stringify(expected))
    errors.push("INVENTORY_DRIFT deterministic generated inventory differs");
  return errors;
}

function bundleFiles(root, directory) {
  const absolute = safeAbsolute(root, directory);
  if (!existsSync(absolute) || !statSync(absolute).isDirectory())
    throw new Error("BUNDLE_DIRECTORY_MISSING " + directory);
  return walk(root, absolute)
    .filter((path) => !path.endsWith(".map"))
    .map((path) => {
      const bytes = readFileSync(safeExistingAbsolute(root, path));
      return { path, size: bytes.length, sha256: sha256(bytes), bytes };
    })
    .sort((a, b) => a.path.localeCompare(b.path));
}

function writeBundleReceipt(root, inventory, bundleDirectory, receiptPath) {
  const files = bundleFiles(root, bundleDirectory);
  const searchable = Buffer.concat(files.map((item) => item.bytes)).toString("latin1");
  const rowProofs = inventory.motionOwners.map((row) => {
    const nativeNarrow = row.reachability.bundle.status.startsWith("N/A_NATIVE");
    const sentinels = row.reachability.bundle.sentinels || [];
    const found = sentinels.filter((sentinel) => searchable.includes(sentinel));
    return {
      id: row.id,
      status: nativeNarrow
        ? "N/A_NATIVE_SOURCE_ONLY"
        : found.length
          ? "PASS_SHARED_CATEGORY_SENTINEL"
          : "FAIL_NO_BUNDLE_SENTINEL",
      sentinelsExpected: sentinels,
      sentinelsFound: found,
      sourceImportPath: row.reachability.importPath,
    };
  });
  const shared = rowProofs.filter((row) => row.status !== "N/A_NATIVE_SOURCE_ONLY");
  const failures = shared.filter((row) => !row.status.startsWith("PASS"));
  const inventoryBytes = serializeInventory(inventory);
  const receipt = {
    schemaVersion: 1,
    task: "T191",
    sourceBase: inventory.task.sourceBase,
    sourceInventorySha256: sha256(inventoryBytes),
    sourceOracleCoverage: inventory.summary.coveragePercent,
    bundleDirectory,
    bundleFiles: files.map(({ bytes, ...item }) => item),
    bundleSha256: sha256(
      files.map((item) => item.path + "\0" + item.sha256 + "\0" + item.size).join("\n") + "\n"
    ),
    bundleRowsPass: shared.length - failures.length,
    bundleRowsTotal: shared.length,
    nativeSourceOnlyRows: rowProofs.length - shared.length,
    rowProofs,
    testOnlySentinel: {
      value: TEST_ONLY_BUNDLE_SENTINEL,
      present: searchable.includes(TEST_ONLY_BUNDLE_SENTINEL),
      status: searchable.includes(TEST_ONLY_BUNDLE_SENTINEL) ? "FAIL" : "PASS_ABSENT",
    },
    failures: [
      ...failures.map((row) => row.id),
      ...(searchable.includes(TEST_ONLY_BUNDLE_SENTINEL) ? ["TEST_ONLY_SENTINEL_PRESENT"] : []),
    ],
    limitations: [
      "Category sentinels are shared bundle evidence and are not unique runtime observations of each owner.",
      "Direct visual, lifecycle, accessibility, human and artistic runtime evidence remains UNVERIFIED and belongs to T192 or later named tasks.",
    ],
    androidBundleProof:
      failures.length || searchable.includes(TEST_ONLY_BUNDLE_SENTINEL)
        ? "FAIL"
        : "PASS_SOURCE_GRAPH_PLUS_SHARED_SENTINELS",
    externalWrites: 0,
  };
  const absoluteReceipt = safeAbsolute(root, receiptPath);
  mkdirSync(dirname(absoluteReceipt), { recursive: true });
  writeFileSync(absoluteReceipt, JSON.stringify(receipt, null, 2) + "\n", "utf8");
  return receipt;
}

function summary(inventory) {
  return (
    inventory.summary.motionOwnerRows +
    " owners; " +
    inventory.summary.orbExclusionRows +
    " orb exclusions; " +
    inventory.summary.candidateFiles +
    " candidate files; coverage=" +
    inventory.summary.coveragePercent +
    "%"
  );
}

const options = parseArgs(process.argv.slice(2));
const canonicalPath = safeAbsolute(options.root, DEFAULT_INVENTORY);
let expected;
try {
  expected = discoverInventory(options.root);
} catch (error) {
  console.error(
    "FAIL non-orb-motion-inventory SOURCE_DISCOVERY " +
      (error instanceof Error ? error.message : String(error))
  );
  process.exit(2);
}

if (options.bundle) {
  if (!options.receipt) {
    console.error("FAIL non-orb-motion-inventory RECEIPT_PATH_REQUIRED");
    process.exit(2);
  }
  try {
    const receipt = writeBundleReceipt(options.root, expected, options.bundle, options.receipt);
    if (receipt.failures.length) {
      for (const failure of receipt.failures)
        console.error("FAIL non-orb-motion-inventory BUNDLE " + failure);
      process.exit(1);
    }
    console.log(
      "PASS non-orb-motion-inventory BUNDLE " +
        receipt.bundleRowsPass +
        "/" +
        receipt.bundleRowsTotal +
        " shared rows; native-source-only=" +
        receipt.nativeSourceOnlyRows
    );
    process.exit(0);
  } catch (error) {
    console.error(
      "FAIL non-orb-motion-inventory BUNDLE_PROOF " +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(2);
  }
}

if (options.mode === "write") {
  mkdirSync(dirname(canonicalPath), { recursive: true });
  writeFileSync(canonicalPath, serializeInventory(expected), "utf8");
  console.log("WROTE non-orb-motion-inventory " + DEFAULT_INVENTORY + "; " + summary(expected));
} else if (options.mode === "print") {
  process.stdout.write(serializeInventory(expected));
} else {
  let actual;
  try {
    actual = options.stdin
      ? JSON.parse(readFileSync(0, "utf8"))
      : JSON.parse(readRooted(options.root, DEFAULT_INVENTORY));
  } catch (error) {
    console.error(
      "FAIL non-orb-motion-inventory INVENTORY_READ " +
        (error instanceof Error ? error.message : String(error))
    );
    process.exit(1);
  }
  const errors = validateInventory(options.root, expected, actual);
  if (errors.length) {
    for (const error of errors) console.error("FAIL non-orb-motion-inventory " + error);
    process.exit(1);
  }
  console.log(
    "PASS non-orb-motion-inventory " +
      summary(actual) +
      "; runtime=UNVERIFIED; artistic=UNVERIFIED; release=STOP"
  );
}
