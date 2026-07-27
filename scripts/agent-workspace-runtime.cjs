"use strict";

const { spawnSync } = require("node:child_process");
const { createHash } = require("node:crypto");
const {
  closeSync,
  constants: fsConstants,
  existsSync,
  fchmodSync,
  fstatSync,
  lstatSync,
  mkdirSync,
  openSync,
  readdirSync,
  readSync,
  realpathSync,
  unlinkSync,
  writeFileSync,
} = require("node:fs");
const path = require("node:path");
const {
  DEFAULT_BRANCH,
  isCanonicalRemoteUrl,
  validateCreateRequest,
} = require("./agent-workspace-core.cjs");

const DEFAULT_REMOTE = "https://github.com/Yehor212/people-first-app.git";
const MAX_HANDOFF_CHANGED_PATHS = 500;
const MAX_VERIFICATION_RECEIPT_BYTES = 256 * 1024;
const MAX_REVIEW_AUDIO_BYTES = 10 * 1024 * 1024;
const HUMAN_REVIEW_SOURCE_LEDGER = "docs/audio/kimi-k3-recovery-ledger-2026-07-25.md";
const HUMAN_REVIEW_QUARANTINE_REASON =
  "Source-derived recovery candidates are 44.1 kHz and lack updated generated hashes, progression ledgers, and fresh listening approval.";
const HUMAN_REVIEW_BLOCKED = Object.freeze([
  "recovered files without hash-bound generation or redistribution evidence",
  "hyperfocus-ocean-intense.mp3",
]);
const KIMI_AUDIO_REVIEW_2026_07_26 = Object.freeze(
  [
    [
      "hyperfocus-fireplace-deep.mp3",
      "f5c8e70570f38bd86d993d3de484c85ef4e1e8c676094020360042afc5722189",
    ],
    [
      "hyperfocus-fireplace-intense.mp3",
      "fa40413b5882b79825af7e74880cd7252268405b97d78655470915ab1c5358cf",
    ],
    [
      "hyperfocus-fireplace-soft.mp3",
      "6fd3b57c14f83a6418fc26f6cfa4f346ee4bd7e585c14f2dc9935ac8b142bdd9",
    ],
    [
      "hyperfocus-forest-deep.mp3",
      "b79c475c1ee1501e6dfc8949ecf8947baa2c83f76d6e89992d16c9ca7aa111c8",
    ],
    [
      "hyperfocus-forest-intense.mp3",
      "a67528b3a9e8621c906c53f28f8e7ca9dc1629e36e57c776c161c3ce4ebf980c",
    ],
    [
      "hyperfocus-forest-soft.mp3",
      "e2e5988ccfca12edc45332ce6209660c056936caa4a2d07863be6214d73e0e43",
    ],
    [
      "hyperfocus-ocean-deep.mp3",
      "c64fc737ff4e945ad1a198d5ed66ebfc6b1908bb57daa817d8b6e87db86174cc",
    ],
    [
      "hyperfocus-ocean-soft.mp3",
      "adc7126e82e1a9e11b19084927c679115698b7b1a29125b3bc0855ca6f5aa323",
    ],
    [
      "hyperfocus-rain-deep.mp3",
      "e587d5b24016ee444dfd5de9213709fed1589b738d943d0b2b60f614c22c9d22",
    ],
    [
      "hyperfocus-rain-intense.mp3",
      "8e01ff606b2e63cf23fa89406a17db038495980828b6d10d57473069f8c39cd2",
    ],
    [
      "hyperfocus-rain-soft.mp3",
      "e4eafb4061e1db9a389b1365180f90afd425cf93c1e8cc244422e0a29061f1a2",
    ],
    [
      "hyperfocus-river-deep.mp3",
      "cdcbe3fb0c8c251c2131495c66e22061b18e0091cb26027326ce9d20cfc4e3c5",
    ],
    [
      "hyperfocus-river-intense.mp3",
      "13eb0d8d3e12041a534b9e6b9390de0d2c6dfdb5b20e46394782271b53d4621d",
    ],
    [
      "hyperfocus-river-soft.mp3",
      "e1a7f87669f5aaba5668cfded53c6d43a7f43eefb4823a456e51a53e507b79a0",
    ],
    [
      "hyperfocus-wind-deep.mp3",
      "5004f7057a1bf4678e8201a9eb75ec5ac96baf40a8bea613989e19a016b3122e",
    ],
    [
      "hyperfocus-wind-intense.mp3",
      "62f042ea5520d6024d06703497d2a6e43a327c11668020bb8e72094c217ce18c",
    ],
    [
      "hyperfocus-wind-soft.mp3",
      "0b859de27b4ea7c5f6ea5a4aa3032ebba586d9308730751a62e171dde3dd4065",
    ],
  ].map(([filename, sha256]) => Object.freeze({ filename, sha256 }))
);
if (KIMI_AUDIO_REVIEW_2026_07_26.length !== 17) {
  throw new Error("Kimi human-review inventory must contain exactly 17 files");
}

class WorkspaceError extends Error {
  constructor(code, message) {
    super(`${code}: ${message}`);
    this.name = "WorkspaceError";
    this.code = code;
  }
}

const PROTECTED_INCOMING = [
  /^AGENTS\.md$/,
  /^CLAUDE\.md$/,
  /^ARCHITECTURE\.md$/,
  /^package\.json$/,
  /^package-lock\.json$/,
  /^\.codex\//,
  /^\.github\//,
  /^\.husky\//,
  /^\.vscode\//,
  /^config\//,
  /^docs\/ai\//,
  /^scripts\//,
];

function inspectWorkspace({ cwd, expectedRemote }) {
  const rootDir = git(cwd, ["rev-parse", "--show-toplevel"]).trim();
  const remote = git(rootDir, ["remote", "get-url", "origin"]).trim();
  const expected = expectedRemote || DEFAULT_REMOTE;
  assertRemote(remote, expected, rootDir);
  const pushRemotes = git(rootDir, ["remote", "get-url", "--push", "--all", "origin"])
    .trim()
    .split(/\r?\n/)
    .filter(Boolean);
  if (pushRemotes.length === 0) {
    fail("REMOTE_PUSH_MISSING", "origin must have a verifiable push URL");
  }
  for (const pushRemote of pushRemotes) {
    assertRemote(pushRemote, expected, rootDir);
  }
  const branch = optionalGit(rootDir, ["symbolic-ref", "--quiet", "--short", "HEAD"]).trim();
  const commonDir = path.resolve(rootDir, git(rootDir, ["rev-parse", "--git-common-dir"]).trim());
  const statusPorcelain = git(rootDir, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
  const changes = statusPorcelain.split("\0").filter(Boolean);
  const ignoredPaths = listIgnoredPaths(rootDir);
  const worktrees = parseWorktrees(git(rootDir, ["worktree", "list", "--porcelain", "-z"]));
  const canonicalRoot = canonicalPath(rootDir);
  const current = worktrees.find((entry) => canonicalPath(entry.path) === canonicalRoot);
  if (!current) fail("WORKTREE_REGISTRY_MISMATCH", "current root is not registered");

  const baseSha = optionalGit(rootDir, [
    "rev-parse",
    "--verify",
    `refs/remotes/origin/${DEFAULT_BRANCH}`,
  ]).trim();
  const relation = baseSha
    ? git(rootDir, ["rev-list", "--left-right", "--count", `HEAD...${baseSha}`])
        .trim()
        .split(/\s+/)
        .map(Number)
    : [];
  const upstream = optionalGit(rootDir, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]).trim();
  const upstreamHead = upstream
    ? optionalGit(rootDir, ["rev-parse", "--verify", upstream]).trim()
    : "";
  const identity = remoteIdentity(remote, rootDir);

  return {
    rootDir,
    commonDir,
    branch,
    detached: !branch,
    clean: changes.length === 0,
    changes,
    ignoredPaths,
    locked: current.locked === true,
    lockReason: current.lockReason || null,
    head: git(rootDir, ["rev-parse", "HEAD"]).trim(),
    tree: git(rootDir, ["rev-parse", "HEAD^{tree}"]).trim(),
    statusHash: createHash("sha256").update(statusPorcelain).digest("hex"),
    baseSha: baseSha || null,
    ahead: relation.length === 2 ? relation[0] : null,
    behind: relation.length === 2 ? relation[1] : null,
    upstream: upstream || null,
    upstreamHead: upstreamHead || null,
    remoteId: identity,
    remoteIdentity: identity,
    pushRemoteIdentities: pushRemotes.map((pushRemote) => remoteIdentity(pushRemote, rootDir)),
    mainLaneCount: worktrees.filter((entry) => entry.branch === DEFAULT_BRANCH).length,
    worktrees,
  };
}

