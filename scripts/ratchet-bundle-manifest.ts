import {
  existsSync,
  lstatSync,
  mkdirSync,
  readFileSync,
  realpathSync,
  readdirSync,
  renameSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createHash, randomUUID } from "node:crypto";
import { createRequire } from "node:module";
import { dirname, extname, isAbsolute, join, relative, resolve, sep } from "node:path";

const require = createRequire(import.meta.url);
const { hasDuplicateArtifactOrdinal } = require("./duplicate-artifact-policy.cjs") as {
  hasDuplicateArtifactOrdinal: (name: string) => boolean;
};

export const RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH =
  "dist/.zenflow-ratchet-production-web-manifest.json";

const BUILD_STATE_DIRECTORY_RELATIVE_PATH = "node_modules/.cache/zenflow-ratchet";
const BUILD_STATE_RELATIVE_PATH = `${BUILD_STATE_DIRECTORY_RELATIVE_PATH}/production-web-build-start.json`;
const BUILD_CLEAN_SENTINEL_RELATIVE_PATH = "dist/.zenflow-ratchet-build-must-clean";
const MANIFEST_PRODUCER = "zenflow-ratchet-production-web-v1";
const SHA256_PATTERN = /^[a-f0-9]{64}$/;
const ROOT_BUILD_FILES = new Set([
  ".env",
  ".env.local",
  ".env.production",
  ".env.production.local",
  "CHANGELOG.md",
  "components.json",
  "index.html",
  "package-lock.json",
  "package.json",
  "postcss.config.js",
  "tailwind.config.ts",
  "tsconfig.app.json",
  "tsconfig.eslint.json",
  "tsconfig.json",
  "tsconfig.node.json",
  "vite-plugin-changelog.ts",
  "vite-plugin-version.ts",
  "vite.config.ts",
]);
const EXTRA_BUILD_FILES = ["config/brand-logo-assets.json"];
const OPTIONAL_BUILD_DIRECTORIES = ["src", "public", "pages", "components", "app"];

type BuildEnvironment = Record<string, string | undefined>;

export interface RatchetBundleFileEvidence {
  path: string;
  sizeBytes: number;
  sha256: string;
}

export interface ProductionWebBundleManifest {
  schemaVersion: 1;
  producer: typeof MANIFEST_PRODUCER;
  target: "web";
  mode: "production";
  distRoot: "dist";
  completed: true;
  buildId: string;
  startedAt: string;
  completedAt: string;
  buildInputsSha256: string;
  artifactsSha256: string;
  bundleSizeBytes: number;
  files: RatchetBundleFileEvidence[];
}

interface ProductionWebBuildState {
  schemaVersion: 1;
  target: "web";
  mode: "production";
  buildId: string;
  startedAt: string;
  buildInputsSha256: string;
}

interface ProductionWebManifestOptions {
  rootDir: string;
  target: string;
  mode: string;
  env?: BuildEnvironment;
}

interface ValidateProductionWebManifestOptions {
  rootDir: string;
  env?: BuildEnvironment;
  afterFirstArtifactPass?: () => void;
}

interface RatchetBundleManifestCliOptions {
  argv: string[];
  rootDir: string;
  env?: BuildEnvironment;
}

export class RatchetBundleEvidenceError extends Error {
  constructor(message: string) {
    super(`RATCHET BUNDLE EVIDENCE: ${message}`);
    this.name = "RatchetBundleEvidenceError";
  }
}

function fail(message: string): never {
  throw new RatchetBundleEvidenceError(message);
}

function sha256(bytes: string | Buffer): string {
  return createHash("sha256").update(bytes).digest("hex");
}

function assertProductionWebContext(target: string, mode: string, env: BuildEnvironment): void {
  if (target !== "web") {
    fail(`target must be web, received ${JSON.stringify(target)}`);
  }
  if (mode !== "production") {
    fail(`mode must be production, received ${JSON.stringify(mode)}`);
  }
  if (env.CAPACITOR_BUILD === "true") {
    fail("target web cannot be produced with CAPACITOR_BUILD=true");
  }
}

