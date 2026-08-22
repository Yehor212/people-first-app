// @vitest-environment node
import { createRequire } from "node:module";
import { join } from "node:path";
import { fileURLToPath } from "node:url";
import { describe, expect, it } from "vitest";

const ROOT_DIR = join(fileURLToPath(new URL("../..", import.meta.url)));

function braceExpansionFor(packageJsonPath: string) {
  return createRequire(packageJsonPath)("brace-expansion");
}

describe("T191 package override compatibility", () => {
  it("keeps the API expected by each installed minimatch major", () => {
    const v3 = braceExpansionFor(join(ROOT_DIR, "node_modules/minimatch/package.json"));
    const v5 = braceExpansionFor(
      join(ROOT_DIR, "node_modules/filelist/node_modules/minimatch/package.json")
    );
    const v10 = braceExpansionFor(
      join(
        ROOT_DIR,
        "node_modules/@typescript-eslint/typescript-estree/node_modules/minimatch/package.json"
      )
    );

    expect(typeof v3).toBe("function");
    expect(v3("{a,b}")).toEqual(["a", "b"]);
    expect(typeof v5).toBe("function");
    expect(v5("{a,b}")).toEqual(["a", "b"]);
    expect(typeof v10.expand).toBe("function");
    expect(v10.expand("{a,b}")).toEqual(["a", "b"]);
  });
});
