import { createHash } from "node:crypto";
import { lstat, readFile, readdir } from "node:fs/promises";
import path from "node:path";

const SHA40 = /^[0-9a-f]{40}$/;
const SHA256 = /^[0-9a-f]{64}$/;
const SAFE_PACKAGE = /^[a-zA-Z0-9_.]+$/;
const SAFE_CANDIDATE_ID = /^(?:candidate(?:2[4-9]|[3-9][0-9]|[1-9][0-9]{2,})|prechange-baseline-0*[1-9][0-9]*)$/;
const SAFE_EXPERIMENT_ID = /^[a-zA-Z0-9._-]{1,80}$/;
const DOM_EXPERIMENT_FORBIDDEN =
  /\b(?:CacheStorage|EventSource|WebSocket|XMLHttpRequest|caches|cookie|fetch|indexedDB|localStorage|sendBeacon|sessionStorage)\b|\bimport\s*\(/i;
const EMAIL = /\b[A-Z0-9._%+-]+@[A-Z0-9.-]+\.[A-Z]{2,}\b/i;
const BEARER = /\bBearer\s+[A-Za-z0-9._~+/=-]+/i;
const JWT = /\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/;
const FORBIDDEN_KEYS = /^(access_?token|authorization|cookie|email|password|refresh_?token|secret|user_?id)$/i;

function fail(message) {
  throw new Error(`Android motion evidence: ${message}`);
}

function isObject(value) {
  return value !== null && typeof value === "object" && !Array.isArray(value);
}

function assertObject(value, label) {
  if (!isObject(value)) fail(`${label} must be an object`);
}

function assertExactKeys(value, allowed, required, label) {
  assertObject(value, label);
  for (const key of Object.keys(value)) {
    if (!allowed.has(key)) fail(`${label} contains additional property ${key}`);
  }
  for (const key of required) {
    if (!(key in value)) fail(`${label} is missing ${key}`);
  }
}

function assertPrivacySafe(value, key = "root") {
  if (FORBIDDEN_KEYS.test(key)) fail(`privacy-sensitive key ${key} is forbidden`);
  if (typeof value === "string" && (EMAIL.test(value) || BEARER.test(value) || JWT.test(value))) {
    fail(`privacy-sensitive value detected at ${key}`);
  }
  if (Array.isArray(value)) {
    value.forEach((item, index) => assertPrivacySafe(item, `${key}[${index}]`));
  } else if (isObject(value)) {
    Object.entries(value).forEach(([childKey, child]) => assertPrivacySafe(child, childKey));
  }
}

function assertFiniteNumber(value, label, { min = -Infinity, exclusiveMin = false } = {}) {
  if (!Number.isFinite(value)) fail(`${label} must be a finite number`);
  if (exclusiveMin ? value <= min : value < min) fail(`${label} is out of range`);
}

function assertSha256(value, label) {
  if (typeof value !== "string" || !SHA256.test(value)) fail(`${label} must be a full SHA-256`);
}

function assertDateTime(value, label) {
  if (typeof value !== "string" || Number.isNaN(Date.parse(value))) {
    fail(`${label} must be an ISO date-time`);
  }
}

export function buildStyleExperimentExpression({ css, id }) {
  if (typeof id !== "string" || !SAFE_EXPERIMENT_ID.test(id)) {
    fail("style experiment identifier is invalid");
  }
  if (typeof css !== "string" || css.length === 0 || css.length > 65536) {
    fail("style experiment CSS must contain 1-65536 characters");
  }
  return `(() => {
    const id = ${JSON.stringify(`zenflow-android-motion-${id}`)};
    document.getElementById(id)?.remove();
    const style = document.createElement("style");
    style.id = id;
    style.dataset.androidMotionExperiment = ${JSON.stringify(id)};
    style.textContent = ${JSON.stringify(css)};
    document.head.append(style);
    return { id, bytes: style.textContent.length };
  })()`;
}

export function validateDomExperimentSource(source) {
  if (typeof source !== "string" || source.length === 0 || source.length > 65536) {
    fail("DOM experiment source must contain 1-65536 characters");
  }
  if (DOM_EXPERIMENT_FORBIDDEN.test(source)) {
    fail("DOM experiments cannot access network or persisted data");
  }
  return source;
}

export function parseCurrentWebViewProvider(state) {
  if (typeof state !== "string") return null;
  const match = state.match(
    /Current WebView package \(name, version\): \(([^,]+),\s*([^)]+)\)/,
  );
  if (!match) return null;
  const packageName = match[1].trim();
  const version = match[2].trim();
  if (!SAFE_PACKAGE.test(packageName) || version.length === 0) return null;
  return { packageName, version };
}

export function parseWebViewDevtoolsSocket(procNetUnix, pid) {
  if (typeof procNetUnix !== "string" || !Number.isInteger(pid) || pid < 1) {
    fail("WebView DevTools socket input is invalid");
  }
  const socketName = `webview_devtools_remote_${pid}`;
  if (!new RegExp(`@${socketName}(?:\\s|$)`).test(procNetUnix)) {
    fail(`WebView DevTools socket for PID ${pid} is unavailable`);
  }
  return socketName;
}

export function selectLocalAppWebViewTarget(targets) {
  if (!Array.isArray(targets)) fail("CDP target discovery must return an array");
  const target = targets.find(
    (entry) =>
      isObject(entry) &&
      entry.type === "page" &&
      typeof entry.url === "string" &&
      entry.url.startsWith("https://localhost/") &&
      typeof entry.webSocketDebuggerUrl === "string" &&
      entry.webSocketDebuggerUrl.length > 0,
  );
  if (!target) fail("no inspectable ZenFlow Android WebView page target was found");
  return target;
}

