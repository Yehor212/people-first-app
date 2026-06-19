import { readFileSync } from "node:fs";
import { resolve } from "node:path";
import { runInNewContext } from "node:vm";
import { afterEach, describe, expect, it } from "vitest";

const RUNTIME_PERF_DEVICE_GUARD_KEY = "zenflow-runtime-perf-device-guard";
const source = readFileSync(
  resolve(process.cwd(), "src/runtime-perf-bootstrap.js"),
  "utf8",
);
const legacyPublicSource = readFileSync(
  resolve(process.cwd(), "public/runtime-perf-bootstrap.js"),
  "utf8",
);
const indexHtml = readFileSync(resolve(process.cwd(), "index.html"), "utf8");

function runBootstrap(): void {
  runInNewContext(source, {
    Date,
    JSON,
    Set,
    URLSearchParams,
    document,
    window,
  });
}

describe("runtime performance early bootstrap", () => {
  afterEach(() => {
    delete document.documentElement.dataset.runtimePerf;
    localStorage.removeItem(RUNTIME_PERF_DEVICE_GUARD_KEY);
    window.history.replaceState({}, "", "/");
  });

  it("sets startup mode before React when the browser has a valid device guard", () => {
    localStorage.setItem(
      RUNTIME_PERF_DEVICE_GUARD_KEY,
      JSON.stringify({
        version: 2,
        mode: "startup",
        reason: "blocking-long-animation-frame",
        duration: 900,
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    runBootstrap();
    expect(document.documentElement.dataset.runtimePerf).toBe("startup");
  });

  it("honors the explicit runtimePerfGuard off escape hatch", () => {
    window.history.replaceState({}, "", "/?runtimePerfGuard=off");
    localStorage.setItem(
      RUNTIME_PERF_DEVICE_GUARD_KEY,
      JSON.stringify({
        version: 2,
        mode: "startup",
        expiresAt: Date.now() + 60_000,
      }),
    );

    runBootstrap();
    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
  });

  it("ignores stale or malformed device guards", () => {
    localStorage.setItem(
      RUNTIME_PERF_DEVICE_GUARD_KEY,
      JSON.stringify({
        version: 2,
        mode: "startup",
        expiresAt: Date.now() - 1,
      }),
    );

    runBootstrap();
    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();

    localStorage.setItem(RUNTIME_PERF_DEVICE_GUARD_KEY, "{bad-json");
    runBootstrap();
    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
  });

  it("ignores legacy device guards created before blocking LoAF attribution", () => {
    localStorage.setItem(
      RUNTIME_PERF_DEVICE_GUARD_KEY,
      JSON.stringify({
        version: 1,
        mode: "startup",
        reason: "long-animation-frame",
        duration: 1400,
        activatedAt: Date.now(),
        expiresAt: Date.now() + 60_000,
      }),
    );

    runBootstrap();
    expect(document.documentElement.dataset.runtimePerf).toBeUndefined();
  });

  it("loads as a Vite source module before the React bundle on every route", () => {
    const bootstrapIndex = indexHtml.indexOf('type="module" src="/src/runtime-perf-bootstrap.js"');
    const appBundleIndex = indexHtml.indexOf('type="module" src="/src/main.tsx"');

    expect(bootstrapIndex).toBeGreaterThan(-1);
    expect(appBundleIndex).toBeGreaterThan(-1);
    expect(bootstrapIndex).toBeLessThan(appBundleIndex);
    expect(indexHtml).not.toContain('%BASE_URL%runtime-perf-bootstrap.js');
    expect(indexHtml).not.toContain('src="./runtime-perf-bootstrap.js"');
  });

  it("keeps the legacy public bootstrap fallback byte-for-byte aligned", () => {
    expect(legacyPublicSource).toBe(source);
  });
});
