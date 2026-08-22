// @vitest-environment node
import { createRequire } from "node:module";
import { dirname } from "node:path";
import { describe, expect, it } from "vitest";

const requireFromHere = createRequire(import.meta.url);

function requireBraceExpansionFor(minimatchPackage: string) {
  const minimatchEntry = requireFromHere.resolve(minimatchPackage);
  return requireFromHere(
    requireFromHere.resolve("brace-expansion", { paths: [dirname(minimatchEntry)] }),
  );
}

describe("T186 npm override compatibility", () => {
  it("gives minimatch v3 a callable brace-expansion module", () => {
    const expand = requireBraceExpansionFor("minimatch/package.json");
    expect(typeof expand).toBe("function");
    expect(expand("{a,b}")).toEqual(["a", "b"]);
  });
});
