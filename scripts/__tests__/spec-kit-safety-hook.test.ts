import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  linkSync,
  lstatSync,
  mkdirSync,
  mkdtempSync,
  readdirSync,
  readFileSync,
  realpathSync,
  renameSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, resolve } from "node:path";

import { afterEach, describe, expect, it } from "vitest";

const HOOK = resolve(".codex/hooks/spec-kit-safety-gate.cjs");
const WORKSPACE_GUARD = resolve(".codex/hooks/agent-workspace-guard.cjs");
const PROJECT_ROOT = resolve(".");
const CANONICAL_REMOTE = "https://github.com/Yehor212/people-first-app.git";
const MAX_JSON_INPUT_BYTES = 1_048_576;
const MAX_JSON_NESTING_DEPTH = 64;
const MAX_MANAGED_SKILL_BYTES = 262_144;
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
const SUPPORTED_MUTATION_TOOLS = [
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
] as const;

type HookHandler = {
  command: string;
  commandWindows?: string;
  timeout?: number;
};

type HookGroup = {
  matcher?: string;
  hooks: HookHandler[];
};

type HooksConfig = {
  hooks: Record<string, HookGroup[]>;
};

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
  const skillFiles: Record<string, string> = {};
  for (const skill of CORE_SKILLS) {
    const relativePath = `.agents/skills/${skill}/SKILL.md`;
    const content = `# ${skill}\n`;
    write(root, relativePath, content);
    skillFiles[relativePath] = createHash("sha256").update(content).digest("hex");
  }
  write(
    root,
    ".specify/integrations/codex.manifest.json",
    `${JSON.stringify({ integration: "codex", version: "0.15.1", files: skillFiles }, null, 2)}\n`
  );
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

function sizedHookInput(size: number): string {
  const prefix = '{"hook_event_name":"UserPromptSubmit","prompt":"';
  const suffix = '"}';
  const contentBytes = size - Buffer.byteLength(prefix) - Buffer.byteLength(suffix);
  if (contentBytes < 0) throw new Error("requested hook input size is too small");
  return `${prefix}${"x".repeat(contentBytes)}${suffix}`;
}

function nestedHookInput(depth: number): string {
  const nestedArrays = depth - 1;
  return `{"hook_event_name":"UserPromptSubmit","metadata":${"[".repeat(
    nestedArrays
  )}null${"]".repeat(nestedArrays)}}`;
}

function managedStatusBytes(
  rawByteLength: number,
  { bom = false, multibyte = false }: { bom?: boolean; multibyte?: boolean } = {}
): Buffer {
  const json = Buffer.from(
    JSON.stringify({
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
      padding_marker: multibyte ? "é" : "ascii",
    }),
    "utf8"
  );
  const prefix = bom ? Buffer.from([0xef, 0xbb, 0xbf]) : Buffer.alloc(0);
  const paddingLength = rawByteLength - prefix.length - json.length;
  if (paddingLength < 0) throw new Error("requested managed JSON size is too small");
  return Buffer.concat([prefix, json, Buffer.alloc(paddingLength, 0x20)]);
}

function writeManagedStatus(root: string, bytes: Buffer): void {
  writeFileSync(join(root, ".specify/memory/constitution-status.json"), bytes);
}

function jsonFilesUnder(directory: string): string[] {
  return readdirSync(directory, { withFileTypes: true }).flatMap((entry) => {
    const candidate = join(directory, entry.name);
    if (entry.isDirectory()) return jsonFilesUnder(candidate);
    return entry.isFile() && entry.name.endsWith(".json") ? [candidate] : [];
  });
}

function jsonNestingDepth(value: unknown): number {
  if (!value || typeof value !== "object") return 0;
  const children = Array.isArray(value) ? value : Object.values(value);
  return 1 + Math.max(0, ...children.map(jsonNestingDepth));
}

function expectAllowed(result: ReturnType<typeof runHook>): void {
  expect(result.status, result.stderr).toBe(0);
  expect(result.stderr).toBe("");
  const output = JSON.parse(result.stdout);
  if (Object.keys(output).length === 0) return;
  expect(output).toEqual({
    hookSpecificOutput: {
      hookEventName: "UserPromptSubmit",
      additionalContext: expect.any(String),
    },
  });
}

function expectBlocked(result: ReturnType<typeof runHook>, reason: RegExp): void {
  expect(result.status).toBe(2);
  expect(result.stderr).toContain("HOOK ERROR [spec-kit-safety-gate]");
  expect(result.stderr).toMatch(reason);
}

function readHooksConfig(): HooksConfig {
  return JSON.parse(readFileSync(".codex/hooks.json", "utf8")) as HooksConfig;
}

function matcherIncludesTool(matcher: string | undefined, toolName: string): boolean {
  if (!matcher || matcher === "*") return true;
  return new RegExp(`^(?:${matcher})$`).test(toolName);
}

function configuredSpecKitHandlers(config: HooksConfig, event: string): HookHandler[] {
  return (config.hooks[event] ?? [])
    .flatMap((entry) => entry.hooks)
    .filter((handler) => handler.command.includes("spec-kit-safety-gate.cjs"));
}

