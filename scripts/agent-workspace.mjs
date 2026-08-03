#!/usr/bin/env node

import { createRequire } from "node:module";

const require = createRequire(import.meta.url);
const {
  WorkspaceError,
  bootstrapHumanReviewWorkspace,
  createWorkspace,
  handoffWorkspace,
  inspectHumanReviewWorkspace,
  inspectWorkspace,
  syncWorkspace,
} = require("./agent-workspace-runtime.cjs");

const command = process.argv[2] || "help";
const options = parseOptions(process.argv.slice(3));

try {
  if (command === "help" || options.help) {
    printHelp();
  } else if (command === "doctor") {
    const state = inspectWorkspace({ cwd: process.cwd() });
    const errors = doctorErrors(state, String(options.mode || "edit"), options.agent);
    finish({
      command,
      errors,
      ok: errors.length === 0,
      state: publicState(state),
    });
  } else if (command === "create") {
    const result = createWorkspace({
      agent: requiredOption("agent"),
      cwd: process.cwd(),
      destination: requiredOption("path"),
      task: String(options.task || options.slug || missing("--task is required")),
    });
    finish({ command, ok: true, result });
  } else if (command === "bootstrap-human-review") {
    const result = bootstrapHumanReviewWorkspace({
      audioReviewPath: requiredOption("audio-review-path"),
      audioSourcePath: requiredOption("audio-source-path"),
      controlPath: requiredOption("control-path"),
      workspaceFile: requiredOption("workspace-file"),
    });
    finish({ command, ok: true, result });
  } else if (command === "check-human-review") {
    const result = inspectHumanReviewWorkspace({
      audioReviewPath: requiredOption("audio-review-path"),
      controlPath: requiredOption("control-path"),
      workspaceFile: requiredOption("workspace-file"),
    });
    finish({ command, ok: true, result });
  } else if (command === "sync") {
    const result = syncWorkspace({
      apply: options.apply === true,
      cwd: process.cwd(),
      reviewedSha: options["reviewed-sha"] || null,
    });
    finish({ command, ok: true, result });
  } else if (command === "handoff") {
    const receipt = handoffWorkspace({ cwd: process.cwd() });
    finish({ command, ok: true, receipt });
  } else {
    throw new WorkspaceError("UNKNOWN_COMMAND", `unknown command "${command}"`);
  }
} catch (error) {
  const code = error instanceof WorkspaceError ? error.code : "INTERNAL_ERROR";
  finish({
    command,
    errors: [sanitizeError(error)],
    ok: false,
    status: code,
  });
}

function doctorErrors(state, mode, agent) {
  const errors = [];
  if (!["edit", "review"].includes(mode)) errors.push('mode must be "edit" or "review"');
  if (state.detached) errors.push("detached HEAD is not a supported workspace");
  if (mode === "review") {
    if (state.branch !== "main") errors.push("review mode requires the integration main lane");
    if (!state.clean) errors.push("integration main must remain clean");
    if (state.ignoredPaths.length > 0) {
      errors.push("integration main must contain zero ignored local paths");
    }
  }
  if (mode === "edit") {
    if (!["codex", "kimi"].includes(String(agent))) {
      errors.push('edit mode requires --agent "codex" or "kimi"');
    }
    if (state.branch === "main") errors.push("main is review/integration only");
    if (agent && !String(state.branch || "").startsWith(`${agent}/`)) {
      errors.push(`edit branch must start with ${agent}/`);
    }
    if (!state.locked) errors.push("edit worktree must be locked");
    if (!state.clean && options["allow-dirty"] !== true) {
      errors.push(
        "edit startup check requires a clean worktree; use --allow-dirty only for inspection"
      );
    }
  }
  if (state.mainLaneCount !== 1) {
    errors.push(
      `shared worktree registry must contain exactly one main lane; found ${state.mainLaneCount}`
    );
  }
  return errors;
}

