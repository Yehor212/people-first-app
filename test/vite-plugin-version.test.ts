// @vitest-environment node

import { describe, expect, it } from "vitest";
import type { Plugin, ResolvedConfig } from "vite";
import { versionPlugin } from "../vite-plugin-version";

function getConfigResolved(plugin: Plugin) {
  const hook = plugin.configResolved;
  if (!hook) return undefined;
  return typeof hook === "function" ? hook : hook.handler;
}

function getTransformIndexHtml(plugin: Plugin) {
  const hook = plugin.transformIndexHtml;
  if (!hook) return undefined;
  if (typeof hook === "function") {
    return hook;
  }
  return "handler" in hook ? hook.handler : hook.transform;
}

function createResolvedConfig(command: "serve" | "build"): ResolvedConfig {
  return {
    root: process.cwd(),
    build: { outDir: "dist" },
    base: "/people-first-app/",
    command,
  } as never;
}

const indexHtmlContext = {
  path: "/index.html",
  filename: "/index.html",
} as never;

describe("versionPlugin HTML injection", () => {
  it("does not inject version-check.js during dev serve", async () => {
    const plugin = versionPlugin();
    const configResolved = getConfigResolved(plugin);
    const transformIndexHtml = getTransformIndexHtml(plugin);

    await configResolved?.(createResolvedConfig("serve"));

    expect(transformIndexHtml?.("", indexHtmlContext)).toBeUndefined();
  });

  it("injects version-check.js for build output", async () => {
    const plugin = versionPlugin();
    const configResolved = getConfigResolved(plugin);
    const transformIndexHtml = getTransformIndexHtml(plugin);

    await configResolved?.(createResolvedConfig("build"));

    expect(transformIndexHtml?.("", indexHtmlContext)).toEqual([
      {
        tag: "script",
        attrs: { src: "/people-first-app/version-check.js" },
        injectTo: "head-prepend",
      },
    ]);
  });
});
