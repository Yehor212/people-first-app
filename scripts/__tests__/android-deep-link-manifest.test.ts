import { readFileSync } from "node:fs";
import { describe, expect, it } from "vitest";

const manifest = readFileSync("android/app/src/main/AndroidManifest.xml", "utf8");
const intentFilters = [...manifest.matchAll(/<intent-filter\b[^>]*>[\s\S]*?<\/intent-filter>/g)].map(
  ([block]) => block,
);

function hasData(filter: string, attributes: Record<string, string>): boolean {
  return [...filter.matchAll(/<data\b[\s\S]*?\/>/g)].some(([data]) =>
    Object.entries(attributes).every(([name, value]) =>
      data.includes(`android:${name}="${value}"`),
    ),
  );
}

describe("Android challenge deep-link manifest", () => {
  it("keeps the supported custom challenge scheme", () => {
    expect(intentFilters.some((filter) => hasData(filter, { scheme: "zenflow", host: "challenge" }))).toBe(true);
  });

  it("does not declare an unverified zenflow.app challenge App Link", () => {
    const invalidWebFilter = intentFilters.find((filter) =>
      hasData(filter, { scheme: "https", host: "zenflow.app", pathPrefix: "/challenge" }),
    );

    expect(invalidWebFilter).toBeUndefined();
  });

  it("runs this manifest contract in the release-contract suite", () => {
    const packageJson = JSON.parse(readFileSync("package.json", "utf8"));

    expect(packageJson.scripts["test:release-contracts"]).toContain(
      "scripts/__tests__/android-deep-link-manifest.test.ts",
    );
  });
});