function assertInsideRoot(rootDir: string, filePath: string): void {
  const relativePath = relative(rootDir, filePath);
  if (
    relativePath === "" ||
    (!relativePath.startsWith(`..${sep}`) && relativePath !== ".." && !isAbsolute(relativePath))
  ) {
    return;
  }
  fail(`path escapes the repository root: ${filePath}`);
}

function assertRealDistDirectory(rootDir: string, { create }: { create: boolean }): string {
  const distDir = join(rootDir, "dist");
  assertInsideRoot(rootDir, distDir);

  if (!existsSync(distDir) && create) {
    try {
      mkdirSync(distDir);
    } catch (error) {
      if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
        fail("dist could not be created as a real directory inside the repository");
      }
    }
  }

  let stat;
  try {
    stat = lstatSync(distDir);
  } catch {
    fail("dist must be a real directory inside the repository");
  }
  if (!stat.isDirectory() || stat.isSymbolicLink()) {
    fail("dist must be a real directory inside the repository, not a symbolic link");
  }

  let canonicalDistDir: string;
  try {
    canonicalDistDir = realpathSync(distDir);
  } catch {
    fail("dist could not be canonicalized inside the repository");
  }
  assertInsideRoot(rootDir, canonicalDistDir);
  if (canonicalDistDir !== distDir) {
    fail("dist must not traverse a symbolic link outside the repository");
  }
  return distDir;
}

function assertRealBuildStateDirectory(rootDir: string, { create }: { create: boolean }): string {
  let currentDirectory = rootDir;
  for (const segment of BUILD_STATE_DIRECTORY_RELATIVE_PATH.split("/")) {
    currentDirectory = join(currentDirectory, segment);
    assertInsideRoot(rootDir, currentDirectory);
    if (!existsSync(currentDirectory) && create) {
      try {
        mkdirSync(currentDirectory, { mode: 0o700 });
      } catch (error) {
        if ((error as NodeJS.ErrnoException).code !== "EEXIST") {
          fail("build state directory could not be created inside the repository");
        }
      }
    }

    let stat;
    try {
      stat = lstatSync(currentDirectory);
    } catch {
      fail("build state directory must be a real directory inside the repository");
    }
    if (!stat.isDirectory() || stat.isSymbolicLink()) {
      fail("build state directory must be a real directory, not a symbolic link");
    }

    let canonicalDirectory: string;
    try {
      canonicalDirectory = realpathSync(currentDirectory);
    } catch {
      fail("build state directory could not be canonicalized inside the repository");
    }
    assertInsideRoot(rootDir, canonicalDirectory);
    if (canonicalDirectory !== currentDirectory) {
      fail("build state directory must not traverse a symbolic link outside the repository");
    }
  }
  return currentDirectory;
}

function stableRead(filePath: string): Buffer {
  const before = lstatSync(filePath, { bigint: true });
  if (!before.isFile() || before.isSymbolicLink()) {
    fail(`expected a regular file without symlinks: ${filePath}`);
  }

  const bytes = readFileSync(filePath);
  const after = lstatSync(filePath, { bigint: true });
  const changed =
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeNs !== after.mtimeNs ||
    before.ctimeNs !== after.ctimeNs ||
    BigInt(bytes.byteLength) !== after.size;

  if (changed) {
    fail(`artifacts changed while being validated: ${filePath}`);
  }
  return bytes;
}

function assertNoDuplicateArtifactPath(rootDir: string, filePath: string): void {
  const artifactPath = relative(rootDir, filePath).split(sep).join("/");
  if (artifactPath.split("/").some(hasDuplicateArtifactOrdinal)) {
    fail(`duplicate generated artifact path is not allowed: ${artifactPath}`);
  }
}