function createWorkspace({ agent, cwd, destination, expectedRemote, task }) {
  const control = inspectWorkspace({ cwd, expectedRemote });
  if (control.mainLaneCount !== 1) {
    fail(
      "MAIN_LANE_COUNT",
      `control registry must contain exactly one main lane; found ${control.mainLaneCount}`
    );
  }
  if (!control.clean || control.ignoredPaths.length > 0) {
    fail(
      "DIRTY_WORKTREE",
      "control main must contain zero tracked, untracked, or ignored local paths before worktree creation"
    );
  }
  if (control.detached) fail("DETACHED_HEAD", "control repository is detached");
  if (control.branch !== DEFAULT_BRANCH) {
    fail("NOT_INTEGRATION_MAIN", "create must run from the integration main worktree");
  }

  git(control.rootDir, ["fetch", "origin", "--no-prune"]);
  const remoteMain = git(control.rootDir, [
    "rev-parse",
    `refs/remotes/origin/${DEFAULT_BRANCH}`,
  ]).trim();
  if (control.head !== remoteMain) {
    fail(
      "OUTDATED_CONTROL",
      "integration main must equal the exact fetched origin/main before lane creation"
    );
  }
  const branch = `${agent}/${String(task || "")
    .trim()
    .toLowerCase()}`;
  const validation = validateCreateRequest({
    agent,
    slug: task,
    targetPath: destination,
    repoRoot: control.rootDir,
    branchExists:
      refExists(control.rootDir, `refs/heads/${branch}`) ||
      refExists(control.rootDir, `refs/remotes/origin/${branch}`),
    targetExists: existsSync(path.resolve(destination)),
    worktreePaths: control.worktrees.map((entry) => entry.path),
  });
  if (!validation.ok) fail("INVALID_CREATE_REQUEST", validation.errors.join("; "));
  const securityTarget = canonicalProspectivePath(validation.targetPath);
  const targetSegments = securityTarget.replace(/\\/g, "/").split("/").filter(Boolean);
  if (targetSegments.includes("output")) {
    fail("INVALID_CREATE_REQUEST", "worktree target must not live under an output directory");
  }
  const containingRepository = containingGitRepository(securityTarget);
  if (containingRepository) {
    fail("NESTED_REPOSITORY_TARGET", "worktree target must not live inside another Git repository");
  }
  const workspaceFile = `${validation.targetPath}.code-workspace`;
  if (existsSync(workspaceFile)) {
    fail("WORKSPACE_FILE_EXISTS", `${workspaceFile} already exists`);
  }

  const prospectiveTarget = openProspectivePathBinding(
    validation.targetPath,
    "WORKSPACE_PATH_RACE"
  );
  const workspaceText = `${JSON.stringify(
    {
      folders: [
        {
          name: `ZenFlow — ${agent.toUpperCase()} — ${String(task).trim().toLowerCase()}`,
          path: validation.targetPath,
        },
      ],
      settings: {
        "git.autoRepositoryDetection": false,
        "git.detectWorktrees": false,
        "git.openRepositoryInParentFolders": "never",
        "git.repositoryScanMaxDepth": 1,
        "git.scanRepositories": [],
        "window.title": "${rootName} — ${activeEditorShort}",
      },
    },
    null,
    2
  )}\n`;
  let parentBinding;
  try {
    if (prospectiveTarget.expectedCanonical !== securityTarget) {
      fail("WORKSPACE_PATH_RACE", "worktree target changed after security validation");
    }
    parentBinding = materializeBoundDirectory({
      errorCode: "WORKSPACE_PATH_RACE",
      expectedCanonical: path.dirname(securityTarget),
      mode: 0o700,
      prospective: prospectiveTarget,
      targetPath: path.dirname(validation.targetPath),
    });
    writeExclusiveBoundFile({
      bytes: workspaceText,
      errorCode: "WORKSPACE_PATH_RACE",
      filePath: workspaceFile,
      mode: 0o600,
      parentBinding,
    });
    assertDirectoryBinding(parentBinding, "WORKSPACE_PATH_RACE");
    try {
      git(control.rootDir, [
        "worktree",
        "add",
        "--lock",
        "--reason",
        `ZenFlow ${agent} isolated workspace`,
        "-b",
        validation.branch,
        validation.targetPath,
        remoteMain,
      ]);
    } catch (error) {
      assertDirectoryBinding(parentBinding, "WORKSPACE_PATH_RACE");
      rollbackFailedWorkspaceCreation({
        branch: validation.branch,
        controlRoot: control.rootDir,
        expectedHead: remoteMain,
        targetPath: validation.targetPath,
        workspaceFile,
        workspaceText,
      });
      throw error;
    }

    assertDirectoryBinding(parentBinding, "WORKSPACE_PATH_RACE");
    assertCreatedDirectory({
      errorCode: "WORKSPACE_PATH_RACE",
      expectedCanonical: securityTarget,
      parentBinding,
      targetPath: validation.targetPath,
    });
    const created = inspectWorkspace({
      cwd: validation.targetPath,
      expectedRemote,
    });
    assertDirectoryBinding(parentBinding, "WORKSPACE_PATH_RACE");
    if (
      !created.locked ||
      created.branch !== validation.branch ||
      !created.clean ||
      created.ignoredPaths.length > 0 ||
      created.head !== remoteMain
    ) {
      fail(
        "WORKTREE_CREATION_PROOF_FAILED",
        "created lane did not satisfy the locked clean contract"
      );
    }
    return {
      branch: validation.branch,
      destination: validation.targetPath,
      locked: true,
      workspaceFile,
      head: created.head,
      commonDir: created.commonDir,
    };
  } finally {
    if (parentBinding) closeSync(parentBinding.descriptor);
    closeSync(prospectiveTarget.ancestor.descriptor);
  }
}

