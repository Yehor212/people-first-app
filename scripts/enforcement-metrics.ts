/**
 * Descriptive metrics for the active Codex hook control plane.
 *
 * Counts are operational observations only. They are never converted into a
 * quality score, security approval, or evidence that hooks loaded at runtime.
 */
import { existsSync, readFileSync } from "node:fs";
import path from "node:path";

type AuditEntry = {
  ts?: number;
  hook?: string;
  event?: string;
};

type HookConfig = {
  hooks?: Record<string, Array<{ hooks?: Array<{ command?: string }> }>>;
};

const ROOT = process.cwd();
const AUDIT_LOG = path.join(ROOT, ".codex-audit.log");
const HOOKS_JSON = path.join(ROOT, ".codex", "hooks.json");

function registeredInventory(): { events: number; invocations: number; files: number } {
  const config = JSON.parse(readFileSync(HOOKS_JSON, "utf8")) as HookConfig;
  const files = new Set<string>();
  let invocations = 0;
  const events = Object.entries(config.hooks ?? {});
  for (const [, groups] of events) {
    for (const group of groups) {
      for (const hook of group.hooks ?? []) {
        invocations += 1;
        const match = String(hook.command ?? "").replace(/\\/g, "/").match(/\.codex\/hooks\/([^/\s"']+\.cjs)/);
        if (match) files.add(match[1]);
      }
    }
  }
  return { events: events.length, invocations, files: files.size };
}

const inventory = registeredInventory();
console.log("CODEX ENFORCEMENT METRICS");
console.log(`registered_events=${inventory.events}`);
console.log(`registered_invocations=${inventory.invocations}`);
console.log(`registered_hook_files=${inventory.files}`);

if (!existsSync(AUDIT_LOG)) {
  console.log("audit_observations=UNVERIFIED");
  console.log("reason=.codex-audit.log is absent; registration counts do not prove runtime loading");
  process.exit(0);
}

const lines = readFileSync(AUDIT_LOG, "utf8").split("\n").filter(Boolean);
const entries: AuditEntry[] = [];
let malformed = 0;
for (const line of lines) {
  try {
    const parsed = JSON.parse(line) as AuditEntry;
    entries.push(parsed);
  } catch {
    malformed += 1;
  }
}

const counts = new Map<string, number>();
for (const entry of entries) {
  const key = `${entry.hook ?? "unknown"}:${entry.event ?? "unknown"}`;
  counts.set(key, (counts.get(key) ?? 0) + 1);
}

console.log(`audit_entries=${entries.length}`);
console.log(`audit_malformed=${malformed}`);
for (const [key, count] of [...counts.entries()].sort(([left], [right]) => left.localeCompare(right))) {
  console.log(`${key}=${count}`);
}
console.log("runtime_loading=UNVERIFIED");
console.log("effective_permissions=UNVERIFIED");