function walkRegularFiles(
  rootDir: string,
  startPath: string,
  { rejectDuplicateArtifacts = false }: { rejectDuplicateArtifacts?: boolean } = {}
): string[] {
  if (!existsSync(startPath)) return [];
  assertInsideRoot(rootDir, startPath);

  const startStat = lstatSync(startPath);
  if (startStat.isSymbolicLink()) fail(`symlinked build input is not allowed: ${startPath}`);
  if (startStat.isFile()) return [startPath];
  if (!startStat.isDirectory()) fail(`unsupported build input type: ${startPath}`);

  const files: string[] = [];
  const visit = (directory: string): void => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((a, b) =>
      a.name.localeCompare(b.name)
    );
    for (const entry of entries) {
      const filePath = join(directory, entry.name);
      assertInsideRoot(rootDir, filePath);
      if (rejectDuplicateArtifacts) assertNoDuplicateArtifactPath(rootDir, filePath);
      if (entry.isSymbolicLink()) fail(`symlinked build input is not allowed: ${filePath}`);
      if (entry.isDirectory()) {
        visit(filePath);
      } else if (entry.isFile()) {
        files.push(filePath);
      } else {
        fail(`unsupported build input type: ${filePath}`);
      }
    }
  };
  visit(startPath);
  return files;
}

function buildEnvironmentFingerprint(env: BuildEnvironment): string {
  const relevantEnvironment = Object.entries(env)
    .filter(
      ([name]) =>
        name === "CAPACITOR_BUILD" ||
        name === "NODE_ENV" ||
        name === "SENTRY_AUTH_TOKEN" ||
        name === "SENTRY_ORG" ||
        name === "SENTRY_PROJECT" ||
        name.startsWith("VITE_")
    )
    .sort(([left], [right]) => left.localeCompare(right))
    .map(([name, value]) => `${name}\0${value ?? ""}\n`)
    .join("");
  return sha256(relevantEnvironment);
}

export function computeProductionWebBuildInputsSha256(
  rootDirInput: string,
  env: BuildEnvironment = process.env
): string {
  const rootDir = realpathSync(resolve(rootDirInput));
  const files = [
    ...OPTIONAL_BUILD_DIRECTORIES.flatMap((name) => walkRegularFiles(rootDir, join(rootDir, name))),
    ...[...ROOT_BUILD_FILES]
      .map((name) => join(rootDir, name))
      .filter((filePath) => existsSync(filePath)),
    ...EXTRA_BUILD_FILES.map((name) => join(rootDir, name)).filter((filePath) =>
      existsSync(filePath)
    ),
  ];

  const uniqueFiles = [...new Set(files)].sort((left, right) => left.localeCompare(right));
  if (uniqueFiles.length === 0) fail("no production-web build inputs were found");

  const digest = createHash("sha256");
  digest.update(`environment\0${buildEnvironmentFingerprint(env)}\n`);
  for (const filePath of uniqueFiles) {
    const relativePath = relative(rootDir, filePath).split(sep).join("/");
    const bytes = stableRead(filePath);
    digest.update(`${relativePath}\0${bytes.byteLength}\0${sha256(bytes)}\n`);
  }
  return digest.digest("hex");
}

function collectJavaScriptArtifacts(rootDirInput: string): RatchetBundleFileEvidence[] {
  const rootDir = realpathSync(resolve(rootDirInput));
  const distDir = join(rootDir, "dist");
  const assetsDir = join(rootDir, "dist", "assets");
  walkRegularFiles(rootDir, distDir, { rejectDuplicateArtifacts: true });
  if (!existsSync(assetsDir)) fail("dist/assets is missing");

  const assetsStat = lstatSync(assetsDir);
  if (!assetsStat.isDirectory() || assetsStat.isSymbolicLink()) {
    fail("dist/assets must be a real directory without symlinks");
  }

  const files = walkRegularFiles(rootDir, assetsDir, { rejectDuplicateArtifacts: true })
    .filter((filePath) => extname(filePath) === ".js")
    .sort((left, right) => left.localeCompare(right));
  if (files.length === 0) fail("no non-empty JavaScript artifacts were found in dist/assets");

  return files.map((filePath) => {
    const bytes = stableRead(filePath);
    if (bytes.byteLength === 0) {
      fail(`no non-empty JavaScript artifacts: ${relative(rootDir, filePath)}`);
    }
    return {
      path: relative(join(rootDir, "dist"), filePath).split(sep).join("/"),
      sizeBytes: bytes.byteLength,
      sha256: sha256(bytes),
    };
  });
}

