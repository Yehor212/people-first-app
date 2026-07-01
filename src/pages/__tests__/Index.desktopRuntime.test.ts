import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const readIndex = () => readFileSync("src/pages/Index.tsx", "utf8");

describe("Index desktop runtime shell contract", () => {
  it("boots the V2 shell for the normal app root and desktop runtime", () => {
    const source = readIndex();

    expect(source).toContain("return <IndexV2Impl />;");
    expect(source).toContain("NavV2Orchestrator");
    expect(source).toContain("DesktopDownloadPage");
    expect(source).not.toContain("IndexV1Impl");
    expect(source).not.toContain("shouldUseNavV2Shell");
    expect(source).not.toContain("NavV2ShellDecision");
  });

  it("keeps public lazy routes on visible branded fallbacks instead of blank boundaries", () => {
    const source = readIndex();

    expect(source).toContain("DesktopDownloadRouteFallback");
    expect(source).toContain("DevPreviewRouteFallback");
    expect(source).not.toContain("<Suspense fallback={null}>");
  });
});