function bootstrapHumanReviewWorkspace({
  audioInventory = KIMI_AUDIO_REVIEW_2026_07_26,
  audioReviewPath,
  audioSourcePath,
  controlPath,
  expectedRemote,
  _testHooks,
  workspaceFile,
}) {
  const remote = expectedRemote || DEFAULT_REMOTE;
  const destinations = {
    audioReviewPath: requireAbsolutePath(audioReviewPath, "audio review path"),
    controlPath: requireAbsolutePath(controlPath, "control path"),
    workspaceFile: requireAbsolutePath(workspaceFile, "workspace file"),
  };
  const source = requireAbsolutePath(audioSourcePath, "audio source path");
  const destinationSecurityPaths = Object.fromEntries(
    Object.entries(destinations).map(([name, target]) => [name, canonicalProspectivePath(target)])
  );
  for (const leftName of Object.keys(destinations)) {
    const leftPath = destinations[leftName];
    if (existsSync(leftPath)) {
      fail("HUMAN_REVIEW_TARGET_EXISTS", `${leftName} already exists`);
    }
    for (const rightName of Object.keys(destinations)) {
      if (
        leftName !== rightName &&
        pathsOverlap(destinationSecurityPaths[leftName], destinationSecurityPaths[rightName])
      ) {
        fail("HUMAN_REVIEW_PATH_OVERLAP", `${leftName} overlaps ${rightName}`);
      }
    }
  }
  if (!existsSync(source) || !lstatSync(source).isDirectory()) {
    fail("AUDIO_SOURCE_MISSING", "audio source path must be an existing directory");
  }
  const sourceSecurityPath = canonicalPath(source);
  for (const targetName of Object.keys(destinations)) {
    if (pathsOverlap(sourceSecurityPath, destinationSecurityPaths[targetName])) {
      fail("HUMAN_REVIEW_PATH_OVERLAP", `audio source path overlaps ${targetName}`);
    }
  }
  for (const targetName of Object.keys(destinations)) {
    const securityPath = destinationSecurityPaths[targetName];
    if (containingGitRepository(securityPath)) {
      fail(
        "NESTED_REPOSITORY_TARGET",
        "human review targets must live outside every existing Git repository"
      );
    }
    if (securityPath.split(path.sep).includes("output")) {
      fail("INVALID_REVIEW_TARGET", "human review targets must not live under output");
    }
  }

  const prospectiveDestinations = Object.fromEntries(
    Object.entries(destinations).map(([name, target]) => [
      name,
      openProspectivePathBinding(target, "HUMAN_REVIEW_PATH_RACE"),
    ])
  );
  const openedBindings = [];
  try {
    for (const targetName of Object.keys(destinations)) {
      const prospective = prospectiveDestinations[targetName];
      if (prospective.expectedCanonical !== destinationSecurityPaths[targetName]) {
        fail("HUMAN_REVIEW_PATH_RACE", `${targetName} changed after security validation`);
      }
    }
    if (_testHooks && typeof _testHooks.afterDestinationBindingsCaptured === "function") {
      _testHooks.afterDestinationBindingsCaptured();
    }
    for (const prospective of Object.values(prospectiveDestinations)) {
      assertDirectoryBinding(prospective.ancestor, "HUMAN_REVIEW_PATH_RACE");
    }

    const inventory = validateAudioInventory(audioInventory);
    const verifiedAudio = inventory.map((entry) => {
      const sourcePath = path.join(source, entry.filename);
      const bytes = readBoundedRegularFile(sourcePath, MAX_REVIEW_AUDIO_BYTES, "KIMI_AUDIO_SOURCE");
      const actual = createHash("sha256").update(bytes).digest("hex");
      if (actual !== entry.sha256) {
        fail(
          "AUDIO_HASH_MISMATCH",
          `${entry.filename} does not match the reviewed recovery ledger`
        );
      }
      return { ...entry, bytes };
    });

    const controlParent = materializeBoundDirectory({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: path.dirname(destinationSecurityPaths.controlPath),
      mode: 0o700,
      prospective: prospectiveDestinations.controlPath,
      targetPath: path.dirname(destinations.controlPath),
    });
    openedBindings.push(controlParent);
    assertDirectoryBinding(controlParent, "HUMAN_REVIEW_PATH_RACE");
    cloneMain({
      cwd: controlParent.path,
      destination: destinations.controlPath,
      remote,
    });
    if (_testHooks && typeof _testHooks.afterControlCloned === "function") {
      _testHooks.afterControlCloned();
    }
    assertDirectoryBinding(controlParent, "HUMAN_REVIEW_PATH_RACE");
    const controlDirectory = openCreatedDirectoryBinding({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: destinationSecurityPaths.controlPath,
      parentBinding: controlParent,
      targetPath: destinations.controlPath,
    });
    openedBindings.push(controlDirectory);
    const control = inspectWorkspace({
      cwd: destinations.controlPath,
      expectedRemote: remote,
    });
    assertDirectoryBinding(controlDirectory, "HUMAN_REVIEW_PATH_RACE");
    if (
      control.branch !== DEFAULT_BRANCH ||
      !control.clean ||
      control.ignoredPaths.length > 0 ||
      control.detached ||
      control.mainLaneCount !== 1 ||
      control.head !== control.baseSha
    ) {
      fail(
        "HUMAN_MAIN_PROOF_FAILED",
        "human main must be clean, named main, and equal exact origin/main"
      );
    }

    const reviewParent = materializeBoundDirectory({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: path.dirname(destinationSecurityPaths.audioReviewPath),
      mode: 0o700,
      prospective: prospectiveDestinations.audioReviewPath,
      targetPath: path.dirname(destinations.audioReviewPath),
    });
    openedBindings.push(reviewParent);
    const reviewDirectory = materializeBoundChildDirectory({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: destinationSecurityPaths.audioReviewPath,
      mode: 0o700,
      parentBinding: reviewParent,
      targetPath: destinations.audioReviewPath,
    });
    openedBindings.push(reviewDirectory);
    const audioDirectoryPath = path.join(destinations.audioReviewPath, "hyperfocus");
    const audioDirectory = materializeBoundChildDirectory({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: path.join(destinationSecurityPaths.audioReviewPath, "hyperfocus"),
      mode: 0o700,
      parentBinding: reviewDirectory,
      targetPath: audioDirectoryPath,
    });
    openedBindings.push(audioDirectory);
    if (_testHooks && typeof _testHooks.afterAudioReviewDirectoryCreated === "function") {
      _testHooks.afterAudioReviewDirectoryCreated();
    }
    assertDirectoryBinding(reviewDirectory, "HUMAN_REVIEW_PATH_RACE");
    assertDirectoryBinding(audioDirectory, "HUMAN_REVIEW_PATH_RACE");

    for (const entry of verifiedAudio) {
      writeExclusiveBoundFile({
        bytes: entry.bytes,
        errorCode: "HUMAN_REVIEW_PATH_RACE",
        filePath: path.join(audioDirectoryPath, entry.filename),
        mode: 0o400,
        parentBinding: audioDirectory,
      });
    }
    const manifest = humanReviewManifest(verifiedAudio);
    writeExclusiveBoundFile({
      bytes: `${JSON.stringify(manifest, null, 2)}\n`,
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      filePath: path.join(destinations.audioReviewPath, "MANIFEST.json"),
      mode: 0o400,
      parentBinding: reviewDirectory,
    });
    writeExclusiveBoundFile({
      bytes: humanReviewReadme(verifiedAudio.length),
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      filePath: path.join(destinations.audioReviewPath, "README.md"),
      mode: 0o400,
      parentBinding: reviewDirectory,
    });
    fchmodSync(audioDirectory.descriptor, 0o500);
    fchmodSync(reviewDirectory.descriptor, 0o500);
    assertDirectoryBinding(reviewDirectory, "HUMAN_REVIEW_PATH_RACE");
    assertDirectoryBinding(audioDirectory, "HUMAN_REVIEW_PATH_RACE");

    const workspaceParent = materializeBoundDirectory({
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      expectedCanonical: path.dirname(destinationSecurityPaths.workspaceFile),
      mode: 0o700,
      prospective: prospectiveDestinations.workspaceFile,
      targetPath: path.dirname(destinations.workspaceFile),
    });
    openedBindings.push(workspaceParent);
    writeExclusiveBoundFile({
      bytes: `${JSON.stringify(
        humanReviewWorkspace(destinations.controlPath, destinations.audioReviewPath),
        null,
        2
      )}\n`,
      errorCode: "HUMAN_REVIEW_PATH_RACE",
      filePath: destinations.workspaceFile,
      mode: 0o400,
      parentBinding: workspaceParent,
    });

    const result = inspectHumanReviewWorkspace({
      audioInventory: inventory,
      audioReviewPath: destinations.audioReviewPath,
      controlPath: destinations.controlPath,
      expectedRemote: remote,
      workspaceFile: destinations.workspaceFile,
    });
    for (const binding of openedBindings) {
      assertDirectoryBinding(binding, "HUMAN_REVIEW_PATH_RACE");
    }
    return result;
  } finally {
    for (const binding of openedBindings.reverse()) {
      closeSync(binding.descriptor);
    }
    for (const prospective of Object.values(prospectiveDestinations)) {
      closeSync(prospective.ancestor.descriptor);
    }
  }
}

