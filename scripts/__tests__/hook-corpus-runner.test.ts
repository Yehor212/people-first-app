import { spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import {
  copyFileSync,
  existsSync,
  linkSync,
  mkdirSync,
  mkdtempSync,
  readFileSync,
  realpathSync,
  rmSync,
  statSync,
  symlinkSync,
  writeFileSync,
} from "node:fs";
import { tmpdir } from "node:os";
import { dirname, join, relative, resolve } from "node:path";

import { describe, expect, it } from "vitest";

const ROOT = resolve(".");
const RUNNER = resolve("scripts/codex-governance/run-hook-corpus.cjs");
const HASH_PATTERN = /^[0-9a-f]{64}$/;
const MATCHER_ALIASES = [
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
const EXPECTED_FAMILY_COUNTS = {
  Bash: 40,
  Shell: 40,
  PowerShell: 40,
  pwsh: 40,
  exec_command: 40,
  unified_exec: 40,
  apply_patch: 16,
  "functions.apply_patch": 16,
  Edit: 16,
  Write: 16,
  WriteFile: 16,
  CreateFile: 16,
  DeleteFile: 16,
  MultiEdit: 16,
  StrReplaceFile: 16,
  NotebookEdit: 16,
};
const SKILL_ROUTING_REASON = "missing_or_invalid_skill_routing_evidence";
const INTERNAL_ERROR_REASON = /_internal_error$/;
const EXPECTED_PRETOOL_SOURCE_FILES = [
  ".codex/hooks/agent-workspace-guard.cjs",
  ".codex/hooks/no-ai-template-gate.cjs",
  ".codex/hooks/production-data-integrity-gate.cjs",
  ".codex/hooks/skill-router-gate.cjs",
  "scripts/agent-workspace-command-guard.cjs",
  "scripts/agent-workspace-core.cjs",
  "scripts/codex-governance/change-gate-core.cjs",
  "scripts/codex-governance/subagent-evidence.cjs",
  "scripts/codex-governance/tool-targets.cjs",
];

describe("topology-bound hook corpus runner", () => {
  it("runs 400 unique cases through every matching registered PreToolUse command", () => {
    const outputDirectory = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-test-output-"));
    const outputPath = join(outputDirectory, "receipt.json");
    let tempRoot = "";

    try {
      const run = spawnSync(process.execPath, [RUNNER, "--output", outputPath], {
        cwd: ROOT,
        encoding: "utf8",
        maxBuffer: 16 * 1024 * 1024,
        timeout: 180_000,
      });

      expect(run.status, corpusRunMessage(run)).toBe(0);
      const receipt = JSON.parse(run.stdout);
      tempRoot = receipt.temp_root;

      expect.soft(receipt.schema).toBe("zenflow-hook-corpus-v3");
      expect(receipt.verdict).toBe("PASS");
      expect(receipt.source_root).toBe(realpathSync(ROOT));
      expect(receipt.source_root_mode).toBe("current_checkout");
      expect(receipt.source_root_hooks_sha256).toBe(receipt.hooks_json_sha256);
      expect.soft(receipt.runtime_claim_scope).toEqual({
        canonical_runtime_shape: {
          tool_name: "Bash",
          tool_input_field: "command",
        },
        synthetic_compatibility_aliases: MATCHER_ALIASES.filter((alias) => alias !== "Bash"),
        limitation:
          "Only Bash with tool_input.command is canonical runtime evidence; aliases are deterministic synthetic compatibility coverage.",
      });
      expect(receipt.counts).toEqual({
        total: 400,
        safe: 300,
        malicious: 100,
        safe_false_blocks: 0,
        malicious_false_allows_or_wrong_control: 0,
        hook_execution_errors: 0,
      });
      expect.soft(receipt.per_family_counts).toEqual(EXPECTED_FAMILY_COUNTS);
      expect(receipt.results).toHaveLength(400);
      expect(new Set(receipt.results.map((entry: { id: string }) => entry.id)).size).toBe(400);
      expect
        .soft(
          [
            ...new Set(receipt.results.map((entry: { tool_name: string }) => entry.tool_name)),
          ].sort()
        )
        .toEqual([...MATCHER_ALIASES].sort());
      for (const alias of MATCHER_ALIASES) {
        const aliasResults = receipt.results.filter(
          (entry: { tool_name: string }) => entry.tool_name === alias
        );
        expect
          .soft(
            aliasResults.some((entry: { expected: string }) => entry.expected === "allow"),
            `${alias} must include a safe case`
          )
          .toBe(true);
        expect
          .soft(
            aliasResults.some((entry: { expected: string }) => entry.expected === "block"),
            `${alias} must include a malicious case`
          )
          .toBe(true);
      }

      for (const field of [
        "runner_sha256",
        "hooks_json_sha256",
        "hook_sources_sha256",
        "case_manifest_sha256",
      ]) {
        expect(receipt[field]).toMatch(HASH_PATTERN);
      }
      expect.soft(receipt.runner_sha256).toBe(sha256(readFileSync(RUNNER)));
      expect
        .soft(receipt.hooks_json_sha256)
        .toBe(sha256(readFileSync(join(ROOT, ".codex", "hooks.json"))));

      const canonicalTemp = realpathSync(tmpdir());
      const canonicalOutput = realpathSync(outputPath);
      expect(relative(canonicalTemp, canonicalOutput)).not.toMatch(/^\.\.(?:\/|$)/);
      expect(relative(ROOT, canonicalOutput)).toMatch(/^\.\.(?:\/|$)/);
      expect(receipt.result_path).toBe(canonicalOutput);
      expect(JSON.parse(readFileSync(outputPath, "utf8"))).toEqual(receipt);

      const expectedCommands = registeredPreToolCommands(ROOT);
      expect(receipt.hook_commands).toEqual(expectedCommands);
      const expectedHookSources = independentHookSourceGraph(ROOT, expectedCommands);
      expect.soft(receipt.hook_sources).toEqual(expectedHookSources);
      expect
        .soft(
          [
            ...new Set(
              expectedHookSources.flatMap((handler: { files: Array<{ relative_path: string }> }) =>
                handler.files.map((file) => file.relative_path)
              )
            ),
          ].sort()
        )
        .toEqual(EXPECTED_PRETOOL_SOURCE_FILES);
      expect
        .soft(receipt.hook_sources_sha256)
        .toBe(sha256(Buffer.from(canonicalJson(expectedHookSources))));

      const manifest = Array.isArray(receipt.case_manifest) ? receipt.case_manifest : [];
      expect.soft(manifest).toHaveLength(400);
      const semanticHashes = [];
      for (const manifestCase of manifest) {
        const expectedSemanticHash = semanticHash(manifestCase);
        semanticHashes.push(expectedSemanticHash);
        expect.soft(manifestCase.semantic_hash, manifestCase.id).toBe(expectedSemanticHash);
      }
      expect.soft(new Set(semanticHashes).size).toBe(400);
      expect.soft(receipt.case_manifest_sha256).toBe(sha256(Buffer.from(canonicalJson(manifest))));
      if (manifest.length > 0) {
        const idAblation = { ...manifest[0], id: "id-must-not-affect-semantic-hash" };
        expect.soft(semanticHash(idAblation)).toBe(manifest[0].semantic_hash);
        const pairingBase = {
          ...manifest[0],
          expected_controls: ["change_evidence", "workspace"],
          expected_owners: ["change_evidence", "workspace"],
          expected_reason_codes: ["ambiguous_tool_input", "workspace_policy"],
        };
        const pairingA = {
          ...pairingBase,
          expected_policy_results: [
            { owner: "change_evidence", reason_code: "ambiguous_tool_input" },
            { owner: "workspace", reason_code: "workspace_policy" },
          ],
        };
        const pairingB = {
          ...pairingBase,
          expected_policy_results: [
            { owner: "change_evidence", reason_code: "workspace_policy" },
            { owner: "workspace", reason_code: "ambiguous_tool_input" },
          ],
        };
        expect.soft(semanticHash(pairingA)).not.toBe(semanticHash(pairingB));
        const tamperedManifest = manifest.map((entry: object, index: number) =>
          index === 0 ? { ...entry, expected_controls: ["tampered"] } : entry
        );
        expect
          .soft(sha256(Buffer.from(canonicalJson(tamperedManifest))))
          .not.toBe(receipt.case_manifest_sha256);
      }
      for (const patchAlias of ["apply_patch", "functions.apply_patch"]) {
        const maliciousPatches = manifest.filter(
          (entry: { expected: string; tool_name: string }) =>
            entry.expected === "block" && entry.tool_name === patchAlias
        );
        expect
          .soft(
            new Set(
              maliciousPatches.map((entry: { tool_input: unknown }) =>
                canonicalJson(normalizeSemanticValue(entry.tool_input))
              )
            ).size,
            `${patchAlias} malicious payloads must be semantically distinct`
          )
          .toBe(maliciousPatches.length);
      }
      expect(receipt.latency_ms.full_chain.count).toBe(400);
      expect(receipt.latency_ms.full_chain.p50).toBeGreaterThanOrEqual(0);
      expect(receipt.latency_ms.full_chain.p95).toBeGreaterThanOrEqual(
        receipt.latency_ms.full_chain.p50
      );
      expect(receipt.latency_ms.full_chain.max).toBeGreaterThanOrEqual(
        receipt.latency_ms.full_chain.p95
      );
      expect(Object.keys(receipt.latency_ms.handlers).sort()).toEqual(
        expectedCommands.map((entry: { handler_id: string }) => entry.handler_id).sort()
      );
      for (const handler of Object.values(receipt.latency_ms.handlers) as Array<{
        count: number;
        p50: number;
        p95: number;
        max: number;
      }>) {
        expect(handler.count).toBe(400);
        expect(handler.p50).toBeGreaterThanOrEqual(0);
        expect(handler.p95).toBeGreaterThanOrEqual(handler.p50);
        expect(handler.max).toBeGreaterThanOrEqual(handler.p95);
      }
      for (const entry of receipt.results) {
        expect(entry.full_chain_duration_ms).toBeGreaterThanOrEqual(0);
        expect(entry.hook_results).toHaveLength(expectedCommands.length);
        for (const hookResult of entry.hook_results) {
          expect(hookResult.duration_ms).toBeGreaterThanOrEqual(0);
        }
      }

      const malicious = receipt.results.filter(
        (entry: { expected: string }) => entry.expected === "block"
      );
      for (const entry of malicious) {
        expect(entry.expected_reason_codes.length, entry.id).toBeGreaterThan(0);
        expect(entry.missing_expected_reason_codes, entry.id).toEqual([]);
        expect.soft(entry.unexpected_reason_codes, entry.id).toEqual([]);
        expect.soft(entry.unexpected_owners, entry.id).toEqual([]);
        expect.soft(entry.internal_error_reason_codes, entry.id).toEqual([]);
        expect.soft(entry.observed_reason_codes, entry.id).toEqual(entry.expected_reason_codes);
        expect.soft(entry.observed_owners, entry.id).toEqual(entry.expected_owners);
        expect.soft(entry.observed_policy_results, entry.id).toEqual(entry.expected_policy_results);
        expect.soft(entry.missing_expected_policy_results, entry.id).toEqual([]);
        expect.soft(entry.unexpected_policy_results, entry.id).toEqual([]);
        expect(entry.denied, entry.id).toBe(true);
      }

      const safe = receipt.results.filter(
        (entry: { expected: string }) => entry.expected === "allow"
      );
      for (const entry of safe) {
        expect(entry.denied, entry.id).toBe(false);
        expect(entry.observed_reason_codes, entry.id).toEqual([]);
        expect.soft(entry.unexpected_reason_codes, entry.id).toEqual([]);
        expect.soft(entry.unexpected_owners, entry.id).toEqual([]);
        expect.soft(entry.internal_error_reason_codes, entry.id).toEqual([]);
      }

      for (const toolName of ["exec_command", "unified_exec"]) {
        const toolCases = receipt.results.filter(
          (entry: { tool_name: string }) => entry.tool_name === toolName
        );
        expect(toolCases, toolName).toHaveLength(40);
        expect(
          toolCases.every((entry: { input_fields: string[] }) =>
            entry.input_fields.includes("cmd")
          ),
          `${toolName} must exercise tool_input.cmd`
        ).toBe(true);
      }
      expect(
        receipt.results.filter((entry: { tags: string[] }) =>
          entry.tags.includes("mixed_command_cmd")
        )
      ).toHaveLength(6);
      for (const mixed of receipt.results.filter((entry: { tags: string[] }) =>
        entry.tags.includes("mixed_command_cmd")
      )) {
        expect
          .soft(mixed.expected_reason_codes, mixed.id)
          .toEqual(["ambiguous_tool_input", "workspace_policy"]);
        expect.soft(mixed.expected_owners, mixed.id).toEqual(["change_evidence", "workspace"]);
        expect.soft(mixed.expected_controls, mixed.id).toEqual(["change_evidence", "workspace"]);
      }

      expect
        .soft(
          receipt.results.some((entry: { expected_reason_codes: string[] }) =>
            entry.expected_reason_codes.includes("missing_edit_target")
          ),
          "shared missing_edit_target must never stand in for an evaluator-scoped owner/reason"
        )
        .toBe(false);
      const skillRoutingCases = receipt.results.filter(
        (entry: { expected_reason_codes: string[] }) =>
          entry.expected_reason_codes.includes(SKILL_ROUTING_REASON)
      );
      expect.soft(skillRoutingCases).toHaveLength(1);
      if (skillRoutingCases.length === 1) {
        expect.soft(skillRoutingCases[0]).toEqual(
          expect.objectContaining({
            planning_evidence: "missing",
            expected_controls: ["skill_routing"],
            expected_owners: ["skill_routing"],
            expected_reason_codes: [SKILL_ROUTING_REASON],
            observed_reason_codes: [SKILL_ROUTING_REASON],
          })
        );
      }

      for (const entry of receipt.results) {
        for (const hookResult of entry.hook_results) {
          if (hookResult.exit_status !== 2) continue;
          expect.soft(hookResult.reason_codes.length, entry.id).toBeGreaterThan(0);
          expect.soft(hookResult.execution_error, entry.id).toBe(false);
          expect
            .soft(
              hookResult.reason_codes.every((reasonCode: string) =>
                entry.expected_reason_codes.includes(reasonCode)
              ),
              `${entry.id} exit 2 must contain only bounded expected policy reasons`
            )
            .toBe(true);
          expect
            .soft(
              hookResult.reason_codes.some((reasonCode: string) =>
                INTERNAL_ERROR_REASON.test(reasonCode)
              ),
              `${entry.id} exit 2 must not represent an internal evaluator error`
            )
            .toBe(false);
        }
      }

      const token = JSON.parse(
        readFileSync(join(receipt.fixture_root, ".preflight-token"), "utf8")
      );
      expect(token).toEqual(
        expect.objectContaining({
          authorization: false,
          evidence_only: true,
          purpose: "parser_and_planning_evidence_only",
        })
      );
    } finally {
      if (tempRoot && existsSync(tempRoot)) {
        rmSync(tempRoot, { recursive: true, force: true });
      }
      rmSync(outputDirectory, { recursive: true, force: true });
    }
  }, 180_000);

  it("fails the corpus when the skill-routing evaluator is bypassed", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-skill-ablation-"));
    const sourceRoot = join(testRoot, "source");
    const outputPath = join(testRoot, "receipt.json");
    let runnerTempRoot = "";

    try {
      copyGovernanceSourceRoot(ROOT, sourceRoot);
      const commands = registeredPreToolCommands(sourceRoot);
      const entrypoint = entrypointRelativePath(commands[0].command);
      const entrypointPath = join(sourceRoot, entrypoint);
      const original = readFileSync(entrypointPath, "utf8");
      const evaluatorCall =
        "const skill = evaluateSkillRoutingEvent(event, { analysis, rootDir });";
      expect(original.split(evaluatorCall)).toHaveLength(2);
      writeFileSync(
        entrypointPath,
        original.replace(
          evaluatorCall,
          'const skill = { allowed: true, reasonCode: "", reason: "" };'
        )
      );

      const run = spawnSync(
        process.execPath,
        [RUNNER, "--source-root", sourceRoot, "--output", outputPath],
        {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
          timeout: 180_000,
        }
      );

      expect(run.status, corpusRunMessage(run)).toBe(1);
      const receipt = JSON.parse(run.stdout);
      runnerTempRoot = receipt.temp_root;
      expect(receipt.counts.malicious_false_allows_or_wrong_control).toBe(1);
      const skillCase = receipt.results.find((entry: { expected_reason_codes: string[] }) =>
        entry.expected_reason_codes.includes(SKILL_ROUTING_REASON)
      );
      expect(skillCase).toEqual(
        expect.objectContaining({
          denied: false,
          expected_controls: ["skill_routing"],
          missing_expected_reason_codes: [SKILL_ROUTING_REASON],
          passed: false,
        })
      );
    } finally {
      if (runnerTempRoot && existsSync(runnerTempRoot)) {
        rmSync(runnerTempRoot, { recursive: true, force: true });
      }
      rmSync(testRoot, { recursive: true, force: true });
    }
  }, 180_000);

  it("treats unbounded, unexpected, and internal-error exit 2 results as execution errors", () => {
    const testRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-exit2-"));
    const sourceRoot = join(testRoot, "source");
    const hookDirectory = join(sourceRoot, ".codex", "hooks");
    const outputPath = join(testRoot, "receipt.json");
    let runnerTempRoot = "";
    mkdirSync(hookDirectory, { recursive: true });
    writeFileSync(
      join(sourceRoot, ".codex", "hooks.json"),
      `${JSON.stringify(
        {
          hooks: {
            PreToolUse: [
              {
                matcher: "Bash",
                hooks: [
                  {
                    type: "command",
                    command: 'node "$(git rev-parse --show-toplevel)/.codex/hooks/exit2-probe.cjs"',
                    timeout: 5,
                  },
                ],
              },
            ],
          },
        },
        null,
        2
      )}\n`
    );
    writeFileSync(
      join(hookDirectory, "exit2-probe.cjs"),
      [
        '"use strict";',
        'const fs = require("node:fs");',
        'const event = JSON.parse(fs.readFileSync(0, "utf8"));',
        "const command = event?.tool_input?.command;",
        'if (command === "git status --short" && event?.tool_input?.cmd === undefined) process.exit(2);',
        'if (command === "git diff --stat") {',
        '  process.stderr.write("Reason codes: workspace_internal_error\\n");',
        "  process.exit(2);",
        "}",
        `if (command === "git show --stat --oneline HEAD | sed -n '1p'") {`,
        '  process.stderr.write("Policy results: workspace:unexpected_policy_reason\\n");',
        '  process.stderr.write("Reason codes: unexpected_policy_reason\\n");',
        "  process.exit(2);",
        "}",
      ].join("\n")
    );

    try {
      const run = spawnSync(
        process.execPath,
        [RUNNER, "--source-root", sourceRoot, "--output", outputPath],
        {
          cwd: ROOT,
          encoding: "utf8",
          maxBuffer: 16 * 1024 * 1024,
          timeout: 180_000,
        }
      );

      expect(run.status, corpusRunMessage(run)).toBe(1);
      const receipt = JSON.parse(run.stdout);
      runnerTempRoot = receipt.temp_root;
      expect(receipt.counts.hook_execution_errors).toBe(3);
      expect(exit2ErrorCode(receipt, "safe-bash-001")).toBe("unbounded_exit2");
      expect(exit2ErrorCode(receipt, "safe-bash-002")).toBe("internal_error_reason");
      expect(exit2ErrorCode(receipt, "safe-bash-003")).toBe("unexpected_exit2_policy_result");
    } finally {
      if (runnerTempRoot && existsSync(runnerTempRoot)) {
        rmSync(runnerTempRoot, { recursive: true, force: true });
      }
      rmSync(testRoot, { recursive: true, force: true });
    }
  }, 180_000);

  it("rejects a receipt output target at the repository root", () => {
    const run = spawnSync(process.execPath, [RUNNER, "--output", ROOT], {
      cwd: ROOT,
      encoding: "utf8",
      timeout: 10_000,
    });

    expect(run.status).not.toBe(0);
    expect(run.stderr).toContain("OS temp");
  });

  it("rejects an explicit source-root directory symlink", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-source-link-"));
    const sourceLink = join(tempRoot, "source-link");
    symlinkSync(ROOT, sourceLink, "dir");

    try {
      const run = spawnSync(process.execPath, [RUNNER, "--source-root", sourceLink], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("--source-root must not be a symlink");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("rejects a hardlinked source hooks configuration", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-source-hardlink-"));
    const sourceRoot = join(tempRoot, "source");
    mkdirSync(join(sourceRoot, ".codex"), { recursive: true });
    linkSync(join(ROOT, ".codex", "hooks.json"), join(sourceRoot, ".codex", "hooks.json"));

    try {
      const run = spawnSync(process.execPath, [RUNNER, "--source-root", sourceRoot], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain(
        ".codex/hooks.json source governance file must not be a hardlink"
      );
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });

  it("never overwrites an existing OS-temp receipt", () => {
    const tempRoot = mkdtempSync(join(tmpdir(), "zenflow-hook-corpus-existing-"));
    const outputPath = join(tempRoot, "receipt.json");
    writeFileSync(outputPath, "sentinel\n", { mode: 0o600 });

    try {
      const run = spawnSync(process.execPath, [RUNNER, "--output", outputPath], {
        cwd: ROOT,
        encoding: "utf8",
        timeout: 10_000,
      });

      expect(run.status).not.toBe(0);
      expect(run.stderr).toContain("must not already exist");
      expect(readFileSync(outputPath, "utf8")).toBe("sentinel\n");
    } finally {
      rmSync(tempRoot, { recursive: true, force: true });
    }
  });
});

function sha256(value: string | Buffer): string {
  return createHash("sha256").update(value).digest("hex");
}

function canonicalJson(value: unknown): string {
  return JSON.stringify(canonicalValue(value));
}

function canonicalValue(value: unknown): unknown {
  if (Array.isArray(value)) return value.map(canonicalValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, candidate]) => [key, canonicalValue(candidate)])
    );
  }
  return value;
}

function normalizeSemanticValue(value: unknown): unknown {
  if (typeof value === "string") {
    return value.normalize("NFC").replace(/\r\n?/g, "\n");
  }
  if (Array.isArray(value)) return value.map(normalizeSemanticValue);
  if (value && typeof value === "object") {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, candidate]) => [key, normalizeSemanticValue(candidate)])
    );
  }
  return value;
}

