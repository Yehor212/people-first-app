#!/usr/bin/env node

const fs = require("fs");
const path = require("path");

const DEFAULT_SPEC_PATH = "docs/audio/hyperfocus-nature-soundscape-spec.json";
const REQUIRED_MODEL_PROVIDER = "Google Gemini/Lyria family only";
const REQUIRED_FAMILIES = ["forest", "rain", "ocean", "fireplace", "river", "wind"];
const REQUIRED_LEVELS = ["soft", "deep", "intense"];
const FORBIDDEN_LEGACY_ROOT_AUDIO_PATTERNS = [/underwater/i, /thunderstorm/i];
const LEGACY_ROOT_AUDIO_SCAN_TARGETS = [
  "public/sounds",
  "dist/sounds",
  "android/app/src/main/assets/public/sounds",
  "ios/App/App/public/sounds",
  "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app/public/sounds",
];
const LEGACY_EMBEDDED_SCAN_TARGETS = [
  "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop",
];
const REQUIRED_PROMPT_PHRASES = [
  "field-recording",
  "environmental soundscape",
  "concentration",
  "30-second seamless loop",
  "steady from first second to last second",
  "no vocals",
  "no lyrics",
  "no melody",
  "no beat",
  "no drums",
  "no instruments",
  "no song structure",
];
const REQUIRED_REJECT_CONCEPTS = [
  /vocal|lyric|spoken/i,
  /melod|tune/i,
  /beat|drum|percussion/i,
  /instrument|synth/i,
  /song|chorus|verse|drop/i,
  /pop|commercial music|soundtrack/i,
  /loop|seam/i,
  /clip|clipping|harsh|transient/i,
];
const POSITIVE_MUSIC_DRIFT_PATTERNS = [
  /\bbts\b/i,
  /\bk-pop\b/i,
  /\bpop\s+song\b/i,
  /\bsong\s+about\b/i,
  /\bmusic\s+clip\b/i,
  /\bcatchy\b/i,
  /\bmelodic\b/i,
  /\bupbeat\b/i,
  /\bchorus\b/i,
  /\bverse\b/i,
  /\bdrop\b/i,
  /\bsoundtrack\b/i,
  /\bcinematic\b/i,
];
const FIREPLACE_POSITIVE_CONTEXT_DRIFT_PATTERNS = [
  /\bcamp[- ]?fire\b/i,
  /\bbonfire\b/i,
  /\bfire\s+pit\b/i,
  /\bcampsite\b/i,
  /\bnight\s+wind\b/i,
  /\bopen\s+night\s+air\b/i,
  /\bopen[- ]air\b/i,
  /\boutdoor\b/i,
];
const FIREPLACE_REQUIRED_CONTEXT_PATTERNS = [/\bindoor\b/i, /\b(room|hearth|fireplace|embers?)\b/i];

function readJson(filePath) {
  return JSON.parse(fs.readFileSync(filePath, "utf8"));
}

function resolveInsideRoot(rootDir, relativePath, issueCode) {
  const root = path.resolve(rootDir || process.cwd()); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- sanitizer computes the trusted root before prefix validation.
  const target = path.resolve(root, relativePath || ""); // nosemgrep: javascript.lang.security.audit.path-traversal.path-join-resolve-traversal.path-join-resolve-traversal -- target is rejected unless it remains inside root before any file read.
  if (target !== root && !target.startsWith(root + path.sep)) {
    return {
      ok: false,
      filePath: "",
      issue: createIssue(issueCode, "Spec path must stay inside the project root."),
    };
  }
  return { ok: true, filePath: target, issue: null };
}

function createIssue(code, message, context = {}) {
  return { code, message, ...context };
}

function hasRequiredRejectConcept(rejectIf, pattern) {
  return rejectIf.some((item) => pattern.test(String(item)));
}

function normalizeText(value) {
  return String(value || "").replace(/\s+/g, " ").trim();
}

