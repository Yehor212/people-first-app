#!/usr/bin/env node
import { createHash } from "node:crypto";
import { existsSync } from "node:fs";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import { fileURLToPath } from "node:url";

import { getZenflowContext, resolveZenflowContext } from "./server.mjs";

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot =
  process.env.ZENFLOW_CONTEXT_ROOT || path.resolve(__dirname, "..", "..");
const outputDir = path.join(repoRoot, ".Codex", "auto-context");
const currentPackPath = path.join(outputDir, "current.md");
const currentMetaPath = path.join(outputDir, "current.json");
const maxChars = Number(process.env.ZENFLOW_CONTEXT_AUTO_MAX_CHARS || "8500");

function argValue(flag, fallback = "") {
  const index = process.argv.indexOf(flag);
  return index === -1 ? fallback : process.argv[index + 1] || fallback;
}

function hash(text) {
  return createHash("sha256").update(text || "").digest("hex").slice(0, 12);
}

async function readStdin() {
  if (process.stdin.isTTY) {
    return "";
  }
  let input = "";
  for await (const chunk of process.stdin) {
    input += chunk;
  }
  return input;
}

async function readOptional(relativePath) {
  const target = path.join(repoRoot, relativePath);
  try {
    return await readFile(target, "utf8");
  } catch {
    return "";
  }
}

function parseHookInput(raw) {
  if (!raw.trim()) {
    return {};
  }
  try {
    return JSON.parse(raw);
  } catch {
    return { prompt: raw };
  }
}

async function deriveTopic(input, explicitTopic, eventName) {
  if (explicitTopic) {
    return explicitTopic;
  }

  const direct =
    input.prompt ||
    input.user_message ||
    input.message ||
    input.content ||
    input.command_args ||
    "";

  if (direct && String(direct).trim().length > 0) {
    return String(direct).trim();
  }

  const savedGoal = (await readOptional(".user-goal-contract")).trim();
  if (savedGoal) {
    return savedGoal;
  }

  if (eventName === "SubagentStart") {
    return "subagent startup inherited ZenFlow context";
  }

  return "startup verification";
}

function compactForHook(pack, metadata) {
  const header = [
    "ZENFLOW AUTO-CONTEXT: generated automatically before this agent step.",
    `- context_id: ${metadata.contextId}`,
    `- pack_path: ${metadata.packPath}`,
    `- prompt_hash: ${metadata.promptHash}`,
    "- Use this as routing context only; re-verify live facts before claiming current status.",
    "- For external libraries, use Context7; for project rules and historical lessons, use ZenFlow Context.",
    "",
  ].join("\n");

  const budget = Math.max(2000, Math.min(9500, maxChars));
  const remaining = Math.max(1000, budget - header.length);
  const body = pack.length <= remaining ? pack : `${pack.slice(0, remaining).trimEnd()}\n...`;
  return `${header}${body}`;
}

async function generateAutoContext({ eventName, topic, source }) {
  const resolved = resolveZenflowContext({ task: topic, maxContexts: 3 });
  const selected = resolved.filter((item) => item.score > 0).slice(0, 2);
  const selectedContexts = selected.length > 0 ? selected : [resolved[0] || { id: "startup" }];
  const contextId = selectedContexts.map((item) => item.id).join("+") || "startup";
  const packBudgets = selectedContexts.length === 1
    ? [maxChars]
    : [Math.floor(maxChars * 0.62), Math.floor(maxChars * 0.38)];
  const packs = [];
  for (let index = 0; index < selectedContexts.length; index += 1) {
    const item = selectedContexts[index];
    const pack = await getZenflowContext({
      contextId: item.id,
      task: topic,
      maxChars: packBudgets[index],
    });
    packs.push(`<!-- auto-context profile: ${item.id} -->\n${pack}`);
  }
  const pack = packs.join("\n\n---\n\n");
  const metadata = {
    generatedAt: new Date().toISOString(),
    eventName,
    source,
    topicPreview: topic.slice(0, 240),
    promptHash: hash(topic),
    contextId,
    contextIds: selectedContexts.map((item) => item.id),
    resolved,
    packPath: ".Codex/auto-context/current.md",
  };

  await mkdir(outputDir, { recursive: true });
  await writeFile(currentPackPath, pack, "utf8");
  await writeFile(currentMetaPath, `${JSON.stringify(metadata, null, 2)}\n`, "utf8");

  return { pack, metadata };
}

async function checkAutoContext() {
  const { pack, metadata } = await generateAutoContext({
    eventName: "Check",
    topic: "startup verification",
    source: "ai:context:auto-check",
  });

  if (!pack.includes("ZenFlow Context Pack")) {
    throw new Error("generated context pack is missing its expected heading");
  }
  if (!existsSync(currentPackPath) || !existsSync(currentMetaPath)) {
    throw new Error("auto-context files were not written");
  }

  console.log(JSON.stringify({
    ok: true,
    contextId: metadata.contextId,
    packPath: metadata.packPath,
    promptHash: metadata.promptHash,
  }, null, 2));
}

async function main() {
  if (process.argv.includes("--check")) {
    await checkAutoContext();
    return;
  }

  const raw = await readStdin();
  const input = parseHookInput(raw);
  const explicitEvent = argValue("--event", "");
  const eventName = explicitEvent || input.hook_event_name || "Manual";
  const explicitTopic = argValue("--topic", "");
  const topic = await deriveTopic(input, explicitTopic, eventName);
  const { pack, metadata } = await generateAutoContext({
    eventName,
    topic,
    source: process.argv.includes("--hook") ? "hook" : "manual",
  });

  if (process.argv.includes("--hook")) {
    const hookEventName = eventName === "Manual" ? "UserPromptSubmit" : eventName;
    console.log(JSON.stringify({
      hookSpecificOutput: {
        hookEventName,
        additionalContext: compactForHook(pack, metadata),
      },
    }));
    return;
  }

  console.log(compactForHook(pack, metadata));
}

await main();