function artifactSnapshotSha256(files: RatchetBundleFileEvidence[]): string {
  return sha256(files.map((file) => `${file.path}\0${file.sizeBytes}\0${file.sha256}\n`).join(""));
}

function assertSameArtifactSnapshot(
  first: RatchetBundleFileEvidence[],
  second: RatchetBundleFileEvidence[]
): void {
  if (JSON.stringify(first) !== JSON.stringify(second)) {
    fail("artifacts changed while being validated");
  }
}

function writeJsonAtomically(
  rootDir: string,
  filePath: string,
  value: unknown,
  mode = 0o644
): void {
  assertInsideRoot(rootDir, filePath);
  const parentDirectory = dirname(filePath);
  const parentStat = lstatSync(parentDirectory);
  if (!parentStat.isDirectory() || parentStat.isSymbolicLink()) {
    fail(`JSON output parent must be a real directory: ${parentDirectory}`);
  }
  const canonicalParent = realpathSync(parentDirectory);
  assertInsideRoot(rootDir, canonicalParent);
  if (canonicalParent !== parentDirectory) {
    fail(`JSON output parent must not traverse a symbolic link: ${parentDirectory}`);
  }
  const temporaryPath = `${filePath}.${process.pid}.${randomUUID()}.tmp`;
  writeFileSync(temporaryPath, `${JSON.stringify(value, null, 2)}\n`, {
    flag: "wx",
    mode,
  });
  const parentBeforeRename = realpathSync(parentDirectory);
  if (parentBeforeRename !== canonicalParent) {
    fail(`JSON output parent changed before rename: ${parentDirectory}`);
  }
  renameSync(temporaryPath, filePath);
}

function parseJsonObject(filePath: string, label: string): Record<string, unknown> {
  let value: unknown;
  try {
    value = JSON.parse(stableRead(filePath).toString("utf8"));
  } catch (error) {
    if (error instanceof RatchetBundleEvidenceError) throw error;
    fail(`${label} is not valid JSON: ${error instanceof Error ? error.message : String(error)}`);
  }
  if (!value || typeof value !== "object" || Array.isArray(value)) {
    fail(`${label} must be a JSON object`);
  }
  return value as Record<string, unknown>;
}

function requireString(value: unknown, label: string): string {
  if (typeof value !== "string" || value.length === 0) fail(`${label} must be a non-empty string`);
  return value;
}

function requireIsoTimestamp(value: unknown, label: string): string {
  const timestamp = requireString(value, label);
  if (!/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}\.\d{3}Z$/.test(timestamp)) {
    fail(`${label} must be a canonical UTC timestamp`);
  }
  return timestamp;
}

function parseBuildState(value: Record<string, unknown>): ProductionWebBuildState {
  if (value.schemaVersion !== 1) fail("build state schemaVersion must be 1");
  if (value.target !== "web") fail("build state target must be web");
  if (value.mode !== "production") fail("build state mode must be production");
  const buildId = requireString(value.buildId, "build state buildId");
  const startedAt = requireIsoTimestamp(value.startedAt, "build state startedAt");
  const buildInputsSha256 = requireString(value.buildInputsSha256, "build state buildInputsSha256");
  if (!SHA256_PATTERN.test(buildInputsSha256)) {
    fail("build state buildInputsSha256 must be SHA-256");
  }
  return {
    schemaVersion: 1,
    target: "web",
    mode: "production",
    buildId,
    startedAt,
    buildInputsSha256,
  };
}

