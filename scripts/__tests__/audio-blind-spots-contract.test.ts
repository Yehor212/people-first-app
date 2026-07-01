import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

function read(path: string): string {
  return readFileSync(path, "utf8");
}

describe("audio blind-spot release contracts", () => {
  it("allows first-party journal voice recording while keeping other sensitive APIs denied", () => {
    const index = read("index.html");

    expect(index).toContain("Permissions-Policy");
    expect(index).toContain("microphone=(self)");
    expect(index).toContain("camera=()");
    expect(read("src/features/journal/useAudioRecorder.ts")).toContain("navigator.mediaDevices.getUserMedia");
  });

  it("caches shipped app audio for installed PWA offline reuse with bounded quota", () => {
    const serviceWorker = read("src/sw.ts");

    expect(serviceWorker).toContain("zenflow-runtime-audio");
    expect(serviceWorker).toContain('request.destination === "audio"');
    expect(serviceWorker).toContain('url.pathname.includes("/sounds/")');
    expect(serviceWorker).toContain("maxEntries: 32");
    expect(serviceWorker).toContain("purgeOnQuotaError: true");
  });

  it("wires the audio guard into local CI, deploy CI, and drift checks", () => {
    const packageJson = JSON.parse(read("package.json")) as { scripts: Record<string, string> };
    const deployWorkflow = read(".github/workflows/deploy.yml");
    const driftWorkflow = read(".github/workflows/drift-checks.yml");

    expect(packageJson.scripts["ci:preflight"]).toContain("npm run check:app-audio");
    expect(deployWorkflow).toContain("npm run check:app-audio");
    expect(driftWorkflow).toContain("'public/sounds/**'");
    expect(driftWorkflow).toContain("'docs/audio/**'");
    expect(driftWorkflow).toContain("name: app-audio");
    expect(driftWorkflow).toContain("cmd: npm run check:app-audio");
  });

  it("keeps third-party notices aligned with first-party ambience and Hyperfocus MixKit provenance", () => {
    const notices = read("THIRD_PARTY_NOTICES.md");

    expect(notices).toContain("First-party generated audio");
    expect(notices).toContain("scripts/generate-non-hyperfocus-audio.cjs");
    expect(notices).toContain("lamejs");
    expect(notices).toContain("MixKit — Hyperfocus Nature Sound Effects");
    expect(notices).toContain("src/lib/hyperfocusGeneratedAudioManifest.ts");
    expect(notices).toContain("docs/audio/hyperfocus-generated-audio-provenance.json");
    expect(notices).toContain("https://mixkit.co/license/");
    expect(notices).not.toContain("mixkit-small-waves-harbor-rocks-1208.wav");
  });

  it("keeps public privacy copy aligned with microphone, sync, ads, crash, and audio feedback surfaces", () => {
    const privacy = read("public/privacy.html");

    expect(privacy).toContain("Microphone and journal audio recordings");
    expect(privacy).toContain("Supabase");
    expect(privacy).toContain("AdMob");
    expect(privacy).toContain("Sentry");
    expect(privacy).toContain("Audio comfort feedback");
    expect(privacy).not.toContain("Any data to external servers");
    expect(privacy).not.toContain("Usage analytics or tracking data</li>");
  });
});
