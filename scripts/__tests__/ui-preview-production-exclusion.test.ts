import { brotliDecompressSync, gunzipSync } from "node:zlib";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const REPO_ROOT = resolve(".");
const DIST_ROOT = resolve(REPO_ROOT, "dist");
const FIXTURE_SENTINEL = "ZENFLOW_UI_PREVIEW_FIXTURE_ONLY_20260728";

const PREVIEW_SOURCE_PATHS = [
  "ui-preview.html",
  "src/dev/ui-system-preview/main.tsx",
  "src/dev/ui-system-preview/UiSystemPreview.tsx",
  "src/dev/ui-system-preview/UiPreviewControl.tsx",
  "src/dev/ui-system-preview/UiPreviewFoundations.tsx",
  "src/dev/ui-system-preview/UiPreviewStatus.tsx",
  "src/dev/ui-system-preview/registry.ts",
  "src/dev/ui-system-preview/fixtures.ts",
] as const;

function walkFiles(root: string): string[] {
  if (!existsSync(root)) return [];

  const files: string[] = [];
  const visit = (directory: string) => {
    const entries = readdirSync(directory, { withFileTypes: true }).sort((left, right) =>
      left.name.localeCompare(right.name)
    );
    for (const entry of entries) {
      const path = resolve(directory, entry.name);
      if (entry.isDirectory()) {
        visit(path);
      } else if (entry.isFile()) {
        files.push(path);
      }
    }
  };

  visit(root);
  return files;
}

function searchablePayloads(path: string): Buffer[] {
  const bytes = readFileSync(path);
  if (path.endsWith(".gz")) return [bytes, gunzipSync(bytes)];
  if (path.endsWith(".br")) return [bytes, brotliDecompressSync(bytes)];
  return [bytes];
}

describe("development-only UI-system preview production boundary", () => {
  it("declares one dedicated preview entry with physically isolated fixture data", () => {
    const missing = PREVIEW_SOURCE_PATHS.filter((path) => !existsSync(resolve(REPO_ROOT, path)));
    expect(
      missing,
      "Task 6 preview entry and modules should exist before their production boundary can be proven"
    ).toEqual([]);

    const html = readFileSync(resolve(REPO_ROOT, "ui-preview.html"), "utf8");
    const main = readFileSync(resolve(REPO_ROOT, "src/dev/ui-system-preview/main.tsx"), "utf8");
    const preview = readFileSync(
      resolve(REPO_ROOT, "src/dev/ui-system-preview/UiSystemPreview.tsx"),
      "utf8"
    );
    const previewControl = readFileSync(
      resolve(REPO_ROOT, "src/dev/ui-system-preview/UiPreviewControl.tsx"),
      "utf8"
    );
    const registry = readFileSync(
      resolve(REPO_ROOT, "src/dev/ui-system-preview/registry.ts"),
      "utf8"
    );
    const fixtures = readFileSync(
      resolve(REPO_ROOT, "src/dev/ui-system-preview/fixtures.ts"),
      "utf8"
    );

    expect(html).toContain("/src/dev/ui-system-preview/main.tsx");
    expect(main).toContain("./UiSystemPreview");
    expect(preview).toContain("./registry");
    expect(preview).toContain("./UiPreviewControl");
    expect(registry).toContain("./fixtures");
    expect(fixtures).toContain(FIXTURE_SENTINEL);
    expect(previewControl).toContain('from "@/components/ui/switch"');
    expect(previewControl).toContain(
      'from "@/pages/nav-v2/settings/components/V2SettingsControlPrimitives"'
    );
    expect(previewControl).not.toContain('role="switch"');
    expect(previewControl).not.toContain("interactiveStateClasses");
    expect(registry).toContain('source: "src/components/ui/switch.tsx"');
    expect(registry).toContain(
      'source: "src/pages/nav-v2/settings/components/V2SettingsControlPrimitives.tsx"'
    );
  });

  it("keeps the preview HTML, module path, and fixture sentinel out of dist", () => {
    expect(existsSync(DIST_ROOT), "run npm run build before asserting bundle exclusion").toBe(true);
    expect(
      existsSync(resolve(DIST_ROOT, "index.html")),
      "dist should be a completed web build"
    ).toBe(true);

    const files = walkFiles(DIST_ROOT);
    const previewNamedArtifacts = files
      .map((path) => relative(DIST_ROOT, path).replaceAll("\\", "/"))
      .filter((path) => /(^|[/._-])ui-preview([/._-]|$)/i.test(path));
    expect(
      previewNamedArtifacts,
      "the production build should not emit the dedicated preview entry or chunks"
    ).toEqual([]);

    const forbiddenBytes = [
      Buffer.from(FIXTURE_SENTINEL),
      Buffer.from("src/dev/ui-system-preview"),
      Buffer.from("/ui-preview.html"),
    ];
    const contentLeaks: string[] = [];

    for (const file of files) {
      for (const payload of searchablePayloads(file)) {
        if (forbiddenBytes.some((needle) => payload.includes(needle))) {
          contentLeaks.push(relative(DIST_ROOT, file).replaceAll("\\", "/"));
          break;
        }
      }
    }

    expect(
      [...new Set(contentLeaks)],
      "preview-only fixtures and route/module markers should be absent from production artifacts"
    ).toEqual([]);
  });
});
