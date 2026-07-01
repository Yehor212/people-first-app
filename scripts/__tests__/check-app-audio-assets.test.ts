import { existsSync, readFileSync, rmSync } from "node:fs";
import { execFileSync } from "node:child_process";
import { describe, expect, it } from "vitest";

const scriptPath = "scripts/check-app-audio-assets.cjs";

describe("non-Hyperfocus app audio guard", () => {
  it("ships a dedicated QC contract for V2 app audio outside Hyperfocus", () => {
    expect(existsSync(scriptPath)).toBe(true);
  });

  it("passes the current non-Hyperfocus audio package", () => {
    const output = execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });
    expect(output).toContain("[app-audio-qc] PASS");
  }, 60000);

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
    expect(script).toContain("appAudioAssetsReportPath");
    expect(script).toContain("outputArtifactsScannedCount");
    expect(script).toContain("THIRD_PARTY_NOTICES.md");
    expect(script).toContain("hyperfocusGeneratedAudioManifest.ts");
    expect(script).toContain("MixKit");
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

  it("writes reports only to the fixed audio QC output path", () => {
    const reportPath = "output/audio-qc/app-audio-assets-report.json";
    rmSync(reportPath, { force: true });

    execFileSync(process.execPath, [scriptPath, "--write-report"], { encoding: "utf8" });
    const followUpOutput = execFileSync(process.execPath, [scriptPath], { encoding: "utf8" });

    expect(existsSync(reportPath)).toBe(true);
    expect(followUpOutput).toContain("[app-audio-qc] PASS");
    rmSync(reportPath, { force: true });
  }, 60000);

  it("rejects custom report paths", () => {
    expect(() => execFileSync(process.execPath, [scriptPath, "--write-report", "../report.json"], { encoding: "utf8" })).toThrow();
  }, 60000);
});
