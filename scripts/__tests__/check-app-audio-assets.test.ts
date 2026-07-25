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
  inspectOutputArtifacts,
  parseCliOptions,
  writeReportIfRequested,
} = require("../check-app-audio-assets.cjs") as {
  inspectOutputArtifacts: (options: {
    outputDir: string;
    reportPath: string;
    forbiddenRootMp3s?: string[];
    staleRuntimeStrings?: string[];
  }) => { matches: Array<{ file: string; stale: string }>; scannedFiles: string[]; textFiles: string[] };
  parseCliOptions: (argv: string[]) => { writeReport: boolean };
  writeReportIfRequested: (
    report: Record<string, unknown>,
    options: { writeReport: boolean },
    reportPath: string,
  ) => void;
};

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
      "MDN autoplay",
      "Apple Human Interface Guidelines",
      "Android audio focus",
      "Non-Hyperfocus",
      "Forbidden Routine Sounds",
      "Generated Non-Hyperfocus Asset Provenance",
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
    expect(script).toContain("Desktop/Tauri generated target files scanned");
    expect(script).toContain("docs/assets bundles scanned");
    expect(packageJson.scripts["check:app-audio"]).toBe("node scripts/check-app-audio-assets.cjs");
  });

  it("prunes only verified duplicate generated sound artifacts before inventory assertions", () => {
    const script = readFileSync(scriptPath, "utf8");

    expect(script).toContain("pruneGeneratedRootSoundDuplicates");
    expect(script).toContain("canonicalGeneratedDuplicateMp3Name");
    expect(script).toContain("generatedRootDuplicatePrunes");
    expect(script).toContain("sha256File(duplicatePath)");
    expect(script).toContain("sha256File(canonicalPath)");
    expect(script).toContain("generated root MP3 duplicate differs from canonical file");
    expect(script).toContain("generated duplicate sound directory is not empty");
    expect(script).toContain("location.generated");
    expect(script).toContain("required: true, generated: false");
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