function inspectHumanReviewWorkspace({
  audioInventory = KIMI_AUDIO_REVIEW_2026_07_26,
  audioReviewPath,
  controlPath,
  expectedRemote,
  workspaceFile,
}) {
  const remote = expectedRemote || DEFAULT_REMOTE;
  const review = requireAbsolutePath(audioReviewPath, "audio review path");
  const controlPathResolved = requireAbsolutePath(controlPath, "control path");
  const workspaceFileResolved = requireAbsolutePath(workspaceFile, "workspace file");
  const inventory = validateAudioInventory(audioInventory);
  assertReviewDirectory(review, "audio review root");
  const control = inspectWorkspace({
    cwd: controlPathResolved,
    expectedRemote: remote,
  });
  if (
    control.branch !== DEFAULT_BRANCH ||
    !control.clean ||
    control.ignoredPaths.length > 0 ||
    control.detached ||
    control.mainLaneCount !== 1 ||
    control.head !== control.baseSha
  ) {
    fail(
      "HUMAN_MAIN_PROOF_FAILED",
      "human main must be clean, named main, and equal exact origin/main"
    );
  }
  if (containingGitRepository(review)) {
    fail("AUDIO_REVIEW_REPOSITORY", "audio review root must remain non-Git");
  }

  const rootEntries = readdirSync(review).sort();
  if (
    JSON.stringify(rootEntries) !== JSON.stringify(["MANIFEST.json", "README.md", "hyperfocus"])
  ) {
    fail(
      "AUDIO_REVIEW_LAYOUT",
      "audio review root must contain only README, manifest, and Hyperfocus files"
    );
  }
  const audioDirectory = path.join(review, "hyperfocus");
  assertReviewDirectory(audioDirectory, "audio review Hyperfocus directory");
  const expectedNames = inventory.map((entry) => entry.filename).sort();
  if (JSON.stringify(readdirSync(audioDirectory).sort()) !== JSON.stringify(expectedNames)) {
    fail("AUDIO_REVIEW_LAYOUT", "audio review file set differs from the reviewed inventory");
  }
  for (const entry of inventory) {
    const copiedPath = path.join(audioDirectory, entry.filename);
    assertExactMode(copiedPath, 0o400, entry.filename);
    const copied = readBoundedRegularFile(copiedPath, MAX_REVIEW_AUDIO_BYTES, "KIMI_AUDIO_COPY");
    if (createHash("sha256").update(copied).digest("hex") !== entry.sha256) {
      fail("AUDIO_COPY_MISMATCH", `${entry.filename} changed after bootstrap`);
    }
  }
  for (const localEvidence of ["MANIFEST.json", "README.md"]) {
    assertExactMode(path.join(review, localEvidence), 0o400, localEvidence);
  }
  assertExactMode(workspaceFileResolved, 0o400, "human review workspace");

  let manifest;
  let workspace;
  let readme;
  try {
    manifest = JSON.parse(
      readBoundedRegularFile(
        path.join(review, "MANIFEST.json"),
        MAX_VERIFICATION_RECEIPT_BYTES,
        "AUDIO_REVIEW_MANIFEST"
      ).toString("utf8")
    );
    workspace = JSON.parse(
      readBoundedRegularFile(
        workspaceFileResolved,
        MAX_VERIFICATION_RECEIPT_BYTES,
        "HUMAN_REVIEW_WORKSPACE"
      ).toString("utf8")
    );
    readme = readBoundedRegularFile(
      path.join(review, "README.md"),
      MAX_VERIFICATION_RECEIPT_BYTES,
      "AUDIO_REVIEW_README"
    ).toString("utf8");
  } catch {
    fail("HUMAN_REVIEW_JSON_INVALID", "workspace or audio manifest is not valid JSON");
  }
  if (JSON.stringify(manifest) !== JSON.stringify(humanReviewManifest(inventory))) {
    fail("AUDIO_REVIEW_MANIFEST_INVALID", "audio manifest is not bound to the exact quarantine");
  }
  if (readme !== humanReviewReadme(inventory.length)) {
    fail("AUDIO_REVIEW_README_INVALID", "audio review warning text changed");
  }
  if (
    JSON.stringify(workspace) !== JSON.stringify(humanReviewWorkspace(controlPathResolved, review))
  ) {
    fail(
      "HUMAN_REVIEW_WORKSPACE_INVALID",
      "workspace must expose two roots, one Git provider, and a read-only audio root"
    );
  }

  return {
    audioCount: inventory.length,
    audioReviewPath: review,
    branch: control.branch,
    clean: true,
    controlPath: controlPathResolved,
    head: control.head,
    ready: true,
    repository: control.remoteIdentity,
    repositoryCount: 1,
    workspaceFile: workspaceFileResolved,
  };
}

function syncWorkspace({ apply = false, cwd, expectedRemote, reviewedSha }) {
  const before = inspectWorkspace({ cwd, expectedRemote });
  if (before.detached) fail("DETACHED_HEAD", "sync requires a named branch");
  if (!before.clean) fail("DIRTY_WORKTREE", "sync requires a clean worktree");
  if (before.mainLaneCount !== 1) {
    fail(
      "MAIN_LANE_COUNT",
      `shared worktree registry must contain exactly one main lane; found ${before.mainLaneCount}`
    );
  }

  git(before.rootDir, ["fetch", "origin", "--no-prune"]);
  const remoteHead = git(before.rootDir, [
    "rev-parse",
    `refs/remotes/origin/${DEFAULT_BRANCH}`,
  ]).trim();
  const [ahead, behind] = git(before.rootDir, [
    "rev-list",
    "--left-right",
    "--count",
    `HEAD...${remoteHead}`,
  ])
    .trim()
    .split(/\s+/)
    .map(Number);

  if (!apply) {
    return {
      action: "fetch-only",
      head: before.head,
      remoteHead,
      ahead,
      behind,
    };
  }
  if (before.ignoredPaths.length > 0) {
    fail(
      "IGNORED_LOCAL_STATE",
      "sync apply requires zero ignored local paths because Git hooks can mutate ignored bytes"
    );
  }
  if (before.branch !== DEFAULT_BRANCH) {
    fail(
      "FEATURE_SYNC_REFUSED",
      "feature lanes are fetch-only; apply runs only on integration main"
    );
  }
  if (ahead > 0 && behind > 0) {
    fail("DIVERGED", "local and origin/main both contain unique commits");
  }
  if (ahead > 0) {
    fail("AHEAD", "local commits require explicit owner-reviewed reconciliation");
  }
  if (behind === 0) {
    return {
      action: "current",
      head: before.head,
      remoteHead,
      ahead,
      behind,
    };
  }

  const incomingPaths = git(before.rootDir, [
    "diff",
    "--name-only",
    "-z",
    `${before.head}..${remoteHead}`,
  ])
    .split("\0")
    .filter(Boolean);
  const ignoredCollisions = incomingPaths.filter(
    (candidate) =>
      ignoredPathIntersects(candidate, before.ignoredPaths) ||
      isExistingIgnoredPath(before.rootDir, candidate)
  );
  if (ignoredCollisions.length > 0) {
    fail(
      "IGNORED_PATH_COLLISION",
      `refusing fast-forward because ${ignoredCollisions.length} incoming path(s) collide with ignored local recovery evidence`
    );
  }
  const protectedPaths = incomingPaths.filter((candidate) =>
    PROTECTED_INCOMING.some((pattern) => pattern.test(candidate))
  );
  if (protectedPaths.length > 0 && reviewedSha !== remoteHead) {
    fail(
      "PROTECTED_INCOMING_REVIEW_REQUIRED",
      `review exact SHA ${remoteHead} before applying protected incoming paths`
    );
  }

  git(before.rootDir, ["merge", "--ff-only", "--no-overwrite-ignore", remoteHead]);
  const after = inspectWorkspace({ cwd: before.rootDir, expectedRemote });
  if (!after.clean || after.head !== remoteHead || after.mainLaneCount !== 1) {
    fail("FAST_FORWARD_PROOF_FAILED", "post-merge state does not match the pinned fetched SHA");
  }
  return {
    action: "fast-forward",
    head: after.head,
    remoteHead,
    ahead: 0,
    behind: 0,
    reviewedProtectedPaths: protectedPaths,
    restartRequired: protectedPaths.length > 0,
  };
}

