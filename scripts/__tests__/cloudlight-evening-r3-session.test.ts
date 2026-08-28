import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  readdirSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  unlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { basename, dirname, join } from "node:path";
import { createRequire } from "node:module";
import { spawn, spawnSync } from "node:child_process";
import { afterEach, describe, expect, it, vi } from "vitest";

const require = createRequire(import.meta.url);
const repositoryRoot = process.cwd();

type GarageBandPaths = {
  infoPlistPath: string;
  licensePath: string;
  pianoInstrumentPath: string;
  pianoSamplesPath: string;
  padPresetPath: string;
  dronePresetPath: string;
  shimmerPresetPath: string;
  reverbPresetPath: string;
  systemIdentity?: {
    architecture: string;
    macOSVersion: string;
    macOSBuild: string;
  };
};

type GarageBandEnvironment = {
  garageBandVersion: string;
  garageBandBuild: string;
  architecture: string;
  macOSVersion: string;
  macOSBuild: string;
  identitySource: string;
  infoPlist: { path: string; bytes: number; sha256: string };
  files: Array<{ role: string; path: string; bytes: number; sha256: string }>;
};

type SessionReceipt = {
  schemaVersion: number;
  receiptKind: string;
  environmentAdmissionStatus: string;
  sourceId: string;
  candidateId: string;
  mixId: string;
  mix: Record<string, number>;
  appleLoopsUsed: boolean;
  externalAudioRegions: unknown[];
  runtimePromotionStatus: string;
  ownerArtisticStatus: string;
  projectSemanticVerificationStatus: string;
  mixApplicationVerificationStatus: string;
  visualEvidenceStatus: string;
  claimBasis: {
    declaredValues: string;
    bundleInspection: string;
    garageBandUiState: string;
  };
  environment: GarageBandEnvironment;
  source: {
    config: { sha256: string; bytes: number };
    midi: { sha256: string; bytes: number };
    automation: { sha256: string; bytes: number };
    manifest: { sha256: string; bytes: number };
  };
  project: {
    path: string;
    treeSha256: string;
    bytes: number;
    inventory: Array<{ path: string; type: string; bytes?: number; sha256?: string }>;
  };
  renders: Array<{ path: string; bytes: number; sha256: string }>;
  visualEvidence: Array<{ role: string; path: string; bytes: number; sha256: string }>;
  receiptPath: string;
  receiptBytes: number;
  receiptSha256: string;
};

type SessionModule = {
  DEFAULT_GARAGEBAND_PATHS: Readonly<GarageBandPaths>;
  inspectGarageBandEnvironment: (paths: GarageBandPaths) => GarageBandEnvironment;
  writeGarageBandSessionReceipt: (input: {
    rootDir: string;
    projectPath: string;
    renderPaths: string[];
    visualEvidencePaths: string[];
    candidateId: string;
    garageBandPaths?: GarageBandPaths;
  }) => SessionReceipt;
};

const { DEFAULT_GARAGEBAND_PATHS, inspectGarageBandEnvironment, writeGarageBandSessionReceipt } =
  require("../cloudlight-evening-r3-session.cjs") as SessionModule;
const mutableNodeFs = require("node:fs") as typeof import("node:fs");

const createdRoots: string[] = [];
const SOURCE_RELATIVE_FILES = [
  "config/audio/cloudlight-evening-r3-source.json",
  "output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid",
  "output/private/cloudlight-evening-r3/source/automation.json",
  "output/private/cloudlight-evening-r3/source/source-manifest.json",
  "output/private/cloudlight-evening-r3/source/README.md",
] as const;

const EXPECTED_SOURCE_HASHES = {
  config: "61839d7a72a18fe7b632396db56d2b4fb70ee087a814819a77ac83d6dde1a8ff",
  midi: "6187d20bdd9ece8b6694b96028f5621deb19597f70ed8025790da8fdeb7f8697",
  automation: "c45551d77487ce9aea7881d67a760bf83e834ab3a28a6638264b292f83398187",
  manifest: "840c6ed88666461077054aff032b9e45ccc75a14e20de89ea1996357ba763d80",
} as const;

const ROLE_ORDER = [
  "garageband-license",
  "steinway-instrument",
  "steinway-samples",
  "pad-preset",
  "drone-preset",
  "shimmer-preset",
  "reverb-preset",
] as const;

const FIXTURE_PLIST = `<?xml version="1.0" encoding="UTF-8"?>
<!DOCTYPE plist PUBLIC "-//Apple//DTD PLIST 1.0//EN" "http://www.apple.com/DTDs/PropertyList-1.0.dtd">
<plist version="1.0"><dict>
<key>CFBundleShortVersionString</key><string>10.4.14</string>
<key>CFBundleVersion</key><string>6648</string>
</dict></plist>
`;

function sha256(contents: Buffer | string): string {
  return createHash("sha256").update(contents).digest("hex");
}

function makeTemporaryDirectory(label: string): string {
  const root = mkdtempSync(join(tmpdir(), `cloudlight-r3-session-${label}-`));
  createdRoots.push(root);
  return root;
}

function copyCanonicalSourcePack(rootDir: string): void {
  for (const relativePath of SOURCE_RELATIVE_FILES) {
    const targetPath = join(rootDir, relativePath);
    mkdirSync(dirname(targetPath), { recursive: true });
    copyFileSync(join(repositoryRoot, relativePath), targetPath);
  }
}

function makeGarageBandPaths(rootDir: string): GarageBandPaths {
  const fixtureRoot = join(rootDir, "fixtures", "garageband");
  const paths: GarageBandPaths = {
    infoPlistPath: join(fixtureRoot, "Info.plist"),
    licensePath: join(fixtureRoot, "GarageBand License Agreement.pdf"),
    pianoInstrumentPath: join(fixtureRoot, "Steinway Grand Piano 2.exs"),
    pianoSamplesPath: join(fixtureRoot, "Steinway Piano_consolidated.caf"),
    padPresetPath: join(fixtureRoot, "Ambient Pad.pst"),
    dronePresetPath: join(fixtureRoot, "Dark Swell Pad.pst"),
    shimmerPresetPath: join(fixtureRoot, "Ambient Overtones.pst"),
    reverbPresetPath: join(fixtureRoot, "Clean Ambient Tail .pst"),
    systemIdentity: {
      architecture: "arm64",
      macOSVersion: "26.6.2",
      macOSBuild: "25G83",
    },
  };
  mkdirSync(fixtureRoot, { recursive: true });
  writeFileSync(paths.infoPlistPath, FIXTURE_PLIST);
  for (const [index, filePath] of [
    paths.licensePath,
    paths.pianoInstrumentPath,
    paths.pianoSamplesPath,
    paths.padPresetPath,
    paths.dronePresetPath,
    paths.shimmerPresetPath,
    paths.reverbPresetPath,
  ].entries()) {
    writeFileSync(filePath, `fixture-${index + 1}\n`);
  }
  return paths;
}

