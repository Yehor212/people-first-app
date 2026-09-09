import { afterEach, describe, expect, it } from "vitest";
import { spawnSync } from "node:child_process";
import { chmodSync, mkdirSync, mkdtempSync, readFileSync, rmSync, symlinkSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const root = process.cwd();
const temporaryDirectories: string[] = [];
const packageScripts = JSON.parse(readFileSync(path.join(root, "package.json"), "utf8")).scripts;

afterEach(() => {
  for (const directory of temporaryDirectories.splice(0)) rmSync(directory, { recursive: true });
});

function fixture(project: "app" | "node", typeError: boolean) {
  const directory = mkdtempSync(path.join(tmpdir(), "commit-types-"));
  temporaryDirectories.push(directory);
  for (const child of [".husky", "scripts", "src", "bin"]) mkdirSync(path.join(directory, child));
  writeFileSync(path.join(directory, ".husky/pre-commit"), readFileSync(path.join(root, ".husky/pre-commit")));
  writeFileSync(path.join(directory, "package.json"), JSON.stringify({ private: true, scripts: { typecheck: packageScripts.typecheck } }));
  writeFileSync(path.join(directory, "tsconfig.json"), JSON.stringify({ files: [], references: [{ path: "./tsconfig.app.json" }, { path: "./tsconfig.node.json" }] }));
  for (const target of ["app", "node"]) {
    writeFileSync(path.join(directory, `tsconfig.${target}.json`), JSON.stringify({ compilerOptions: { noEmit: true, strict: true, types: [], skipLibCheck: true }, files: [`src/${target}.ts`] }));
    writeFileSync(path.join(directory, `src/${target}.ts`), `export const checked: number = ${typeError && target === project ? '"type-error-control"' : "1"};\n`);
  }
  symlinkSync(path.join(root, "node_modules"), path.join(directory, "node_modules"), "dir");
  // Isolate unrelated hook dependencies; execute the repository hook and real
  // TypeScript compiler. A marker proves whether subsequent gates were reached.
  for (const script of ["agent-workspace-git-hook.cjs", "check-canonical-orbs.mjs", "doc-counts.cjs"]) {
    writeFileSync(path.join(directory, "scripts", script), "process.exit(0);\n");
  }
  const proxy = path.join(directory, "bin/npx");
  writeFileSync(proxy, `#!${process.execPath}\n` +
    `const {spawnSync}=require("node:child_process");\n` +
    `const {appendFileSync}=require("node:fs");\n` +
    `const args=process.argv.slice(2);\n` +
    `if(args[0]==="tsc"){const r=spawnSync(${JSON.stringify(process.execPath)},[${JSON.stringify(require.resolve("typescript/bin/tsc"))},...args.slice(1)],{stdio:"inherit"});process.exit(r.status??1);}\n` +
    `if(args[0]==="lint-staged"){appendFileSync("reached-gates.txt","lint-staged\\n");process.exit(0);}\n` +
    `process.exit(70);\n`);
  chmodSync(proxy, 0o755);
  writeFileSync(path.join(directory, "reached-gates.txt"), "");
  return { directory, run: () => spawnSync("sh", [".husky/pre-commit"], { cwd: directory, encoding: "utf8", env: { ...process.env, PATH: `${path.join(directory, "bin")}${path.delimiter}${process.env.PATH}` } }) };
}

describe("actual pre-commit application and tooling typecheck", () => {
  it.each(["app", "node"] as const)("rejects a real %s type error before lint-staged", project => {
    const { directory, run } = fixture(project, true);
    const result = run();
    expect(result.status, result.stderr + result.stdout).not.toBe(0);
    expect(result.stdout + result.stderr).toContain("TS2322");
    expect(readFileSync(path.join(directory, "reached-gates.txt"), "utf8")).toBe("");
  });

  it("reaches subsequent gates after both projects typecheck", () => {
    const { directory, run } = fixture("app", false);
    const result = run();
    expect(result.status, result.stderr + result.stdout).toBe(0);
    expect(readFileSync(path.join(directory, "reached-gates.txt"), "utf8")).toBe("lint-staged\n");
  });
});
