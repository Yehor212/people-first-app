// @vitest-environment node
import { createHash } from "node:crypto";
import { createRequire } from "node:module";
import { mkdir, mkdtemp, readFile, rm, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";
import postcss from "postcss";
import { describe, expect, it } from "vitest";

const require = createRequire(import.meta.url);
type Effect = { type: string; path?: string };
const { parsePatchFile } = require("patch-package/dist/patch/parse") as {
  parsePatchFile(source: string): Effect[];
};
const { reversePatch } = require("patch-package/dist/patch/reverse") as {
  reversePatch(effects: Effect[]): Effect[];
};
const { executeEffects } = require("patch-package/dist/patch/apply") as {
  executeEffects(effects: Effect[], options: { cwd: string; dryRun: boolean; bestEffort: boolean }): void;
};

describe("SafeArea scoped keyboard viewport patch", () => {
  it("replays only the exact native file from pristine safe-area8.0.1", async () => {
    const relative = "node_modules/@capacitor-community/safe-area/android/src/main/java/com/getcapacitor/community/safearea/SafeAreaPlugin.java";
    const source = await readFile(relative, "utf8");
    const effects = parsePatchFile(await readFile("patches/@capacitor-community+safe-area+8.0.1.patch", "utf8"));
    expect(effects.map(({ type, path: target }) => ({ type, path: target })))
      .toEqual([{ type: "patch", path: relative }]);
    const directory = await mkdtemp(path.join(tmpdir(), "zenflow-safe-area-replay-"));
    try {
      const target = path.join(directory, relative);
      await mkdir(path.dirname(target), { recursive: true });
      await writeFile(target, source);
      executeEffects(reversePatch(effects), { cwd: directory, dryRun: false, bestEffort: false });
      const pristine = await readFile(target, "utf8");
      // Independently retained before the first floating-IME edit, not derived
      // from this patch. A partial or drifted baseline must fail replay.
      expect(createHash("sha256").update(pristine).digest("hex"))
        .toBe("e587898880b399d27cc78be42dd5f917079ce28d15bc01b5522dcf4c3f0c6165");
      executeEffects(effects, { cwd: directory, dryRun: true, bestEffort: false });
      expect(await readFile(target, "utf8")).toBe(pristine);
      executeEffects(effects, { cwd: directory, dryRun: false, bestEffort: false });
      expect(await readFile(target, "utf8")).toBe(source);
    } finally {
      await rm(directory, { recursive: true, force: true });
    }
  });

  it("reserves overlap only inside the Android editor without changing its visual materials", async () => {
    const css = postcss.parse(await readFile("src/index.css", "utf8"));
    const declarations: Array<{ selector: string; properties: Record<string, string> }> = [];
    css.walkRules(rule => {
      if (!rule.selector.includes("data-journal-keyboard-viewport")) return;
      const properties: Record<string, string> = {};
      rule.walkDecls(declaration => { properties[declaration.prop] = declaration.value; });
      declarations.push({ selector: rule.selector, properties });
    });
    const selector = ':root[data-platform="android"][data-journal-keyboard-viewport] .journal-entry-editor-shell[role="dialog"]';
    const compact = ':root[data-platform="android"][data-journal-keyboard-viewport] .journal-entry-editor-shell[data-journal-keyboard-compact][data-tools-collapsed="true"]';
    expect(declarations).toEqual([
      { selector, properties: { height: "100dvh", "max-height": "100dvh", "padding-bottom": "var(--zenflow-ime-overlap, 0px)" } },
      { selector: selector + " .journal-editor-paper-surface", properties: { "min-height": "calc((100dvh - var(--zenflow-ime-overlap, 0px)) * 0.6)" } },
      { selector: compact, properties: { display: "grid", "grid-template-columns": "minmax(0, 1fr) auto", "grid-template-rows": "auto minmax(0, 1fr)" } },
      { selector: compact + " > .journal-editor-header", properties: { "grid-area": "1 / 1", "min-width": "0", "padding-block": "0" } },
      { selector: compact + " .journal-editor-identity", properties: { display: "flex", "align-items": "center", gap: "0.5rem" } },
      { selector: compact + " .journal-editor-identity > div", properties: { "min-width": "0" } },
      { selector: compact + " .journal-editor-identity > div:first-child", properties: { flex: "1 1 auto" } },
      { selector: compact + " > .journal-editor-content", properties: { "grid-area": "2 / 1 / 3 / -1", "min-height": "0" } },
      { selector: compact + ' > [data-testid="journal-mobile-tools-panel"]', properties: { "grid-area": "1 / 2", width: "auto", "padding-block": "0", "align-self": "stretch", display: "flex", "align-items": "center" } },
    ]);
  });
});
