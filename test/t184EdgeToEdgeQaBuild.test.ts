// @vitest-environment node

import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

const QA_OUT_DIR = "output/t184-android-qa";
const QA_SENTINEL = "ZENFLOW_T184_QA_ONLY_9F7A2C4E";

function filesUnder(root: string): string[] {
  if (!existsSync(root)) return [];
  return readdirSync(root, { withFileTypes: true }).flatMap((entry) => {
    const path = join(root, entry.name);
    return entry.isDirectory() ? filesUnder(path) : [path];
  });
}

describe("T184 Android edge-to-edge QA build", () => {
  it("selects a test-only HTML entry only for the explicit QA build flag", () => {
    const previous = process.env.VITE_T184_QA_BUILD;
    process.env.VITE_T184_QA_BUILD = "true";

    try {
      const config = viteConfig({
        command: "build",
        mode: "production",
        isSsrBuild: false,
        isPreview: false,
      });
      const options = config.build?.rollupOptions;

      expect(options?.input).toEqual({ index: "src/test/t184/index.html" });
      expect(config.base).toBe("/");
      expect(config.build?.outDir).toBe(QA_OUT_DIR);
    } finally {
      if (previous === undefined) delete process.env.VITE_T184_QA_BUILD;
      else process.env.VITE_T184_QA_BUILD = previous;
    }
  });

  it("keeps the production dist and synced Android assets free of the QA prelude", () => {
    const previous = process.env.VITE_T184_QA_BUILD;
    delete process.env.VITE_T184_QA_BUILD;

    try {
      const config = viteConfig({
        command: "build",
        mode: "production",
        isSsrBuild: false,
        isPreview: false,
      });
      expect(config.build?.outDir).toBe("dist");
      expect(config.build?.rollupOptions?.input).toBeUndefined();
    } finally {
      if (previous === undefined) delete process.env.VITE_T184_QA_BUILD;
      else process.env.VITE_T184_QA_BUILD = previous;
    }

    const productionArtifacts = ["dist", "android/app/src/main/assets/public"].flatMap(filesUnder);
    const contaminated = productionArtifacts.filter((path) =>
      readFileSync(path).includes(Buffer.from(QA_SENTINEL))
    );
    expect(contaminated).toEqual([]);

    const packageJson = JSON.parse(readFileSync("package.json", "utf8")) as {
      scripts: Record<string, string>;
    };
    expect(packageJson.scripts["preview:android:t184-qa"]).toContain(
      "VITE_T184_QA_BUILD=true"
    );
    expect(packageJson.scripts["preview:android:t184-qa"]).toContain(QA_OUT_DIR);
  });
});