function semanticHash(manifestCase: {
  expected: string;
  expected_controls: string[];
  expected_owners: string[];
  expected_policy_results: Array<{ owner: string; reason_code: string }>;
  expected_reason_codes: string[];
  tool_input: unknown;
  tool_name: string;
}): string {
  return sha256(
    Buffer.from(
      canonicalJson({
        expected: manifestCase.expected,
        expected_controls: [...manifestCase.expected_controls].sort(),
        expected_owners: [...manifestCase.expected_owners].sort(),
        expected_policy_results: [...manifestCase.expected_policy_results].sort(
          (left, right) =>
            left.owner.localeCompare(right.owner) ||
            left.reason_code.localeCompare(right.reason_code)
        ),
        expected_reason_codes: [...manifestCase.expected_reason_codes].sort(),
        tool_input: normalizeSemanticValue(manifestCase.tool_input),
        tool_name: manifestCase.tool_name,
      })
    )
  );
}

function registeredPreToolCommands(sourceRoot: string) {
  const hooksConfig = JSON.parse(readFileSync(join(sourceRoot, ".codex", "hooks.json"), "utf8"));
  return hooksConfig.hooks.PreToolUse.flatMap(
    (
      group: {
        matcher?: string;
        hooks: Array<{
          type?: string;
          command?: string;
          commandWindows?: string;
          timeout?: number;
        }>;
      },
      groupIndex: number
    ) =>
      group.hooks
        .map((hook, hookIndex) => ({ hook, hookIndex }))
        .filter(({ hook }) => hook.type === "command")
        .map(({ hook, hookIndex }) => ({
          handler_id: `pretool-${groupIndex}-${hookIndex}`,
          group_index: groupIndex,
          hook_index: hookIndex,
          matcher: group.matcher || "*",
          command: hook.command,
          command_windows: hook.commandWindows,
          timeout_seconds: hook.timeout,
        }))
  );
}

