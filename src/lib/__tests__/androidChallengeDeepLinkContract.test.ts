import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { describe, expect, it } from "vitest";

describe("Android challenge App Link contract", () => {
  it("admits only the exact challenge route and its slash-delimited children", () => {
    const manifest = readFileSync(
      resolve(process.cwd(), "android/app/src/main/AndroidManifest.xml"),
      "utf8"
    );

    expect(manifest).toContain('android:path="/challenge"');
    expect(manifest).toContain('android:pathPrefix="/challenge/"');
    expect(manifest).not.toMatch(/android:pathPrefix="\/challenge"(?!\/)/);
  });
});
