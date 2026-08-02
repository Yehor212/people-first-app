import { spawnSync } from "node:child_process";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  rmSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/spec-kit-safety-gate.cjs");
const EXTENSIONS_POLICY = [
  "installed: []",
  "settings:",
  "  auto_execute_hooks: false",
  "hooks: {}",
  "",
].join("\n");
const CORE_SKILLS = [
  "speckit-analyze",
  "speckit-checklist",
  "speckit-clarify",
  "speckit-constitution",
  "speckit-converge",
  "speckit-implement",
  "speckit-plan",
  "speckit-specify",
  "speckit-tasks",
  "speckit-taskstoissues",
] as const;
const roots: string[] = [];

afterEach(() => {
  for (const root of roots.splice(0)) rmSync(root, { force: true, recursive: true });
});

function write(root: string, relativePath: string, content: string): void {
  const target = join(root, relativePath);
  mkdirSync(dirname(target), { recursive: true });
  writeFileSync(target, content);
}

function makeRepository(): string {
  const root = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-safety-"));
  roots.push(root);
  const initialized = spawnSync("git", ["init", "--quiet"], { cwd: root, encoding: "utf8" });
  if (initialized.status !== 0) throw new Error(initialized.stderr);

  write(root, ".specify/extensions.yml", EXTENSIONS_POLICY);
  write(
    root,
    ".specify/memory/constitution-status.json",
    `${JSON.stringify(
      {
        schema_version: 1,
        constitution_version: "1.0.1",
        status: "PROPOSED",
        ratified: false,
        activation: "PROPOSAL_CRITERIA_ONLY",
        binding: false,
        blocking_authority: false,
        critical_remediation_authority: false,
        ratification_evidence: null,
        source: ".specify/memory/constitution.md",
        proposed_on: "2026-08-02",
      },
      null,
      2
    )}\n`
  );
  mkdirSync(join(root, ".specify/extensions/.cache"), { recursive: true });
  for (const skill of CORE_SKILLS) {
    write(root, `.agents/skills/${skill}/SKILL.md`, `# ${skill}\n`);
  }
  return root;
}

function runHook(
  root: string,
  input: unknown,
  envOverrides: Record<string, string | undefined> = {}
) {
  const env: NodeJS.ProcessEnv = { ...process.env };
  delete env.SPECIFY_FEATURE_DIRECTORY;
  delete env.SPECIFY_INIT_DIR;
  for (const [key, value] of Object.entries(envOverrides)) {
    if (value === undefined) delete env[key];
    else env[key] = value;
  }
  return spawnSync(process.execPath, [HOOK], {
    cwd: root,
    encoding: "utf8",
    env,
    input: typeof input === "string" ? input : JSON.stringify(input),
  });
}

function expectAllowed(result: ReturnType<typeof runHook>): void {
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  expect(JSON.parse(result.stdout)).toEqual({});
}

function expectBlocked(result: ReturnType<typeof runHook>, reason: RegExp): void {
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("HOOK ERROR [spec-kit-safety-gate]");
  expect(result.stderr).toMatch(reason);
}

describe("Spec Kit safety hook lifecycle", () => {
  it("is registered exactly once for the three bounded lifecycle events", () => {
    const config = JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as {
      hooks: Record<
        string,
        Array<{
          matcher?: string;
          hooks: Array<{ command: string; commandWindows?: string; timeout?: number }>;
        }>
      >;
    };

    for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse"]) {
      const handlers = (config.hooks[event] ?? [])
        .flatMap((entry) => entry.hooks)
        .filter((handler) => handler.command.includes("spec-kit-safety-gate.cjs"));
      expect(handlers, event).toHaveLength(1);
      expect(handlers[0].command).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].commandWindows).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].timeout).toBeGreaterThan(0);
      expect(handlers[0].timeout).toBeLessThanOrEqual(10);
    }

    expect(config.hooks.PreToolUse[0].matcher).toContain("apply_patch");
    expect(config.hooks.PostToolUse[0].matcher).toContain("apply_patch");
  });

  it.each(["UserPromptSubmit", "PreToolUse", "PostToolUse"])(
    "returns neutral JSON for a valid %s event",
    (event) => {
      const root = makeRepository();
      const input =
        event === "UserPromptSubmit"
          ? { hook_event_name: event, prompt: "inspect the current plan" }
          : {
              hook_event_name: event,
              tool_name: "Bash",
              tool_input: { command: "git status --short" },
            };
      expectAllowed(runHook(root, input));
    }
  );

  it("fails closed on malformed hook JSON", () => {
    expectBlocked(runHook(makeRepository(), "NOT JSON"), /Unexpected token|JSON/i);
  });

  it("fails closed when git cannot resolve a canonical repository root", () => {
    const root = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-no-git-"));
    roots.push(root);
    const result = spawnSync(process.execPath, [HOOK], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello" }),
    });
    expectBlocked(result, /repository root/i);
  });
});