type SessionFixture = {
  rootDir: string;
  projectPath: string;
  renderPaths: string[];
  visualEvidencePaths: string[];
  candidateId: string;
  garageBandPaths: GarageBandPaths;
};

function createGarageBandSessionFixture({
  label = "valid",
  candidateId = "candidate-01",
  renderName,
  reverseProjectInsertion = false,
  rootDirOverride,
}: {
  label?: string;
  candidateId?: string;
  renderName?: string;
  reverseProjectInsertion?: boolean;
  rootDirOverride?: string;
} = {}): SessionFixture {
  const rootDir = rootDirOverride ?? makeTemporaryDirectory(label);
  copyCanonicalSourcePack(rootDir);
  const suffix = candidateId.slice(-2);
  const projectPath = join(
    rootDir,
    "output/private/cloudlight-evening-r3/garageband",
    `Cloudlight Evening R3 Candidate ${suffix}.band`
  );
  const audioFilesPath = join(projectPath, "Media", "Audio Files");
  mkdirSync(audioFilesPath, { recursive: true });
  const projectEntries: Array<[string, string]> = [
    ["Alternatives/000/ProjectData", "PROJECT-DATA\n"],
    ["MetaData.plist", "PROJECT-METADATA\n"],
    ["Thumbs/overview.jpg", "PROJECT-THUMB\n"],
  ];
  if (reverseProjectInsertion) projectEntries.reverse();
  for (const [relativePath, contents] of projectEntries) {
    const filePath = join(projectPath, relativePath);
    mkdirSync(dirname(filePath), { recursive: true });
    writeFileSync(filePath, contents);
  }

  const resolvedRenderName = renderName ?? `${candidateId}-linear.wav`;
  const renderPath = join(
    rootDir,
    "output/private/cloudlight-evening-r3/renders",
    resolvedRenderName
  );
  mkdirSync(dirname(renderPath), { recursive: true });
  writeFileSync(renderPath, `RIFF-${resolvedRenderName}\n`);

  const visualEvidenceDirectory = join(
    rootDir,
    "output/private/cloudlight-evening-r3/evidence/garageband"
  );
  mkdirSync(visualEvidenceDirectory, { recursive: true });
  const visualEvidenceNames = [
    "export-settings.png",
    "project-overview-0-00.png",
    "track-inventory.png",
    "instrument-identities.png",
    "reverb-controls.png",
    "no-audio-regions.png",
    "piano-2-05.png",
    "fade-2-30-to-2-46.png",
    `${candidateId}-mixer.png`,
  ];
  const visualEvidencePaths = visualEvidenceNames.map((name) => {
    const evidencePath = join(visualEvidenceDirectory, name);
    writeFileSync(evidencePath, `PNG-${name}\n`);
    return evidencePath;
  });

  return {
    rootDir,
    projectPath,
    renderPaths: [renderPath],
    visualEvidencePaths,
    candidateId,
    garageBandPaths: makeGarageBandPaths(rootDir),
  };
}

function receiptDirectory(rootDir: string): string {
  return join(rootDir, "output/private/cloudlight-evening-r3/receipts");
}

function expectNamedFailure(input: SessionFixture, code: string): void {
  expect(() => writeGarageBandSessionReceipt(input)).toThrow(new RegExp(code));
  expect(existsSync(receiptDirectory(input.rootDir))).toBe(false);
}

function expectDeeplyFrozen(value: unknown): void {
  if (!value || typeof value !== "object") return;
  expect(Object.isFrozen(value)).toBe(true);
  for (const child of Object.values(value)) expectDeeplyFrozen(child);
}

function runAnchoredReceiptWriter(input: {
  cwd: string;
  targetName: string;
  expectedDev: number;
  expectedIno: number;
  anchorPath: string;
  contents: string;
  fault?: string;
}) {
  return spawnSync(
    process.execPath,
    [
      join(repositoryRoot, "scripts/cloudlight-evening-r3-session.cjs"),
      "--cloudlight-r3-internal-receipt-write",
      input.targetName,
      String(input.expectedDev),
      String(input.expectedIno),
      input.anchorPath,
      input.fault ?? "",
    ],
    {
      cwd: input.cwd,
      input: input.contents,
      encoding: "utf8",
      shell: false,
    }
  );
}

function startAnchoredReceiptWriterHandshake(input: {
  cwd: string;
  targetName: string;
  expectedDev: number;
  expectedIno: number;
  anchorPath: string;
}) {
  const child = spawn(
    process.execPath,
    [
      join(repositoryRoot, "scripts/cloudlight-evening-r3-session.cjs"),
      "--cloudlight-r3-internal-receipt-write",
      input.targetName,
      String(input.expectedDev),
      String(input.expectedIno),
      input.anchorPath,
      "handshake",
    ],
    { cwd: input.cwd, shell: false, stdio: ["pipe", "pipe", "pipe"] }
  );
  let stdout = "";
  let stderr = "";
  let ready = false;
  let resolveReady: () => void;
  let rejectReady: (error: Error) => void;
  const readyPromise = new Promise<void>((resolve, reject) => {
    resolveReady = resolve;
    rejectReady = reject;
  });
  const completed = new Promise<{ status: number | null; stdout: string; stderr: string }>(
    (resolve) => {
      child.stdout.on("data", (chunk: Buffer) => {
        stdout += chunk.toString("utf8");
        if (!ready && stdout.split("\n").some((line) => line.includes('"status":"READY"'))) {
          ready = true;
          resolveReady();
        }
      });
      child.stderr.on("data", (chunk: Buffer) => {
        stderr += chunk.toString("utf8");
      });
      child.on("close", (status) => {
        if (!ready) rejectReady(new Error(`receipt helper exited before READY: ${status}`));
        resolve({ status, stdout, stderr });
      });
    }
  );
  return { child, ready: readyPromise, completed };
}

afterEach(() => {
  for (const root of createdRoots.splice(0)) rmSync(root, { recursive: true, force: true });
});