function isForbiddenLegacyRootAudioFile(fileName) {
  return /\.(mp3|wav|m4a|aac|ogg)$/i.test(fileName) && FORBIDDEN_LEGACY_ROOT_AUDIO_PATTERNS.some((pattern) => pattern.test(fileName));
}

function scanForbiddenLegacyRootAudioAssets({ rootDir = process.cwd() } = {}) {
  const root = path.resolve(rootDir || process.cwd());
  const issues = [];

  for (const relativeDir of LEGACY_ROOT_AUDIO_SCAN_TARGETS) {
    const directory = path.resolve(root, relativeDir);
    if (directory !== root && !directory.startsWith(root + path.sep)) {
      issues.push(createIssue("unsafe-legacy-audio-scan-path", "Legacy audio scan path must stay inside the project root.", { relativePath: relativeDir }));
      continue;
    }
    if (!fs.existsSync(directory)) continue;
    for (const fileName of fs.readdirSync(directory)) {
      if (!isForbiddenLegacyRootAudioFile(fileName)) continue;
      issues.push(createIssue(
        "forbidden-legacy-root-audio",
        "Legacy underwater/thunderstorm root-level audio must not be shipped for Hyperfocus V2.",
        { relativePath: path.posix.join(relativeDir, fileName) },
      ));
    }
  }

  for (const relativeFile of LEGACY_EMBEDDED_SCAN_TARGETS) {
    const filePath = path.resolve(root, relativeFile);
    if (filePath !== root && !filePath.startsWith(root + path.sep)) {
      issues.push(createIssue("unsafe-legacy-audio-scan-path", "Legacy embedded scan path must stay inside the project root.", { relativePath: relativeFile }));
      continue;
    }
    if (!fs.existsSync(filePath) || !fs.statSync(filePath).isFile()) continue;
    const embeddedText = fs.readFileSync(filePath).toString("latin1");
    for (const pattern of FORBIDDEN_LEGACY_ROOT_AUDIO_PATTERNS) {
      if (!pattern.test(embeddedText)) continue;
      issues.push(createIssue(
        "forbidden-legacy-embedded-audio",
        "Legacy underwater/thunderstorm audio path is still embedded in the desktop bundle.",
        { relativePath: relativeFile, pattern: String(pattern) },
      ));
    }
  }

  return { ok: issues.length === 0, scannedTargets: LEGACY_ROOT_AUDIO_SCAN_TARGETS.length + LEGACY_EMBEDDED_SCAN_TARGETS.length, issues };
}

function getPositiveLevelText({ family, level }) {
  return normalizeText([
    family.label,
    family.focusRole,
    family.originalAsset,
    level.label,
    level.source,
    level.selectionRationale,
    level.prompt,
    level.normalization,
  ].filter(Boolean).join(" "));
}

function validateFireplaceContext({ family, level, issues }) {
  if (family.id !== "fireplace") return;
  const text = getPositiveLevelText({ family, level });

  for (const pattern of FIREPLACE_POSITIVE_CONTEXT_DRIFT_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(createIssue("fireplace-context-drift", "Fireplace positive copy/source must stay indoor-hearth focused and must not drift into campfire, bonfire, outdoor, or night-wind cues.", { familyId: family.id, levelId: level.id, pattern: String(pattern) }));
    }
  }

  for (const pattern of FIREPLACE_REQUIRED_CONTEXT_PATTERNS) {
    if (!pattern.test(text)) {
      issues.push(createIssue("fireplace-context-missing", "Fireplace positive copy/source must explicitly anchor the sound as an indoor fireplace/hearth bed.", { familyId: family.id, levelId: level.id, pattern: String(pattern) }));
    }
  }
}