describe("Spec Kit exact local trust state", () => {
  it("accepts only the canonical LF or equivalent CRLF extension policy", () => {
    const lfRoot = makeRepository();
    expectAllowed(runHook(lfRoot, { hook_event_name: "UserPromptSubmit", prompt: "hello" }));

    const crlfRoot = makeRepository();
    write(crlfRoot, ".specify/extensions.yml", EXTENSIONS_POLICY.replaceAll("\n", "\r\n"));
    expectAllowed(runHook(crlfRoot, { hook_event_name: "UserPromptSubmit", prompt: "hello" }));
  });

  it.each([
    ["missing", (root: string) => rmSync(join(root, ".specify/extensions.yml"))],
    ["malformed", (root: string) => write(root, ".specify/extensions.yml", "installed: [\n")],
    [
      "bare carriage return",
      (root: string) =>
        write(root, ".specify/extensions.yml", EXTENSIONS_POLICY.replaceAll("\n", "\r")),
    ],
    [
      "extra key",
      (root: string) =>
        write(root, ".specify/extensions.yml", `${EXTENSIONS_POLICY}source: local\n`),
    ],
    [
      "duplicate key",
      (root: string) =>
        write(root, ".specify/extensions.yml", `${EXTENSIONS_POLICY}installed: []\n`),
    ],
    [
      "installed extension",
      (root: string) =>
        write(
          root,
          ".specify/extensions.yml",
          "installed:\n  - spec-kit-bugs\nsettings:\n  auto_execute_hooks: false\nhooks: {}\n"
        ),
    ],
    [
      "automatic hooks",
      (root: string) =>
        write(
          root,
          ".specify/extensions.yml",
          "installed: []\nsettings:\n  auto_execute_hooks: true\nhooks: {}\n"
        ),
    ],
    [
      "hook entry",
      (root: string) =>
        write(
          root,
          ".specify/extensions.yml",
          "installed: []\nsettings:\n  auto_execute_hooks: false\nhooks:\n  before_plan: []\n"
        ),
    ],
  ])("rejects %s extension configuration", (_label, mutate) => {
    const root = makeRepository();
    mutate(root);
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /extensions\.yml/i
    );
  });

  it("rejects symlinked and hard-linked extension policy files", () => {
    const symlinkRoot = makeRepository();
    const policy = join(symlinkRoot, ".specify/extensions.yml");
    const source = join(symlinkRoot, "extensions-source.yml");
    rmSync(policy);
    writeFileSync(source, EXTENSIONS_POLICY);
    symlinkSync(source, policy);
    expect(lstatSync(policy).isSymbolicLink()).toBe(true);
    expectBlocked(
      runHook(symlinkRoot, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /symlink|extensions\.yml/i
    );

    const hardLinkRoot = makeRepository();
    const hardPolicy = join(hardLinkRoot, ".specify/extensions.yml");
    const hardSource = join(hardLinkRoot, "extensions-source.yml");
    rmSync(hardPolicy);
    writeFileSync(hardSource, EXTENSIONS_POLICY);
    linkSync(hardSource, hardPolicy);
    expect(lstatSync(hardPolicy).nlink).toBeGreaterThan(1);
    expectBlocked(
      runHook(hardLinkRoot, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /hard-linked|extensions\.yml/i
    );
  });

  it("allows only the ignored extension catalog cache beside the exact core skills", () => {
    const extraExtension = makeRepository();
    write(extraExtension, ".specify/extensions/optional-extension/manifest.yml", "name: unsafe\n");
    expectBlocked(
      runHook(extraExtension, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /installed-extension entry/i
    );

    const missingCore = makeRepository();
    rmSync(join(missingCore, ".agents/skills/speckit-plan"), { recursive: true });
    expectBlocked(
      runHook(missingCore, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /core skill/i
    );

    const extraCore = makeRepository();
    write(extraCore, ".agents/skills/speckit-bugs/SKILL.md", "# untrusted\n");
    expectBlocked(
      runHook(extraCore, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /core skill/i
    );
  });

  it.each([
    ["ratified", { ratified: true }],
    ["binding", { binding: true }],
    ["blocking", { blocking_authority: true }],
    ["critical remediation", { critical_remediation_authority: true }],
    ["activation", { activation: "ACTIVE" }],
  ])("rejects constitution %s authority escalation", (_label, mutation) => {
    const root = makeRepository();
    const statusPath = join(root, ".specify/memory/constitution-status.json");
    const status = JSON.parse(readFileSync(statusPath, "utf8"));
    writeFileSync(statusPath, `${JSON.stringify({ ...status, ...mutation }, null, 2)}\n`);
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /constitution.*nonbinding proposal/i
    );
  });

  it("rejects missing or malformed constitution status", () => {
    const missing = makeRepository();
    rmSync(join(missing, ".specify/memory/constitution-status.json"));
    expectBlocked(
      runHook(missing, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /constitution/i
    );

    const malformed = makeRepository();
    write(malformed, ".specify/memory/constitution-status.json", "{\n");
    expectBlocked(
      runHook(malformed, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /constitution/i
    );
  });
});

describe("Spec Kit command and lane boundaries", () => {
  it.each([
    "specify workflow run speckit",
    "command specify workflow run speckit",
    "env LC_ALL=C specify workflow run speckit",
    "sh -c 'specify workflow run speckit'",
  ])("blocks opaque workflow execution: %s", (command) => {
    const result = runHook(makeRepository(), {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });
    expectBlocked(result, /workflow run/i);
  });

  it.each([
    "specify extension add spec-kit-bugs",
    "specify extension remove spec-kit-bugs",
    "specify extension update spec-kit-bugs",
    "specify extension enable spec-kit-bugs",
    "specify extension disable spec-kit-bugs",
    "specify extension install spec-kit-bugs",
    "specify extension uninstall spec-kit-bugs",
  ])("blocks extension mutation: %s", (command) => {
    const result = runHook(makeRepository(), {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });
    expectBlocked(result, /extension mutation/i);
  });

  it("allows the read-only extension inventory command", () => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "specify extension list" },
      })
    );
  });

  it.each([
    "SPECIFY_FEATURE_DIRECTORY=../other specify plan",
    "env SPECIFY_INIT_DIR=/tmp/other specify extension list",
    "$env:SPECIFY_FEATURE_DIRECTORY='../other'; specify plan",
  ])("rejects inline directory override: %s", (command) => {
    const result = runHook(makeRepository(), {
      hook_event_name: "PreToolUse",
      tool_name: "Bash",
      tool_input: { command },
    });
    expectBlocked(result, /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i);
  });

  it("accepts inherited feature and init directories only when they resolve inside the lane", () => {
    const root = makeRepository();
    const feature = join(root, "specs/001-safe-feature");
    mkdirSync(feature, { recursive: true });
    expectAllowed(
      runHook(
        root,
        { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } },
        { SPECIFY_FEATURE_DIRECTORY: feature, SPECIFY_INIT_DIR: root }
      )
    );

    expectBlocked(
      runHook(
        root,
        { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } },
        { SPECIFY_FEATURE_DIRECTORY: "" }
      ),
      /SPECIFY_FEATURE_DIRECTORY.*non-empty/i
    );
  });

  it("rejects inherited outside and symlink-escaped directories", () => {
    const root = makeRepository();
    const outside = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-outside-"));
    roots.push(outside);
    expectBlocked(
      runHook(
        root,
        { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } },
        { SPECIFY_INIT_DIR: outside }
      ),
      /SPECIFY_INIT_DIR.*current repository lane/i
    );

    const link = join(root, "specs/escaped");
    mkdirSync(dirname(link), { recursive: true });
    symlinkSync(outside, link, "dir");
    expectBlocked(
      runHook(
        root,
        { hook_event_name: "PreToolUse", tool_name: "Bash", tool_input: { command: "git status" } },
        { SPECIFY_FEATURE_DIRECTORY: link }
      ),
      /SPECIFY_FEATURE_DIRECTORY.*current repository lane/i
    );
  });

  it("validates feature.json as a canonical in-lane feature directory", () => {
    const valid = makeRepository();
    mkdirSync(join(valid, "specs/001-safe-feature"), { recursive: true });
    write(
      valid,
      ".specify/feature.json",
      `${JSON.stringify({ feature_directory: "specs/001-safe-feature" })}\n`
    );
    expectAllowed(runHook(valid, { hook_event_name: "UserPromptSubmit", prompt: "hello" }));

    const malformed = makeRepository();
    write(malformed, ".specify/feature.json", "{\n");
    expectBlocked(
      runHook(malformed, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /feature\.json/i
    );

    const outside = makeRepository();
    const outsideFeature = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-feature-json-outside-"));
    roots.push(outsideFeature);
    write(
      outside,
      ".specify/feature.json",
      `${JSON.stringify({ feature_directory: outsideFeature })}\n`
    );
    expectBlocked(
      runHook(outside, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /feature\.json.*current repository lane/i
    );
  });

  it("blocks supported private-bug and cross-lane specification write targets", () => {
    const bugResult = runHook(makeRepository(), {
      hook_event_name: "PreToolUse",
      tool_name: "apply_patch",
      tool_input: {
        command: [
          "*** Begin Patch",
          "*** Add File: .specify/bugs/private-runtime.md",
          "+private evidence",
          "*** End Patch",
        ].join("\n"),
      },
    });
    expectBlocked(bugResult, /\.specify\/bugs/i);

    const root = makeRepository();
    const outside = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-target-"));
    roots.push(outside);
    const outsidePlan = join(outside, "specs/002-other/plan.md");
    const crossLane = runHook(root, {
      hook_event_name: "PreToolUse",
      tool_name: "Write",
      tool_input: { file_path: outsidePlan, content: "# Plan\n" },
    });
    expectBlocked(crossLane, /Spec Kit write target.*current repository lane/i);

    const safeFeature = join(root, "specs/001-safe");
    mkdirSync(safeFeature, { recursive: true });
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Write",
        tool_input: { file_path: join(safeFeature, "plan.md"), content: "# Plan\n" },
      })
    );
  });

  it("reports post-tool trust drift even though it cannot undo the prior side effect", () => {
    const root = makeRepository();
    write(
      root,
      ".specify/extensions.yml",
      "installed: []\nsettings:\n  auto_execute_hooks: true\nhooks: {}\n"
    );
    const result = runHook(root, {
      hook_event_name: "PostToolUse",
      tool_name: "Write",
      tool_input: { file_path: join(root, ".specify/extensions.yml") },
    });
    expectBlocked(result, /PostToolUse cannot undo/i);
  });
});

describe("Spec Kit durable ZenFlow routing", () => {
  it("documents full, compact, and intensified routes without granting side-effect authority", () => {
    const agents = readFileSync("AGENTS.md", "utf8");
    for (const skill of [
      "$speckit-specify",
      "$speckit-clarify",
      "$speckit-plan",
      "$speckit-checklist",
      "$speckit-tasks",
      "$speckit-analyze",
      "$speckit-implement",
      "$speckit-converge",
    ]) {
      expect(agents).toContain(skill);
    }
    expect(agents).toMatch(/small local fixes[\s\S]*compact test-first route/i);
    expect(agents).toMatch(/protected\/high-risk changes[\s\S]*M2 governance/i);
    expect(agents).toContain("check-zenflow-constitution-status.sh --json");
    expect(agents).toMatch(/optional extensions and extension hooks remain disabled/i);
    expect(agents).toMatch(/Spec Kit artifacts are plans\/evidence, never authorization/i);
    expect(agents).toMatch(/\$speckit-taskstoissues[\s\S]*explicit user-invoked/i);
    expect(agents).toMatch(/smallest sufficient specialist set/i);
  });
});