function entrypointRelativePath(command: string | undefined): string {
  const match = String(command || "").match(
    /^node\s+"\$\(git rev-parse --show-toplevel\)\/([^"]+)"/
  );
  if (!match) throw new Error(`Cannot resolve registered hook source: ${command}`);
  return match[1];
}

function independentHookSourceGraph(
  sourceRoot: string,
  commands: Array<{ command?: string; handler_id: string }>
) {
  return commands.map((command) => {
    const entrypoint = entrypointRelativePath(command.command);
    const relativePaths = discoverLocalRequireClosure(sourceRoot, entrypoint);
    return {
      handler_id: command.handler_id,
      entrypoint_relative_path: entrypoint,
      files: relativePaths.map((relativePath) => ({
        relative_path: relativePath,
        role: relativePath === entrypoint ? "entrypoint" : "transitive",
        sha256: sha256(readFileSync(join(sourceRoot, relativePath))),
      })),
    };
  });
}

function discoverLocalRequireClosure(sourceRoot: string, entrypoint: string): string[] {
  const pending = [entrypoint];
  const visited = new Set<string>();
  while (pending.length > 0) {
    const relativePath = pending.pop();
    if (!relativePath || visited.has(relativePath)) continue;
    visited.add(relativePath);
    const absolutePath = join(sourceRoot, relativePath);
    const source = readFileSync(absolutePath, "utf8");
    for (const match of source.matchAll(/\brequire\(\s*["'](\.{1,2}\/[^"']+)["']\s*\)/g)) {
      const dependency = resolveLocalRequireForTest(sourceRoot, absolutePath, match[1]);
      if (!visited.has(dependency)) pending.push(dependency);
    }
  }
  return [...visited].sort();
}

