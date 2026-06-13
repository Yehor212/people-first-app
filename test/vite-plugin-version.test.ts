// @vitest-environment node

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

function createResolvedConfig(command: "serve" | "build"): ResolvedConfig {
  return {
    root: process.cwd(),
    build: { outDir: "dist" },
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
});
