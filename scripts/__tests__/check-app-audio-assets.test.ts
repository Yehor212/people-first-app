import {
  existsSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  writeFileSync,
} from "node:fs";
import { createRequire } from "node:module";
import { tmpdir } from "node:os";
import { basename, join } from "node:path";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/check-app-audio-assets.cjs";
const require = createRequire(import.meta.url);
const {
  EXPECTED_FEEDBACK_MP3_FILES,
  inspectAmbienceMetrics,
  inspectCloudlightLoopMetrics,
  inspectFeedbackMetrics,
  inspectGeneratedAudioProvenance,
  inspectGeneratedAudioRights,
  inspectOutputArtifacts,
  parseWavMetrics,
  validateExactDirectoryInventory,
  parseCliOptions,
  writeReportIfRequested,
} = require("../check-app-audio-assets.cjs") as {
  EXPECTED_FEEDBACK_MP3_FILES: string[];
  inspectAmbienceMetrics?: (
    fileName: string,
    measured: {
      channels: number;
      sampleRate: number;
      durationSeconds: number;
      peak: number;
      rms: number;
      audibleRms: number;
      audibleBandEnergyRatio: number;
      dcOffsetAbs: number;
      loopDelta: number;
      boundaryDelta?: number;
      boundarySlopeDelta?: number;
      startEndRmsDelta: number;
      transientDelta: number;
      decoder: "afconvert" | "ffmpeg";
    },
  ) => string[];
  inspectCloudlightLoopMetrics?: (measured: {
    channels: number;
    sampleRate: number;
    durationSeconds: number;
    peak: number;
    rms: number;
    audibleRms: number;
    audibleBandEnergyRatio: number;
    highFrequencyEnergyRatio: number;
    dcOffsetAbs: number;
    transientDelta: number;
    stereoCorrelation: number;
    monoFoldDownEnergyRatio: number;
    boundaryDelta: number;
    boundarySlopeDelta: number;
    startEndRmsDelta: number;
    maxSilentWindowSeconds: number;
    decoder: "afconvert" | "ffmpeg";
  }) => string[];
  inspectFeedbackMetrics: (
    fileName: string,
    measured: {
      channels: number;
      sampleRate: number;
      durationSeconds: number;
      peak: number;
      rms: number;
      audibleBandEnergyRatio: number;
      highFrequencyEnergyRatio: number;
      dcOffsetAbs: number;
      boundaryDelta: number;
      boundarySlopeDelta: number;
      transientDelta: number;
    },
  ) => string[];
  inspectGeneratedAudioProvenance: (assets: Array<{
    id: string;
    fileName: string;
    publicPath: string;
    deployDocsPath: string;
    sha256: string;
    bytes: number;
    deterministicSpec?: string;
    nativeAndroidPath?: string;
    nativeAndroidSha256?: string;
    nativeAndroidBytes?: number;
    parameters: {
      family: string;
      sampleRate: number;
      channels: number;
      durationSeconds: number;
      runtimeGain: number;
      noThirdPartySamples: boolean;
      noModelOrAiGeneratedAudioInput: boolean;
      exclusions: string[];
    };
  }>) => {
    exact: boolean;
    missing: string[];
    unexpected: string[];
    mismatched: Array<{ fileName: string; fields: string[] }>;
  };
  inspectGeneratedAudioRights?: (
    provenance: {
      generationPolicy?: string;
      rights?: {
        referenceResearch?: {
          title?: string;
          sourceUrl?: string;
          useBoundary?: string;
          sourceAudioImported?: boolean;
          sourceAudioRetained?: boolean;
          samplesCopied?: boolean;
          melodyOrHarmonyTranscribed?: boolean;
        };
        projectLicense?: {
          status?: string;
          rootLicensePresent?: boolean;
          copyrightNotice?: string;
        };
      };
    },
    environment: { rootLicensePresent: boolean },
  ) => string[];
  inspectOutputArtifacts: (options: {
    outputDir: string;
    reportPath: string;
    forbiddenRootMp3s?: string[];
    staleRuntimeStrings?: string[];
  }) => { matches: Array<{ file: string; stale: string }>; scannedFiles: string[]; textFiles: string[] };
  parseWavMetrics?: (wavPath: string) => {
    boundaryDelta: number;
    boundaryDeltaByChannel: number[];
    boundarySlopeDelta: number;
    boundarySlopeDeltaByChannel: number[];
    startEndRmsDelta: number;
    startEndRmsDeltaByChannel: number[];
  };
  validateExactDirectoryInventory: (
    directory: string,
    expectedFiles: string[],
    label: string,
  ) => {
    actualFiles: string[];
    missing: string[];
    unexpected: string[];
  };
  parseCliOptions: (argv: string[]) => { writeReport: boolean };
  writeReportIfRequested: (
    report: Record<string, unknown>,
    options: { writeReport: boolean },
    reportPath: string,
  ) => void;
};