export function buildLocalBenchmarkRoute(targetUrl, requestedPath) {
  let target;
  let route;
  try {
    target = new URL(targetUrl);
    route = new URL(requestedPath, target);
  } catch {
    fail("benchmark route URL is invalid");
  }
  if (target.protocol !== "https:" || target.hostname !== "localhost") {
    fail("benchmark target must use https://localhost");
  }
  if (route.origin !== target.origin || route.username || route.password) {
    fail("benchmark route must stay on localhost");
  }
  if (!/^\/orb\/?$/.test(route.pathname)) fail("benchmark setup must use the Orb route");
  if (route.searchParams.get("dev") !== "true") fail("benchmark setup requires dev=true");
  if (route.searchParams.get("nav") !== "v2") fail("benchmark setup requires nav=v2");
  if (route.searchParams.get("navLayout") !== "phone") {
    fail("benchmark setup requires navLayout=phone");
  }
  route.hash = "";
  return route.toString();
}

export function median(values) {
  if (!Array.isArray(values) || values.length === 0) fail("median requires a non-empty array");
  const sorted = values.map(Number).sort((a, b) => a - b);
  if (sorted.some((value) => !Number.isFinite(value))) fail("median requires finite numbers");
  const middle = Math.floor(sorted.length / 2);
  return sorted.length % 2 === 0 ? (sorted[middle - 1] + sorted[middle]) / 2 : sorted[middle];
}

export function medianAbsoluteDeviation(values) {
  const center = median(values);
  return median(values.map((value) => Math.abs(value - center)));
}

export function summarizeSceneTransitionSamples(samples, requiredSelectors) {
  if (!Array.isArray(samples) || samples.length === 0) {
    fail("scene transition samples must be a non-empty array");
  }
  if (
    !Array.isArray(requiredSelectors) ||
    requiredSelectors.length === 0 ||
    requiredSelectors.some((selector) => typeof selector !== "string" || selector.length === 0) ||
    new Set(requiredSelectors).size !== requiredSelectors.length
  ) {
    fail("scene transition selectors must be unique non-empty strings");
  }

  const firstVisibleAtMs = Object.fromEntries(
    requiredSelectors.map((selector) => [selector, null]),
  );
  let previousAt = -Infinity;
  let firstAnyVisibleAtMs = null;
  let firstAllVisibleAtMs = null;
  let partialStartedAtMs = null;
  let longestPartialSceneMs = 0;
  let disappearanceSamplesAfterComplete = 0;

  for (const [index, sample] of samples.entries()) {
    if (!Number.isFinite(sample?.at) || sample.at < previousAt) {
      fail(`scene transition sample ${index} timestamp must be finite and ordered`);
    }
    if (!sample.nodes || typeof sample.nodes !== "object" || Array.isArray(sample.nodes)) {
      fail(`scene transition sample ${index} nodes must be an object`);
    }
    previousAt = sample.at;

    const visibleSelectors = requiredSelectors.filter(
      (selector) => sample.nodes[selector]?.visible === true,
    );
    for (const selector of visibleSelectors) {
      if (firstVisibleAtMs[selector] === null) {
        firstVisibleAtMs[selector] = sample.at;
      }
    }

    const anyVisible = visibleSelectors.length > 0;
    const allVisible = visibleSelectors.length === requiredSelectors.length;
    const partial = anyVisible && !allVisible;
    if (anyVisible && firstAnyVisibleAtMs === null) firstAnyVisibleAtMs = sample.at;
    if (allVisible && firstAllVisibleAtMs === null) firstAllVisibleAtMs = sample.at;

    if (partial) {
      partialStartedAtMs ??= sample.at;
    } else if (partialStartedAtMs !== null) {
      longestPartialSceneMs = Math.max(
        longestPartialSceneMs,
        sample.at - partialStartedAtMs,
      );
      partialStartedAtMs = null;
    }

    if (firstAllVisibleAtMs !== null && sample.at > firstAllVisibleAtMs && !allVisible) {
      disappearanceSamplesAfterComplete += 1;
    }
  }

  if (partialStartedAtMs !== null) {
    longestPartialSceneMs = Math.max(
      longestPartialSceneMs,
      samples.at(-1).at - partialStartedAtMs,
    );
  }

  const missingSelectors = requiredSelectors.filter(
    (selector) => firstVisibleAtMs[selector] === null,
  );
  const visibleTimes = Object.values(firstVisibleAtMs).filter(Number.isFinite);
  const popInSpreadMs = missingSelectors.length === 0
    ? Math.max(...visibleTimes) - Math.min(...visibleTimes)
    : null;

  return {
    complete: firstAllVisibleAtMs !== null,
    disappearanceSamplesAfterComplete,
    firstAllVisibleAtMs,
    firstAnyVisibleAtMs,
    firstVisibleAtMs,
    longestPartialSceneMs,
    missingSelectors,
    popInSpreadMs,
    sampleCount: samples.length,
  };
}

export async function mapWithConcurrency(values, concurrency, mapper) {
  if (!Array.isArray(values)) fail("concurrent map values must be an array");
  if (!Number.isInteger(concurrency) || concurrency < 1) {
    fail("concurrent map limit must be a positive integer");
  }
  if (typeof mapper !== "function") fail("concurrent map requires a mapper");

  const results = new Array(values.length);
  let cursor = 0;
  const worker = async () => {
    while (cursor < values.length) {
      const index = cursor;
      cursor += 1;
      results[index] = await mapper(values[index], index);
    }
  };
  await Promise.all(
    Array.from({ length: Math.min(concurrency, values.length) }, () => worker())
  );
  return results;
}

