#!/usr/bin/env node
"use strict";

const fs = require("node:fs");
const {
  detectSubagentViolations,
  detectViolations,
  noTemplateContext,
  subagentEvidenceContext,
} = require("../../../.codex/hooks/no-ai-template-gate.cjs");

function emit(value) {
  process.stdout.write(`${JSON.stringify(value)}\n`);
}

function block(violations, scope) {
  process.stderr.write(
    [
      "NO AI TEMPLATE GATE BLOCKED",
      `Detected: ${violations.join("; ")}`,
      `Continue by rewriting the ${scope} so it is ZenFlow-specific and evidence-backed.`,
    ].join("\n") + "\n"
  );
  process.exit(2);
}

try {
  const data = JSON.parse(fs.readFileSync(0, "utf8"));
  const eventName = data.hook_event_name || data.event || "UserPromptSubmit";
  if (eventName === "UserPromptSubmit") {
    emit({
      hookSpecificOutput: {
        hookEventName: "UserPromptSubmit",
        additionalContext: noTemplateContext(),
      },
    });
  } else if (eventName === "SubagentStart") {
    emit({
      hookSpecificOutput: {
        hookEventName: "SubagentStart",
        additionalContext: subagentEvidenceContext(),
      },
    });
  } else if (eventName === "Stop") {
    if (data.stop_hook_active === true) emit({ continue: true });
    else {
      const violations = detectViolations(data.last_assistant_message || "");
      if (violations.length > 0) block(violations, "final answer");
      emit({ continue: true });
    }
  } else if (eventName === "SubagentStop") {
    if (data.stop_hook_active === true) emit({ continue: true });
    else {
      const violations = detectSubagentViolations(
        data.last_assistant_message || data.message || ""
      );
      if (violations.length > 0) block(violations, "subagent result");
      emit({ continue: true });
    }
  } else {
    emit({ continue: true });
  }
} catch (error) {
  process.stderr.write(`HOOK ERROR [no-ai-template-gate]: ${error.message || error}\n`);
  process.exit(2);
}
