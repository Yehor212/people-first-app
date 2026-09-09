// @vitest-environment node
// Disabled-path backport from ionic-team/capacitor#8481 (d4ad7ff).
// Keep native device/visual acceptance separate from this host-side proof.
import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { existsSync } from "node:fs";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import { afterAll, beforeAll, describe, expect, it } from "vitest";
import { systemBarsFrameworkSources } from "./fixtures/system-bars-framework";

const installedSource = path.resolve(
  "node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java",
);
const require = createRequire(import.meta.url);
const { parsePatchFile } = require("patch-package/dist/patch/parse") as {
  parsePatchFile: (source: string) => Array<{ type: string; path?: string }>;
};
const { executeEffects } = require("patch-package/dist/patch/apply") as {
  executeEffects: (effects: unknown[], options: { cwd: string; dryRun: boolean; bestEffort: boolean }) => void;
};
const javaHomes = [
  process.env.JAVA_HOME,
  "/Applications/Android Studio.app/Contents/jbr/Contents/Home",
].filter((value): value is string => Boolean(value));
const systemBarsJavaHome = javaHomes.find(home => existsSync(path.join(home, "bin", "javac")));
const javac = systemBarsJavaHome ? path.join(systemBarsJavaHome, "bin", "javac") : "javac";
const java = systemBarsJavaHome ? path.join(systemBarsJavaHome, "bin", "java") : "java";
let directory: string;

interface NativeObservation {
  ownerCalls: number;
  padding: number[];
  paddingWrites: number;
  evaluations: number;
  insetRequests: number;
  returnedBottom: number;
}

beforeAll(async () => {
  directory = await mkdtemp(path.join(tmpdir(), "zenflow-system-bars-test-"));
  const sources = {
    ...systemBarsFrameworkSources,
    "com/getcapacitor/plugin/SystemBars.java": await readFile(installedSource, "utf8"),
  };
  await Promise.all(Object.entries(sources).map(async ([name, source]) => {
    const target = path.join(directory, name);
    await mkdir(path.dirname(target), { recursive: true });
    await writeFile(target, source);
  }));
  await mkdir(path.join(directory, "classes"));
  const compiled = spawnSync(javac, [
    "-encoding", "UTF-8", "-d", path.join(directory, "classes"),
    ...Object.keys(sources).map(name => path.join(directory, name)),
  ], { encoding: "utf8", timeout: 30_000 });
  expect(compiled.error, "JDK compiler must be available; no native proof otherwise").toBeUndefined();
  expect(compiled.status, compiled.stderr).toBe(0);
}, 30_000);

afterAll(async () => {
  if (directory) await rm(directory, { recursive: true, force: true });
});

function observe(mode: string, api: number, webView: number, keyboard: boolean): NativeObservation {
  const result = spawnSync(java, [
    "-cp", path.join(directory, "classes"), "com.getcapacitor.plugin.SystemBarsHarness",
    mode, String(api), String(webView), String(keyboard),
  ], { encoding: "utf8", timeout: 10_000 });
  expect(result.error).toBeUndefined();
  expect(result.status, result.stderr).toBe(0);
  return JSON.parse(result.stdout);
}

describe("SystemBars native disabled-insets ownership", () => {
  it("replays the tracked patch from the exact pristine 8.3.3 source", async () => {
    const patched = await readFile(installedSource, "utf8");
    let pristine = patched;
    const guard = "        if (!insetHandlingEnabled) {\n            return;\n        }\n\n";
    for (const signature of ["    public void onDOMReady() {\n", "    private void initWindowInsetsListener() {\n"]) {
      pristine = pristine.replace(signature + guard, signature);
    }
    // Independent pre-edit digest prevents a reconstructed or drifted baseline
    // from silently validating a partial patch.
    expect(createHash("sha256").update(pristine).digest("hex"))
      .toBe("4a59775c840cc887858f5aa02c17707dee6c0578f036e8d0834cc08c098d0cdb");
    const relativeSource = "node_modules/@capacitor/android/capacitor/src/main/java/com/getcapacitor/plugin/SystemBars.java";
    const replayRoot = path.join(directory, "patch-replay");
    const replaySource = path.join(replayRoot, relativeSource);
    await mkdir(path.dirname(replaySource), { recursive: true });
    await writeFile(replaySource, pristine);
    const effects = parsePatchFile(await readFile("patches/@capacitor+android+8.3.3.patch", "utf8"));
    expect(effects.map(({ type, path: target }) => ({ type, path: target })))
      .toEqual([{ type: "patch", path: relativeSource }]);
    executeEffects(effects, { cwd: replayRoot, dryRun: true, bestEffort: false });
    expect(await readFile(replaySource, "utf8")).toBe(pristine);
    executeEffects(effects, { cwd: replayRoot, dryRun: false, bestEffort: false });
    expect(await readFile(replaySource, "utf8")).toBe(patched);
  });

  it.each([
    [36, 133, false],
    [36, 144, true],
    [29, 133, true],
  ] as const)("preserves the existing inset owner on API %i / WebView %i / IME %s", (api, webView, keyboard) => {
    const result = observe("disable", api, webView, keyboard);
    expect(result.ownerCalls).toBe(1);
    expect(result.padding).toEqual([9, 8, 7, 6]);
    expect(result.paddingWrites).toBe(0);
    expect(result.returnedBottom).toBe(24);
  });

  it("does not probe DOM or request extra insets while another plugin owns them", () => {
    const result = observe("disable", 36, 133, false);
    expect(result.evaluations).toBe(0);
    expect(result.insetRequests).toBe(0);
  });

  it.each([
    [36, 133, false, [4, 52, 6, 24], 0],
    [36, 133, true, [4, 52, 6, 600], 0],
    [36, 140, true, [0, 0, 0, 600], 0],
    [36, 144, true, [0, 0, 0, 600], 24],
    [36, 144, false, [0, 0, 0, 0], 24],
    [29, 133, true, [9, 8, 7, 6], 0],
  ] as const)("retains enabled-mode behavior on API %i / WebView %i / IME %s", (api, webView, keyboard, padding, returnedBottom) => {
    const result = observe("css", api, webView, keyboard);
    expect(result.ownerCalls).toBe(0);
    expect(result.padding).toEqual(padding);
    expect(result.returnedBottom).toBe(returnedBottom);
    expect(result.evaluations).toBeGreaterThan(0);
    expect(result.insetRequests).toBe(1);
  });
});