export function waitForChildExit(child, timeoutMs) {
  if (!child || typeof child.once !== "function" || typeof child.kill !== "function") {
    fail("child process handle is invalid");
  }
  if (!Number.isFinite(timeoutMs) || timeoutMs < 1) fail("child exit timeout is invalid");
  if (child.exitCode !== null || child.signalCode !== null) {
    return Promise.resolve({ code: child.exitCode, signal: child.signalCode });
  }
  return new Promise((resolve, reject) => {
    let settled = false;
    const cleanup = () => {
      clearTimeout(timeout);
      child.removeListener?.("error", onError);
      child.removeListener?.("close", onClose);
    };
    const finish = (callback) => {
      if (settled) return;
      settled = true;
      cleanup();
      callback();
    };
    const onError = (error) => finish(() => reject(error));
    const onClose = (code, signal) => finish(() => resolve({ code, signal }));
    const timeout = setTimeout(() => {
      child.kill("SIGKILL");
      finish(() => reject(new Error("child process did not stop in time")));
    }, timeoutMs);
    child.once("error", onError);
    child.once("close", onClose);
  });
}

function nearestRankPercentile(values, percentile) {
  if (values.length === 0) return null;
  const sorted = values.map(Number).sort((a, b) => a - b);
  if (sorted.some((value) => !Number.isFinite(value))) fail("percentile requires finite numbers");
  const rank = Math.max(1, Math.ceil((percentile / 100) * sorted.length));
  return sorted[rank - 1];
}

export function summarizeOrbProbeSamples(samples) {
  if (!Array.isArray(samples)) fail("orb probe samples must be an array");
  const normalized = samples.map((sample, index) => {
    assertObject(sample, `orbProbe[${index}]`);
    assertFiniteNumber(sample.renderedAt, `orbProbe[${index}].renderedAt`);
    if (typeof sample.source !== "string" || sample.source.length === 0) {
      fail(`orbProbe[${index}].source is required`);
    }
    if (sample.postedAt !== undefined) {
      assertFiniteNumber(sample.postedAt, `orbProbe[${index}].postedAt`);
    }
    return sample;
  }).sort((a, b) => a.renderedAt - b.renderedAt);
  const frameIntervals = normalized.slice(1).map((sample, index) => sample.renderedAt - normalized[index].renderedAt);
  const workerAcks = normalized
    .filter((sample) => Number.isFinite(sample.postedAt))
    .map((sample) => sample.renderedAt - sample.postedAt)
    .filter((latency) => latency >= 0);
  const elapsedMs = normalized.length > 1
    ? normalized[normalized.length - 1].renderedAt - normalized[0].renderedAt
    : 0;

  return {
    frameCount: normalized.length,
    elapsedMs,
    presentedCadenceHz: elapsedMs > 0
      ? Number((((normalized.length - 1) * 1000) / elapsedMs).toFixed(6))
      : 0,
    gapsOver100Ms: frameIntervals.filter((interval) => interval > 100).length,
    frameIntervalP95Ms: nearestRankPercentile(frameIntervals, 95),
    frameIntervalP99Ms: nearestRankPercentile(frameIntervals, 99),
    workerAckCount: workerAcks.length,
    workerAckP95Ms: nearestRankPercentile(workerAcks, 95),
    workerAckP99Ms: nearestRankPercentile(workerAcks, 99),
    sources: [...new Set(normalized.map((sample) => sample.source))].sort(),
  };
}

export function summarizeLayerAttribution({
  viewport,
  layers,
  nodesByBackendId = {},
  reasonsByLayerId = {},
}) {
  assertObject(viewport, "layer viewport");
  assertFiniteNumber(viewport.width, "layer viewport width", { min: 0, exclusiveMin: true });
  assertFiniteNumber(viewport.height, "layer viewport height", { min: 0, exclusiveMin: true });
  const devicePixelRatio = viewport.devicePixelRatio ?? 1;
  assertFiniteNumber(devicePixelRatio, "layer viewport devicePixelRatio", {
    min: 0,
    exclusiveMin: true,
  });
  if (!Array.isArray(layers)) fail("layers must be an array");
  assertObject(nodesByBackendId, "nodesByBackendId");
  assertObject(reasonsByLayerId, "reasonsByLayerId");

  const normalized = layers.map((layer, index) => {
    assertObject(layer, `layers[${index}]`);
    if (typeof layer.layerId !== "string" || layer.layerId.length === 0) {
      fail(`layers[${index}].layerId is required`);
    }
    assertFiniteNumber(layer.width, `layers[${index}].width`, { min: 0 });
    assertFiniteNumber(layer.height, `layers[${index}].height`, { min: 0 });
    const backendNodeId = Number.isInteger(layer.backendNodeId) ? layer.backendNodeId : undefined;
    const node = backendNodeId === undefined ? undefined : nodesByBackendId[String(backendNodeId)];
    const reasons = reasonsByLayerId[layer.layerId];
    return {
      layerId: layer.layerId,
      parentLayerId: typeof layer.parentLayerId === "string" ? layer.parentLayerId : undefined,
      backendNodeId,
      selector: typeof node?.selector === "string" ? node.selector : null,
      width: layer.width,
      height: layer.height,
      estimatedPixels: Math.round(layer.width * layer.height),
      paintCount: Number.isInteger(layer.paintCount) ? layer.paintCount : 0,
      invisible: layer.invisible === true,
      drawsContent: layer.drawsContent === true,
      reasons: Array.isArray(reasons) ? reasons.filter((reason) => typeof reason === "string") : [],
      styles: isObject(node?.styles) ? node.styles : {},
    };
  });
  const drawingLayers = normalized
    .filter((layer) => layer.drawsContent)
    .sort((left, right) => right.estimatedPixels - left.estimatedPixels || left.layerId.localeCompare(right.layerId));
  const totalLayerPixels = normalized.reduce((sum, layer) => sum + layer.estimatedPixels, 0);
  const totalDrawingPixels = drawingLayers.reduce((sum, layer) => sum + layer.estimatedPixels, 0);
  const viewportPixels = viewport.width * viewport.height * devicePixelRatio * devicePixelRatio;
  const asRatio = (value) => Number((value / viewportPixels).toFixed(6));

  return {
    layerCount: normalized.length,
    drawingLayerCount: drawingLayers.length,
    totalLayerPixels,
    totalDrawingPixels,
    totalLayerAreaRatio: asRatio(totalLayerPixels),
    totalDrawingAreaRatio: asRatio(totalDrawingPixels),
    largestDrawingLayers: drawingLayers.slice(0, 25).map(({ drawsContent: _drawsContent, ...layer }) => layer),
  };
}

