import { spawnSync } from "node:child_process";
import {
  existsSync,
  linkSync,
  mkdtempSync,
  mkdirSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/production-data-integrity-gate.cjs");
const REGISTERED_STOP_HOOK = resolve(".codex/hooks/no-ai-template-gate.cjs");
const CHECKER_MARKER = ".pdi-checker-invoked";
const INVENTORY_CONFIG = readFileSync(resolve("config/production-data-integrity.json"), "utf8");
type InventoryConfig = {
  baselineFile: string;
  bundleDirectories: string[];
  enforcementPathGlobs: string[];
  entrypoints: string[];
  generatedPathGlobs: string[];
  productionPathGlobs: string[];
  releaseEvidenceGlobs: string[];
  releaseEvidenceRoots: string[];
  repositoryContracts: Array<{ path: string }>;
  scanRoots: string[];
  waiversFile: string;
};
const INVENTORY_CONFIG_OBJECT = JSON.parse(INVENTORY_CONFIG) as InventoryConfig;
const INVENTORY_GITIGNORE = readFileSync(resolve(".gitignore"), "utf8");

function configuredPathMatches(candidate: string, pattern: string): boolean {
  if (!/[*?]/.test(pattern)) {
    return candidate === pattern || candidate.startsWith(`${pattern}/`);
  }
  let source = "^";
  for (let index = 0; index < pattern.length; index += 1) {
    const character = pattern[index];
    if (character === "*" && pattern[index + 1] === "*") {
      if (pattern[index + 2] === "/") {
        source += "(?:.*/)?";
        index += 2;
      } else {
        source += ".*";
        index += 1;
      }
    } else if (character === "*") {
      source += "[^/]*";
    } else if (character === "?") {
      source += "[^/]";
    } else {
      source += character.replace(/[\\^$.*+?()[\]{}|]/g, "\\$&");
    }
  }
  return new RegExp(`${source}$`).test(candidate);
}

function materializeConfiguredPath(
  pattern: string,
  index: number,
  directoryLiteral = false
): string {
  const materialized = pattern
    .replace(/\*\*\//g, `nested-${index}/`)
    .replace(/\*\*/g, `nested-${index}`)
    .replace(/\*/g, `item-${index}`)
    .replace(/\?/g, "q");
  if (directoryLiteral && !/[*?]/.test(pattern) && !/\.[A-Za-z0-9]{1,12}$/.test(materialized)) {
    return `${materialized.replace(/\/+$/, "")}/pdi-config-derived-${index}.json`;
  }
  return materialized;
}

function uniquePathClasses(
  entries: ReadonlyArray<readonly [string, string]>
): Array<[string, string]> {
  const byCandidate = new Map<string, [string, string]>();
  for (const [label, candidate] of entries) {
    byCandidate.set(candidate, [label, candidate]);
  }
  return [...byCandidate.values()];
}

const generatedPath = (candidate: string): boolean =>
  INVENTORY_CONFIG_OBJECT.generatedPathGlobs.some((pattern) =>
    configuredPathMatches(candidate, pattern)
  ) ||
  INVENTORY_CONFIG_OBJECT.bundleDirectories.some(
    (directory) => candidate === directory || candidate.startsWith(`${directory}/`)
  );

const configuredPathEntries: ReadonlyArray<readonly [string, string, boolean]> = [
  ...INVENTORY_CONFIG_OBJECT.entrypoints.map(
    (pattern, index) =>
      [`entrypoints[${index}]`, materializeConfiguredPath(pattern, index), false] as const
  ),
  ...INVENTORY_CONFIG_OBJECT.scanRoots.map(
    (pattern, index) =>
      [`scanRoots[${index}]`, materializeConfiguredPath(pattern, index, true), false] as const
  ),
  ...INVENTORY_CONFIG_OBJECT.productionPathGlobs.map(
    (pattern, index) =>
      [`productionPathGlobs[${index}]`, materializeConfiguredPath(pattern, index), false] as const
  ),
  ...INVENTORY_CONFIG_OBJECT.releaseEvidenceGlobs.map(
    (pattern, index) =>
      [`releaseEvidenceGlobs[${index}]`, materializeConfiguredPath(pattern, index), true] as const
  ),
  ...INVENTORY_CONFIG_OBJECT.enforcementPathGlobs.map(
    (pattern, index) =>
      [`enforcementPathGlobs[${index}]`, materializeConfiguredPath(pattern, index), false] as const
  ),
  ["baselineFile", INVENTORY_CONFIG_OBJECT.baselineFile, false],
  ["waiversFile", INVENTORY_CONFIG_OBJECT.waiversFile, false],
  ...INVENTORY_CONFIG_OBJECT.repositoryContracts.map(
    (contract, index) => [`repositoryContracts[${index}].path`, contract.path, false] as const
  ),
];
const CONFIGURED_PATH_CLASSES = uniquePathClasses(
  configuredPathEntries
    .filter(([, candidate, evidencePath]) => evidencePath || !generatedPath(candidate))
    .map(([label, candidate]) => [label, candidate] as [string, string])
);
const IGNORED_ARTIFACT_PATH_CLASSES = uniquePathClasses([
  ...INVENTORY_CONFIG_OBJECT.generatedPathGlobs.map(
    (pattern, index) =>
      [`generatedPathGlobs[${index}]`, materializeConfiguredPath(pattern, index)] as [
        string,
        string,
      ]
  ),
  ...INVENTORY_CONFIG_OBJECT.bundleDirectories.map(
    (directory, index) =>
      [`bundleDirectories[${index}]`, `${directory}/pdi-config-derived-${index}.js`] as [
        string,
        string,
      ]
  ),
  ...INVENTORY_CONFIG_OBJECT.releaseEvidenceRoots.map(
    (directory, index) =>
      [
        `generic releaseEvidenceRoots[${index}]`,
        `${directory}/pdi-config-derived-${index}.txt`,
      ] as [string, string]
  ),
]);
const publicScanRoot = INVENTORY_CONFIG_OBJECT.scanRoots.find(
  (candidate) => candidate === "public"
);
if (!publicScanRoot) throw new Error("PDI test config must declare the public scan root");
const IGNORED_RELEVANT_PATH_CLASSES = uniquePathClasses([
  ["ignored production source", `${publicScanRoot}/pdi-hidden-canary.json`],
  ...INVENTORY_CONFIG_OBJECT.releaseEvidenceGlobs.map(
    (pattern, index) =>
      [`ignored releaseEvidenceGlobs[${index}]`, materializeConfiguredPath(pattern, index)] as [
        string,
        string,
      ]
  ),
]);
const POST_TOOL_CONFIGURED_PATH_CLASSES = uniquePathClasses([
  ...CONFIGURED_PATH_CLASSES,
  ...INVENTORY_CONFIG_OBJECT.bundleDirectories.map(
    (directory, index) =>
      [`bundleDirectories[${index}]`, `${directory}/pdi-config-derived-${index}.js`] as [
        string,
        string,
      ]
  ),
]);
const temporaryRoots: string[] = [];

afterEach(() => {
  for (const root of temporaryRoots.splice(0)) {
    rmSync(root, { force: true, recursive: true });
  }
});

type Stub = "clean" | "finding" | "error";

function write(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function makeRoot(stub: Stub = "clean"): string {
  const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-hook-"));
  temporaryRoots.push(root);
  const report =
    stub === "finding"
      ? {
          schemaVersion: "1.0.0",
          status: "FAIL",
          mode: "diff",
          findings: [
            {
              ruleId: "PDI002",
              path: "src/main.ts",
              line: 1,
              message: "synthetic history",
              fingerprint: "abc",
            },
          ],
          summary: { errors: 1, warnings: 0, baselined: 0, waived: 0 },
        }
      : {
          schemaVersion: "1.0.0",
          status: stub === "error" ? "ERROR" : "PASS",
          mode: "diff",
          findings: [],
          summary: { errors: 0, warnings: 0, baselined: 0, waived: 0 },
        };
  write(
    root,
    "scripts/check-production-data-integrity.cjs",
    [
      `require("node:fs").writeFileSync(${JSON.stringify(
        CHECKER_MARKER
      )}, process.argv.slice(2).join(" "));`,
      `process.stdout.write(${JSON.stringify(JSON.stringify(report))});`,
      `process.exit(${stub === "clean" ? 0 : stub === "finding" ? 1 : 2});`,
      "",
    ].join("\n")
  );
  write(
    root,
    "package.json",
    `${JSON.stringify(
      {
        scripts: {
          "check:agent-workspace": "node scripts/check-agent-workspace-protocol.cjs",
        },
      },
      null,
      2
    )}\n`
  );
  write(root, "config/production-data-integrity.json", INVENTORY_CONFIG);
  write(root, ".gitignore", INVENTORY_GITIGNORE);
  const initialized = spawnSync("git", ["init"], { cwd: root, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(initialized.stderr);
  return root;
}

function invoke(
  input: unknown,
  stub: Stub = "clean"
): { status: number | null; stdout: string; stderr: string; json?: Record<string, unknown> } {
  return invokeAtRoot(makeRoot(stub), input);
}

function invokeAtRoot(
  root: string,
  input: unknown
): { status: number | null; stdout: string; stderr: string; json?: Record<string, unknown> } {
  const result = spawnSync(process.execPath, [HOOK], {
    cwd: root,
    encoding: "utf8",
    input: typeof input === "string" ? input : JSON.stringify(input),
  });
  let json: Record<string, unknown> | undefined;
  if (result.stdout.trim()) json = JSON.parse(result.stdout) as Record<string, unknown>;
  return { status: result.status, stdout: result.stdout, stderr: result.stderr, json };
}

function commitFixture(root: string): void {
  for (const args of [
    ["config", "user.name", "PDI Hook Test"],
    ["config", "user.email", "pdi-hook@example.invalid"],
    ["add", "."],
    ["commit", "-m", "fixture baseline"],
  ]) {
    runGitFixture(root, args);
  }
}

function runGitFixture(root: string, args: string[]): void {
  const result = spawnSync("git", args, { cwd: root, encoding: "utf8" });
  if (result.status !== 0) {
    throw new Error(`git ${args.join(" ")} failed: ${result.stderr}`);
  }
}

describe("production data integrity Codex hook", () => {
  it("is composed into every lifecycle event with one bounded cross-platform command", () => {
    const config = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks: Record<
        string,
        Array<{
          matcher?: string;
          hooks: Array<{ command: string; commandWindows?: string; timeout?: number }>;
        }>
      >;
    };
    const expectedEntrypoint = {
      UserPromptSubmit: "skill-router-gate.cjs",
      PreToolUse: "agent-workspace-guard.cjs",
      PostToolUse: "production-data-integrity-gate.cjs",
      Stop: "no-ai-template-gate.cjs",
      SubagentStart: "subagent-evidence-gate.cjs",
      SubagentStop: "subagent-evidence-gate.cjs",
    } as const;
    for (const [event, entrypoint] of Object.entries(expectedEntrypoint)) {
      const handlers = (config.hooks[event] ?? []).flatMap((entry) => entry.hooks);
      expect(handlers, event).toHaveLength(1);
      expect(handlers[0].command, event).toContain(entrypoint);
      expect(handlers[0].commandWindows, event).toContain(entrypoint);
      expect(handlers[0].command).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].commandWindows).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].timeout).toBeGreaterThan(0);
      expect(handlers[0].timeout).toBeLessThanOrEqual(20);
    }
    expect(config.hooks.PreToolUse[0].matcher).toContain("Bash");
    expect(config.hooks.PreToolUse[0].matcher).toContain("apply_patch");
    expect(readFileSync(".codex/hooks/agent-workspace-guard.cjs", "utf8")).toContain(
      "evaluatePdiPreTool"
    );
    expect(readFileSync(".codex/hooks/no-ai-template-gate.cjs", "utf8")).toContain(
      "evaluatePdiStop"
    );
    expect(readFileSync(".codex/hooks/skill-router-gate.cjs", "utf8")).toContain(
      "productionDataIntegrityContext"
    );
    expect(readFileSync(".codex/hooks/no-ai-template-gate.cjs", "utf8")).toContain(
      "productionDataIntegrityContext"
    );
    expect(readFileSync(".codex/hooks/subagent-evidence-gate.cjs", "utf8")).toContain(
      "PRODUCTION DATA INTEGRITY TRUST/PROVENANCE"
    );
    const expectedPostToolMatcher = new Set([
      "Bash",
      "Shell",
      "PowerShell",
      "pwsh",
      "exec_command",
      "unified_exec",
      "apply_patch",
      "functions.apply_patch",
      "Edit",
      "Write",
      "WriteFile",
      "CreateFile",
      "DeleteFile",
      "MultiEdit",
      "StrReplaceFile",
      "NotebookEdit",
    ]);
    const postToolMatcher = config.hooks.PostToolUse.find((entry) =>
      entry.hooks.some((handler) => handler.command.includes("production-data-integrity-gate.cjs"))
    )?.matcher;
    expect(postToolMatcher).toBeDefined();
    const actualPostToolMatcher = new Set(
      postToolMatcher
        ?.split("|")
        .map((token) => token.trim())
        .filter(Boolean)
    );
    expect(actualPostToolMatcher).toEqual(expectedPostToolMatcher);
  });

  it("injects a short contract only for relevant user prompts", () => {
    const relevant = invoke({
      hook_event_name: "UserPromptSubmit",
      prompt: "Add sample records and a fallback to the production sync service",
    });
    expect(relevant.status, relevant.stderr).toBe(0);
    expect(JSON.stringify(relevant.json)).toContain("PRODUCTION_DATA_INTEGRITY_POLICY.md");
    expect(JSON.stringify(relevant.json)).toContain("test doubles");

    const neutral = invoke({
      hook_event_name: "UserPromptSubmit",
      prompt: "Fix a typo in the README heading",
    });
    expect(neutral.status, neutral.stderr).toBe(0);
    expect(neutral.json).toEqual({});
  });

  it("denies obvious protected-surface weakening from the official apply_patch command field", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: package.json",
          '-    "check:production-data-integrity": "node scripts/check-production-data-integrity.cjs --all",',
          "*** End Patch",
        ].join("\n"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
    expect(JSON.stringify(result.json)).toContain("production-data-integrity");
  });

  it("allows an additive package-script replacement that preserves every integrity command", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: package.json",
          '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
          '+    "ci:preflight": "npm run check:production-data-integrity && npm run check:agent-workspace && npm run check:production-data-integrity:bundle",',
          "*** End Patch",
        ].join("\n"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it.each([
    [
      "marker-only echo substitution",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "echo production-data-integrity && echo production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "early shell exit",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "exit 0 && npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "command substitution in an added npm command",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "npm run check:production-data-integrity && npm run $(touch /tmp/zenflow-pdi-bypass) && npm run check:production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "backtick substitution in an added npm command",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "npm run check:production-data-integrity && npm run `touch /tmp/zenflow-pdi-bypass` && npm run check:production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "unreviewed npx package insertion",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "npm run check:production-data-integrity && npx unreviewed-package && npm run check:production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "arbitrary local npm script before the preserved checks",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "npm run disable:pdi && npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "arbitrary local npm script after the preserved checks",
      [
        "*** Begin Patch",
        "*** Update File: package.json",
        '-    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle",',
        '+    "ci:preflight": "npm run check:production-data-integrity && npm run check:production-data-integrity:bundle && npm run mutate:pdi",',
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "contract marker moved into a comment",
      [
        "*** Begin Patch",
        "*** Update File: docs/RELEASE_CHECKLIST.md",
        "-## Production Data Integrity Gate",
        "+<!-- Production Data Integrity -->",
        "*** End Patch",
      ].join("\n"),
    ],
  ])("denies preserved-marker bypass via %s", (_label, command) => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { command },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
  });

  it("protects release-lifecycle wiring, not only the checker implementation", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: docs/RELEASE_CHECKLIST.md",
          "-## Production Data Integrity Gate",
          "*** End Patch",
        ].join("\n"),
      },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
  });

  it.each([
    ["redirect without whitespace", "echo weakened>docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md"],
    ["colon truncation redirect", ":>docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md"],
    [
      "inline Node filesystem write",
      `node -e "require('fs').writeFileSync('docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md','x')"`,
    ],
    [
      "inline Python filesystem write",
      `python3 -c "open('docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md','w').write('x')"`,
    ],
    ["find exec mutation", "find . -exec rm docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md \\;"],
    ["target-directory copy", "cp -t docs/ai/PRODUCTION_DATA_INTEGRITY_POLICY.md source.txt"],
  ])("denies protected shell mutation through %s", (_label, command) => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("deny");
  });

  it("allows a neutral edit and returns JSON without diagnostics in stdout", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { command: "*** Begin Patch\n*** Add File: docs/note.md\n+note\n*** End Patch" },
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it("uses reliable apply_patch targets instead of inert protected-path text", () => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Update File: output/corpus-safe-1.txt",
          "@@",
          "-fixture text",
          "+.github/workflows/production-data-integrity.yml",
          "+example check || true",
          "*** End Patch",
        ].join("\n"),
      },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it.each([
    [
      "real protected target",
      [
        "*** Begin Patch",
        "*** Update File: .github/workflows/production-data-integrity.yml",
        "@@",
        "-run required check",
        "+run required check || true",
        "*** End Patch",
      ].join("\n"),
    ],
    [
      "one protected target among multiple parsed targets",
      [
        "*** Begin Patch",
        "*** Update File: output/corpus-safe-1.txt",
        "@@",
        "-old",
        "+new",
        "*** Update File: .github/workflows/production-data-integrity.yml",
        "@@",
        "-run required check",
        "+run required check || true",
        "*** End Patch",
      ].join("\n"),
    ],
  ])("still denies PDI weakening for %s", (_label, command) => {
    const result = invoke({
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: { command },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toMatchObject({
      hookSpecificOutput: {
        hookEventName: "PreToolUse",
        permissionDecision: "deny",
      },
    });
  });

  it.each(["finding", "error"] as const)(
    "reports an already-applied PostToolUse effect when the checker returns %s",
    (stub) => {
      const result = invoke(
        {
          hook_event_name: "PostToolUse",
          tool_name: "apply_patch",
          tool_input: { command: "*** Begin Patch\n*** Update File: src/main.ts\n*** End Patch" },
        },
        stub
      );
      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason_code: "effect_applied_checker_failed",
        targets: ["src/main.ts"],
        reason: expect.stringContaining("no rollback or automatic retry"),
      });
      expect(result.json?.reason).toContain(stub === "finding" ? "PDI002" : "internal");
    }
  );

  it.each(POST_TOOL_CONFIGURED_PATH_CLASSES)(
    "runs PostToolUse checker for the configured %s path class with an exact target",
    (_label, changedPath) => {
      const result = invoke(
        {
          hook_event_name: "PostToolUse",
          tool_name: "WriteFile",
          tool_input: { file_path: changedPath, content: "changed\n" },
        },
        "error"
      );

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason_code: "effect_applied_checker_failed",
        targets: [changedPath],
        reason: expect.stringContaining("no rollback or automatic retry"),
      });
    }
  );

  it("fails PostToolUse closed with exact targets when configured scope cannot be read", () => {
    const root = makeRoot("clean");
    write(root, "config/production-data-integrity.json", "{");
    const result = invokeAtRoot(root, {
      hook_event_name: "PostToolUse",
      tool_name: "WriteFile",
      tool_input: { file_path: "src/main.ts", content: "changed\n" },
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason_code: "effect_applied_checker_failed",
      targets: ["src/main.ts"],
      reason: expect.stringContaining("no rollback or automatic retry"),
    });
  });

  it.each(["docs/note.md", "output/note.txt"])(
    "does not infer PostToolUse relevance from content when exact target %s is irrelevant",
    (target) => {
      const root = makeRoot("error");
      const result = invokeAtRoot(root, {
        hook_event_name: "PostToolUse",
        tool_name: "WriteFile",
        tool_input: {
          file_path: target,
          content: "Historical reference only: src/main.ts\n",
        },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({});
      expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
    }
  );

  it.each([
    ["Shell", "command"],
    ["PowerShell", "command"],
    ["pwsh", "command"],
    ["exec_command", "cmd"],
    ["unified_exec", "cmd"],
  ])(
    "does not run PostToolUse checker for a read-only %s payload using tool_input.%s",
    (toolName, commandKey) => {
      const root = makeRoot("error");
      const result = invokeAtRoot(root, {
        hook_event_name: "PostToolUse",
        tool_name: toolName,
        tool_input: { [commandKey]: "rg -n 'reviewed' src" },
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({});
      expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
    }
  );

  it.each([
    [
      "content-only WriteFile payload",
      {
        hook_event_name: "PostToolUse",
        tool_name: "WriteFile",
        tool_input: { content: "Historical source path: src/main.ts\n" },
      },
    ],
    [
      "opaque targetless exec payload",
      {
        hook_event_name: "PostToolUse",
        tool_name: "exec_command",
        tool_input: { cmd: `node -e "console.log('src/main.ts')"` },
      },
    ],
  ])("does not invent an exact PostToolUse target for %s", (_label, payload) => {
    const root = makeRoot("error");
    const result = invokeAtRoot(root, payload);

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
    expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
  });

  it.each([
    ["clean inventory", null],
    ["irrelevant changed path", "docs/note.md"],
  ])("skips the full Stop checker after a successful %s", (_label, changedPath) => {
    const root = makeRoot("error");
    commitFixture(root);
    if (changedPath) write(root, changedPath, "review note\n");

    const result = invokeAtRoot(root, {
      hook_event_name: "Stop",
      stop_hook_active: false,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({ continue: true });
    expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
  });

  it.each([
    "untracked",
    "tracked unstaged",
    "staged",
    "deleted",
    "renamed to an irrelevant destination",
  ])("runs the full Stop checker for a %s relevant path", (gitState) => {
    const root = makeRoot("clean");
    if (gitState !== "untracked") {
      write(root, "src/main.ts", "export const baseline = true;\n");
    }
    commitFixture(root);
    if (gitState === "untracked") {
      write(root, "src/main.ts", "export {};\n");
    } else if (gitState === "tracked unstaged") {
      write(root, "src/main.ts", "export const changed = true;\n");
    } else if (gitState === "staged") {
      write(root, "src/main.ts", "export const staged = true;\n");
      runGitFixture(root, ["add", "src/main.ts"]);
    } else if (gitState === "deleted") {
      rmSync(join(root, "src/main.ts"));
    } else {
      mkdirSync(join(root, "docs"), { recursive: true });
      runGitFixture(root, ["mv", "src/main.ts", "docs/moved.ts"]);
    }

    const result = invokeAtRoot(root, {
      hook_event_name: "Stop",
      stop_hook_active: false,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({ continue: true });
    expect(existsSync(join(root, CHECKER_MARKER))).toBe(true);
  });

  it.each(CONFIGURED_PATH_CLASSES)(
    "runs the full Stop checker for the configured %s path class",
    (_label, changedPath) => {
      const root = makeRoot("clean");
      const target = join(root, changedPath);
      if (!existsSync(target)) write(root, changedPath, "baseline\n");
      commitFixture(root);
      write(root, changedPath, `${existsSync(target) ? readFileSync(target, "utf8") : ""}\n`);

      const result = invokeAtRoot(root, {
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({ continue: true });
      expect(existsSync(join(root, CHECKER_MARKER))).toBe(true);
    }
  );

  it.each(IGNORED_ARTIFACT_PATH_CLASSES)(
    "skips the Git-based Stop checker for ignored %s and leaves it to explicit artifact gates",
    (_label, changedPath) => {
      const root = makeRoot("error");
      write(root, ".gitignore", `${INVENTORY_GITIGNORE.trimEnd()}\n${changedPath}\n`);
      commitFixture(root);
      write(root, changedPath, "ignored artifact\n");
      const ignored = spawnSync("git", ["check-ignore", "--quiet", changedPath], {
        cwd: root,
      });
      expect(ignored.status).toBe(0);

      const result = invokeAtRoot(root, {
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({ continue: true });
      expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
    }
  );

  it.each(IGNORED_RELEVANT_PATH_CLASSES)(
    "runs the full Stop checker for %s even when Git ignores %s",
    (_label, changedPath) => {
      const root = makeRoot("finding");
      write(root, ".gitignore", `${INVENTORY_GITIGNORE.trimEnd()}\n${changedPath}\n`);
      commitFixture(root);
      write(root, changedPath, '{"status":"PASS","synthetic":"history"}\n');
      const ignored = spawnSync("git", ["check-ignore", "--quiet", changedPath], {
        cwd: root,
      });
      expect(ignored.status).toBe(0);

      const result = invokeAtRoot(root, {
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason: expect.stringContaining("PDI002"),
      });
      expect(readFileSync(join(root, CHECKER_MARKER), "utf8")).toContain("--all");
    }
  );

  it("fails a clean Stop closed when the checker is missing", () => {
    const root = makeRoot("clean");
    rmSync(join(root, "scripts/check-production-data-integrity.cjs"));
    commitFixture(root);

    const result = invokeAtRoot(root, {
      hook_event_name: "Stop",
      stop_hook_active: false,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason_code: "relevant_path_inventory_failed",
      reason: "Production data integrity relevant-path inventory failed; Stop is not clean.",
    });
  });

  it.each(["symlink", "hardlink"] as const)(
    "fails a clean Stop closed when the checker is a %s",
    (linkType) => {
      const root = makeRoot("clean");
      const checker = join(root, "scripts/check-production-data-integrity.cjs");
      const linked = join(root, "scripts/check-production-data-integrity-linked.cjs");
      if (linkType === "symlink") {
        writeFileSync(linked, readFileSync(checker));
        rmSync(checker);
        symlinkSync(linked, checker);
      } else {
        linkSync(checker, linked);
      }
      commitFixture(root);

      const result = invokeAtRoot(root, {
        hook_event_name: "Stop",
        stop_hook_active: false,
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason_code: "relevant_path_inventory_failed",
        reason: "Production data integrity relevant-path inventory failed; Stop is not clean.",
      });
    }
  );

  it("fails a clean Stop closed when a required inventory array is empty", () => {
    const root = makeRoot("clean");
    const config = JSON.parse(INVENTORY_CONFIG) as Record<string, unknown>;
    config.scanRoots = [];
    write(root, "config/production-data-integrity.json", `${JSON.stringify(config)}\n`);
    commitFixture(root);

    const result = invokeAtRoot(root, {
      hook_event_name: "Stop",
      stop_hook_active: false,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason_code: "relevant_path_inventory_failed",
      reason: "Production data integrity relevant-path inventory failed; Stop is not clean.",
    });
  });

  it("blocks Stop when the Git relevant-path inventory fails", () => {
    const root = makeRoot("clean");
    commitFixture(root);
    writeFileSync(join(root, ".git", "index"), "invalid-index");

    const result = invokeAtRoot(root, {
      hook_event_name: "Stop",
      stop_hook_active: false,
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason_code: "relevant_path_inventory_failed",
      reason: "Production data integrity relevant-path inventory failed; Stop is not clean.",
    });
    expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
  });

  it.each(["finding", "error"] as const)("blocks Stop when the checker returns %s", (stub) => {
    const result = invoke({ hook_event_name: "Stop", stop_hook_active: false }, stub);
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.stringify(result.json)).toContain("block");
    expect(JSON.stringify(result.json)).toContain(stub === "finding" ? "PDI002" : "internal");
  });

  it("honors the Stop recursion guard without invoking a missing checker", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-pdi-stop-guard-"));
    temporaryRoots.push(root);
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: true }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  it("resolves the repository root when Codex invokes the hook from a subdirectory", () => {
    const root = makeRoot("clean");
    mkdirSync(join(root, "src"), { recursive: true });
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: join(root, "src"),
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "Stop", stop_hook_active: false }),
    });
    expect(result.status, result.stderr).toBe(0);
    expect(JSON.parse(result.stdout)).toEqual({ continue: true });
  });

  it("injects the evidence contract for subagents and rejects evidence-free PASS", () => {
    const start = invoke({ hook_event_name: "SubagentStart", agent_type: "reviewer" });
    expect(start.status, start.stderr).toBe(0);
    expect(JSON.stringify(start.json)).toContain("Findings");
    expect(JSON.stringify(start.json)).toContain("Remaining risk");

    const badStop = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: "PASS. All clear.",
    });
    expect(badStop.status, badStop.stderr).toBe(0);
    expect(JSON.stringify(badStop.json)).toContain("block");

    const goodStop = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: none observed.",
        "File/source evidence: src/main.ts inspected.",
        "Platform/domain impact: Web and sync.",
        "Verification run or skipped checks: npm test ran.",
        "Remaining risk: dynamic imports remain unverified.",
        "Verdict: GO",
      ].join("\n"),
    });
    expect(goodStop.status, goodStop.stderr).toBe(0);
    expect(goodStop.json).toEqual({});

    const splitVerificationStop = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: none observed.",
        "File/source evidence: src/main.ts inspected.",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:production-data-integrity:diff PASS.",
        "Verification skipped: native Windows hook loading remains UNVERIFIED.",
        "Remaining risk: runtime loading remains UNVERIFIED.",
        "Verdict: GO",
      ].join("\n"),
    });
    expect(splitVerificationStop.status, splitVerificationStop.stderr).toBe(0);
    expect(splitVerificationStop.json).toEqual({});

    const evidenceFreeSuccess = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: none observed.",
        "File/source evidence:   ",
        "Platform/domain impact: agent governance only.",
        "Verification skipped: no checks were run.",
        "Remaining risk: everything remains unknown.",
        "Verdict: GO",
      ].join("\n"),
    });
    expect(evidenceFreeSuccess.status, evidenceFreeSuccess.stderr).toBe(0);
    expect(evidenceFreeSuccess.json).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it.each([
    ["level-one headings with LF", "#", "\n"],
    ["level-two headings with CRLF", "##", "\r\n"],
  ])(
    "accepts an evidence-complete Markdown SubagentStop packet using %s",
    (_label, heading, newline) => {
      const result = invoke({
        hook_event_name: "SubagentStop",
        last_assistant_message: [
          `${heading} Findings`,
          "",
          "- No blocking production-data issue was found in the reviewed hook delta.",
          "- The conclusion is limited to the cited local files.",
          `${heading} File/source evidence`,
          "",
          "- scripts/__tests__/production-data-integrity-hook.test.ts:640",
          "- .codex/hooks/production-data-integrity-gate.cjs:500",
          `${heading} Platform/domain impact`,
          "",
          "- Agent governance only; shipped Web/PWA and native product runtimes are unchanged.",
          `${heading} Verification run`,
          "",
          "- npm run check:production-data-integrity:diff completed for the reviewed tree.",
          `${heading} Verification skipped`,
          "",
          "- Native Windows hook loading remains UNVERIFIED because no Windows runner was used.",
          `${heading} Remaining risk`,
          "",
          "- Fresh-session runtime loading remains UNVERIFIED.",
          `${heading} Verdict`,
          "",
          "GO",
        ].join(newline),
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({});
    }
  );

  it("does not reinterpret an explicit STOP verdict as success because verification passed", () => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "## Findings",
        "- A blocking production-data integrity concern remains in the reviewed hook delta.",
        "## File/source evidence",
        "- .codex/hooks/production-data-integrity-gate.cjs:640",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- npm run check:production-data-integrity:diff PASS for the focused reproduction.",
        "## Remaining risk",
        "- The unresolved finding can still block safe subagent completion.",
        "## Verdict",
        "STOP",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it("rejects a GO verdict contradicted by a failed verification run", () => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: no blocking issue was claimed.",
        "File/source evidence: .codex/hooks/production-data-integrity-gate.cjs:640",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:production-data-integrity:diff failed with exit 1.",
        "Remaining risk: the failed check is unresolved.",
        "Verdict: GO",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it("rejects an ambiguous verdict template instead of treating its first option as GO", () => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: no blocking issue was claimed.",
        "File/source evidence: .codex/hooks/production-data-integrity-gate.cjs:640",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm run check:production-data-integrity:diff passed.",
        "Remaining risk: runtime loading remains UNVERIFIED.",
        "Verdict: GO / STOP / ASK",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it("does not count a command that was not run as successful GO verification", () => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: no blocking issue was claimed.",
        "File/source evidence: .codex/hooks/production-data-integrity-gate.cjs:640",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm test was not run because the runner was unavailable.",
        "Remaining risk: runtime loading remains UNVERIFIED.",
        "Verdict: GO",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it("accepts a successful run that explicitly reports no failed checks", () => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: [
        "Findings: no blocking issue was found in the reviewed hook delta.",
        "File/source evidence: .codex/hooks/production-data-integrity-gate.cjs:640",
        "Platform/domain impact: agent governance only.",
        "Verification run: npm test passed; no checks failed.",
        "Remaining risk: runtime loading remains UNVERIFIED.",
        "Verdict: GO",
      ].join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({});
  });

  it.each([
    [
      "empty findings body",
      [
        "## Findings",
        "",
        "## File/source evidence",
        "- scripts/__tests__/production-data-integrity-hook.test.ts:640",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- npm run check:production-data-integrity:diff completed.",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
    [
      "marker-only bodies",
      [
        "## Findings",
        "- none",
        "## File/source evidence",
        "- x",
        "## Platform/domain impact",
        "- ...",
        "## Verification run",
        "- PASS",
        "## Remaining risk",
        "- TBD",
        "## Verdict",
        "GO",
      ],
    ],
    [
      "missing source locator",
      [
        "## Findings",
        "- Reviewed the hook behavior and found no blocking issue.",
        "## File/source evidence",
        "- Source was inspected locally but no locator is available.",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification skipped",
        "- Native verification was skipped because no Windows runner was available.",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
    [
      "fabricated PASS instead of verification evidence",
      [
        "## Findings",
        "- Reviewed the hook behavior and found no blocking issue.",
        "## File/source evidence",
        "- scripts/__tests__/production-data-integrity-hook.test.ts:640",
        "## Platform/domain impact",
        "- Agent governance only.",
        "## Verification run",
        "- PASS PASS PASS",
        "## Remaining risk",
        "- Runtime loading remains UNVERIFIED.",
        "## Verdict",
        "GO",
      ],
    ],
  ])("rejects a Markdown SubagentStop packet with %s", (_label, lines) => {
    const result = invoke({
      hook_event_name: "SubagentStop",
      last_assistant_message: lines.join("\n"),
    });

    expect(result.status, result.stderr).toBe(0);
    expect(result.json).toEqual({
      decision: "block",
      reason:
        "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
    });
  });

  it.each(["x", ".", "none", "pass"])(
    "rejects a marker-only SubagentStop packet filled with %s",
    (filler) => {
      const result = invoke({
        hook_event_name: "SubagentStop",
        last_assistant_message: [
          `Findings: ${filler}`,
          `File/source evidence: ${filler}`,
          `Platform/domain impact: ${filler}`,
          `Verification run: ${filler}`,
          `Remaining risk: ${filler}`,
          "Verdict: GO",
        ].join("\n"),
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason:
          "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
      });
    }
  );

  it.each([
    ["source locator", "source unavailable", "npm test ran."],
    ["verification command", "src/main.ts inspected.", "PASS PASS"],
  ])(
    "rejects a SubagentStop packet with marker-only %s",
    (_label, sourceEvidence, verification) => {
      const result = invoke({
        hook_event_name: "SubagentStop",
        last_assistant_message: [
          "Findings: none observed.",
          `File/source evidence: ${sourceEvidence}`,
          "Platform/domain impact: agent governance only.",
          `Verification run: ${verification}`,
          "Remaining risk: runtime loading remains UNVERIFIED.",
          "Verdict: GO",
        ].join("\n"),
      });

      expect(result.status, result.stderr).toBe(0);
      expect(result.json).toEqual({
        decision: "block",
        reason:
          "Subagent success claim lacks the required Findings, file/source evidence, platform/domain impact, verification/skips, remaining risk, and GO/STOP/ASK verdict packet.",
      });
    }
  );

  it("fails closed on malformed stdin without emitting invalid JSON", () => {
    const result = invoke("{not-json");
    expect(result.status).toBe(2);
    expect(result.stdout).toBe("");
    expect(result.stderr).toContain("HOOK ERROR");
  });

  it("keeps the clean registered Stop handler below the 30-run latency budget", () => {
    const root = makeRoot();
    commitFixture(root);
    const durations: number[] = [];

    for (let index = 0; index < 30; index += 1) {
      const startedAt = performance.now();
      const result = spawnSync(process.execPath, [REGISTERED_STOP_HOOK], {
        cwd: root,
        encoding: "utf8",
        input: JSON.stringify({
          hook_event_name: "Stop",
          last_assistant_message:
            "Local governance verification remains in progress. No completion claim is made.",
        }),
      });
      durations.push(performance.now() - startedAt);
      expect(result.status, result.stderr).toBe(0);
    }

    const sorted = durations.toSorted((left, right) => left - right);
    const summary = {
      p50: sorted[Math.ceil(sorted.length * 0.5) - 1],
      p95: sorted[Math.ceil(sorted.length * 0.95) - 1],
      max: sorted.at(-1)!,
    };
    console.info("Clean registered Stop 30-run timing", summary);
    expect(summary.p95).toBeLessThan(500);
    expect(existsSync(join(root, CHECKER_MARKER))).toBe(false);
  });
});