function parseManifest(value: Record<string, unknown>): ProductionWebBundleManifest {
  if (value.schemaVersion !== 1) fail("bundle manifest schemaVersion must be 1");
  if (value.producer !== MANIFEST_PRODUCER)
    fail(`bundle manifest producer must be ${MANIFEST_PRODUCER}`);
  if (value.target !== "web") fail("bundle manifest target must be web");
  if (value.mode !== "production") fail("bundle manifest mode must be production");
  if (value.distRoot !== "dist") fail("bundle manifest distRoot must be dist");
  if (value.completed !== true) fail("bundle manifest completed must be true");

  const buildId = requireString(value.buildId, "bundle manifest buildId");
  const startedAt = requireIsoTimestamp(value.startedAt, "bundle manifest startedAt");
  const completedAt = requireIsoTimestamp(value.completedAt, "bundle manifest completedAt");
  if (Date.parse(completedAt) < Date.parse(startedAt)) {
    fail("bundle manifest completedAt precedes startedAt");
  }

  const buildInputsSha256 = requireString(
    value.buildInputsSha256,
    "bundle manifest buildInputsSha256"
  );
  const artifactsSha256 = requireString(value.artifactsSha256, "bundle manifest artifactsSha256");
  if (!SHA256_PATTERN.test(buildInputsSha256) || !SHA256_PATTERN.test(artifactsSha256)) {
    fail("bundle manifest fingerprints must be SHA-256");
  }
  if (!Number.isSafeInteger(value.bundleSizeBytes) || (value.bundleSizeBytes as number) <= 0) {
    fail("bundle manifest bundleSizeBytes must be a positive safe integer");
  }
  if (!Array.isArray(value.files) || value.files.length === 0) {
    fail("bundle manifest files must be a non-empty array");
  }

  const files = value.files.map((rawFile, index): RatchetBundleFileEvidence => {
    if (!rawFile || typeof rawFile !== "object" || Array.isArray(rawFile)) {
      fail(`bundle manifest files[${index}] must be an object`);
    }
    const file = rawFile as Record<string, unknown>;
    const artifactPath = requireString(file.path, `bundle manifest files[${index}].path`);
    if (
      isAbsolute(artifactPath) ||
      artifactPath.includes("\\") ||
      artifactPath.split("/").includes("..") ||
      !/^assets\/.+\.js$/.test(artifactPath)
    ) {
      fail(`bundle manifest artifact path is invalid: ${artifactPath}`);
    }
    if (!Number.isSafeInteger(file.sizeBytes) || (file.sizeBytes as number) <= 0) {
      fail(`bundle manifest artifact size is invalid: ${artifactPath}`);
    }
    const artifactSha256 = requireString(file.sha256, `bundle manifest files[${index}].sha256`);
    if (!SHA256_PATTERN.test(artifactSha256)) {
      fail(`bundle manifest artifact hash is invalid: ${artifactPath}`);
    }
    return {
      path: artifactPath,
      sizeBytes: file.sizeBytes as number,
      sha256: artifactSha256,
    };
  });

  const sortedPaths = files
    .map((file) => file.path)
    .sort((left, right) => left.localeCompare(right));
  if (new Set(sortedPaths).size !== sortedPaths.length)
    fail("bundle manifest contains duplicate artifacts");
  if (JSON.stringify(files.map((file) => file.path)) !== JSON.stringify(sortedPaths)) {
    fail("bundle manifest files must be sorted by path");
  }

  return {
    schemaVersion: 1,
    producer: MANIFEST_PRODUCER,
    target: "web",
    mode: "production",
    distRoot: "dist",
    completed: true,
    buildId,
    startedAt,
    completedAt,
    buildInputsSha256,
    artifactsSha256,
    bundleSizeBytes: value.bundleSizeBytes as number,
    files,
  };
}