async function collectFiles(root, current = root) {
  const entries = await readdir(current, { withFileTypes: true });
  const files = [];
  for (const entry of entries.sort((a, b) => a.name.localeCompare(b.name))) {
    const absolute = path.join(current, entry.name);
    if (entry.isSymbolicLink()) fail(`symbolic links are not accepted: ${absolute}`);
    if (entry.isDirectory()) files.push(...(await collectFiles(root, absolute)));
    else if (entry.isFile()) files.push({ absolute, relative: path.relative(root, absolute).split(path.sep).join("/") });
  }
  return files;
}

async function hashFile(absolute, relative) {
  const data = await readFile(absolute);
  return {
    path: relative,
    bytes: data.byteLength,
    sha256: createHash("sha256").update(data).digest("hex"),
  };
}

export async function hashPath(inputPath) {
  const absolute = path.resolve(inputPath);
  const stat = await lstat(absolute);
  if (stat.isSymbolicLink()) fail(`symbolic links are not accepted: ${inputPath}`);
  if (stat.isFile()) {
    const file = await hashFile(absolute, path.basename(absolute));
    return { kind: "file", fileCount: 1, bytes: file.bytes, sha256: file.sha256, files: [file] };
  }
  if (!stat.isDirectory()) fail(`unsupported artifact type: ${inputPath}`);

  const files = await collectFiles(absolute);
  const hashed = [];
  for (const file of files) hashed.push(await hashFile(file.absolute, file.relative));
  const aggregate = createHash("sha256").update("zenflow-android-motion-artifacts-v1\0");
  for (const file of hashed) {
    aggregate.update(`${file.path}\0${file.bytes}\0${file.sha256}\n`);
  }
  return {
    kind: "directory",
    fileCount: hashed.length,
    bytes: hashed.reduce((sum, file) => sum + file.bytes, 0),
    sha256: aggregate.digest("hex"),
    files: hashed,
  };
}

function resolveInsideRoot(root, candidate, label) {
  if (typeof candidate !== "string" || candidate.length === 0) fail(`${label} is required`);
  const absolute = path.resolve(root, candidate);
  const relative = path.relative(root, absolute).split(path.sep).join("/");
  if (
    relative === "" ||
    relative === ".." ||
    relative.startsWith("../") ||
    path.isAbsolute(relative)
  ) {
    fail(`${label} must stay inside the source root`);
  }
  return { absolute, relative };
}

export async function buildSourceEvidence({
  root,
  gitHead,
  stagedDiffSha256,
  unstagedDiffSha256,
  dirtyPaths,
  buildInputPaths,
}) {
  const sourceRoot = path.resolve(root);
  if (!Array.isArray(dirtyPaths)) fail("source dirtyPaths must be an array");
  if (!Array.isArray(buildInputPaths) || buildInputPaths.length === 0) {
    fail("source buildInputPaths must be a non-empty array");
  }

  const buildInputs = [];
  const seenBuildInputs = new Set();
  const buildInputScopes = [];
  for (const inputPath of buildInputPaths) {
    const resolved = resolveInsideRoot(sourceRoot, inputPath, "build input path");
    if (seenBuildInputs.has(resolved.relative)) fail(`duplicate build input path ${resolved.relative}`);
    seenBuildInputs.add(resolved.relative);
    buildInputScopes.push(resolved.relative);
    const hashed = await hashPath(resolved.absolute);
    buildInputs.push({
      path: resolved.relative,
      bytes: hashed.bytes,
      sha256: hashed.sha256,
    });
  }

  const normalizedDirtyPaths = [];
  const untrackedInputs = [];
  const seenDirtyPaths = new Set();
  for (const entry of dirtyPaths) {
    assertObject(entry, "source dirty path");
    const resolved = resolveInsideRoot(sourceRoot, entry.path, "dirty path");
    if (seenDirtyPaths.has(resolved.relative)) fail(`duplicate dirty path ${resolved.relative}`);
    seenDirtyPaths.add(resolved.relative);
    if (typeof entry.status !== "string" || entry.status.length < 1 || entry.status.length > 4) {
      fail(`dirty path ${resolved.relative} status is invalid`);
    }
    let hashed = null;
    try {
      await lstat(resolved.absolute);
      hashed = await hashPath(resolved.absolute);
    } catch (error) {
      if (error?.code !== "ENOENT" || entry.status === "??") throw error;
    }
    const normalized = {
      path: resolved.relative,
      status: entry.status,
      ...(hashed ? { sha256: hashed.sha256 } : {}),
    };
    normalizedDirtyPaths.push(normalized);
    const isBuildInput = buildInputScopes.some(
      (scope) => resolved.relative === scope || resolved.relative.startsWith(`${scope}/`),
    );
    if (entry.status === "??" && hashed && isBuildInput) {
      untrackedInputs.push({
        path: resolved.relative,
        bytes: hashed.bytes,
        sha256: hashed.sha256,
      });
    }
  }

  const source = {
    gitHead,
    stagedDiffSha256,
    unstagedDiffSha256,
    dirtyPaths: normalizedDirtyPaths,
    buildInputs,
    untrackedInputs,
  };
  validateSourceV2(source);
  return source;
}