function handoffWorkspace({ cwd, expectedRemote }) {
  const before = inspectWorkspace({ cwd, expectedRemote });
  if (before.detached) fail("DETACHED_HEAD", "handoff requires a named branch");
  if (!before.clean) fail("DIRTY_WORKTREE", "handoff requires a clean worktree");
  if (before.mainLaneCount !== 1) {
    fail(
      "MAIN_LANE_COUNT",
      `shared worktree registry must contain exactly one main lane; found ${before.mainLaneCount}`
    );
  }
  if (!before.locked) fail("UNLOCKED_WORKTREE", "handoff requires a locked worktree");
  if (!/^(?:codex|kimi)\//.test(before.branch)) {
    fail("INVALID_AGENT_BRANCH", "handoff requires codex/ or kimi/ branch ownership");
  }

  git(before.rootDir, ["fetch", "origin", "--no-prune"]);
  const upstreamName = optionalGit(before.rootDir, [
    "rev-parse",
    "--abbrev-ref",
    "--symbolic-full-name",
    "@{upstream}",
  ]).trim();
  if (!upstreamName || upstreamName !== `origin/${before.branch}`) {
    fail("REMOTE_BRANCH_MISSING", "same-named upstream branch is required");
  }
  const upstreamHead = git(before.rootDir, ["rev-parse", "@{upstream}"]).trim();
  const liveUpstreamHead = liveRemoteBranchHead(before.rootDir, before.branch);
  if (!liveUpstreamHead) {
    fail(
      "REMOTE_BRANCH_MISSING",
      "same-named branch is absent from the live origin; retained tracking refs are recovery evidence only"
    );
  }
  if (upstreamHead !== before.head || liveUpstreamHead !== before.head) {
    fail("REMOTE_MISMATCH", "local tracking and live upstream tips must equal local HEAD");
  }
  const originMain = git(before.rootDir, [
    "rev-parse",
    `refs/remotes/origin/${DEFAULT_BRANCH}`,
  ]).trim();
  const baseSha = git(before.rootDir, ["merge-base", originMain, before.head]).trim();
  const behindMain = Number(
    git(before.rootDir, ["rev-list", "--count", `${before.head}..${originMain}`]).trim()
  );
  if (!Number.isInteger(behindMain) || behindMain < 0) {
    fail("GIT_RELATION_ERROR", "cannot prove feature distance from current origin/main");
  }
  const changedPaths = git(before.rootDir, [
    "diff",
    "--name-only",
    "-z",
    `${baseSha}..${before.head}`,
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
  if (changedPaths.length === 0) {
    fail("NO_HANDOFF_CHANGES", "handoff branch has no committed change");
  }
  if (changedPaths.length > MAX_HANDOFF_CHANGED_PATHS) {
    fail(
      "HANDOFF_PATH_LIMIT_EXCEEDED",
      `handoff path manifest exceeds the ${MAX_HANDOFF_CHANGED_PATHS}-path review limit`
    );
  }
  const verificationPath = path.join(before.rootDir, ".verification-done");
  const verificationDone = verificationReceipt(verificationPath);
  const after = inspectWorkspace({ cwd: before.rootDir, expectedRemote });
  const verificationAfter = verificationReceipt(verificationPath);
  if (
    !after.clean ||
    !after.locked ||
    after.rootDir !== before.rootDir ||
    after.commonDir !== before.commonDir ||
    after.branch !== before.branch ||
    after.head !== before.head ||
    after.tree !== before.tree ||
    after.statusHash !== before.statusHash ||
    after.upstreamHead !== upstreamHead ||
    after.mainLaneCount !== 1 ||
    JSON.stringify(after.ignoredPaths) !== JSON.stringify(before.ignoredPaths) ||
    JSON.stringify(verificationAfter) !== JSON.stringify(verificationDone)
  ) {
    fail(
      "HANDOFF_RACE_DETECTED",
      "workspace or verification evidence changed while the handoff receipt was assembled"
    );
  }

  return {
    schemaVersion: 1,
    repository: after.remoteIdentity,
    role: after.branch.split("/", 1)[0],
    branch: after.branch,
    rootDir: after.rootDir,
    commonDir: after.commonDir,
    baseSha,
    behindMain,
    head: after.head,
    originMain,
    tree: after.tree,
    statusHash: after.statusHash,
    upstreamHead,
    changedPaths,
    changedPathCount: changedPaths.length,
    verificationDone,
    ignoredLocalState: {
      pathCount: after.ignoredPaths.length,
      includedInHandoff: false,
      preservationVerified: false,
    },
    clean: true,
    locked: true,
    ready: true,
  };
}

function verificationReceipt(verificationPath) {
  let pathInfo;
  try {
    pathInfo = lstatSync(verificationPath, { bigint: true });
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { present: false, sha256: null };
    }
    fail("UNSAFE_VERIFICATION_RECEIPT", ".verification-done metadata could not be read safely");
  }
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) {
    fail("UNSAFE_VERIFICATION_RECEIPT", ".verification-done must be a regular non-symlink file");
  }

  let descriptor;
  try {
    descriptor = openSync(verificationPath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  } catch (error) {
    if (error && error.code === "ENOENT") {
      return { present: false, sha256: null };
    }
    fail(
      "UNSAFE_VERIFICATION_RECEIPT",
      ".verification-done could not be opened as a regular non-symlink file"
    );
  }

  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.dev !== pathInfo.dev ||
      before.ino !== pathInfo.ino ||
      before.mode !== pathInfo.mode
    ) {
      fail("HANDOFF_RACE_DETECTED", ".verification-done changed before it could be opened safely");
    }
    if (before.size > BigInt(MAX_VERIFICATION_RECEIPT_BYTES)) {
      fail(
        "UNSAFE_VERIFICATION_RECEIPT",
        `.verification-done exceeds ${MAX_VERIFICATION_RECEIPT_BYTES} bytes`
      );
    }

    const buffer = Buffer.allocUnsafe(MAX_VERIFICATION_RECEIPT_BYTES + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const count = readSync(descriptor, buffer, offset, buffer.byteLength - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (
      offset !== Number(before.size) ||
      offset > MAX_VERIFICATION_RECEIPT_BYTES ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mode !== before.mode ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      fail("HANDOFF_RACE_DETECTED", ".verification-done changed while it was being hashed");
    }
    const bytes = buffer.subarray(0, offset);
    return {
      present: true,
      sha256: createHash("sha256").update(bytes).digest("hex"),
    };
  } finally {
    closeSync(descriptor);
  }
}

function humanReviewManifest(inventory) {
  return {
    schemaVersion: 1,
    status: "QUARANTINED",
    releaseReady: false,
    sourceLedger: HUMAN_REVIEW_SOURCE_LEDGER,
    reason: HUMAN_REVIEW_QUARANTINE_REASON,
    copied: inventory.map(({ filename, sha256 }) => ({
      filename,
      sha256,
      status: "QUARANTINED",
    })),
    blockedNotCopied: [...HUMAN_REVIEW_BLOCKED],
  };
}

function humanReviewReadme(audioCount) {
  return [
    "# Kimi nature audio — review only",
    "",
    `${audioCount} recovered source-derived variants are visible here for listening.`,
    "They are QUARANTINED, not approved release assets: the recovered files are 44.1 kHz and their product ledgers and human listening approval are incomplete.",
    "Files without hash-bound provenance or redistribution evidence were not copied.",
    "Do not edit or promote from this folder. Start a new isolated feature lane and rerun every audio/provenance check.",
    "",
  ].join("\n");
}

function humanReviewWorkspace(controlPath, audioReviewPath) {
  return {
    folders: [
      { name: "ZenFlow — clean main", path: controlPath },
      { name: "Kimi nature audio — review only", path: audioReviewPath },
    ],
    settings: {
      "files.readonlyFromPermissions": true,
      "git.autoRepositoryDetection": false,
      "git.detectWorktrees": false,
      "git.openRepositoryInParentFolders": "never",
      "git.repositoryScanMaxDepth": 1,
      "git.scanRepositories": [],
      "window.title": "ZenFlow human review — ${activeEditorShort}",
    },
  };
}

function assertReviewDirectory(directoryPath, label) {
  let info;
  try {
    info = lstatSync(directoryPath);
  } catch {
    fail("AUDIO_REVIEW_LAYOUT", `${label} is missing or unreadable`);
  }
  if (!info.isDirectory() || info.isSymbolicLink()) {
    fail("AUDIO_REVIEW_UNSAFE_DIRECTORY", `${label} must be a non-symlink directory`);
  }
  if ((info.mode & 0o777) !== 0o500) {
    fail("AUDIO_REVIEW_PERMISSIONS", `${label} must use mode 0500`);
  }
}

function assertExactMode(filePath, expectedMode, label) {
  let info;
  try {
    info = lstatSync(filePath);
  } catch {
    fail("AUDIO_REVIEW_LAYOUT", `${label} is missing or unreadable`);
  }
  if (!info.isFile() || info.isSymbolicLink()) {
    fail("AUDIO_REVIEW_UNSAFE_FILE", `${label} must be a regular non-symlink file`);
  }
  if ((info.mode & 0o777) !== expectedMode) {
    fail(
      "AUDIO_REVIEW_PERMISSIONS",
      `${label} must use mode ${expectedMode.toString(8).padStart(4, "0")}`
    );
  }
}

function validateAudioInventory(value) {
  if (!Array.isArray(value) || value.length === 0 || value.length > 100) {
    fail("INVALID_AUDIO_INVENTORY", "audio inventory must contain 1-100 entries");
  }
  const seen = new Set();
  return value.map((entry) => {
    const filename = String(entry?.filename || "");
    const sha256 = String(entry?.sha256 || "").toLowerCase();
    if (
      path.basename(filename) !== filename ||
      !/^hyperfocus-[a-z]+-(?:soft|deep|intense)\.mp3$/.test(filename)
    ) {
      fail("INVALID_AUDIO_INVENTORY", "audio filenames must be bounded Hyperfocus MP3 basenames");
    }
    if (!/^[0-9a-f]{64}$/.test(sha256)) {
      fail("INVALID_AUDIO_INVENTORY", `${filename} must have an exact SHA-256`);
    }
    if (seen.has(filename)) {
      fail("INVALID_AUDIO_INVENTORY", `${filename} appears more than once`);
    }
    seen.add(filename);
    return { filename, sha256 };
  });
}

function readBoundedRegularFile(filePath, maxBytes, errorPrefix, { afterLstat } = {}) {
  let pathInfo;
  try {
    pathInfo = lstatSync(filePath, { bigint: true });
  } catch {
    fail(`${errorPrefix}_UNREADABLE`, "expected file is missing or unreadable");
  }
  if (!pathInfo.isFile() || pathInfo.isSymbolicLink()) {
    fail(`${errorPrefix}_UNSAFE`, "expected file must be a regular non-symlink file");
  }
  if (pathInfo.size <= 0n || pathInfo.size > BigInt(maxBytes)) {
    fail(`${errorPrefix}_SIZE`, `expected file must contain 1-${maxBytes} bytes`);
  }
  if (typeof afterLstat === "function") afterLstat();

  let descriptor;
  try {
    descriptor = openSync(filePath, fsConstants.O_RDONLY | (fsConstants.O_NOFOLLOW || 0));
  } catch {
    fail(`${errorPrefix}_UNSAFE`, "expected file could not be opened without following links");
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (
      !before.isFile() ||
      before.dev !== pathInfo.dev ||
      before.ino !== pathInfo.ino ||
      before.mode !== pathInfo.mode ||
      before.size !== pathInfo.size ||
      before.mtimeNs !== pathInfo.mtimeNs ||
      before.ctimeNs !== pathInfo.ctimeNs
    ) {
      fail(`${errorPrefix}_RACE`, "expected file changed before it could be read");
    }
    if (
      before.size <= 0n ||
      before.size > BigInt(maxBytes) ||
      before.size > BigInt(Number.MAX_SAFE_INTEGER)
    ) {
      fail(`${errorPrefix}_SIZE`, `expected file must contain 1-${maxBytes} bytes`);
    }
    const buffer = Buffer.allocUnsafe(Number(before.size) + 1);
    let offset = 0;
    while (offset < buffer.byteLength) {
      const count = readSync(descriptor, buffer, offset, buffer.byteLength - offset, offset);
      if (count === 0) break;
      offset += count;
    }
    const after = fstatSync(descriptor, { bigint: true });
    if (
      offset !== Number(before.size) ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      after.mode !== before.mode ||
      after.size !== before.size ||
      after.mtimeNs !== before.mtimeNs ||
      after.ctimeNs !== before.ctimeNs
    ) {
      fail(`${errorPrefix}_RACE`, "expected file changed while it was being read");
    }
    return buffer.subarray(0, offset);
  } finally {
    closeSync(descriptor);
  }
}

function cloneMain({ cwd, destination, remote }) {
  remoteIdentity(remote, cwd);
  const result = spawnSync(
    "git",
    [
      "clone",
      "--branch",
      DEFAULT_BRANCH,
      "--single-branch",
      "--no-tags",
      "--",
      remote,
      destination,
    ],
    {
      cwd,
      encoding: "utf8",
      shell: false,
      timeout: 120_000,
      maxBuffer: 4 * 1024 * 1024,
      stdio: ["ignore", "pipe", "pipe"],
    }
  );
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail("GIT_CLONE_FAILED", `git clone failed: ${sanitize(result.stderr || result.status)}`);
  }
}