function resolveLocalRequireForTest(
  sourceRoot: string,
  importer: string,
  specifier: string
): string {
  const base = resolve(dirname(importer), specifier);
  const candidates = [
    base,
    `${base}.cjs`,
    `${base}.js`,
    `${base}.mjs`,
    `${base}.json`,
    join(base, "index.cjs"),
    join(base, "index.js"),
  ];
  for (const candidate of candidates) {
    if (!existsSync(candidate) || !statSync(candidate).isFile()) continue;
    const relativePath = relative(sourceRoot, candidate).split("\\").join("/");
    if (relativePath === ".." || relativePath.startsWith("../")) {
      throw new Error(`Local require escapes source root: ${specifier}`);
    }
    return relativePath;
  }
  throw new Error(`Cannot resolve local require ${specifier} from ${importer}`);
}

function copyGovernanceSourceRoot(fromRoot: string, toRoot: string): void {
  mkdirSync(join(toRoot, ".codex"), { recursive: true });
  copyFileSync(join(fromRoot, ".codex", "hooks.json"), join(toRoot, ".codex", "hooks.json"));
  const commands = registeredPreToolCommands(fromRoot);
  const sourceGraph = independentHookSourceGraph(fromRoot, commands);
  const relativePaths = new Set(
    sourceGraph.flatMap((handler: { files: Array<{ relative_path: string }> }) =>
      handler.files.map((file) => file.relative_path)
    )
  );
  for (const relativePath of relativePaths) {
    const destination = join(toRoot, relativePath);
    mkdirSync(dirname(destination), { recursive: true });
    copyFileSync(join(fromRoot, relativePath), destination);
  }
}