function validateEnvironment(environment) {
  const allowed = new Set([
    "deviceAlias", "kind", "api", "refreshHz", "webViewVersion", "gpu", "densityDpi",
    "thermalStatus", "batterySaver", "animationScale", "animationScales", "model", "abi",
    "resolutionPx", "locale", "theme", "collectedAt", "packageVersion", "packageVersionCode",
    "batteryTemperatureC", "skinTemperatureC",
  ]);
  const required = [
    "deviceAlias", "kind", "api", "refreshHz", "webViewVersion", "thermalStatus", "animationScale",
  ];
  assertExactKeys(environment, allowed, required, "environment");
  if (typeof environment.deviceAlias !== "string" || environment.deviceAlias.length === 0) fail("deviceAlias is required");
  if (!new Set(["emulator", "physical"]).has(environment.kind)) fail("environment kind is invalid");
  if (!Number.isInteger(environment.api) || environment.api < 26) fail("environment api must be >= 26");
  assertFiniteNumber(environment.refreshHz, "refreshHz", { min: 0, exclusiveMin: true });
  if (typeof environment.webViewVersion !== "string" || environment.webViewVersion.length === 0) fail("webViewVersion is required");
  if (
    environment.thermalStatus !== null &&
    (!Number.isInteger(environment.thermalStatus) || environment.thermalStatus < 0)
  ) {
    fail("thermalStatus is invalid");
  }
  if (environment.animationScale !== 1) fail("animationScale must be exactly 1");
  if (environment.densityDpi !== undefined && environment.densityDpi !== null && (!Number.isInteger(environment.densityDpi) || environment.densityDpi < 1)) fail("densityDpi is invalid");
  if (environment.batterySaver !== undefined && environment.batterySaver !== null && typeof environment.batterySaver !== "boolean") fail("batterySaver is invalid");
  if (environment.animationScales !== undefined) {
    assertExactKeys(environment.animationScales, new Set(["window", "transition", "animator"]), ["window", "transition", "animator"], "animationScales");
    for (const value of Object.values(environment.animationScales)) if (value !== 1) fail("all animation scales must be exactly 1");
  }
}

function validateArtifact(artifact, index) {
  assertExactKeys(artifact, new Set(["path", "sha256"]), ["path", "sha256"], `artifact[${index}]`);
  if (typeof artifact.path !== "string" || artifact.path.length === 0 || path.isAbsolute(artifact.path) || artifact.path.split(/[\\/]/).includes("..")) fail(`artifact[${index}] path must be relative`);
  if (typeof artifact.sha256 !== "string" || !SHA256.test(artifact.sha256)) fail(`artifact[${index}] sha256 is invalid`);
}

function validateManifestArtifact(artifact, index, label = "artifact") {
  assertExactKeys(
    artifact,
    new Set(["path", "bytes", "sha256"]),
    ["path", "bytes", "sha256"],
    `${label}[${index}]`,
  );
  if (
    typeof artifact.path !== "string" ||
    artifact.path.length === 0 ||
    path.isAbsolute(artifact.path) ||
    artifact.path.split(/[\\/]/).includes("..")
  ) {
    fail(`${label}[${index}] path must be relative`);
  }
  if (!Number.isInteger(artifact.bytes) || artifact.bytes < 0) {
    fail(`${label}[${index}] bytes must be a non-negative integer`);
  }
  assertSha256(artifact.sha256, `${label}[${index}] sha256`);
}

function validateSourceV2(source) {
  assertExactKeys(
    source,
    new Set([
      "gitHead",
      "stagedDiffSha256",
      "unstagedDiffSha256",
      "dirtyPaths",
      "buildInputs",
      "untrackedInputs",
    ]),
    [
      "gitHead",
      "stagedDiffSha256",
      "unstagedDiffSha256",
      "dirtyPaths",
      "buildInputs",
      "untrackedInputs",
    ],
    "source",
  );
  if (typeof source.gitHead !== "string" || !SHA40.test(source.gitHead)) {
    fail("source gitHead must be a 40-character lowercase Git SHA");
  }
  assertSha256(source.stagedDiffSha256, "source stagedDiffSha256");
  assertSha256(source.unstagedDiffSha256, "source unstagedDiffSha256");
  if (!Array.isArray(source.dirtyPaths)) fail("source dirtyPaths must be an array");
  source.dirtyPaths.forEach((entry, index) => {
    assertExactKeys(
      entry,
      new Set(["path", "status", "sha256"]),
      ["path", "status"],
      `source dirtyPaths[${index}]`,
    );
    if (
      typeof entry.path !== "string" ||
      entry.path.length === 0 ||
      path.isAbsolute(entry.path) ||
      entry.path.split(/[\\/]/).includes("..")
    ) {
      fail(`source dirtyPaths[${index}] path must be relative`);
    }
    if (typeof entry.status !== "string" || entry.status.length < 1 || entry.status.length > 4) {
      fail(`source dirtyPaths[${index}] status is invalid`);
    }
    if (entry.sha256 !== undefined) assertSha256(entry.sha256, `source dirtyPaths[${index}] sha256`);
  });
  for (const key of ["buildInputs", "untrackedInputs"]) {
    if (!Array.isArray(source[key])) fail(`source ${key} must be an array`);
    source[key].forEach((entry, index) => validateManifestArtifact(entry, index, `source ${key}`));
  }
}