function requireAbsolutePath(value, label) {
  if (typeof value !== "string" || !path.isAbsolute(value)) {
    fail("INVALID_HUMAN_REVIEW_PATH", `${label} must be an absolute path`);
  }
  return path.resolve(value);
}

function openProspectivePathBinding(targetPath, errorCode) {
  const absolute = path.resolve(targetPath);
  const missingSegments = [];
  let existing = absolute;
  while (!pathEntryExists(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) {
      fail(errorCode, "prospective path has no readable existing ancestor");
    }
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  const ancestor = openDirectoryBinding(existing, errorCode);
  return {
    ancestor,
    expectedCanonical: path.resolve(ancestor.canonicalPath, ...missingSegments),
  };
}

function materializeBoundDirectory({
  errorCode,
  expectedCanonical,
  mode,
  prospective,
  targetPath,
}) {
  assertDirectoryBinding(prospective.ancestor, errorCode);
  mkdirSync(targetPath, { mode, recursive: true });
  assertDirectoryBinding(prospective.ancestor, errorCode);
  const binding = openDirectoryBinding(targetPath, errorCode);
  if (binding.canonicalPath !== path.resolve(expectedCanonical)) {
    closeSync(binding.descriptor);
    fail(errorCode, "created directory resolved to a different filesystem path");
  }
  return binding;
}

function openDirectoryBinding(directoryPath, errorCode) {
  const absolute = path.resolve(directoryPath);
  let pathInfo;
  try {
    pathInfo = lstatSync(absolute, { bigint: true });
  } catch {
    fail(errorCode, "directory identity could not be read");
  }
  if (!pathInfo.isDirectory() || pathInfo.isSymbolicLink()) {
    fail(errorCode, "directory path must remain a non-symlink directory");
  }
  let descriptor;
  try {
    descriptor = openSync(
      absolute,
      fsConstants.O_RDONLY | (fsConstants.O_DIRECTORY || 0) | (fsConstants.O_NOFOLLOW || 0)
    );
  } catch {
    fail(errorCode, "directory path could not be opened without following links");
  }
  const opened = fstatSync(descriptor, { bigint: true });
  if (!opened.isDirectory() || opened.dev !== pathInfo.dev || opened.ino !== pathInfo.ino) {
    closeSync(descriptor);
    fail(errorCode, "directory changed before its identity could be bound");
  }
  return {
    canonicalPath: realpathSync.native(absolute),
    descriptor,
    dev: opened.dev,
    ino: opened.ino,
    path: absolute,
  };
}

function assertDirectoryBinding(binding, errorCode) {
  let pathInfo;
  try {
    pathInfo = lstatSync(binding.path, { bigint: true });
  } catch {
    fail(errorCode, "bound directory path disappeared");
  }
  const opened = fstatSync(binding.descriptor, { bigint: true });
  let canonicalAtPath;
  try {
    canonicalAtPath = realpathSync.native(binding.path);
  } catch {
    fail(errorCode, "bound directory path no longer resolves safely");
  }
  if (
    !pathInfo.isDirectory() ||
    pathInfo.isSymbolicLink() ||
    !opened.isDirectory() ||
    pathInfo.dev !== binding.dev ||
    pathInfo.ino !== binding.ino ||
    opened.dev !== binding.dev ||
    opened.ino !== binding.ino ||
    canonicalAtPath !== binding.canonicalPath
  ) {
    fail(errorCode, "bound directory identity changed during the operation");
  }
}

function assertCreatedDirectory({ errorCode, expectedCanonical, parentBinding, targetPath }) {
  const created = openCreatedDirectoryBinding({
    errorCode,
    expectedCanonical,
    parentBinding,
    targetPath,
  });
  closeSync(created.descriptor);
}

function openCreatedDirectoryBinding({ errorCode, expectedCanonical, parentBinding, targetPath }) {
  assertDirectoryBinding(parentBinding, errorCode);
  const created = openDirectoryBinding(targetPath, errorCode);
  if (created.canonicalPath !== path.resolve(expectedCanonical)) {
    closeSync(created.descriptor);
    fail(errorCode, "created directory resolved to a different filesystem path");
  }
  assertDirectoryBinding(parentBinding, errorCode);
  return created;
}

function materializeBoundChildDirectory({
  errorCode,
  expectedCanonical,
  mode,
  parentBinding,
  targetPath,
}) {
  if (path.dirname(path.resolve(targetPath)) !== parentBinding.path) {
    fail(errorCode, "directory sink is outside its bound parent directory");
  }
  assertDirectoryBinding(parentBinding, errorCode);
  mkdirSync(targetPath, { mode });
  assertDirectoryBinding(parentBinding, errorCode);
  return openCreatedDirectoryBinding({
    errorCode,
    expectedCanonical,
    parentBinding,
    targetPath,
  });
}

function writeExclusiveBoundFile({ bytes, errorCode, filePath, mode, parentBinding }) {
  if (path.dirname(path.resolve(filePath)) !== parentBinding.path) {
    fail(errorCode, "file sink is outside its bound parent directory");
  }
  assertDirectoryBinding(parentBinding, errorCode);
  let descriptor;
  try {
    descriptor = openSync(
      filePath,
      fsConstants.O_WRONLY |
        fsConstants.O_CREAT |
        fsConstants.O_EXCL |
        (fsConstants.O_NOFOLLOW || 0),
      mode
    );
  } catch {
    fail(errorCode, "exclusive file sink could not be created safely");
  }
  try {
    const before = fstatSync(descriptor, { bigint: true });
    if (!before.isFile()) {
      fail(errorCode, "exclusive file sink is not a regular file");
    }
    fchmodSync(descriptor, mode);
    writeFileSync(descriptor, bytes);
    const after = fstatSync(descriptor, { bigint: true });
    const atPath = lstatSync(filePath, { bigint: true });
    if (
      !after.isFile() ||
      !atPath.isFile() ||
      atPath.isSymbolicLink() ||
      after.dev !== before.dev ||
      after.ino !== before.ino ||
      atPath.dev !== before.dev ||
      atPath.ino !== before.ino
    ) {
      fail(errorCode, "exclusive file sink identity changed while it was written");
    }
  } finally {
    closeSync(descriptor);
  }
  assertDirectoryBinding(parentBinding, errorCode);
}

function pathEntryExists(candidate) {
  try {
    lstatSync(candidate);
    return true;
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return false;
    }
    throw error;
  }
}