function writeStereoPcm16Wav(filePath: string, frames: Array<[number, number]>): void {
  const channels = 2;
  const sampleRate = 44_100;
  const bytesPerSample = 2;
  const blockAlign = channels * bytesPerSample;
  const dataSize = frames.length * blockAlign;
  const wav = Buffer.alloc(44 + dataSize);
  wav.write("RIFF", 0, "ascii");
  wav.writeUInt32LE(36 + dataSize, 4);
  wav.write("WAVE", 8, "ascii");
  wav.write("fmt ", 12, "ascii");
  wav.writeUInt32LE(16, 16);
  wav.writeUInt16LE(1, 20);
  wav.writeUInt16LE(channels, 22);
  wav.writeUInt32LE(sampleRate, 24);
  wav.writeUInt32LE(sampleRate * blockAlign, 28);
  wav.writeUInt16LE(blockAlign, 32);
  wav.writeUInt16LE(16, 34);
  wav.write("data", 36, "ascii");
  wav.writeUInt32LE(dataSize, 40);
  frames.forEach(([left, right], frame) => {
    wav.writeInt16LE(Math.round(left * 32_767), 44 + frame * blockAlign);
    wav.writeInt16LE(Math.round(right * 32_767), 44 + frame * blockAlign + bytesPerSample);
  });
  writeFileSync(filePath, wav);
}

