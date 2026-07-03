// @vitest-environment node

import { describe, expect, it } from "vitest";
import { readFileSync } from "node:fs";
import {
  resolvePlaywrightLocalBaseUrl,
  resolvePlaywrightLocalPort,
  resolvePlaywrightPreviewOutDir,
} from "../../playwright.config";

describe("Playwright local server port contract", () => {
  it("normalizes safe numeric TCP ports", () => {
    expect(resolvePlaywrightLocalPort(undefined)).toBe("8080");
    expect(resolvePlaywrightLocalPort(" 4191 ")).toBe("4191");
    expect(resolvePlaywrightLocalPort("65535")).toBe("65535");
  });

  it("serves and waits on the same loopback host in CI preview mode", () => {
    expect(resolvePlaywrightLocalBaseUrl("4181")).toBe(
      "http://127.0.0.1:4181/people-first-app/",
    );
  });

  it("binds local dev proof servers to the same loopback host", () => {
    const config = readFileSync("playwright.config.ts", "utf8");

    expect(config).toContain("npm run dev -- --host 127.0.0.1");
  });

  it("rejects values that could be interpreted by the shell", () => {
    expect(() => resolvePlaywrightLocalPort("4191; echo PWNED")).toThrow(
      "ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be a numeric TCP port.",
    );
    expect(() => resolvePlaywrightLocalPort("4191 && echo PWNED")).toThrow(
      "ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be a numeric TCP port.",
    );
  });

  it("rejects invalid TCP port ranges", () => {
    expect(() => resolvePlaywrightLocalPort("0")).toThrow(
      "ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be between 1 and 65535.",
    );
    expect(() => resolvePlaywrightLocalPort("65536")).toThrow(
      "ZENFLOW_PLAYWRIGHT_LOCAL_PORT must be between 1 and 65535.",
    );
  });

  it("normalizes a repo-relative staged preview output directory", () => {
    expect(resolvePlaywrightPreviewOutDir(undefined)).toBe("dist");
    expect(resolvePlaywrightPreviewOutDir("output/pages-artifact.nosync")).toBe(
      "output/pages-artifact.nosync",
    );
  });

  it("rejects staged preview output directories outside the repo or shell-shaped values", () => {
    expect(() => resolvePlaywrightPreviewOutDir("../dist")).toThrow(
      "ZENFLOW_PLAYWRIGHT_PREVIEW_DIR must stay inside the repository.",
    );
    expect(() => resolvePlaywrightPreviewOutDir("output/pages; echo PWNED")).toThrow(
      "ZENFLOW_PLAYWRIGHT_PREVIEW_DIR must contain only safe relative path characters.",
    );
  });
});