function canonicalProspectivePath(value) {
  const absolute = path.resolve(value);
  const missingSegments = [];
  let existing = absolute;
  while (!existsSync(existing)) {
    const parent = path.dirname(existing);
    if (parent === existing) break;
    missingSegments.unshift(path.basename(existing));
    existing = parent;
  }
  const canonicalExisting = realpathSync.native(existing);
  return path.resolve(canonicalExisting, ...missingSegments);
}

function pathsOverlap(left, right) {
  const leftToRight = path.relative(left, right);
  const rightToLeft = path.relative(right, left);
  return (
    leftToRight === "" ||
    (!leftToRight.startsWith(`..${path.sep}`) &&
      leftToRight !== ".." &&
      !path.isAbsolute(leftToRight)) ||
    (!rightToLeft.startsWith(`..${path.sep}`) &&
      rightToLeft !== ".." &&
      !path.isAbsolute(rightToLeft))
  );
}

function removeExactCreatedFile(filePath, expectedText) {
  const before = lstatSync(filePath);
  if (!before.isFile() || before.isSymbolicLink() || (before.mode & 0o777) !== 0o600) {
    fail(
      "WORKSPACE_ROLLBACK_REFUSED",
      "generated workspace changed type or permissions before rollback"
    );
  }
  const actual = readBoundedRegularFile(
    filePath,
    MAX_VERIFICATION_RECEIPT_BYTES,
    "WORKSPACE_ROLLBACK"
  ).toString("utf8");
  const after = lstatSync(filePath);
  if (
    actual !== expectedText ||
    before.dev !== after.dev ||
    before.ino !== after.ino ||
    before.size !== after.size ||
    before.mtimeMs !== after.mtimeMs ||
    before.ctimeMs !== after.ctimeMs
  ) {
    fail(
      "WORKSPACE_ROLLBACK_REFUSED",
      "generated workspace changed before rollback and was preserved"
    );
  }
  unlinkSync(filePath);
}

function rollbackFailedWorkspaceCreation({
  branch,
  controlRoot,
  expectedHead,
  targetPath,
  workspaceFile,
  workspaceText,
}) {
  const targetCanonical = canonicalPath(targetPath);
  let worktrees = parseWorktrees(git(controlRoot, ["worktree", "list", "--porcelain", "-z"]));
  const created = worktrees.find((entry) => canonicalPath(entry.path) === targetCanonical);
  if (created) {
    const status = git(targetPath, ["status", "--porcelain=v1", "-z", "--untracked-files=all"]);
    const ignoredPaths = listIgnoredPaths(targetPath);
    const head = git(targetPath, ["rev-parse", "HEAD"]).trim();
    if (
      created.branch !== branch ||
      status !== "" ||
      ignoredPaths.length > 0 ||
      head !== expectedHead
    ) {
      fail(
        "WORKTREE_CREATE_ROLLBACK_REFUSED",
        "failed creation produced non-exact, dirty, or ignored recovery evidence; preserve it for owner review"
      );
    }
    git(controlRoot, ["worktree", "remove", "--force", "--force", targetPath]);
  }

  worktrees = parseWorktrees(git(controlRoot, ["worktree", "list", "--porcelain", "-z"]));
  if (
    worktrees.some(
      (entry) => canonicalPath(entry.path) === targetCanonical || entry.branch === branch
    )
  ) {
    fail(
      "WORKTREE_CREATE_ROLLBACK_FAILED",
      "failed creation remains registered; preserve it for owner review"
    );
  }
  const branchRef = `refs/heads/${branch}`;
  if (refExists(controlRoot, branchRef)) {
    const branchHead = git(controlRoot, ["rev-parse", branchRef]).trim();
    if (branchHead !== expectedHead) {
      fail(
        "WORKTREE_CREATE_ROLLBACK_REFUSED",
        "failed creation branch advanced and was preserved for owner review"
      );
    }
    git(controlRoot, ["update-ref", "-d", branchRef, expectedHead]);
  }
  if (existsSync(workspaceFile)) {
    removeExactCreatedFile(workspaceFile, workspaceText);
  }
}

function assertRemote(actual, expected, cwd) {
  if (!expected) return;
  const actualIdentity = remoteIdentity(actual, cwd);
  const expectedIdentity = remoteIdentity(expected, cwd);
  const canonicalIdentity = remoteIdentity(DEFAULT_REMOTE, cwd);
  if (
    expectedIdentity === canonicalIdentity &&
    (!isCanonicalRemoteUrl(expected) || !isCanonicalRemoteUrl(actual))
  ) {
    fail(
      "NONCANONICAL_REMOTE_URL",
      "the canonical GitHub repository requires documented HTTPS or SSH URL forms without credentials, ports, queries, or fragments"
    );
  }
  if (actualIdentity !== expectedIdentity) {
    fail(
      "REMOTE_MISMATCH",
      `origin identity ${actualIdentity} does not match expected ${expectedIdentity}`
    );
  }
}