describe("non-Hyperfocus app audio guard", () => {
  it("ships a dedicated QC contract for V2 app audio outside Hyperfocus", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("parses only the bounded CLI forms before QC work begins", () => {
    expect(parseCliOptions([])).toEqual({ writeReport: false });
    expect(parseCliOptions(["--write-report"])).toEqual({ writeReport: true });
    expect(() => parseCliOptions(["--write-report", "../report.json"])).toThrow(
      /does not accept a path/i,
    );
    expect(() => parseCliOptions(["--unknown"])).toThrow(/unknown app audio QC option/i);
  });

  it("is source-backed and wired as a local package check", () => {
    expect(existsSync("docs/audio/non-hyperfocus-sound-effects-policy.md")).toBe(true);
    const policy = readFileSync("docs/audio/non-hyperfocus-sound-effects-policy.md", "utf8");
    const script = readFileSync(scriptPath, "utf8");
    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as { scripts: Record<string, string> };

    for (const marker of [
      "WCAG 2.2 Audio Control",
      "ITU-R BS.1770-5",
      "EBU R 128",
      "MDN autoplay",
      "Apple Human Interface Guidelines",
      "Android audio focus",
      "Non-Hyperfocus",
      "Forbidden Routine Sounds",
      "Generated Non-Hyperfocus Asset Provenance",
      "Audibility and Loop Contract",
    ]) {
      expect(policy).toContain(marker);
    }
    expect(script).toContain("soft-air-veil.mp3");
    expect(script).toContain("gentle-water-bed.mp3");
    expect(script).toContain("soft-rain-veil.mp3");
    expect(script).toContain("FORBIDDEN_ROOT_MP3S");
    expect(script).toContain("path.join(rootDir, 'docs', 'sounds')");
    expect(script).toContain("APP_AUDIO_NON_HYPERFOCUS_ASSET_IDS");
    expect(script).toContain("APP_AUDIO_FORBIDDEN_ACTIONS");
    expect(script).toContain("scanDesktopTargetForStaleStrings");
    expect(script).toContain("scanDocsAssetsForStaleStrings");
    expect(script).toContain("ffmpeg");
    expect(script).toContain("afconvert or ffmpeg is required");
    expect(script).toContain("decoderThresholds");
    expect(script).toContain("resolveMetricLimit");
    expect(script).toContain("appAudioAssetsReportPath");
    expect(script).toContain("outputArtifactsScannedCount");
    expect(script).toContain("fs.statSync(file).isFile()");
    expect(script).toContain("walkVolatileOutputArtifacts");
    expect(script).toContain("isVolatileOutputRace");
    expect(script).toContain("scannedFiles.push(file)");
    expect(script).toContain("TEXT_OUTPUT_ARTIFACT_EXTENSIONS");
    expect(script).toContain("isTextOutputArtifact(file)");
    expect(script).toContain("validateCommandLine");
    expect(script.indexOf("validateCommandLine();")).toBeLessThan(
      script.indexOf("checkSourceBackedPolicy();"),
    );
    expect(script).toContain("THIRD_PARTY_NOTICES.md");
    expect(script).toContain("hyperfocusGeneratedAudioManifest.ts");
    expect(script).toContain("MixKit");
    expect(script).toContain("BigSoundBank");
    expect(script).toContain("Hyperfocus CC0 Nature Sound Effects");
    expect(script).toContain("Desktop/Tauri generated target files scanned");
    expect(script).toContain("docs/assets bundles scanned");
    expect(packageJson.scripts["check:app-audio"]).toBe("node scripts/check-app-audio-assets.cjs");
  });

  it("rejects generated duplicate artifacts instead of pruning project files", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).not.toContain("pruneGeneratedRootSoundDuplicates");
    expect(script).not.toContain("fs.rmSync(duplicatePath");
    expect(script).not.toContain("generated duplicate sound artifacts pruned");
    expect(script).toContain("generated duplicate sound artifacts are not allowed");
  });

  it("enforces the exact five-file feedback inventory without deleting unexpected files", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-feedback-inventory-"));
    try {
      for (const fileName of EXPECTED_FEEDBACK_MP3_FILES) {
        writeFileSync(join(fixtureRoot, fileName), fileName);
      }

      expect(
        validateExactDirectoryInventory(
          fixtureRoot,
          EXPECTED_FEEDBACK_MP3_FILES,
          "fixture feedback",
        ),
      ).toEqual({
        actualFiles: EXPECTED_FEEDBACK_MP3_FILES,
        missing: [],
        unexpected: [],
      });

      const unexpectedPath = join(fixtureRoot, "feedback-extra.mp3");
      writeFileSync(unexpectedPath, "unexpected");
      expect(() =>
        validateExactDirectoryInventory(
          fixtureRoot,
          EXPECTED_FEEDBACK_MP3_FILES,
          "fixture feedback",
        ),
      ).toThrow(/unexpected feedback inventory/i);
      expect(existsSync(unexpectedPath)).toBe(true);

      rmSync(unexpectedPath);
      rmSync(join(fixtureRoot, EXPECTED_FEEDBACK_MP3_FILES[0]));
      expect(() =>
        validateExactDirectoryInventory(
          fixtureRoot,
          EXPECTED_FEEDBACK_MP3_FILES,
          "fixture feedback",
        ),
      ).toThrow(/unexpected feedback inventory/i);
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("requires provenance for exactly four root ambience and five feedback assets", () => {
    const provenance = JSON.parse(
      readFileSync("docs/audio/non-hyperfocus-generated-audio-provenance.json", "utf8"),
    ) as { assets: Parameters<typeof inspectGeneratedAudioProvenance>[0] };

    expect(inspectGeneratedAudioProvenance(provenance.assets)).toEqual({
      exact: true,
      missing: [],
      unexpected: [],
      mismatched: [],
    });
    expect(provenance.assets.map((asset) => asset.fileName)).toContain(
      "cloudlight-evening-loop.mp3",
    );

    const missingFeedback = provenance.assets.filter(
      (asset) => asset.fileName !== "feedback-notification.mp3",
    );
    expect(inspectGeneratedAudioProvenance(missingFeedback)).toEqual(
      expect.objectContaining({
        exact: false,
        missing: ["feedback-notification.mp3"],
      }),
    );

    const unexpectedFeedback = [
      ...provenance.assets,
      {
        ...provenance.assets.find((asset) => asset.fileName === "feedback-success.mp3")!,
        id: "feedback-extra",
        fileName: "feedback-extra.mp3",
        publicPath: "public/sounds/feedback/feedback-extra.mp3",
        deployDocsPath: "docs/sounds/feedback/feedback-extra.mp3",
      },
    ];
    expect(inspectGeneratedAudioProvenance(unexpectedFeedback)).toEqual(
      expect.objectContaining({
        exact: false,
        unexpected: ["feedback-extra.mp3"],
      }),
    );

    const mismatchedFeedback = provenance.assets.map((asset) =>
      asset.fileName === "feedback-success.mp3"
        ? { ...asset, deterministicSpec: "different-generator-contract" }
        : asset,
    );
    expect(inspectGeneratedAudioProvenance(mismatchedFeedback)).toEqual(
      expect.objectContaining({
        exact: false,
        mismatched: [
          {
            fileName: "feedback-success.mp3",
            fields: ["deterministicSpec"],
          },
        ],
      }),
    );

    const withNativeFurin = provenance.assets.map((asset) =>
      asset.fileName === "feedback-notification.mp3"
        ? {
            ...asset,
            nativeAndroidPath: "android/app/src/main/res/raw/zenflow_furin.wav",
            nativeAndroidSha256: "a".repeat(64),
            nativeAndroidBytes: 96_044,
          }
        : asset,
    );
    const missingNativeFurin = withNativeFurin.map((asset) => {
      if (asset.fileName !== "feedback-notification.mp3") return asset;
      const {
        nativeAndroidPath: _nativeAndroidPath,
        nativeAndroidSha256: _nativeAndroidSha256,
        nativeAndroidBytes: _nativeAndroidBytes,
        ...withoutNativeFurin
      } = asset;
      return withoutNativeFurin;
    });
    expect(inspectGeneratedAudioProvenance(missingNativeFurin)).toEqual(
      expect.objectContaining({
        exact: false,
        mismatched: [
          {
            fileName: "feedback-notification.mp3",
            fields: [
              "nativeAndroidPath",
              "nativeAndroidSha256",
              "nativeAndroidBytes",
            ],
          },
        ],
      }),
    );
  });

  it("rejects false project-license claims and any retained reference expression", () => {
    expect(inspectGeneratedAudioRights).toEqual(expect.any(Function));
    if (!inspectGeneratedAudioRights) return;

    const cleanRoomRights = {
      generationPolicy:
        "First-party deterministic procedural synthesis. No third-party samples are used.",
      rights: {
        referenceResearch: {
          title: "Cloudbound Evening",
          sourceUrl: "https://www.youtube.com/watch?v=cJvhJqgDbKI",
          useBoundary: "high-level mood and app-entry background-music research only",
          sourceAudioImported: false,
          sourceAudioRetained: false,
          samplesCopied: false,
          melodyOrHarmonyTranscribed: false,
        },
        projectLicense: {
          status: "ASSET_SPECIFIC_PROPRIETARY_NOTICE",
          rootLicensePresent: false,
          copyrightNotice: "Copyright © 2026 Yehor212 / ZenFlow. All rights reserved.",
        },
      },
    };

    expect(
      inspectGeneratedAudioRights(cleanRoomRights, { rootLicensePresent: false }),
    ).toEqual([]);
    expect(
      inspectGeneratedAudioRights(
        {
          ...cleanRoomRights,
          rights: {
            ...cleanRoomRights.rights,
            referenceResearch: {
              ...cleanRoomRights.rights.referenceResearch,
              sourceAudioImported: true,
              melodyOrHarmonyTranscribed: true,
            },
            projectLicense: {
              status: "UNVERIFIED_MISSING_ROOT_LICENSE",
              rootLicensePresent: true,
              copyrightNotice: "incorrect",
            },
          },
        },
        { rootLicensePresent: false },
      ),
    ).toEqual([
      "referenceResearch.sourceAudioImported",
      "referenceResearch.melodyOrHarmonyTranscribed",
      "projectLicense.status",
      "projectLicense.rootLicensePresent",
      "projectLicense.copyrightNotice",
    ]);
  });

  it("rejects feedback cue format and decoded metrics outside the bounded UI-cue contract", () => {
    expect(
      inspectFeedbackMetrics("feedback-success.mp3", {
        channels: 2,
        sampleRate: 44_100,
        durationSeconds: 0.52,
        peak: 0.12,
        rms: 0.038,
        audibleBandEnergyRatio: 0.995,
        highFrequencyEnergyRatio: 0.12,
        dcOffsetAbs: 0.0001,
        boundaryDelta: 0.0005,
        boundarySlopeDelta: 0.001,
        transientDelta: 0.02,
      }),
    ).toEqual([]);

    const violations = inspectFeedbackMetrics("feedback-success.mp3", {
      channels: 1,
      sampleRate: 48_000,
      durationSeconds: 1.5,
      peak: 0.3,
      rms: 0.1,
      audibleBandEnergyRatio: 0.7,
      highFrequencyEnergyRatio: 0.8,
      dcOffsetAbs: 0.01,
      boundaryDelta: 0.05,
      boundarySlopeDelta: 0.05,
      transientDelta: 0.2,
    });
    expect(violations).toEqual([
      "channels",
      "sampleRate",
      "durationSeconds",
      "peak",
      "rms",
      "audibleBandEnergyRatio",
      "highFrequencyEnergyRatio",
      "dcOffsetAbs",
      "boundaryDelta",
      "boundarySlopeDelta",
      "transientDelta",
    ]);

    expect(
      inspectFeedbackMetrics("feedback-notification.mp3", {
        channels: 2,
        sampleRate: 44_100,
        durationSeconds: 0.95,
        peak: 0.16,
        rms: 0.04,
        audibleBandEnergyRatio: 0.995,
        highFrequencyEnergyRatio: 0.16,
        dcOffsetAbs: 0.0001,
        boundaryDelta: 0.0005,
        boundarySlopeDelta: 0.001,
        transientDelta: 0.05,
      }),
    ).toEqual([]);
  });

  it("rejects long-loop format, silence, phase, seam, and spectral violations", () => {
    expect(inspectCloudlightLoopMetrics).toEqual(expect.any(Function));
    if (!inspectCloudlightLoopMetrics) return;

    const accepted = {
      channels: 2,
      sampleRate: 44_100,
      durationSeconds: 150.04,
      peak: 0.2,
      rms: 0.045,
      audibleRms: 0.044,
      audibleBandEnergyRatio: 0.99,
      highFrequencyEnergyRatio: 0.08,
      dcOffsetAbs: 0.0001,
      transientDelta: 0.04,
      stereoCorrelation: 0.72,
      monoFoldDownEnergyRatio: 0.88,
      boundaryDelta: 0.001,
      boundarySlopeDelta: 0.002,
      startEndRmsDelta: 0.004,
      maxSilentWindowSeconds: 0,
      decoder: "afconvert" as const,
    };
    expect(inspectCloudlightLoopMetrics(accepted)).toEqual([]);
    expect(
      inspectCloudlightLoopMetrics({
        ...accepted,
        channels: 1,
        sampleRate: 48_000,
        durationSeconds: 145,
        peak: 0.4,
        rms: 0.005,
        audibleRms: 0.001,
        audibleBandEnergyRatio: 0.4,
        highFrequencyEnergyRatio: 0.8,
        dcOffsetAbs: 0.01,
        transientDelta: 0.3,
        stereoCorrelation: -0.9,
        monoFoldDownEnergyRatio: 0.02,
        boundaryDelta: 0.1,
        boundarySlopeDelta: 0.1,
        startEndRmsDelta: 0.08,
        maxSilentWindowSeconds: 3,
      }),
    ).toEqual([
      "channels",
      "sampleRate",
      "durationSeconds",
      "peak",
      "rms",
      "audibleRms",
      "audibleBandEnergyRatio",
      "highFrequencyEnergyRatio",
      "dcOffsetAbs",
      "transientDelta",
      "stereoCorrelation",
      "monoFoldDownEnergyRatio",
      "boundaryDelta",
      "boundarySlopeDelta",
      "startEndRmsDelta",
      "maxSilentWindowSeconds",
    ]);
  });

  it("rejects ambience whose nominal RMS is dominated by inaudible subsonic energy", () => {
    expect(inspectAmbienceMetrics).toEqual(expect.any(Function));
    if (!inspectAmbienceMetrics) return;

    expect(
      inspectAmbienceMetrics("soft-air-veil.mp3", {
        channels: 2,
        sampleRate: 44_100,
        durationSeconds: 96,
        peak: 0.22,
        rms: 0.08,
        audibleRms: 0.075,
        audibleBandEnergyRatio: 0.88,
        dcOffsetAbs: 0.0002,
        loopDelta: 0.01,
        boundaryDelta: 0.002,
        boundarySlopeDelta: 0.004,
        startEndRmsDelta: 0.005,
        transientDelta: 0.08,
        decoder: "afconvert",
      }),
    ).toEqual([]);

    const violations = inspectAmbienceMetrics("soft-air-veil.mp3", {
      channels: 2,
      sampleRate: 44_100,
      durationSeconds: 96,
      peak: 0.0619,
      rms: 0.0285,
      audibleRms: 0.0000004,
      audibleBandEnergyRatio: 0.000000277,
      dcOffsetAbs: 0.00744,
      loopDelta: 0.01,
      boundaryDelta: 0.002,
      boundarySlopeDelta: 0.004,
      startEndRmsDelta: 0.005,
      transientDelta: 0.02,
      decoder: "afconvert",
    });

    expect(violations).toEqual(
      expect.arrayContaining([
        "audibleRms",
        "audibleBandEnergyRatio",
        "dcOffsetAbs",
      ]),
    );
  });

  it("enforces every ambience metric gate and decoder override with exact violations", () => {
    expect(inspectAmbienceMetrics).toEqual(expect.any(Function));
    if (!inspectAmbienceMetrics) return;

    const softAir = {
      channels: 2,
      sampleRate: 44_100,
      durationSeconds: 96,
      peak: 0.22,
      rms: 0.08,
      audibleRms: 0.075,
      audibleBandEnergyRatio: 0.88,
      dcOffsetAbs: 0.0002,
      loopDelta: 0.08,
      boundaryDelta: 0.002,
      boundarySlopeDelta: 0.004,
      startEndRmsDelta: 0.005,
      transientDelta: 0.08,
      decoder: "afconvert" as const,
    };
    const gentleWater = {
      ...softAir,
      peak: 0.24,
      rms: 0.07,
      audibleRms: 0.065,
      audibleBandEnergyRatio: 0.84,
      startEndRmsDelta: 0.01,
    };
    const softRain = {
      ...softAir,
      peak: 0.23,
      rms: 0.065,
      audibleRms: 0.06,
      audibleBandEnergyRatio: 0.9,
      startEndRmsDelta: 0.01,
    };

    expect(inspectAmbienceMetrics("soft-air-veil.mp3", softAir)).toEqual([]);
    expect(inspectAmbienceMetrics("gentle-water-bed.mp3", gentleWater)).toEqual([]);
    expect(inspectAmbienceMetrics("soft-rain-veil.mp3", softRain)).toEqual([]);
    expect(inspectAmbienceMetrics("unknown.mp3", softAir)).toEqual(["fileName"]);

    const cases = [
      [{ channels: 1 }, ["channels"]],
      [{ sampleRate: 48_000 }, ["sampleRate"]],
      [{ durationSeconds: 59 }, ["durationSeconds"]],
      [{ peak: 0.1 }, ["peak", "effectivePeak"]],
      [{ peak: 0.5 }, ["peak", "effectivePeak"]],
      [{ rms: 0.04 }, ["rms", "effectiveRms"]],
      [{ rms: 0.13 }, ["rms", "effectiveRms"]],
      [{ audibleRms: 0.04 }, ["audibleRms"]],
      [{ audibleBandEnergyRatio: 0.5 }, ["audibleBandEnergyRatio"]],
      [{ dcOffsetAbs: 0.002 }, ["dcOffsetAbs"]],
      [{ boundaryDelta: 0.011 }, ["boundaryDelta"]],
      [{ boundarySlopeDelta: 0.011 }, ["boundarySlopeDelta"]],
      [{ startEndRmsDelta: 0.013 }, ["startEndRmsDelta"]],
      [{ transientDelta: 0.17 }, ["transientDelta"]],
    ] as const;

    for (const [patch, expectedViolations] of cases) {
      expect(
        inspectAmbienceMetrics("soft-air-veil.mp3", { ...softAir, ...patch }),
      ).toEqual(expectedViolations);
    }

    expect(
      inspectAmbienceMetrics("gentle-water-bed.mp3", {
        ...gentleWater,
        startEndRmsDelta: 0.016,
        decoder: "afconvert",
      }),
    ).toEqual(["startEndRmsDelta"]);
    expect(
      inspectAmbienceMetrics("gentle-water-bed.mp3", {
        ...gentleWater,
        startEndRmsDelta: 0.016,
        decoder: "ffmpeg",
      }),
    ).toEqual([]);
    expect(
      inspectAmbienceMetrics("gentle-water-bed.mp3", {
        ...gentleWater,
        startEndRmsDelta: 0.018,
        decoder: "ffmpeg",
      }),
    ).toEqual(["startEndRmsDelta"]);
    expect(
      inspectAmbienceMetrics("soft-rain-veil.mp3", {
        ...softRain,
        transientDelta: 0.21,
      }),
    ).toEqual(["transientDelta"]);
  });

  it("accepts loop-safe noise whose start and end windows naturally differ", () => {
    expect(inspectAmbienceMetrics).toEqual(expect.any(Function));
    if (!inspectAmbienceMetrics) return;

    expect(
      inspectAmbienceMetrics("soft-air-veil.mp3", {
        channels: 2,
        sampleRate: 44_100,
        durationSeconds: 96,
        peak: 0.22,
        rms: 0.08,
        audibleRms: 0.075,
        audibleBandEnergyRatio: 0.88,
        dcOffsetAbs: 0.0002,
        loopDelta: 0.08,
        boundaryDelta: 0.002,
        boundarySlopeDelta: 0.004,
        startEndRmsDelta: 0.005,
        transientDelta: 0.08,
        decoder: "afconvert",
      }),
    ).toEqual([]);
  });

  it("uses the worst stereo channel for loop-boundary and window-level metrics", () => {
    expect(parseWavMetrics).toEqual(expect.any(Function));
    if (!parseWavMetrics) return;

    const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-audio-stereo-loop-"));
    const wavPath = join(fixtureRoot, "one-channel-seam.wav");
    try {
      writeStereoPcm16Wav(wavPath, [
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0.018],
      ]);

      const seamMetrics = parseWavMetrics(wavPath);
      expect(seamMetrics.boundaryDeltaByChannel[1]).toBeGreaterThan(0.017);
      expect(seamMetrics.boundaryDelta).toBe(seamMetrics.boundaryDeltaByChannel[1]);
      expect(seamMetrics.boundarySlopeDeltaByChannel[1]).toBeGreaterThan(0.017);
      expect(seamMetrics.boundarySlopeDelta).toBe(Math.max(...seamMetrics.boundarySlopeDeltaByChannel));

      writeStereoPcm16Wav(wavPath, [
        [0.02, 0],
        [0.02, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0],
        [0, 0.018],
        [0, 0.018],
      ]);

      const windowMetrics = parseWavMetrics(wavPath);
      expect(windowMetrics.startEndRmsDeltaByChannel[0]).toBeGreaterThan(0.019);
      expect(windowMetrics.startEndRmsDeltaByChannel[1]).toBeGreaterThan(0.017);
      expect(windowMetrics.startEndRmsDelta).toBe(Math.max(...windowMetrics.startEndRmsDeltaByChannel));
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("checks every output filename while reading only text-like artifact bodies", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-audio-output-"));
    const reportPath = join(fixtureRoot, "audio-qc", "app-audio-assets-report.json");
    try {
      mkdirSync(join(fixtureRoot, "nested"), { recursive: true });
      writeFileSync(join(fixtureRoot, "nested", "bundle.js"), "const asset = 'sounds/current.mp3';\n");
      writeFileSync(join(fixtureRoot, "screenshot.png"), "sounds/measured-breath.mp3");
      mkdirSync(join(fixtureRoot, "audio-qc"), { recursive: true });
      writeFileSync(reportPath, "sounds/measured-breath.mp3\n");

      const safe = inspectOutputArtifacts({
        outputDir: fixtureRoot,
        reportPath,
        forbiddenRootMp3s: ["measured-breath.mp3"],
        staleRuntimeStrings: ["sounds/measured-breath.mp3"],
      });
      expect(safe.matches).toEqual([]);
      expect(safe.scannedFiles.map((file) => basename(file)).sort()).toEqual([
        "bundle.js",
        "screenshot.png",
      ]);
      expect(safe.textFiles.map((file) => basename(file))).toEqual(["bundle.js"]);

      writeFileSync(join(fixtureRoot, "nested", "bundle.js"), "sounds/measured-breath.mp3\n");
      writeFileSync(join(fixtureRoot, "measured-breath.mp3"), "binary placeholder");
      const rejected = inspectOutputArtifacts({
        outputDir: fixtureRoot,
        reportPath,
        forbiddenRootMp3s: ["measured-breath.mp3"],
        staleRuntimeStrings: ["sounds/measured-breath.mp3"],
      });
      expect(rejected.matches).toEqual(
        expect.arrayContaining([
          expect.objectContaining({ stale: "sounds/measured-breath.mp3" }),
          expect.objectContaining({ stale: "measured-breath.mp3" }),
        ]),
      );
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });

  it("writes a report only when the already-validated option requests it", () => {
    const fixtureRoot = mkdtempSync(join(tmpdir(), "zenflow-audio-report-"));
    const reportPath = join(fixtureRoot, "app-audio-assets-report.json");
    try {
      writeReportIfRequested({ status: "PASS" }, { writeReport: false }, reportPath);
      expect(existsSync(reportPath)).toBe(false);

      writeReportIfRequested({ status: "PASS" }, { writeReport: true }, reportPath);
      expect(JSON.parse(readFileSync(reportPath, "utf8"))).toEqual({ status: "PASS" });
    } finally {
      rmSync(fixtureRoot, { recursive: true, force: true });
    }
  });
});
