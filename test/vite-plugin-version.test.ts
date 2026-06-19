// @vitest-environment node

import { mkdtempSync, readFileSync, rmSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { describe, expect, it } from "vitest";
import type {
  IndexHtmlTransformContext,
  IndexHtmlTransformHook,
  MinimalPluginContextWithoutEnvironment,
  Plugin,
  ResolvedConfig,
} from "vite";
import { versionPlugin } from "../vite-plugin-version";

type ConfigResolvedHook = (
  this: MinimalPluginContextWithoutEnvironment,
  config: ResolvedConfig,
) => void | Promise<void>;
type WriteBundleHook = (
  this: MinimalPluginContextWithoutEnvironment,
  options: unknown,
  bundle: unknown,
) => void | Promise<void>;

const pluginContext = {
  meta: { rollupVersion: "test", watchMode: false },
} as MinimalPluginContextWithoutEnvironment;

function getConfigResolved(plugin: Plugin): ConfigResolvedHook | undefined {
  const hook = plugin.configResolved;
  if (!hook) return undefined;
  return typeof hook === "function" ? hook : hook.handler;
}

function getTransformIndexHtml(plugin: Plugin): IndexHtmlTransformHook | undefined {
  const hook = plugin.transformIndexHtml;
  if (!hook) return undefined;
  if (typeof hook === "function") {
    return hook;
  }
  return hook.handler;
}

function getWriteBundle(plugin: Plugin): WriteBundleHook | undefined {
  const hook = plugin.writeBundle;
  if (!hook) return undefined;
  return (typeof hook === "function" ? hook : hook.handler) as WriteBundleHook;
}

function createResolvedConfig(command: "serve" | "build", outDir = "dist"): ResolvedConfig {
  return {
    root: process.cwd(),
    build: { outDir },
    base: "/people-first-app/",
    command,
  } as unknown as ResolvedConfig;
}

const indexHtmlContext = {
  path: "/index.html",
  filename: "/index.html",
} as IndexHtmlTransformContext;

describe("versionPlugin HTML injection", () => {
  it("does not inject version-check.js during dev serve", async () => {
    const plugin = versionPlugin();
    const configResolved = getConfigResolved(plugin);
    const transformIndexHtml = getTransformIndexHtml(plugin);

    await configResolved?.call(pluginContext, createResolvedConfig("serve"));

    const transformResult = await Promise.resolve(
      transformIndexHtml?.call(pluginContext, "", indexHtmlContext),
    );

    expect(transformResult).toBeUndefined();
  });

  it("injects a deferred version-check.js for build output", async () => {
    const plugin = versionPlugin({ buildTime: 1234567890 });
    const configResolved = getConfigResolved(plugin);
    const transformIndexHtml = getTransformIndexHtml(plugin);

    await configResolved?.call(pluginContext, createResolvedConfig("build"));

    const transformResult = await Promise.resolve(
      transformIndexHtml?.call(pluginContext, "", indexHtmlContext),
    );

    expect(transformResult).toEqual([
      {
        tag: "script",
        attrs: {
          src: "/people-first-app/version-check.js?bt=1234567890",
          defer: true,
        },
        injectTo: "head-prepend",
      },
    ]);
  });

  it("generates a version-check reload path without redirecting from document location", async () => {
    const outputDir = mkdtempSync(join(tmpdir(), "zenflow-version-plugin-"));
    try {
      const plugin = versionPlugin({ buildTime: 1234567890 });
      const configResolved = getConfigResolved(plugin);
      const writeBundle = getWriteBundle(plugin);

      await configResolved?.call(pluginContext, createResolvedConfig("build", outputDir));
      await Promise.resolve(writeBundle?.call(pluginContext, {}, {}));

      const script = readFileSync(join(outputDir, "version-check.js"), "utf8");

      expect(script).not.toContain("new URL(location.href)");
      expect(script).not.toContain("location.replace(");
      expect(script).toContain("location.reload()");
    } finally {
      rmSync(outputDir, { force: true, recursive: true });
    }
  });
});