describe("Spec Kit safety hook lifecycle", () => {
  it("is registered exactly once for the three bounded lifecycle events", () => {
    const config = readHooksConfig();

    for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse"]) {
      const handlers = configuredSpecKitHandlers(config, event);
      expect(handlers, event).toHaveLength(1);
      expect(handlers[0].command).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].commandWindows).toContain("git rev-parse --show-toplevel");
      expect(handlers[0].timeout).toBeGreaterThan(0);
      expect(handlers[0].timeout).toBeLessThanOrEqual(10);
    }

    expect(config.hooks.PreToolUse[0].matcher).toContain("apply_patch");
    expect(config.hooks.PostToolUse[0].matcher).toContain("apply_patch");
  });

  it.each(SUPPORTED_MUTATION_TOOLS)(
    "F1 invokes exactly one Spec Kit PostTool handler for supported mutation tool %s",
    (toolName) => {
      const config = readHooksConfig();
      const matchingHandlers = (config.hooks.PostToolUse ?? [])
        .filter((group) => matcherIncludesTool(group.matcher, toolName))
        .flatMap((group) => group.hooks)
        .filter((handler) => handler.command.includes("spec-kit-safety-gate.cjs"));

      expect(matchingHandlers, toolName).toHaveLength(1);
      expect(configuredSpecKitHandlers(config, "PostToolUse")).toHaveLength(1);
    }
  );

  it("F5 returns controlled hook failure when the configured POSIX wrapper starts outside Git", () => {
    const config = readHooksConfig();
    const [handler] = configuredSpecKitHandlers(config, "UserPromptSubmit");
    const root = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-wrapper-no-git-"));
    roots.push(root);

    const result = spawnSync("sh", ["-c", handler.command], {
      cwd: root,
      encoding: "utf8",
      input: JSON.stringify({ hook_event_name: "UserPromptSubmit", prompt: "hello" }),
    });

    expectBlocked(result, /unable to resolve repository root/i);
  });

  it("F5 configures an equivalent fail-closed PowerShell bootstrap without swallowing hook status", () => {
    const config = readHooksConfig();
    for (const event of ["UserPromptSubmit", "PreToolUse", "PostToolUse"]) {
      const [handler] = configuredSpecKitHandlers(config, event);
      expect(handler.commandWindows, event).toMatch(/\$LASTEXITCODE\s*-ne\s*0/i);
      expect(handler.commandWindows, event).toContain("HOOK ERROR [spec-kit-safety-gate]");
      expect(handler.commandWindows, event).toMatch(/exit\s+2/i);
      expect(handler.commandWindows, event).toMatch(/exit\s+\$LASTEXITCODE/i);
    }
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

  it("C accepts the exact JSON size bound and rejects one byte over within the hook timeout", () => {
    const root = makeRepository();
    const startedAt = Date.now();

    expectAllowed(runHook(root, sizedHookInput(MAX_JSON_INPUT_BYTES)));
    expectBlocked(
      runHook(root, sizedHookInput(MAX_JSON_INPUT_BYTES + 1)),
      /JSON input exceeds.*1048576 bytes/i
    );
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });

  it("C accepts the exact JSON depth bound and rejects one level over within the hook timeout", () => {
    const root = makeRepository();
    const startedAt = Date.now();

    expectAllowed(runHook(root, nestedHookInput(MAX_JSON_NESTING_DEPTH)));
    expectBlocked(
      runHook(root, nestedHookInput(MAX_JSON_NESTING_DEPTH + 1)),
      /JSON nesting depth exceeds.*64/i
    );
    expect(Date.now() - startedAt).toBeLessThan(10_000);
  });

  it.each([
    [
      "key-like text inside a string",
      '{"hook_event_name":"UserPromptSubmit","prompt":"\\\"ratified\\\": true"}',
    ],
    [
      "the same key in separate objects",
      '{"hook_event_name":"UserPromptSubmit","metadata":{"left":{"state":1},"right":{"state":2}}}',
    ],
    [
      "valid JSON escapes",
      '{"hook_event_name":"UserPromptSubmit","prompt":"line\\nquote\\\"slash\\\\unicode\\u0061"}',
    ],
  ])("C accepts %s", (_label, input) => {
    expectAllowed(runHook(makeRepository(), input));
  });

  it("C rejects escaped-equivalent duplicate keys", () => {
    expectBlocked(
      runHook(
        makeRepository(),
        '{"hook_event_name":"UserPromptSubmit","metadata":{"ratified":false,"r\\u0061tified":false}}'
      ),
      /duplicate JSON key: ratified/i
    );
  });

  it("R3-C accepts an exact-bound managed JSON file and rejects one raw byte over", () => {
    const root = makeRepository();

    writeManagedStatus(root, managedStatusBytes(MAX_JSON_INPUT_BYTES));
    expectAllowed(runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }));

    writeManagedStatus(root, managedStatusBytes(MAX_JSON_INPUT_BYTES + 1));
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }),
      /constitution status.*JSON input exceeds.*1048576 bytes/i
    );
  });

  it("R3-C counts a UTF-8 BOM and multibyte content against the raw managed-file bound", () => {
    const root = makeRepository();

    writeManagedStatus(
      root,
      managedStatusBytes(MAX_JSON_INPUT_BYTES, { bom: true, multibyte: true })
    );
    expectAllowed(runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }));

    writeManagedStatus(
      root,
      managedStatusBytes(MAX_JSON_INPUT_BYTES + 1, { bom: true, multibyte: true })
    );
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }),
      /constitution status.*JSON input exceeds.*1048576 bytes/i
    );
  });

  it("R3-C measures the canonical Spec Kit JSON corpus and representative hook payloads", () => {
    const specifyRoot = realpathSync(join(PROJECT_ROOT, ".specify"));
    const corpus = jsonFilesUnder(specifyRoot).map((filePath) => {
      const bytes = statSync(filePath).size;
      const value = JSON.parse(readFileSync(filePath, "utf8")) as unknown;
      return { bytes, depth: jsonNestingDepth(value) };
    });
    const representativePayloads = [
      { hook_event_name: "UserPromptSubmit", prompt: "inspect" },
      {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "git status --short" },
      },
      {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: "/tmp/example/neutral.txt", content: "neutral" },
      },
    ].map((payload) => ({
      bytes: Buffer.byteLength(JSON.stringify(payload), "utf8"),
      depth: jsonNestingDepth(payload),
    }));

    expect(corpus).toHaveLength(9);
    expect(Math.max(...corpus.map(({ bytes }) => bytes))).toBe(6_769);
    expect(Math.max(...corpus.map(({ depth }) => depth))).toBe(3);
    expect(representativePayloads).toEqual([
      { bytes: 57, depth: 1 },
      { bytes: 97, depth: 2 },
      { bytes: 125, depth: 2 },
    ]);
    expect(Math.max(...corpus.map(({ bytes }) => bytes))).toBeLessThan(MAX_JSON_INPUT_BYTES);
    expect(Math.max(...corpus.map(({ depth }) => depth))).toBeLessThan(MAX_JSON_NESTING_DEPTH);
    expect(Math.max(...representativePayloads.map(({ bytes }) => bytes))).toBeLessThan(
      MAX_JSON_INPUT_BYTES
    );
    expect(Math.max(...representativePayloads.map(({ depth }) => depth))).toBeLessThan(
      MAX_JSON_NESTING_DEPTH
    );
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

  it("F3 preserves the existing allowance for an absent optional extension catalog", () => {
    const root = makeRepository();
    rmSync(join(root, ".specify/extensions"), { recursive: true });
    expectAllowed(runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }));
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

  it.each([
    ["ratified", '"ratified": true,\n  "ratified": false'],
    ["blocking authority", '"blocking_authority": true,\n  "blocking_authority": false'],
  ])("F6 rejects duplicate constitution %s keys before typed validation", (_label, duplicate) => {
    const root = makeRepository();
    const statusPath = join(root, ".specify/memory/constitution-status.json");
    const raw = readFileSync(statusPath, "utf8");
    const key = duplicate.startsWith('"ratified"') ? "ratified" : "blocking_authority";
    writeFileSync(statusPath, raw.replace(new RegExp(`"${key}": false`), duplicate));
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /duplicate JSON key/i
    );
  });

  it.each([".specify", ".agents", ".agents/skills"])(
    "F3 rejects symlinked managed parent %s before following its controlled fixture",
    (managedParent) => {
      const root = makeRepository();
      const original = join(root, managedParent);
      const externalParent = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-managed-parent-"));
      roots.push(externalParent);
      const external = join(externalParent, "controlled-fixture");
      renameSync(original, external);
      mkdirSync(dirname(original), { recursive: true });
      symlinkSync(external, original, "dir");

      expectBlocked(
        runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
        /managed path.*symlink/i
      );
    }
  );

  it("F3 rejects a dangling .specify/feature.json symlink instead of treating it as absent", () => {
    const root = makeRepository();
    symlinkSync("missing-feature.json", join(root, ".specify/feature.json"));
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /feature\.json.*symlink|dangling/i
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

  it.each(["'specify' workflow run demo", '"specify" workflow run demo'])(
    "F4 blocks a quoted executable token for workflow execution: %s",
    (command) => {
      expectBlocked(
        runHook(makeRepository(), {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command },
        }),
        /workflow run/i
      );
    }
  );

  it("F4 allows workflow text passed only as printf data", () => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "printf '%s\\n' 'specify workflow run demo'" },
      })
    );
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

  it.each(["'specify' extension add spec-kit-bugs", '"specify" extension remove spec-kit-bugs'])(
    "F4 blocks a quoted executable token for extension mutation: %s",
    (command) => {
      expectBlocked(
        runHook(makeRepository(), {
          hook_event_name: "PreToolUse",
          tool_name: "Bash",
          tool_input: { command },
        }),
        /extension mutation/i
      );
    }
  );

  it("F4 allows extension-mutation text passed only as printf data", () => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "printf '%s\\n' 'specify extension add spec-kit-bugs'" },
      })
    );
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
    ["Bash", "SPECIFY_FEATURE_DIRECTORY=../other specify plan"],
    ["Bash", "env SPECIFY_INIT_DIR=/tmp/other specify extension list"],
    ["Bash", "export SPECIFY_INIT_DIR=/tmp/other"],
    ["PowerShell", "$env:SPECIFY_FEATURE_DIRECTORY='../other'; specify plan"],
  ])("rejects inline directory override for %s: %s", (toolName, command) => {
    const result = runHook(makeRepository(), {
      hook_event_name: "PreToolUse",
      tool_name: toolName,
      tool_input: { command },
    });
    expectBlocked(result, /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i);
  });

  it.each([
    ["Bash", "export -- SPECIFY_INIT_DIR=/tmp/outside; specify plan"],
    ["Bash", "export -n SPECIFY_FEATURE_DIRECTORY=/tmp/outside; specify plan"],
    ["Bash", "export -p SPECIFY_INIT_DIR=/tmp/outside; specify plan"],
    ["Bash", "export -np -- SPECIFY_FEATURE_DIRECTORY=/tmp/outside; specify plan"],
    ["PowerShell", String.raw`Set-Item Env:SPECIFY_FEATURE_DIRECTORY C:\outside`],
    ["PowerShell", String.raw`Set-Content Env:SPECIFY_INIT_DIR C:\outside`],
    ["PowerShell", String.raw`Set-Item -Path 'Env:SPECIFY_FEATURE_DIRECTORY' -Value 'C:\outside'`],
    [
      "PowerShell",
      String.raw`& 'Set-Content' -LiteralPath "Env:SPECIFY_INIT_DIR" -Value "C:\outside"`,
    ],
  ])("R3-A rejects a supported restricted environment setter for %s: %s", (toolName, command) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { command },
      }),
      /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i
    );
  });

  it.each([
    String.raw`Set-Item -Path 'Env:\SPECIFY_FEATURE_DIRECTORY' -Value 'C:\outside'; specify plan`,
    String.raw`Set-Item -Force Env:SPECIFY_FEATURE_DIRECTORY 'C:\outside'; specify plan`,
    String.raw`Set-Content -Force 'Env:\SPECIFY_INIT_DIR' 'C:\outside'; specify plan`,
    String.raw`Set-Content -Value 'C:\outside' -Confirm:$false -LiteralPath 'Env:\SPECIFY_INIT_DIR'; specify plan`,
    String.raw`Set-Item -WhatIf:$false -Confirm:$false -Force Env:\SPECIFY_FEATURE_DIRECTORY 'C:\outside'; specify plan`,
    String.raw`Set-Content -Value 'C:\outside' -ErrorAction Stop Env:SPECIFY_INIT_DIR; specify plan`,
  ])("R4-A rejects a documented provider path after bounded arguments: %s", (command) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      }),
      /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i
    );
  });

  it.each([
    String.raw`Set-Content '-Force' 'Env:\SPECIFY_INIT_DIR'`,
    String.raw`Set-Content '-Path' 'Env:\SPECIFY_INIT_DIR'`,
    String.raw`Set-Content '-LiteralPath' 'Env:\SPECIFY_INIT_DIR'`,
  ])("R5-A allows a quoted option-like positional provider argument: %s", (command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      })
    );
  });

  it.each([
    String.raw`'$env:SPECIFY_INIT_DIR=C:\outside'`,
    "`$env:SPECIFY_FEATURE_DIRECTORY='C:\\outside'",
  ])("T4-A allows an inert quoted or escaped environment assignment: %s", (command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      })
    );
  });

  it.each([
    String.raw`"Set-Content" -Path 'Env:\SPECIFY_INIT_DIR' -Value 'C:\outside'`,
    String.raw`"&" 'Set-Content' -Path 'Env:\SPECIFY_INIT_DIR' -Value 'C:\outside'`,
    "`& 'Set-Content' -Path 'Env:\\SPECIFY_INIT_DIR' -Value 'C:\\outside'",
    String.raw`"&" 'C:\tools\specify.exe' workflow run demo`,
    "`& 'C:\\tools\\specify.exe' extension add spec-kit-bugs",
  ])("T4-A allows a quoted or escaped command/operator token used as data: %s", (command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      })
    );
  });

  it.each([
    String.raw`& 'Set-Content' -Path 'Env:\SPECIFY_INIT_DIR' -Value 'C:\outside'`,
    String.raw`& "Set-Item" -LiteralPath 'Env:\SPECIFY_FEATURE_DIRECTORY' -Value 'C:\outside'`,
  ])("T4-A blocks a bare call operator invoking a quoted restricted setter: %s", (command) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      }),
      /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i
    );
  });

  it.each([
    "Set-Content `-Force 'Env:\\SPECIFY_INIT_DIR'",
    "Set-Content `-Path 'Env:\\SPECIFY_INIT_DIR'",
    "Set-Content `-LiteralPath 'Env:\\SPECIFY_INIT_DIR'",
  ])("T4-A allows an escaped leading-hyphen positional provider argument: %s", (command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      })
    );
  });

  it.each([
    String.raw`Write-Output safe & Set-Content Env:\SPECIFY_INIT_DIR C:\outside`,
    String.raw`Write-Output safe & & 'Set-Item' Env:\SPECIFY_FEATURE_DIRECTORY C:\outside`,
    String.raw`Set-Content -- Env:\SPECIFY_INIT_DIR C:\outside`,
    String.raw`Set-Item -- Env:\SPECIFY_FEATURE_DIRECTORY C:\outside`,
  ])("T4-R1 blocks a restricted provider mutation through a bare boundary: %s", (command) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      }),
      /inline SPECIFY_(?:FEATURE_DIRECTORY|INIT_DIR)/i
    );
  });

  it.each([
    String.raw`Write-Output safe "&" Set-Content Env:\SPECIFY_INIT_DIR C:\outside`,
    "Write-Output safe `& Set-Content Env:\\SPECIFY_INIT_DIR C:\\outside",
    String.raw`Set-Content '--' 'Env:\SPECIFY_INIT_DIR'`,
    "Set-Item `-- 'Env:\\SPECIFY_FEATURE_DIRECTORY'",
  ])("T4-R1 allows a quoted or escaped boundary marker used as data: %s", (command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      })
    );
  });

  it.each([
    String.raw`Write-Output "Set-Item -Force Env:\SPECIFY_FEATURE_DIRECTORY C:\outside"`,
    String.raw`Set-Item -Force Variable:SPECIFY_FEATURE_DIRECTORY 'C:\outside'`,
    String.raw`Set-Content -Value 'Env:\SPECIFY_INIT_DIR' -Path 'Variable:ordinary'`,
  ])(
    "R4-A allows inert data or a non-Env provider without arbitrary token scanning: %s",
    (command) => {
      expectAllowed(
        runHook(makeRepository(), {
          hook_event_name: "PreToolUse",
          tool_name: "PowerShell",
          tool_input: { command },
        })
      );
    }
  );

  it.each([
    ["workflow", String.raw`& "C:\tools\specify.exe" workflow run demo`, /workflow run/i],
    [
      "extension mutation",
      String.raw`& 'C:\tools\specify.exe' extension add spec-kit-bugs`,
      /extension mutation/i,
    ],
  ])("A blocks a PowerShell Windows-path %s executable", (_label, command, reason) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command },
      }),
      reason
    );
  });

  it.each([
    ["Bash", "printf '%s\\n' 'specify workflow run demo'"],
    ["Bash", "printf '%s\\n' 'specify extension add spec-kit-bugs'"],
    ["Bash", "printf '%s\\n' 'SPECIFY_FEATURE_DIRECTORY=/tmp/example'"],
    ["PowerShell", "Write-Output 'specify workflow run demo'"],
    ["PowerShell", "Write-Output 'specify extension add spec-kit-bugs'"],
    ["PowerShell", "Write-Output '$env:SPECIFY_FEATURE_DIRECTORY=/tmp/example'"],
    ["Bash", "printf '%s\\n' 'export -- SPECIFY_INIT_DIR=/tmp/outside'"],
    ["PowerShell", String.raw`Write-Output 'Set-Item Env:SPECIFY_FEATURE_DIRECTORY C:\outside'`],
  ])("A allows prohibited-looking text used only as %s data: %s", (toolName, command) => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { command },
      })
    );
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

  it("F6 rejects duplicate feature_directory keys before accepting the last safe value", () => {
    const root = makeRepository();
    const outside = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-duplicate-feature-"));
    roots.push(outside);
    mkdirSync(join(root, "specs/001-safe-feature"), { recursive: true });
    write(
      root,
      ".specify/feature.json",
      `{\n  "feature_directory": ${JSON.stringify(outside)},\n  "feature_directory": "specs/001-safe-feature"\n}\n`
    );
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "hello" }),
      /duplicate JSON key/i
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

  it("F2 blocks a non-Spec-looking symlink alias that resolves into .specify/bugs", () => {
    const root = makeRepository();
    mkdirSync(join(root, ".specify/bugs"), { recursive: true });
    symlinkSync(join(root, ".specify"), join(root, "review-output"), "dir");

    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: "review-output/bugs/private-runtime.md", content: "private" },
      }),
      /\.specify\/bugs/i
    );
  });

  it("F2 blocks an apply_patch Move to destination in another repository lane", () => {
    const root = makeRepository();
    const outside = mkdtempSync(join(tmpdir(), "zenflow-spec-kit-move-outside-"));
    roots.push(outside);
    write(root, "specs/001-safe/plan.md", "# Plan\n");
    const destination = join(outside, "specs/002-other/plan.md");

    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          patch: [
            "*** Begin Patch",
            "*** Update File: specs/001-safe/plan.md",
            `*** Move to: ${destination}`,
            "@@",
            "-# Plan",
            "+# Moved plan",
            "*** End Patch",
          ].join("\n"),
        },
      }),
      /Spec Kit write target.*current repository lane/i
    );
  });

  it("B allows a neutral outside target while the existing workspace guard denies cross-lane mutation", () => {
    const safetyRoot = makeRepository();
    const outsideRepository = makeRepository();
    const remote = spawnSync("git", ["remote", "add", "origin", CANONICAL_REMOTE], {
      cwd: outsideRepository,
      encoding: "utf8",
    });
    expect(remote.status, remote.stderr).toBe(0);
    const target = join(outsideRepository, "neutral.txt");
    const toolEvent = {
      hook_event_name: "PreToolUse",
      tool_name: "WriteFile",
      tool_input: { path: target, content: "neutral" },
    };

    expectAllowed(runHook(safetyRoot, toolEvent));

    const workspaceResult = spawnSync(
      process.execPath,
      [WORKSPACE_GUARD, "--expected-agent", "codex"],
      {
        cwd: PROJECT_ROOT,
        encoding: "utf8",
        input: JSON.stringify({ ...toolEvent, cwd: PROJECT_ROOT }),
      }
    );
    expect(workspaceResult.status).toBe(2);
    expect(workspaceResult.stderr).toContain("ZENFLOW AGENT WORKSPACE GUARD BLOCKED");
    expect(workspaceResult.stderr).toContain("cross-worktree mutation");
  });

  it("B allows a safe missing neutral target inside the current lane", () => {
    expectAllowed(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: "notes/neutral-new.txt", content: "neutral" },
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

describe("Spec Kit trust-anchor preflight", () => {
  it.each([
    ".specify/extensions.yml",
    ".specify/integrations/codex.manifest.json",
    ".specify/memory/constitution-status.json",
    ".agents/skills/speckit-plan/SKILL.md",
  ])("denies a direct structured write before touching %s", (target) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: target, content: "replacement" },
      }),
      /protected Spec Kit trust anchor/i
    );
  });

  it.each([
    ".specify",
    ".specify/memory",
    ".specify/integrations",
    ".agents/skills",
    ".agents/skills/speckit-plan",
  ])("denies a structured parent deletion before touching %s", (target) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "DeleteFile",
        tool_input: { path: target },
      }),
      /protected Spec Kit trust anchor/i
    );
  });

  it.each([
    [".specify", "trust-alias", "trust-alias/extensions.yml"],
    [".agents/skills", "skill-alias", "skill-alias/speckit-plan/SKILL.md"],
  ])("denies a symlink-aliased structured write into %s", (source, alias, target) => {
    const root = makeRepository();
    symlinkSync(join(root, source), join(root, alias), "dir");
    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: target, content: "replacement" },
      }),
      /protected Spec Kit trust anchor/i
    );
  });

  it.each([
    ["Bash", "printf '%s\\n' unsafe > .specify/extensions.yml"],
    ["Bash", "printf unsafe>.specify/extensions.yml"],
    ["Bash", "printf unsafe &>.specify/extensions.yml"],
    ["Bash", "rm -- .specify/memory/constitution-status.json"],
    ["Bash", "rm -rf .specify"],
    ["Bash", "rm -rf .specify/memory"],
    ["Bash", "rm -rf .agents/skills"],
    ["Bash", "find .agents/skills/speckit-plan -delete"],
    ["Bash", "rm .specify//extensions.yml"],
    ["Bash", "rm .specify/./extensions.yml"],
    ["Bash", "ln .specify/extensions.yml trust-copy && printf unsafe>trust-copy"],
    ["Bash", "ln -s .specify trust-alias && printf unsafe>trust-alias/extensions.yml"],
    ["Bash", "cd .specify && rm extensions.yml"],
    ["Bash", 'bash -c "printf unsafe>.specify/extensions.yml"'],
    ["Bash", 'bash -lc "printf unsafe>.specify/extensions.yml"'],
    ["Bash", "printf unsafe>|.specify/extensions.yml"],
    ["PowerShell", "Set-Content .specify\\memory\\constitution-status.json '{}'"],
    ["PowerShell", "Clear-Item .specify\\extensions.yml"],
    ["PowerShell", "Clear-Item -Filter -WhatIf .specify\\extensions.yml"],
    ["PowerShell", "Remove-Item .agents\\skills\\speckit-plan\\SKILL.md"],
    ["PowerShell", "ri .agents\\skills\\speckit-plan\\SKILL.md"],
    ["PowerShell", "sc .specify\\memory\\constitution-status.json '{}'"],
    ["PowerShell", "ni -ItemType File .specify\\extensions.yml"],
    ["Bash", "specify init --here --integration codex --script sh --force"],
    ["Bash", "specify integration switch codex"],
    ["Bash", "cp neutral .specify/extensions.yml"],
    ["Bash", "cp /tmp/extensions.yml .specify/"],
    ["Bash", "mv /tmp/extensions.yml .specify/"],
    ["Bash", "uv tool run specify init --here --integration codex --script sh --force"],
    ["Bash", "uvx specify init --here --integration codex --script sh --force"],
    [
      "Bash",
      "uv tool run --from specify-cli specify init --here --integration codex --script sh --force",
    ],
    ["Bash", "uvx --from specify-cli specify init --here --integration codex --script sh --force"],
    [
      "Bash",
      "uv run --with specify-cli specify init --here --integration codex --script sh --force",
    ],
  ])("denies a statically recognizable trust mutation for %s: %s", (toolName, command) => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { command },
      }),
      /trust anchor|managed integration mutation/i
    );
  });

  it.each([
    ["exec_command", "cmd", "workdir", ".specify", "rm extensions.yml"],
    ["unified_exec", "command", "workdir", ".specify/memory", "rm constitution-status.json"],
    ["Bash", "command", "cwd", ".specify", "rm extensions.yml"],
  ])(
    "denies a relative trust mutation from requested %s working directory",
    (toolName, commandKey, directoryKey, directory, command) => {
      const root = makeRepository();
      const input: Record<string, unknown> = {
        hook_event_name: "PreToolUse",
        tool_name: toolName,
        tool_input: { [commandKey]: command },
      };
      if (directoryKey === "cwd") input.cwd = join(root, directory);
      else (input.tool_input as Record<string, unknown>)[directoryKey] = join(root, directory);
      expectBlocked(runHook(root, input), /protected Spec Kit trust anchor/i);
    }
  );

  it("denies a relative mutation from a symlinked requested working directory", () => {
    const root = makeRepository();
    const alias = join(root, "shell-workdir-alias");
    symlinkSync(join(root, ".specify"), alias, "dir");
    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "exec_command",
        tool_input: { cmd: "rm extensions.yml", workdir: alias },
      }),
      /protected Spec Kit trust anchor/i
    );
  });

  it("fails closed on conflicting requested working-directory evidence", () => {
    const root = makeRepository();
    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "exec_command",
        cwd: join(root, ".specify"),
        tool_input: { cmd: "rm extensions.yml", workdir: root },
      }),
      /conflicting shell working directory evidence/i
    );
  });

  it("accepts equivalent working-directory evidence and ignores empty optional aliases", () => {
    const root = makeRepository();
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "exec_command",
        cwd: root,
        tool_input: { cmd: "git status --short", workdir: "", cwd: root },
      })
    );
  });

  it("keeps read-only inventory and ordinary feature writes available", () => {
    const root = makeRepository();
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "sha256sum .specify/extensions.yml" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "find .agents/skills/speckit-plan -type f -print" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "exec_command",
        tool_input: {
          cmd: "sha256sum extensions.yml",
          workdir: join(root, ".specify"),
        },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "cp .specify/extensions.yml /tmp/spec-kit-backup.yml" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "cp -R .specify /tmp/spec-kit-backup" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "git clean -n -- .specify/extensions.yml" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: {
          command: "Remove-Item -WhatIf .agents\\skills\\speckit-plan\\SKILL.md",
        },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: { command: "Clear-Item .specify\\extensions.yml -WhatIf" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: {
          command: "Copy-Item neutral.txt .specify\\extensions.yml -WhatIf",
        },
      })
    );
    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: {
          command: "Remove-Item -WhatIf:$false .agents\\skills\\speckit-plan\\SKILL.md",
        },
      }),
      /protected Spec Kit trust anchor/i
    );
    expectBlocked(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: {
          command: "Remove-Item '-WhatIf' .agents\\skills\\speckit-plan\\SKILL.md",
        },
      }),
      /protected Spec Kit trust anchor/i
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: {
          command: "printf '%s\\n' 'rm .specify/extensions.yml'",
        },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "PowerShell",
        tool_input: {
          command: "Write-Output 'Remove-Item .agents\\skills\\speckit-plan\\SKILL.md'",
        },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "Bash",
        tool_input: { command: "specify integration status" },
      })
    );
    expectAllowed(
      runHook(root, {
        hook_event_name: "PreToolUse",
        tool_name: "WriteFile",
        tool_input: { path: "specs/001-safe/spec.md", content: "# Safe feature\n" },
      })
    );
  });

  it("denies an apply_patch update to a trust anchor before the patch runs", () => {
    expectBlocked(
      runHook(makeRepository(), {
        hook_event_name: "PreToolUse",
        tool_name: "apply_patch",
        tool_input: {
          patch: [
            "*** Begin Patch",
            "*** Update File: .specify/extensions.yml",
            "@@",
            "-installed: []",
            "+installed: [unsafe]",
            "*** End Patch",
          ].join("\n"),
        },
      }),
      /protected Spec Kit trust anchor/i
    );
  });

  it("rejects managed skill content drift against the official Codex manifest", () => {
    const root = makeRepository();
    write(root, ".agents/skills/speckit-plan/SKILL.md", "# altered\n");
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }),
      /managed skill hash mismatch/i
    );
  });

  it("rejects an oversized managed skill before hashing it", () => {
    const root = makeRepository();
    write(root, ".agents/skills/speckit-plan/SKILL.md", "x".repeat(MAX_MANAGED_SKILL_BYTES + 1));
    expectBlocked(
      runHook(root, { hook_event_name: "UserPromptSubmit", prompt: "inspect" }),
      /managed skill exceeds/i
    );
  });

  it("injects the ZenFlow priority contract on every prompt", () => {
    const result = runHook(makeRepository(), {
      hook_event_name: "UserPromptSubmit",
      prompt: "add an animation",
    });
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe("");
    const output = JSON.parse(result.stdout);
    const context = output.hookSpecificOutput?.additionalContext || "";
    expect(context).toContain("PROPOSED_CONSTITUTION_CONSIDERATION");
    expect(context).toContain("check-zenflow-constitution-status.sh --json");
    expect(context).toMatch(/tests are mandatory/i);
    expect(context).toMatch(/UNVERIFIED/i);
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
    expect(agents).toContain("docs/ai/SPEC_KIT_AGENT_POLICY.md");

    const policy = readFileSync("docs/ai/SPEC_KIT_AGENT_POLICY.md", "utf8");
    expect(policy).toContain("PROPOSED_CONSTITUTION_CONSIDERATION");
    expect(policy).toMatch(/tests are mandatory/i);
    expect(policy).toMatch(/industry standards[\s\S]*must not fill/i);
    expect(policy).toMatch(/dimming[\s\S]*conditional/i);
  });

  it("protects every grouped ZenFlow animation obligation with removal controls", () => {
    const policy = readFileSync("docs/ai/SPEC_KIT_AGENT_POLICY.md", "utf8");
    const requirements = [
      {
        label: "placement",
        scope: /^- Placement:.*$/im,
        atoms: [
          /Placement:/i,
          /initiating control/i,
          /attention target/i,
          /overlay owner/i,
          /safe areas/i,
          /keyboard/i,
          /mobile\/desktop geometry/i,
          /ModalLayer/,
          /OverlayLayer/,
        ],
      },
      {
        label: "user value",
        scope: /^- User value:.*$/im,
        atoms: [
          /User value:/i,
          /uncertainty/i,
          /delay/i,
          /transition/i,
          /completion signal/i,
          /Decoration alone is not a success criterion/i,
        ],
      },
      {
        label: "visibility and frequency",
        scope: /^- Visibility and frequency:.*$/im,
        atoms: [
          /entry\/exit/i,
          /first\/repeat behavior/i,
          /interruption cost/i,
          /cancellation/i,
          /rapid re-trigger/i,
          /background\/foreground/i,
          /app-resume behavior/i,
        ],
      },
      {
        label: "modal recovery",
        scope: /^- Background dimming.*$/im,
        atoms: [
          /conditional, not a default/i,
          /background interaction must pause/i,
          /focus ownership/i,
          /pointer blocking/i,
          /Escape/,
          /Android back/i,
          /dismissal/i,
          /recovery/i,
          /ambient or inline feedback/i,
          /steal attention/i,
          /hide needed context/i,
        ],
      },
      {
        label: "accessibility",
        scope: /^- Accessibility:.*$/im,
        atoms: [
          /semantic outcome/i,
          /reduced motion/i,
          /keyboard\/screen-reader focus order/i,
          /44 px targets/i,
          /contrast/i,
          /non-color cues/i,
          /seizure\/flash risk/i,
          /human comfort/i,
        ],
      },
      {
        label: "localization",
        scope: /^- Localization:.*$/im,
        atoms: [
          /all eight locales/i,
          /bidi\/RTL/i,
          /`ar`/,
          /`he`/,
          /do not concatenate translated fragments/i,
        ],
      },
      {
        label: "platforms",
        scope: /^- Platforms:.*$/im,
        atoms: [
          /Web\/Vite/,
          /installed PWA/,
          /Android\/Capacitor/,
          /iOS\/WKWebView/,
          /Desktop\/Tauri/,
          /safe areas/i,
          /native back/i,
          /lifecycle suspension/i,
          /input modality/i,
          /graceful fallback/i,
        ],
      },
      {
        label: "performance",
        scope: /^- Performance:.*$/im,
        atoms: [
          /measurable budget/i,
          /current baseline/i,
          /startup\/frame\/long-task\/bundle behavior/i,
          /`ValenceOrb`/,
          /`MiniValenceOrb`/,
          /cheaper approximation/i,
        ],
      },
      {
        label: "human and artistic evidence",
        scope: /^- Quality gates:.*$/im,
        atoms: [
          /Technical/,
          /Visual Runtime/,
          /Artistic\/Craft/,
          /Motion/,
          /Model/,
          /Plan/,
          /ARTISTIC_PASS/,
          /user acceptance/i,
        ],
      },
      {
        label: "lifecycle",
        scope: /^Specifications and plans cover.*$/im,
        atoms: [
          /creation/i,
          /loading/i,
          /success/i,
          /empty\/unavailable/i,
          /partial\/degraded/i,
          /offline/i,
          /retry/i,
          /cancellation/i,
          /duplicate\/re-entry/i,
          /background\/resume/i,
          /sync/i,
          /deletion/i,
          /recovery/i,
          /rollback/i,
          /observability/i,
        ],
      },
      {
        label: "privacy",
        scope: /^Security\/privacy analysis names.*$/im,
        atoms: [
          /data provenance/i,
          /retention/i,
          /least privilege/i,
          /secrets\/PII boundaries/i,
          /auth\/sync effects/i,
          /external destinations/i,
          /failure behavior/i,
        ],
      },
    ] as const;

    const missing = (source: string) =>
      requirements
        .filter(({ scope, atoms }) => {
          const section = source.match(scope)?.[0] || "";
          return !section || atoms.some((atom) => !atom.test(section));
        })
        .map(({ label }) => label);

    expect(missing(policy)).toEqual([]);
    for (const { label, scope, atoms } of requirements) {
      const sectionMatch = policy.match(scope);
      expect(sectionMatch, `${label} scope`).not.toBeNull();
      const section = sectionMatch?.[0] || "";
      for (const atom of atoms) {
        const atomMatch = section.match(atom);
        expect(atomMatch, `${label}: ${atom}`).not.toBeNull();
        const start = (sectionMatch?.index || 0) + (atomMatch?.index || 0);
        const redacted = `${policy.slice(0, start)}${policy.slice(start + (atomMatch?.[0].length || 0))}`;
        expect(missing(redacted), `${label}: ${atom}`).toContain(label);
      }
    }
  });
});
