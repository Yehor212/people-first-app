import { copyFileSync, existsSync, mkdirSync, mkdtempSync, readFileSync, readdirSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";
import { createRequire } from "node:module";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { describe, expect, it, vi } from "vitest";


function makeStoredZip(entries: Array<{ name: string; content: string | Buffer }>) {
  const localParts: Buffer[] = [];
  const centralParts: Buffer[] = [];
  let offset = 0;

  for (const entry of entries) {
    const name = Buffer.from(entry.name, "utf8");
    const content = Buffer.isBuffer(entry.content) ? entry.content : Buffer.from(entry.content);
    const local = Buffer.alloc(30);
    local.writeUInt32LE(0x04034b50, 0);
    local.writeUInt16LE(20, 4);
    local.writeUInt16LE(0x0800, 6);
    local.writeUInt16LE(0, 8);
    local.writeUInt32LE(0, 10);
    local.writeUInt32LE(0, 14);
    local.writeUInt32LE(content.length, 18);
    local.writeUInt32LE(content.length, 22);
    local.writeUInt16LE(name.length, 26);
    local.writeUInt16LE(0, 28);
    localParts.push(local, name, content);

    const central = Buffer.alloc(46);
    central.writeUInt32LE(0x02014b50, 0);
    central.writeUInt16LE(20, 4);
    central.writeUInt16LE(20, 6);
    central.writeUInt16LE(0x0800, 8);
    central.writeUInt16LE(0, 10);
    central.writeUInt32LE(0, 12);
    central.writeUInt32LE(0, 16);
    central.writeUInt32LE(content.length, 20);
    central.writeUInt32LE(content.length, 24);
    central.writeUInt16LE(name.length, 28);
    central.writeUInt16LE(0, 30);
    central.writeUInt16LE(0, 32);
    central.writeUInt16LE(0, 34);
    central.writeUInt16LE(0, 36);
    central.writeUInt32LE(0, 38);
    central.writeUInt32LE(offset, 42);
    centralParts.push(central, name);

    offset += local.length + name.length + content.length;
  }

  const centralDirectoryOffset = offset;
  const centralDirectory = Buffer.concat(centralParts);
  const end = Buffer.alloc(22);
  end.writeUInt32LE(0x06054b50, 0);
  end.writeUInt16LE(0, 4);
  end.writeUInt16LE(0, 6);
  end.writeUInt16LE(entries.length, 8);
  end.writeUInt16LE(entries.length, 10);
  end.writeUInt32LE(centralDirectory.length, 12);
  end.writeUInt32LE(centralDirectoryOffset, 16);
  end.writeUInt16LE(0, 20);

  return Buffer.concat([...localParts, centralDirectory, end]);
}

const require = createRequire(import.meta.url);
const qc = require("../check-hyperfocus-audio-assets.cjs") as {
  getExpectedHyperfocusAssets: (options: { rootDir: string }) => Array<{ familyId: string; levelId: string; fileName: string; publicPath: string }>;
  validateHyperfocusAssetSet: (options: { rootDir: string; skipAudioProbe?: boolean }) => { ok: boolean; issues: Array<{ code: string; fileName?: string; message: string }> };
  buildHyperfocusAudioQcReport: (options: { rootDir: string; generatedAt?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; expectedCount: number; passedCount: number; missingCount: number; failedCount: number; assets: Array<{ variantId: string; fileName: string; publicPath: string; status: string; sha256?: string; bytes?: number; metrics?: Record<string, number>; issues: Array<{ code: string; message: string }> }> };
  buildHyperfocusPackagedAssetReport: (options: { rootDir: string; generatedAt?: string }) => { ok: boolean; expectedCount: number; targetCount: number; targets: Array<{ id: string; platform: string; relativeDir: string; artifactPath?: string; binaryPath?: string; expectedCount: number; presentCount: number; missingCount: number; failedCount: number; ok: boolean; assets: Array<{ variantId: string; fileName: string; relativePath: string; status: string; bytes?: number; compressedBytes?: number; crc32?: string; sha256?: string; archiveEntryPath?: string; embeddedPath?: string; binaryPath?: string; issues: Array<{ code: string; message: string }> }> }>; issues: Array<{ code: string; targetId?: string; fileName?: string; message: string }> };
  buildAcceptedCandidateReport: (options: { rootDir: string; generatedAt?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; expectedCount: number; presentCount: number; missingCount: number; passedCount: number; failedCount: number; invalidCount: number; issueCount: number; assets: Array<{ variantId: string; fileName: string; candidatePath: string; status: string; bytes?: number; issues: Array<{ code: string; message: string }> }> };
  buildRawCandidateAuditReport: (options: { rootDir: string; generatedAt?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; candidateCount: number; rejectedCount: number; needsReviewCount: number; invalidCount: number; uncheckedCount: number; issueCount: number; candidates: Array<{ variantId: string; fileName: string; candidatePath: string; status: string; bytes?: number; sha256?: string; metrics?: Record<string, number>; issues: Array<{ code: string; message: string }> }> };
  writeRawCandidateAuditReport: (options: { rootDir: string; outputFile: string; generatedAt?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; outputFile: string; report: ReturnType<typeof qc.buildRawCandidateAuditReport> };
  buildOriginalSourceCoverageReport: (options: { rootDir: string; generatedAt?: string }) => { ok: boolean; generatedAt: string; focusAssetCount: number; specFamilyCount: number; coveredFamilyCount: number; expectedLevelCount: number; plannedLevelCount: number; assets: Array<{ assetId: string; familyId: string; publicPath: string; sourcePath: string; specCurrentFile?: string; levelIds: string[]; status: string }>; issues: Array<{ code: string; familyId?: string; assetId?: string; message: string }> };
  buildPromptPolicyReport: (options: { rootDir: string; generatedAt?: string }) => { ok: boolean; generatedAt: string; familyCount: number; levelCount: number; promptCount: number; policy: { requiredProvider: string | null; allowedCurrentCandidate: string | null; requiredDurationSeconds: number; promptRequirements: string[]; rejectIfRequirements: string[] }; assets: Array<{ variantId: string; familyId: string; levelId: string; fileName: string; prompt: string; rejectIf: string[]; status: string; promptRequirements: Record<string, boolean>; rejectIfRequirements: Record<string, boolean>; issues: Array<{ code: string; message: string }> }>; issues: Array<{ code: string; variantId?: string; familyId?: string; levelId?: string; fileName?: string; message: string }>; issueCount: number };
  buildProviderCapabilityReport: (options: { rootDir: string; generatedAt?: string; inventory?: Record<string, unknown>; inventoryFile?: string }) => { ok: boolean; generatedAt: string; provider: string; mode: string; googleAudioModelCount: number; ttsModelCount: number; musicModelCount: number; sfxModelCount: number; soundscapeOrSfxModelAvailable: boolean; allowedPilotModelAvailable: boolean; recommendedAction: string; models: Array<{ id: string; provider: string; mode: string; inputType: string; status: string; reason: string }>; pilotCandidateModels: Array<{ id: string; inputType: string }>; disallowedModels: Array<{ id: string; inputType: string }>; warnings: Array<{ code: string; message: string }>; issues: Array<{ code: string; message: string }> };
  writeProviderCapabilityReport: (options: { rootDir: string; outputFile?: string; generatedAt?: string; inventory?: Record<string, unknown>; inventoryFile?: string }) => { ok: boolean; outputFile: string; report: ReturnType<typeof qc.buildProviderCapabilityReport> };
  buildGeminiGenerationQueue: (options: { rootDir: string; model?: string; phase?: "pilot" | "full" }) => { ok: boolean; phase?: string; requiresAcceptedPilot?: boolean; pilotVariantId?: string; jobs: Array<{ variantId: string; familyId: string; levelId: string; label: string; fileName: string; publicPath: string; quarantinePath: string; provider: string; model: string; prompt: string; rejectIf: string[]; promotionCommand: string }>; issues: Array<{ code: string; message: string }> };
  writeGeminiGenerationQueue: (options: { rootDir: string; outputFile?: string; model?: string; phase?: "pilot" | "full"; generatedAt?: string }) => { ok: boolean; outputFile: string; report: { ok: boolean; generatedAt: string; provider?: string; model?: string; phase?: string; requiresAcceptedPilot?: boolean; pilotVariantId?: string; jobCount: number; jobs: Array<Record<string, unknown>>; issues: Array<{ code: string; message: string }> } };
  promoteCandidateAudioAsset: (options: { rootDir: string; candidateFile: string; fileName: string; probeAudioFile?: (file: string) => Record<string, number>; provenance?: { provider: string; model: string; generationId: string; source?: string; generatedAt?: string; approvedBy?: string; audibleReview?: Record<string, unknown> } }) => { ok: boolean; destinationPath?: string; issues: Array<{ code: string; fileName?: string; message: string }> };
  promoteCandidateAudioBatch: (options: { rootDir: string; batch?: { phase?: string; pilotVariantId?: string; assets: Array<Record<string, unknown>> }; batchFile?: string; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; promotedCount: number; issues: Array<{ code: string; fileName?: string; message: string }>; destinations?: string[] };
  writePromotionBatchTemplate: (options: { rootDir: string; outputFile: string; model?: string; phase?: "pilot" | "full" }) => { ok: boolean; outputFile: string; batch: { phase?: string; requiresAcceptedPilot?: boolean; pilotVariantId?: string; defaults: Record<string, unknown>; assets: Array<Record<string, unknown>> }; issues: Array<{ code: string; message: string }> };
  writeCandidateUrlIntakeTemplate: (options: { rootDir: string; outputFile: string; model?: string; phase?: "pilot" | "full" }) => { ok: boolean; outputFile: string; batch: { phase?: string; requiresAcceptedPilot?: boolean; pilotVariantId?: string; defaults: Record<string, unknown>; assets: Array<Record<string, unknown>> }; issues: Array<{ code: string; message: string }> };
  downloadCandidateUrlBatch: (options: { rootDir: string; batch?: { phase?: string; pilotVariantId?: string; defaults?: Record<string, unknown>; assets: Array<Record<string, unknown>> }; batchFile?: string; downloadFile?: (url: string, destinationFile: string) => Promise<void> | void; probeAudioFile?: (file: string) => Record<string, number>; skipAudioProbe?: boolean }) => Promise<{ ok: boolean; downloadedCount: number; issues: Array<{ code: string; fileName?: string; message: string }>; destinations?: string[] }>;
  buildHyperfocusReadinessReport: (options: { rootDir: string; generatedAt?: string; model?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ready: boolean; expectedCount: number; checks: Record<string, { ok: boolean; [key: string]: unknown }>; blockers: Array<{ code: string; message: string }> };
  buildHyperfocusCompletionAuditReport: (options: { rootDir: string; generatedAt?: string; model?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { complete: boolean; requirementCount: number; passedCount: number; blockedCount: number; pendingCount: number; requirements: Array<{ id: string; status: string; ok: boolean; evidence: Record<string, unknown>; blockers: string[] }> };
  writeHyperfocusCompletionAuditReport: (options: { rootDir: string; outputFile: string; generatedAt?: string; model?: string; skipAudioProbe?: boolean }) => { ok: boolean; outputFile: string; report: ReturnType<typeof qc.buildHyperfocusCompletionAuditReport> };
  writeHyperfocusReadinessReport: (options: { rootDir: string; outputFile: string; model?: string; skipAudioProbe?: boolean }) => { ok: boolean; outputFile: string; report: { ready: boolean; expectedCount: number; checks: Record<string, { ok: boolean; [key: string]: unknown }>; blockers: Array<{ code: string; message: string }> } };
  writeGenerationCreditsReport: (options: { rootDir: string; outputFile?: string; model?: string; creditBalance: number; pilotCreditCost: number; nextResetDate?: string }) => { ok: boolean; outputFile: string; report: { ok: boolean; model: string; creditBalance: number; pilotCreditCost: number; sufficientForPilot: boolean; nextResetDate?: string } };
  buildGenerationAuthorizationReport: (options: { rootDir: string; generatedAt?: string; model?: string; phase?: "pilot" | "full"; creditBalance?: number; creditCostPerJob?: number; pilotCreditCost?: number; nextResetDate?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; authorized: boolean; phase: string; provider: string; model: string; blockers: Array<{ code: string; message: string }>; queue: { ok: boolean; jobCount: number; requiredCreditCost: number; requiresAcceptedPilot: boolean; pilotVariantId: string }; promptPolicy: { ok: boolean; familyCount: number; levelCount: number; promptCount: number; issueCount: number; blocking: boolean }; credits: { ok: boolean; creditBalance: number | null; creditCostPerJob: number | null; requiredCreditCost: number | null; sufficient: boolean; nextResetDate?: string }; pilotGate: { required: boolean; ok: boolean; blocking: boolean; issueCount?: number } };
  writeGenerationAuthorizationReport: (options: { rootDir: string; outputFile?: string; generatedAt?: string; model?: string; phase?: "pilot" | "full"; creditBalance?: number; creditCostPerJob?: number; pilotCreditCost?: number; nextResetDate?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; outputFile: string; report: ReturnType<typeof qc.buildGenerationAuthorizationReport> };
  buildGenerationDecisionReport: (options: { rootDir: string; generatedAt?: string; model?: string; creditBalance?: number; creditCostPerJob?: number; pilotCreditCost?: number; nextResetDate?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; shouldGenerate: boolean; nextAction: string; phase: string; blockerCodes: string[]; credits: Record<string, unknown>; providerCapability: Record<string, unknown>; pilotAuthorization: Record<string, unknown>; fullAuthorization: Record<string, unknown>; readiness: Record<string, unknown> };
  writeGenerationDecisionReport: (options: { rootDir: string; outputFile?: string; generatedAt?: string; model?: string; creditBalance?: number; creditCostPerJob?: number; pilotCreditCost?: number; nextResetDate?: string; skipAudioProbe?: boolean; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; outputFile: string; report: ReturnType<typeof qc.buildGenerationDecisionReport> };
  renderGeneratedAudioManifest: (entries: Array<{ variantId: string; publicPath: string; sha256: string; bytes: number; generatedAt: string }>) => string;
  collectGeneratedAudioManifestEntries: (options: { rootDir: string; generatedAt?: string; probeAudioFile?: (file: string) => Record<string, number> }) => { ok: boolean; entries: Array<{ variantId: string }>; issues: Array<{ code: string; fileName?: string; message: string }> };
  evaluateHyperfocusAudioMetrics: (metrics: {
    durationSeconds: number;
    sampleRate: number;
    channels: number;
    rmsDbfs: number;
    peakDbfs: number;
    clippedSamples: number;
    startRmsDbfs: number;
    endRmsDbfs: number;
    seamMeanAbsDiff: number;
    fileBytes: number;
  }) => Array<{ code: string; message: string }>;
};


function sha256Buffer(buffer: Buffer) {
  return createHash("sha256").update(buffer).digest("hex");
}

function promptSha256ForVariant(variantId = "fireplace:soft") {
  const [familyId, levelId] = variantId.split(":");
  const spec = JSON.parse(readFileSync(join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"), "utf8"));
  const family = spec.families.find((candidate: { id: string }) => candidate.id === familyId);
  const level = family?.levels.find((candidate: { id: string }) => candidate.id === levelId);
  return createHash("sha256").update(String(level?.prompt || "")).digest("hex");
}

function passingAudioMetrics() {
  return {
    durationSeconds: 30,
    sampleRate: 48000,
    channels: 2,
    rmsDbfs: -22,
    peakDbfs: -2.5,
    clippedSamples: 0,
    startRmsDbfs: -22.2,
    endRmsDbfs: -22.7,
    seamMeanAbsDiff: 0.015,
    fileBytes: 720_000,
  };
}

function passingAudibleReview(variantId = "fireplace:soft") {
  return {
    variantId,
    reviewer: "operator-qc",
    reviewedAt: "2026-06-19T00:00:00.000Z",
    promptSha256: promptSha256ForVariant(variantId),
    noVocals: true,
    noSpeech: true,
    noMelody: true,
    noBeat: true,
    noForegroundDistractions: true,
    noSafetyAlarmCues: true,
    loopAudiblyClean: true,
    matchesPromptFamily: true,
    matchesIntensityLevel: true,
    notes: "Audible review passed for non-musical seamless ambience.",
  };
}

function currentGoogleAudioModelInventory() {
  return {
    total: 4,
    mode: "audio",
    provider: "google",
    items: [
      { id: "gemini-2.5-flash-tts", name: "Gemini 2.5 Flash TTS", provider: "Google", mode: "audio", inputType: "tts" },
      { id: "gemini-2.5-pro-tts", name: "Gemini 2.5 Pro TTS", provider: "Google", mode: "audio", inputType: "tts" },
      { id: "lyria-3-clip", name: "Lyria 3 Clip", provider: "Google", mode: "audio", inputType: "music" },
      { id: "lyria-3-pro", name: "Lyria 3 Pro", provider: "Google", mode: "audio", inputType: "music" },
    ],
  };
}

function writeAcceptedPilotGateEvidence(rootDir: string) {
  const pilotFile = join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3");
  const reviewFile = join(rootDir, "output/audio-qc/reviews/hyperfocus-fireplace-soft-audible-review.json");
  mkdirSync(join(pilotFile, ".."), { recursive: true });
  mkdirSync(join(reviewFile, ".."), { recursive: true });
  writeFileSync(pilotFile, Buffer.alloc(300_000, 11));
  writeFileSync(reviewFile, JSON.stringify(passingAudibleReview("fireplace:soft"), null, 2) + "\n");
  return { pilotFile, reviewFile };
}

describe("check-hyperfocus-audio-assets", () => {
  it("builds original V1 focus source coverage report", () => {
    const report = qc.buildOriginalSourceCoverageReport({
      rootDir: process.cwd(),
      generatedAt: "2026-06-19T00:00:00.000Z",
    });

    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        focusAssetCount: 6,
        specFamilyCount: 6,
        coveredFamilyCount: 6,
        expectedLevelCount: 18,
        plannedLevelCount: 18,
        issues: [],
      }),
    );
    expect(report.assets.map((asset) => asset.familyId)).toEqual([
      "forest",
      "rain",
      "ocean",
      "fireplace",
      "river",
      "wind",
    ]);
    expect(report.assets).toContainEqual(
      expect.objectContaining({
        assetId: "focus-fireplace",
        familyId: "fireplace",
        publicPath: "sounds/hyperfocus/hyperfocus-fireplace-deep.mp3",
        sourcePath: "public/sounds/hyperfocus/hyperfocus-fireplace-deep.mp3",
        specCurrentFile: "public/sounds/hyperfocus/hyperfocus-fireplace-deep.mp3",
        levelIds: ["soft", "deep", "intense"],
        status: "covered",
      }),
    );
  });

  it("builds Gemini prompt policy coverage report for all generated variants", () => {
    const report = qc.buildPromptPolicyReport({
      rootDir: process.cwd(),
      generatedAt: "2026-06-19T00:00:00.000Z",
    });

    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        familyCount: 6,
        levelCount: 18,
        promptCount: 18,
        issueCount: 0,
        issues: [],
      }),
    );
    expect(report.policy).toEqual(
      expect.objectContaining({
        requiredProvider: "Google Gemini family only",
        allowedCurrentCandidate: "lyria-3-clip",
        requiredDurationSeconds: 30,
      }),
    );
    expect(report.policy.promptRequirements).toEqual(
      expect.arrayContaining(["duration", "seamless", "nonMusical", "loop", "noVoices", "noMelody", "noBeat", "noForegroundAlarm" ]),
    );
    expect(report.policy.rejectIfRequirements).toEqual(expect.arrayContaining(["musicalRejection", "foregroundSafetyRejection"]));
    expect(report.assets).toHaveLength(18);
    expect(report.assets).toContainEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        status: "pass",
        promptRequirements: expect.objectContaining({
          duration: true,
          seamless: true,
          nonMusical: true,
          loop: true,
          noVoices: true,
          noMelody: true,
          noBeat: true,
          noForegroundAlarm: true,
        }),
        rejectIfRequirements: expect.objectContaining({
          musicalRejection: true,
          foregroundSafetyRejection: true,
        }),
        issues: [],
      }),
    );
  });

  it("writes Gemini prompt policy evidence from the CLI without falling through", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-prompt-policy-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-prompt-policy-current.json");

    const output = execFileSync(
      process.execPath,
      [
        "scripts/check-hyperfocus-audio-assets.cjs",
        "--root",
        rootDir,
        "--write-prompt-policy-report",
        outputFile,
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toContain("[hyperfocus-prompt-policy] PASS");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        familyCount: 6,
        levelCount: 18,
        promptCount: 18,
        issueCount: 0,
      }),
    );
  });

  it("builds a provider capability report for current Google audio model inventory", () => {
    const report = qc.buildProviderCapabilityReport({
      rootDir: process.cwd(),
      generatedAt: "2026-06-19T00:00:00.000Z",
      inventory: currentGoogleAudioModelInventory(),
    });

    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        provider: "Google",
        mode: "audio",
        googleAudioModelCount: 4,
        ttsModelCount: 2,
        musicModelCount: 2,
        sfxModelCount: 0,
        soundscapeOrSfxModelAvailable: false,
        allowedPilotModelAvailable: true,
        recommendedAction: "pilot-only-with-strict-qc",
        issues: [],
      }),
    );
    expect(report.pilotCandidateModels.map((model) => model.id)).toEqual(["lyria-3-clip", "lyria-3-pro"]);
    expect(report.disallowedModels.map((model) => model.id)).toEqual(["gemini-2.5-flash-tts", "gemini-2.5-pro-tts"]);
    expect(report.models).toContainEqual(
      expect.objectContaining({
        id: "gemini-2.5-flash-tts",
        status: "disallowed",
        reason: "tts-model-not-ambience",
      }),
    );
    expect(report.models).toContainEqual(
      expect.objectContaining({
        id: "lyria-3-clip",
        status: "pilot-candidate",
        reason: "google-lyria-music-model-requires-strict-ambience-qc",
      }),
    );
    expect(report.warnings).toContainEqual(
      expect.objectContaining({
        code: "no-google-sfx-or-soundscape-model",
      }),
    );
  });

  it("writes provider capability evidence from the CLI and includes it in readiness", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-provider-capability-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const inventoryFile = join(rootDir, "output/audio-qc/picsart-google-audio-models-current.json");
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-provider-capability-current.json");
    mkdirSync(join(inventoryFile, ".."), { recursive: true });
    writeFileSync(inventoryFile, JSON.stringify(currentGoogleAudioModelInventory(), null, 2) + "\n");

    const output = execFileSync(
      process.execPath,
      [
        join(process.cwd(), "scripts/check-hyperfocus-audio-assets.cjs"),
        "--write-provider-capability-report",
        outputFile,
        "--model-inventory",
        inventoryFile,
        "--generated-at",
        "2026-06-19T00:00:00.000Z",
      ],
      { cwd: rootDir, encoding: "utf8" },
    );

    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    const readiness = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(output).toContain("[hyperfocus-provider-capability] PASS");
    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        googleAudioModelCount: 4,
        soundscapeOrSfxModelAvailable: false,
        allowedPilotModelAvailable: true,
      }),
    );
    expect(readiness.checks.providerCapability).toEqual(
      expect.objectContaining({
        ok: true,
        googleAudioModelCount: 4,
        soundscapeOrSfxModelAvailable: false,
        allowedPilotModelAvailable: true,
        warningCount: 1,
        blocking: false,
      }),
    );
  });

  it("writes original V1 focus source coverage from the CLI without falling through", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-source-coverage-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "src/lib"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    copyFileSync(
      join(process.cwd(), "src/lib/appAudioAssets.ts"),
      join(rootDir, "src/lib/appAudioAssets.ts"),
    );
    for (const asset of qc.buildOriginalSourceCoverageReport({ rootDir: process.cwd() }).assets) {
      const targetPath = join(rootDir, asset.sourcePath);
      mkdirSync(dirname(targetPath), { recursive: true });
      copyFileSync(join(process.cwd(), asset.sourcePath), targetPath);
    }
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-source-coverage-current.json");

    const output = execFileSync(
      process.execPath,
      [
        "scripts/check-hyperfocus-audio-assets.cjs",
        "--root",
        rootDir,
        "--write-source-coverage-report",
        outputFile,
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toContain("[hyperfocus-source-coverage] PASS");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        focusAssetCount: 6,
        coveredFamilyCount: 6,
        plannedLevelCount: 18,
      }),
    );
  });

  it("derives the exact 18 generated Hyperfocus assets from the audio spec", () => {
    const expected = qc.getExpectedHyperfocusAssets({ rootDir: process.cwd() });

    expect(expected).toHaveLength(18);
    expect(expected.map((asset) => asset.fileName)).toContain("hyperfocus-fireplace-soft.mp3");
    expect(expected.map((asset) => asset.fileName)).toContain("hyperfocus-forest-intense.mp3");
    expect(new Set(expected.map((asset) => asset.publicPath)).size).toBe(18);
  });

  it("fails when the generated public asset pack is missing", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-assets-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );

    const result = qc.validateHyperfocusAssetSet({ rootDir, skipAudioProbe: true });

    expect(result.ok).toBe(false);
    expect(result.issues.filter((issue) => issue.code === "missing-file")).toHaveLength(18);
  });

  it("rejects clipped fading audio that cannot loop cleanly", () => {
    const issues = qc.evaluateHyperfocusAudioMetrics({
      durationSeconds: 29.1,
      sampleRate: 48000,
      channels: 2,
      rmsDbfs: -14.4,
      peakDbfs: 0,
      clippedSamples: 157,
      startRmsDbfs: -13.5,
      endRmsDbfs: -65.7,
      seamMeanAbsDiff: 0.14,
      fileBytes: 700_000,
    });

    expect(issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["peak-too-hot", "clipped-samples", "end-fade", "bad-loop-seam"]),
    );
  });

  it("refuses to promote a candidate whose file name is not in the spec", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "not really audio");

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-unknown-soft.mp3",
      probeAudioFile: vi.fn(),
    });

    expect(result.ok).toBe(false);
    expect(result.issues.map((issue) => issue.code)).toContain("unknown-asset");
  });

  it("refuses to copy a known candidate when QC metrics fail", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "not really audio");

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      probeAudioFile: () => ({
        durationSeconds: 29.1,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -14.4,
        peakDbfs: 0,
        clippedSamples: 157,
        startRmsDbfs: -13.5,
        endRmsDbfs: -65.7,
        seamMeanAbsDiff: 0.14,
        fileBytes: 700_000,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.destinationPath).toBeUndefined();
    expect(result.issues.map((issue) => issue.code)).toEqual(
      expect.arrayContaining(["peak-too-hot", "clipped-samples", "end-fade", "bad-loop-seam"]),
    );
  });

  it("refuses to promote a candidate that reuses an original Hyperfocus source file", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-source-reuse-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const sourceBytes = Buffer.from("legacy-fireplace-source-audio-bytes");
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-deep.mp3"), sourceBytes);
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, sourceBytes);

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      provenance: {
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-source-reuse",
        source: "picsart",
        generatedAt: "2026-06-19T00:00:00.000Z",
        approvedBy: "operator-qc",
        audibleReview: passingAudibleReview(),
      },
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.destinationPath).toBeUndefined();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "source-audio-reuse",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
    expect(existsSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"))).toBe(false);
  });

  it("copies a known candidate into the public Hyperfocus pack after QC passes", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "accepted-audio-bytes");

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.destinationPath).toBe(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"));
    expect(existsSync(result.destinationPath ?? "")).toBe(true);
    expect(readFileSync(result.destinationPath ?? "", "utf8")).toBe("accepted-audio-bytes");
  });

  it("requires audible review before promoting a Gemini-provenance candidate", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-audible-review-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "accepted-audio-bytes");
    const probeAudioFile = vi.fn(() => ({
      durationSeconds: 30,
      sampleRate: 48000,
      channels: 2,
      rmsDbfs: -22,
      peakDbfs: -2.5,
      clippedSamples: 0,
      startRmsDbfs: -22.2,
      endRmsDbfs: -22.7,
      seamMeanAbsDiff: 0.015,
      fileBytes: 720_000,
    }));

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      provenance: {
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-123",
        source: "picsart",
        generatedAt: "2026-06-19T00:00:00.000Z",
        approvedBy: "operator-qc",
      },
      probeAudioFile,
    });

    expect(result.ok).toBe(false);
    expect(result.destinationPath).toBeUndefined();
    expect(probeAudioFile).not.toHaveBeenCalled();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "missing-audible-review",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
  });

  it("requires audible review prompt hashes to match the current generation prompt", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-review-prompt-hash-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "accepted-audio-bytes");
    const probeAudioFile = vi.fn(() => passingAudioMetrics());

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      provenance: {
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-stale-review",
        source: "picsart",
        generatedAt: "2026-06-19T00:00:00.000Z",
        approvedBy: "operator-qc",
        audibleReview: {
          ...passingAudibleReview(),
          promptSha256: "0".repeat(64),
        },
      },
      probeAudioFile,
    });

    expect(result.ok).toBe(false);
    expect(result.destinationPath).toBeUndefined();
    expect(probeAudioFile).not.toHaveBeenCalled();
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "audible-review-prompt-mismatch",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
  });

  it("writes Gemini-family provenance when promoting an accepted candidate", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "accepted-audio-bytes");

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      provenance: {
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-123",
        source: "picsart",
        generatedAt: "2026-06-19T00:00:00.000Z",
        approvedBy: "operator-qc",
        audibleReview: passingAudibleReview(),
      },
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(true);
    const provenance = JSON.parse(readFileSync(join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"), "utf8"));
    expect(provenance.assets["fireplace:soft"]).toEqual(
      expect.objectContaining({
        fileName: "hyperfocus-fireplace-soft.mp3",
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-123",
        source: "picsart",
        approvedBy: "operator-qc",
      }),
    );
    expect(provenance.assets["fireplace:soft"].audibleReview).toEqual(
      expect.objectContaining({
        reviewer: "operator-qc",
        noVocals: true,
        noSpeech: true,
        noMelody: true,
        noBeat: true,
        loopAudiblyClean: true,
      }),
    );
    expect(provenance.assets["fireplace:soft"].candidateSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(provenance.assets["fireplace:soft"].publicSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("requires Gemini provenance arguments before CLI promotion probes audio", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "not-real-audio-but-should-not-be-probed-yet");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--promote",
          candidateFile,
          "--file-name",
          "hyperfocus-fireplace-soft.mp3",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-audio-promote] FAIL");
    expect(output).toContain("non-gemini-family-model");
    expect(output).not.toContain("probe-failed");
  });

  it("refuses Gemini TTS provenance before probing a candidate", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-tts-provenance-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "not-real-audio-but-should-not-be-probed-yet");
    const probeAudioFile = vi.fn(() => passingAudioMetrics());

    const result = qc.promoteCandidateAudioAsset({
      rootDir,
      candidateFile,
      fileName: "hyperfocus-fireplace-soft.mp3",
      probeAudioFile,
      provenance: {
        provider: "Google",
        model: "gemini-2.5-flash-tts",
        generationId: "tts-generation-should-not-be-accepted",
        source: "picsart",
        generatedAt: "2026-06-19T00:00:00.000Z",
        approvedBy: "operator-qc",
        audibleReview: passingAudibleReview("fireplace:soft"),
      },
    });

    expect(result.ok).toBe(false);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "tts-model-not-ambience",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
    expect(probeAudioFile).not.toHaveBeenCalled();
  });

  it("routes CLI promotion requests through the candidate QC command", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-promote-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const candidateFile = join(rootDir, "candidate.mp3");
    writeFileSync(candidateFile, "candidate-audio-bytes");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--promote",
          candidateFile,
          "--file-name",
          "hyperfocus-unknown-soft.mp3",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-audio-promote] FAIL");
    expect(output).toContain("unknown-asset");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
  });

  it("preflights batch promotions and refuses to copy any candidate when one entry is invalid", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-batch-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/gemini-candidates"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    writeAcceptedPilotGateEvidence(rootDir);
    const invalidFileName = expected[1].fileName;
    const batch = {
      assets: expected.map((asset, index) => {
        const candidateFile = join(rootDir, "output/gemini-candidates", asset.fileName);
        if (index !== 1) writeFileSync(candidateFile, Buffer.from("candidate-" + asset.fileName));
        return {
          fileName: asset.fileName,
          candidateFile,
          provider: "Google",
          model: "lyria-3-clip",
          generationId: "picsart-generation-" + asset.familyId + "-" + asset.levelId,
          source: "picsart",
          generatedAt: "2026-06-19T00:00:00.000Z",
          approvedBy: "operator-qc",
          audibleReview: passingAudibleReview(asset.familyId + ":" + asset.levelId),
        };
      }),
    };

    const result = qc.promoteCandidateAudioBatch({
      rootDir,
      batch,
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(result.ok).toBe(false);
    expect(result.promotedCount).toBe(0);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "missing-candidate",
        fileName: invalidFileName,
      }),
    ]);
    expect(existsSync(join(rootDir, "public/sounds/hyperfocus", expected[0].fileName))).toBe(false);
    expect(existsSync(join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"))).toBe(false);
  });

  it("promotes a complete Gemini batch and writes provenance for every generated variant", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-batch-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/gemini-candidates"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    writeAcceptedPilotGateEvidence(rootDir);
    const batch = {
      assets: expected.map((asset) => {
        const candidateFile = join(rootDir, "output/gemini-candidates", asset.fileName);
        writeFileSync(candidateFile, Buffer.from("candidate-" + asset.fileName));
        return {
          fileName: asset.fileName,
          candidateFile,
          provider: "Google",
          model: "lyria-3-clip",
          generationId: "picsart-generation-" + asset.familyId + "-" + asset.levelId,
          source: "picsart",
          generatedAt: "2026-06-19T00:00:00.000Z",
          approvedBy: "operator-qc",
          audibleReview: passingAudibleReview(asset.familyId + ":" + asset.levelId),
        };
      }),
    };

    const result = qc.promoteCandidateAudioBatch({
      rootDir,
      batch,
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(result.ok).toBe(true);
    expect(result.promotedCount).toBe(18);
    expect(result.issues).toEqual([]);
    expect(result.destinations).toHaveLength(18);
    for (const asset of expected) {
      expect(existsSync(join(rootDir, "public/sounds/hyperfocus", asset.fileName))).toBe(true);
    }
    const provenance = JSON.parse(readFileSync(join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"), "utf8"));
    expect(Object.keys(provenance.assets)).toHaveLength(18);
    expect(provenance.assets["fireplace:soft"]).toEqual(
      expect.objectContaining({
        fileName: "hyperfocus-fireplace-soft.mp3",
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-fireplace-soft",
      }),
    );
    expect(provenance.assets["fireplace:soft"].publicSha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("routes CLI batch promotion requests through the all-or-nothing command", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-batch-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/gemini-candidates"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const batchFile = join(rootDir, "output/audio-qc/hyperfocus-batch.json");
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    writeFileSync(
      batchFile,
      JSON.stringify({
        assets: expected.map((asset) => ({
          fileName: asset.fileName,
          candidateFile: "output/gemini-candidates/" + asset.fileName,
          provider: "Google",
          model: "lyria-3-clip",
          generationId: "picsart-generation-" + asset.familyId + "-" + asset.levelId,
          source: "picsart",
          generatedAt: "2026-06-19T00:00:00.000Z",
          approvedBy: "operator-qc",
          audibleReview: passingAudibleReview(asset.familyId + ":" + asset.levelId),
        })),
      }),
    );

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--promote-batch",
          batchFile,
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-audio-promote-batch] FAIL");
    expect(output).toContain("pilot-gate-not-accepted");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    expect(existsSync(join(rootDir, "public/sounds/hyperfocus", expected[0].fileName))).toBe(false);
  });

  it("writes a promotion-batch-template that matches the Gemini queue and batch promotion contract", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-batch-template-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-gemini-batch-template.json");

    const result = qc.writePromotionBatchTemplate({ rootDir, outputFile, model: "lyria-3-clip" });

    expect(result.ok).toBe(true);
    expect(result.outputFile).toBe(outputFile);
    expect(result.batch.defaults).toEqual(
      expect.objectContaining({
        provider: "Google",
        model: "lyria-3-clip",
        source: "picsart",
        approvedBy: "operator-qc",
      }),
    );
    expect(result.batch.assets).toHaveLength(18);
    const fireplaceTemplateAsset = result.batch.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(fireplaceTemplateAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        candidateFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
        audibleReviewFile: "output/audio-qc/reviews/hyperfocus-fireplace-soft-audible-review.json",
        generationId: "<generation-id:fireplace:soft>",
      }),
    );
    const written = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(written).toEqual(result.batch);

    const batchResult = qc.promoteCandidateAudioBatch({
      rootDir,
      batchFile: outputFile,
      probeAudioFile: () => passingAudioMetrics(),
    });
    expect(batchResult.ok).toBe(false);
    expect(batchResult.promotedCount).toBe(0);
    expect(batchResult.issues[0]).toEqual(
      expect.objectContaining({
        code: "audible-review-read-failed",
        fileName: "hyperfocus-forest-soft.mp3",
      }),
    );
  });

  it("writes pilot-only promotion and URL intake templates", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-pilot-templates-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const promotionFile = join(rootDir, "output/audio-qc/hyperfocus-gemini-pilot-batch-template.json");
    const urlIntakeFile = join(rootDir, "output/audio-qc/hyperfocus-pilot-candidate-url-intake-template.json");

    const promotion = qc.writePromotionBatchTemplate({ rootDir, outputFile: promotionFile, model: "lyria-3-clip", phase: "pilot" });
    const urlIntake = qc.writeCandidateUrlIntakeTemplate({ rootDir, outputFile: urlIntakeFile, model: "lyria-3-clip", phase: "pilot" });

    expect(promotion.ok).toBe(true);
    expect(promotion.batch).toEqual(
      expect.objectContaining({
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
      }),
    );
    expect(promotion.batch.assets).toEqual([
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        candidateFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
      }),
    ]);

    expect(urlIntake.ok).toBe(true);
    expect(urlIntake.batch).toEqual(
      expect.objectContaining({
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
      }),
    );
    expect(urlIntake.batch.assets).toEqual([
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        url: "<generated-audio-url:fireplace:soft>",
        destinationFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
      }),
    ]);
    expect(JSON.parse(readFileSync(promotionFile, "utf8"))).toEqual(promotion.batch);
    expect(JSON.parse(readFileSync(urlIntakeFile, "utf8"))).toEqual(urlIntake.batch);
  });

  it("routes CLI promotion-batch-template writes without falling through to generated-pack QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-batch-template-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-gemini-batch-template.json");

    const output = execFileSync(
      process.execPath,
      [
        "scripts/check-hyperfocus-audio-assets.cjs",
        "--root",
        rootDir,
        "--write-promotion-batch-template",
        outputFile,
        "--model",
        "lyria-3-clip",
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toContain("[hyperfocus-promotion-batch-template] PASS");
    expect(output).not.toContain("[hyperfocus-audio-qc]");
    const template = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(template.assets).toHaveLength(18);
    expect(template.assets[17]).toEqual(
      expect.objectContaining({
        variantId: "wind:intense",
        fileName: "hyperfocus-wind-intense.mp3",
      }),
    );
  });


  it("writes a candidate URL intake template for every generated Gemini variant", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-template-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-candidate-url-intake-template.json");

    const result = qc.writeCandidateUrlIntakeTemplate({ rootDir, outputFile, model: "lyria-3-clip" });

    expect(result.ok).toBe(true);
    expect(result.outputFile).toBe(outputFile);
    expect(result.batch.defaults).toEqual(
      expect.objectContaining({
        provider: "Google",
        model: "lyria-3-clip",
        source: "picsart",
      }),
    );
    expect(result.batch.assets).toHaveLength(18);
    const fireplaceUrlTemplateAsset = result.batch.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(fireplaceUrlTemplateAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        url: "<generated-audio-url:fireplace:soft>",
        destinationFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
        generationId: "<generation-id:fireplace:soft>",
      }),
    );
    const written = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(written).toEqual(result.batch);
  });

  it("routes CLI pilot URL intake template writes through phase selection", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-pilot-url-template-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-pilot-candidate-url-intake-template.json");

    const output = execFileSync(
      process.execPath,
      [
        "scripts/check-hyperfocus-audio-assets.cjs",
        "--root",
        rootDir,
        "--write-candidate-url-intake-template",
        outputFile,
        "--model",
        "lyria-3-clip",
        "--phase",
        "pilot",
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toContain("[hyperfocus-candidate-url-intake-template] PASS");
    expect(output).not.toContain("[hyperfocus-audio-qc]");
    const template = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(template).toEqual(
      expect.objectContaining({
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
      }),
    );
    expect(template.assets).toEqual([
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
  });

  it("requires an accepted pilot gate before full-pack URL download and promotion", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-full-pack-pilot-gate-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/gemini-candidates"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const urlBatch = {
      defaults: { provider: "Google", model: "lyria-3-clip", source: "picsart" },
      assets: expected.map((asset, index) => ({
        variantId: asset.familyId + ":" + asset.levelId,
        fileName: asset.fileName,
        url: "https://cdn.example.test/generated/" + index + ".mp3",
        generationId: "generation-" + index,
      })),
    };
    const downloadFile = vi.fn(async () => undefined);

    const downloadResult = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch: urlBatch,
      downloadFile,
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(downloadResult.ok).toBe(false);
    expect(downloadResult.downloadedCount).toBe(0);
    expect(downloadResult.issues).toEqual([
      expect.objectContaining({ code: "pilot-gate-not-accepted", fileName: "hyperfocus-fireplace-soft.mp3" }),
    ]);
    expect(downloadFile).not.toHaveBeenCalled();

    const promotionBatch = {
      assets: expected.map((asset) => {
        const candidateFile = join(rootDir, "output/gemini-candidates", asset.fileName);
        writeFileSync(candidateFile, Buffer.from("candidate-" + asset.fileName));
        return {
          fileName: asset.fileName,
          candidateFile,
          provider: "Google",
          model: "lyria-3-clip",
          generationId: "picsart-generation-" + asset.familyId + "-" + asset.levelId,
          source: "picsart",
          generatedAt: "2026-06-19T00:00:00.000Z",
          approvedBy: "operator-qc",
          audibleReview: passingAudibleReview(asset.familyId + ":" + asset.levelId),
        };
      }),
    };

    const promotionResult = qc.promoteCandidateAudioBatch({
      rootDir,
      batch: promotionBatch,
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(promotionResult.ok).toBe(false);
    expect(promotionResult.promotedCount).toBe(0);
    expect(promotionResult.issues).toEqual([
      expect.objectContaining({ code: "pilot-gate-not-accepted", fileName: "hyperfocus-fireplace-soft.mp3" }),
    ]);
    expect(existsSync(join(rootDir, "public/sounds/hyperfocus", expected[0].fileName))).toBe(false);
  });

  it("rejects non-Gemini candidate URL intake before download", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-provider-policy-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const pilotAsset = qc.getExpectedHyperfocusAssets({ rootDir }).find((asset) => asset.familyId === "fireplace" && asset.levelId === "soft")!;
    const baseEntry = {
      variantId: "fireplace:soft",
      fileName: pilotAsset.fileName,
      url: "https://cdn.example.test/generated/fireplace-soft.mp3",
      generationId: "generation-fireplace-soft",
    };
    const downloadFile = vi.fn(async () => undefined);

    const nonGoogleResult = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch: {
        phase: "pilot",
        defaults: { provider: "ElevenLabs", model: "elevenlabs-sfx-v2", source: "picsart" },
        assets: [baseEntry],
      },
      downloadFile,
    });

    expect(nonGoogleResult.ok).toBe(false);
    expect(nonGoogleResult.downloadedCount).toBe(0);
    expect(nonGoogleResult.issues.map((issue) => issue.code)).toContain("non-google-candidate-url-provider");

    const ttsResult = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch: {
        phase: "pilot",
        defaults: { provider: "Google", model: "gemini-2.5-flash-tts", source: "picsart" },
        assets: [baseEntry],
      },
      downloadFile,
    });

    expect(ttsResult.ok).toBe(false);
    expect(ttsResult.downloadedCount).toBe(0);
    expect(ttsResult.issues.map((issue) => issue.code)).toContain("tts-model-not-ambience");
    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("rejects candidate URL intake without generation ids before download", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-generation-id-policy-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const pilotAsset = qc.getExpectedHyperfocusAssets({ rootDir }).find((asset) => asset.familyId === "fireplace" && asset.levelId === "soft")!;
    const downloadFile = vi.fn(async () => undefined);
    const baseBatch = {
      phase: "pilot",
      defaults: { provider: "Google", model: "lyria-3-clip", source: "picsart" },
    };

    for (const generationId of ["", "<generation-id:fireplace:soft>"]) {
      const result = await qc.downloadCandidateUrlBatch({
        rootDir,
        batch: {
          ...baseBatch,
          assets: [
            {
              variantId: "fireplace:soft",
              fileName: pilotAsset.fileName,
              url: "https://cdn.example.test/generated/fireplace-soft.mp3",
              generationId,
            },
          ],
        },
        downloadFile,
      });

      expect(result.ok).toBe(false);
      expect(result.downloadedCount).toBe(0);
      expect(result.issues.map((reportedIssue) => reportedIssue.code)).toContain("missing-generation-id");
    }

    expect(downloadFile).not.toHaveBeenCalled();
  });

  it("allows explicit pilot-only candidate URL downloads and promotion without weakening full-pack validation", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-pilot-url-download-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const pilotAsset = qc.getExpectedHyperfocusAssets({ rootDir }).find((asset) => asset.familyId === "fireplace" && asset.levelId === "soft")!;
    const pilotEntry = {
      variantId: "fireplace:soft",
      fileName: pilotAsset.fileName,
      url: "https://cdn.example.test/generated/fireplace-soft.mp3",
      generationId: "generation-fireplace-soft",
    };

    const strictFullResult = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch: { assets: [pilotEntry] },
      downloadFile: async () => undefined,
    });
    expect(strictFullResult.ok).toBe(false);
    expect(strictFullResult.issues.map((issue) => issue.code)).toContain("batch-size-mismatch");

    const downloadedUrls: string[] = [];
    const pilotDownload = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch: { phase: "pilot", pilotVariantId: "fireplace:soft", defaults: { provider: "Google", model: "lyria-3-clip", source: "picsart" }, assets: [pilotEntry] },
      downloadFile: async (url, destinationFile) => {
        downloadedUrls.push(url);
        mkdirSync(join(destinationFile, ".."), { recursive: true });
        writeFileSync(destinationFile, Buffer.alloc(300_000, 7));
      },
    });

    expect(pilotDownload.ok).toBe(true);
    expect(pilotDownload.downloadedCount).toBe(1);
    expect(downloadedUrls).toEqual(["https://cdn.example.test/generated/fireplace-soft.mp3"]);
    const acceptedFile = join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3");
    expect(existsSync(acceptedFile)).toBe(true);

    const strictPromotionResult = qc.promoteCandidateAudioBatch({
      rootDir,
      batch: {
        assets: [
          {
            fileName: pilotAsset.fileName,
            candidateFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
            provider: "Google",
            model: "lyria-3-clip",
            generationId: "generation-fireplace-soft",
            source: "picsart",
            approvedBy: "operator-qc",
            audibleReview: passingAudibleReview("fireplace:soft"),
          },
        ],
      },
      probeAudioFile: () => passingAudioMetrics(),
    });
    expect(strictPromotionResult.ok).toBe(false);
    expect(strictPromotionResult.issues.map((issue) => issue.code)).toContain("batch-size-mismatch");

    const pilotPromotion = qc.promoteCandidateAudioBatch({
      rootDir,
      batch: {
        phase: "pilot",
        pilotVariantId: "fireplace:soft",
        assets: [
          {
            fileName: pilotAsset.fileName,
            candidateFile: "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3",
            provider: "Google",
            model: "lyria-3-clip",
            generationId: "generation-fireplace-soft",
            source: "picsart",
            approvedBy: "operator-qc",
            audibleReview: passingAudibleReview("fireplace:soft"),
          },
        ],
      },
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(pilotPromotion.ok).toBe(true);
    expect(pilotPromotion.promotedCount).toBe(1);
    expect(existsSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"))).toBe(true);
    const provenance = JSON.parse(readFileSync(join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"), "utf8"));
    expect(Object.keys(provenance.assets)).toEqual(["fireplace:soft"]);
  });

  it("downloads candidate URL batches all-or-nothing into accepted quarantine paths", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-download-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    writeAcceptedPilotGateEvidence(rootDir);
    const batch = {
      defaults: { provider: "Google", model: "lyria-3-clip", source: "picsart" },
      assets: expected.map((asset, index) => ({
        variantId: asset.familyId + ":" + asset.levelId,
        fileName: asset.fileName,
        url: "https://cdn.example.test/generated/" + index + ".mp3",
        generationId: "generation-" + index,
      })),
    };
    const downloadedUrls: string[] = [];

    const result = await qc.downloadCandidateUrlBatch({
      rootDir,
      batch,
      probeAudioFile: () => passingAudioMetrics(),
      downloadFile: async (url, destinationFile) => {
        downloadedUrls.push(url);
        mkdirSync(join(destinationFile, ".."), { recursive: true });
        writeFileSync(destinationFile, Buffer.alloc(300_000, downloadedUrls.length));
      },
    });

    expect(result.ok).toBe(true);
    expect(result.downloadedCount).toBe(18);
    expect(downloadedUrls).toHaveLength(18);
    expect(result.destinations).toHaveLength(18);
    expect(existsSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3"))).toBe(true);
    expect(readFileSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3"))).toHaveLength(300_000);
  });

  it("refuses candidate URL batches without writing partial accepted files when one URL is invalid", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-invalid-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const batch = {
      assets: expected.map((asset, index) => ({
        variantId: asset.familyId + ":" + asset.levelId,
        fileName: asset.fileName,
        url: index === 3 ? "file:///tmp/generated.mp3" : "https://cdn.example.test/generated/" + index + ".mp3",
      })),
    };
    const downloadFile = vi.fn(async () => undefined);

    const result = await qc.downloadCandidateUrlBatch({ rootDir, batch, downloadFile });

    expect(result.ok).toBe(false);
    expect(result.downloadedCount).toBe(0);
    expect(result.issues.map((issue) => issue.code)).toContain("invalid-candidate-url");
    expect(downloadFile).not.toHaveBeenCalled();
    expect(existsSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3"))).toBe(false);
  });

  it("refuses cleartext HTTP candidate URL batches before downloading", async () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-url-cleartext-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const pilotAsset = expected.find((asset) => asset.familyId === "fireplace" && asset.levelId === "soft")!;
    const batch = {
      phase: "pilot",
      pilotVariantId: "fireplace:soft",
      defaults: { provider: "Google", model: "lyria-3-clip", source: "picsart" },
      assets: [
        {
          variantId: "fireplace:soft",
          fileName: pilotAsset.fileName,
          url: "http://cdn.example.test/generated/0.mp3",
          generationId: "generation-0",
        },
      ],
    };
    const downloadFile = vi.fn(async () => undefined);

    const result = await qc.downloadCandidateUrlBatch({ rootDir, batch, downloadFile, skipAudioProbe: true });

    expect(result.ok).toBe(false);
    expect(result.downloadedCount).toBe(0);
    expect(result.issues).toContainEqual(
      expect.objectContaining({
        code: "cleartext-candidate-url",
        fileName: pilotAsset.fileName,
      }),
    );
    expect(downloadFile).not.toHaveBeenCalled();
    expect(existsSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3"))).toBe(false);
  });

  it("routes CLI candidate URL downloads through the all-or-nothing command", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-cli-url-download-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const batchFile = join(rootDir, "output/audio-qc/hyperfocus-candidate-url-batch.json");
    writeFileSync(
      batchFile,
      JSON.stringify({
        assets: expected.map((asset, index) => ({
          variantId: asset.familyId + ":" + asset.levelId,
          fileName: asset.fileName,
          url: index === 0 ? "file:///tmp/generated.mp3" : "https://cdn.example.test/generated/" + index + ".mp3",
        })),
      }),
    );

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--download-candidate-urls",
          batchFile,
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-candidate-url-download] FAIL");
    expect(output).toContain("invalid-candidate-url");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    expect(existsSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3"))).toBe(false);
  });

  it("builds phase-specific generation authorization gates", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-generation-auth-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );

    const pilotBlocked = qc.buildGenerationAuthorizationReport({
      rootDir,
      model: "lyria-3-clip",
      phase: "pilot",
      creditBalance: 1,
      creditCostPerJob: 2,
      nextResetDate: "2026-06-26T16:19:03.909Z",
      skipAudioProbe: true,
    });

    expect(pilotBlocked).toEqual(
      expect.objectContaining({
        ok: false,
        authorized: false,
        phase: "pilot",
        provider: "Google",
        model: "lyria-3-clip",
      }),
    );
    expect(pilotBlocked.queue).toEqual(expect.objectContaining({ ok: true, jobCount: 1, requiredCreditCost: 2, requiresAcceptedPilot: false }));
    expect(pilotBlocked.promptPolicy).toEqual(expect.objectContaining({ ok: true, promptCount: 18, blocking: false }));
    expect(pilotBlocked.credits).toEqual(expect.objectContaining({ ok: false, creditBalance: 1, creditCostPerJob: 2, requiredCreditCost: 2, sufficient: false }));
    expect(pilotBlocked.pilotGate).toEqual(expect.objectContaining({ required: false, ok: true, blocking: false }));
    expect(pilotBlocked.blockers.map((blocker) => blocker.code)).toEqual(["generation-credits-insufficient"]);

    const fullBlocked = qc.buildGenerationAuthorizationReport({
      rootDir,
      model: "lyria-3-clip",
      phase: "full",
      creditBalance: 36,
      creditCostPerJob: 2,
      skipAudioProbe: true,
    });

    expect(fullBlocked.ok).toBe(false);
    expect(fullBlocked.phase).toBe("full-pack-after-pilot");
    expect(fullBlocked.queue).toEqual(expect.objectContaining({ ok: true, jobCount: 18, requiredCreditCost: 36, requiresAcceptedPilot: true }));
    expect(fullBlocked.credits).toEqual(expect.objectContaining({ ok: true, creditBalance: 36, creditCostPerJob: 2, requiredCreditCost: 36, sufficient: true }));
    expect(fullBlocked.pilotGate).toEqual(expect.objectContaining({ required: true, ok: false, blocking: true }));
    expect(fullBlocked.blockers.map((blocker) => blocker.code)).toEqual(["pilot-gate-not-accepted"]);

    writeAcceptedPilotGateEvidence(rootDir);
    const fullAuthorized = qc.buildGenerationAuthorizationReport({
      rootDir,
      model: "lyria-3-clip",
      phase: "full",
      creditBalance: 36,
      creditCostPerJob: 2,
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(fullAuthorized.ok).toBe(true);
    expect(fullAuthorized.authorized).toBe(true);
    expect(fullAuthorized.blockers).toEqual([]);
    expect(fullAuthorized.pilotGate).toEqual(expect.objectContaining({ required: true, ok: true, blocking: false }));
  });

  it("blocks generation authorization when Gemini prompt policy is invalid", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-generation-auth-prompt-policy-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    const spec = JSON.parse(readFileSync(join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"), "utf8"));
    const fireplaceFamily = spec.families.find((family: { id: string }) => family.id === "fireplace");
    fireplaceFamily.levels[0].prompt = "short musical jingle with vocals";
    writeFileSync(join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"), JSON.stringify(spec, null, 2) + "\n");

    const pilotBlocked = qc.buildGenerationAuthorizationReport({
      rootDir,
      model: "lyria-3-clip",
      phase: "pilot",
      creditBalance: 2,
      creditCostPerJob: 2,
      skipAudioProbe: true,
    });

    expect(pilotBlocked.ok).toBe(false);
    expect(pilotBlocked.authorized).toBe(false);
    expect(pilotBlocked.promptPolicy).toEqual(
      expect.objectContaining({
        ok: false,
        levelCount: 18,
        promptCount: 18,
        blocking: true,
      }),
    );
    expect(pilotBlocked.queue).toEqual(expect.objectContaining({ ok: false, jobCount: 0, requiredCreditCost: null, issueCount: 1 }));
    expect(pilotBlocked.credits).toEqual(expect.objectContaining({ ok: false, creditBalance: 2, creditCostPerJob: 2, requiredCreditCost: null, sufficient: false }));
    expect(pilotBlocked.blockers.map((blocker) => blocker.code)).toEqual(["prompt-policy-invalid"]);
  });

  it("builds a generation decision report that blocks pilot generation when credits are insufficient", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-generation-decision-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    qc.writeProviderCapabilityReport({
      rootDir,
      inventory: currentGoogleAudioModelInventory(),
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    qc.writeGenerationCreditsReport({
      rootDir,
      model: "lyria-3-clip",
      creditBalance: 1,
      pilotCreditCost: 2,
      nextResetDate: "2026-06-26T16:19:03.909Z",
    });

    const report = qc.buildGenerationDecisionReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(report).toEqual(
      expect.objectContaining({
        ok: false,
        shouldGenerate: false,
        nextAction: "wait-for-credits",
        phase: "pilot",
      }),
    );
    expect(report.blockerCodes).toContain("generation-credits-insufficient");
    expect(report.credits).toEqual(
      expect.objectContaining({
        creditBalance: 1,
        pilotCreditCost: 2,
        sufficientForPilot: false,
        nextResetDate: "2026-06-26T16:19:03.909Z",
      }),
    );
    expect(report.providerCapability).toEqual(
      expect.objectContaining({
        ok: true,
        allowedPilotModelAvailable: true,
        soundscapeOrSfxModelAvailable: false,
      }),
    );
    expect(report.pilotAuthorization).toEqual(
      expect.objectContaining({
        authorized: false,
        phase: "pilot",
      }),
    );
  });

  it("writes a generation decision report from the CLI without falling through to asset QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-generation-decision-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    qc.writeProviderCapabilityReport({ rootDir, inventory: currentGoogleAudioModelInventory() });
    qc.writeGenerationCreditsReport({
      rootDir,
      model: "lyria-3-clip",
      creditBalance: 1,
      pilotCreditCost: 2,
      nextResetDate: "2026-06-26T16:19:03.909Z",
    });
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-generation-decision-current.json");
    let output = "";

    try {
      output = execFileSync(
        process.execPath,
        [
          join(process.cwd(), "scripts/check-hyperfocus-audio-assets.cjs"),
          "--root",
          rootDir,
          "--write-generation-decision-report",
          outputFile,
          "--model",
          "lyria-3-clip",
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      output = String((error as { stdout?: string; stderr?: string }).stdout || "") + String((error as { stdout?: string; stderr?: string }).stderr || "");
    }

    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(output).toContain("[hyperfocus-generation-decision] WAIT - wait-for-credits");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    expect(report).toEqual(
      expect.objectContaining({
        ok: false,
        shouldGenerate: false,
        nextAction: "wait-for-credits",
      }),
    );
  });

  it("writes generation credits evidence and blocks readiness when pilot credits are insufficient", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-credits-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );

    const credits = qc.writeGenerationCreditsReport({
      rootDir,
      model: "lyria-3-clip",
      creditBalance: 1,
      pilotCreditCost: 2,
      nextResetDate: "2026-06-26T16:19:03.909Z",
    });

    expect(credits.ok).toBe(false);
    expect(credits.report).toEqual(
      expect.objectContaining({
        ok: false,
        model: "lyria-3-clip",
        creditBalance: 1,
        pilotCreditCost: 2,
        sufficientForPilot: false,
        nextResetDate: "2026-06-26T16:19:03.909Z",
      }),
    );

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(report.checks.generationCredits).toEqual(
      expect.objectContaining({
        ok: false,
        blocking: true,
        creditBalance: 1,
        pilotCreditCost: 2,
        sufficientForPilot: false,
      }),
    );
    expect(report.blockers.map((blocker) => blocker.code)).toContain("generation-credits-insufficient");
  });

  it("writes generation authorization evidence from the CLI without falling through", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-generation-auth-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-generation-authorization-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-generation-authorization-report",
          outputFile,
          "--model",
          "lyria-3-clip",
          "--phase",
          "pilot",
          "--credit-balance",
          "1",
          "--credit-cost-per-job",
          "2",
          "--next-credit-reset",
          "2026-06-26T16:19:03.909Z",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = (failure.stdout || "") + "\n" + (failure.stderr || "");
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-generation-authorization] FAIL");
    expect(output).toContain("generation-credits-insufficient");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(
      expect.objectContaining({
        ok: false,
        authorized: false,
        phase: "pilot",
        model: "lyria-3-clip",
      }),
    );
    expect(report.queue).toEqual(expect.objectContaining({ jobCount: 1, requiredCreditCost: 2 }));
    expect(report.credits).toEqual(expect.objectContaining({ creditBalance: 1, creditCostPerJob: 2, sufficient: false }));
  });

  it("writes generation credits evidence from the CLI", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-credits-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-generation-credits-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-generation-credits-report",
          outputFile,
          "--model",
          "lyria-3-clip",
          "--credit-balance",
          "1",
          "--pilot-credit-cost",
          "2",
          "--next-credit-reset",
          "2026-06-26T16:19:03.909Z",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-generation-credits] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(
      expect.objectContaining({
        ok: false,
        model: "lyria-3-clip",
        creditBalance: 1,
        pilotCreditCost: 2,
        sufficientForPilot: false,
      }),
    );
  });

  it("blocks readiness when accepted candidate files fail objective QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-candidate-qc-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    for (const asset of expected) {
      const acceptedFile = join(rootDir, "output/audio-quarantine", asset.fileName.replace(/\.mp3$/i, "-accepted.mp3"));
      mkdirSync(join(acceptedFile, ".."), { recursive: true });
      writeFileSync(acceptedFile, Buffer.alloc(300_000, 1));
    }

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      probeAudioFile: (file) => {
        if (file.endsWith("hyperfocus-fireplace-soft-accepted.mp3")) {
          return {
            ...passingAudioMetrics(),
            peakDbfs: 0,
            clippedSamples: 12,
            seamMeanAbsDiff: 0.12,
          };
        }
        return passingAudioMetrics();
      },
    });

    expect(report.checks.acceptedCandidates).toEqual(
      expect.objectContaining({
        ok: false,
        presentCount: 18,
        missingCount: 0,
        failedCount: 1,
        issueCount: 3,
        blocking: true,
      }),
    );
    expect(report.blockers.map((blocker) => blocker.code)).toContain("accepted-candidates-invalid");
  });

  it("blocks readiness when accepted candidates exist but audible reviews are still default templates", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-review-approvals-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    const reviewFalseFields = Object.keys(passingAudibleReview()).filter((key) => typeof passingAudibleReview()[key as keyof ReturnType<typeof passingAudibleReview>] === "boolean");

    for (const asset of expected) {
      const acceptedFile = join(rootDir, "output/audio-quarantine", asset.fileName.replace(/\.mp3$/i, "-accepted.mp3"));
      mkdirSync(join(acceptedFile, ".."), { recursive: true });
      writeFileSync(acceptedFile, Buffer.alloc(300_000, 1));

      const reviewFile = join(rootDir, "output/audio-qc/reviews", asset.fileName.replace(/\.mp3$/i, "-audible-review.json"));
      mkdirSync(join(reviewFile, ".."), { recursive: true });
      const reviewTemplate: Record<string, unknown> = {
        variantId: asset.familyId + ":" + asset.levelId,
        familyId: asset.familyId,
        levelId: asset.levelId,
        fileName: asset.fileName,
        reviewer: "",
        reviewedAt: "",
        notes: "Default template, not yet approved.",
      };
      for (const field of reviewFalseFields) reviewTemplate[field] = false;
      writeFileSync(reviewFile, JSON.stringify(reviewTemplate, null, 2) + "\n");
    }

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(report.checks.acceptedCandidates).toEqual(
      expect.objectContaining({ ok: true, presentCount: 18, missingCount: 0, failedCount: 0, blocking: false }),
    );
    expect(report.checks.audibleReviewApprovals).toEqual(
      expect.objectContaining({
        ok: false,
        expectedCount: 18,
        presentCount: 18,
        approvedCount: 0,
        failedCount: 18,
        blocking: true,
      }),
    );
    expect(report.blockers.map((blocker) => blocker.code)).toContain("audible-review-approvals-incomplete");
  });

  it("blocks readiness until the pilot candidate passes QC and audible review", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-pilot-gate-missing-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(report.checks.pilotGate).toEqual(
      expect.objectContaining({
        ok: false,
        pilotVariantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        candidateStatus: "missing",
        audibleReviewStatus: "missing",
        blocking: true,
      }),
    );
    expect(report.blockers.map((blocker) => blocker.code)).toContain("pilot-gate-not-accepted");
  });

  it("passes the pilot gate when the pilot candidate passes QC and audible review", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-pilot-gate-pass-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const acceptedFile = join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-accepted.mp3");
    mkdirSync(join(acceptedFile, ".."), { recursive: true });
    writeFileSync(acceptedFile, Buffer.alloc(300_000, 1));
    const reviewFile = join(rootDir, "output/audio-qc/reviews/hyperfocus-fireplace-soft-audible-review.json");
    mkdirSync(join(reviewFile, ".."), { recursive: true });
    writeFileSync(reviewFile, JSON.stringify(passingAudibleReview("fireplace:soft"), null, 2) + "\n");

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(report.checks.pilotGate).toEqual(
      expect.objectContaining({
        ok: true,
        pilotVariantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        candidateStatus: "pass",
        audibleReviewStatus: "approved",
        blocking: false,
      }),
    );
    expect(report.blockers.map((blocker) => blocker.code)).not.toContain("pilot-gate-not-accepted");
  });

  it("includes pilot-only generation and intake checks in readiness", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-pilot-checks-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(report.checks.generationQueue).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "full-pack-after-pilot",
        requiresAcceptedPilot: true,
        jobCount: 18,
      }),
    );
    expect(report.checks.pilotGenerationQueue).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
        jobCount: 1,
        firstVariantId: "fireplace:soft",
      }),
    );
    expect(report.checks.pilotBatchTemplate).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        assetCount: 1,
        firstVariantId: "fireplace:soft",
      }),
    );
    expect(report.checks.pilotCandidateUrlIntakeTemplate).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        assetCount: 1,
        firstVariantId: "fireplace:soft",
      }),
    );
  });

  it("builds a unified readiness report for the incomplete generated Hyperfocus pack", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    qc.writePromotionBatchTemplate({
      rootDir,
      outputFile: join(rootDir, "output/audio-qc/hyperfocus-gemini-batch-template.json"),
      model: "lyria-3-clip",
    });

    const report = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });

    expect(report.ready).toBe(false);
    expect(report.expectedCount).toBe(18);
    expect(report.checks.spec).toEqual(expect.objectContaining({ ok: true, familyCount: 6, variantCount: 18 }));
    expect(report.checks.promptPolicy).toEqual(expect.objectContaining({ ok: true, levelCount: 18, promptCount: 18, issueCount: 0 }));
    expect(report.checks.generationQueue).toEqual(expect.objectContaining({ ok: true, jobCount: 18, model: "lyria-3-clip" }));
    expect(report.checks.batchTemplate).toEqual(expect.objectContaining({ ok: true, assetCount: 18 }));
    expect(report.checks.candidateUrlIntakeTemplate).toEqual(expect.objectContaining({ ok: true, assetCount: 18 }));
    expect(report.checks.audibleReviewTemplates).toEqual(expect.objectContaining({ ok: false, missingCount: 18 }));
    expect(report.checks.acceptedCandidates).toEqual(expect.objectContaining({ ok: false, missingCount: 18, blocking: true }));
    expect(report.checks.publicAssets).toEqual(expect.objectContaining({ ok: false, missingCount: 18 }));
    expect(report.checks.packageTargets).toEqual(expect.objectContaining({ ok: false, targetCount: 8, issueCount: 144 }));
    expect(report.checks.generatedManifest).toEqual(expect.objectContaining({ ok: false, entryCount: 0 }));
    expect(report.blockers.map((blocker) => blocker.code)).toEqual(
      expect.arrayContaining(["audible-review-templates-missing", "accepted-candidates-missing", "public-assets-missing", "package-targets-missing", "generated-manifest-incomplete"]),
    );
  });

  it("writes the pilot gate report from the CLI without falling through to generated-pack QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-pilot-gate-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-pilot-gate-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-pilot-gate-report",
          outputFile,
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-pilot-gate] FAIL");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(
      expect.objectContaining({
        ok: false,
        pilotVariantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        candidateStatus: "missing",
        audibleReviewStatus: "missing",
      }),
    );
  });
  it("builds a completion audit for the full Hyperfocus audio objective", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-completion-audit-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    qc.writeGenerationCreditsReport({
      rootDir,
      model: "lyria-3-clip",
      creditBalance: 1,
      pilotCreditCost: 2,
      nextResetDate: "2026-06-26T16:19:03.909Z",
    });

    const report = qc.buildHyperfocusCompletionAuditReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      skipAudioProbe: true,
    });
    const requirementsById = Object.fromEntries(report.requirements.map((requirement) => [requirement.id, requirement]));

    expect(report.complete).toBe(false);
    expect(report.requirementCount).toBe(12);
    expect(report.passedCount).toBeGreaterThanOrEqual(6);
    expect(report.blockedCount).toBeGreaterThanOrEqual(2);
    expect(requirementsById["three-level-spec"]).toEqual(expect.objectContaining({ ok: true, status: "pass" }));
    expect(requirementsById["original-v1-source-coverage"]).toEqual(expect.objectContaining({ ok: true, status: "pass" }));
    expect(requirementsById["gemini-only-policy"]).toEqual(expect.objectContaining({ ok: true, status: "pass" }));
    expect(requirementsById["generation-credits"]).toEqual(
      expect.objectContaining({
        ok: false,
        status: "blocked",
        blockers: ["generation-credits-insufficient"],
      }),
    );
    expect(requirementsById["accepted-pilot-gate"]).toEqual(
      expect.objectContaining({
        ok: false,
        status: "blocked",
        blockers: ["pilot-gate-not-accepted"],
      }),
    );
    expect(requirementsById["generated-public-assets"]).toEqual(expect.objectContaining({ ok: false, status: "pending" }));
    expect(requirementsById["desktop-generated-packaging"]).toEqual(expect.objectContaining({ ok: false, status: "pending" }));
    expect(requirementsById["native-generated-packaging"]).toEqual(expect.objectContaining({ ok: false, status: "pending" }));
  });

  it("writes a completion audit report from the CLI without falling through", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-completion-audit-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-completion-audit-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-completion-audit-report",
          outputFile,
          "--model",
          "lyria-3-clip",
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-completion-audit] FAIL");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(expect.objectContaining({ complete: false, requirementCount: 12 }));
  });
  it("writes the readiness report from the CLI without falling through to generated-pack QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-readiness-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-qc"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-readiness-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-readiness-report",
          outputFile,
          "--model",
          "lyria-3-clip",
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-readiness] FAIL");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report.ready).toBe(false);
    expect(report.checks.promptPolicy).toEqual(expect.objectContaining({ ok: true, promptCount: 18 }));
    expect(report.checks.candidateUrlIntakeTemplate).toEqual(expect.objectContaining({ ok: true, assetCount: 18 }));
    expect(report.checks.audibleReviewTemplates.missingCount).toBe(18);
    expect(report.checks.acceptedCandidates.missingCount).toBe(18);
    expect(report.checks.publicAssets.missingCount).toBe(18);
  });

  it("refuses manifest entries for QC-passing assets without Gemini provenance", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-provenance-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), Buffer.alloc(300_000, 1));

    const result = qc.collectGeneratedAudioManifestEntries({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "missing-provenance",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
  });

  it("refuses manifest entries when provenance publicSha256 does not match the public file", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-provenance-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), Buffer.alloc(300_000, 1));
    writeFileSync(
      join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"),
      JSON.stringify({
        version: "2026-06-19",
        assets: {
          "fireplace:soft": {
            fileName: "hyperfocus-fireplace-soft.mp3",
            provider: "Google",
            model: "lyria-3-clip",
            generationId: "picsart-generation-123",
            generatedAt: "2026-06-19T00:00:00.000Z",
            source: "picsart",
            approvedBy: "operator-qc",
            audibleReview: passingAudibleReview(),
            candidateSha256: "1".repeat(64),
            publicSha256: "0".repeat(64),
          },
        },
      }),
    );

    const result = qc.collectGeneratedAudioManifestEntries({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(false);
    expect(result.entries).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "provenance-public-sha-mismatch",
        fileName: "hyperfocus-fireplace-soft.mp3",
      }),
    ]);
  });

  it("keeps Gemini-family provenance on accepted manifest entries", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-provenance-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const audioBuffer = Buffer.alloc(300_000, 1);
    const publicSha256 = sha256Buffer(audioBuffer);
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), audioBuffer);
    writeFileSync(
      join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"),
      JSON.stringify({
        version: "2026-06-19",
        assets: {
          "fireplace:soft": {
            fileName: "hyperfocus-fireplace-soft.mp3",
            provider: "Google",
            model: "lyria-3-clip",
            generationId: "picsart-generation-123",
            generatedAt: "2026-06-19T00:00:00.000Z",
            source: "picsart",
            approvedBy: "operator-qc",
            audibleReview: passingAudibleReview(),
            candidateSha256: "1".repeat(64),
            publicSha256,
          },
        },
      }),
    );

    const result = qc.collectGeneratedAudioManifestEntries({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(result.ok).toBe(true);
    expect(result.entries).toEqual([
      expect.objectContaining({
        variantId: "fireplace:soft",
        provider: "Google",
        model: "lyria-3-clip",
        generationId: "picsart-generation-123",
      }),
    ]);
  });

  it("accepts licensed real-source provenance for strict-QC bundled nature assets", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-real-source-provenance-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const audioBuffer = Buffer.alloc(300_000, 2);
    const publicSha256 = sha256Buffer(audioBuffer);
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-forest-soft.mp3"), audioBuffer);
    writeFileSync(
      join(rootDir, "docs/audio/hyperfocus-generated-audio-provenance.json"),
      JSON.stringify({
        version: "2026-06-29",
        assets: {
          "forest:soft": {
            fileName: "hyperfocus-forest-soft.mp3",
            provider: "Mixkit",
            model: "real-source-nature-pack",
            generationId: "mixkit-forest-soft-1237-2026-06-29",
            generatedAt: "2026-06-29T00:00:00.000Z",
            source: "Wind in the forest (https://mixkit.co/free-sound-effects/forest/, item 1237)",
            sourceLicense: "https://mixkit.co/license/",
            publicSha256,
            postProcessing: {
              objectiveResult: "PASS",
              policy: "strict-qc-30s-loop-crossfade-normalization",
            },
          },
        },
      }),
    );

    const result = qc.collectGeneratedAudioManifestEntries({
      rootDir,
      generatedAt: "2026-06-29T00:00:00.000Z",
      probeAudioFile: () => passingAudioMetrics(),
    });

    expect(result.ok).toBe(true);
    expect(result.entries).toEqual([
      expect.objectContaining({
        variantId: "forest:soft",
        provider: "Mixkit",
        model: "real-source-nature-pack",
        generationId: "mixkit-forest-soft-1237-2026-06-29",
      }),
    ]);
  });

  it("builds a durable JSON QC report with missing and passing asset evidence", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-report-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), "accepted-audio-bytes");

    const report = qc.buildHyperfocusAudioQcReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: () => ({
        durationSeconds: 30,
        sampleRate: 48000,
        channels: 2,
        rmsDbfs: -22,
        peakDbfs: -2.5,
        clippedSamples: 0,
        startRmsDbfs: -22.2,
        endRmsDbfs: -22.7,
        seamMeanAbsDiff: 0.015,
        fileBytes: 720_000,
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.expectedCount).toBe(18);
    expect(report.passedCount).toBe(1);
    expect(report.missingCount).toBe(17);
    expect(report.failedCount).toBe(0);
    const fireplaceReportAsset = report.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(fireplaceReportAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        publicPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        status: "pass",
        bytes: "accepted-audio-bytes".length,
      }),
    );
    expect(fireplaceReportAsset?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(fireplaceReportAsset?.metrics).toEqual(expect.objectContaining({ durationSeconds: 30, sampleRate: 48000 }));
    expect(report.assets.filter((asset) => asset.status === "missing")).toHaveLength(17);
  });

  it("writes a QC report from the CLI even when the generated pack is incomplete", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-report-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const reportFile = join(rootDir, "output/audio-qc/hyperfocus-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-qc-report",
          reportFile,
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = (failure.stdout || "") + "\n" + (failure.stderr || "");
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-audio-report] FAIL");
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    expect(report.expectedCount).toBe(18);
    expect(report.missingCount).toBe(18);
    expect(report.assets).toHaveLength(18);
    expect(report.assets[0]).toEqual(
      expect.objectContaining({
        variantId: "forest:soft",
        status: "missing",
      }),
    );
  });

  it("builds an accepted candidate report with objective QC failures before promotion", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-candidate-report-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const expected = qc.getExpectedHyperfocusAssets({ rootDir });
    for (const asset of expected.slice(0, 17)) {
      const acceptedFile = join(rootDir, "output/audio-quarantine", asset.fileName.replace(/\.mp3$/i, "-accepted.mp3"));
      mkdirSync(join(acceptedFile, ".."), { recursive: true });
      writeFileSync(acceptedFile, Buffer.alloc(300_000, 1));
    }

    const report = qc.buildAcceptedCandidateReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: (file) => {
        if (file.endsWith("hyperfocus-fireplace-soft-accepted.mp3")) {
          return {
            ...passingAudioMetrics(),
            peakDbfs: 0,
            clippedSamples: 12,
            seamMeanAbsDiff: 0.12,
          };
        }
        return passingAudioMetrics();
      },
    });

    expect(report.ok).toBe(false);
    expect(report.expectedCount).toBe(18);
    expect(report.presentCount).toBe(17);
    expect(report.missingCount).toBe(1);
    expect(report.passedCount).toBe(16);
    expect(report.failedCount).toBe(1);
    expect(report.issueCount).toBe(4);
    expect(report.assets.find((asset) => asset.fileName === "hyperfocus-fireplace-soft.mp3")).toEqual(
      expect.objectContaining({ status: "fail" }),
    );
    expect(report.assets.find((asset) => asset.fileName === expected[17].fileName)).toEqual(
      expect.objectContaining({ status: "missing" }),
    );
  });

  it("audits raw quarantine pilot candidates without accepting them", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-raw-candidates-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-quarantine"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3"), Buffer.alloc(300_000, 3));
    writeFileSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-revised-raw.mp3"), Buffer.alloc(300_000, 4));

    const report = qc.buildRawCandidateAuditReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      probeAudioFile: (file) => ({
        ...passingAudioMetrics(),
        peakDbfs: 0,
        clippedSamples: file.endsWith("revised-raw.mp3") ? 157 : 20,
        endRmsDbfs: -64,
        seamMeanAbsDiff: 0.14,
      }),
    });

    expect(report.ok).toBe(false);
    expect(report.candidateCount).toBe(2);
    expect(report.rejectedCount).toBe(2);
    expect(report.needsReviewCount).toBe(0);
    expect(report.invalidCount).toBe(0);
    expect(report.issueCount).toBeGreaterThanOrEqual(6);
    expect(report.candidates.map((candidate) => candidate.candidatePath)).toEqual([
      "output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3",
      "output/audio-quarantine/hyperfocus-fireplace-soft-revised-raw.mp3",
    ]);
    expect(report.candidates[0]).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        status: "rejected",
        sha256: expect.stringMatching(/^[a-f0-9]{64}$/),
      }),
    );

    const readiness = qc.buildHyperfocusReadinessReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
      model: "lyria-3-clip",
      probeAudioFile: (file) => ({
        ...passingAudioMetrics(),
        peakDbfs: 0,
        clippedSamples: file.endsWith("revised-raw.mp3") ? 157 : 20,
        endRmsDbfs: -64,
        seamMeanAbsDiff: 0.14,
      }),
    });
    expect(readiness.checks.rawQuarantineCandidates).toEqual(
      expect.objectContaining({
        ok: false,
        candidateCount: 2,
        rejectedCount: 2,
        needsReviewCount: 0,
        blocking: false,
      }),
    );
  });

  it("writes a raw candidate audit report from the CLI without falling through", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-raw-candidates-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "output/audio-quarantine"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "output/audio-quarantine/hyperfocus-fireplace-soft-raw.mp3"), Buffer.alloc(300_000, 5));
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-raw-candidates-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-raw-candidate-report",
          outputFile,
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-raw-candidate-report] FAIL");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(expect.objectContaining({ ok: false, candidateCount: 1, uncheckedCount: 1 }));
  });
  it("writes an accepted candidate report from the CLI without falling through to generated-pack QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-candidate-report-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/hyperfocus-candidates-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-candidate-report",
          outputFile,
          "--skip-audio-probe",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = `${failure.stdout || ""}\n${failure.stderr || ""}`;
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-candidate-report] FAIL");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(report).toEqual(expect.objectContaining({ ok: false, expectedCount: 18, missingCount: 18 }));
  });

  it("builds a generated audio packaging report across runtime targets", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-package-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "public/sounds/hyperfocus"), { recursive: true });
    mkdirSync(join(rootDir, "dist/sounds/hyperfocus"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(join(rootDir, "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), "source-audio-bytes");
    writeFileSync(join(rootDir, "dist/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"), "dist-audio-bytes");

    const report = qc.buildHyperfocusPackagedAssetReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    const targetsById = Object.fromEntries(report.targets.map((target) => [target.id, target]));

    expect(report.ok).toBe(false);
    expect(report.expectedCount).toBe(18);
    expect(report.targetCount).toBe(8);
    expect(Object.keys(targetsById)).toEqual([
      "source-public",
      "web-dist",
      "ios-capacitor",
      "ios-simulator-app",
      "android-capacitor",
      "android-debug-apk",
      "desktop-tauri-dist",
      "desktop-tauri-macos-app",
    ]);
    expect(targetsById["source-public"]).toEqual(expect.objectContaining({ platform: "source", presentCount: 1, missingCount: 17 }));
    expect(targetsById["web-dist"]).toEqual(expect.objectContaining({ platform: "web", presentCount: 1, missingCount: 17 }));
    expect(targetsById["desktop-tauri-dist"]).toEqual(expect.objectContaining({ platform: "desktop", presentCount: 1, missingCount: 17 }));
    expect(targetsById["desktop-tauri-macos-app"]).toEqual(
      expect.objectContaining({
        platform: "desktop",
        artifactPath: "src-tauri/target/release/bundle/macos/ZenFlow.app",
        binaryPath: "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop",
        presentCount: 0,
        missingCount: 18,
      }),
    );
    expect(targetsById["ios-capacitor"]).toEqual(expect.objectContaining({ platform: "ios", presentCount: 0, missingCount: 18 }));
    expect(targetsById["ios-simulator-app"]).toEqual(expect.objectContaining({ platform: "ios", artifactPath: "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app", presentCount: 0, missingCount: 18 }));
    expect(targetsById["android-capacitor"]).toEqual(expect.objectContaining({ platform: "android", presentCount: 0, missingCount: 18 }));
    expect(targetsById["android-debug-apk"]).toEqual(expect.objectContaining({ platform: "android", artifactPath: "android/app/build/outputs/apk/debug/app-debug.apk", presentCount: 0, missingCount: 18 }));
    const sourcePublicFireplaceAsset = targetsById["source-public"].assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(sourcePublicFireplaceAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        relativePath: "public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        status: "present",
        bytes: "source-audio-bytes".length,
      }),
    );
    expect(sourcePublicFireplaceAsset?.sha256).toMatch(/^[a-f0-9]{64}$/);
    expect(report.issues.some((issue) => issue.code === "missing-packaged-file" && issue.targetId === "ios-capacitor")).toBe(true);
  });

  it("reads generated Hyperfocus assets from the macOS Tauri App.app embedded asset index", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-tauri-app-package-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(
      join(rootDir, "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop"),
      Buffer.from("binary-prefix\0/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3\0binary-suffix"),
    );

    const report = qc.buildHyperfocusPackagedAssetReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    const targetsById = Object.fromEntries(report.targets.map((target) => [target.id, target]));
    const tauriAppTarget = targetsById["desktop-tauri-macos-app"];

    expect(report.ok).toBe(false);
    expect(tauriAppTarget).toEqual(
      expect.objectContaining({
        platform: "desktop",
        artifactPath: "src-tauri/target/release/bundle/macos/ZenFlow.app",
        binaryPath: "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop",
        presentCount: 1,
        missingCount: 17,
      }),
    );
    const tauriFireplaceAsset = tauriAppTarget.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(tauriFireplaceAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        status: "present",
        relativePath:
          "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop#embedded/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        embeddedPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        binaryPath: "src-tauri/target/release/bundle/macos/ZenFlow.app/Contents/MacOS/zenflow-desktop",
      }),
    );
    expect(tauriFireplaceAsset?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reads generated Hyperfocus assets from the iOS simulator App.app bundle", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-ios-app-package-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(
      join(rootDir, "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app/public/sounds/hyperfocus"),
      { recursive: true },
    );
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(
      join(
        rootDir,
        "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app/public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
      ),
      "ios-app-audio-bytes",
    );

    const report = qc.buildHyperfocusPackagedAssetReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    const targetsById = Object.fromEntries(report.targets.map((target) => [target.id, target]));
    const iosAppTarget = targetsById["ios-simulator-app"];

    expect(report.ok).toBe(false);
    expect(iosAppTarget).toEqual(
      expect.objectContaining({
        platform: "ios",
        artifactPath: "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app",
        presentCount: 1,
        missingCount: 17,
      }),
    );
    const iosFireplaceAsset = iosAppTarget.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(iosFireplaceAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        status: "present",
        relativePath:
          "output/xcodebuild-hyperfocus-ios/Build/Products/Debug-iphonesimulator/App.app/public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        bytes: "ios-app-audio-bytes".length,
      }),
    );
    expect(iosFireplaceAsset?.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it("reads generated Hyperfocus assets from the Android debug APK artifact", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-apk-package-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    mkdirSync(join(rootDir, "android/app/build/outputs/apk/debug"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    writeFileSync(
      join(rootDir, "android/app/build/outputs/apk/debug/app-debug.apk"),
      makeStoredZip([
        {
          name: "assets/public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
          content: "apk-audio-bytes",
        },
      ]),
    );

    const report = qc.buildHyperfocusPackagedAssetReport({
      rootDir,
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    const targetsById = Object.fromEntries(report.targets.map((target) => [target.id, target]));
    const apkTarget = targetsById["android-debug-apk"];

    expect(report.ok).toBe(false);
    expect(apkTarget).toEqual(
      expect.objectContaining({
        platform: "android",
        artifactPath: "android/app/build/outputs/apk/debug/app-debug.apk",
        presentCount: 1,
        missingCount: 17,
      }),
    );
    const apkFireplaceAsset = apkTarget.assets.find((asset) => asset.variantId === "fireplace:soft");
    expect(apkFireplaceAsset).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        status: "present",
        relativePath: "android/app/build/outputs/apk/debug/app-debug.apk!/assets/public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        archiveEntryPath: "assets/public/sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        bytes: "apk-audio-bytes".length,
        compressedBytes: "apk-audio-bytes".length,
        crc32: "00000000",
      }),
    );
  });

  it("writes a generated audio packaging report from the CLI when targets are incomplete", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-package-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const reportFile = join(rootDir, "output/audio-qc/hyperfocus-package-current.json");

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--write-package-report",
          reportFile,
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = (failure.stdout || "") + "\n" + (failure.stderr || "");
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-audio-package] FAIL");
    const report = JSON.parse(readFileSync(reportFile, "utf8"));
    expect(report.expectedCount).toBe(18);
    expect(report.targetCount).toBe(8);
    expect(report.targets).toHaveLength(8);
    expect(report.targets[0]).toEqual(
      expect.objectContaining({
        id: "source-public",
        missingCount: 18,
      }),
    );
  });

  it("writes audible review templates for every generated variant", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-review-templates-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const reviewDir = join(rootDir, "output/audio-qc/reviews");

    const output = execFileSync(
      process.execPath,
      [
        "scripts/check-hyperfocus-audio-assets.cjs",
        "--root",
        rootDir,
        "--write-audible-review-templates",
        reviewDir,
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    expect(output).toContain("[hyperfocus-audible-review-templates] PASS");
    const files = readdirSync(reviewDir).filter((fileName) => fileName.endsWith("-audible-review.json")).sort();
    expect(files).toHaveLength(18);
    expect(files).toContain("hyperfocus-fireplace-soft-audible-review.json");

    const template = JSON.parse(readFileSync(join(reviewDir, "hyperfocus-fireplace-soft-audible-review.json"), "utf8"));
    expect(template).toEqual(
      expect.objectContaining({
        variantId: "fireplace:soft",
        familyId: "fireplace",
        levelId: "soft",
        fileName: "hyperfocus-fireplace-soft.mp3",
        reviewer: "",
        reviewedAt: "",
        noVocals: false,
        noSpeech: false,
        noMelody: false,
        noBeat: false,
        noForegroundDistractions: false,
        noSafetyAlarmCues: false,
        loopAudiblyClean: false,
        matchesPromptFamily: false,
        matchesIntensityLevel: false,
      }),
    );
    expect(template.rejectIf).toContain("vocals");
    expect(template.promptSha256).toMatch(/^[a-f0-9]{64}$/);
    expect(template.promptSha256).toBe(promptSha256ForVariant("fireplace:soft"));
    expect(template.notes).toContain("Set every boolean");
  });

  it("builds a deterministic Gemini generation queue from the spec", () => {
    const result = qc.buildGeminiGenerationQueue({ rootDir: process.cwd(), model: "lyria-3-clip" });

    expect(result.ok).toBe(true);
    expect(result.issues).toEqual([]);
    expect(result.jobs).toHaveLength(18);
    expect(result.jobs[0]).toEqual(
      expect.objectContaining({
        variantId: "forest:soft",
        familyId: "forest",
        levelId: "soft",
        fileName: "hyperfocus-forest-soft.mp3",
        publicPath: "sounds/hyperfocus/hyperfocus-forest-soft.mp3",
        quarantinePath: "output/audio-quarantine/hyperfocus-forest-soft-raw.mp3",
        provider: "Google",
        model: "lyria-3-clip",
      }),
    );
    expect(result.jobs[0].prompt).toContain("30-second seamless non-musical ambience loop");
    expect(result.jobs[0].rejectIf).toContain("clear words");
    expect(result.jobs[0].promotionCommand).toContain("--file-name hyperfocus-forest-soft.mp3");
    expect(result.jobs[0].promotionCommand).toContain("--model lyria-3-clip");
    expect(result.jobs[0].promotionCommand).toContain("--generation-id <generation-id>");
    expect(result.jobs[0].promotionCommand).toContain("--audible-review output/audio-qc/reviews/hyperfocus-forest-soft-audible-review.json");
    expect(new Set(result.jobs.map((job) => job.variantId)).size).toBe(18);
  });

  it("writes deterministic generation queue files for pilot and full phases", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-generation-queue-writer-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const pilotFile = join(rootDir, "output/audio-qc/hyperfocus-lyria-3-clip-pilot-generation-queue.json");
    const fullFile = join(rootDir, "output/audio-qc/hyperfocus-lyria-3-clip-generation-queue.json");

    const pilot = qc.writeGeminiGenerationQueue({
      rootDir,
      outputFile: pilotFile,
      model: "lyria-3-clip",
      phase: "pilot",
      generatedAt: "2026-06-19T00:00:00.000Z",
    });
    const full = qc.writeGeminiGenerationQueue({
      rootDir,
      outputFile: fullFile,
      model: "lyria-3-clip",
      phase: "full",
      generatedAt: "2026-06-19T00:00:00.000Z",
    });

    expect(pilot.report).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
        jobCount: 1,
      }),
    );
    expect(full.report).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "full-pack-after-pilot",
        requiresAcceptedPilot: true,
        pilotVariantId: "fireplace:soft",
        jobCount: 18,
      }),
    );
    expect(JSON.parse(readFileSync(pilot.outputFile, "utf8"))).toEqual(expect.objectContaining({ jobCount: 1 }));
    expect(JSON.parse(readFileSync(full.outputFile, "utf8"))).toEqual(expect.objectContaining({ jobCount: 18 }));
  });

  it("writes generation queue files from the CLI without falling through to asset QC", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-generation-queue-cli-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    copyFileSync(
      join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"),
      join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"),
    );
    const outputFile = join(rootDir, "output/audio-qc/pilot-queue.json");

    const output = execFileSync(
      process.execPath,
      [
        join(process.cwd(), "scripts/check-hyperfocus-audio-assets.cjs"),
        "--root",
        rootDir,
        "--write-generation-queue",
        outputFile,
        "--model",
        "lyria-3-clip",
        "--phase",
        "pilot",
        "--generated-at",
        "2026-06-19T00:00:00.000Z",
      ],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    const report = JSON.parse(readFileSync(outputFile, "utf8"));
    expect(output).toContain("[hyperfocus-generation-queue] PASS - wrote 1 pilot job");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
    expect(report).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        jobCount: 1,
      }),
    );
  });

  it("builds a pilot-only generation queue and marks the full queue as gated", () => {
    const pilotQueue = qc.buildGeminiGenerationQueue({ rootDir: process.cwd(), model: "lyria-3-clip", phase: "pilot" });
    const fullQueue = qc.buildGeminiGenerationQueue({ rootDir: process.cwd(), model: "lyria-3-clip", phase: "full" });

    expect(pilotQueue).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "pilot",
        requiresAcceptedPilot: false,
        pilotVariantId: "fireplace:soft",
      }),
    );
    expect(pilotQueue.jobs).toHaveLength(1);
    expect(pilotQueue.jobs[0]).toEqual(expect.objectContaining({ variantId: "fireplace:soft", fileName: "hyperfocus-fireplace-soft.mp3" }));

    expect(fullQueue).toEqual(
      expect.objectContaining({
        ok: true,
        phase: "full-pack-after-pilot",
        requiresAcceptedPilot: true,
        pilotVariantId: "fireplace:soft",
      }),
    );
    expect(fullQueue.jobs).toHaveLength(18);
  });

  it("prints the pilot generation queue from the CLI without exposing the full pack", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/check-hyperfocus-audio-assets.cjs", "--print-generation-queue", "--model", "lyria-3-clip", "--phase", "pilot"],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    const queue = JSON.parse(output) as { phase: string; requiresAcceptedPilot: boolean; pilotVariantId: string; jobs: Array<{ variantId: string; fileName: string }> };
    expect(queue).toEqual(expect.objectContaining({ phase: "pilot", requiresAcceptedPilot: false, pilotVariantId: "fireplace:soft" }));
    expect(queue.jobs).toEqual([expect.objectContaining({ variantId: "fireplace:soft", fileName: "hyperfocus-fireplace-soft.mp3" })]);
  });

  it("refuses generation queue export when Gemini prompt policy is invalid", () => {
    const rootDir = mkdtempSync(join(tmpdir(), "hyperfocus-audio-queue-prompt-policy-"));
    mkdirSync(join(rootDir, "docs/audio"), { recursive: true });
    const spec = JSON.parse(readFileSync(join(process.cwd(), "docs/audio/hyperfocus-three-level-generation-spec.json"), "utf8"));
    const fireplaceFamily = spec.families.find((family: { id: string }) => family.id === "fireplace");
    fireplaceFamily.levels[0].prompt = "short musical jingle with vocals";
    writeFileSync(join(rootDir, "docs/audio/hyperfocus-three-level-generation-spec.json"), JSON.stringify(spec, null, 2) + "\n");

    const result = qc.buildGeminiGenerationQueue({ rootDir, model: "lyria-3-clip", phase: "pilot" });

    expect(result.ok).toBe(false);
    expect(result.jobs).toEqual([]);
    expect(result.issues).toEqual([expect.objectContaining({ code: "prompt-policy-invalid" })]);

    let output = "";
    try {
      execFileSync(
        process.execPath,
        [
          "scripts/check-hyperfocus-audio-assets.cjs",
          "--root",
          rootDir,
          "--print-generation-queue",
          "--model",
          "lyria-3-clip",
          "--phase",
          "pilot",
        ],
        { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
      );
    } catch (error) {
      const failure = error as { status?: number; stdout?: string; stderr?: string };
      output = (failure.stdout || "") + "\n" + (failure.stderr || "");
      expect(failure.status).toBe(1);
    }

    expect(output).toContain("[hyperfocus-generation-queue] FAIL");
    expect(output).toContain("prompt-policy-invalid");
    expect(output).not.toContain("short musical jingle with vocals");
    expect(output).not.toContain("[hyperfocus-audio-qc] FAIL");
  });

  it("refuses to build a generation queue for non-Gemini-family models", () => {
    const result = qc.buildGeminiGenerationQueue({ rootDir: process.cwd(), model: "elevenlabs-sfx" });

    expect(result.ok).toBe(false);
    expect(result.jobs).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "non-gemini-family-model",
      }),
    ]);
  });

  it("refuses Gemini TTS models for ambience generation queues", () => {
    const result = qc.buildGeminiGenerationQueue({ rootDir: process.cwd(), model: "gemini-2.5-flash-tts" });

    expect(result.ok).toBe(false);
    expect(result.jobs).toEqual([]);
    expect(result.issues).toEqual([
      expect.objectContaining({
        code: "tts-model-not-ambience",
      }),
    ]);
  });

  it("prints the Gemini generation queue from the CLI without running audio QC", () => {
    const output = execFileSync(
      process.execPath,
      ["scripts/check-hyperfocus-audio-assets.cjs", "--print-generation-queue", "--model", "lyria-3-clip"],
      { cwd: process.cwd(), encoding: "utf8", stdio: ["ignore", "pipe", "pipe"] },
    );

    const queue = JSON.parse(output) as { jobs: Array<{ variantId: string; fileName: string; model: string; promotionCommand: string }> };
    expect(queue.jobs).toHaveLength(18);
    expect(queue.jobs[0]).toEqual(
      expect.objectContaining({
        variantId: "forest:soft",
        fileName: "hyperfocus-forest-soft.mp3",
        model: "lyria-3-clip",
      }),
    );
    expect(queue.jobs[0].promotionCommand).toContain("--write-manifest");
  });

  it("renders generated asset manifest entries as deterministic TypeScript", () => {
    const sourceText = qc.renderGeneratedAudioManifest([
      {
        variantId: "fireplace:soft",
        publicPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3",
        sha256: "abc123",
        bytes: 720000,
        generatedAt: "2026-06-19T00:00:00.000Z",
      },
    ]);

    expect(sourceText).toContain("export const HYPERFOCUS_GENERATED_AUDIO_MANIFEST");
    expect(sourceText).toContain('"fireplace:soft"');
    expect(sourceText).toContain('publicPath: "sounds/hyperfocus/hyperfocus-fireplace-soft.mp3"');
    expect(sourceText).toContain('sha256: "abc123"');
  });

  it("accepts stable loop metrics inside the Hyperfocus QC envelope", () => {
    const issues = qc.evaluateHyperfocusAudioMetrics({
      durationSeconds: 30,
      sampleRate: 48000,
      channels: 2,
      rmsDbfs: -22,
      peakDbfs: -2.5,
      clippedSamples: 0,
      startRmsDbfs: -22.2,
      endRmsDbfs: -22.7,
      seamMeanAbsDiff: 0.015,
      fileBytes: 720_000,
    });

    expect(issues).toEqual([]);
  });
});