export function beginProductionWebBundleManifest(options: ProductionWebManifestOptions): void {
  const env = options.env ?? process.env;
  assertProductionWebContext(options.target, options.mode, env);
  const rootDir = realpathSync(resolve(options.rootDir));
  assertRealDistDirectory(rootDir, { create: true });
  const startedAt = new Date().toISOString();
  const state: ProductionWebBuildState = {
    schemaVersion: 1,
    target: "web",
    mode: "production",
    buildId: randomUUID(),
    startedAt,
    buildInputsSha256: computeProductionWebBuildInputsSha256(rootDir, env),
  };

  assertRealBuildStateDirectory(rootDir, { create: true });
  writeJsonAtomically(rootDir, join(rootDir, BUILD_STATE_RELATIVE_PATH), state, 0o600);
  assertRealDistDirectory(rootDir, { create: false });
  writeJsonAtomically(rootDir, join(rootDir, BUILD_CLEAN_SENTINEL_RELATIVE_PATH), {
    buildId: state.buildId,
    startedAt,
    requiredAction: "production web build must clean dist before emitting artifacts",
  });
}

export function completeProductionWebBundleManifest(
  options: ProductionWebManifestOptions
): ProductionWebBundleManifest {
  const env = options.env ?? process.env;
  assertProductionWebContext(options.target, options.mode, env);
  const rootDir = realpathSync(resolve(options.rootDir));
  assertRealDistDirectory(rootDir, { create: false });
  assertRealBuildStateDirectory(rootDir, { create: false });
  const statePath = join(rootDir, BUILD_STATE_RELATIVE_PATH);
  const sentinelPath = join(rootDir, BUILD_CLEAN_SENTINEL_RELATIVE_PATH);

  if (!existsSync(statePath)) fail("production-web build start state is missing");
  const state = parseBuildState(parseJsonObject(statePath, "production-web build start state"));
  if (existsSync(sentinelPath)) {
    fail("output directory was not cleaned after the production-web build began");
  }

  const currentBuildInputsSha256 = computeProductionWebBuildInputsSha256(rootDir, env);
  if (currentBuildInputsSha256 !== state.buildInputsSha256) {
    fail("build input fingerprint changed while the production-web build was running");
  }

  const firstArtifacts = collectJavaScriptArtifacts(rootDir);
  const secondArtifacts = collectJavaScriptArtifacts(rootDir);
  assertSameArtifactSnapshot(firstArtifacts, secondArtifacts);
  const bundleSizeBytes = secondArtifacts.reduce((total, file) => total + file.sizeBytes, 0);
  if (!Number.isSafeInteger(bundleSizeBytes) || bundleSizeBytes <= 0) {
    fail("no non-empty JavaScript artifacts were measured");
  }

  const manifest: ProductionWebBundleManifest = {
    schemaVersion: 1,
    producer: MANIFEST_PRODUCER,
    target: "web",
    mode: "production",
    distRoot: "dist",
    completed: true,
    buildId: state.buildId,
    startedAt: state.startedAt,
    completedAt: new Date().toISOString(),
    buildInputsSha256: state.buildInputsSha256,
    artifactsSha256: artifactSnapshotSha256(secondArtifacts),
    bundleSizeBytes,
    files: secondArtifacts,
  };
  assertRealDistDirectory(rootDir, { create: false });
  writeJsonAtomically(rootDir, join(rootDir, RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH), manifest);
  assertRealBuildStateDirectory(rootDir, { create: false });
  rmSync(statePath, { force: false });
  return manifest;
}