function validateRunEnvironmentV2(environment, index) {
  const label = `runs[${index}] environment`;
  const keys = [
    "deviceAlias",
    "kind",
    "api",
    "abi",
    "model",
    "gpu",
    "webViewPackage",
    "webViewVersion",
    "resolutionPx",
    "densityDpi",
    "refreshHz",
    "orientation",
    "locale",
    "theme",
    "motion",
    "animationScales",
    "thermalStatus",
    "batterySaver",
    "charging",
    "availableMemoryBytes",
    "collectedAt",
  ];
  assertExactKeys(environment, new Set(keys), keys, label);
  if (typeof environment.deviceAlias !== "string" || environment.deviceAlias.length === 0) {
    fail(`${label} deviceAlias is required`);
  }
  if (!new Set(["emulator", "physical"]).has(environment.kind)) fail(`${label} kind is invalid`);
  if (!Number.isInteger(environment.api) || environment.api < 26) fail(`${label} api must be >= 26`);
  for (const key of ["abi", "model", "gpu", "webViewPackage", "webViewVersion", "resolutionPx", "orientation", "locale", "theme", "motion"]) {
    if (typeof environment[key] !== "string" || environment[key].length === 0) {
      fail(`${label} ${key} is required`);
    }
  }
  if (!SAFE_PACKAGE.test(environment.webViewPackage)) fail(`${label} webViewPackage is invalid`);
  if (!Number.isInteger(environment.densityDpi) || environment.densityDpi < 1) {
    fail(`${label} densityDpi is invalid`);
  }
  assertFiniteNumber(environment.refreshHz, `${label} refreshHz`, { min: 0, exclusiveMin: true });
  assertExactKeys(
    environment.animationScales,
    new Set(["window", "transition", "animator"]),
    ["window", "transition", "animator"],
    `${label} animationScales`,
  );
  for (const value of Object.values(environment.animationScales)) {
    if (value !== 1) fail(`${label} animation scales must all equal 1`);
  }
  if (
    environment.thermalStatus !== null &&
    (!Number.isInteger(environment.thermalStatus) || environment.thermalStatus < 0)
  ) {
    fail(`${label} thermalStatus is invalid`);
  }
  for (const key of ["batterySaver", "charging"]) {
    if (typeof environment[key] !== "boolean") fail(`${label} ${key} must be boolean`);
  }
  if (!Number.isInteger(environment.availableMemoryBytes) || environment.availableMemoryBytes < 1) {
    fail(`${label} availableMemoryBytes is invalid`);
  }
  assertDateTime(environment.collectedAt, `${label} collectedAt`);
}

export function validateRunEnvironmentEvidence(environment) {
  assertPrivacySafe(environment);
  validateRunEnvironmentV2(environment, 0);
  return environment;
}

export function assertRunArtifactIdentity(identity) {
  assertExactKeys(
    identity,
    new Set([
      "expectedSha256",
      "sourceSha256",
      "installedBeforeSha256",
      "installedAfterSha256",
      "packageName",
      "versionName",
      "versionCode",
    ]),
    [
      "expectedSha256",
      "sourceSha256",
      "installedBeforeSha256",
      "installedAfterSha256",
      "packageName",
      "versionName",
      "versionCode",
    ],
    "run artifact identity",
  );
  for (const key of [
    "expectedSha256",
    "sourceSha256",
    "installedBeforeSha256",
    "installedAfterSha256",
  ]) {
    assertSha256(identity[key], `run artifact identity ${key}`);
  }
  if (identity.sourceSha256 !== identity.expectedSha256) {
    fail("source APK does not match the expected APK");
  }
  if (identity.installedBeforeSha256 !== identity.expectedSha256) {
    fail("installed APK before the run does not match the expected APK");
  }
  if (identity.installedAfterSha256 !== identity.expectedSha256) {
    fail("installed APK changed during the run");
  }
  if (identity.packageName !== "com.zenflow.app") fail("packageName must be com.zenflow.app");
  if (identity.versionName !== "2.1.1") fail("versionName must be 2.1.1");
  if (identity.versionCode !== 38) fail("versionCode 38 is required");
  return identity;
}

