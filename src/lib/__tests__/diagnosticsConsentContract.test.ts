import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const mainSource = readFileSync("src/main.tsx", "utf8");
const androidManifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const privacyPolicy = readFileSync("public/privacy.html", "utf8");

describe("optional crash diagnostics consent contract", () => {
  it("does not start Sentry before Settings offers an explicit diagnostics choice", () => {
    expect(privacyPolicy).toContain(
      "crash diagnostics, ads after consent, journal audio recording, and journal dictation require clear user action or consent"
    );
    expect(mainSource).not.toContain('import("./lib/sentry")');
    expect(mainSource).not.toContain("setCaptureSink");
  });

  it("keeps native Crashlytics collection off by default", () => {
    expect(androidManifest).toMatch(
      /android:name="firebase_crashlytics_collection_enabled"\s+android:value="false"/
    );
  });
});