function remoteIdentity(value, cwd) {
  const remote = String(value || "")
    .trim()
    .replace(/\/+$/, "");
  const scpLike = /^git@([^:]+):(.+?)(?:\.git)?$/i.exec(remote);
  if (scpLike) {
    return `${scpLike[1].toLowerCase()}/${scpLike[2].replace(/\.git$/i, "").toLowerCase()}`;
  }
  let parsed;
  try {
    parsed = new URL(remote);
  } catch {
    return canonicalPath(path.resolve(cwd, remote));
  }
  if (
    parsed.password ||
    ((parsed.protocol === "http:" || parsed.protocol === "https:") && parsed.username)
  ) {
    fail(
      "CREDENTIAL_BEARING_REMOTE",
      "remote URL must use a credential helper or SSH agent, not embedded HTTP credentials"
    );
  }
  if (parsed.search || parsed.hash) {
    fail("UNSAFE_REMOTE_URL", "remote URL must not contain query or fragment data");
  }
  if (parsed.protocol === "file:") return canonicalPath(parsed.pathname);
  return `${parsed.hostname.toLowerCase()}/${parsed.pathname
    .replace(/^\/+|\/+$/g, "")
    .replace(/\.git$/i, "")
    .toLowerCase()}`;
}

function containingGitRepository(targetPath) {
  const resolvedTarget = path.resolve(targetPath);
  let candidate = resolvedTarget;
  if (!existsSync(candidate) || !lstatSync(candidate).isDirectory()) {
    candidate = path.dirname(candidate);
  }
  while (!existsSync(candidate)) {
    const parent = path.dirname(candidate);
    if (parent === candidate) return "";
    candidate = parent;
  }
  const worktreeRoot = optionalGit(candidate, ["rev-parse", "--show-toplevel"]).trim();
  if (worktreeRoot) return canonicalPath(worktreeRoot);
  const gitDirectory = optionalGit(candidate, ["rev-parse", "--absolute-git-dir"]).trim();
  return gitDirectory ? canonicalPath(gitDirectory) : "";
}

function parseWorktrees(output) {
  const records = [];
  let record = {};
  for (const token of String(output).split("\0")) {
    if (!token) {
      if (record.path) records.push(record);
      record = {};
      continue;
    }
    const separator = token.indexOf(" ");
    const key = separator >= 0 ? token.slice(0, separator) : token;
    const value = separator >= 0 ? token.slice(separator + 1) : "";
    if (key === "worktree") record.path = value;
    else if (key === "branch") record.branch = value.replace(/^refs\/heads\//, "");
    else if (key === "HEAD") record.head = value;
    else if (key === "locked") {
      record.locked = true;
      record.lockReason = value;
    } else if (key === "detached") record.detached = true;
  }
  if (record.path) records.push(record);
  return records.map((entry) => ({
    ...entry,
    branch: entry.branch || "",
    locked: entry.locked === true,
  }));
}

function refExists(cwd, ref) {
  const result = spawnSync("git", ["show-ref", "--verify", "--quiet", ref], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    stdio: ["ignore", "ignore", "ignore"],
  });
  if (result.error) throw result.error;
  return result.status === 0;
}

function listIgnoredPaths(cwd) {
  return git(cwd, [
    "ls-files",
    "--others",
    "--ignored",
    "--exclude-standard",
    "--directory",
    "--no-empty-directory",
    "-z",
  ])
    .split("\0")
    .filter(Boolean)
    .sort();
}

function isExistingIgnoredPath(cwd, relativePath) {
  const root = path.resolve(cwd);
  const candidate = path.resolve(root, relativePath);
  const relative = path.relative(root, candidate);
  if (relative === ".." || relative.startsWith(`..${path.sep}`) || path.isAbsolute(relative)) {
    fail("UNSAFE_INCOMING_PATH", "incoming Git path escapes the worktree root");
  }
  try {
    lstatSync(candidate);
  } catch (error) {
    if (error && (error.code === "ENOENT" || error.code === "ENOTDIR")) {
      return false;
    }
    fail("LOCAL_PATH_INSPECTION_FAILED", "incoming path metadata could not be read safely");
  }
  const result = spawnSync("git", ["check-ignore", "--quiet", "--no-index", "--", relativePath], {
    cwd: root,
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    stdio: ["ignore", "ignore", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status === 0) return true;
  if (result.status === 1) return false;
  fail(
    "GIT_COMMAND_FAILED",
    `git check-ignore failed: ${sanitize(result.stderr || result.status)}`
  );
}

function ignoredPathIntersects(incomingPath, ignoredPaths) {
  const incoming = safeRepositoryRelativePath(incomingPath);
  return ignoredPaths.some((ignoredPath) => {
    const ignored = safeRepositoryRelativePath(ignoredPath);
    return (
      incoming === ignored ||
      incoming.startsWith(`${ignored}/`) ||
      ignored.startsWith(`${incoming}/`)
    );
  });
}

function safeRepositoryRelativePath(value) {
  const candidate = String(value || "").replace(/\/+$/, "");
  const normalized = path.posix.normalize(candidate);
  if (
    !candidate ||
    normalized === "." ||
    normalized === ".." ||
    normalized.startsWith("../") ||
    path.posix.isAbsolute(normalized)
  ) {
    fail("UNSAFE_INCOMING_PATH", "Git path is not a safe repository-relative path");
  }
  return normalized;
}

function liveRemoteBranchHead(cwd, branch) {
  const expectedRef = `refs/heads/${branch}`;
  const result = spawnSync("git", ["ls-remote", "--exit-code", "--refs", "origin", expectedRef], {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    maxBuffer: 64 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status === 2 && !result.stdout) return "";
  if (result.status !== 0) {
    fail("GIT_COMMAND_FAILED", `git ls-remote failed: ${sanitize(result.stderr || result.status)}`);
  }
  const matches = String(result.stdout || "")
    .split(/\r?\n/)
    .filter(Boolean)
    .map((line) => line.split(/\s+/))
    .filter(([sha, ref]) => /^[0-9a-f]{40,64}$/.test(sha) && ref === expectedRef);
  if (matches.length !== 1) {
    fail(
      "REMOTE_BRANCH_PROOF_INVALID",
      "live origin branch lookup did not return exactly one bounded exact ref"
    );
  }
  return matches[0][0];
}

function git(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 120_000,
    maxBuffer: 4 * 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  if (result.status !== 0) {
    fail(
      "GIT_COMMAND_FAILED",
      `git ${args[0]} failed: ${sanitize(result.stderr || result.stdout || result.status)}`
    );
  }
  return result.stdout || "";
}

function optionalGit(cwd, args) {
  const result = spawnSync("git", args, {
    cwd,
    encoding: "utf8",
    shell: false,
    timeout: 30_000,
    maxBuffer: 1024 * 1024,
    stdio: ["ignore", "pipe", "pipe"],
  });
  if (result.error) throw result.error;
  return result.status === 0 ? result.stdout || "" : "";
}

function canonicalPath(value) {
  const absolute = path.resolve(String(value || "."));
  try {
    return realpathSync.native(absolute);
  } catch {
    return absolute;
  }
}

function sanitize(value) {
  return String(value)
    .replace(/https?:\/\/[^@\s/]+@/gi, "https://REDACTED@")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

function fail(code, message) {
  throw new WorkspaceError(code, message);
}

module.exports = {
  KIMI_AUDIO_REVIEW_2026_07_26,
  WorkspaceError,
  bootstrapHumanReviewWorkspace,
  createWorkspace,
  handoffWorkspace,
  inspectHumanReviewWorkspace,
  inspectWorkspace,
  readBoundedRegularFileForTest: ({
    afterLstat,
    errorPrefix = "TEST_BOUNDED_FILE",
    filePath,
    maxBytes,
  }) => readBoundedRegularFile(filePath, maxBytes, errorPrefix, { afterLstat }),
  syncWorkspace,
};