function validateCandidateV2(candidate) {
  assertExactKeys(candidate, new Set(["id", "status", "apk"]), ["id", "status", "apk"], "candidate");
  if (typeof candidate.id !== "string" || !SAFE_CANDIDATE_ID.test(candidate.id)) {
    fail("artifact id must be candidate24 or higher, or prechange-baseline-N");
  }
  if (!new Set(["FIXED", "FAIL", "REJECTED", "UNVERIFIED"]).has(candidate.status)) {
    fail("candidate status is invalid");
  }
  const apkKeys = [
    "path",
    "bytes",
    "sha256",
    "installedBeforeSha256",
    "installedAfterSha256",
    "packageName",
    "versionName",
    "versionCode",
    "signingCertificateSha256",
    "lastUpdateTime",
  ];
  assertExactKeys(candidate.apk, new Set(apkKeys), apkKeys, "candidate apk");
  validateManifestArtifact(
    { path: candidate.apk.path, bytes: candidate.apk.bytes, sha256: candidate.apk.sha256 },
    0,
    "candidate apk",
  );
  assertSha256(candidate.apk.installedBeforeSha256, "candidate apk installedBeforeSha256");
  assertSha256(candidate.apk.installedAfterSha256, "candidate apk installedAfterSha256");
  if (
    candidate.apk.sha256 !== candidate.apk.installedBeforeSha256 ||
    candidate.apk.sha256 !== candidate.apk.installedAfterSha256
  ) {
    fail("candidate APK source and installed SHA-256 values must match");
  }
  if (typeof candidate.apk.packageName !== "string" || !SAFE_PACKAGE.test(candidate.apk.packageName)) {
    fail("candidate apk packageName is invalid");
  }
  if (typeof candidate.apk.versionName !== "string" || candidate.apk.versionName.length === 0) {
    fail("candidate apk versionName is required");
  }
  if (!Number.isInteger(candidate.apk.versionCode) || candidate.apk.versionCode < 1) {
    fail("candidate apk versionCode is invalid");
  }
  assertSha256(candidate.apk.signingCertificateSha256, "candidate apk signingCertificateSha256");
  if (typeof candidate.apk.lastUpdateTime !== "string" || candidate.apk.lastUpdateTime.length === 0) {
    fail("candidate apk lastUpdateTime is required");
  }
}

function validateRunV2(run, index, candidateApkSha256) {
  const allowed = new Set([
    "runId",
    "scenario",
    "pass",
    "status",
    "startedAt",
    "endedAt",
    "environment",
    "installedBeforeSha256",
    "installedAfterSha256",
    "actions",
    "symptom",
    "attribution",
    "rootCause",
    "fix",
    "metrics",
    "artifacts",
  ]);
  const required = [
    "runId",
    "scenario",
    "pass",
    "status",
    "startedAt",
    "endedAt",
    "environment",
    "installedBeforeSha256",
    "installedAfterSha256",
    "artifacts",
  ];
  assertExactKeys(run, allowed, required, `runs[${index}]`);
  if (typeof run.runId !== "string" || run.runId.length === 0) fail(`runs[${index}] runId is required`);
  if (typeof run.scenario !== "string" || run.scenario.length === 0) fail(`runs[${index}] scenario is required`);
  if (!new Set(["javascript", "perfetto", "visual", "correlation", "compatibility"]).has(run.pass)) {
    fail(`runs[${index}] pass is invalid`);
  }
  if (!new Set(["FIXED", "FAIL", "REJECTED", "NOT_REPRODUCIBLE", "UNVERIFIED"]).has(run.status)) {
    fail(`runs[${index}] status is invalid`);
  }
  assertDateTime(run.startedAt, `runs[${index}] startedAt`);
  assertDateTime(run.endedAt, `runs[${index}] endedAt`);
  if (Date.parse(run.endedAt) < Date.parse(run.startedAt)) fail(`runs[${index}] endedAt precedes startedAt`);
  validateRunEnvironmentV2(run.environment, index);
  assertSha256(run.installedBeforeSha256, `runs[${index}] installedBeforeSha256`);
  assertSha256(run.installedAfterSha256, `runs[${index}] installedAfterSha256`);
  if (
    run.installedBeforeSha256 !== candidateApkSha256 ||
    run.installedAfterSha256 !== candidateApkSha256
  ) {
    fail(`runs[${index}] installed APK SHA-256 does not match the candidate`);
  }
  if (run.actions !== undefined) validateManifestArtifact(run.actions, 0, `runs[${index}] actions`);
  if (!Array.isArray(run.artifacts)) fail(`runs[${index}] artifacts must be an array`);
  run.artifacts.forEach((entry, artifactIndex) =>
    validateManifestArtifact(entry, artifactIndex, `runs[${index}] artifacts`),
  );
}

function validateCompletionV2(completion) {
  const keys = [
    "emulatorApi36",
    "emulatorApi26",
    "physical60Hz",
    "physicalHighRefresh",
    "visualCritic",
    "userReview",
  ];
  assertExactKeys(completion, new Set(keys), keys, "completion");
  for (const key of keys.slice(0, 5)) {
    if (!new Set(["PASS", "FAIL", "UNVERIFIED"]).has(completion[key])) {
      fail(`completion ${key} status is invalid`);
    }
  }
  if (!new Set(["ACCEPTED", "REJECTED", "UNVERIFIED"]).has(completion.userReview)) {
    fail("completion userReview status is invalid");
  }
}

function validateEvidenceLedgerV2(ledger) {
  assertExactKeys(
    ledger,
    new Set(["schemaVersion", "source", "candidate", "runs", "completion"]),
    ["schemaVersion", "source", "candidate", "runs", "completion"],
    "ledger",
  );
  validateSourceV2(ledger.source);
  validateCandidateV2(ledger.candidate);
  if (!Array.isArray(ledger.runs)) fail("runs must be an array");
  ledger.runs.forEach((run, index) => validateRunV2(run, index, ledger.candidate.apk.sha256));
  validateCompletionV2(ledger.completion);
  return ledger;
}