function validatePrompt({ family, level, prompt, issues }) {
  const text = normalizeText(prompt);
  const lower = text.toLowerCase();

  for (const phrase of REQUIRED_PROMPT_PHRASES) {
    if (!lower.includes(phrase)) {
      issues.push(createIssue("missing-required-prompt-phrase", 'Prompt is missing required phrase "' + phrase + '".', { familyId: family.id, levelId: level.id }));
    }
  }

  if (family.kind === "nature" && !lower.includes("nature")) {
    issues.push(createIssue("missing-nature-contract", "Nature family prompt must explicitly say nature.", { familyId: family.id, levelId: level.id }));
  }

  for (const pattern of POSITIVE_MUSIC_DRIFT_PATTERNS) {
    if (pattern.test(text)) {
      issues.push(createIssue("music-positive-drift", "Prompt contains wording that can steer the model toward a song.", { familyId: family.id, levelId: level.id, pattern: String(pattern) }));
    }
  }
}

function validateHyperfocusNatureSoundscapeSpec({ rootDir = process.cwd(), specPath = DEFAULT_SPEC_PATH, spec } = {}) {
  const issues = [];
  const safeSpec = spec ? null : resolveInsideRoot(rootDir, specPath, "unsafe-spec-path");
  if (safeSpec && !safeSpec.ok) {
    return { ok: false, familyCount: 0, levelCount: 0, issues: [safeSpec.issue] };
  }
  const loadedSpec = spec || readJson(safeSpec.filePath);

  if (loadedSpec.modelPolicy?.requiredProvider !== REQUIRED_MODEL_PROVIDER) {
    issues.push(createIssue("provider-policy-drift", 'requiredProvider must be "' + REQUIRED_MODEL_PROVIDER + '".'));
  }

  if (loadedSpec.modelPolicy?.fallbackProvidersAllowed !== false) {
    issues.push(createIssue("fallback-provider-drift", "Fallback providers must be disabled unless the user approves."));
  }

  if (!Array.isArray(loadedSpec.families) || loadedSpec.families.length !== REQUIRED_FAMILIES.length) {
    issues.push(createIssue("family-count", "Spec must define exactly six Hyperfocus families."));
  }

  const seenFamilies = new Set();
  let levelCount = 0;

  for (const family of loadedSpec.families || []) {
    seenFamilies.add(family.id);

    if (!REQUIRED_FAMILIES.includes(family.id)) {
      issues.push(createIssue("unknown-family", 'Unknown family "' + family.id + '".', { familyId: family.id }));
    }

    if (!["nature", "human-environment"].includes(family.kind)) {
      issues.push(createIssue("bad-family-kind", 'Family "' + family.id + '" must be nature or human-environment.', { familyId: family.id }));
    }

    if (!Array.isArray(family.levels) || family.levels.length !== REQUIRED_LEVELS.length) {
      issues.push(createIssue("level-count", 'Family "' + family.id + '" must define exactly three levels.', { familyId: family.id }));
      continue;
    }

    const levelIds = family.levels.map((level) => level.id);
    if (JSON.stringify(levelIds) !== JSON.stringify(REQUIRED_LEVELS)) {
      issues.push(createIssue("level-order", 'Family "' + family.id + '" must use soft/deep/intense level order.', { familyId: family.id, levelIds }));
    }

    for (const level of family.levels) {
      levelCount += 1;
      const expectedFileName = 'hyperfocus-' + family.id + '-' + level.id + '.mp3';
      if (level.fileName !== expectedFileName) {
        issues.push(createIssue("file-name", 'Expected fileName "' + expectedFileName + '".', { familyId: family.id, levelId: level.id }));
      }
      validatePrompt({ family, level, prompt: level.prompt, issues });
      validateFireplaceContext({ family, level, issues });
      if (!Array.isArray(level.rejectIf)) {
        issues.push(createIssue("missing-reject-if", "Every level must include rejectIf criteria.", { familyId: family.id, levelId: level.id }));
      } else {
        for (const pattern of REQUIRED_REJECT_CONCEPTS) {
          if (!hasRequiredRejectConcept(level.rejectIf, pattern)) {
            issues.push(createIssue("weak-reject-if", 'rejectIf is missing concept ' + String(pattern) + '.', { familyId: family.id, levelId: level.id }));
          }
        }
      }
    }
  }

  for (const familyId of REQUIRED_FAMILIES) {
    if (!seenFamilies.has(familyId)) {
      issues.push(createIssue("missing-family", 'Missing family "' + familyId + '".', { familyId }));
    }
  }

  const legacyAudioScan = scanForbiddenLegacyRootAudioAssets({ rootDir });
  issues.push(...legacyAudioScan.issues);

  return {
    ok: issues.length === 0,
    familyCount: Array.isArray(loadedSpec.families) ? loadedSpec.families.length : 0,
    levelCount,
    legacyAudioScan,
    issues,
  };
}

