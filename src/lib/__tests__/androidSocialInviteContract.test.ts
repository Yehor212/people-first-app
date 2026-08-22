import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");

describe("Android social invite App Link contract", () => {
  it("verifies the exact canonical GitHub Pages invite path", () => {
    expect(manifest).toContain('<intent-filter android:autoVerify="true">');
    expect(manifest).toContain('android:scheme="https"');
    expect(manifest).toContain('android:host="yehor212.github.io"');
    expect(manifest).toContain('android:path="/people-first-app/"');
  });

  it("does not claim the unhosted zenflow.app challenge path", () => {
    expect(manifest).not.toContain('android:host="zenflow.app"');
    expect(manifest).not.toContain('android:pathPrefix="/challenge"');
  });

  it("keeps the legacy custom scheme as receive-only compatibility", () => {
    expect(manifest).toContain('android:scheme="zenflow"');
    expect(manifest).toContain('android:host="challenge"');
  });
});
