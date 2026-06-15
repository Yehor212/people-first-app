import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

const infoPlist = readFileSync(resolve(process.cwd(), "ios/App/App/Info.plist"), "utf8");

describe("iOS diary privacy usage descriptions", () => {
  it("declares native permission prompts for diary audio and photo capture", () => {
    expect(infoPlist).toContain("<key>NSMicrophoneUsageDescription</key>");
    expect(infoPlist).toContain("record audio inside a private diary entry");

    expect(infoPlist).toContain("<key>NSFaceIDUsageDescription</key>");
    expect(infoPlist).toContain("biometric unlock for your private diary");

    expect(infoPlist).toContain("<key>NSCameraUsageDescription</key>");
    expect(infoPlist).toContain("Take Photo");

    expect(infoPlist).toContain("<key>NSPhotoLibraryUsageDescription</key>");
    expect(infoPlist).toContain("attach to private diary entries");
  });
});