function publicState(state) {
  return {
    ahead: state.ahead,
    baseSha: state.baseSha,
    behind: state.behind,
    branch: state.branch,
    changedPathCount: state.changes.length,
    clean: state.clean,
    commonDir: state.commonDir,
    detached: state.detached,
    head: state.head,
    ignoredPathCount: state.ignoredPaths.length,
    lockReason: state.lockReason,
    locked: state.locked,
    mainLaneCount: state.mainLaneCount,
    repository: state.remoteId,
    rootDir: state.rootDir,
    upstream: state.upstream,
    upstreamHead: state.upstreamHead,
  };
}

function parseOptions(argv) {
  const parsed = {};
  for (let index = 0; index < argv.length; index += 1) {
    const token = argv[index];
    if (!token.startsWith("--")) {
      throw new WorkspaceError("INVALID_ARGUMENT", `unexpected argument "${token}"`);
    }
    const key = token.slice(2);
    if (["allow-dirty", "apply", "help", "json"].includes(key)) {
      parsed[key] = true;
      continue;
    }
    const value = argv[index + 1];
    if (!value || value.startsWith("--")) {
      throw new WorkspaceError("INVALID_ARGUMENT", `--${key} requires a value`);
    }
    parsed[key] = value;
    index += 1;
  }
  return parsed;
}

function requiredOption(name) {
  const value = options[name];
  if (!value || value === true) {
    throw new WorkspaceError("MISSING_OPTION", `--${name} is required`);
  }
  return String(value);
}

function missing(message) {
  throw new WorkspaceError("MISSING_OPTION", message);
}

function finish(payload) {
  const output = {
    status: payload.ok ? "GO" : payload.status || "STOP",
    ...payload,
  };
  if (options.json || payload.receipt) {
    process.stdout.write(`${JSON.stringify(output, null, 2)}\n`);
  } else {
    process.stdout.write(`${output.status}: ${output.command}\n`);
    const state = output.state;
    if (state) {
      process.stdout.write(
        `repo=${state.repository} branch=${state.branch || "DETACHED"} clean=${state.clean} ` +
          `ahead=${state.ahead ?? "?"} behind=${state.behind ?? "?"}\n`
      );
      process.stdout.write(`root=${state.rootDir}\n`);
    }
    if (output.result) {
      process.stdout.write(`${JSON.stringify(output.result, null, 2)}\n`);
    }
    for (const error of output.errors || []) process.stderr.write(`STOP: ${error}\n`);
  }
  process.exit(payload.ok ? 0 : 2);
}

function sanitizeError(error) {
  return String(error instanceof Error ? error.message : error)
    .replace(/https?:\/\/[^@\s/]+@/gi, "https://REDACTED@")
    .replace(/\s+/g, " ")
    .trim()
    .slice(0, 800);
}

function printHelp() {
  process.stdout.write(
    [
      "ZenFlow Codex/Kimi isolated workspace command",
      "",
      "Usage:",
      "  npm run agent:workspace -- doctor --mode review [--json]",
      "  npm run agent:workspace -- doctor --mode edit --agent codex|kimi [--allow-dirty] [--json]",
      "  npm run agent:workspace -- create --agent codex|kimi --task <slug> --path <absolute-path>",
      "  npm run agent:workspace -- bootstrap-human-review --control-path <absolute-path> --audio-source-path <absolute-path> --audio-review-path <absolute-path> --workspace-file <absolute-path>",
      "  npm run agent:workspace -- check-human-review --control-path <absolute-path> --audio-review-path <absolute-path> --workspace-file <absolute-path>",
      "  npm run agent:workspace -- sync [--apply] [--reviewed-sha <exact-origin-main-sha>]",
      "  npm run agent:workspace -- handoff [--json]",
      "",
      "sync fetches only by default. --apply is limited to the clean behind-only integration main lane.",
      "Protected incoming agent/governance paths require an exact reviewed SHA.",
      "The tool never stashes, resets, cleans, rebases, pulls, force-pushes, or deletes work.",
      "",
    ].join("\n")
  );
}