function buildHyperfocusNatureGenerationQueue({ rootDir = process.cwd(), specPath = DEFAULT_SPEC_PATH, phase = "pilot" } = {}) {
  const safeSpec = resolveInsideRoot(rootDir, specPath, "unsafe-spec-path");
  if (!safeSpec.ok) return { ok: false, phase, jobs: [], issues: [safeSpec.issue] };
  const spec = readJson(safeSpec.filePath);
  const validation = validateHyperfocusNatureSoundscapeSpec({ rootDir, specPath, spec });
  if (!validation.ok) return { ok: false, phase, jobs: [], issues: validation.issues };

  const allJobs = spec.families.flatMap((family) => family.levels.map((level) => ({
    id: family.id + ':' + level.id,
    familyId: family.id,
    levelId: level.id,
    model: spec.modelPolicy.preferredPilotModel,
    fileName: level.fileName,
    prompt: level.prompt,
    rejectIf: level.rejectIf,
  })));

  const jobs = phase === "pilot" ? allJobs.filter((job) => job.id === spec.generationGate.requiredPilotVariant) : allJobs;
  return { ok: true, phase: phase === "pilot" ? "pilot" : "full-pack-after-accepted-pilot", jobCount: jobs.length, requiresAcceptedPilot: phase !== "pilot", jobs, issues: [] };
}

function runCli() {
  const args = process.argv.slice(2);
  const specIndex = args.indexOf("--spec");
  if (specIndex >= 0 && args[specIndex + 1] && args[specIndex + 1] !== DEFAULT_SPEC_PATH) {
    console.error('[hyperfocus-nature-soundscape] FAIL - --spec must use the canonical project spec path: ' + DEFAULT_SPEC_PATH);
    process.exit(1);
  }
  const specPath = DEFAULT_SPEC_PATH;
  const queueIndex = args.indexOf("--print-generation-queue");
  const phaseIndex = args.indexOf("--phase");
  const phase = phaseIndex >= 0 && args[phaseIndex + 1] ? args[phaseIndex + 1] : "pilot";

  if (queueIndex >= 0) {
    const queue = buildHyperfocusNatureGenerationQueue({ specPath, phase });
    console.log(JSON.stringify(queue, null, 2));
    process.exit(queue.ok ? 0 : 1);
  }

  const result = validateHyperfocusNatureSoundscapeSpec({ specPath });
  if (result.ok) {
    console.log('[hyperfocus-nature-soundscape] PASS - ' + result.familyCount + ' families, ' + result.levelCount + ' natural focus variants.');
    return;
  }

  console.error('[hyperfocus-nature-soundscape] FAIL - ' + result.issues.length + ' issue(s).');
  for (const issue of result.issues.slice(0, 20)) console.error('- ' + issue.code + ': ' + issue.message);
  process.exit(1);
}

if (require.main === module) runCli();

module.exports = {
  REQUIRED_FAMILIES,
  REQUIRED_LEVELS,
  FORBIDDEN_LEGACY_ROOT_AUDIO_PATTERNS,
  scanForbiddenLegacyRootAudioAssets,
  validateHyperfocusNatureSoundscapeSpec,
  buildHyperfocusNatureGenerationQueue,
};
