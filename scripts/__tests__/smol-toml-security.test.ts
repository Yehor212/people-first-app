import { spawnSync } from "node:child_process";
import { describe, expect, it } from "vitest";

describe("Knip TOML parser security regression", () => {
  // GHSA-7w5x-hrqm-74c2: an EOF comment in a structure must throw, never loop.
  // Bound the subprocess so an affected dependency cannot hang the test runner.
  it.each(["a=[1 #", "a={b=1 #"])("rejects an unfinished commented value: %s", (input) => {
    const result = spawnSync(
      process.execPath,
      [
        "--input-type=module",
        "-e",
        "import { parse, TomlError } from 'smol-toml'; try { parse(process.argv[1]); process.exitCode = 1; } catch (error) { if (!(error instanceof TomlError)) process.exitCode = 2; }",
        input,
      ],
      { cwd: process.cwd(), encoding: "utf8", timeout: 2_000 }
    );
    expect(result.error, result.stderr).toBeUndefined();
    expect(result.signal).toBeNull();
    expect(result.status, result.stderr).toBe(0);
  });
});