describe("Cloudlight Evening R3 GarageBand session binding", () => {
  it("inspects the exact seven resource roles and exposes deeply immutable canonical defaults", () => {
    const fixtureRoot = makeTemporaryDirectory("environment");
    const paths = makeGarageBandPaths(fixtureRoot);
    const environment = inspectGarageBandEnvironment(paths);

    expect(environment).toMatchObject({
      garageBandVersion: "10.4.14",
      garageBandBuild: "6648",
      architecture: "arm64",
      macOSVersion: "26.6.2",
      macOSBuild: "25G83",
    });
    expect(environment.files.map((row) => row.role)).toEqual(ROLE_ORDER);
    expect(environment.infoPlist).toMatchObject({
      path: paths.infoPlistPath,
      bytes: Buffer.byteLength(FIXTURE_PLIST),
      sha256: sha256(FIXTURE_PLIST),
    });
    for (const row of environment.files) {
      expect(row.bytes).toBeGreaterThan(0);
      expect(row.sha256).toMatch(/^[a-f0-9]{64}$/);
    }

    const source = JSON.parse(
      readFileSync(join(repositoryRoot, "config/audio/cloudlight-evening-r3-source.json"), "utf8")
    );
    expect(DEFAULT_GARAGEBAND_PATHS).toMatchObject({
      infoPlistPath: "/Applications/GarageBand.app/Contents/Info.plist",
      licensePath:
        "/Applications/GarageBand.app/Contents/Resources/GarageBand License Agreement.pdf",
      pianoInstrumentPath: source.garageBand.pianoInstrument,
      pianoSamplesPath: source.garageBand.pianoSamples,
      padPresetPath: source.garageBand.padPreset,
      dronePresetPath: source.garageBand.dronePreset,
      shimmerPresetPath: source.garageBand.shimmerPreset,
      reverbPresetPath: source.garageBand.reverbPreset,
    });
    expectDeeplyFrozen(DEFAULT_GARAGEBAND_PATHS);
  });

  it("writes a hash-bound private receipt with source, environment, project, render, and status evidence", () => {
    const fixture = createGarageBandSessionFixture();
    const receipt = writeGarageBandSessionReceipt(fixture);

    expect(receipt).toMatchObject({
      schemaVersion: 1,
      receiptKind: "TEST_ONLY_NOT_ADMITTED",
      environmentAdmissionStatus: "TEST_ONLY_NOT_ADMITTED",
      sourceId: "cloudlight-evening-r3",
      candidateId: "candidate-01",
      mixId: "candidate-01",
      mix: {
        padDb: -12,
        droneDb: -21,
        shimmerDb: -29,
        shimmerPanPercent: 35,
        pianoDb: -27,
      },
      appleLoopsUsed: false,
      externalAudioRegions: [],
      runtimePromotionStatus: "NOT_ALLOWED",
      ownerArtisticStatus: "UNVERIFIED",
      projectSemanticVerificationStatus: "UNVERIFIED",
      mixApplicationVerificationStatus: "UNVERIFIED",
      visualEvidenceStatus: "HASH_BOUND_NOT_SEMANTICALLY_VERIFIED",
      claimBasis: {
        declaredValues: "CANONICAL_SOURCE_DECLARATION_HASH_BOUND",
        bundleInspection: "STRUCTURAL_INVENTORY_AND_EMPTY_MEDIA_AUDIO_FILES_ONLY",
        garageBandUiState: "UNVERIFIED_REQUIRES_HUMAN_CONTROLLER_REVIEW",
      },
    });
    expect(receipt.source.config.sha256).toBe(EXPECTED_SOURCE_HASHES.config);
    expect(receipt.source.midi.sha256).toBe(EXPECTED_SOURCE_HASHES.midi);
    expect(receipt.source.automation.sha256).toBe(EXPECTED_SOURCE_HASHES.automation);
    expect(receipt.source.manifest.sha256).toBe(EXPECTED_SOURCE_HASHES.manifest);
    expect(receipt.environment.files.map((row) => row.role)).toEqual(ROLE_ORDER);
    expect(receipt.project.inventory.map((row) => row.path)).toEqual(
      [...receipt.project.inventory.map((row) => row.path)].sort()
    );
    expect(receipt.project.bytes).toBe(
      Buffer.byteLength("PROJECT-DATA\n") +
        Buffer.byteLength("PROJECT-METADATA\n") +
        Buffer.byteLength("PROJECT-THUMB\n")
    );
    expect(receipt.project.treeSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(receipt.project.path).toBe(
      "output/private/cloudlight-evening-r3/garageband/Cloudlight Evening R3 Candidate 01.band"
    );
    expect(receipt.renders).toHaveLength(1);
    expect(receipt.renders[0]).toMatchObject({
      path: "output/private/cloudlight-evening-r3/renders/candidate-01-linear.wav",
      sha256: sha256("RIFF-candidate-01-linear.wav\n"),
    });
    expect(receipt.visualEvidence.map((row) => row.path)).toEqual([
      "output/private/cloudlight-evening-r3/evidence/garageband/export-settings.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/project-overview-0-00.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/track-inventory.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/instrument-identities.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/reverb-controls.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/no-audio-regions.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/piano-2-05.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/fade-2-30-to-2-46.png",
      "output/private/cloudlight-evening-r3/evidence/garageband/candidate-01-mixer.png",
    ]);
    expect(receipt.receiptPath).toBe(
      join(receiptDirectory(fixture.rootDir), "candidate-01-linear-session-receipt.json")
    );
    expect(lstatSync(receipt.receiptPath).isFile()).toBe(true);
    expect(lstatSync(receipt.receiptPath).nlink).toBe(1);
    const persisted = readFileSync(receipt.receiptPath);
    expect(persisted.length).toBe(receipt.receiptBytes);
    expect(sha256(persisted)).toBe(receipt.receiptSha256);
    const persistedReceipt = JSON.parse(persisted.toString("utf8"));
    const {
      receiptPath: _receiptPath,
      receiptBytes: _receiptBytes,
      receiptSha256: _receiptSha256,
      ...serializableReceipt
    } = receipt;
    expect(persistedReceipt).toEqual(serializableReceipt);
  });

  it("hash-binds the exact visual evidence set without claiming GarageBand semantics", () => {
    const valid = createGarageBandSessionFixture({ label: "visual-evidence-valid" });
    valid.visualEvidencePaths.reverse();
    const receipt = writeGarageBandSessionReceipt(valid);
    expect(receipt.visualEvidenceStatus).toBe("HASH_BOUND_NOT_SEMANTICALLY_VERIFIED");
    expect(receipt.projectSemanticVerificationStatus).toBe("UNVERIFIED");
    expect(receipt.mixApplicationVerificationStatus).toBe("UNVERIFIED");
    expect(receipt.claimBasis).toEqual({
      declaredValues: "CANONICAL_SOURCE_DECLARATION_HASH_BOUND",
      bundleInspection: "STRUCTURAL_INVENTORY_AND_EMPTY_MEDIA_AUDIO_FILES_ONLY",
      garageBandUiState: "UNVERIFIED_REQUIRES_HUMAN_CONTROLLER_REVIEW",
    });
    expect(receipt.visualEvidence).toHaveLength(9);
    expect(receipt.visualEvidence.every((row) => row.bytes > 0)).toBe(true);
    expect(receipt.visualEvidence.every((row) => /^[a-f0-9]{64}$/.test(row.sha256))).toBe(true);

    for (const [label, malformedValue] of [
      ["null", null],
      ["bigint", 1n],
      ["object", {}],
      ["undefined", undefined],
    ] as const) {
      const malformed = createGarageBandSessionFixture({ label: `visual-evidence-${label}` });
      malformed.visualEvidencePaths[0] = malformedValue as unknown as string;
      expectNamedFailure(malformed, "VISUAL_EVIDENCE_PATH_INVALID");
    }
    const sparse = createGarageBandSessionFixture({ label: "visual-evidence-sparse" });
    sparse.visualEvidencePaths = Array(9);
    expectNamedFailure(sparse, "VISUAL_EVIDENCE_PATH_INVALID");

    const missing = createGarageBandSessionFixture({ label: "visual-evidence-missing" });
    missing.visualEvidencePaths.pop();
    expectNamedFailure(missing, "VISUAL_EVIDENCE_COUNT_INVALID");

    const wrongName = createGarageBandSessionFixture({ label: "visual-evidence-name" });
    const renamedEvidence = join(dirname(wrongName.visualEvidencePaths[0]), "wrong-name.png");
    renameSync(wrongName.visualEvidencePaths[0], renamedEvidence);
    wrongName.visualEvidencePaths[0] = renamedEvidence;
    expectNamedFailure(wrongName, "VISUAL_EVIDENCE_NAME_MISMATCH");

    const nested = createGarageBandSessionFixture({ label: "visual-evidence-nested" });
    const nestedEvidence = join(
      dirname(nested.visualEvidencePaths[0]),
      "nested",
      basename(nested.visualEvidencePaths[0])
    );
    mkdirSync(dirname(nestedEvidence), { recursive: true });
    renameSync(nested.visualEvidencePaths[0], nestedEvidence);
    nested.visualEvidencePaths[0] = nestedEvidence;
    expectNamedFailure(nested, "VISUAL_EVIDENCE_PATH_NOT_DIRECT");

    const symlinked = createGarageBandSessionFixture({ label: "visual-evidence-symlink" });
    const evidenceTarget = join(makeTemporaryDirectory("visual-evidence-outside"), "evidence.png");
    writeFileSync(evidenceTarget, "OUTSIDE-EVIDENCE\n");
    unlinkSync(symlinked.visualEvidencePaths[0]);
    symlinkSync(evidenceTarget, symlinked.visualEvidencePaths[0]);
    expectNamedFailure(symlinked, "VISUAL_EVIDENCE_SYMLINK");
  });

  it("documents the exact visual evidence and fail-closed GarageBand boundaries", () => {
    const runbook = readFileSync(
      join(repositoryRoot, "docs/audio/cloudlight-evening-r3-production-runbook.md"),
      "utf8"
    );
    for (const evidenceName of [
      "export-settings.png",
      "project-overview-0-00.png",
      "track-inventory.png",
      "instrument-identities.png",
      "reverb-controls.png",
      "no-audio-regions.png",
      "piano-2-05.png",
      "fade-2-30-to-2-46.png",
      "candidate-01-mixer.png",
      "candidate-02-mixer.png",
      "candidate-03-mixer.png",
    ]) {
      expect(runbook).toContain(evidenceName);
    }
    expect(runbook).toContain("projectSemanticVerificationStatus: UNVERIFIED");
    expect(runbook).toContain("mixApplicationVerificationStatus: UNVERIFIED");
    expect(runbook).toContain("visualEvidenceStatus: HASH_BOUND_NOT_SEMANTICALLY_VERIFIED");
    expect(runbook).toContain(
      "If GarageBand does not visibly expose any named reverb control needed for those exact values, stop"
    );
    expect(runbook).toContain(
      "If 48 kHz, 24-bit output, or normalization-off is not actually available and visible, stop"
    );
  });

  it("admits fixture receipts only under one disposable temp root and marks them non-admitted", () => {
    const positive = createGarageBandSessionFixture({ label: "fixture-admission-positive" });
    expect(writeGarageBandSessionReceipt(positive)).toMatchObject({
      receiptKind: "TEST_ONLY_NOT_ADMITTED",
      environmentAdmissionStatus: "TEST_ONLY_NOT_ADMITTED",
      environment: { identitySource: "UNIT_TEST_FIXTURE" },
    });

    const repositoryPrivateRoot = mkdtempSync(
      join(repositoryRoot, "output/private/cloudlight-r3-session-repository-fixture-")
    );
    createdRoots.push(repositoryPrivateRoot);
    const repositoryFixture = createGarageBandSessionFixture({
      label: "repository-fixture",
      rootDirOverride: repositoryPrivateRoot,
    });
    expectNamedFailure(repositoryFixture, "FIXTURE_ROOT_NOT_TEMP");

    const omittedOverride = createGarageBandSessionFixture({ label: "omitted-override" });
    const { garageBandPaths: _omittedPaths, ...withoutOverride } = omittedOverride;
    expect(() => writeGarageBandSessionReceipt(withoutOverride)).toThrow(
      /TASK4_ROOT_NOT_CANONICAL/
    );
    expect(existsSync(receiptDirectory(omittedOverride.rootDir))).toBe(false);

    const localOverride = createGarageBandSessionFixture({ label: "local-override" });
    localOverride.garageBandPaths = { ...DEFAULT_GARAGEBAND_PATHS };
    expectNamedFailure(localOverride, "ENVIRONMENT_OVERRIDE_NOT_TEST_FIXTURE");
  });

  it("binds four separate Task 4 receipts for all mixes and the candidate-01 rerender", () => {
    const candidate01 = createGarageBandSessionFixture({ label: "candidate-01-primary" });
    const receipt01 = writeGarageBandSessionReceipt(candidate01);
    expect(receipt01.mix).toEqual({
      padDb: -12,
      droneDb: -21,
      shimmerDb: -29,
      shimmerPanPercent: 35,
      pianoDb: -27,
    });
    expect(receipt01.renders.map((row) => basename(row.path))).toEqual(["candidate-01-linear.wav"]);
    expect(basename(receipt01.receiptPath)).toBe("candidate-01-linear-session-receipt.json");

    const candidate01Rerender = createGarageBandSessionFixture({
      label: "candidate-01-rerender",
      renderName: "candidate-01-linear-rerender.wav",
    });
    const rerenderReceipt = writeGarageBandSessionReceipt(candidate01Rerender);
    expect(rerenderReceipt.mix).toEqual(receipt01.mix);
    expect(rerenderReceipt.renders.map((row) => basename(row.path))).toEqual([
      "candidate-01-linear-rerender.wav",
    ]);
    expect(basename(rerenderReceipt.receiptPath)).toBe(
      "candidate-01-linear-rerender-session-receipt.json"
    );

    const candidate02 = createGarageBandSessionFixture({
      label: "candidate-02",
      candidateId: "candidate-02",
    });
    expect(writeGarageBandSessionReceipt(candidate02).mix).toEqual({
      padDb: -12,
      droneDb: -21,
      shimmerDb: -27.8,
      shimmerPanPercent: 45,
      pianoDb: -27,
    });

    const candidate03 = createGarageBandSessionFixture({
      label: "candidate-03",
      candidateId: "candidate-03",
    });
    expect(writeGarageBandSessionReceipt(candidate03).mix).toEqual({
      padDb: -12,
      droneDb: -21,
      shimmerDb: -29,
      shimmerPanPercent: 35,
      pianoDb: -25.8,
    });

    const combined = createGarageBandSessionFixture({ label: "candidate-01-combined" });
    const combinedRerender = join(
      combined.rootDir,
      "output/private/cloudlight-evening-r3/renders/candidate-01-linear-rerender.wav"
    );
    writeFileSync(combinedRerender, "RIFF-candidate-01-linear-rerender.wav\n");
    combined.renderPaths.push(combinedRerender);
    expectNamedFailure(combined, "RENDER_COUNT_INVALID");
  });

  it("rejects missing, symlinked, non-regular, and empty environment files", () => {
    const cases: Array<{
      label: string;
      mutate: (paths: GarageBandPaths, root: string) => void;
      code: string;
    }> = [
      {
        label: "missing",
        mutate: (paths) => unlinkSync(paths.licensePath),
        code: "ENVIRONMENT_FILE_MISSING",
      },
      {
        label: "symlink",
        mutate: (paths, root) => {
          const outside = join(root, "outside-license.pdf");
          writeFileSync(outside, "OUTSIDE\n");
          unlinkSync(paths.licensePath);
          symlinkSync(outside, paths.licensePath);
        },
        code: "ENVIRONMENT_FILE_SYMLINK",
      },
      {
        label: "directory",
        mutate: (paths) => {
          unlinkSync(paths.licensePath);
          mkdirSync(paths.licensePath);
        },
        code: "ENVIRONMENT_FILE_NOT_REGULAR",
      },
      {
        label: "empty",
        mutate: (paths) => writeFileSync(paths.licensePath, ""),
        code: "ENVIRONMENT_FILE_EMPTY",
      },
    ];

    for (const row of cases) {
      const root = makeTemporaryDirectory(`environment-${row.label}`);
      const paths = makeGarageBandPaths(root);
      row.mutate(paths, root);
      expect(() => inspectGarageBandEnvironment(paths)).toThrow(new RegExp(row.code));
    }
  });

  it("parses the binary plist from the already-hashed bytes and rejects noncanonical live paths", () => {
    const root = makeTemporaryDirectory("binary-plist");
    const paths = makeGarageBandPaths(root);
    copyFileSync(DEFAULT_GARAGEBAND_PATHS.infoPlistPath, paths.infoPlistPath);
    const readFileSpy = vi.spyOn(mutableNodeFs, "readFileSync").mockImplementation(() => {
      throw new Error("INFO_PLIST_PATH_REOPENED");
    });
    try {
      const environment = inspectGarageBandEnvironment(paths);
      expect(environment).toMatchObject({
        garageBandVersion: "10.4.14",
        garageBandBuild: "6648",
        architecture: "arm64",
      });
    } finally {
      readFileSpy.mockRestore();
    }

    const noncanonical = makeGarageBandPaths(makeTemporaryDirectory("noncanonical-live"));
    delete noncanonical.systemIdentity;
    expect(() => inspectGarageBandEnvironment(noncanonical)).toThrow(
      /ENVIRONMENT_PATHS_NOT_CANONICAL/
    );
  });

  it("rejects root, private-ancestor, project, and render symlinks before writing a receipt", () => {
    const rootFixture = createGarageBandSessionFixture({ label: "root-symlink" });
    const rootAlias = join(makeTemporaryDirectory("root-alias-parent"), "repo-link");
    symlinkSync(rootFixture.rootDir, rootAlias);
    expectNamedFailure({ ...rootFixture, rootDir: rootAlias }, "ROOT_SYMLINK");

    const ancestorFixture = createGarageBandSessionFixture({ label: "ancestor-symlink" });
    const outsideRoot = makeTemporaryDirectory("ancestor-outside");
    const movedOutput = join(outsideRoot, "output");
    renameSync(join(ancestorFixture.rootDir, "output"), movedOutput);
    symlinkSync(movedOutput, join(ancestorFixture.rootDir, "output"));
    expectNamedFailure(ancestorFixture, "PRIVATE_ANCESTOR_SYMLINK");

    const projectFixture = createGarageBandSessionFixture({ label: "project-symlink" });
    const movedProject = join(
      makeTemporaryDirectory("project-outside"),
      basename(projectFixture.projectPath)
    );
    renameSync(projectFixture.projectPath, movedProject);
    symlinkSync(movedProject, projectFixture.projectPath);
    expectNamedFailure(projectFixture, "PROJECT_SYMLINK");

    const renderFixture = createGarageBandSessionFixture({ label: "render-symlink" });
    const movedRender = join(
      makeTemporaryDirectory("render-outside"),
      basename(renderFixture.renderPaths[0])
    );
    renameSync(renderFixture.renderPaths[0], movedRender);
    symlinkSync(movedRender, renderFixture.renderPaths[0]);
    expectNamedFailure(renderFixture, "RENDER_SYMLINK");
  });

  it("rejects project escapes, hardlinks, and populated GarageBand Audio Files", () => {
    const escaped = createGarageBandSessionFixture({ label: "project-escape" });
    const outsideProject = join(
      makeTemporaryDirectory("project-escape-outside"),
      basename(escaped.projectPath)
    );
    mkdirSync(outsideProject, { recursive: true });
    writeFileSync(join(outsideProject, "ProjectData"), "OUTSIDE\n");
    expectNamedFailure({ ...escaped, projectPath: outsideProject }, "PROJECT_PATH_ESCAPE");

    const hardlinked = createGarageBandSessionFixture({ label: "project-hardlink" });
    const projectData = join(hardlinked.projectPath, "Alternatives/000/ProjectData");
    linkSync(projectData, join(hardlinked.projectPath, "Alternatives/000/ProjectData-copy"));
    expectNamedFailure(hardlinked, "PROJECT_FILE_HARDLINK");

    const populated = createGarageBandSessionFixture({ label: "audio-files" });
    writeFileSync(join(populated.projectPath, "Media/Audio Files/imported.wav"), "AUDIO\n");
    expectNamedFailure(populated, "PROJECT_AUDIO_FILES_POPULATED");
  });

  it("accepts project and render artifacts only at their exact direct private paths", () => {
    const nestedProject = createGarageBandSessionFixture({ label: "nested-direct-project" });
    const nestedProjectPath = join(
      dirname(nestedProject.projectPath),
      "nested",
      basename(nestedProject.projectPath)
    );
    mkdirSync(dirname(nestedProjectPath), { recursive: true });
    renameSync(nestedProject.projectPath, nestedProjectPath);
    expectNamedFailure(
      { ...nestedProject, projectPath: nestedProjectPath },
      "PROJECT_PATH_NOT_DIRECT"
    );

    const nestedRender = createGarageBandSessionFixture({ label: "nested-direct-render" });
    const nestedRenderPath = join(
      dirname(nestedRender.renderPaths[0]),
      "nested",
      basename(nestedRender.renderPaths[0])
    );
    mkdirSync(dirname(nestedRenderPath), { recursive: true });
    renameSync(nestedRender.renderPaths[0], nestedRenderPath);
    expectNamedFailure(
      { ...nestedRender, renderPaths: [nestedRenderPath] },
      "RENDER_PATH_NOT_DIRECT"
    );
  });

  it("rejects nested project symlinks, non-regular leaves, and empty files", () => {
    const symlinked = createGarageBandSessionFixture({ label: "nested-project-symlink" });
    const projectData = join(symlinked.projectPath, "Alternatives/000/ProjectData");
    const outsideFile = join(makeTemporaryDirectory("nested-project-outside"), "ProjectData");
    writeFileSync(outsideFile, "OUTSIDE\n");
    unlinkSync(projectData);
    symlinkSync(outsideFile, projectData);
    expectNamedFailure(symlinked, "PROJECT_ENTRY_SYMLINK");

    const empty = createGarageBandSessionFixture({ label: "nested-project-empty" });
    writeFileSync(join(empty.projectPath, "MetaData.plist"), "");
    expectNamedFailure(empty, "PROJECT_FILE_EMPTY");

    const nonRegular = createGarageBandSessionFixture({ label: "nested-project-fifo" });
    const fifoPath = join(nonRegular.projectPath, "ProjectData.fifo");
    const mkfifo = spawnSync("/usr/bin/mkfifo", [fifoPath], {
      encoding: "utf8",
      shell: false,
    });
    expect(mkfifo.status).toBe(0);
    expectNamedFailure(nonRegular, "PROJECT_ENTRY_NOT_REGULAR");

    const emptyProject = createGarageBandSessionFixture({ label: "empty-project" });
    for (const relativePath of [
      "Alternatives/000/ProjectData",
      "MetaData.plist",
      "Thumbs/overview.jpg",
    ]) {
      unlinkSync(join(emptyProject.projectPath, relativePath));
    }
    expectNamedFailure(emptyProject, "PROJECT_EMPTY");
  });

  it("rejects missing, empty, hardlinked, escaped, duplicated, and incorrectly named renders", () => {
    const missing = createGarageBandSessionFixture({ label: "render-missing" });
    unlinkSync(missing.renderPaths[0]);
    expectNamedFailure(missing, "RENDER_MISSING");

    const empty = createGarageBandSessionFixture({ label: "render-empty" });
    writeFileSync(empty.renderPaths[0], "");
    expectNamedFailure(empty, "RENDER_EMPTY");

    const hardlinked = createGarageBandSessionFixture({ label: "render-hardlink" });
    const hardlinkTarget = join(makeTemporaryDirectory("render-hardlink-outside"), "copy.wav");
    linkSync(hardlinked.renderPaths[0], hardlinkTarget);
    expectNamedFailure(hardlinked, "RENDER_HARDLINK");

    const escaped = createGarageBandSessionFixture({ label: "render-escape" });
    const outsideRender = join(
      makeTemporaryDirectory("render-escape-outside"),
      "candidate-01-linear.wav"
    );
    writeFileSync(outsideRender, "RIFF-OUTSIDE\n");
    expectNamedFailure({ ...escaped, renderPaths: [outsideRender] }, "RENDER_PATH_ESCAPE");

    const duplicated = createGarageBandSessionFixture({ label: "render-duplicate" });
    expectNamedFailure(
      { ...duplicated, renderPaths: [duplicated.renderPaths[0], duplicated.renderPaths[0]] },
      "RENDER_COUNT_INVALID"
    );

    const wrongName = createGarageBandSessionFixture({
      label: "render-name",
      renderName: "candidate-02-linear.wav",
    });
    expectNamedFailure(wrongName, "RENDER_NAME_MISMATCH");

    const wrongProject = createGarageBandSessionFixture({ label: "project-name" });
    expectNamedFailure({ ...wrongProject, candidateId: "candidate-02" }, "PROJECT_NAME_MISMATCH");

    const wrongId = createGarageBandSessionFixture({ label: "candidate-id" });
    expectNamedFailure({ ...wrongId, candidateId: "candidate-04" }, "CANDIDATE_ID_INVALID");
  });

  it("totally rejects malformed and sparse render arrays with a named violation", () => {
    const invalidValues: unknown[] = [null, BigInt(1), {}, undefined];
    for (const [index, invalidValue] of invalidValues.entries()) {
      const fixture = createGarageBandSessionFixture({ label: `render-invalid-${index}` });
      expectNamedFailure(
        { ...fixture, renderPaths: [invalidValue] as unknown as string[] },
        "RENDER_PATH_INVALID"
      );
    }

    const sparseFixture = createGarageBandSessionFixture({ label: "render-sparse" });
    const sparse = Array(1) as string[];
    expect(Object.prototype.hasOwnProperty.call(sparse, 0)).toBe(false);
    expectNamedFailure({ ...sparseFixture, renderPaths: sparse }, "RENDER_PATH_INVALID");
  });

  it("rejects corrupted source bytes and missing source hash declarations", () => {
    const corrupted = createGarageBandSessionFixture({ label: "source-corrupt" });
    writeFileSync(
      join(
        corrupted.rootDir,
        "output/private/cloudlight-evening-r3/source/cloudlight-evening-r3.mid"
      ),
      "CORRUPTED\n"
    );
    expectNamedFailure(corrupted, "SOURCE_FILE_HASH_MISMATCH");

    const missingHash = createGarageBandSessionFixture({ label: "source-missing-hash" });
    const manifestPath = join(
      missingHash.rootDir,
      "output/private/cloudlight-evening-r3/source/source-manifest.json"
    );
    const manifest = JSON.parse(readFileSync(manifestPath, "utf8"));
    delete manifest.midiSha256;
    writeFileSync(manifestPath, `${JSON.stringify(manifest, null, 2)}\n`);
    expectNamedFailure(missingHash, "SOURCE_MANIFEST_MISSING_HASH");

    const missingFile = createGarageBandSessionFixture({ label: "source-missing-file" });
    unlinkSync(
      join(missingFile.rootDir, "output/private/cloudlight-evening-r3/source/automation.json")
    );
    expectNamedFailure(missingFile, "SOURCE_FILE_MISSING");

    const unexpectedFile = createGarageBandSessionFixture({ label: "source-extra-file" });
    writeFileSync(
      join(unexpectedFile.rootDir, "output/private/cloudlight-evening-r3/source/unexpected.txt"),
      "UNEXPECTED\n"
    );
    expectNamedFailure(unexpectedFile, "SOURCE_INVENTORY_MISMATCH");
  });

  it("hashes project trees deterministically regardless of directory insertion order", () => {
    const first = createGarageBandSessionFixture({ label: "ordering-a" });
    const second = createGarageBandSessionFixture({
      label: "ordering-b",
      reverseProjectInsertion: true,
    });
    const firstReceipt = writeGarageBandSessionReceipt(first);
    const secondReceipt = writeGarageBandSessionReceipt(second);

    expect(firstReceipt.project.inventory).toEqual(secondReceipt.project.inventory);
    expect(firstReceipt.project.bytes).toBe(secondReceipt.project.bytes);
    expect(firstReceipt.project.treeSha256).toBe(secondReceipt.project.treeSha256);
    expect(readdirSync(dirname(firstReceipt.receiptPath))).toEqual([
      "candidate-01-linear-session-receipt.json",
    ]);
  });

  it("uses total UTF-8 byte ordering when distinct project names collate equally", () => {
    const first = createGarageBandSessionFixture({ label: "utf8-order-a" });
    const second = createGarageBandSessionFixture({ label: "utf8-order-b" });
    const ambiguousNames = ["a", "a\u200b"];
    for (const fixture of [first, second]) {
      const orderingDirectory = join(fixture.projectPath, "Ordering");
      mkdirSync(orderingDirectory);
      for (const name of ambiguousNames) writeFileSync(join(orderingDirectory, name), `${name}\n`);
    }
    expect(ambiguousNames[0].localeCompare(ambiguousNames[1], "en")).toBe(0);

    const firstReceipt = writeGarageBandSessionReceipt(first);
    const originalReaddir = mutableNodeFs.readdirSync;
    const readdirSpy = vi.spyOn(mutableNodeFs, "readdirSync").mockImplementation(((
      directoryPath: Parameters<typeof originalReaddir>[0],
      options?: unknown
    ) => {
      const result = Reflect.apply(originalReaddir, mutableNodeFs, [directoryPath, options]);
      if (
        typeof directoryPath === "string" &&
        directoryPath === join(second.projectPath, "Ordering") &&
        Array.isArray(result)
      ) {
        return [...result].reverse();
      }
      return result;
    }) as typeof originalReaddir);
    let secondReceipt: SessionReceipt;
    try {
      secondReceipt = writeGarageBandSessionReceipt(second);
    } finally {
      readdirSpy.mockRestore();
    }

    expect(secondReceipt.project.inventory).toEqual(firstReceipt.project.inventory);
    expect(secondReceipt.project.treeSha256).toBe(firstReceipt.project.treeSha256);
  });

  it("never follows or overwrites receipt directory, leaf symlink, or hardlink targets", () => {
    const directorySymlink = createGarageBandSessionFixture({ label: "receipt-dir-symlink" });
    const outsideDirectory = makeTemporaryDirectory("receipt-dir-outside");
    symlinkSync(outsideDirectory, receiptDirectory(directorySymlink.rootDir));
    expect(() => writeGarageBandSessionReceipt(directorySymlink)).toThrow(
      /RECEIPT_DIRECTORY_SYMLINK/
    );
    expect(readdirSync(outsideDirectory)).toEqual([]);

    const leafSymlink = createGarageBandSessionFixture({ label: "receipt-leaf-symlink" });
    mkdirSync(receiptDirectory(leafSymlink.rootDir));
    const outsideSymlinkTarget = join(
      makeTemporaryDirectory("receipt-leaf-outside"),
      "sentinel.json"
    );
    writeFileSync(outsideSymlinkTarget, "SENTINEL-SYMLINK\n");
    symlinkSync(
      outsideSymlinkTarget,
      join(receiptDirectory(leafSymlink.rootDir), "candidate-01-linear-session-receipt.json")
    );
    expect(() => writeGarageBandSessionReceipt(leafSymlink)).toThrow(/RECEIPT_LEAF_UNSAFE/);
    expect(readFileSync(outsideSymlinkTarget, "utf8")).toBe("SENTINEL-SYMLINK\n");

    const leafHardlink = createGarageBandSessionFixture({ label: "receipt-leaf-hardlink" });
    mkdirSync(receiptDirectory(leafHardlink.rootDir));
    const outsideHardlinkTarget = join(
      makeTemporaryDirectory("receipt-hardlink-outside"),
      "sentinel.json"
    );
    writeFileSync(outsideHardlinkTarget, "SENTINEL-HARDLINK\n");
    linkSync(
      outsideHardlinkTarget,
      join(receiptDirectory(leafHardlink.rootDir), "candidate-01-linear-session-receipt.json")
    );
    expect(() => writeGarageBandSessionReceipt(leafHardlink)).toThrow(/RECEIPT_LEAF_UNSAFE/);
    expect(readFileSync(outsideHardlinkTarget, "utf8")).toBe("SENTINEL-HARDLINK\n");
  });

  it("rejects unknown, staged, and non-regular entries in an existing receipt directory", () => {
    const unexpected = createGarageBandSessionFixture({ label: "receipt-inventory-extra" });
    mkdirSync(receiptDirectory(unexpected.rootDir));
    writeFileSync(join(receiptDirectory(unexpected.rootDir), "unexpected.json"), "{}\n");
    expect(() => writeGarageBandSessionReceipt(unexpected)).toThrow(
      /RECEIPT_DIRECTORY_INVENTORY_UNSAFE/
    );

    const staged = createGarageBandSessionFixture({ label: "receipt-inventory-stage" });
    mkdirSync(receiptDirectory(staged.rootDir));
    writeFileSync(join(receiptDirectory(staged.rootDir), ".candidate.stage"), "STAGE\n");
    expect(() => writeGarageBandSessionReceipt(staged)).toThrow(
      /RECEIPT_DIRECTORY_INVENTORY_UNSAFE/
    );

    const nonRegular = createGarageBandSessionFixture({ label: "receipt-inventory-directory" });
    mkdirSync(receiptDirectory(nonRegular.rootDir));
    mkdirSync(
      join(receiptDirectory(nonRegular.rootDir), "candidate-03-linear-session-receipt.json")
    );
    expect(() => writeGarageBandSessionReceipt(nonRegular)).toThrow(
      /RECEIPT_DIRECTORY_INVENTORY_UNSAFE/
    );
  });

  it("anchors the receipt writer to a directory inode across pre-spawn and post-bind swaps", async () => {
    const anchorRoot = makeTemporaryDirectory("receipt-anchor");
    const outsideRoot = makeTemporaryDirectory("receipt-anchor-outside");
    const originalAnchor = join(anchorRoot, "receipts");
    const relocatedAnchor = join(anchorRoot, "relocated-receipts");
    mkdirSync(originalAnchor);
    const expected = statSync(originalAnchor);

    renameSync(originalAnchor, relocatedAnchor);
    symlinkSync(outsideRoot, originalAnchor);
    const preSpawn = runAnchoredReceiptWriter({
      cwd: originalAnchor,
      targetName: "candidate-01-linear-session-receipt.json",
      expectedDev: expected.dev,
      expectedIno: expected.ino,
      anchorPath: relocatedAnchor,
      contents: "{}\n",
    });
    expect(preSpawn.status).not.toBe(0);
    expect(JSON.parse(preSpawn.stdout)).toMatchObject({
      ok: false,
      error: "RECEIPT_WRITE_ANCHOR_MISMATCH",
    });
    expect(readdirSync(outsideRoot)).toEqual([]);
    unlinkSync(originalAnchor);
    renameSync(relocatedAnchor, originalAnchor);

    const bound = startAnchoredReceiptWriterHandshake({
      cwd: originalAnchor,
      targetName: "candidate-01-linear-session-receipt.json",
      expectedDev: expected.dev,
      expectedIno: expected.ino,
      anchorPath: originalAnchor,
    });
    try {
      await bound.ready;
      renameSync(originalAnchor, relocatedAnchor);
      symlinkSync(outsideRoot, originalAnchor);
      bound.child.stdin.end("{}\n");
      const completed = await bound.completed;
      expect(completed.status).not.toBe(0);
      expect(completed.stderr).toBe("");
      const responses = completed.stdout
        .split("\n")
        .filter(Boolean)
        .map((line) => JSON.parse(line));
      expect(responses.at(-1)).toMatchObject({
        ok: false,
        error: "RECEIPT_WRITE_ANCHOR_MOVED",
      });
      expect(readdirSync(outsideRoot)).toEqual([]);
      expect(readdirSync(relocatedAnchor)).toEqual([]);
      unlinkSync(originalAnchor);
      renameSync(relocatedAnchor, originalAnchor);
    } finally {
      if (bound.child.exitCode === null) {
        bound.child.kill("SIGKILL");
        await bound.completed;
      }
    }
  });

  it("NACKs and removes a publicly published receipt when its directory moves before parent ACK", () => {
    const fixture = createGarageBandSessionFixture({ label: "receipt-public-late-swap" });
    const originalAnchor = receiptDirectory(fixture.rootDir);
    const relocatedAnchor = join(dirname(originalAnchor), "relocated-receipts");
    const outsideRoot = makeTemporaryDirectory("receipt-public-late-swap-outside");
    const targetName = "candidate-01-linear-session-receipt.json";
    mkdirSync(originalAnchor);

    const originalLstat = mutableNodeFs.lstatSync;
    let swapped = false;
    const lstatSpy = vi.spyOn(mutableNodeFs, "lstatSync").mockImplementation(((
      targetPath: Parameters<typeof originalLstat>[0],
      options?: unknown
    ) => {
      if (
        !swapped &&
        targetPath === originalAnchor &&
        existsSync(join(originalAnchor, targetName))
      ) {
        swapped = true;
        renameSync(originalAnchor, relocatedAnchor);
        symlinkSync(outsideRoot, originalAnchor);
      }
      return Reflect.apply(originalLstat, mutableNodeFs, [targetPath, options]);
    }) as typeof originalLstat);
    try {
      expect(() => writeGarageBandSessionReceipt(fixture)).toThrow(/RECEIPT_WRITE_ANCHOR_MOVED/);
    } finally {
      lstatSpy.mockRestore();
    }

    expect(swapped).toBe(true);
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(readdirSync(relocatedAnchor)).toEqual([]);
    expect(readdirSync(relocatedAnchor).filter((name) => name.includes(".stage"))).toEqual([]);
    unlinkSync(originalAnchor);
    renameSync(relocatedAnchor, originalAnchor);
  });

  it("removes the anchored receipt when its directory moves after parent ACK", () => {
    const fixture = createGarageBandSessionFixture({ label: "receipt-public-post-ack-swap" });
    const originalAnchor = receiptDirectory(fixture.rootDir);
    const relocatedAnchor = join(dirname(originalAnchor), "relocated-receipts");
    const outsideRoot = makeTemporaryDirectory("receipt-public-post-ack-swap-outside");
    mkdirSync(originalAnchor);

    const originalLink = mutableNodeFs.linkSync;
    let swapped = false;
    const linkSpy = vi.spyOn(mutableNodeFs, "linkSync").mockImplementation(((
      existingPath: Parameters<typeof originalLink>[0],
      newPath: Parameters<typeof originalLink>[1]
    ) => {
      const result = Reflect.apply(originalLink, mutableNodeFs, [existingPath, newPath]);
      if (!swapped && typeof newPath === "string" && basename(newPath) === "decision.json") {
        swapped = true;
        renameSync(originalAnchor, relocatedAnchor);
        symlinkSync(outsideRoot, originalAnchor);
      }
      return result;
    }) as typeof originalLink);
    try {
      expect(() => writeGarageBandSessionReceipt(fixture)).toThrow(/RECEIPT_WRITE_ANCHOR_MOVED/);
    } finally {
      linkSpy.mockRestore();
    }

    expect(swapped).toBe(true);
    expect(readdirSync(outsideRoot)).toEqual([]);
    expect(readdirSync(relocatedAnchor)).toEqual([]);
    unlinkSync(originalAnchor);
    renameSync(relocatedAnchor, originalAnchor);
  });

  it("surfaces persistent receipt-writer cleanup failure instead of hiding it", () => {
    const anchor = makeTemporaryDirectory("receipt-cleanup-fault");
    const expected = statSync(anchor);
    const result = runAnchoredReceiptWriter({
      cwd: anchor,
      targetName: "candidate-03-linear-session-receipt.json",
      expectedDev: expected.dev,
      expectedIno: expected.ino,
      anchorPath: anchor,
      contents: "{}\n",
      fault: "cleanup",
    });
    expect(result.status).not.toBe(0);
    expect(JSON.parse(result.stdout)).toMatchObject({
      ok: false,
      error: "RECEIPT_WRITE_CLEANUP_FAILED",
    });
    expect(readdirSync(anchor).filter((name) => name.includes(".stage"))).toHaveLength(1);
  });
});
