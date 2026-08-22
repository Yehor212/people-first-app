// @vitest-environment node

import { describe, expect, it } from "vitest";
import viteConfig from "../vite.config";

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
    } finally {
      if (previous === undefined) delete process.env.VITE_T184_QA_BUILD;
      else process.env.VITE_T184_QA_BUILD = previous;
    }
  });
});
