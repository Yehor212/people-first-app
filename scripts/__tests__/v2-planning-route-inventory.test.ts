import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const read = (path: string) => readFileSync(path, "utf8");

function extractPagesArtifactRoutes(source: string) {
  const match = source.match(/const routes = \[([^\]]+)\];/);
  if (!match) throw new Error("Could not find prepare-pages-artifact routes array");
  return Array.from(match[1].matchAll(/"([^"]+)"/g), (entry) => entry[1]);
}

const v2PhoneAuthPaths =
  "ZENFLOW_PUBLIC_AUTH_ADDITIONAL_PATHS: orb/?nav=v2&navLayout=phone," +
  "habits/?nav=v2&navLayout=phone," +
  "diary/?nav=v2&navLayout=phone," +
  "planning/?nav=v2&navLayout=phone," +
  "settings/?nav=v2&navLayout=phone";

const planningRedirects = [
  "https://yehor212.github.io/people-first-app/planning?nav=v2",
  "https://yehor212.github.io/people-first-app/planning?nav=v2&navLayout=phone",
];

describe("V2 Planning route inventory", () => {
  it("creates a physical GitHub Pages entrypoint for Planning", () => {
    expect(extractPagesArtifactRoutes(read("scripts/prepare-pages-artifact.cjs"))).toEqual([
      "orb",
      "habits",
      "diary",
      "planning",
      "settings",
      "desktop",
    ]);
  });

  it("prepares Planning inside the V2-only Pages artifact", () => {
    const workflow = read(".github/workflows/deploy-v2-preview.yml");

    expect(workflow).toContain("name: Prepare V2 GitHub Pages artifact");
    expect(workflow).toContain("node scripts/prepare-pages-artifact.cjs");
    expect(workflow).toContain("path: v2-src/dist");
    expect(workflow).not.toContain("v1-src");
  });

  it("exercises Planning in the public auth smoke phone paths", () => {
    expect(read(".github/workflows/deploy.yml")).toContain(v2PhoneAuthPaths);
    expect(read("scripts/check-auth-providers.cjs")).toContain(v2PhoneAuthPaths);
  });

  it("allows Planning OAuth redirects in local Supabase and Apple auth helpers", () => {
    for (const file of [
      "supabase/config.toml",
      "scripts/check-apple-auth-live.cjs",
      "scripts/apply-apple-auth-live.cjs",
      "scripts/check-apple-auth-activation.cjs",
    ]) {
      const source = read(file);
      for (const redirect of planningRedirects) {
        expect(source, file + " includes " + redirect).toContain(redirect);
      }
    }
  });
});