function exit2ErrorCode(
  receipt: {
    results: Array<{
      hook_results: Array<{ error_code: string }>;
      id: string;
    }>;
  },
  id: string
): string {
  const result = receipt.results.find((entry) => entry.id === id);
  expect(result, id).toBeDefined();
  expect(result?.hook_results, id).toHaveLength(1);
  return result?.hook_results[0].error_code || "";
}

function corpusRunMessage(run: { status: number | null; stderr: string; stdout: string }): string {
  try {
    const receipt = JSON.parse(run.stdout);
    return JSON.stringify({
      status: run.status,
      counts: receipt.counts,
      failures: receipt.results
        ?.filter((entry: { passed: boolean }) => !entry.passed)
        .slice(0, 25)
        .map(
          (entry: {
            error_hooks: string[];
            id: string;
            missing_expected_policy_results: unknown[];
            unexpected_policy_results: unknown[];
          }) => ({
            id: entry.id,
            error_hooks: entry.error_hooks,
            missing_expected_policy_results: entry.missing_expected_policy_results,
            unexpected_policy_results: entry.unexpected_policy_results,
          })
        ),
    });
  } catch {
    return JSON.stringify({
      status: run.status,
      stderr: run.stderr.slice(0, 1_000),
      stdout: run.stdout.slice(0, 1_000),
    });
  }
}