function validateRun(run, index) {
  const allowed = new Set(["runId", "scenario", "pass", "startedAt", "endedAt", "status", "symptom", "attribution", "rootCause", "fix", "metrics", "artifacts"]);
  assertExactKeys(run, allowed, ["runId", "scenario", "pass", "startedAt", "status", "artifacts"], `runs[${index}]`);
  if (typeof run.runId !== "string" || run.runId.length === 0) fail(`runs[${index}] runId is required`);
  if (typeof run.scenario !== "string" || run.scenario.length === 0) fail(`runs[${index}] scenario is required`);
  if (!new Set(["javascript", "perfetto", "visual"]).has(run.pass)) fail(`runs[${index}] pass is invalid`);
  if (Number.isNaN(Date.parse(run.startedAt))) fail(`runs[${index}] startedAt is invalid`);
  if (run.endedAt !== undefined && run.endedAt !== null && Number.isNaN(Date.parse(run.endedAt))) fail(`runs[${index}] endedAt is invalid`);
  if (!new Set(["FIXED", "NOT_REPRODUCIBLE", "UNVERIFIED"]).has(run.status)) fail(`runs[${index}] status is invalid`);
  if (!Array.isArray(run.artifacts)) fail(`runs[${index}] artifacts must be an array`);
  run.artifacts.forEach(validateArtifact);
}

export function validateEvidenceLedger(ledger) {
  assertPrivacySafe(ledger);
  if (ledger?.schemaVersion === 2) return validateEvidenceLedgerV2(ledger);
  assertExactKeys(ledger, new Set(["schemaVersion", "baselineSha", "environment", "runs"]), ["schemaVersion", "baselineSha", "environment", "runs"], "ledger");
  if (ledger.schemaVersion !== 1) fail("schemaVersion must be 1");
  if (typeof ledger.baselineSha !== "string" || !SHA40.test(ledger.baselineSha)) fail("baselineSha must be a 40-character lowercase Git SHA");
  validateEnvironment(ledger.environment);
  if (!Array.isArray(ledger.runs)) fail("runs must be an array");
  ledger.runs.forEach(validateRun);
  return ledger;
}

export function parseTraceProcessorCsv(csv) {
  const rows = [];
  let row = [];
  let cell = "";
  let quoted = false;
  for (let index = 0; index < csv.length; index += 1) {
    const char = csv[index];
    if (quoted) {
      if (char === '"' && csv[index + 1] === '"') {
        cell += '"';
        index += 1;
      } else if (char === '"') quoted = false;
      else cell += char;
    } else if (char === '"') quoted = true;
    else if (char === ",") {
      row.push(cell);
      cell = "";
    } else if (char === "\n") {
      row.push(cell.replace(/\r$/, ""));
      rows.push(row);
      row = [];
      cell = "";
    } else cell += char;
  }
  if (cell.length > 0 || row.length > 0) {
    row.push(cell);
    rows.push(row);
  }
  if (rows.length < 2) return [];
  const [headers, ...data] = rows;
  return data.filter((values) => values.some((value) => value !== "")).map((values) => Object.fromEntries(headers.map((header, index) => [header, values[index] ?? ""])));
}

export function buildTraceSummaryQueries(packageName) {
  if (typeof packageName !== "string" || !SAFE_PACKAGE.test(packageName)) fail("package name is invalid");
  const processFilter = `p.name='${packageName}'`;
  return {
    frameTimeline: `WITH app AS (SELECT upid FROM process p WHERE ${processFilter} LIMIT 1), frames AS (SELECT ts,dur,jank_type,LAG(ts) OVER (ORDER BY ts) AS previous_ts FROM actual_frame_timeline_slice WHERE upid=(SELECT upid FROM app)) SELECT COUNT(*) AS appFrames,ROUND((MAX(ts)-MIN(ts))/1e9,6) AS spanSeconds,ROUND(COUNT(*)/((MAX(ts)-MIN(ts))/1e9),6) AS presentedFps,SUM(CASE WHEN INSTR(jank_type,'App Deadline Missed')>0 THEN 1 ELSE 0 END) AS appDeadlineMissed,ROUND(100.0*SUM(CASE WHEN INSTR(jank_type,'App Deadline Missed')>0 THEN 1 ELSE 0 END)/COUNT(*),6) AS appDeadlineMissedPct,SUM(CASE WHEN dur>103000000 THEN 1 ELSE 0 END) AS framesOver103Ms,ROUND(AVG(dur)/1e6,6) AS averageFrameTimelineDurationMs,ROUND(PERCENTILE(dur/1e6,95),6) AS p95FrameTimelineDurationMs,ROUND(PERCENTILE(dur/1e6,99),6) AS p99FrameTimelineDurationMs,ROUND(MAX(dur)/1e6,6) AS maxFrameTimelineDurationMs,SUM(CASE WHEN previous_ts IS NOT NULL AND ts-previous_ts>100000000 THEN 1 ELSE 0 END) AS presentationTimestampGapsOver100Ms FROM frames;`,
    webViewDraw: `SELECT COUNT(*) AS drawCount,ROUND(AVG(s.dur)/1e6,6) AS averageWebViewDrawMs,ROUND(PERCENTILE(s.dur/1e6,95),6) AS p95WebViewDrawMs,ROUND(PERCENTILE(s.dur/1e6,99),6) AS p99WebViewDrawMs,ROUND(MAX(s.dur)/1e6,6) AS maxWebViewDrawMs FROM slice s JOIN thread_track tt ON s.track_id=tt.id JOIN thread t USING(utid) JOIN process p USING(upid) WHERE ${processFilter} AND t.name='RenderThread' AND s.name='WebViewFunctor::drawGl';`,
    threadCpu: `SELECT t.name AS thread,ROUND(SUM(s.dur)/1e9,6) AS cpuSeconds FROM sched_slice s JOIN thread t USING(utid) JOIN process p USING(upid) WHERE ${processFilter} AND t.name IN ('RenderThread','${packageName}','VizWebView','Chrome_InProcGp') GROUP BY t.name ORDER BY cpuSeconds DESC;`,
  };
}