export function validateProductionWebBundleManifest(
  options: ValidateProductionWebManifestOptions
): ProductionWebBundleManifest {
  const rootDir = realpathSync(resolve(options.rootDir));
  const manifestPath = join(rootDir, RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH);
  if (!existsSync(manifestPath)) {
    fail(`bundle manifest is missing: ${RATCHET_BUNDLE_MANIFEST_RELATIVE_PATH}`);
  }

  const manifest = parseManifest(parseJsonObject(manifestPath, "production-web bundle manifest"));
  const currentBuildInputsSha256 = computeProductionWebBuildInputsSha256(
    rootDir,
    options.env ?? process.env
  );
  if (currentBuildInputsSha256 !== manifest.buildInputsSha256) {
    fail("build input fingerprint mismatch; run a fresh production-web build");
  }

  const firstArtifacts = collectJavaScriptArtifacts(rootDir);
  options.afterFirstArtifactPass?.();
  const secondArtifacts = collectJavaScriptArtifacts(rootDir);
  assertSameArtifactSnapshot(firstArtifacts, secondArtifacts);

  const expectedPaths = manifest.files.map((file) => file.path);
  const actualPaths = secondArtifacts.map((file) => file.path);
  if (JSON.stringify(actualPaths) !== JSON.stringify(expectedPaths)) {
    const expectedSet = new Set(expectedPaths);
    const actualSet = new Set(actualPaths);
    const missing = expectedPaths.filter((filePath) => !actualSet.has(filePath));
    const orphan = actualPaths.filter((filePath) => !expectedSet.has(filePath));
    fail(
      `artifact inventory mismatch; missing=[${missing.join(", ")}], orphan=[${orphan.join(", ")}]`
    );
  }

  for (let index = 0; index < manifest.files.length; index += 1) {
    const expected = manifest.files[index];
    const actual = secondArtifacts[index];
    if (actual.sizeBytes !== expected.sizeBytes) {
      fail(
        `size mismatch for ${expected.path}: expected ${expected.sizeBytes}, received ${actual.sizeBytes}`
      );
    }
    if (actual.sha256 !== expected.sha256) {
      fail(`hash mismatch for ${expected.path}`);
    }
  }

  const actualBundleSizeBytes = secondArtifacts.reduce((total, file) => total + file.sizeBytes, 0);
  if (actualBundleSizeBytes !== manifest.bundleSizeBytes) {
    fail(
      `bundleSizeBytes mismatch: expected ${manifest.bundleSizeBytes}, received ${actualBundleSizeBytes}`
    );
  }
  const actualArtifactsSha256 = artifactSnapshotSha256(secondArtifacts);
  if (actualArtifactsSha256 !== manifest.artifactsSha256) {
    fail("artifact snapshot hash mismatch");
  }
  return manifest;
}

export function runRatchetBundleManifestCli(options: RatchetBundleManifestCliOptions): boolean {
  const command = options.argv[0];
  if (command !== "--bundle-manifest-begin" && command !== "--bundle-manifest-complete") {
    return false;
  }

  let target: string | undefined;
  let mode: string | undefined;
  for (let index = 1; index < options.argv.length; index += 1) {
    const option = options.argv[index];
    const value = options.argv[index + 1];
    if (option === "--target" || option === "--mode") {
      if (!value || value.startsWith("--")) fail(`missing value for ${option}`);
      if (option === "--target") {
        if (target !== undefined) fail("duplicate --target option");
        target = value;
      } else {
        if (mode !== undefined) fail("duplicate --mode option");
        mode = value;
      }
      index += 1;
      continue;
    }
    fail(`unknown bundle manifest option: ${option}`);
  }

  if (target === undefined) fail("missing required --target web option");
  if (mode === undefined) fail("missing required --mode production option");
  const env = options.env ?? process.env;
  assertProductionWebContext(target, mode, env);
  const manifestOptions: ProductionWebManifestOptions = {
    rootDir: options.rootDir,
    target: "web",
    mode: "production",
    env,
  };
  if (command === "--bundle-manifest-begin") {
    beginProductionWebBundleManifest(manifestOptions);
  } else {
    completeProductionWebBundleManifest(manifestOptions);
  }
  return true;
}
